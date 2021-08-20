const iFs = require('fs');
const iPath = require('path');
const iZlib = require('zlib');

const iAes256Ecb = require('./aes256ecb');

const wz_aes_key = [
  /* These value would be expanded to aes key */
  0x13, 0x08, 0x06, 0xb4, 0x1b, 0x0f, 0x33, 0x52
];

const wz_aes_ivs = [
  /* These values would be expanded to aes ivs */
  0x2bc7234d,
  0xe9637db9 /* used to decode UTF8 (lua script) */
];
const WZ_KEY_ASCII_MAX_LEN = 0x10000;
// enlarge max len to accept long string
const WZ_KEY_UTF8_MAX_LEN = 0x12000;
const WZ_UINT8_MAX = 0xff;
const WZ_UINT16_MAX = 0xffff;
const WZ_INT8_MIN = -128;

const WZ_LV0_NAME = 0;
const WZ_LV1_NAME = 1;
const WZ_LV1_STR = 2;
const WZ_LV1_TYPENAME = 3;
const WZ_LV1_TYPENAME_OR_STR = 4;

const WZ_NIL = 0x00;
const WZ_I16 = 0x01;
const WZ_I32 = 0x02;
const WZ_I64 = 0x03;
const WZ_F32 = 0x04;
const WZ_F64 = 0x05;
const WZ_VEC = 0x06;
const WZ_UNK = 0x07;
const WZ_ARY = 0x08;
const WZ_IMG = 0x09;
const WZ_VEX = 0x0a;
const WZ_AUD = 0x0b;
const WZ_UOL = 0x0c;
const WZ_STR = 0x0d;
const WZ_LEN = 0x0e;
const WZ_TYPE = 0x0f;
const WZ_LEVEL = 0x10;
const WZ_LEAF = 0x20;
const WZ_EMBED = 0x40;

const WZ_COLOR_4444 = 1;
const WZ_COLOR_8888 = 2;
const WZ_COLOR_565 = 513;
const WZ_COLOR_DXT3 = 1026;
const WZ_COLOR_DXT5 = 2050;

const WZ_AUDIO_PCM = 0x0001;
const WZ_AUDIO_MP3 = 0x0055;
const WZ_AUDIO_WAV_SIZE = 18;
const WZ_AUDIO_PCM_SIZE = 44;

const WZ_GUID_WAV = Buffer.from([
   0x81, 0x9f, 0x58, 0x05, 0x56, 0xc3, 0xce, 0x11,
   0xbf, 0x01, 0x00, 0xaa, 0x00, 0x55, 0x59, 0x5a
]);
const WZ_GUID_EMPTY = Buffer.from([
   0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
   0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
]);

const WZ_KEYS = wz_init_ctx();

function objToWzNode(file, obj) {
   const node = new WzNode(file);
   node.name = obj.name;
   node.pos = obj.pos;
   node.type = obj.type;
   node.key = obj.key;
   node.val = obj.val;
   node.children = obj.children;
   node.parent = obj.parent;
   node.root = obj.root;
   node.flags = obj.flags || 0;
   return node;
}

function bufferCompare(ba, bb) {
   if (ba.length !== bb.length) return false;
   for (let i = 0, n = ba.length; i < n; i++) {
      if (ba[i] !== bb[i]) return false;
   }
   return true;
}

function wz_read_wav(out, header) {
   out.format = header.readUint16LE(0);
   out.channels = header.readUint16LE(2);
   out.sample_rate = header.readUint16LE(4);
   out.byte_rate = header.readUint16LE(8);
   out.block_align = header.readUint16LE(12);
   out.bits_per_sample = header.readUint16LE(14);
   out.extra_size = header.readUint16LE(16);
}

const WZ_CP1252_TO_UNICODE = [
  /* 0x80 to 0xff, cp1252 only, code 0xffff means the char is undefined */
  0x20ac, 0xffff, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021,
  0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0xffff, 0x017d, 0xffff,
  0xffff, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
  0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0xffff, 0x017e, 0x0178,
  0x00a0, 0x00a1, 0x00a2, 0x00a3, 0x00a4, 0x00a5, 0x00a6, 0x00a7,
  0x00a8, 0x00a9, 0x00aa, 0x00ab, 0x00ac, 0x00ad, 0x00ae, 0x00af,
  0x00b0, 0x00b1, 0x00b2, 0x00b3, 0x00b4, 0x00b5, 0x00b6, 0x00b7,
  0x00b8, 0x00b9, 0x00ba, 0x00bb, 0x00bc, 0x00bd, 0x00be, 0x00bf,
  0x00c0, 0x00c1, 0x00c2, 0x00c3, 0x00c4, 0x00c5, 0x00c6, 0x00c7,
  0x00c8, 0x00c9, 0x00ca, 0x00cb, 0x00cc, 0x00cd, 0x00ce, 0x00cf,
  0x00d0, 0x00d1, 0x00d2, 0x00d3, 0x00d4, 0x00d5, 0x00d6, 0x00d7,
  0x00d8, 0x00d9, 0x00da, 0x00db, 0x00dc, 0x00dd, 0x00de, 0x00df,
  0x00e0, 0x00e1, 0x00e2, 0x00e3, 0x00e4, 0x00e5, 0x00e6, 0x00e7,
  0x00e8, 0x00e9, 0x00ea, 0x00eb, 0x00ec, 0x00ed, 0x00ee, 0x00ef,
  0x00f0, 0x00f1, 0x00f2, 0x00f3, 0x00f4, 0x00f5, 0x00f6, 0x00f7,
  0x00f8, 0x00f9, 0x00fa, 0x00fb, 0x00fc, 0x00fd, 0x00fe, 0x00ff
];

function wz_cp1252_to_utf8(cp1252) {
   let u8i = 0, u8b = [];
   for (let i = 0, n = cp1252.length; i < n; i++) {
      const code = cp1252[i];
      if (code >= 0x80) {
         code = WZ_CP1252_TO_UNICODE[code - 0x80];
      }
      if (code < 0x80) {
         u8b.push(code);
         u8i ++;
      } else if (code < 0x800) {
         u8b.push(((code >>> 6)  | 0xc0) & 0xff);
         u8b.push(((code & 0x3f) | 0x80) & 0xff);
         u8i += 2;
      } else if (code < 0xffff) {
         u8b.push(((code >>> 12)          | 0xe0) & 0xff);
         u8b.push((((code >>> 6) & 0x3f)  | 0x80) & 0xff);
         u8b.push(((code & 0x3f)          | 0x80) & 0xff);
         u8i += 3;
      } else {
         throw 'fail to encode cp1252 to utf8';
      }
   }
   return Buffer.from(u8b);
}

