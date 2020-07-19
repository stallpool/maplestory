#include <libwebsockets.h>
#include <string.h>
#include <signal.h>

#define LWS_PLUGIN_STATIC
#include "maple-server-protocol.h"

static struct lws_protocols protocols[] = {
	MAPLE_SERVER,
	{ NULL, NULL, 0, 0 } /* terminator */
};

static int interrupted, options;
static int port = 12020, options;

/* pass pointers to shared vars to the protocol */

static const struct lws_protocol_vhost_options pvo_options = {
	NULL,
	NULL,
	"options",       /* pvo name */
	(void *)&options /* pvo value */
};

static const struct lws_protocol_vhost_options pvo_interrupted = {
	&pvo_options,
	NULL,
	"interrupted",       /* pvo name */
	(void *)&interrupted /* pvo value */
};

static const struct lws_protocol_vhost_options pvo = {
	NULL,                      /* "next" pvo linked-list */
	&pvo_interrupted,          /* "child" pvo linked-list */
	"lws-minimal-server-echo", /* protocol name we belong to on this vhost */
	""                         /* ignored */
};
static const struct lws_extension extensions[] = {
	{
		"permessage-deflate",
		lws_extension_callback_pm_deflate,
		"permessage-deflate"
		 "; client_no_context_takeover"
		 "; client_max_window_bits"
	},
	{ NULL, NULL, NULL /* terminator */ }
};

void sigint_handler(int sig)
{
	interrupted = 1;
}

int main(int argc, const char **argv)
{
	struct lws_context_creation_info info;
	struct lws_context *context;
	const char *p;
	int n = 0, logs = LLL_USER | LLL_ERR | LLL_WARN | LLL_NOTICE
			/* for LLL_ verbosity above NOTICE to be built into lws,
			 * lws must have been configured and built with
			 * -DCMAKE_BUILD_TYPE=DEBUG instead of =RELEASE */
			/* | LLL_INFO */ /* | LLL_PARSER */ /* | LLL_HEADER */
			/* | LLL_EXT */ /* | LLL_CLIENT */ /* | LLL_LATENCY */
			/* | LLL_DEBUG */;

	if (lws_cmdline_option(argc, argv, "-h")) {
		printf(
			"maple-server    MapleStory World server\n\n"
			"usage: maple-server [-d logDirectory] [-p port] [-n] [-b wz_base_dir]\n"
			"	-n   run without extensions\n"
			"	-b   wz resource base directory path\n"
		);
		return 1;
	}

	signal(SIGINT, sigint_handler);

	if ((p = lws_cmdline_option(argc, argv, "-d"))) {
		logs = atoi(p);
	}

	lws_set_log_level(logs, NULL);
	lwsl_user("initializing maple server ...\n");

	if ((p = lws_cmdline_option(argc, argv, "-p"))) {
		port = atoi(p);
	}

	if ((p = lws_cmdline_option(argc, argv, "-b"))) {
		maple_global_server_config.wz_base_dir = p;
		lwsl_user("wz resource base directory: %s\n", p);
	}

	memset(&info, 0, sizeof info); /* otherwise uninitialized garbage */
	info.port = port;
	info.protocols = protocols;
	info.pvo = &pvo;
	if (!lws_cmdline_option(argc, argv, "-n")) {
		info.extensions = extensions;
	}
	info.pt_serv_buf_size = 32 * 1024;
	info.options = LWS_SERVER_OPTION_VALIDATE_UTF8 |
		LWS_SERVER_OPTION_HTTP_HEADERS_SECURITY_BEST_PRACTICES_ENFORCE;

	context = lws_create_context(&info);
	if (!context) {
		lwsl_err("maple server init failed.\n");
		return 1;
	}

	while (n >= 0 && !interrupted) {
		n = lws_service(context, 0);
	}

	lws_context_destroy(context);
	lwsl_user("maple server stopped; %s.\n", interrupted == 2 ? "normally" : "interrupted or crashed");
	return interrupted != 2;
}
