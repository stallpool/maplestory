#include <stdio.h>
#include <string.h>
#include "maple-wz.h"

int main (int argc, const char ** argv) {
    const char ** cur = argv;
    const char * wzpath, * nodepath, * filepath;
    wz_ctx_t * wz;
    char buf[4096], *bufcur = buf;
    int need = sizeof(buf);
    buf[0] = 0;
    cur ++;
    if (argc < 3 || strcmp("-h", *cur) == 0) {
        printf(
            "MapleStory wz file viewer\n"
            "Usage: maple-wz-cmd [-h] wzpath nodepath [dump_filepath]"
        );
        return 1;
    }
    if (argc > 3) {
        filepath = cur[2];
    } else {
        filepath = NULL;
    }
    wzpath = cur[0];
    nodepath = cur[1];

    wz = maple_open_file(wzpath);
    if (!wz) {
        printf("failed to open wz file.");
        return -1;
    }
    maple_json_node(wz, nodepath, buf, 4096, &need);
    if (need > sizeof(buf)) {
        bufcur = (char *)malloc(need);
        maple_json_node(wz, nodepath, bufcur, need, &need);
    }
    maple_close_file(wz);
    printf("%s\n", bufcur);
    if (need > sizeof(buf)) {
        free(bufcur);
    }
}