function wz_utf16le_to_utf8(utf16le) {
   let u8i = 0, u8b = [], remain = utf16le.length, u16i = 0, code;
   while (remain) {
      if (remain < 2) throw 'invalid utf16le';
      if (utf16le[u16i+1] & 0xfc === 0xd8) {
         if (remain < 4) throw 'invalid utf16le';
         if (utf16le[u16i+3] & 0xfc === 0xdc) {
            code = (
               ((utf16le[u16i+1] & 0x03) << 18) |
               (utf16le[u16i+0]          << 10) |
               ((utf16le[u16i+3] & 0x03) <<   8) |
               utf16le[u16i+2]
            );
            remain -=4;
            u16i += 4;
         } else {
            throw 'invalid utf16le';
         }
      } else {
         code = utf16le.readUint16LE(u16i);
         remain -= 2;
         u16i += 2;
      }
      if (code < 0x80) {
         u8b.push(code);
         u8i ++;
      } else if (code < 0x800) {
         u8b.push(((code >>> 6)  | 0xc0) & 0xff);
         u8b.push(((code & 0x3f) | 0x80) & 0xff);
         u8i += 2;
      } else if (code < 0x10000) {
         u8b.push(((code >>> 12)          | 0xe0) & 0xff);
         u8b.push((((code >>> 6) & 0x3f)  | 0x80) & 0xff);
         u8b.push(((code & 0x3f)          | 0x80) & 0xff);
         u8i += 3;
      } else if (code < 0x110000) {
         u8b.push(((code >>> 18)           | 0xf0) & 0xff);
         u8b.push((((code >>> 12) & 0x3f)  | 0x80) & 0xff);
         u8b.push((((code >>>  6) & 0x3f)  | 0x80) & 0xff);
         u8b.push(((code & 0x3f)           | 0x80) & 0xff);
         u8i += 4;
      } else {
         throw 'fail to encode utf16le to utf8';
      }
   }
   return Buffer.from(u8b);
}

function wz_decode_bitmap(block, key_i) {
   const key = WZ_KEYS[key_i];
   const n = block.length;
   let cur = 0;
   let outs = [];
   while (cur < n) {
      const len = block.readUint32LE(cur);
      cur += 4;
      if (len > WZ_KEY_ASCII_MAX_LEN) {
         // throw 'image chunk too large';
         return null;
      }
      const one = Buffer.alloc(len);
      for (let i = 0; i < len; i++) {
         one[i] = (block[cur++] ^ key[i]) & 0xff;
      }
      outs.push(one);
   }
   return Buffer.concat(outs);
}

function wz_inflate_bitmap(block) {
   return iZlib.inflateSync(
      block , { finishFlush: iZlib.Z_SYNC_FLUSH }
   );
}

const wz_u4 = [
  /* unpack 4 bit to 8 bit color: (i << 4) | i */
  0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77,
  0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff
];
const wz_u5 = [
  /* unpack 5 bit to 8 bit color: (i << 3) | (i >> 2) */
  0x00, 0x08, 0x10, 0x18, 0x21, 0x29, 0x31, 0x39,
  0x42, 0x4a, 0x52, 0x5a, 0x63, 0x6b, 0x73, 0x7b,
  0x84, 0x8c, 0x94, 0x9c, 0xa5, 0xad, 0xb5, 0xbd,
  0xc6, 0xce, 0xd6, 0xde, 0xe7, 0xef, 0xf7, 0xff
];
const wz_u6 = [
  /* unpack 6 bit to 8 bit color: (i << 2) | (i >> 4) */
  0x00, 0x04, 0x08, 0x0c, 0x10, 0x14, 0x18, 0x1c,
  0x20, 0x24, 0x28, 0x2c, 0x30, 0x34, 0x38, 0x3c,
  0x41, 0x45, 0x49, 0x4d, 0x51, 0x55, 0x59, 0x5d,
  0x61, 0x65, 0x69, 0x6d, 0x71, 0x75, 0x79, 0x7d,
  0x82, 0x86, 0x8a, 0x8e, 0x92, 0x96, 0x9a, 0x9e,
  0xa2, 0xa6, 0xaa, 0xae, 0xb2, 0xb6, 0xba, 0xbe,
  0xc3, 0xc7, 0xcb, 0xcf, 0xd3, 0xd7, 0xdb, 0xdf,
  0xe3, 0xe7, 0xeb, 0xef, 0xf3, 0xf7, 0xfb, 0xff
];

