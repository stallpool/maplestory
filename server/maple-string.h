#ifndef MAPLE_STRING_H
#define MAPLE_STRING_H

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
    unsigned int cap, len;
    char       * buf;
} maple_string;

#define MAPLE_STRING_INIT_N 512
#define MAPLE_STRING_MAX_N  1 * 1024 * 1024

static maple_string *
maple_string_alloc() {
    unsigned int cap = MAPLE_STRING_INIT_N;
    maple_string * s = (maple_string *)malloc(sizeof(maple_string *));
    s->cap = cap;
    s->len = 0;
    s->buf = (char *)malloc(cap);
    *(s->buf) = 0;
    return s;
}

static void
maple_string_dispose(maple_string * s) {
    if (s->buf) {
        free(s->buf);
        s->buf = NULL;
        s->len = 0;
        s->cap = 0;
    }
    if (s) {
        free(s);
    }
}

static int
maple_string_double_cap(maple_string * s) {
    char * buf = NULL;
    if (s->cap * 2 > MAPLE_STRING_MAX_N) {
        return 0;
    }
    buf = (char *)malloc(s->cap * 2);
    if (!buf) {
        return 0;
    }
    strncpy(buf, s->buf, s->len + 1);
    if (s->buf) {
        free(s->buf);
    }
    s->buf = buf;
    s->cap *= 2;
    return 1;
}

static int
maple_string_append_charstar(maple_string * s, const char * d, unsigned int len) {
    while (s->len + len + 1 >= s->cap) {
        if (!maple_string_double_cap(s)) {
            return 0;
        }
    }
    char * cur = (s->buf) + s->len;
    memcpy(cur, d, len);
    cur += len;
    *cur = 0;
    s->len += len;
    return 1;
}

static int
maple_string_append_char(maple_string * s, char d) {
    while (s->len + 2 >= s->cap) {
        if (!maple_string_double_cap(s)) {
            return 0;
        }
    }
    char * cur = (s->buf) + s->len;
    *cur++ = d;
    *cur = 0;
    s->len ++;
    return 1;
}

static int
maple_string_append_string(maple_string * s, maple_string * d) {
    if (!d->buf) {
        return 0;
    }
    return maple_string_append_charstar(s, d->buf, d->len);
}

static int
maple_string_append_uint(maple_string * s, unsigned int d) {
    char buf[20];
    // int len = sprintf_s(buf, 20, "%d", d);
    int len = sprintf(buf, "%d", d);
    return maple_string_append_charstar(s, buf, len);
}

static int
maple_string_append_int(maple_string * s, int d) {
    char buf[20];
    // int len = sprintf_s(buf, 20, "%d", d);
    int len = sprintf(buf, "%d", d);
    return maple_string_append_charstar(s, buf, len);
}

static int
maple_string_append_ulong(maple_string * s, unsigned long d) {
    char buf[20];
    // int len = sprintf_s(buf, 20, "%ld", d);
    int len = sprintf(buf, "%ld", d);
    return maple_string_append_charstar(s, buf, len);
}

static int
maple_string_append_long(maple_string * s, long d) {
    char buf[20];
    // nt len = sprintf_s(buf, 20, "%ld", d);
    int len = sprintf(buf, "%ld", d);
    return maple_string_append_charstar(s, buf, len);
}

static int
maple_string_append_float(maple_string * s, float d) {
    char buf[20];
    // int len = sprintf_s(buf, sizeof(buf), "%f", d);
    int len = sprintf(buf, "%f", d);
    return maple_string_append_charstar(s, buf, len);
}

static int
maple_string_append_double(maple_string * s, double d) {
    char buf[30];
    // int len = sprintf_s(buf, sizeof(buf), "%lf", d);
    int len = sprintf(buf, "%lf", d);
    return maple_string_append_charstar(s, buf, len);
}

#endif
