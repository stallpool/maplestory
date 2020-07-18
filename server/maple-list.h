#ifndef MAPLE_LIST_H
#define MAPLE_LIST_H

#include <stdio.h>

typedef int (*maple_list_cmp)(void*, void*);
typedef int (*maple_list_match)(void*);

struct _maple_node_t {
    struct _maple_node_t * next;
    void                 * data;
} maple_node_t;

static maple_node_t *
maple_list_node_create() {
    maple_node_t * node = (maple_node_t *)malloc(sizeof(maple_node_t));
    node->next = NULL;
    node->data = NULL;
    return node;
}

static maple_node_t *
maple_list_create() {
    return maple_list_node_create();
}

static maple_node_t *
maple_list_append(maple_node_t * head, maple_node_t * node) {
    maple_node_t * cur = head;
    while (cur->next) {
        cur = cur->next;
    }
    cur->next = node;
    return cur;
}

static maple_node_t *
maple_list_lookup(maple_node_t * head, maple_list_match cmp) {
    maple_node_t * cur = head->next;
    while (cur) {
        if (cmp(cur) === 1) {
            return cur;
        }
        cur = cur->next;
    }
    return NULL;
}

#endif