function wz_read_bitmap(raw, w, h, depth, scale, size, key_i) {
   const key = WZ_KEYS[key_i];
   let buf, scale_size, depth_size;
   try {
      buf = wz_inflate_bitmap(raw);
   } catch (err) {
      buf = wz_decode_bitmap(raw, key_i);
      buf = wz_inflate_bitmap(buf);
      // TODO: handle if throw exception
   }
   size = buf.length;

   const pixelsN = w * h;
   const full_size = pixelsN * (4 * 4); // bgra
   const up_size = size>full_size?size:full_size;
   const out = Buffer.alloc(up_size);

   switch (scale) {
   case 0: scale_size = 1;  break;
   case 4: scale_size = 16; break;
   default: throw 'unsupported color scale: ' + scale;
   }
   switch (depth) {
   case WZ_COLOR_8888: depth_size = 4; break;
   case WZ_COLOR_4444:
   case WZ_COLOR_565:  depth_size = 2; break;
   case WZ_COLOR_DXT3:
   case WZ_COLOR_DXT5: depth_size = 1; break;
   default: throw 'unsupported color depth' + depth;
   }
   if (size * scale_size * scale_size !== pixelsN * depth_size) {
      throw 'invalid image: size does not match';
   }
   let sw = ~~(w / scale_size), sh = ~~(h / scale_size), dxt3 = 0;
   /* in=out, out=buf */
   switch (depth) {
   case WZ_COLOR_8888: /* in=buf, out=out */; break;
   case WZ_COLOR_4444: {
      const len = sw * sh;
      for (let i = 0; i < len; i++) {
         const pixel = buf.readUint16LE(i*2);
         const i4 = i * 4;
         out[i4] = wz_u4[pixel & 0x0f];
         out[i4+1] = wz_u4[(pixel >>> 4) & 0x0f];
         out[i4+2] = wz_u4[(pixel >>> 8) & 0x0f];
         out[i4+3] = wz_u4[(pixel >>> 12) & 0x0f];
      }
      break;
   }
   case WZ_COLOR_565: {
      const len = sw * sh;
      for (let i = 0; i < len; i++) {
         const pixel = buf.readUint16LE(i*2);
         const i4 = i * 4;
         out[i4] = wz_u5[pixel & 0x1f];
         out[i4+1] = wz_u6[(pixel >>> 5) & 0x3f];
         out[i4+2] = wz_u5[(pixel >>> 11) & 0x1f];
         out[i4+3] = 0xff;
      }
      break;
   }
   case WZ_COLOR_DXT3:
      dxt3 = 1;
      // fall through
   case WZ_COLOR_DXT5: {
      const lw = sw & 0x03; // last block size
      const lh = sh & 0x03;
      const bw = (sw >> 2) + (lw > 0); // number of blocks
      const hh = (sh >> 2) + (lh > 0);
      const bn = sw * (4 - 1) // next row of blocks
      // bgra 0123
      let c = [[0,0,0,0], [0,0,0,0], [0,0,0,0], [0,0,0,0]];
      let cur = 0, w_i = 0;
      for (let y = 0; y < bh; y++) {
         for (let x = 0; x < bw; x++) {
            const block = [];
            for (let i = 0; i < 16; i++) block.push(null);
            const alphaL = buf.readUint32LE(cur);
            cur += 4;
            const alphaH = buf.readUint32LE(cur);
            cur += 4;
            const alpha = alphaL + alphaH * 0x100000000;
            const color0 = buf.readUint16LE(cur);
            cur += 2;
            const color1 = buf.readUint16LE(cur);
            cur += 2;
            const color = buf.readUint32LE(cur);
            cur += 4;
            c[0][0] = wz_u5[(color0      ) & 0x1f];
            c[0][1] = wz_u6[(color0 >>  5) & 0x3f];
            c[0][2] = wz_u5[(color0 >> 11) & 0x1f];
            c[1][0] = wz_u5[(color1      ) & 0x1f];
            c[1][1] = wz_u6[(color1 >>  5) & 0x3f];
            c[1][2] = wz_u5[(color1 >> 11) & 0x1f];
            c[2][0] = 0xff & (~~(((c[0][0] << 1) + c[1][0]) / 3)); /* color code 2 */
            c[2][1] = 0xff & (~~(((c[0][1] << 1) + c[1][1]) / 3));
            c[2][2] = 0xff & (~~(((c[0][2] << 1) + c[1][2]) / 3));
            c[3][0] = 0xff & (~~((c[0][0] + (c[1][0] << 1)) / 3)); /* color code 3 */
            c[3][1] = 0xff & (~~((c[0][1] + (c[1][1] << 1)) / 3));
            c[3][2] = 0xff & (~~((c[0][2] + (c[1][2] << 1)) / 3));
            block[0]  = c[(color      ) & 0x3]; /* unpack color value */
            block[1]  = c[(color >>  2) & 0x3];
            block[2]  = c[(color >>  4) & 0x3];
            block[3]  = c[(color >>  6) & 0x3];
            block[4]  = c[(color >>  8) & 0x3];
            block[5]  = c[(color >> 10) & 0x3];
            block[6]  = c[(color >> 12) & 0x3];
            block[7]  = c[(color >> 14) & 0x3];
            block[8]  = c[(color >> 16) & 0x3];
            block[9]  = c[(color >> 18) & 0x3];
            block[10] = c[(color >> 20) & 0x3];
            block[11] = c[(color >> 22) & 0x3];
            block[12] = c[(color >> 24) & 0x3];
            block[13] = c[(color >> 26) & 0x3];
            block[14] = c[(color >> 28) & 0x3];
            block[15] = c[(color >> 30) & 0x3];
            if (dxt3) {
               block[0][3]  = wz_u4[(alpha >>  0) & 0xf]; /* unpack alpha value */
               block[1][3]  = wz_u4[(alpha >>  4) & 0xf];
               block[2][3]  = wz_u4[(alpha >>  8) & 0xf];
               block[3][3]  = wz_u4[(alpha >> 12) & 0xf];
               block[4][3]  = wz_u4[(alpha >> 16) & 0xf];
               block[5][3]  = wz_u4[(alpha >> 20) & 0xf];
               block[6][3]  = wz_u4[(alpha >> 24) & 0xf];
               block[7][3]  = wz_u4[(alpha >> 28) & 0xf];
               block[8][3]  = wz_u4[(alpha >> 32) & 0xf];
               block[9][3]  = wz_u4[(alpha >> 36) & 0xf];
               block[10][3] = wz_u4[(alpha >> 40) & 0xf];
               block[11][3] = wz_u4[(alpha >> 44) & 0xf];
               block[12][3] = wz_u4[(alpha >> 48) & 0xf];
               block[13][3] = wz_u4[(alpha >> 52) & 0xf];
               block[14][3] = wz_u4[(alpha >> 56) & 0xf];
               block[15][3] = wz_u4[(alpha >> 60) & 0xf];
            } else { /* dxt5 */
               let a = [0,0,0,0,0,0,0,0];
               a[0] = buf[cur-16]; /* alpha 0 */
               a[1] = buf[cur-15]; /* alpha 1 */
               if (a[0] > a[1]) {
                  a[2] = 0xff & (~~((a[0] * 6 + a[1]    ) / 7)); /* alpha 2 */
                  a[3] = 0xff & (~~((a[0] * 5 + a[1] * 2) / 7)); /* alpha 3 */
                  a[4] = 0xff & (~~((a[0] * 4 + a[1] * 3) / 7)); /* alpha 4 */
                  a[5] = 0xff & (~~((a[0] * 3 + a[1] * 4) / 7)); /* alpha 5 */
                  a[6] = 0xff & (~~((a[0] * 2 + a[1] * 5) / 7)); /* alpha 6 */
                  a[7] = 0xff & (~~((a[0]     + a[1] * 6) / 7)); /* alpha 7 */
               } else {
                  a[2] = 0xff (~~((a[0] * 4 + a[1]    ) / 5)); /* alpha 2 */
                  a[3] = 0xff (~~((a[0] * 3 + a[1] * 2) / 5)); /* alpha 3 */
                  a[4] = 0xff (~~((a[0] * 2 + a[1] * 3) / 5)); /* alpha 4 */
                  a[5] = 0xff (~~((a[0]     + a[1] * 4) / 5)); /* alpha 5 */
                  a[6] = 0;                                        /* alpha 6 */
                  a[7] = 0xff;                                     /* alpha 7 */
               }
               block[0][3]  = a[(alpha >> 16) & 0x7]; /* unpack alpha value */
               block[1][3]  = a[(alpha >> 19) & 0x7];
               block[2][3]  = a[(alpha >> 22) & 0x7];
               block[3][3]  = a[(alpha >> 25) & 0x7];
               block[4][3]  = a[(alpha >> 28) & 0x7];
               block[5][3]  = a[(alpha >> 31) & 0x7];
               block[6][3]  = a[(alpha >> 34) & 0x7];
               block[7][3]  = a[(alpha >> 37) & 0x7];
               block[8][3]  = a[(alpha >> 40) & 0x7];
               block[9][3]  = a[(alpha >> 43) & 0x7];
               block[10][3] = a[(alpha >> 46) & 0x7];
               block[11][3] = a[(alpha >> 49) & 0x7];
               block[12][3] = a[(alpha >> 52) & 0x7];
               block[13][3] = a[(alpha >> 55) & 0x7];
               block[14][3] = a[(alpha >> 58) & 0x7];
               block[15][3] = a[(alpha >> 61) & 0x7];
            }
            const pw = (x + 1 < bw || !lw) ? 4 : lw; /* the pixel may be */
            const ph = (y + 1 < bh || !lh) ? 4 : lh; /*  out of image */
            let from_i = 0;
            for (let py = 0; py < ph; py++, to += sw, from_i += 4) {
               for (let px = 0; px < pw; px++) {
                  const from_px_i = from_i+px;
                  out[w_i] = block[from_px_i][0];
                  out[w_i+1] = block[from_px_i][1];
                  out[w_i+2] = block[from_px_i][2];
                  out[w_i+3] = block[from_px_i][3];
                  w_i += 4;
               } // px
            } // py
         } // x
      } // y
      if (scale_size > 1 && sw) {
         // TODO: @1618
         const col = scale_size * (w - 1);
         const row = scale_size * (sw - 1);
         let w_i = 0, b_i = 0;
         for (y = 0; y < sh; y++) {
            for (x = 0;;) {
               /*wzcolor pixel = * src++;
               for (py = 0; py < scale_size; py++, dst += w)
                  for (px = 0; px < scale_size; px++)
                     out[px] = pixel;
                  if (++x < sw) {
                     dst -= col;
                  } else {
                     dst -= row;
                     break;
                  }*/
             }
         }
      }
      break;
   }
   default: // not possible here
   }
   return out;
}

