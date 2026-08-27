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
      case 'fierce':
        return '<g><g fill="#22203A"><circle cx="41" cy="41" r="4"/><circle cx="59" cy="41" r="4"/></g>' +
          '<g stroke="#22203A" stroke-width="3" stroke-linecap="round"><path d="M34 33l11 4"/><path d="M66 33l-11 4"/></g></g>';
      case 'heart':
        return '<g fill="#FF4D8D">' +
          '<path d="M41 45c-6-4-8-7-8-10a4 4 0 0 1 8-2 4 4 0 0 1 8 2c0 3-2 6-8 10z"/>' +
          '<path d="M59 45c-6-4-8-7-8-10a4 4 0 0 1 8-2 4 4 0 0 1 8 2c0 3-2 6-8 10z"/></g>';
      case 'swirl':
        return '<g fill="none" stroke="#22203A" stroke-width="2.6" stroke-linecap="round">' +
          '<path d="M41 40m-6 0a6 6 0 1 0 12 0a6 6 0 1 0-12 0M41 40a3 3 0 0 1 3 3"/>' +
          '<path d="M59 40m-6 0a6 6 0 1 0 12 0a6 6 0 1 0-12 0M59 40a3 3 0 0 1 3 3"/></g>';
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
      case 'gasp':
        return '<ellipse cx="50" cy="53" rx="4.5" ry="6.5" fill="#5B2233"/>';
      case 'kitty':
        return '<g fill="none" stroke="#22203A" stroke-width="2.8" stroke-linecap="round">' +
          '<path d="M43 50q3.5 4 7 0"/><path d="M50 50q3.5 4 7 0"/></g>';
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
      case 'flower':
        return '<g><g fill="' + color + '" transform="translate(70 18)">' +
          '<circle cx="0" cy="-6" r="5"/><circle cx="6" cy="0" r="5"/><circle cx="0" cy="6" r="5"/><circle cx="-6" cy="0" r="5"/>' +
          '<circle cx="0" cy="0" r="4" fill="#FDE68A"/></g>' +
          '<path d="M30 28q20-16 40 0" fill="none" stroke="#4ADE80" stroke-width="3"/></g>';
      case 'halo':
        return '<ellipse cx="50" cy="8" rx="17" ry="5" fill="none" stroke="' + color + '" stroke-width="4"/>';
      case 'horns':
        return '<g fill="' + color + '"><path d="M33 20q-6-10 2-14 2 7 7 10z"/><path d="M67 20q6-10-2-14-2 7-7 10z"/></g>';
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
      case 'bowtie':
        return '<g fill="#EF4444" transform="translate(50 60)">' +
          '<path d="M0 0l-11-6v12z"/><path d="M0 0l11-6v12z"/><circle cx="0" cy="0" r="3.2" fill="#B91C1C"/></g>';
      case 'mask':
        return '<path d="M28 34h44v9a10 10 0 0 1-10 8h-4l-8-5-8 5h-4a10 10 0 0 1-10-8z" fill="#4F46E5" opacity=".92"/>';
      case 'monocle':
        return '<g fill="none" stroke="#B8860B" stroke-width="2.4">' +
          '<circle cx="59" cy="40" r="9"/><path d="M59 49v9"/></g>';
      default:
        return '';
    }
  }

  /* Aura: a glow / particle layer drawn behind the character. The individual
     particles are animated in CSS so this stays a plain string. */
  function aura(id, color) {
    switch (id) {
      case 'glow':
        return '<circle class="mk-aura-glow" cx="50" cy="62" r="46" fill="' + color + '" opacity=".28"/>';
      case 'sparkle':
        return '<g class="mk-aura-parts" fill="' + color + '">' +
          '<path class="mk-p1" d="M14 30l2.2 4.6 4.6 2.2-4.6 2.2L14 43.6l-2.2-4.6L7.2 36.8l4.6-2.2z"/>' +
          '<path class="mk-p2" d="M86 46l1.8 3.8 3.8 1.8-3.8 1.8L86 57.2l-1.8-3.8-3.8-1.8 3.8-1.8z"/>' +
          '<path class="mk-p3" d="M78 16l1.6 3.4 3.4 1.6-3.4 1.6L78 26.6l-1.6-3.4-3.4-1.6 3.4-1.6z"/></g>';
      case 'bubbles':
        return '<g class="mk-aura-parts" fill="none" stroke="' + color + '" stroke-width="2.4">' +
          '<circle class="mk-p1" cx="16" cy="60" r="7"/><circle class="mk-p2" cx="84" cy="44" r="5"/>' +
          '<circle class="mk-p3" cx="80" cy="76" r="6"/></g>';
      case 'flames':
        return '<g class="mk-aura-parts" fill="' + color + '" opacity=".85">' +
          '<path class="mk-p1" d="M14 78c0-8 7-10 7-18 5 5 7 9 7 15a7 7 0 0 1-14 3z"/>' +
          '<path class="mk-p2" d="M86 78c0-8-7-10-7-18-5 5-7 9-7 15a7 7 0 0 0 14 3z"/></g>';
      case 'stars':
        return '<g class="mk-aura-parts" fill="' + color + '">' +
          '<circle class="mk-p1" cx="12" cy="40" r="3.4"/><circle class="mk-p2" cx="88" cy="34" r="2.8"/>' +
          '<circle class="mk-p3" cx="84" cy="70" r="3.2"/><circle class="mk-p1" cx="20" cy="86" r="2.4"/></g>';
      case 'rainbow':
        return '<g fill="none" stroke-width="5" opacity=".7">' +
          '<path d="M8 92a42 42 0 0 1 84 0" stroke="#F472B6"/>' +
          '<path d="M15 92a35 35 0 0 1 70 0" stroke="#FBBF24"/>' +
          '<path d="M22 92a28 28 0 0 1 56 0" stroke="#34D399"/>' +
          '<path d="M29 92a21 21 0 0 1 42 0" stroke="#60A5FA"/></g>';
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
    var auraDef = get('aura', c.aura);
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
      '<g class="mk-aura">' + aura(c.aura, auraDef.c || '#FFD86B') + '</g>' +
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
