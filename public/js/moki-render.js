/* MOKI character renderer - layered inline SVG, no images, no libraries. */
(function () {
  'use strict';
  var C = window.MOKI_CATALOG;

  function get(part, id) {
    var list = C[part] || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return list[0] || {};
  }

  function defaults() {
    var cfg = {};
    Object.keys(C).forEach(function (p) { cfg[p] = C[p][0].id; });
    return cfg;
  }

  function randomConfig(maxLevel) {
    var lvl = maxLevel == null ? 99 : maxLevel;
    var cfg = {};
    Object.keys(C).forEach(function (p) {
      var pool = C[p].filter(function (o) { return (o.lvl || 0) <= lvl; });
      cfg[p] = pool[Math.floor(Math.random() * pool.length)].id;
    });
    return cfg;
  }

  function sanitize(cfg) {
    var out = {};
    Object.keys(C).forEach(function (p) {
      out[p] = get(p, cfg && cfg[p]).id;
    });
    return out;
  }

  function hair(styleId, color, skin) {
    switch (styleId) {
      case 'short':
        return '<path d="M28 36c0-13 10-21 22-21s22 8 22 21c0-8-9-11-22-11s-22 3-22 11z" fill="' + color + '"/>';
      case 'puff':
        return '<g fill="' + color + '"><circle cx="34" cy="22" r="11"/><circle cx="50" cy="16" r="12"/><circle cx="66" cy="22" r="11"/></g>';
      case 'long':
        return '<g fill="' + color + '"><path d="M27 34c0-14 10-22 23-22s23 8 23 22v34c0 3-9 3-9 0V38c0-6-6-9-14-9s-14 3-14 9v30c0 3-9 3-9 0z"/></g>';
      case 'spiky':
        return '<path d="M27 36 34 18l6 12 6-16 6 16 6-12 7 18z" fill="' + color + '"/>';
      case 'bun':
        return '<g fill="' + color + '"><circle cx="50" cy="11" r="9"/><path d="M28 36c0-13 10-21 22-21s22 8 22 21c0-8-9-11-22-11s-22 3-22 11z"/></g>';
      case 'curls':
        return '<g fill="' + color + '"><circle cx="31" cy="30" r="9"/><circle cx="41" cy="20" r="10"/><circle cx="55" cy="18" r="11"/><circle cx="68" cy="29" r="9"/></g>';
      case 'mohawk':
        return '<g fill="' + color + '"><path d="M44 34c0-16 3-26 6-26s6 10 6 26z"/><rect x="30" y="30" width="40" height="6" rx="3" opacity=".5"/></g>';
      default:
        return '';
    }
  }

  function eyes(id) {
    switch (id) {
      case 'big':
        return '<g><circle cx="41" cy="40" r="7" fill="#fff"/><circle cx="59" cy="40" r="7" fill="#fff"/>' +
          '<circle cx="42" cy="41" r="3.6" fill="#22203A"/><circle cx="60" cy="41" r="3.6" fill="#22203A"/>' +
          '<circle cx="40.5" cy="38.5" r="1.4" fill="#fff"/><circle cx="58.5" cy="38.5" r="1.4" fill="#fff"/></g>';
      case 'happy':
        return '<g fill="none" stroke="#22203A" stroke-width="3" stroke-linecap="round">' +
          '<path d="M36 42q5-7 10 0"/><path d="M54 42q5-7 10 0"/></g>';
      case 'sleepy':
        return '<g fill="none" stroke="#22203A" stroke-width="3" stroke-linecap="round">' +
          '<path d="M36 41h9"/><path d="M55 41h9"/></g>';
      case 'wink':
        return '<g><circle cx="41" cy="40" r="4" fill="#22203A"/>' +
          '<path d="M54 41q5-6 10 0" fill="none" stroke="#22203A" stroke-width="3" stroke-linecap="round"/></g>';
      case 'star':
        return '<g fill="#FFC93C" stroke="#22203A" stroke-width="1.2">' +
          '<path d="M41 33l2.3 4.9 5.2.7-3.8 3.7.9 5.2-4.6-2.5-4.6 2.5.9-5.2-3.8-3.7 5.2-.7z"/>' +
          '<path d="M59 33l2.3 4.9 5.2.7-3.8 3.7.9 5.2-4.6-2.5-4.6 2.5.9-5.2-3.8-3.7 5.2-.7z"/></g>';
      default:
        return '<g fill="#22203A"><circle cx="41" cy="40" r="4"/><circle cx="59" cy="40" r="4"/></g>';
    }
  }

  function mouth(id) {
    switch (id) {
      case 'grin':
        return '<g><path d="M39 49h22a11 11 0 0 1-22 0z" fill="#5B2233"/><rect x="39" y="49" width="22" height="4" fill="#fff"/></g>';
      case 'oh':
        return '<ellipse cx="50" cy="52" rx="6" ry="7" fill="#5B2233"/>';
      case 'smirk':
        return '<path d="M43 51q7 5 13-2" fill="none" stroke="#22203A" stroke-width="3" stroke-linecap="round"/>';
      case 'tongue':
        return '<g><path d="M39 49h22a11 11 0 0 1-22 0z" fill="#5B2233"/><ellipse cx="50" cy="57" rx="6" ry="4.5" fill="#FF7AA2"/></g>';
      case 'fang':
        return '<g><path d="M40 49h20a10 10 0 0 1-20 0z" fill="#5B2233"/><path d="M44 49l3 6 3-6z" fill="#fff"/></g>';
      default:
        return '<path d="M42 50q8 8 16 0" fill="none" stroke="#22203A" stroke-width="3" stroke-linecap="round"/>';
    }
  }

  function outfitDeco(deco) {
    switch (deco) {
      case 'stripe':
        return '<g fill="#ffffff" opacity=".65"><rect x="30" y="66" width="40" height="4"/><rect x="30" y="76" width="40" height="4"/></g>';
      case 'hood':
        return '<path d="M34 60q16 10 32 0v-4H34z" fill="#000" opacity=".18"/>';
      case 'star':
        return '<path d="M50 66l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2-4.5-4.4 6.2-.9z" fill="#FFF06B"/>';
      case 'strap':
        return '<g fill="#1E3A8A"><rect x="37" y="58" width="5" height="14" rx="2"/><rect x="58" y="58" width="5" height="14" rx="2"/></g>';
      case 'space':
        return '<g><circle cx="50" cy="74" r="7" fill="#38BDF8" opacity=".8"/><rect x="30" y="62" width="40" height="4" fill="#94A3B8"/></g>';
      default:
        return '';
    }
  }

  function hat(id, color) {
    switch (id) {
      case 'cap':
        return '<g fill="' + color + '"><path d="M28 26q22-18 44 0z"/><rect x="26" y="24" width="34" height="6" rx="3"/></g>';
      case 'beanie':
        return '<g fill="' + color + '"><path d="M29 27q21-19 42 0z"/><rect x="27" y="25" width="46" height="7" rx="3.5"/></g>';
      case 'party':
        return '<g><path d="M50 2l12 24H38z" fill="' + color + '"/><circle cx="50" cy="3" r="4" fill="#FFF06B"/></g>';
      case 'crown':
        return '<g fill="' + color + '"><path d="M31 26V10l9 7 10-11 10 11 9-7v16z"/><circle cx="50" cy="16" r="3" fill="#EF4444"/></g>';
      case 'wizard':
        return '<g><path d="M50 -4l16 32H34z" fill="' + color + '"/><rect x="28" y="26" width="44" height="6" rx="3" fill="' + color + '"/><circle cx="52" cy="14" r="2.6" fill="#FDE68A"/></g>';
      case 'helmet':
        return '<g><path d="M26 34a24 24 0 0 1 48 0z" fill="' + color + '" opacity=".55"/><rect x="24" y="32" width="52" height="6" rx="3" fill="#64748B"/></g>';
      default:
        return '';
    }
  }

  function accessory(id) {
    switch (id) {
      case 'glasses':
        return '<g fill="none" stroke="#22203A" stroke-width="2.4"><circle cx="41" cy="40" r="8"/><circle cx="59" cy="40" r="8"/><path d="M49 40h2"/></g>';
      case 'shades':
        return '<g fill="#22203A"><rect x="32" y="34" width="16" height="11" rx="4"/><rect x="52" y="34" width="16" height="11" rx="4"/><rect x="47" y="38" width="6" height="3"/></g>';
      case 'blush':
        return '<g fill="#FF7AA2" opacity=".55"><ellipse cx="33" cy="48" rx="5" ry="3.4"/><ellipse cx="67" cy="48" rx="5" ry="3.4"/></g>';
      case 'freckle':
        return '<g fill="#8A5A3B" opacity=".7"><circle cx="35" cy="47" r="1.3"/><circle cx="39" cy="50" r="1.3"/><circle cx="61" cy="47" r="1.3"/><circle cx="65" cy="50" r="1.3"/></g>';
      case 'scarf':
        return '<g fill="#EF4444"><rect x="34" y="55" width="32" height="7" rx="3.5"/><rect x="58" y="58" width="7" height="14" rx="3"/></g>';
      case 'headset':
        return '<g><path d="M30 38a20 20 0 0 1 40 0" fill="none" stroke="#334155" stroke-width="4"/>' +
          '<rect x="24" y="36" width="9" height="14" rx="4" fill="#334155"/>' +
          '<rect x="67" y="36" width="9" height="14" rx="4" fill="#334155"/>' +
          '<path d="M28 50q-4 8 6 9" fill="none" stroke="#334155" stroke-width="3"/></g>';
      default:
        return '';
    }
  }

  /* Returns an SVG string. mood: idle | correct | wrong | win */
  function svg(cfg, opts) {
    var o = opts || {};
    var c = sanitize(cfg);
    var skin = get('skin', c.skin).c;
    var hairC = get('hairColor', c.hairColor).c;
    var fit = get('outfit', c.outfit);
    var pantsC = get('pants', c.pants).c;
    var shoeC = get('shoes', c.shoes).c;
    var hatDef = get('hat', c.hat);
    var mood = o.mood || 'idle';

    var body =
      '<g class="mk-arms">' +
        '<ellipse cx="26" cy="72" rx="6" ry="10" fill="' + skin + '"/>' +
        '<ellipse cx="74" cy="72" rx="6" ry="10" fill="' + skin + '"/>' +
      '</g>' +
      '<g class="mk-legs">' +
        '<rect x="33" y="86" width="12" height="16" rx="5" fill="' + pantsC + '"/>' +
        '<rect x="55" y="86" width="12" height="16" rx="5" fill="' + pantsC + '"/>' +
        '<ellipse cx="39" cy="105" rx="9" ry="5.5" fill="' + shoeC + '"/>' +
        '<ellipse cx="61" cy="105" rx="9" ry="5.5" fill="' + shoeC + '"/>' +
      '</g>' +
      '<rect x="30" y="56" width="40" height="34" rx="13" fill="' + fit.c + '"/>' +
      outfitDeco(fit.deco);

    var head =
      '<g class="mk-head">' +
        '<circle cx="50" cy="40" r="24" fill="' + skin + '"/>' +
        '<ellipse cx="26" cy="42" rx="4" ry="6" fill="' + skin + '"/>' +
        '<ellipse cx="74" cy="42" rx="4" ry="6" fill="' + skin + '"/>' +
        hair(c.hair, hairC, skin) +
        eyes(c.eyes) +
        mouth(c.mouth) +
        accessory(c.accessory) +
        hat(c.hat, hatDef.c || '#EF4444') +
      '</g>';

    return '<svg class="moki moki--' + mood + '" viewBox="0 0 100 112" ' +
      'role="img" aria-label="MOKI character" focusable="false">' +
      '<ellipse class="mk-shadow" cx="50" cy="108" rx="24" ry="4" fill="rgba(0,0,0,.18)"/>' +
      '<g class="mk-body">' + body + head + '</g>' +
      '</svg>';
  }

  function el(cfg, opts) {
    var d = document.createElement('div');
    d.className = 'moki-wrap';
    d.innerHTML = svg(cfg, opts);
    return d;
  }

  function unlocked(part, level) {
    return (C[part] || []).map(function (o) {
      return { id: o.id, name: o.name, c: o.c, lvl: o.lvl || 0, locked: (o.lvl || 0) > level };
    });
  }

  window.MOKI = {
    svg: svg, el: el, defaults: defaults, randomConfig: randomConfig,
    sanitize: sanitize, get: get, unlocked: unlocked, catalog: C
  };
})();