function wz_encode_aes(cipher, len, key, iv0) /* aes ofb */ {
   const ctx = iAes256Ecb.new_context();
   iAes256Ecb.aes256_init(ctx, key);
   const iv = new Uint8Array(iv0);
   for (let i = 0; i < len; i += 16) {
      for (let j = 0; j < 16; j++) {
         cipher[j+i] = iv[j];
      }
      const block = cipher.slice(i, i+16);
      iAes256Ecb.aes256_encrypt_ecb(ctx, block);
      for (let j = 0; j < 16; j++) {
         cipher[j+i] = block[j];
         iv[j] = block[j];
      }
   }
   iAes256Ecb.aes256_done(ctx);
}

function wz_init_ctx() {
   let i, j;
   const aes_key = new Uint8Array(32);
   const aes_iv = new Uint8Array(16);
   for (i = 0; i < 32; i += 4) aes_key[i] = wz_aes_key[i/4];
   const keys = [
      Buffer.alloc(WZ_KEY_UTF8_MAX_LEN),
      Buffer.alloc(WZ_KEY_UTF8_MAX_LEN)
   ];
   for (i = 0; i < wz_aes_ivs.length; i++) {
      const aes_iv4 = wz_aes_ivs[i];
      for (j = 0; j < 16; j += 4) {
         aes_iv[j+3] = aes_iv4 >> 24;
         aes_iv[j+2] = (aes_iv4 >> 16) & 0xff;
         aes_iv[j+1] = (aes_iv4 >> 8) & 0xff;
         aes_iv[j] = aes_iv4 & 0xff;
      }
      wz_encode_aes(keys[i], WZ_KEY_UTF8_MAX_LEN, aes_key, aes_iv);
   }
   return keys;
}

function wz_encode_ver(dec) {
   const b = Buffer.alloc(6);
   let i = 5, c, hash, enc;
   b[5] = 0;
   if (dec === 0) {
      b[--i] = 48;
   } else {
      do {
         b[--i] = (dec % 10 + 48) & 0xff;
         dec = ~~(dec / 10);
      } while (dec);
   }
   hash = 0;
   while ((c = b[i++]) !== 0) {
      hash = ((hash << 5) + c + 1) & 0xffffffff;
   }
   enc = 0xff & (~(
      (hash & 0xff) ^
      ((hash >> 8) & 0xff) ^
      ((hash >> 16) & 0xff) ^
      (hash >> 24) 
   ));
   return [enc, hash];
}

function wz_decode_chars(buf, enc, key_i) {
   const key = WZ_KEYS[key_i];
   let min_len = 0;
   switch(enc) {
   case 'cp1252': {
      if (buf.length <= WZ_KEY_ASCII_MAX_LEN) {
         min_len = buf.length;
      } else {
         min_len = WZ_KEY_ASCII_MAX_LEN;
      }
      let mask8 = 0xaa;
      for (let i = 0; i < min_len; i++) {
         buf[i] = (buf[i] ^ (mask8 ^ key[i])) & 0xff;
         mask8 = (mask8 + 1) & 0xff;
      }
      for (let i = min_len; i < buf.length; i++) {
         buf[i] = (buf[i] ^ mask8) & 0xff;
         mask8 = (mask8 + 1) & 0xff;
      }
      break;
   }
   case 'utf16le': {
      if (buf.length > WZ_KEY_ASCII_MAX_LEN) return false;
      const len = buf.length >>> 1;
      min_len = len;
      let mask16 = 0xaaaa;
      for (let i = 0; i < min_len; i++) {
         const i2 = i * 2;
         const val = buf.readUint16LE(i2);
         const kal = key.readUint16LE(i2);
         buf.writeUint16LE(val ^ mask16 ^ kal, i2);
         mask16 ++;
      }
      for (let i = min_len; i < len; i++) {
         const i2 = i * 2;
         const val = buf.readUint16LE(i2);
         buf.writeUint16LE(val ^ mask16, i2);
         mask16 ++;
      }
      break;
   }
   case 'utf8': {
      if (len > WZ_KEY_UTF8_MAX_LEN) throw 'utf8 string is tool ong; please enlarge WZ_KEY_UTF8_MAX_LEN';
      for (let i = 0, n = buf.length; i < n; i++) {
         buf[i] ^= key[i];
      }
      break;
   }
   default:
      throw 'cannot decode string in: ' + enc;
   }
   return true;
}

