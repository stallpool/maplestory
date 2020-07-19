# MapleStory World Server

### How to use

```
# cp *.wz local/resources
./local/maple-server -b local/resources
```

```
# in web client:
ws = new WebSocket('ws://127.0.0.1:12020');
ws.onmessage = function (m) {console.log(m.data);}
ws.send('R/Base.wz/zmap.img');
```

### How to build

```
git submodule update --init
bash build_deps.sh
bash build.sh
```
