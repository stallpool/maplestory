var _MapleCharacterCanvas = document.createElement('canvas');
var _MapleCharacterPen = _MapleCharacterCanvas.getContext('2d');

function MapleSprite(u8, w, h) {
   this.SetU8(u8, w, h);
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

function MapleCharacter(parts) {
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

MapleCharacter.prototype = {
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