const fileOp = {
   open: async (filename, mode) => new Promise((r, e) => {
      iFs.open(filename, mode || 'r', (err, fd) => err?e(err):r(fd));
   }),
   close: async (fd) => new Promise((r, e) => {
      iFs.close(fd, (err) => err?e(err):r());
   }),
   stat: async (filename) => new Promise((r, e) => {
      iFs.stat(filename, (err, stat) => err?e(err):r(stat));
   }),
   read: async (fd, n) => new Promise((r, e) => {
      const buf = Buffer.alloc(n);
      iFs.read(fd, { buffer: buf, length: n }, (err, n0, res) => {
         if (err) return e(err);
         if (n === n0) return r(res);
         return r(res.slice(0, n0));
      });
   }),
};
const bitOp = {
   _int8: (x) => {
      if (x < 128) return x;
      return ~(255 - x);
   },
   int8: (buf) => {
      return bitOp._int8(buf[0]);
   },
   int16: (buf) => {
      return buf.readInt16LE(0);
   },
   uint16: (buf) => {
      return buf.readUInt16LE(0);
   },
   int32: (buf) => {
      return buf.readInt32LE(0);
   },
   uint32: (buf) => {
      return buf.readUInt32LE(0);
   },
   int64: (buf) => {
      const L = buf.readUInt32LE(0);
      const H = buf.readUint32LE(4);
      if (H & 0x80000000) {
         const max = 0x100000000000000000;
         return H * 0x100000000 + L - max;
      } else {
         return H * 0x100000000 + L;
      }
   },
   uint64: (buf) => {
      const L = buf.readUInt32LE(0);
      const H = buf.readUint32LE(4);
      return H * 0x100000000 + L;
   }
};

class WzNode {
   constructor(file) {
      this.file = file;
      this.flags = 0;
      this.children = null;
      this.val = null;
      this.name = null;
      this.parent = null;
      this.pos = -1;
      this.type = null;
      this.root = null;
   }

   update0(name, pos, flags) {
      this.name = name;
      this.pos = pos;
      this.flags = flags;
   }

   async read_node_list() {
      const root = this.root;
      await this.file.readUint16(); // skip 2 bytes
      const len = await this.file.readInt();
      let flags = 0, val;
      const list = [];
      for (let i = 0; i < len; i++) {
         const namep = await this.file.readString(
            WZ_LV1_NAME, root.key, WZ_UINT8_MAX, root.pos
         );
         const name = namep[0];
         const type = await this.file.readByte();
         const item = {};
         let typestr = 'unk';
         switch (type) {
         case 0x00: // NIL
            typestr = 'nil';
            val = null;
            flags = WZ_EMBED | WZ_NIL;
            break;
         case 0x02: // I16
         case 0x0b: // I16
            typestr = 'i16';
            val = await this.file.readUint16();
            flags = WZ_EMBED | WZ_I16;
            break;
         case 0x03: // I32
         case 0x13: // I32
            typestr = 'i32';
            val = await this.file.readInt();
            flags = WZ_EMBED | WZ_I32;
            break;
         case 0x14: // I64
            typestr = 'i64';
            val = await this.file.readInt_64();
            flags = WZ_EMBED | WZ_I64;
            break;
         case 0x04: // F32
            typestr = 'f32';
            val = await this.file.readFloat();
            flags = WZ_EMBED | WZ_F32;
            break;
         case 0x05: // F64
            typestr = 'f64';
            val = await this.file.readFloat64();
            flags = WZ_EMBED | WZ_F64;
            break;
         case 0x08: { // STR
            typestr = 'str';
            const strp = await this.file.readString(
               WZ_LV1_STR, root.key, 0, root.pos
            );
            val = strp[0].toString();
            flags = WZ_EMBED | WZ_STR;
            break;
         }
         case 0x09: { // OBJ
            typestr = 'obj';
            const size = await this.file.readUint32();
            item.pos = this.file.pos;
            await this.file.read(size);
            val = null;
            flags = WZ_UNK;
            break;
         }
         default:
            throw 'unsupported primitive type: ' + type
         }
         item.type = typestr;
         item.key = root.key;
         item.name = name.toString();
         item.flags = flags | WZ_LEVEL;
         item.parent = this;
         item.root = root;
         item.val = val;
         list.push(item);
      }
      this.children = list.map((x) => objToWzNode(this.file, x));
   }

