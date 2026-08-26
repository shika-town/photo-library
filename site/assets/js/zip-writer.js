/* =====================================================================
   SHIKA PHOTO LIBRARY  ―  zip-writer.js
   外部ライブラリを使わず、複数の画像をひとつのZIPファイル（無圧縮 = STORE方式）
   にまとめるための最小限のユーティリティです。
   ===================================================================== */
(function () {
  'use strict';

  var CRC_TABLE = (function () {
    var table = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    var crc = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function dosDateTime(date) {
    date = date || new Date();
    var time = ((date.getHours() & 0x1F) << 11) | ((date.getMinutes() & 0x3F) << 5) | ((date.getSeconds() >> 1) & 0x1F);
    var d = (((date.getFullYear() - 1980) & 0x7F) << 9) | (((date.getMonth() + 1) & 0xF) << 5) | (date.getDate() & 0x1F);
    return { time: time & 0xFFFF, date: d & 0xFFFF };
  }

  function u16(arr, offset, value) { arr[offset] = value & 0xFF; arr[offset + 1] = (value >>> 8) & 0xFF; }
  function u32(arr, offset, value) {
    arr[offset] = value & 0xFF; arr[offset + 1] = (value >>> 8) & 0xFF;
    arr[offset + 2] = (value >>> 16) & 0xFF; arr[offset + 3] = (value >>> 24) & 0xFF;
  }

  function localHeader(nameBytes, size, crc, dt) {
    var h = new Uint8Array(30 + nameBytes.length);
    u32(h, 0, 0x04034b50);
    u16(h, 4, 20);
    u16(h, 6, 0);
    u16(h, 8, 0); // store（無圧縮）
    u16(h, 10, dt.time);
    u16(h, 12, dt.date);
    u32(h, 14, crc);
    u32(h, 18, size);
    u32(h, 22, size);
    u16(h, 26, nameBytes.length);
    u16(h, 28, 0);
    h.set(nameBytes, 30);
    return h;
  }

  function centralHeader(nameBytes, size, crc, dt, localOffset) {
    var h = new Uint8Array(46 + nameBytes.length);
    u32(h, 0, 0x02014b50);
    u16(h, 4, 20);
    u16(h, 6, 20);
    u16(h, 8, 0);
    u16(h, 10, 0);
    u16(h, 12, dt.time);
    u16(h, 14, dt.date);
    u32(h, 16, crc);
    u32(h, 20, size);
    u32(h, 24, size);
    u16(h, 28, nameBytes.length);
    u16(h, 30, 0);
    u16(h, 32, 0);
    u16(h, 34, 0);
    u16(h, 36, 0);
    u32(h, 38, 0);
    u32(h, 42, localOffset);
    h.set(nameBytes, 46);
    return h;
  }

  function concat(arrays) {
    var total = arrays.reduce(function (sum, a) { return sum + a.length; }, 0);
    var out = new Uint8Array(total);
    var offset = 0;
    arrays.forEach(function (a) { out.set(a, offset); offset += a.length; });
    return out;
  }

  // files: [{ name: 'P0001_bench.jpg', blob: Blob }, ...] → Promise<Blob>（application/zip）
  function build(files) {
    return Promise.all(files.map(function (f) {
      return f.blob.arrayBuffer().then(function (buf) { return { name: f.name, bytes: new Uint8Array(buf) }; });
    })).then(function (entries) {
      var dt = dosDateTime();
      var chunks = [];
      var centralChunks = [];
      var offset = 0;
      entries.forEach(function (entry) {
        var nameBytes = new TextEncoder().encode(entry.name);
        var crc = crc32(entry.bytes);
        var local = localHeader(nameBytes, entry.bytes.length, crc, dt);
        chunks.push(local, entry.bytes);
        centralChunks.push(centralHeader(nameBytes, entry.bytes.length, crc, dt, offset));
        offset += local.length + entry.bytes.length;
      });
      var central = concat(centralChunks);
      var centralStart = offset;

      var end = new Uint8Array(22);
      u32(end, 0, 0x06054b50);
      u16(end, 8, entries.length);
      u16(end, 10, entries.length);
      u32(end, 12, central.length);
      u32(end, 16, centralStart);

      return new Blob([concat(chunks.concat([central, end]))], { type: 'application/zip' });
    });
  }

  window.SPLZip = { build: build };
})();
