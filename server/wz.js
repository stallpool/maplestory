const i_path = require('path');
const i_fs = require('fs');
const i_wz = require('./lib/wz');

const RES_DIR = i_path.resolve(process.env.MAPLESTORY_RES_DIR || '.');

function serveCode(req, res, code, text) {
   res.writeHead(code || 500, text || '');
   res.end();
}

const api = {
   res: async (req, res, opt) => {
      const parts = opt.path;
      if (!parts.length) return serveCode(req, res, 404);
      if (parts.indexOf('..') >= 0) return serveCode(req, res, 400);
      const name = parts.shift();
      const path = `/${parts.join('/')}`;
      console.log(`[get] ${name} ${path}`);
      const res_p = i_path.join(RES_DIR, name);
      if (!i_fs.existsSync(res_p)) return serveCode(req, res, 404);
      let resF;
      try {
         resF = new i_wz.WzFile(res_p);
         await resF.init();
         const node = await resF.get(path);
         if (!node) return serveCode(req, res, 404);
         try { await resF._close(); } catch(err) {}
         let obj;
         res.setHeader('Content-Type', 'application/json');
         switch(node.type) {
         case 'nil':
            res.end('{"type":"nil"}'); break;
         case 'link':
            // TODO: redirect to real object
            res.end('{"type":"link"}'); break;
         case 'image':
            obj = Object.assign({ type: 'image' }, node.val);
            obj.data = obj.data.toString('base64');
            obj.items = node.children?node.children.map((x) => x.name):[];
            res.end(JSON.stringify(obj)); break;
         case 'audio':
            obj = Object.assign({ type: 'audio' }, node.val);
            obj.data = obj.data.toString('base64');
            res.end(JSON.stringify(obj)); break;
         case 'convex':
            obj = Object.assign({ type: 'convex' }, node.val);
            res.end(JSON.stringify(obj)); break;
         case 'vector':
            obj = Object.assign({ type: 'vector' }, node.val);
            res.end(JSON.stringify(obj)); break;
         case 'array':
         case 'obj':
         case null:
            obj = { type: node.type || 'root' };
            obj.items = node.children?node.children.map((x) => x.name):[];
            res.end(JSON.stringify(obj)); break;
         case 'uol':
            obj = { type: node.type, ref: node.val };
            res.end(JSON.stringify(obj)); break;
         case 'i16':
         case 'i32':
         case 'i64':
         case 'f32':
         case 'f64':
         case 'str':
            obj = { type: node.type, data: node.val };
            res.end(JSON.stringify(obj)); break;
         default:
            return serveCode(req, res, 404);
         }
      } catch(err) {
         try { if (resF) await resF._close(); } catch(err) {}
         console.error('[E:api.res]', err);
         return serveCode(req, res, 500);
      }
   },
};

module.exports = { api };
