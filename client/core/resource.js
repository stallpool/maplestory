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
   GetTree: function (path, treenode) {
      // be careful to use this function
      // for it may cause out of memory if the tree is huge
      // obj = { type: undfined/image/audio, children }
      var that = this;
      var errors = [];
      treenode = treenode || {};
      return new Promise(function (r, e) {
         that.Get(path).then(function (node) {
            switch(node.type) {
            case 'image': case 'audio': case 'root':
            case 'array': case 'obj':
               if (node.type === 'image') {
                  treenode.$data = Object.assign({}, node);
                  treenode.$type = node.type;
               } else if (node.type === 'audio') {
                  treenode.$type = node.type;
               }
               if (treenode.$data) {
                  delete treenode.$data.items;
                  delete treenode.$data.type;
               }
               getChild(path, node.items.slice(), treenode, r, e);
               break;
            case 'uol':
               {
                  var linkParts = node.ref.split('/');
                  var pathParts = path.split('/');
                  pathParts.pop();
                  for (var i = 0, n = linkParts.length; i < n; i++) {
                     var one = linkParts[i];
                     if (one === '..') {
                        pathParts.pop();
                     } else if (one === '.') {
                     } else {
                        pathParts.push(one);
                     }
                  }
                  var newpath = pathParts.join('/');
                  // for (let key in treenode) delete treenode[key];
                  that.GetTree(newpath, treenode).then(r, e);
               }
               break;
            default:
               treenode = Object.assign(treenode, node);
               delete treenode.type;
               r(treenode);
            }
         }, e);

         function getChild(base, items, treenode, r, e) {
            if (!items.length) {
               r(treenode);
               return;
            }
            var name = items.shift();
            that.GetTree(base + '/' + name).then(function (child_treenode) {
               treenode[name] = child_treenode;
               getChild(base, items, treenode, r, e);
            }, e);
         }
      });
   },
};

window.MapleResourceManager = new MapleResource();
