#ifndef MAPLE_SERVER_PROTOCOL_H
#define MAPLE_SERVER_PROTOCOL_H
#include <string.h>
#include <assert.h>

#include "maple-wz.h"

#define RING_DEPTH 4096

typedef struct {
	const char * wz_base_dir;
} maple_server_config;

static maple_server_config maple_global_server_config = {
	NULL
};

struct maple_message {
	void *payload; /* is malloc'd */
	size_t len;
	char binary;
	char first;
	char final;
};

struct maple_session {
	struct lws_ring *ring;
	uint32_t msglen;
	uint32_t tail;
	uint8_t completed:1;
	uint8_t flow_controlled:1;
	uint8_t write_consume_pending:1;
};

struct vhd_data {
	struct lws_context *context;
	struct lws_vhost *vhost;

	int *interrupted;
	int *options;
};

enum maple_args_type {
	MAPLE_ARGTYPE_WZ_READ,
	MAPLE_ARGTYPE_ECHO
};

struct maple_args {
	enum maple_args_type type;
	void * data;
};

struct maple_data_echo {
	unsigned int len;
	const char * contents;
};

struct maple_data_wz_read {
	unsigned int len;
	const char * nodepath;
};

static void
__discard_message(void * msg_raw) {
	struct maple_message *msg = msg_raw;
	free(msg->payload);
	msg->payload = NULL;
	msg->len = 0;
}

static int
maple_process_echo_reply(
	struct maple_args * args,
	struct lws * wsi,
	struct maple_session * session,
	struct vhd_data * vhd,
	struct maple_message * out
) {
	struct maple_data_echo * data = (struct maple_data_echo *)(args->data);
	if (out->final) {
		session->msglen = 0;
	} else {
		session->msglen += data->len;
	}
	out->len = data->len;
	/* notice we over-allocate by LWS_PRE */
	out->payload = malloc(LWS_PRE + data->len);
	if (!out->payload) {
		lwsl_user("OOM: dropping\n");
		return 0;
	}
	memcpy((char *)out->payload + LWS_PRE, data->contents, data->len);
	if (!lws_ring_insert(session->ring, out, 1)) {
		__discard_message(out);
		lwsl_user("dropping!\n");
		return 0;
	}
	return 1;
}

static int
maple_process_wz_read_reply(
	struct maple_args * args,
	struct lws * wsi,
	struct maple_session * session,
	struct vhd_data * vhd,
	struct maple_message * out
) {
	if (!maple_global_server_config.wz_base_dir) {
		return 0;
	}
	struct maple_data_wz_read * data = (struct maple_data_wz_read *)(args->data);
	// nodepath = <filename>/<nodepath>
	// e.g. base.wz/
	const char * cur = data->nodepath;
	unsigned int len = data->len;
	wz_ctx_t * wz = NULL;
	int ret = 0, index = 0;
	char name[256];
	char buf[4096];
	if (*cur == '/') {
		cur ++;
		len --;
	}
	while (index < sizeof(name) && index < len) {
		char ch = cur[index];
		if (ch == '/') {
			name[index] = 0;
			break;
		}
		name[index] = ch;
		index ++;
	}
	if (index + strlen(maple_global_server_config.wz_base_dir) >= sizeof(buf)) {
		// filename too long
		return 0;
	}
	sprintf(buf, "%s/%s", maple_global_server_config.wz_base_dir, name);
	cur += index;
	len -= index;
	if (len > 0) {
		cur ++;
		len --;
	}
	if (len > sizeof(name)) {
		// nodepath too long
		return 0;
	}
	if (len) {
		memcpy(name, cur, len);
	}
	name[len] = 0;
	wz = maple_open_file(buf);
	ret = maple_json_node(wz, name, buf, sizeof(buf));
	maple_close_file(wz);

	if (!ret) {
		return 0;
	}

	len = strlen(buf);
	if (out->final) {
		session->msglen = 0;
	} else {
		session->msglen += len;
	}
	out->len = len;
	/* notice we over-allocate by LWS_PRE */
	out->payload = malloc(LWS_PRE + len);
	if (!out->payload) {
		lwsl_user("OOM: dropping\n");
		return 0;
	}
	memcpy((char *)out->payload + LWS_PRE, buf, len);
	if (!lws_ring_insert(session->ring, out, 1)) {
		__discard_message(out);
		lwsl_user("dropping!\n");
		return 0;
	}
	return 1;
}

static int
maple_process_reply(
	struct maple_args * args,
	struct lws * wsi,
	struct maple_session * session,
	struct vhd_data * vhd,
	struct maple_message * out
) {
	int ret;
	switch (args->type) {
	case MAPLE_ARGTYPE_WZ_READ: {
		ret = maple_process_wz_read_reply(args, wsi, session, vhd, out);
		break;
	}

	case MAPLE_ARGTYPE_ECHO: default: {
		ret = maple_process_echo_reply(args, wsi, session, vhd, out);
	}

	}
	lws_callback_on_writable(wsi);
	return ret;
}

