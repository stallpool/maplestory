var _MapleAudioContext = new AudioContext();

function MapleSound (href) {
    this.href = href;
    this.dom = document.createElement('audio');
    this.dom.hidden = true;
    this.blobUrl = null;
    var that = this;
    MapleResourceManager.Get(href, 'audio').then(function (obj) {
        console.log(obj);
        // XXX: use old style; but it will going away in modern browser
        that.blobUrl = URL.createObjectURL(new Blob([obj.u8]));
    }, function () {
        that.blobUrl = null;
    });
}

MapleSound.prototype = {
    PlayOnce: function () {
        if (!this.blobUrl) return;
        this.dom.src = this.blobUrl;
        this.dom.loop = false;
        if (!this.dom.parentNode) {
            document.body.appendChild(this.dom);
        }
        this.dom.play();
    },
    Play: function () {
        if (!this.blobUrl) return;
        this.dom.src = this.blobUrl;
        this.dom.loop = false;
        if (!this.dom.parentNode) {
            document.body.appendChild(this.dom);
        }
        this.dom.play();
    },
    Stop: function () {
        this.dom.pause();
        this.dom.currentTime = 0;
        if (this.dom.parentNode) {
            this.dom.parentNode.removeChild(this.dom);
        }
    },
};