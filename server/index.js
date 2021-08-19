// version 1.0.1

const i_fs = require('fs');
const i_path = require('path');
const i_url = require('url');

const i_env = {
   debug: !!process.env.TINY_DEBUG,
   server: {
      host: process.env.TINY_HOST || '127.0.0.1',
      port: parseInt(process.env.TINY_PORT || '8080'),
      staticDir: process.env.TINY_STATIC_DIR?i_path.resolve(process.env.TINY_STATIC_DIR):null,
      httpsCADir: process.env.TINY_HTTPS_CA_DIR?i_path.resolve(process.env.TINY_HTTPS_CA_DIR):null,
   },
};

const Mime = {
   '.html': 'text/html',
   '.css': 'text/css',
   '.js': 'text/javascript',
   '.svg': 'image/svg+xml',
   '.json': 'application/json',
   '.png': 'image/png',
   '.ico': 'image/x-icon',
   '.jpg': 'image/jpge',
   _default: 'text/plain',
   _binary: 'application/octet-stream',
   lookup: (filename) => {
      let ext = i_path.extname(filename);
      if (!ext) return Mime._default;
      let content_type = Mime[ext];
      if (!content_type) content_type = Mime._default;
      return content_type;
   }
};

const Cache = {
   maxSize: 128 * 1024 * 1024, /* 128 MB */
   size: 0,
   pool: null
};

function basicRoute (req, res, router) {
   const r = i_url.parse(req.url);
   const originPath = r.pathname.split('/');
   const path = originPath.slice();
   const query = {};
   let f = router;
   if (r.query) r.query.split('&').forEach((one) => {
      let key, val;
      let i = one.indexOf('=');
      if (i < 0) {
         key = one;
         val = '';
      } else {
         key = one.substring(0, i);
         val = one.substring(i+1);
      }
      if (key in query) {
         if(Array.isArray(query[key])) {
            query[key].push(val);
         } else {
            query[key] = [query[key], val];
         }
      } else {
         query[key] = val;
      }
   });
   path.shift();
   while (path.length > 0) {
      let key = path.shift();
      f = f[key];
      if (!f) break;
      if (typeof(f) === 'function') {
         return f(req, res, {
            path: path,
            query: query
         });
      }
   }
   if (i_env.server.staticDir) {
      let r = serveStatic(res, i_env.server.staticDir, originPath);
      if (r) return r;
   }
   return serveCode(req, res, 404, 'Not Found');
}

function serveCode(req, res, code, text) {
   res.writeHead(code || 500, text || '');
   res.end();
}

function serveStatic (res, base, path) {
   if (!i_env.debug) return false;
   if (path.indexOf('..') >= 0) return false;
   path = path.slice(1);
   if (!path.join('')) path = ['index.html'];
   if (!Cache.pool) Cache.pool = {};
   let filename = i_path.join(base, ...path);
   let mimetype = Mime.lookup(filename);
   if (mimetype !== Mime._default) {
      res.setHeader('Content-Type', mimetype);
   }
   let buf = Cache.pool[filename], state;
   if (buf) {
      if (!i_fs.existsSync(filename)) {
         delete buf[filename];
         return false;
      }
      state = i_fs.statSync(filename);
      if (buf.mtime === state.mtimeMs) {
         buf = buf.raw;
      } else {
         buf.mtime = state.mtimeMs;
         buf.raw = i_fs.readFileSync(filename);
         buf = buf.raw;
      }
   } else {
      if (!i_fs.existsSync(filename)) {
         return false;
      }
      buf = i_fs.readFileSync(filename);
      state = i_fs.statSync(filename);
      if (!state.isFile()) return false;
      Cache.pool[filename] = {
         mtime: state.mtimeMs,
         raw: buf
      };
      Cache.size += buf.length + filename.length;
      while (Cache.size > Cache.maxSize) {
         let keys = Object.keys(Cache.pool);
         let key = keys[~~(Math.random() * keys.length)];
         let val = Cache.pool[key];
         if (!key || !val) return false; // should not be
         delete Cache.pool[key];
         Cache.size -= val.raw.length + key.length;
      }
   }
   res.write(buf);
   res.end();
   return true;
}

function createServer(router) {
   let server = null;
   router = Object.assign({}, router);
   if (i_env.server.httpsCADir) {
      const i_https = require('https');
      const https_config = {
         // openssl req -newkey rsa:2048 -new -nodes -x509 -days 365 -keyout ca.key -out ca.crt
         key: i_fs.readFileSync(i_path.join(i_env.server.httpsCADir, 'ca.key')),
         cert: i_fs.readFileSync(i_path.join(i_env.server.httpsCADir, 'ca.crt')),
      };
      server = i_https.createServer(https_config, (req, res) => {
         basicRoute(req, res, router);
      });
   } else {
      const i_http = require('http');
      server = i_http.createServer((req, res) => {
         basicRoute(req, res, router);
      });
   }
   return server;
}

const i_wz_api = require('./wz');
const server = createServer({
   test: (_req, res, options) => {
      res.end(JSON.stringify({
         text: 'hello world',
         path: `/${options.path.join('/')}`
      }));
   },
   wz: i_wz_api.api,
});
server.listen(i_env.server.port, i_env.server.host, () => {
   console.log(`MapleStory SERVER is listening at ${i_env.server.host}:${i_env.server.port}`);
});