   async wz_read_lv1() {
      const root = this.root;
      const adddr = this.pos;
      if (!(await this.file._open())) {
         return false;
      }
      await this.file._seek(this.pos);
      const p = await this.file.readString(
         WZ_LV1_TYPENAME_OR_STR, root.key, 20, root.pos
      );
      const typename = p[0].toString();
      if (root.key === 0xff) {
         root.key = await this.file.wz_deduce_key(typename, 0xff);
      }
      switch(typename) {
      case 'Property': // array
         await this.read_node_list();
         this.flags = (this.flags ^ WZ_UNK) | WZ_ARY;
         this.type = 'array';
         break;
      case 'Canvas': { // image
         await this.file.readByte(); // skip 1 byte
         if (await this.file.readByte() === 1) {
            // is list
            await this.read_node_list();
         }
         const w = await this.file.readInt();
         const h = await this.file.readInt();
         const depth = await this.file.readInt();
         if (depth > WZ_UINT16_MAX) {
            throw 'invalid image';
         }
         const scale = await this.file.readByte();
         await this.file.readUint32(); // skip 4 bytes
         const sizep1 = await this.file.readUint32();
         await this.file.readByte(); // skip 1 byte
         if (sizep1 <= 1) throw 'invalid image';
         const size = sizep1 - 1; // remove null terminator
         const raw = await this.file.read(size);
         const cooked = wz_read_bitmap(raw, w, h, depth, scale, size, root.key);
         this.val = {
            w, h, depth, scale, size,
            data: cooked
         };
         this.flags = (this.flags ^ WZ_UNK) | WZ_IMG;
         this.type = 'image';
         break;
      }
      case 'Shape2D#Convex2D': { // vex
         const vex = [];
         const len = await this.file.readInt();
         for (let i = 0; i < len; i++) {
            const subtypep = await this.file.readString(
               WZ_LV1_TYPENAME, root.key, 20, root.pos
            );
            const subtypename = subtypep[0].toString();
            if (subtypename !== 'Shape2D#Vector2D') {
               throw 'invalid convex';
            }
            const x = await this.file.readInt();
            const y = await this.file.readInt();
            vex.push({ x, y });
         }
         this.val = vex;
         this.flags = (this.flags ^ WZ_UNK) | WZ_VEX;
         this.type = 'convex';
         break;
      }
      case 'Shape2D#Vector2D': { // vec
         const x = await this.file.readInt();
         const y = await this.file.readInt();
         this.val = { x, y };
         this.flags = (this.flags ^ WZ_UNK) | WZ_VEC;
         this.type = 'vector';
         break;
      }
      case 'Sound_DX8': { // audio
         await this.file.readByte(); // skip 1 byte
         const size = await this.file.readInt();
         const ms = await this.file.readInt();
         await this.file.read(1+16*2+2); // skip major and subtype GUID
         const guid = await this.file.read(16);
         this.val = { ms, size };
         if (bufferCompare(guid, WZ_GUID_WAV)) {
            const wav = {};
            wav.format = 0;
            const hsize = await this.file.readByte();
            const hdr = await this.file.read(hsize);
            wz_read_wav(wav, hdr);
            if (WZ_AUDIO_WAV_SIZE + wav.extra_size !== hsize) {
               for (let j = 0; j < WZ_KEYS.length; j ++) {
                  wz_decode_wav(hdr, j);
                  we_read_wav(wav, hdr);
                  if (WZ_AUDIO_WAV_SIZE + wav.extra_size === hsize) break;
                  wz_decode_wav(hdr, j); // roll back
               }
               if (WZ_AUDIO_WAV_SIZE + wav.extra_size !== hsize) {
                  throw 'invalid wav';
               }
            }
            if (wav.format === WZ_AUDIO_PCM) {
               const outhdr = Buffer.alloc(WZ_AUDIO_PCM_SIZE);
               outhdr.writeUint32BE(0x52494646, 0); // "RIFF"
               outhdr.writeUint32LE(size+WZ_AUDIO_PCM_SIZE-8, 4); // size
               outhdr.writeUint32BE(0x57415645, 8); // "WAVE"
               outhdr.writeUint32BE(0x666d7420, 12); // "fmt "
               outhdr.writeUint32LE(16, 16);
               outhdr.writeUint16LE(wav.format, 20);
               outhdr.writeUint16LE(wav.channels, 22);
               outhdr.writeUint32LE(wav.sample_rate, 24);
               outhdr.writeUint32LE(wav.byte_rate, 28);
               outhdr.writeUint16LE(wav.block_align, 32);
               outhdr.writeUint16LE(wav.bits_per_sample, 34);
               outhdr.writeUint32BE(0x64617461, 36) // "data"
               outhdr.writeUint32LE(size, 40);
               const chunk = await this.file.read(size);
               this.val.format = 'wav';
               this.val.data = Buffer.concat([outhdr, chunk]);
            } else if (wav.format === WZ_AUDIO_MP3) {
               const data = await this.file.read(size);
               this.val.format = 'mp3';
               this.val.data = data;
               // data dump to mp3 file and playable; tested
            } else {
               throw 'unsupported audio format: ' + wav.format;
            }
         } else if (bufferCompare(guid, WZ_EMPTY_GUID)) {
            const data = await this.file.read(size);
            this.val.format = 'unk';
            this.val.data = data;
         } else {
            this.val = null;
            throw 'unsupported audio guid: ' + guid;
         }
         this.flags = (this.flags ^ WZ_UNK) | WZ_AUD;
         this.type = 'audio';
         break;

         function wz_decode_wav(hdr, key_i) {
            const key = WZ_KEYS[key_i];
            for (let i = 0; i < hdr.length; i++) {
               hdr[i] ^= key[i];
            }
         }
      }
      case 'UOL': { // uol
         await this.file.readByte(); // skip 1 byte
         const uolp = await this.file.readString(
            WZ_LV1_STR, root.key, 0, root.pos
         );
         this.val = uolp[0].toString();
         this.flags = (this.flags ^ WZ_UNK) | WZ_UOL;
         this.type = 'uol';
         break;
      }
      default:
         throw `non-supported node type: "${typename}"`;
      }
      await this.file._close();
      return true;
   }

   async wz_read_lv0() {
      if (!(await this.file._open())) {
         return false;
      }
      await this.file._seek(this.pos);
      const basePos = this.file.ctx.start;
      const key_i = this.file.ctx.key;
      const size = this.file.size;
      const entityN = await this.file.readInt();
      if (!entityN) {
         await this.file._close();
         return false;
      }
      const entities = [];
      for (let i = 0; i < entityN; i++) {
         const type = await this.file.readByte();
         switch (type) {
         case 0x02: { // LINK
            const offset = await this.file.readUint32();
            entities.push({
               type: 'link',
               pos: basePos + offset,
               enc: 0
            });
            // TODO: jump to the offset and read
            break;
         }
         case 0x03: // ARR
         case 0x04: // OBJ
         {
            const p = await this.file.readString(WZ_LV0_NAME, key_i, 42, 0);
            const name = p[0];
            const name_enc = p[1];
            const _size = await this.file.readInt();
            const _check = await this.file.readInt();
            const addr_pos = this.file.pos;
            const addr_enc = await this.file.readUint32();
            entities.push({
               type: type === 0x03?'array':'obj',
               enc: addr_enc,
               pos: addr_pos,
               name: name,
               name_enc: name_enc,
               flags: type === 0x03?WZ_ARY:(WZ_UNK | WZ_LEAF)
            });
            break;
         }
         case 0x01: // NIL
            this.file.read(10); // unknown 10 bytes
            entities.push({
               type: 'nil',
               enc: 0,
               flags: WZ_EMBED | WZ_NIL | WZ_LEAF
            });
            break;
         default:
            throw 'Unsupported node type ' + type;
         }
      }
      for (let i = 0; i < entityN; i++) {
         const entity = entities[i];
         const addr_enc = entity.enc;
         if (!addr_enc) continue;
         const addr_pos = entity.pos;
         const addr_dec = await this.file.wz_decode_addr(
            addr_enc, addr_pos, basePos, this.file.ctx.hash
         );
         entity.pos = addr_dec;
         const name_enc = entity.name_enc;
         entity.key = key_i;
         if (name_enc !== 'cp1252' || key_i != 0xff) continue;
         entity.key = await this.file.wz_deduce_key(entity.name, key_i);
      }
      entities.forEach((x) => {
         x.name = x.name.toString();
         x.root = x;
         x.parent = null;
         delete x.name_enc;
         delete x.enc;
      });
      this.children = entities.map(
         (x) => objToWzNode(this.file, x)
      );
      await this.file._close();
      return true;
   }

}

