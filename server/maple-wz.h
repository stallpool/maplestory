#ifndef MAPLE_WZ_H
#define MAPLE_WZ_H

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "wz.h"
#include "maple-string.h"

typedef struct {
	wzctx  * ctx;
	wzfile * file;
	wznode * root;
} wz_ctx_t;

static void
maple_close_file(wz_ctx_t * wz) {
	if (wz->root) {
		wz_close_node(wz->root);
		wz->root = NULL;
	}
	if (wz->file) {
		wz_close_file(wz->file);
		wz->file = NULL;
	}
	if (wz->ctx) {
		wz_free_ctx(wz->ctx);
		wz->ctx = NULL;
	}
	if (wz) {
		free(wz);
	}
}

static int
maple_file_exists(const char * filepath) {
	// any platform support this
	FILE *file;
	if ((file = fopen(filepath, "r"))) {
		fclose(file);
		return 1;
	}
	return 0;
}

static wz_ctx_t *
maple_open_file(const char * filepath) {
	wz_ctx_t * wz;
	if (!maple_file_exists(filepath)) {
		return NULL;
	}
	wz = (wz_ctx_t *)malloc(sizeof(wz_ctx_t));
	wz->ctx = wz_init_ctx();
	if (!wz->ctx) {
		free(wz);
		return NULL;
	}
	wz->file = wz_open_file(filepath, wz->ctx);
	if (!wz->file) {
		maple_close_file(wz);
		return NULL;
	}
	wz->root = wz_open_root(wz->file);
	if (!wz->root) {
		maple_close_file(wz);
		return NULL;
	}
	return wz;
}

static wznode *
maple_get_node(wz_ctx_t * wz, const char * path) {
	if (!wz->root) {
		return NULL;
	}
	return wz_open_node(wz->root, path);
}

static maple_string *
maple_json_array_node(wznode * node) {
	// WZ_ARY, WZ_IMG
	wznode * cur;
	const char * name;
	wz_uint32_t len, i;
	unsigned int name_len, notfirst;
	maple_string * json = maple_string_alloc();
	maple_string_append_charstar(json, "{\"type\":\"array\",\"data\":[", 24);
	wz_get_len(&len, node);
	notfirst = 0;
	for (i = 0; i < len; i ++) {
		cur = wz_open_node_at(node, i);
		if (!cur) continue;
		name = wz_get_name(cur);
		// TODO: normalize json string
		name_len = strlen(name);
		if (name_len > 0) {
			if (notfirst) {
				maple_string_append_char(json, ',');
			} else {
				notfirst = 1;
			}
			maple_string_append_char(json, '"');
			maple_string_append_charstar(json, name, name_len);
			maple_string_append_char(json, '"');
		}
		wz_close_node(cur);
	}
	maple_string_append_charstar(json, "]}", 2);
	return json;
}

static maple_string *
maple_json_string_node(wznode * node) {
	const char * text = wz_get_str(node);
	unsigned int text_len = strlen(text);
	maple_string * json = maple_string_alloc();
	maple_string_append_charstar(json, "{\"type\":\"string\",\"data\":\"", 26);
	// TODO: normalize json string
	maple_string_append_charstar(json, text, text_len);
	maple_string_append_charstar(json, "\"}", 2);
	return json;
}

static maple_string *
maple_json_nil_node(wznode * node) {
	maple_string * json = maple_string_alloc();
	maple_string_append_charstar(json, "{\"type\":\"nil\",\"data\":null}", 26);
	return json;
}

static maple_string *
maple_json_number_node(wznode * node) {
	maple_string * json = maple_string_alloc();
	maple_string_append_charstar(json, "{\"type\":\"number\",\"data\":", 24);
	switch(wz_get_type(node)) {
	case WZ_I16: {
		wz_int32_t val;
		wz_get_int(&val, node);
		maple_string_append_int(json, val);
		break;
	}
	case WZ_I32: {
		wz_int32_t val;
		wz_get_int(&val, node);
		maple_string_append_int(json, val);
		break;
	}
	case WZ_I64: {
		wz_int64_t val;
		wz_get_i64(&val, node);
		maple_string_append_long(json, val);
		break;
	}
	case WZ_F32: {
		float val;
		wz_get_f32(&val, node);
		maple_string_append_float(json, val);
		break;
	}
	case WZ_F64: {
		double val;
		wz_get_f64(&val, node);
		maple_string_append_double(json, val);
		break;
	}
	default:
		maple_string_append_charstar(json, "null", 4);
	}
	maple_string_append_char(json, '}');
	return json;
}

static maple_string *
maple_json_vec_node(wznode * node) {
	maple_string * json = maple_string_alloc();
	maple_string_append_charstar(json, "{\"type\":\"vector\",\"data\":[", 25);
	switch (wz_get_type(node)) {
	case WZ_VEC: {
		wz_int32_t x, y;
		wz_get_vec(&x, &y, node);
		maple_string_append_int(json, x);
		maple_string_append_char(json, ',');
		maple_string_append_int(json, y);
		break;
	}
	case WZ_VEX: {
		wz_uint32_t n, i;
		wz_int32_t x, y;
		wz_get_vex_len(&n, node);
		for (i = 0; i < n; i++) {
			if (i > 0) {
				maple_string_append_char(json, ',');
			}
			wz_get_vex_at(&x, &y, i, node);
			maple_string_append_int(json, x);
			maple_string_append_char(json, ',');
			maple_string_append_int(json, y);
		}
		break;
	}
	default: break;
	}
	maple_string_append_charstar(json, "]}", 2);
	return json;
}

