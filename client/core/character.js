var _MapleCharacterCanvas = document.createElement('canvas');
var _MapleCharacterPen = _MapleCharacterCanvas.getContext('2d');

function MapleSprite(u8, w, h) {
   if (u8) {
      this.SetU8(u8, w, h);
   }
}

MapleSprite.prototype = {
   SetU8: function (u8, w, h) {
      this.w = w;
      this.h = h;
      var image = _MapleCharacterPen.createImageData(w, h);
      for (var i = 0, n = u8.length; i < n; i++) {
         image.data[i] = u8[i];
      }
      this.SetImage(image);
   },
   SetImage: function (image) {
      this.image = image;
      if (!this.paper) {
         this.paper = document.createElement('canvas');
         this.pen = this.paper.getContext('2d');
      }
      this.paper.width = this.w;
      this.paper.height = this.h;
      this.paper.style.width = this.w + 'px';
      this.paper.style.height = this.h + 'px';
      this.Reset();
   },
   Reset: function () {
      this.pen.clearRect(0, 0, this.w, this.h);
      this.pen.putImageData(this.image, 0, 0);
   },
   Image: function () {
      return this.image;
   },
   ImageURLBlob: function () {
      return this.paper.toDataURL();
   }
};

function MapleAnimation(constants, frameFn) {
   this.frameFn = frameFn;
   this.env = {
      constants: constants,
      timer: 0,
      sprite: null,
      index: 0,
      delay: 100
   };
}

MapleAnimation.prototype = {
   Next: function () {
      this.frameFn(this.env);
   },
   Sprite: function () {
      return this.env.sprite;
   },
   Start: function () {
      next(this);

      function next(that) {
         that.env.timer = 0;
         that.Next();
         that.env.timer = setTimeout(next, that.env.delay || 100, that);
      }
   },
   Stop: function () {
      if (this.env.timer) clearTimeout(this.env.timer);
   }
};

function MapleCharacter(base) {
   // base = e.g. 2002.img
   // - body = 00002002.img, head = 00012002.img
   this.base = base;
   this.assembled = false;
   this.data = { body: {}, head: {} };
   this.sprite = new MapleSprite();
   this.mirrorX = false;
   this.animate = null;
   this.constants = {
      body: ['walk1', 'stand1', 'prone', 'jump', 'sit', 'ladder', 'rope', 'proneStab', 'alert'],
      head: ['front', 'back'],
      back_body: ['rope', 'ladder'],
      z: { body: 0, armOverHair: 4, handOverHair: 6, head: 8, face: 12, arm: 15, handBelowWeapon: 20, backHead: 50 }
   };
}

MapleCharacter.prototype = {
   Assemble: function () {
      if (this.assembled) return Promise.resolve();
      var that = this;
      return new Promise(function (resolve) {
         that.constants.body.forEach(function (type) {
            MapleResourceManager.GetTree('/Character.wz/0000' + that.base + '.img/' + type).then(function (data) {
               that.data.body[type] = data.tree;
               assemble();
            });
         });
         that.constants.head.forEach(function (type) {
            MapleResourceManager.GetTree('/Character.wz/0001' + that.base + '.img/' + type + '/head').then(function (data) {
               that.data.head[type] = data.tree;
               assemble();
            });
         });
   
         function assemble() {
            for (var i = 0, n = that.constants.body.length; i < n; i++) {
               if (!that.data.body[that.constants.body[i]]) return;
            }
            for (var i = 0, n = that.constants.head.length; i < n; i++) {
               if (!that.data.head[that.constants.head[i]]) return;
            }
            console.log('done');
            that.assembled = true;
            resolve();
         }
      });
   },
   _positionMatch: function (p1p, p1, p2) {
      var p2p = {};
      if (p1p && p1) {
         var mp1 = {}, mp2 = {};
         Object.keys(p1.map).forEach(function (x) { mp1[x] = 1; });
         Object.keys(p2.map).forEach(function (x) { if (mp1[x]) mp2[x] = 1; });
         var match = Object.keys(mp2)[0];
         if (!match) return null;
         p2p.x = p1p.x + p1.origin[0] + p1.map[match][0] - p2.origin[0] - p2.map[match][0];
         p2p.y = p1p.y + p1.origin[1] + p1.map[match][1] - p2.origin[1] - p2.map[match][1];
      } else {
         p2p.x = 0;
         p2p.y = 0;
      }
      p2p.w = p2.$data.width;
      p2p.h = p2.$data.height;
      p2p.z = this.constants.z[p2.z] || 0;
      return p2p;
   },
   _rect: function (type, index) {
      if (!this.assembled) return null;
      var head = this.data.head.front;
      if (this.constants.back_body.includes(type)) {
         head = this.data.head.back;
      }
      var body = this.data.body[type][index];
      var position = {};
      position.head = this._positionMatch(null, null, head);
      position.body = this._positionMatch(position.head, head, body.body);
      if (body.arm) position.arm = this._positionMatch(position.body, body.body, body.arm);
      for (var part in position) {
         if (position[part].x < 0) {
            Object.keys(position).forEach(function (part) {
               var p = position[part];
               p.x -= position[part].x;
            });
         }
         if (position[part].y < 0) {
            Object.keys(position).forEach(function (part) {
               var p = position[part];
               p.y -= position[part].y;
            });
         }
      }
      var max_w = 0, max_h = 0;
      Object.keys(position).forEach(function (part) {
         var p = position[part];
         if (p.x + p.w > max_w) max_w = p.x + p.w;
         if (p.y + p.h > max_h) max_h = p.y + p.h;
      });
      var objs = [];
      objs.push({ u8: body.body.$u8, rect: position.body });
      objs.push({ u8: head.$u8, rect: position.head });
      if (body.arm) objs.push({ u8: body.arm.$u8, rect: position.arm });
      if (objs.length) objs.sort(function (a, b) { return a.rect.z - b.rect.z; });
      return { w: max_w, h: max_h, objs: objs};
   },
   Paint: function (type, index) {
      if (!this.assembled) return null;
      var that = this;
      var vis = this._rect(type, index);
      if (!this.paper) {
         this.paper = document.createElement('canvas');
         this.pen = this.paper.getContext('2d');
      }
      this.paper.width = vis.w;
      this.paper.height = vis.h;
      this.paper.style.width = vis.w + 'px';
      this.paper.style.height = vis.h + 'px';
      if (this.mirrorX) {
         this.pen.save();
         this.pen.scale(-1, 1);
         this.pen.translate(-vis.w, 0);
      }
      vis.objs.forEach(function (obj) {
         var sprite = new MapleSprite(obj.u8, obj.rect.w, obj.rect.h);
         that.pen.drawImage(sprite.paper, obj.rect.x, obj.rect.y);
      });
      if (this.mirrorX) {
         this.pen.restore();
      }
      this.image = this.pen.getImageData(0, 0, vis.w, vis.h);
      this.w = vis.w;
      this.h = vis.h;
   },
   GetBody: function (type, index) {
      if (!this.assembled) return null;
      var body = this.data.body[type][index];
      return body;
   },
   Animate: function (type, postFn) {
      if (this.animate) this.animate.Stop();
      this.animate = new MapleAnimation({
         char: this,
         frameIndex: Object.keys(this.data.body[type]),
         action: type,
      }, function (env) {
         var body = env.constants.char.GetBody(type, env.constants.frameIndex[env.index]);
         env.delay = body.delay;
         env.constants.char.Paint(type, env.constants.frameIndex[env.index]);
         if (postFn) postFn(env.constants.char);
         env.index = (env.index + 1) % env.constants.frameIndex.length;
      });
      this.animate.Start();
   },
   Image: function () {
      return this.image;
   },
   ImageURLBlob: function () {
      return this.paper.toDataURL();
   }
};