class WzFile {
   constructor(filename) {
      this.filename = filename;
      this.ctx = null;
      this.fd = -1;
      // TODO: use separate `pos` to make sure thread-safe
      //       currently, it is not thread-safe
      this.pos = 0;
      this.size = -1;
      this.busy = false;
   }

   async _open() {
      if (this.busy) return false;
      this.busy = true;
      if (this.fd >= 0) await this._close();
      this.fd = await fileOp.open(this.filename, 'r');
      return true;
   }

   async read(n) {
      if (this.fd < 0) return Buffer.alloc(0);
      const buf = await fileOp.read(this.fd, n);
      this.pos += buf.length;
      return buf;
   }
   async readByte() {
      const buf = await fileOp.read(this.fd, 1);
      this.pos ++;
      return buf[0];
   }
   async readInt8() {
      const buf = await fileOp.read(this.fd, 1);
      this.pos ++;
      return bitOp.int8(buf);
   }
   async readInt16() {
      const buf = await fileOp.read(this.fd, 2);
      this.pos += 2;
      return bitOp.int16(buf);
   }
   async readUint16() {
      const buf = await fileOp.read(this.fd, 2);
      this.pos += 2;
      return bitOp.uint16(buf);
   }
   async readInt32() {
      const buf = await fileOp.read(this.fd, 4);
      this.pos += 4;
      return bitOp.int32(buf);
   }
   async readUint32() {
      const buf = await fileOp.read(this.fd, 4);
      this.pos += 4;
      return bitOp.uint32(buf);
   }
   async readInt64() {
      const buf = await fileOp.read(this.fd, 8);
      this.pos += 8;
      return bitOp.int64(buf);
   }
   async readUint64() {
      const buf = await fileOp.read(this.fd, 8);
      this.pos += 8;
      return bitOp.uint64(buf);
   }
   async readInt() {
      const int8 = await this.readInt8();
      if (int8 === WZ_INT8_MIN) return await this.readInt32();
      return int8;
   }
   async readInt_64() {
      const int8 = await this.readInt8();
      if (int8 === WZ_INT8_MIN) return await this.readInt64();
      return int8;
   }
   async readFloat32() {
      const buf = await fileOp.read(this.fd, 4);
      this.pos += 4;
      return buf.readFloatLE(buf);
   }
   async readFloat64() {
      const buf = await fileOp.read(this.fd, 8);
      this.pos += 8;
      return buf.readDoubleLE(buf);
   }
   async readFloat() {
      const int8 = await this.readInt8();
      if (int8 === WZ_INT8_MIN) return await this.readFloat32();
      return int8;
   }
   async readDouble() {
      const int8 = await this.readInt8();
      if (int8 === WZ_INT8_MIN) return await this.readFloat64();
      return int8;
   }
   async readString(type, key_i, capa, basePos) {
      // supported for cp1252, utf16le, or utf8
      let padding = 0, pos = 0;
      let len = -1, enc = 'auto';
      if (type !== WZ_LV0_NAME) {
         const fmt = await this.readByte();
         let inplace = 2;
         switch(type) {
         case WZ_LV1_NAME:
         case WZ_LV1_STR:
            if (fmt === 0x00) inplace = 1;
            else if (fmt === 0x01) inplace = 0;
            break;
         case WZ_LV1_TYPENAME:
            if (fmt === 0x1b) inplace = 0;
            else if (fmt === 0x73) inplace = 1;
            break;
         case WZ_LV1_TYPENAME_OR_STR:
            if (fmt === 0x01) inplace = 1;
            else if (fmt === 0x1b) inplace = 0;
            else if (fmt === 0x73) inplace = 1;
            break;
         }
         if (inplace === 2) {
            // unsupported string type
            return [Buffer.alloc(0), enc];
         }
         if (!inplace) {
            const strOffset = await this.readUint32();
            pos = this.pos;
            await this._seek(basePos + strOffset);
         }
         if (type == WZ_LV1_STR) {
            padding = 32;
         } else if (type === WZ_LV1_TYPENAME_OR_STR && fmt === 0x01) {
            enc = 'utf8';
            capa = 0;
            key_i = 1;
            padding = 32;
         }
      }
      let tmp = await this.readInt8();
      if (tmp <= 0) { // cp1252, ascii, utf8
         if (tmp === WZ_INT8_MIN) {
            len = await this.readUint32();
         } else {
            len = -tmp;
         }
         if (enc === 'auto') enc = 'cp1252';
      } else { // utf16le
         if (tmp === WZ_INT8_MIN) {
            len = await this.readUint32();
         } else {
            len = tmp;
         }
         len *= 2;
         if (enc === 'auto') enc = 'utf16le';
      }
      if (capa) {
         if (len >= capa) { /* TODO: error */ }
      }
      let buf = await this.read(len);
      if (key_i !== 0xff) {
         wz_decode_chars(buf, enc, key_i);
         switch(enc) {
         case 'cp1252':
            buf = wz_cp1252_to_utf8(buf);
            break;
         case 'utf16le':
            buf = wz_utf16le_to_utf8(buf);
            break;
         default: // auto, utf8 and others
         }
      }
      if (pos) await this._seek(pos);
      return [buf, enc];
   }

   async _seek(offset) {
      if (this.fd < 0) return;
      if (this.pos > offset) {
         await fileOp.close(this.fd);
         this.fd = await fileOp.open(this.filename, 'r');
         this.pos = 0;
         const max = 1024 * 1024 * 1 /* 1MB */;
         if (this.size < offset) offset = this.size;
         let cur = 0;
         while (cur < offset) {
            const diff = offset - cur;
            if (diff > max) {
               await this.read(max);
               cur += max;
            } else {
               await this.read(diff);
               cur += diff;
            }
         }
      } else if (offset === this.pos) {
      } else {
         await this.read(offset - this.pos);
      }
   }

