#ifndef MAPLE_SERVER_PROTOCOL_H
#define MAPLE_SERVER_PROTOCOL_H
#include <string.h>
#include <assert.h>

#define RING_DEPTH 4096

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

static void
__discard_message(void *_msg)
{
	struct maple_message *msg = _msg;

	free(msg->payload);
	msg->payload = NULL;
	msg->len = 0;
}

static int
maple_process(struct lws *wsi, enum lws_callback_reasons reason,
			  void *user, void *in, size_t len)
{
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

		/* get the pointers we were passed in pvo */

		vhd->interrupted = (int *)lws_pvo_search(
			(const struct lws_protocol_vhost_options *)in,
			"interrupted"
		)->value;
		vhd->options = (int *)lws_pvo_search(
			(const struct lws_protocol_vhost_options *)in,
			"options"
		)->value;
		break;

	case LWS_CALLBACK_ESTABLISHED:
		/* generate a block of output before travis times us out */
		lwsl_warn("LWS_CALLBACK_ESTABLISHED\n");
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

		if (len) {
			;
			//puts((const char *)in);
			//lwsl_hexdump_notice(in, len);
		}

		amsg.first = lws_is_first_fragment(wsi);
		amsg.final = lws_is_final_fragment(wsi);
		amsg.binary = lws_frame_is_binary(wsi);
		n = (int)lws_ring_get_count_free_elements(pss->ring);
		if (!n) {
			lwsl_user("dropping!\n");
			break;
		}

		if (amsg.final) {
			pss->msglen = 0;
		} else {
			pss->msglen += len;
		}

		amsg.len = len;
		/* notice we over-allocate by LWS_PRE */
		amsg.payload = malloc(LWS_PRE + len);
		if (!amsg.payload) {
			lwsl_user("OOM: dropping\n");
			break;
		}

		memcpy((char *)amsg.payload + LWS_PRE, in, len);
		if (!lws_ring_insert(pss->ring, &amsg, 1)) {
			__discard_message(&amsg);
			lwsl_user("dropping!\n");
			break;
		}
		lws_callback_on_writable(wsi);

		if (n < 3 && !pss->flow_controlled) {
			pss->flow_controlled = 1;
			lws_rx_flow_control(wsi, 0);
		}
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