# MapleStory World Server

### How to use

```
# cp *.wz local/resources
TINY_DEBUG=1 TINY_STATIC_DIR=../client MAPLESTORY_RES_DIR=./local/resources node index.js
# open ../client/browser.html to explore items in wz files
```

```
# in web client/browser:
fetch('http://127.0.0.1:8080/wz/res/Base.wz')
fetch('http://127.0.0.1:8080/wz/res/Item.wz/Pet')
```

### How to get dependencies

```
git submodule update --init
```

### Known Issues

- Segmentation Fault:
   - Partial List:
      - v062
         - `List.wz` (confirm it is not a common wz file; no header)