function MapleCharacterSimple(parts) {
   // XXX: should read from metadata instead of manual assign in _: {...}
   /*this.parts = {
      head: 'core/headsuite/front/head',
      body: 'core/stand1/0/body',
      arm: 'core/stand1/0/arm',
      _: {
         head: {x: 0, y: 0, z:1},
         body: {x: 5, y: 34, z:0},
         arm: {x: 21, y: 35, z:10}
      }
   };*/
   this.parts = parts;
}

MapleCharacterSimple.prototype = {
   _Rect: function () {
      if (!this.assembled) return;
      var w = 0, h = 0;
      for (var key in this.assembled) {
         var obj = this.assembled[key];
         if (obj.x + obj.data.width > w) w = obj.x + obj.data.width;
         if (obj.y + obj.data.height > h) h = obj.y + obj.data.height;
      }
      this.w = w;
      this.h = h;
   },
   Assemble: function () {
      if (this.assembled) return Promise.resolve();
      var assembled = {};
      var that = this;
      return new Promise(function (resolve, reject) {
         MapleResourceManager.Get(that.parts.head, 'image').then(function (obj) {
            assembled.head = obj;
            obj.x = that.parts._.head.x;
            obj.y = that.parts._.head.y;
            obj.z = that.parts._.head.z;
            return MapleResourceManager.Get(that.parts.body, 'image');
         }, reject).then(function (obj) {
            assembled.body = obj;
            obj.x = that.parts._.body.x;
            obj.y = that.parts._.body.y;
            obj.z = that.parts._.body.z;
            return MapleResourceManager.Get(that.parts.arm, 'image');
         }, reject).then(function (obj) {
            assembled.arm = obj;
            obj.x = that.parts._.arm.x;
            obj.y = that.parts._.arm.y;
            obj.z = that.parts._.arm.z;
            that.assembled = assembled;
            that._Draw();
            resolve();
         }, reject);
      });
   },
   Reset: function () {
      if (!this.assembled) return;
      this.pen.clearRect(0, 0, this.w, this.h);
      this.pen.putImageData(this.image, 0, 0);
   },
   _Draw: function () {
      if (!this.assembled) return null;
      if (this.image) return this.image;
      var that = this;
      this._Rect();
      var list = Object.keys(this.assembled).map(function (name) {
         return that.assembled[name];
      }).sort(function (a, b) {
         return a.z - b.z;
      });
      if (!this.paper) {
         this.paper = document.createElement('canvas');
         this.pen = this.paper.getContext('2d');
      }
      this.paper.width = this.w;
      this.paper.height = this.h;
      this.paper.style.width = this.w + 'px';
      this.paper.style.height = this.h + 'px';
      list.forEach(function (obj) {
         var sprite = new MapleSprite(obj.u8, obj.data.width, obj.data.height);
         that.pen.drawImage(sprite.paper, obj.x, obj.y);
      });
      this.image = this.pen.getImageData(0, 0, this.w, this.h);
   },
   Image: function () {
      return this.image;
   },
   ImageURLBlob: function () {
      return this.paper.toDataURL();
   }
};