var _MapleWebsocket = null;

function MapleResource() {
   this.R = {};
}

var _MapleResourceURL = 'ws://127.0.0.1:12020';
var _MapleResourceTimeout = 5000;

var _MapleResourceUtil = {
   fetchMetadata: function (R, path) {
      path = 'R' + path;
      return new Promise(function (resolve, reject) {
         var ws = new WebSocket(_MapleResourceURL);
         var error = null;
         setTimeout(function () {
            error = 'timeout';
            reject(error);
            if (ws.readyState <= WebSocket.OPEN) ws.close();
         }, _MapleResourceTimeout);
         ws.addEventListener('error', function (e) {
            error = e;
            reject(error);
         });
         ws.addEventListener('message', function (m) {
            if (error) return;
            try {
               var json = JSON.parse(m.data);
               if (json.type === 'image' || json.type === 'audio') {
                  _MapleResourceUtil.fetchBinary(R, path.substring(1)).then(function (u8) {
                     json.u8 = u8;
                     R[path] = json;
                     resolve(json);
                  }, function () {
                     // R[path] = json;
                     resolve(json);
                  });
               } else {
                  R[path] = json;
                  resolve(json);
               }
            } catch(e) {
               console.log(m.data, m.data.length);
               reject(e);
            }
            if (ws.readyState <= WebSocket.OPEN) ws.close();
         });
         ws.addEventListener('close', function () {});
         ws.addEventListener('open', function () {
            ws.send(path);
         });
      });
   },
   fetchBinary: function (R, path) {
      path = 'B' + path;
      return new Promise(function (resolve, reject) {
         var ws = new WebSocket(_MapleResourceURL);
         var error = null;
         setTimeout(function () {
            error = 'timeout';
            reject(error);
            if (ws.readyState <= WebSocket.OPEN) ws.close();
         }, _MapleResourceTimeout);
         ws.addEventListener('error', function (e) {
            error = e;
            reject(e);
         });
         ws.addEventListener('message', function (m) {
            if (error) return;
            try {
               m.data.arrayBuffer().then(function (buf) {
                  // TODO: check buf = [1B = 'B', 4B = length, ...]
                  resolve(new Uint8Array(buf).slice(5));
               });
            } catch(e) {
               reject(e);
            }
            if (ws.readyState === WebSocket.OPEN) ws.close();
         });
         ws.addEventListener('close', function () {});
         ws.addEventListener('open', function () {
            ws.send(path);
         });
      });
   }
};

MapleResource.prototype = {
   Get: function (path, type) {
      if (this.R[path]) {
         return Promise.resolve(this.R[path]);
      }
      return _MapleResourceUtil.fetchMetadata(this.R, path);
   }
};

window.MapleResourceManager = new MapleResource();