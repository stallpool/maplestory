function MapleResource() {
   this.R = {};
}

var baseApi = '/wz/res';

function ajax(url) {
   return new Promise(function (r, e) {
      var xhr = new XMLHttpRequest(), payload = null;
      xhr.open('GET', url, true);
      xhr.addEventListener('readystatechange', function (evt) {
         if (evt.target.readyState === 4 /*XMLHttpRequest.DONE*/) {
            if (~~(evt.target.status / 100) === 2) {
               return r(evt.target.response);
            } else {
               return e(evt.target.status);
            }
         }
      });
      xhr.send();
   });
}

function a2u8(str) {
   var arr = [];
   for (var i = 0, j = str.length; i < j; ++i) {
      arr.push(str.charCodeAt(i));
   }
   var u8 = new Uint8Array(arr);
   return u8;
}

MapleResource.prototype = {
   Get: function (path) {
      if (this.R[path]) {
         return Promise.resolve(this.R[path]);
      }
      var that = this;
      return new Promise(function (r, e) {
         ajax(baseApi + path).then(function (plain) {
            var json = JSON.parse(plain);
            if (json.type === 'image' || json.type === 'audio') {
               json.u8 = a2u8(atob(json.data));
               delete json.data;
            }
            that.R[path] = json;
            r(json);
         }, e);
      });
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
               if (obj._inlink) {
                  // e.g. walk1/2/arm _inlink = walk1/0/arm
                  var linkParts = obj._inlink.split('/');
                  var pathParts = path.split('/');
                  for (var i = linkParts.length - 1, j = pathParts.length - 1; i >= 0 && j >= 0; i--) {
                     pathParts[j] = linkParts[i];
                     j --;
                  }
                  that.getTreeNode(parent, errors, pathParts.join('/')).then(function (node) {
                     if (parent) {
                        var name = path.split('/').pop();
                        parent[name] = obj;
                     }
                     resolve(node);
                  });
                  return;
               }
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
