/* Minimal QR encoder - byte mode, error correction level M, versions 1-10.
   Written for MOKI so the join code works offline with no library or API.
   Exposes window.MOKIQR.svg(text, options) -> an <svg> string. */
(function () {
  'use strict';

  /* ---- GF(256) tables, primitive polynomial 0x11D ---- */
  var EXP = new Array(512), LOG = new Array(256);
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11D; }
    for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255];
  })();
  function mul(a, b) { return (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]]; }

  /* ---- per-version layout for ECC level M ----
     [ total data codewords, ec codewords per block,
       group1 block count, group1 data cw, group2 block count, group2 data cw ] */
  var SPEC = {
    1:  [16,  10, 1, 16, 0, 0],
    2:  [28,  16, 1, 28, 0, 0],
    3:  [44,  26, 1, 44, 0, 0],
    4:  [64,  18, 2, 32, 0, 0],
    5:  [86,  24, 2, 43, 0, 0],
    6:  [108, 16, 4, 27, 0, 0],
    7:  [124, 18, 4, 31, 0, 0],
    8:  [154, 22, 2, 38, 2, 39],
    9:  [182, 22, 3, 36, 2, 37],
    10: [216, 26, 4, 43, 1, 44]
  };
  var ALIGN = {
    1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
    6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50]
  };

  function rsGenerator(deg) {
    var poly = [1];
    for (var i = 0; i < deg; i++) {
      var next = [];
      for (var k = 0; k <= poly.length; k++) next[k] = 0;
      for (var j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= mul(poly[j], EXP[i]);
      }
      poly = next;
    }
    return poly;
  }

  function rsRemainder(data, ecLen) {
    var gen = rsGenerator(ecLen);
    var res = [];
    for (var i = 0; i < ecLen; i++) res[i] = 0;
    for (var d = 0; d < data.length; d++) {
      var factor = data[d] ^ res[0];
      res.shift();
      res.push(0);
      for (var j = 0; j < ecLen; j++) res[j] ^= mul(gen[j + 1], factor);
    }
    return res;
  }

  function toBytes(text) {
    var out = [];
    var encoded = unescape(encodeURIComponent(String(text)));  // UTF-8
    for (var i = 0; i < encoded.length; i++) out.push(encoded.charCodeAt(i) & 0xFF);
    return out;
  }

  function pickVersion(byteLen) {
    for (var v = 1; v <= 10; v++) {
      var countBits = v < 10 ? 8 : 16;
      var capacity = SPEC[v][0] * 8 - 4 - countBits;
      if (byteLen * 8 <= capacity) return v;
    }
    return 0;
  }

  function buildCodewords(bytes, version) {
    var spec = SPEC[version];
    var totalData = spec[0], ecLen = spec[1];
    var bits = [];
    function push(value, len) {
      for (var i = len - 1; i >= 0; i--) bits.push((value >> i) & 1);
    }

    push(4, 4);                                   // byte mode indicator
    push(bytes.length, version < 10 ? 8 : 16);    // character count
    for (var i = 0; i < bytes.length; i++) push(bytes[i], 8);

    var capacity = totalData * 8;
    for (var t = 0; t < 4 && bits.length < capacity; t++) bits.push(0);   // terminator
    while (bits.length % 8 !== 0) bits.push(0);

    var data = [];
    for (var b = 0; b < bits.length; b += 8) {
      var byte = 0;
      for (var k = 0; k < 8; k++) byte = (byte << 1) | bits[b + k];
      data.push(byte);
    }
    var pads = [0xEC, 0x11], p = 0;
    while (data.length < totalData) data.push(pads[p++ % 2]);

    var blocks = [], ecBlocks = [], offset = 0;
    function take(count, size) {
      for (var n = 0; n < count; n++) {
        var block = data.slice(offset, offset + size);
        offset += size;
        blocks.push(block);
        ecBlocks.push(rsRemainder(block, ecLen));
      }
    }
    take(spec[2], spec[3]);
    if (spec[4]) take(spec[4], spec[5]);

    var out = [], maxData = Math.max(spec[3], spec[5] || 0), idx;
    for (idx = 0; idx < maxData; idx++) {
      for (var bi = 0; bi < blocks.length; bi++) {
        if (idx < blocks[bi].length) out.push(blocks[bi][idx]);
      }
    }
    for (idx = 0; idx < ecLen; idx++) {
      for (var ei = 0; ei < ecBlocks.length; ei++) out.push(ecBlocks[ei][idx]);
    }
    return out;
  }

  /* ---- matrix ---- */
  function makeMatrix(version) {
    var size = version * 4 + 17;
    var m = [], reserved = [];
    for (var r = 0; r < size; r++) {
      m[r] = []; reserved[r] = [];
      for (var c = 0; c < size; c++) { m[r][c] = 0; reserved[r][c] = 0; }
    }

    function setArea(row, col, h, w, fn) {
      for (var r = 0; r < h; r++) {
        for (var c = 0; c < w; c++) {
          var rr = row + r, cc = col + c;
          if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
          m[rr][cc] = fn(r, c);
          reserved[rr][cc] = 1;
        }
      }
    }

    function finder(row, col) {
      setArea(row - 1, col - 1, 9, 9, function () { return 0; });   // separator
      setArea(row, col, 7, 7, function (r, c) {
        var edge = (r === 0 || r === 6 || c === 0 || c === 6);
        var core = (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        return edge || core ? 1 : 0;
      });
    }
    finder(0, 0);
    finder(0, size - 7);
    finder(size - 7, 0);

    // timing patterns
    for (var i = 8; i < size - 8; i++) {
      m[6][i] = (i % 2 === 0) ? 1 : 0; reserved[6][i] = 1;
      m[i][6] = (i % 2 === 0) ? 1 : 0; reserved[i][6] = 1;
    }

    /* Alignment patterns. A centre that lands on an already-reserved module is
       a finder corner and is skipped - but the timing row/column also marks
       modules reserved, so the finder test looks at the pattern's own corner
       rather than its centre. */
    var centers = ALIGN[version];
    for (var a = 0; a < centers.length; a++) {
      for (var b = 0; b < centers.length; b++) {
        var cr = centers[a], cc2 = centers[b];
        var nearFinder =
          (cr <= 8 && cc2 <= 8) ||
          (cr <= 8 && cc2 >= size - 9) ||
          (cr >= size - 9 && cc2 <= 8);
        if (nearFinder) continue;
        setArea(cr - 2, cc2 - 2, 5, 5, function (r, c) {
          return (r === 0 || r === 4 || c === 0 || c === 4 || (r === 2 && c === 2)) ? 1 : 0;
        });
      }
    }

    // format information areas, reserved now and filled after masking
    for (var f = 0; f < 9; f++) {
      if (!reserved[8][f]) { reserved[8][f] = 1; m[8][f] = 0; }
      if (!reserved[f][8]) { reserved[f][8] = 1; m[f][8] = 0; }
    }
    for (var g = 0; g < 8; g++) {
      reserved[8][size - 1 - g] = 1; m[8][size - 1 - g] = 0;
      reserved[size - 1 - g][8] = 1; m[size - 1 - g][8] = 0;
    }
    m[size - 8][8] = 1; reserved[size - 8][8] = 1;   // always-dark module

    // version information (versions 7+)
    if (version >= 7) {
      var poly = version << 12;
      for (var v = 0; v < 6; v++) {
        if (poly & (1 << (17 - v))) poly ^= 0x1F25 << (5 - v);
      }
      var vinfo = (version << 12) | (poly & 0xFFF);
      for (var bit = 0; bit < 18; bit++) {
        var val = (vinfo >> bit) & 1;
        var row = Math.floor(bit / 3), col = bit % 3;
        m[row][size - 11 + col] = val; reserved[row][size - 11 + col] = 1;
        m[size - 11 + col][row] = val; reserved[size - 11 + col][row] = 1;
      }
    }

    return { m: m, reserved: reserved, size: size };
  }

  function placeData(grid, codewords) {
    var m = grid.m, reserved = grid.reserved, size = grid.size;
    var bitIndex = 0, total = codewords.length * 8;
    var upward = true;

    for (var col = size - 1; col > 0; col -= 2) {
      if (col === 6) col--;                       // the vertical timing column is skipped
      for (var step = 0; step < size; step++) {
        var row = upward ? size - 1 - step : step;
        for (var pair = 0; pair < 2; pair++) {
          var c = col - pair;
          if (reserved[row][c]) continue;
          var bit = 0;
          if (bitIndex < total) {
            bit = (codewords[bitIndex >> 3] >> (7 - (bitIndex & 7))) & 1;
          }
          m[row][c] = bit;
          bitIndex++;
        }
      }
      upward = !upward;
    }
  }

  function maskFn(id, r, c) {
    switch (id) {
      case 0: return (r + c) % 2 === 0;
      case 1: return r % 2 === 0;
      case 2: return c % 3 === 0;
      case 3: return (r + c) % 3 === 0;
      case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
      case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
      case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
      default: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
    }
  }

  function penalty(m, size) {
    var score = 0, r, c, run;

    for (r = 0; r < size; r++) {
      run = 1;
      for (c = 1; c < size; c++) {
        if (m[r][c] === m[r][c - 1]) run++;
        else { if (run >= 5) score += run - 2; run = 1; }
      }
      if (run >= 5) score += run - 2;
    }
    for (c = 0; c < size; c++) {
      run = 1;
      for (r = 1; r < size; r++) {
        if (m[r][c] === m[r - 1][c]) run++;
        else { if (run >= 5) score += run - 2; run = 1; }
      }
      if (run >= 5) score += run - 2;
    }

    for (r = 0; r < size - 1; r++) {
      for (c = 0; c < size - 1; c++) {
        var v = m[r][c];
        if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) score += 3;
      }
    }

    var patA = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
    var patB = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
    function run11(get, start, pat) {
      for (var k = 0; k < 11; k++) if (get(start + k) !== pat[k]) return false;
      return true;
    }
    for (r = 0; r < size; r++) {
      for (c = 0; c <= size - 11; c++) {
        var getRow = (function (row) { return function (i) { return m[row][i]; }; })(r);
        if (run11(getRow, c, patA) || run11(getRow, c, patB)) score += 40;
      }
    }
    for (c = 0; c < size; c++) {
      for (r = 0; r <= size - 11; r++) {
        var getCol = (function (col) { return function (i) { return m[i][col]; }; })(c);
        if (run11(getCol, r, patA) || run11(getCol, r, patB)) score += 40;
      }
    }

    var dark = 0;
    for (r = 0; r < size; r++) for (c = 0; c < size; c++) dark += m[r][c];
    var percent = (dark * 100) / (size * size);
    score += Math.floor(Math.abs(percent - 50) / 5) * 10;
    return score;
  }

  function formatBits(mask) {
    var data = (0 << 3) | mask;          // ECC level M is 0b00
    var rem = data << 10;
    for (var i = 4; i >= 0; i--) {
      if (rem & (1 << (i + 10))) rem ^= 0x537 << i;
    }
    return ((data << 10) | (rem & 0x3FF)) ^ 0x5412;
  }

  /* The 15 format bits are written most-significant first. Copy 1 runs left to
     right along row 8 (skipping the timing column) and then up column 8; copy 2
     runs up column 8 from the bottom and then left to right along row 8. Both
     copies must read back identical - that is the check that caught this. */
  function applyFormat(m, size, mask) {
    var bits = formatBits(mask);
    for (var i = 0; i < 15; i++) {
      var bit = (bits >> (14 - i)) & 1;

      // copy 1
      if (i < 6) m[8][i] = bit;
      else if (i === 6) m[8][7] = bit;
      else if (i === 7) m[8][8] = bit;
      else if (i === 8) m[7][8] = bit;
      else m[14 - i][8] = bit;

      // copy 2
      if (i < 7) m[size - 1 - i][8] = bit;
      else m[8][size - 15 + i] = bit;
    }
  }

  function clone(m) {
    return m.map(function (row) { return row.slice(); });
  }

  function build(text) {
    var bytes = toBytes(text);
    var version = pickVersion(bytes.length);
    if (!version) throw new Error('Text too long for this QR encoder.');

    var codewords = buildCodewords(bytes, version);
    var grid = makeMatrix(version);
    placeData(grid, codewords);

    var best = null, bestScore = Infinity, bestMask = 0;
    for (var mask = 0; mask < 8; mask++) {
      var candidate = clone(grid.m);
      for (var r = 0; r < grid.size; r++) {
        for (var c = 0; c < grid.size; c++) {
          if (!grid.reserved[r][c] && maskFn(mask, r, c)) candidate[r][c] ^= 1;
        }
      }
      applyFormat(candidate, grid.size, mask);
      var score = penalty(candidate, grid.size);
      if (score < bestScore) { bestScore = score; best = candidate; bestMask = mask; }
    }
    return { modules: best, size: grid.size, version: version, mask: bestMask };
  }

  function svg(text, options) {
    var o = options || {};
    var quiet = o.quiet == null ? 4 : o.quiet;
    var dark = o.dark || '#1A1531';
    var light = o.light || '#FFFFFF';
    var qr = build(text);
    var dim = qr.size + quiet * 2;

    var path = '';
    for (var r = 0; r < qr.size; r++) {
      for (var c = 0; c < qr.size; c++) {
        if (qr.modules[r][c]) path += 'M' + (c + quiet) + ' ' + (r + quiet) + 'h1v1h-1z';
      }
    }
    return '<svg viewBox="0 0 ' + dim + ' ' + dim + '" xmlns="http://www.w3.org/2000/svg" ' +
      'shape-rendering="crispEdges" role="img" aria-label="QR code to join this MOKI game">' +
      '<rect width="' + dim + '" height="' + dim + '" fill="' + light + '" rx="1"/>' +
      '<path d="' + path + '" fill="' + dark + '"/></svg>';
  }

  window.MOKIQR = { svg: svg, build: build, _internals: {
    makeMatrix: makeMatrix, buildCodewords: buildCodewords, toBytes: toBytes,
    maskFn: maskFn, formatBits: formatBits, rsRemainder: rsRemainder
  } };
})();
