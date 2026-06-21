/* 앱 아이콘(PNG) 생성 스크립트.
 * 외부 의존성 없이 Node 내장 zlib 만으로 셔츠 모양 아이콘을 그려 저장한다.
 * 실행: node generate-icons.js  →  icon-192.png, icon-512.png, apple-touch-icon.png */
const fs = require('fs');
const zlib = require('zlib');

// CRC32 (PNG 청크용)
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function writePNG(path, width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  fs.writeFileSync(path, Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]));
}

// 점이 삼각형 안에 있는지 판정
function inTriangle(px, py, ax, ay, bx, by, cx, cy) {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

// 셔츠 실루엣(흰색) + 파란 배경. 좌표는 0~1.
function shirtAlpha(x, y) {
  const inBody = x >= 0.36 && x <= 0.64 && y >= 0.44 && y <= 0.80;
  const inLeftSleeve = inTriangle(x, y, 0.36, 0.44, 0.36, 0.58, 0.24, 0.50);
  const inRightSleeve = inTriangle(x, y, 0.64, 0.44, 0.64, 0.58, 0.76, 0.50);
  let on = inBody || inLeftSleeve || inRightSleeve;
  // 목 부분(칼라) 파내기: 위쪽 중앙의 반타원
  const dx = (x - 0.5) / 0.07, dy = (y - 0.44) / 0.055;
  if (y < 0.50 && dx * dx + dy * dy < 1) on = false;
  return on;
}

function makeIcon(size) {
  const buf = Buffer.alloc(size * size * 4);
  const bg = [37, 99, 235];   // #2563eb
  const fg = [255, 255, 255];
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const x = (px + 0.5) / size, y = (py + 0.5) / size;
      const on = shirtAlpha(x, y);
      const c = on ? fg : bg;
      const i = (py * size + px) * 4;
      buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255;
    }
  }
  return buf;
}

for (const [size, name] of [[192, 'icon-192.png'], [512, 'icon-512.png'], [180, 'apple-touch-icon.png']]) {
  writePNG(`${__dirname}/${name}`, size, size, makeIcon(size));
  console.log('wrote', name);
}
