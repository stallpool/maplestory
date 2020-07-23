var _MapleWebsocket = null;

function MapleResource() {
   this.U8cache = {};
   this.R = {};
}

var _MapleResourceURL = 'ws://127.0.0.1:12020';
var _MapleResourceTimeout = 5000;
var _MapleResourceWebsocket = {
   pool: [],
   queue: [/* { path, timeout, resolve, reject } */],
   init: function () {
      _MapleResourceWebsocket.newConnection();
   },
   newConnection: function () {
      var connection = {
         ws: new WebSocket(_MapleResourceURL),
         busy: true,
         timeout: false,
         dead: false,
         task: {}
      };
      connection.ws.addEventListener('message', function (e) {
         if (connection.dead || connection.timeout) return;
         if (connection.timer) clearTimeout(connection.timer);
         if (connection.task && connection.task.resolve) {
            connection.task.resolve(e);
         }
         connection.data = {};
         connection.busy = false;
         _MapleResourceWebsocket.pool.push(connection);
         _MapleResourceWebsocket.execute();
      });
      connection.ws.addEventListener('error', function (e) {
         if (connection.timer) clearTimeout(conneciton.timer);
         connection.dead = true;
         connection.error = e;
         // XXX: if error trigger close, remove below line
         if (connection.task.reject) connection.task.reject('closed');
      });
      connection.ws.addEventListener('close', function (e) {
         if (connection.timer) clearTimeout(connection.timer);
         connection.dead = true;
         if (connection.task.reject) connection.task.reject('closed');
      });
      connection.ws.addEventListener('open', function (e) {
         connection.busy = false;
         _MapleResourceWebsocket.pool.push(connection);
         _MapleResourceWebsocket.execute();
      });
      return connection;
   },
   run: function (task) {
      _MapleResourceWebsocket.queue.push(task);
      _MapleResourceWebsocket.execute();
   },
   execute: function () {
      if (!_MapleResourceWebsocket.queue.length) return;
      var connection = _MapleResourceWebsocket.pool.pop();
      // if connection is being used, after it returns,
      // it will check queue and start next task
      if (!connection) return;
      var task = _MapleResourceWebsocket.queue.shift();
      // TODO: if connection is closed, reconnect several times
      //       if still fails, reject
      connection.busy = true;
      connection.timeout = false;
      if (task.timeout) {
         connection.timer = setTimeout(function () {
            // if timeout, close and open a new client
            connection.timeout = true;
            if (connection.ws.readyState <= WebSocket.OPEN) {
               connection.ws.close();
            }
            _MapleResourceWebsocket.newConnection();
            if (task.reject) task.reject('timeout');
         }, task.timeout);
      }
      connection.ws.send(task.path);
      connection.task = task;
   }
};
_MapleResourceWebsocket.init();

var _MapleResourceUtil = {
   fetchMetadata: function (R, U8cache, path) {
      path = 'R' + path;
      return new Promise(function (resolve, reject) {
         _MapleResourceWebsocket.run({
            path: path,
            timeout: _MapleResourceTimeout,
            resolve: function (m) {
               try {
                  var json = JSON.parse(m.data);
                  if (json.type === 'image' || json.type === 'audio') {
                     if (!json.data.sha) {
                        reject('no sha');
                        return;
                     }
                     var u8 = U8cache[json.data.sha];
                     if (u8) {
                        json.u8 = u8;
                        resolve(json);
                        return;
                     }
                     _MapleResourceUtil.fetchBinary(path.substring(1)).then(function (u8) {
                        U8cache[json.data.sha] = u8;
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
                  console.log(m.data.length, m.data);
                  reject(e);
               }
            },
            reject: reject
         });
      });
   },
   fetchBinary: function (path) {
      path = 'B' + path;
      return new Promise(function (resolve, reject) {
         _MapleResourceWebsocket.run({
            path: path,
            timeout: _MapleResourceTimeout,
            resolve: function (m) {
               try {
                  m.data.arrayBuffer().then(function (buf) {
                     // TODO: check buf = [1B = 'B', 4B = length, ...]
                     resolve(new Uint8Array(buf).slice(5));
                  });
               } catch(e) {
                  reject(e);
               }
            },
            reject: reject
         });
      });
   }
};

MapleResource.prototype = {
   Get: function (path) {
      if (this.R[path]) {
         return Promise.resolve(this.R[path]);
      }
      return _MapleResourceUtil.fetchMetadata(this.R, this.U8cache, path);
   },
   GetTree: function (path) {
      // be careful to use this function
      // for it may cause out of memory if the tree is huge
      // obj = { type: undfined/image/audio, children }
      var that = this;
      var errors = [];
      return new Promise(function (resolve) {
         that.getTreeNode(null, errors, path).then(function (node) {
            resolve({ tree: node, errors: errors });
         });
      });
   },
   getTreeNode: function (parent, errors, path) {
      var that = this;
      return new Promise(function (resolve) {
         var obj = {};
         that.Get(path).then(function (node) {
            var queue;
            switch (node.type) {
               case 'image':
                  queue = node.nested.data.map(function (x) {
                     return path + '/' + x;
                  });
                  obj.$data = node.data;
                  obj.$u8 = node.u8;
                  obj.$type = 'image';
                  break;
               case 'array':
                  queue = node.data.map(function (x) {
                     return path + '/' + x;
                  });
                  break;
               case 'audio':
                  queue = [];
                  obj.$data = node.data;
                  obj.$u8 = node.u8;
                  obj.$type = 'audio';
                  break;
               default:
                  queue = [];
                  obj = node.data;
            }
            that.getTreeChildren(obj, errors, queue, function () {
               if (parent) {
                  var name = path.split('/').pop();
                  parent[name] = obj;
               }
               resolve(obj);
            });
         }, function () {
            errors.push({ path: path });
            resolve(null);
         });
      });
   },
   getTreeChildren: function (parent, errors, queue, resolveFn) {
      var that = this;
      if (!queue.length) {
         return resolveFn();
      }
      var path = queue.shift();
      that.getTreeNode(parent, errors, path).then(function (node) {
         var name = path.split('/').pop();
         parent[name] = node;
         that.getTreeChildren(parent, errors, queue, resolveFn);
      });
   }
};

window.MapleResourceManager = new MapleResource();