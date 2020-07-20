# MapleStory World Server

### How to use

```
# cp *.wz local/resources
./local/maple-server -b local/resources
# open ../client/browser.html to explore items in wz files
```

```
# in web client:
ws = new WebSocket('ws://127.0.0.1:12020');
ws.onmessage = function (m) {console.log(m.data);}
// get metadata in json
ws.send('R/Base.wz/zmap.img');
// get binary, return Blob[1Byte = 'B', 4Bytes = length in little endian, ...(bytes)]
ws.send('B/Character.wz/Weapon/01492035.img/info/icon');
```

### How to build

```
git submodule update --init
bash build_deps.sh
bash build.sh
```

### Known Issues

- Segmentation Fault:
   - Partial List: v062 `/String.wz/Consume.img` `/String.wz/Item.img/Etc` `/Quest.wz/Say.img` `/List.wz` `/Item.wz/Consume/0202.img`