   async init() {
      if (!(await this._open())) {
         return false;
      }
      this.ctx = {};
      this.ctx.root = new WzNode(this);
      const stat = await fileOp.stat(this.filename);
      this.size = stat.size;
      this.pos = 0;

      // data: ident + size + unk
      const header = await this.read(4+4+4);
      const startPos = await this.readUint32();
      // data: copyright
      await this.read(startPos - this.pos);
      const enc = await this.readUint16();
      const ret = await this.wz_deduce_ver(startPos, enc);
      this.ctx.hash = ret[0];
      this.ctx.key = ret[1];
      this.ctx.start = startPos;
      const parsed = ret[3];
      this.ctx.root.key = ret[1];
      this.ctx.root.enc = enc;
      this.ctx.root.children = parsed.children.map(
         (x) => objToWzNode(this, x)
      );
      this.ctx.root.flags = parsed.flags;
      this.ctx.root.pos = parsed.pos;
      this.ctx.root.name = '';
      this.pos = 0;
      await this._close();
      return true;
   }

   async wz_decode_addr(enc, pos, basePos, hash) {
      const buf = Buffer.alloc(4);
      const key = 0x581c3f6d;
      let x = (~(pos - basePos) * hash - key) & 0xffffffff;
      const n = x & 0x1f;
      x = (x << n) | (x >>> (32 - n));
      const ret = (x ^ enc) + basePos * 2;
      buf.writeInt32LE(ret);
      return buf.readUint32LE(0);
   }
   async wz_deduce_key(name, key) {
      const len = name.length;
      for (let i = 0; i <= WZ_KEYS.length; i++) {
         if (!wz_decode_chars(name, 'cp1252', i)) continue;
         for (
            let j = 0;
            j < len && name[j] > 32 && name[j] < 127;
            j++
         ) {
            if (j !== len-1) continue;
            return i;
         }
         if (!wz_decode_chars(name, 'cp1252', i)) continue;
      }
      // TODO: error: cannot deduce the string key
      return 0xff;
   }

   async wz_deduce_ver(basePos, enc) {
      const ret = [0, 0, 0];
      const size = this.size;
      const startPos = this.pos;
      const entityN = await this.readInt();
      if (!entityN) return false;
      const entities = [];
      for (let i = 0; i < entityN; i++) {
         const type = await this.readByte();
         switch (type) {
         case 0x02: { // LINK
            const offset = await this.readUint32();
            entities.push({
               type: 'link',
               pos: basePos + offset,
               enc: 0
            });
            // TODO: jump to the offset and read
            break;
         }
         case 0x03: // ARR
         case 0x04: { // OBJ
            const p = await this.readString(WZ_LV0_NAME, 0xff, 42, 0);
            const name = p[0];
            const name_enc = p[1];
            const _size = await this.readInt();
            const _check = await this.readInt();
            const addr_pos = this.pos;
            const addr_enc = await this.readUint32();
            entities.push({
               type: type === 0x03?'array':'obj',
               enc: addr_enc,
               pos: addr_pos,
               name: name,
               name_enc: name_enc,
               flags: type === 0x03?WZ_ARY:(WZ_UNK | WZ_LEAF)
            });
            break;
         }
         case 0x01: // NIL
            this.read(10); // unknown 10 bytes
            entities.push({
               type: 'nil',
               enc: 0,
               flags: WZ_EMBED | WZ_NIL | WZ_LEAF
            });
            break;
         default:
            throw 'Unsupported node type ' + type;
         }
      }

      let g_dec, g_hash = 0, g_enc, key, guessed = 0;
      for (g_dec = 0; g_dec < 512; g_dec++) {
         const next_g = wz_encode_ver(g_dec);
         g_enc = next_g[0];
         g_hash = next_g[1];
         if (g_enc !== enc) continue;
         let over = 0;
         for (let i = 0; i < entityN; i++) {
            const entity = entities[i];
            const addr_enc = entity.enc;
            if (!addr_enc) continue;
            const addr_pos = entity.pos;
            const addr_dec = await this.wz_decode_addr(
               addr_enc, addr_pos, basePos, g_hash
            );
            if (addr_dec > this.size) {
               over = 1;
               break;
            }
            entity.pos = addr_dec;
         }
         if (!over) {
            guessed = 1;
            break;
         }
      }
      if (!guessed) throw 'cannot decode file (dec error)';
      key = 0xff;
      for (let i = 0; i < entityN; i ++) {
         const entity = entities[i];
         const addr_enc = entity.enc;
         if (!addr_enc) continue;
         const name_enc = entity.name_enc;
         if (name_enc !== 'cp1252') continue;
         key = await this.wz_deduce_key(entity.name, key);
         entity.key = key;
      }
      if (key === 0xff) throw 'cannot decode file (key error)';

      entities.forEach((x) => {
         x.name = x.name.toString();
         x.root = x;
         x.parent = null;
         delete x.name_enc;
         delete x.enc;
      });

      ret[0] = g_hash;
      ret[1] = key;
      ret[2] = g_dec;
      ret[3] = {
         children: entities,
         flags: WZ_ARY | WZ_EMBED,
         pos: startPos
      };
      return ret;
   }

   async reset() {
      this.ctx = null;
   }

   async _close() {
      if (this.fd < 0) return;
      await fileOp.close(this.fd);
      this.busy = false;
      this.fd = -1;
      this.pos = 0;
   }

   getRootItems() {
      if (!this.ctx) return null;
      return this.ctx.root;
   }

   async get(path) {
      const root = this.getRootItems();
      if (!root) return null;
      const parts = (path || '/').split('/');
      let cur = parts.shift();
      if (!cur) parts.unshift(cur);
      cur = root;
      for (let i = 0, n = parts.length; i < n; i++) {
         const name = parts[i];
         if (!name) continue;
         if (cur.flags & (WZ_LEVEL | WZ_LEAF)) {
            await cur.wz_read_lv1();
         } else {
            await cur.wz_read_lv0();
         }
         if (cur.children && cur.children.length) {
            cur = cur.children.filter((x) => x.name === name)[0];
         } else {
            cur = null;
         }
         if (!cur) {
            throw 'break --x--> ' + name;
         }
      }
      if (cur) {
         if (cur.flags & (WZ_LEVEL | WZ_LEAF)) {
            if (!(cur.flags & WZ_EMBED)) await cur.wz_read_lv1();
         } else {
            await cur.wz_read_lv0();
         }
      }
      return cur;
   }
}

if (require.main === module) {
   async function main() {
      const wf = new WzFile(process.argv[2]);
      await wf.init();
      const root = wf.getRootItems();
      const node = await wf.get(process.argv[3] || '/');
      if (node) {
         console.log('val =', node.val);
         if (node.children) {
            console.log(node.children.map((x) => x.name));
         }
      }
   }
   main().then(() => {
      console.log('Done.');
   }, (err) => console.log(err, 'err')).catch(
      (err) => console.error(err)
   );
}

module.exports = {
   WzFile,
   WzNode,
};