static maple_string *
maple_json_image_node (wznode * node) {
	wz_uint32_t w, h;
	wz_uint16_t depth;
	wz_uint8_t scale;
	wz_get_img(&w, &h, &depth, &scale, node);
	maple_string * json = maple_string_alloc();
	maple_string * nested;
	maple_string_append_charstar(json, "{\"type\":\"image\",\"data\":{", 24);
	maple_string_append_charstar(json, "\"width\":", 8);
	maple_string_append_int(json, w);
	maple_string_append_charstar(json, ",\"height\":", 10);
	maple_string_append_int(json, h);
	maple_string_append_charstar(json, ",\"scale\":", 9);
	if (scale < 0 || scale > 4) {
		maple_string_append_int(json, 0);
	} else {
		maple_string_append_int(json, 1 << scale);
	}
	maple_string_append_charstar(json, ",\"depth\":", 9);
	switch (depth) {
		case WZ_COLOR_8888: maple_string_append_charstar(json, "\"8888\"", 6); break;
		case WZ_COLOR_4444: maple_string_append_charstar(json, "\"4444\"", 6); break;
		case WZ_COLOR_565:  maple_string_append_charstar(json, "\"565\"", 5);  break;
		case WZ_COLOR_DXT3: maple_string_append_charstar(json, "\"dxt3\"", 6); break;
		case WZ_COLOR_DXT5: maple_string_append_charstar(json, "\"dxt5\"", 6); break;
		default:            maple_string_append_charstar(json, "\"unk\"", 5);  break;
	}
	maple_string_append_charstar(json, "},\"nested\":", 11);
	nested = maple_json_array_node(node);
	if (nested) {
		maple_string_append_string(json, nested);
	} else {
		maple_string_append_charstar(json, "null", 4);
	}
	maple_string_append_charstar(json, "}", 2);
	return json;
}

static wz_uint8_t *
maple_raw_image_node (wznode * node, unsigned int * outsize) {
	wz_uint32_t w, h;
	wz_uint16_t depth;
	wz_uint8_t scale;
	wz_uint8_t * data = wz_get_img(&w, &h, &depth, &scale, node);
	// ?size: w * h * 4
	*outsize = w * h * 4;
	return data;
}

static maple_string *
maple_json_audio_node (wznode * node) {
    wz_uint32_t size;
    wz_uint32_t ms;
    wz_uint16_t format;
    wz_get_ao(&size, &ms, &format, node);
	maple_string * json = maple_string_alloc();
	maple_string_append_charstar(json, "{\"type\":\"audio\",\"data\":{", 24);
	maple_string_append_charstar(json, "\"size\":", 7);
	maple_string_append_int(json, size);
	maple_string_append_char(json, ',');
	maple_string_append_charstar(json, "\"ms\":", 5);
	maple_string_append_int(json, ms);
	maple_string_append_char(json, ',');
	maple_string_append_charstar(json, "\"format\":", 9);
	switch (format) {
		case WZ_AUDIO_PCM: maple_string_append_charstar(json, "\"pcm\"", 5); break;
		case WZ_AUDIO_MP3: maple_string_append_charstar(json, "\"mp3\"", 5); break;
		default:           maple_string_append_charstar(json, "\"unk\"", 5);  break;
	}
	maple_string_append_charstar(json, "}}", 2);
	return json;
}

static wz_uint8_t *
maple_raw_audio_node (wznode * node, unsigned int * outsize) {
    wz_uint32_t size;
    wz_uint32_t ms;
    wz_uint16_t format;
    wz_uint8_t * data = wz_get_ao(&size, &ms, &format, node);
	*outsize = size;
	return data;
}

static int
maple_raw_node(wz_ctx_t * wz, const char * path, char * outbuf, unsigned int outbuf_len, int *need) {
	wznode * node = maple_get_node(wz, path);
	int ret = 0;
	unsigned int size = 0;
	wz_uint8_t * data;
	*need = outbuf_len;
	switch (wz_get_type(node)) {
	case WZ_IMG: data = maple_raw_image_node(node, &size); break;
	case WZ_AO:  data = maple_raw_audio_node(node, &size); break;
	default:     ret = -1;
	}
	if (size > outbuf_len) {
		ret = -1;
		*need = size;
	}
	if (ret >= 0) {
		memcpy(outbuf, data, size);
		ret = (int)size;
	}
	wz_close_node(node);
	return ret;
}

static int
maple_json_node(wz_ctx_t * wz, const char * path, char * outbuf, unsigned int outbuf_len, int *need) {
	maple_string * json;
	int ret = 0;
	wznode * node = maple_get_node(wz, path);
	if (!node) {
		outbuf[0] = 0;
		return 0;
	}
	switch (wz_get_type(node)) {
	case WZ_ARY: json = maple_json_array_node(node); break;
	case WZ_IMG: json = maple_json_image_node(node); break;
	case WZ_AO:  json = maple_json_audio_node(node); break;
	case WZ_STR: json = maple_json_string_node(node); break;
	case WZ_VEX:
	case WZ_VEC: json = maple_json_vec_node(node); break;
	case WZ_I16:
	case WZ_I32:
	case WZ_I64:
	case WZ_F32:
	case WZ_F64: json = maple_json_number_node(node); break;
	case WZ_NIL: json = maple_json_nil_node(node); break;
	}
	wz_close_node(node);
	// len = sprintf_s(outbuf, outbuf_len, "%s", json->buf);
	if (json->len <= outbuf_len) {
		*need = outbuf_len;
		memcpy(outbuf, json->buf, json->len);
		outbuf[json->len] = 0;
		ret = 1;
	} else {
		*need = json->len;
		ret = 0;
	}
	maple_string_dispose(json);
	return ret;
}

#endif