static int
maple_process_message(
	const char * in, unsigned int len,
	struct lws * wsi,
	struct maple_session * session,
	struct vhd_data * vhd,
	struct maple_message * out
) {
	int n, ret;
	struct maple_args args;
	if (len) {
		lwsl_hexdump_notice(in, len);
	}
	out->first = lws_is_first_fragment(wsi);
	out->final = lws_is_final_fragment(wsi);
	out->binary = lws_frame_is_binary(wsi);
	n = (int)lws_ring_get_count_free_elements(session->ring);
	if (!n) {
		lwsl_user("dropping!\n");
		return 0;
	}
	/* control char:
	   - R<path>
	 */
	switch (in[0]) {
	case 'R': {
		struct maple_data_wz_read data;
		data.nodepath = in + 1 /* skip ahead 'R' */;
		data.len = len - 1;
		args.type = MAPLE_ARGTYPE_WZ_READ;
		args.data = (void *)&data;
		ret = maple_process_reply(&args, wsi, session, vhd, out);
		break;
	}

	default: {
		struct maple_data_echo data;
		data.contents = in;
		data.len = len;
		args.type = MAPLE_ARGTYPE_ECHO;
		args.data = (void *)&data;
		ret = maple_process_reply(&args, wsi, session, vhd, out);
	}

	}

	if (n < 3 && !session->flow_controlled) {
		session->flow_controlled = 1;
		lws_rx_flow_control(wsi, 0);
	}
	return ret;
}

static int
maple_process(
	struct lws *wsi,
	enum lws_callback_reasons reason,
	void *user, void *in, size_t len
) {
	struct maple_session *pss = (struct maple_session *)user;
	// pss->completed = 1 to mrak user session done
	struct vhd_data *vhd = (struct vhd_data *)lws_protocol_vh_priv_get(
		lws_get_vhost(wsi),
		lws_get_protocol(wsi)
	);
	const struct maple_message *pmsg;
	struct maple_message amsg;
	int m, n, flags;
	switch (reason) {
	case LWS_CALLBACK_PROTOCOL_INIT:
		vhd = lws_protocol_vh_priv_zalloc(
			lws_get_vhost(wsi),
			lws_get_protocol(wsi),
			sizeof(struct vhd_data)
		);
		if (!vhd) {
			return -1;
		}
		vhd->context = lws_get_context(wsi);
		vhd->vhost = lws_get_vhost(wsi);
		if (in) {
			/* get the pointers we were passed in pvo */
			vhd->interrupted = (int *)(lws_pvo_search(
				(const struct lws_protocol_vhost_options *)in,
				"interrupted"
			)->value);
			vhd->options = (int *)(lws_pvo_search(
				(const struct lws_protocol_vhost_options *)in,
				"options"
			)->value);
		} else {
			vhd->interrupted = NULL;
			vhd->options = NULL;
		}
		break;

	case LWS_CALLBACK_ESTABLISHED:
		/* generate a block of output before travis times us out */
		lwsl_warn("LWS_CALLBACK_ESTABLISHED\n");
		// TODO: check DoS or the max number of users
		pss->ring = lws_ring_create(
			sizeof(struct maple_message),
			RING_DEPTH,
			__discard_message
		);
		if (!pss->ring) {
			return 1;
		}
		pss->tail = 0;
		break;

	case LWS_CALLBACK_SERVER_WRITEABLE:
		lwsl_user("LWS_CALLBACK_SERVER_WRITEABLE\n");
		if (pss->write_consume_pending) {
			/* perform the deferred fifo consume */
			lws_ring_consume_single_tail(pss->ring, &pss->tail, 1);
			pss->write_consume_pending = 0;
		}

		pmsg = lws_ring_get_element(pss->ring, &pss->tail);
		if (!pmsg) {
			lwsl_user(" (nothing in ring)\n");
			break;
		}
		flags = lws_write_ws_flags(
			pmsg->binary ? LWS_WRITE_BINARY : LWS_WRITE_TEXT,
			pmsg->first,
			pmsg->final
		);
		/* notice we allowed for LWS_PRE in the payload already */
		m = lws_write(
			wsi,
			((unsigned char *)pmsg->payload) + LWS_PRE, pmsg->len,
			flags
		);
		if (m < (int)pmsg->len) {
			lwsl_err("ERROR %d writing to ws socket\n", m);
			return -1;
		}

		lwsl_user(
			" wrote %d: flags: 0x%x first: %d final %d\n",
			m, flags, pmsg->first, pmsg->final
		);
		/*
		 * Workaround deferred deflate in pmd extension by only
		 * consuming the fifo entry when we are certain it has been
		 * fully deflated at the next WRITABLE callback.  You only need
		 * this if you're using pmd.
		 */
		pss->write_consume_pending = 1;
		lws_callback_on_writable(wsi);
		if (
			pss->flow_controlled &&
			(int)lws_ring_get_count_free_elements(pss->ring) > RING_DEPTH - 5
		) {
			lws_rx_flow_control(wsi, 1);
			pss->flow_controlled = 0;
		}
		break;

	case LWS_CALLBACK_RECEIVE:
		lwsl_user(
			"LWS_CALLBACK_RECEIVE: %4d (rpp %5d, first %d, "
			"last %d, bin %d, msglen %d (+ %d = %d))\n",
			(int)len, (int)lws_remaining_packet_payload(wsi),
			lws_is_first_fragment(wsi),
			lws_is_final_fragment(wsi),
			lws_frame_is_binary(wsi), pss->msglen, (int)len,
			(int)pss->msglen + (int)len
		);
		maple_process_message((const char *)in, len, wsi, pss, vhd, &amsg);
		break;

	case LWS_CALLBACK_CLOSED:
		lwsl_user("LWS_CALLBACK_CLOSED\n");
		lws_ring_destroy(pss->ring);
		// stop server: lws_cancel_service(lws_get_context(wsi));
		break;

	default:
		break;
	}

	return 0;
}

#define MAPLE_SERVER \
	{ \
		"maple-server", \
		maple_process, \
		sizeof(struct maple_session), \
		1024, \
		0, NULL, 0 \
	}

#endif