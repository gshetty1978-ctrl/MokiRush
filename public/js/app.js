/* MOKI client - screens, creator, customizer, socket play. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var socket = io();
  var SHAPES = ['▲', '◆', '●', '■'];

  /* ---------------- profile (local, cosmetic only) ---------------- */
  var DEFAULT_PROFILE = {
    name: '', moki: MOKI.defaults(), xp: 0,
    games: 0, wins: 0, correct: 0, answered: 0, sound: true
  };
  var profile = load();

  function load() {
    try {
      var raw = JSON.parse(localStorage.getItem('moki.profile') || '{}');
      var p = Object.assign({}, DEFAULT_PROFILE, raw);
      p.moki = MOKI.sanitize(p.moki);
      return p;
    } catch (e) { return Object.assign({}, DEFAULT_PROFILE); }
  }
  function save() {
    try { localStorage.setItem('moki.profile', JSON.stringify(profile)); } catch (e) {}
  }
  function xpForLevel(l) { return 120 * l + 40 * l * l; }  // cumulative-ish curve
  function levelOf(xp) {
    var l = 1;
    while (xp >= xpForLevel(l) && l < 60) l++;
    return l;
  }
  function levelProgress(xp) {
    var l = levelOf(xp);
    var prev = l === 1 ? 0 : xpForLevel(l - 1);
    var next = xpForLevel(l);
    return Math.max(0, Math.min(100, ((xp - prev) / (next - prev)) * 100));
  }

  /* ---------------- sound ---------------- */
  var actx = null;
  function beep(freq, dur, type, vol) {
    if (!profile.sound) return;
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      var o = actx.createOscillator(), g = actx.createGain();
      o.type = type || 'triangle';
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.09, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + (dur || 0.15));
      o.connect(g); g.connect(actx.destination);
      o.start(); o.stop(actx.currentTime + (dur || 0.15));
    } catch (e) {}
  }
  /* A tiny synthesized music bed - no audio files, still works offline. */
  var music = { nodes: null, timer: null };
  function stopMusic() {
    if (music.timer) { clearInterval(music.timer); music.timer = null; }
    if (music.nodes) {
      try { music.nodes.gain.gain.setTargetAtTime(0, actx.currentTime, 0.1); } catch (e) {}
      setTimeout(function (n) { try { n.osc.stop(); } catch (e) {} }, 400, music.nodes);
      music.nodes = null;
    }
  }
  function startMusic(kind) {
    if (!profile.sound) return;
    stopMusic();
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      var gain = actx.createGain();
      gain.gain.value = 0.0001;
      gain.connect(actx.destination);
      gain.gain.setTargetAtTime(kind === 'tense' ? 0.05 : 0.035, actx.currentTime, 0.4);
      var osc = actx.createOscillator();
      osc.type = kind === 'tense' ? 'sawtooth' : 'triangle';
      var filter = actx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = kind === 'tense' ? 900 : 600;
      osc.connect(filter); filter.connect(gain);
      osc.start();
      music.nodes = { osc: osc, gain: gain };

      // a simple repeating bass figure
      var lobby = [130.81, 164.81, 196.00, 164.81];
      var tense = [110.00, 110.00, 138.59, 146.83];
      var seq = kind === 'tense' ? tense : lobby;
      var step = 0;
      var beat = kind === 'tense' ? 300 : 520;
      osc.frequency.setValueAtTime(seq[0], actx.currentTime);
      music.timer = setInterval(function () {
        step = (step + 1) % seq.length;
        try { osc.frequency.setTargetAtTime(seq[step], actx.currentTime, 0.03); } catch (e) {}
      }, beat);
    } catch (e) {}
  }

  var SFX = {
    tap: function () { beep(520, 0.08, 'square', 0.05); },
    tick: function () { beep(880, 0.06, 'sine', 0.04); },
    good: function () { beep(660, 0.12); setTimeout(function () { beep(990, 0.18); }, 110); },
    bad: function () { beep(200, 0.22, 'sawtooth', 0.06); },
    win: function () { [523, 659, 784, 1046].forEach(function (f, i) { setTimeout(function () { beep(f, 0.22); }, i * 130); }); },
    join: function () { beep(700, 0.1); },
    lock: function () { beep(440, 0.09, 'square', 0.05); setTimeout(function () { beep(660, 0.1, 'square', 0.05); }, 70); },
    reveal: function () { beep(330, 0.16, 'triangle', 0.07); },
    levelup: function () {
      [523, 659, 784, 1046, 1318].forEach(function (f, i) {
        setTimeout(function () { beep(f, 0.26, 'triangle', 0.1); }, i * 120);
      });
    }
  };

  /* ---------------- screens ---------------- */
  var SCREEN_TITLES = {
    home: 'MOKI - Live Multiplayer Quiz Party',
    quick: 'Quick Play - MOKI',
    solosetup: 'Play Alone - MOKI',
    create: 'Quiz Builder - MOKI',
    join: 'Join a Game - MOKI',
    customize: 'My MOKI - MOKI',
    profile: 'Profile - MOKI',
    hostlobby: 'Host Lobby - MOKI',
    playerlobby: 'Lobby - MOKI',
    question: 'Question - MOKI',
    reveal: 'Results - MOKI',
    final: 'Final Results - MOKI'
  };
  var current = 'home';
  function show(name) {
    var el = $('s-' + name);
    if (!el) return;
    // only the live screen is exposed to screen readers / tab order
    document.querySelectorAll('.screen').forEach(function (sc) {
      sc.classList.remove('active');
      sc.setAttribute('aria-hidden', 'true');
      sc.hidden = true;
      if ('inert' in sc) sc.inert = true;
    });
    el.classList.add('active');
    el.removeAttribute('aria-hidden');
    el.hidden = false;
    if ('inert' in el) el.inert = false;
    document.title = SCREEN_TITLES[name] || 'MOKI - Live Multiplayer Quiz Party';
    current = name;
    window.scrollTo(0, 0);
    if (name === 'home') paintHome();
    if (name === 'profile') paintProfile();
    if (name === 'customize') paintCustomizer();
    if (name === 'create') { paintTopics(); renderQList(); }
    if (name === 'quick') {
      buildSetup('quick');
      var modes = $('quickMode');
      if (modes && !modes.dataset.wired) {
        modes.dataset.wired = '1';
        modes.querySelectorAll('button').forEach(function (b) {
          b.onclick = function () {
            teamState.wanted = b.getAttribute('data-teams') === '1';
            modes.querySelectorAll('button').forEach(function (x) { x.classList.remove('on'); });
            b.classList.add('on');
            SFX.tap();
          };
        });
      }
    }
    if (name === 'solosetup') buildSetup('solo');
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-go]');
    if (!t) return;
    SFX.tap();
    var dest = t.getAttribute('data-go');
    if (dest === 'home') leaveGame();
    show(dest);
  });

  function toast(msg) {
    var d = document.createElement('div');
    d.className = 'toast';
    d.textContent = msg;
    document.body.appendChild(d);
    setTimeout(function () { d.remove(); }, 2600);
  }
  function msgBox(hostId, text, good) {
    var box = $(hostId);
    box.innerHTML = '';
    if (!text) return;
    var d = document.createElement('div');
    d.className = good ? 'ok' : 'err';
    d.textContent = text;
    box.appendChild(d);
  }
  function mokiInto(node, cfg, mood) {
    if (!node) return;
    node.innerHTML = MOKI.svg(cfg, { mood: mood || 'idle' });
  }

  /* ---------------- home ---------------- */
  var GREETINGS = [
    "Hi, I'm your MOKI!", 'Ready to play?', 'Quiz me on anything!',
    'Who is fastest today?', 'Make me a hat!', "Let's gooo!"
  ];
  function paintHome() {
    mokiInto($('homeMoki'), profile.moki, 'wave');
    var sp = $('heroSpeech');
    if (sp) sp.textContent = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
    $('homeName').textContent = profile.name || 'New player';
    $('homeLevel').textContent = levelOf(profile.xp);
    $('homeXp').style.width = levelProgress(profile.xp) + '%';
    $('btnSound').textContent = profile.sound ? '🔊 Sound: on' : '🔇 Sound: off';
  }
  $('btnSound').onclick = function () {
    profile.sound = !profile.sound; save(); paintHome();
    if (profile.sound) SFX.tap(); else stopMusic();
  };

  /* ---------------- profile ---------------- */
  function paintProfile() {
    mokiInto($('profMoki'), profile.moki, 'idle');
    $('profName').textContent = profile.name || 'New player';
    $('profLevel').textContent = levelOf(profile.xp);
    $('profXpText').textContent = profile.xp + ' XP · next level at ' + xpForLevel(levelOf(profile.xp)) + ' XP';
    $('profXp').style.width = levelProgress(profile.xp) + '%';
    $('stGames').textContent = profile.games;
    $('stWins').textContent = profile.wins;
    $('stCorrect').textContent = profile.correct;
    $('stAcc').textContent = (profile.answered ? Math.round(profile.correct / profile.answered * 100) : 0) + '%';

    var lvl = levelOf(profile.xp);
    var host = $('unlockList');
    host.innerHTML = '';
    Object.keys(MOKI.catalog).forEach(function (part) {
      var items = MOKI.unlocked(part, lvl);
      var card = document.createElement('div');
      card.className = 'card';
      var open = items.filter(function (i) { return !i.locked; }).length;
      card.innerHTML = '<div class="spread"><b style="font-size:18px">' + partLabel(part) +
        '</b><span class="hint">' + open + ' / ' + items.length + ' unlocked</span></div>';
      var grid = document.createElement('div');
      grid.className = 'opts';
      grid.style.marginTop = '10px';
      items.forEach(function (i) {
        var d = document.createElement('div');
        d.className = 'opt' + (i.locked ? ' locked' : '');
        d.innerHTML = (i.c ? '<span class="sw" style="background:' + i.c + '"></span>' : '<span class="sw" style="background:#EEE9FF"></span>') +
          esc(i.name) + (i.locked ? '<span class="lock">🔒 L' + i.lvl + '</span>' : '');
        grid.appendChild(d);
      });
      card.appendChild(grid);
      host.appendChild(card);
    });
  }
  $('btnReset').onclick = function () {
    if (!confirm('Reset your MOKI profile, XP and unlocks?')) return;
    profile = Object.assign({}, DEFAULT_PROFILE, { moki: MOKI.defaults() });
    save(); paintProfile(); toast('Profile reset');
  };

  function partLabel(p) {
    return ({
      species: 'Creature', skin: 'Skin', hair: 'Hair style', hairColor: 'Hair colour', eyes: 'Eyes', mouth: 'Mouth',
      outfit: 'Outfit', pants: 'Pants', shoes: 'Shoes', hat: 'Hats', accessory: 'Accessories',
      aura: 'Aura ✨'
    })[p] || p;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------------- customizer ---------------- */
  var activePart = 'species';
  var draft = null;
  var custReturn = 'home';

  function paintCustomizer() {
    draft = draft || MOKI.sanitize(profile.moki);
    $('custName').value = profile.name || '';
    $('custLevel').textContent = levelOf(profile.xp);
    $('custXp').style.width = levelProgress(profile.xp) + '%';

    var tabs = $('partTabs');
    tabs.innerHTML = '';
    Object.keys(MOKI.catalog).forEach(function (p) {
      var b = document.createElement('button');
      b.className = 'tab' + (p === activePart ? ' on' : '');
      b.textContent = partLabel(p);
      b.onclick = function () { activePart = p; SFX.tap(); paintCustomizer(); };
      tabs.appendChild(b);
    });
    paintOpts();
    mokiInto($('custPreview'), draft, 'idle');
  }
  function paintOpts() {
    var lvl = levelOf(profile.xp);
    var host = $('partOpts');
    host.innerHTML = '';
    MOKI.unlocked(activePart, lvl).forEach(function (o) {
      var b = document.createElement('button');
      b.className = 'opt' + (draft[activePart] === o.id ? ' on' : '') + (o.locked ? ' locked' : '');
      b.type = 'button';
      b.innerHTML = '<span class="sw" style="background:' + (o.c || '#EEE9FF') + '"></span>' + esc(o.name) +
        (o.locked ? '<span class="lock">🔒 L' + o.lvl + '</span>' : '');
      b.onclick = function () {
        if (o.locked) { toast('Unlocks at level ' + o.lvl); SFX.bad(); return; }
        draft[activePart] = o.id;
        SFX.tap();
        profile.moki = MOKI.sanitize(draft);
        save();
        paintOpts();
        mokiInto($('custPreview'), draft, 'idle');
        if (me.playerId) socket.emit('player:moki', { moki: profile.moki });
      };
      host.appendChild(b);
    });
  }
  /* The big preview turns to follow the pointer, which is the clearest way to
     show the character is actually a solid object. */
  (function wirePreviewDrag() {
    var host = $('custPreview');
    if (!host) return;
    function aim(e) {
      var box = host.getBoundingClientRect();
      var p = e.touches ? e.touches[0] : e;
      var dx = (p.clientX - (box.left + box.width / 2)) / (box.width / 2);
      var dy = (p.clientY - (box.top + box.height / 2)) / (box.height / 2);
      var scene = host.querySelector('.mk-scene');
      var moki = host.querySelector('.moki3d');
      if (!scene || !moki) return;
      moki.classList.add('mk-interactive');
      scene.style.setProperty('--turn', Math.max(-38, Math.min(38, dx * 38)) + 'deg');
      scene.style.setProperty('--tilt', Math.max(-16, Math.min(16, -dy * 16)) + 'deg');
    }
    function release() {
      var scene = host.querySelector('.mk-scene');
      var moki = host.querySelector('.moki3d');
      if (scene) { scene.style.removeProperty('--turn'); scene.style.removeProperty('--tilt'); }
      if (moki) moki.classList.remove('mk-interactive');
    }
    host.addEventListener('pointermove', aim);
    host.addEventListener('pointerleave', release);
    host.addEventListener('touchmove', aim, { passive: true });
    host.addEventListener('touchend', release);
  })();

  $('btnRandom').onclick = function () {
    draft = MOKI.randomConfig(levelOf(profile.xp));
    profile.moki = MOKI.sanitize(draft); save();
    SFX.join(); paintCustomizer();
    if (me.playerId) socket.emit('player:moki', { moki: profile.moki });
  };
  $('custName').oninput = function () {
    profile.name = this.value.slice(0, 14); save();
  };
  $('custBack').onclick = function () { SFX.tap(); show(custReturn); };
  document.querySelectorAll('[data-mood]').forEach(function (b) {
    b.onclick = function () {
      var m = b.getAttribute('data-mood');
      mokiInto($('custPreview'), draft, m);
      if (m === 'win') SFX.win(); else if (m === 'correct') SFX.good(); else SFX.bad();
      setTimeout(function () { if (current === 'customize') mokiInto($('custPreview'), draft, 'idle'); }, 2400);
    };
  });
  document.querySelectorAll('[data-go="customize"]').forEach(function (b) {
    b.addEventListener('click', function () { custReturn = current === 'customize' ? 'home' : current; });
  });

  /* ---------------- quiz creator ---------------- */
  var quiz = loadQuiz();
  function loadQuiz() {
    try {
      var q = JSON.parse(localStorage.getItem('moki.quiz') || 'null');
      if (q && Array.isArray(q.questions)) return q;
    } catch (e) {}
    return { title: '', topic: '', questions: [] };
  }
  function saveQuiz() {
    quiz.title = $('qzTitle').value;
    quiz.topic = $('qzTopic').value;
    try { localStorage.setItem('moki.quiz', JSON.stringify(quiz)); } catch (e) {}
  }
  function blankQ() {
    return { text: '', answers: ['', '', '', ''], correct: 0, time: 20, image: '' };
  }
  function paintTopics() {
    $('qzTitle').value = quiz.title || '';
    $('qzTopic').value = quiz.topic || '';
    if ($('topicList').childElementCount) return;
    fetch('/api/topics').then(function (r) { return r.json(); }).then(function (list) {
      var dl = $('topicList');
      list.forEach(function (t) {
        var o = document.createElement('option');
        o.value = t.charAt(0).toUpperCase() + t.slice(1);
        dl.appendChild(o);
      });
    }).catch(function () {});
  }

  function renderQList() {
    var host = $('qList');
    host.innerHTML = '';
    if (!quiz.questions.length) {
      host.innerHTML = '<div class="card center"><b>No questions yet.</b><p class="hint">' +
        'Add one manually, or let MOKI Spark suggest a set for your topic.</p></div>';
      return;
    }
    quiz.questions.forEach(function (q, i) {
      host.appendChild(qCard(q, i));
    });
  }

  function qCard(q, i) {
    var card = document.createElement('div');
    card.className = 'qcard';

    var head = document.createElement('div');
    head.className = 'head';
    head.innerHTML = '<span class="idx">Q' + (i + 1) + '</span>' +
      '<span class="ttl">' + esc(q.text || 'Untitled question') + '</span>';

    var mk = function (label, title, fn) {
      var b = document.createElement('button');
      b.className = 'icon-btn';
      b.textContent = label;
      b.title = title;
      b.setAttribute('aria-label', title);
      b.onclick = fn;
      return b;
    };
    head.appendChild(mk('↑', 'Move up', function () { move(i, -1); }));
    head.appendChild(mk('↓', 'Move down', function () { move(i, 1); }));
    head.appendChild(mk('⧉', 'Duplicate question', function () {
      var copy = JSON.parse(JSON.stringify(q));
      quiz.questions.splice(i + 1, 0, copy);
      saveQuiz(); renderQList();
    }));
    head.appendChild(mk('🗑', 'Delete question', function () {
      quiz.questions.splice(i, 1); saveQuiz(); renderQList();
    }));
    card.appendChild(head);

    var qt = document.createElement('input');
    qt.maxLength = 200;
    qt.placeholder = 'Question text';
    qt.value = q.text;
    qt.oninput = function () { q.text = qt.value; saveQuiz(); head.querySelector('.ttl').textContent = qt.value || 'Untitled question'; };
    card.appendChild(qt);

    var wrap = document.createElement('div');
    wrap.style.marginTop = '10px';
    q.answers.forEach(function (a, j) {
      var row = document.createElement('div');
      row.className = 'ansrow';
      var mark = document.createElement('button');
      mark.className = 'mark ans' + j + (q.correct === j ? ' on' : '');
      mark.textContent = SHAPES[j];
      mark.title = 'Mark answer ' + (j + 1) + ' correct';
      mark.onclick = function () {
        q.correct = j; saveQuiz();
        wrap.querySelectorAll('.mark').forEach(function (m, k) { m.classList.toggle('on', k === j); });
      };
      var inp = document.createElement('input');
      inp.maxLength = 100;
      inp.placeholder = 'Answer ' + (j + 1);
      inp.value = a;
      inp.oninput = function () { q.answers[j] = inp.value; saveQuiz(); };
      row.appendChild(mark); row.appendChild(inp);
      wrap.appendChild(row);
    });
    card.appendChild(wrap);

    var two = document.createElement('div');
    two.className = 'two';
    var timeWrap = document.createElement('div');
    timeWrap.innerHTML = '<label>Timer (seconds)</label>';
    var time = document.createElement('select');
    [5, 10, 15, 20, 30, 45, 60, 90, 120].forEach(function (t) {
      var o = document.createElement('option');
      o.value = t; o.textContent = t + 's';
      if (q.time === t) o.selected = true;
      time.appendChild(o);
    });
    time.onchange = function () { q.time = Number(time.value); saveQuiz(); };
    timeWrap.appendChild(time);

    var imgWrap = document.createElement('div');
    imgWrap.innerHTML = '<label>Image URL (optional, https only)</label>';
    var img = document.createElement('input');
    img.placeholder = 'https://…';
    img.value = q.image || '';
    img.oninput = function () { q.image = img.value.trim(); saveQuiz(); };
    imgWrap.appendChild(img);

    two.appendChild(timeWrap); two.appendChild(imgWrap);
    card.appendChild(two);
    return card;
  }

  function move(i, d) {
    var j = i + d;
    if (j < 0 || j >= quiz.questions.length) return;
    var t = quiz.questions[i];
    quiz.questions[i] = quiz.questions[j];
    quiz.questions[j] = t;
    saveQuiz(); renderQList();
  }

  $('btnAddQ').onclick = function () {
    quiz.questions.push(blankQ()); saveQuiz(); renderQList(); SFX.tap();
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };
  $('qzTitle').oninput = saveQuiz;
  $('qzTopic').oninput = saveQuiz;

  $('btnSpark').onclick = function () {
    var topic = $('qzTopic').value.trim();
    if (!topic) { msgBox('createMsg', 'Type a topic first - anything you like.'); return; }
    msgBox('createMsg', 'MOKI Spark is thinking…', true);
    fetch('/api/spark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: topic, count: 5 })
    }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok || !res.d.ok) { msgBox('createMsg', res.d.error || 'Spark could not help with that topic.'); return; }
        res.d.questions.forEach(function (q) { quiz.questions.push(q); });
        if (!quiz.title) { quiz.title = topic + ' Showdown'; $('qzTitle').value = quiz.title; }
        saveQuiz(); renderQList();
        msgBox('createMsg', 'Added ' + res.d.questions.length + ' questions. Edit them freely.', true);
        SFX.good();
      }).catch(function () { msgBox('createMsg', 'Spark is offline right now - add questions manually.'); });
  };

  /* ---- share / load a quiz by code (no file downloads) ---- */
  $('btnShare').onclick = function () {
    saveQuiz();
    if (!quiz.questions.length) { msgBox('createMsg', 'Add some questions before sharing.'); return; }
    $('loadBox').hidden = true;
    msgBox('createMsg', 'Saving your quiz…', true);
    fetch('/api/quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quiz: quiz })
    }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok || !res.d.ok) { msgBox('createMsg', res.d.error || 'Could not save the quiz.'); return; }
        msgBox('createMsg', '');
        $('shareCode').textContent = res.d.code;
        $('shareHint').textContent = '"' + res.d.title + '" · ' + res.d.questionCount +
          ' questions. Anyone can load it with this code.';
        $('shareBox').hidden = false;
        $('btnCopyCode').textContent = 'Copy code';
        SFX.good();
      }).catch(function () { msgBox('createMsg', 'Could not reach the server.'); });
  };
  $('btnCopyCode').onclick = function () {
    var code = $('shareCode').textContent;
    var done = function () { $('btnCopyCode').textContent = 'Copied!'; SFX.tap(); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(done, function () { toast(code); });
    } else { toast(code); }
  };
  $('btnCloseShare').onclick = function () { $('shareBox').hidden = true; };
  $('btnCloseLoad').onclick = function () { $('loadBox').hidden = true; };

  $('btnLoadCode').onclick = function () {
    $('shareBox').hidden = true;
    $('loadBox').hidden = false;
    $('loadCodeInput').focus();
  };
  $('loadCodeInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') $('btnLoadGo').click();
  });
  $('btnLoadGo').onclick = function () {
    var body = $('loadCodeInput').value.trim().toUpperCase()
      .replace(/^MOKI/, '').replace(/[^A-Z0-9]/g, '');
    if (body.length !== 5) { msgBox('createMsg', 'Enter a full code, like MOKI-X7K4P.'); return; }
    fetch('/api/quiz/' + encodeURIComponent(body))
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok || !res.d.ok) { msgBox('createMsg', res.d.error || 'No quiz found with that code.'); SFX.bad(); return; }
        quiz = res.d.quiz;
        $('qzTitle').value = quiz.title;
        $('qzTopic').value = quiz.topic;
        saveQuiz(); renderQList();
        $('loadBox').hidden = true;
        $('loadCodeInput').value = '';
        msgBox('createMsg', 'Loaded ' + res.d.code + ' - ' + quiz.questions.length + ' questions.', true);
        SFX.good();
      }).catch(function () { msgBox('createMsg', 'Could not reach the server.'); });
  };

  /* ---------------- quick play & solo setup ---------------- */
  var TOPIC_TILES = [
    { id: 'general',    name: 'General', emoji: '🧠' },
    { id: 'science',    name: 'Science', emoji: '🔬' },
    { id: 'space',      name: 'Space',   emoji: '🚀' },
    { id: 'movies',     name: 'Movies',  emoji: '🎬' },
    { id: 'gaming',     name: 'Games',   emoji: '🎮' },
    { id: 'sports',     name: 'Sports',  emoji: '⚽' },
    { id: 'animals',    name: 'Animals', emoji: '🐾' },
    { id: 'history',    name: 'History', emoji: '🏺' },
    { id: 'geography',  name: 'World',   emoji: '🌍' },
    { id: 'music',      name: 'Music',   emoji: '🎵' },
    { id: '__random',   name: 'Random',  emoji: '🎲' },
    { id: '__custom',   name: 'Custom',  emoji: '✏️' }
  ];
  var setup = {
    quick: { topic: 'general', count: 8, time: 20 },
    solo:  { topic: 'general', count: 8, time: 20 }
  };

  function buildSetup(kind) {
    var cfg = setup[kind];
    var tiles = $(kind + 'Topics');
    if (!tiles || tiles.childElementCount) return;

    TOPIC_TILES.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'topic' + (cfg.topic === t.id ? ' on' : '');
      b.innerHTML = '<span class="emoji">' + t.emoji + '</span>' + esc(t.name);
      b.onclick = function () {
        cfg.topic = t.id;
        SFX.tap();
        tiles.querySelectorAll('.topic').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        $(kind + 'CustomWrap').hidden = t.id !== '__custom';
        if (t.id === '__custom') $(kind + 'Custom').focus();
      };
      tiles.appendChild(b);
    });

    seg(kind + 'Count', [5, 8, 10], cfg, 'count', function (v) { return v + ' Qs'; });
    seg(kind + 'Time', [10, 15, 20, 30], cfg, 'time', function (v) { return v + 's'; });
  }

  function seg(hostId, values, cfg, key, label) {
    var host = $(hostId);
    if (!host) return;
    host.innerHTML = '';
    values.forEach(function (v) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = cfg[key] === v ? 'on' : '';
      b.textContent = label(v);
      b.onclick = function () {
        cfg[key] = v;
        SFX.tap();
        host.querySelectorAll('button').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
      };
      host.appendChild(b);
    });
  }

  function resolveTopic(kind) {
    var cfg = setup[kind];
    if (cfg.topic === '__custom') return ($(kind + 'Custom').value || '').trim();
    if (cfg.topic === '__random') {
      var pool = TOPIC_TILES.filter(function (t) { return t.id.indexOf('__') !== 0; });
      return pool[Math.floor(Math.random() * pool.length)].id;
    }
    return cfg.topic;
  }

  /* Asks MOKI Spark for a set of questions, then hands back a quiz object. */
  function makeQuiz(kind, done) {
    var cfg = setup[kind];
    var topic = resolveTopic(kind);
    if (!topic) { msgBox(kind + 'Msg', 'Type a topic first.'); return; }
    msgBox(kind + 'Msg', 'Building your quiz…', true);

    fetch('/api/spark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: topic, count: cfg.count })
    }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok || !res.d.ok) {
          msgBox(kind + 'Msg', (res.d && res.d.error) ||
            'MOKI Spark has nothing for that topic yet - try another, or use the Quiz Builder.');
          return;
        }
        var qs = res.d.questions.map(function (q) {
          return { text: q.text, answers: q.answers, correct: q.correct, time: cfg.time, image: '' };
        });
        msgBox(kind + 'Msg', '');
        done({
          title: topic.charAt(0).toUpperCase() + topic.slice(1) + ' Showdown',
          topic: topic,
          questions: qs
        });
      }).catch(function () { msgBox(kind + 'Msg', 'Could not reach the server.'); });
  }

  /* ---------------- teams ---------------- */
  var teamState = { list: null, mine: null, wanted: false };

  function teamCards(host, board, hidden) {
    if (!host) return;
    if (!board || !board.length) { host.hidden = true; return; }
    host.hidden = false;
    host.innerHTML = '';
    board.forEach(function (t) {
      var d = document.createElement('div');
      d.className = 'team-card' + (t.rank === 1 ? ' lead' : '');
      d.style.background = t.c;
      d.innerHTML = '<b>' + esc(t.name) + '</b><span class="sc">' + t.score +
        '</span><span class="mb">' + t.members + ' player' + (t.members === 1 ? '' : 's') + '</span>';
      host.appendChild(d);
    });
  }

  function paintTeamPicker(list, mine) {
    var host = $('teamPick');
    if (!host) return;
    if (!list) { host.hidden = true; return; }
    host.hidden = false;
    host.innerHTML = '<label style="color:#fff">Your team</label>';
    var grid = document.createElement('div');
    grid.className = 'team-pick';
    list.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'team-btn' + (t.id === mine ? ' on' : '');
      b.style.background = t.c;
      b.textContent = t.name;
      b.onclick = function () {
        socket.emit('player:team', { team: t.id }, function (res) {
          if (res && res.ok) { teamState.mine = res.team; paintTeamPicker(list, res.team); SFX.tap(); }
          else if (res && res.error) toast(res.error);
        });
      };
      grid.appendChild(b);
    });
    host.appendChild(grid);
  }

  /* ---------------- game feel helpers ---------------- */
  function popPoints(text, cls) {
    var d = document.createElement('div');
    d.className = 'pts-pop';
    d.textContent = text;
    if (cls) d.style.color = cls;
    document.body.appendChild(d);
    setTimeout(function () { d.remove(); }, 1600);
  }

  function reactionChip(nick, moki, label, good) {
    var host = $('qReactions');
    if (!host) return;
    var d = document.createElement('div');
    d.className = 'rx' + (good ? ' good' : '');
    var m = document.createElement('div');
    m.className = 'moki-wrap';
    m.innerHTML = MOKI.svg(moki, { mood: good ? 'correct' : 'idle', flat: true });
    var t = document.createElement('span');
    t.textContent = nick + ' ' + label;
    d.appendChild(m); d.appendChild(t);
    host.appendChild(d);
    while (host.childElementCount > 6) host.removeChild(host.firstChild);
  }

  /* Big MOKI in the corner of the question screen, reacting to what happens. */
  function cornerMoki(mood) {
    var el = $('qMoki');
    if (!el) return;
    el.innerHTML = MOKI.svg(profile.moki, { mood: mood || 'idle' });
  }

  /* Phones get shapes rather than a wall of text - the question is on the host
     screen. The text is still in aria-label, so screen readers get everything. */
  function phoneMode() {
    return me.role === 'player' && window.matchMedia('(max-width: 820px)').matches;
  }
  function applyPhoneMode() {
    document.body.classList.toggle('phone-play', phoneMode());
  }

  /* ---------------- game state ---------------- */
  var me = { role: null, pin: null, playerId: null, token: null, score: 0, answered: false };
  var timerHandle = null;
  var lastQuestion = null;

  function leaveGame() {
    stopMusic();
    document.body.classList.remove('phone-play');
    if (me.role === 'host') socket.emit('host:end');
    else if (me.role === 'solo') socket.emit('solo:quit');
    me = { role: null, pin: null, playerId: null, token: null, score: 0, answered: false };
    try { sessionStorage.removeItem('moki.session'); } catch (e) {}
    stopTimer();
  }
  function stopTimer() { if (timerHandle) { clearInterval(timerHandle); timerHandle = null; } }

  /* ---------------- host ---------------- */
  $('btnHostStart').onclick = function () {
    saveQuiz();
    if (!quiz.questions.length) { msgBox('createMsg', 'Add at least one question first.'); return; }
    var bad = quiz.questions.findIndex(function (q) {
      return !q.text.trim() || q.answers.some(function (a) { return !String(a).trim(); });
    });
    if (bad >= 0) { msgBox('createMsg', 'Question ' + (bad + 1) + ' is missing text or an answer.'); return; }

    socket.emit('host:create', { quiz: quiz, teams: teamState.wanted }, function (res) {
      if (!res || !res.ok) { msgBox('createMsg', (res && res.error) || 'Could not create the game.'); return; }
      me.role = 'host';
      me.pin = res.pin;
      $('hostPin').textContent = res.pin;
      $('hostTitle').textContent = res.quiz.title;
      $('hostQCount').textContent = res.quiz.questions.length;
      $('hostUrl').textContent = location.host;
      showJoinQr(res.pin);
      show('hostlobby');
      SFX.join();
    });
  };

  /* Renders the join link as a QR so players can scan instead of typing. */
  function showJoinQr(pin) {
    var card = $('hostQrCard');
    var box = $('hostQr');
    if (!card || !box) return;
    try {
      box.innerHTML = window.MOKIQR.svg(location.origin + '/#' + pin, { dark: '#1A1531' });
      card.hidden = false;
    } catch (e) {
      card.hidden = true;   // never let a QR failure block hosting
    }
  }

  $('btnStartGame').onclick = function () {
    socket.emit('host:start', {}, function (res) {
      if (!res || !res.ok) toast((res && res.error) || 'Could not start.');
    });
  };
  $('hostQuit').onclick = function () { leaveGame(); show('home'); };
  $('btnSkip').onclick = function () { socket.emit('host:skip'); };
  $('btnNextQ').onclick = function () { socket.emit('host:next'); SFX.tap(); };

  /* ---------------- player join ---------------- */
  $('joinPin').addEventListener('input', function () {
    this.value = this.value.replace(/\D/g, '').slice(0, 6);
  });
  $('joinPin').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('joinNick').focus(); });
  $('joinNick').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('btnJoin').click(); });

  $('btnJoin').onclick = function () {
    var pin = $('joinPin').value.trim();
    var nick = ($('joinNick').value || profile.name || '').trim();
    if (!/^\d{6}$/.test(pin)) { msgBox('joinMsg', 'Enter the 6-digit PIN from the host screen.'); return; }
    if (nick.length < 2) { msgBox('joinMsg', 'Enter a nickname with at least 2 characters.'); return; }
    msgBox('joinMsg', '');
    $('btnJoin').disabled = true;

    socket.emit('player:join', { pin: pin, nick: nick, moki: profile.moki, token: me.token }, function (res) {
      $('btnJoin').disabled = false;
      if (!res || !res.ok) { msgBox('joinMsg', (res && res.error) || 'Could not join.'); SFX.bad(); return; }
      me.role = 'player';
      me.pin = res.pin;
      me.playerId = res.playerId;
      me.token = res.token;
      me.score = res.score || 0;
      profile.name = nick; save();
      try { sessionStorage.setItem('moki.session', JSON.stringify({ pin: res.pin, token: res.token, nick: nick })); } catch (e) {}
      $('lobbyNick').textContent = nick;
      $('lobbyTitle').textContent = res.title + ' · ' + res.topic;
      mokiInto($('lobbyMoki'), profile.moki, 'idle');
      teamState.list = res.teams || null;
      teamState.mine = res.team || null;
      paintTeamPicker(teamState.list, teamState.mine);
      if (res.state === 'lobby') { show('playerlobby'); startMusic('lobby'); }
      SFX.join();
    });
  };
  $('playerQuit').onclick = function () { leaveGame(); show('home'); };

  $('btnQuickGo').onclick = function () {
    var btn = this;
    btn.disabled = true;
    makeQuiz('quick', function (q) {
      // fill the builder first - saveQuiz() reads its inputs back into the quiz
      quiz = q;
      $('qzTitle').value = q.title;
      $('qzTopic').value = q.topic;
      saveQuiz();
      socket.emit('host:create', { quiz: q, teams: teamState.wanted }, function (res) {
        btn.disabled = false;
        if (!res || !res.ok) { msgBox('quickMsg', (res && res.error) || 'Could not create the game.'); return; }
        me.role = 'host';
        me.pin = res.pin;
        $('hostPin').textContent = res.pin;
        $('hostTitle').textContent = res.quiz.title;
        $('hostQCount').textContent = res.quiz.questions.length;
        $('hostUrl').textContent = location.host;
        show('hostlobby');
        showJoinQr(res.pin);
        SFX.join();
      });
    });
    setTimeout(function () { btn.disabled = false; }, 6000);
  };

  $('btnSoloGo').onclick = function () {
    var btn = this;
    btn.disabled = true;
    makeQuiz('solo', function (q) {
      socket.emit('solo:start', {
        quiz: q, nick: profile.name || 'You', moki: profile.moki
      }, function (res) {
        btn.disabled = false;
        if (!res || !res.ok) { msgBox('soloMsg', (res && res.error) || 'Could not start.'); return; }
        me.role = 'solo';
        me.pin = res.pin;
        me.playerId = res.playerId;
        me.score = 0;
        SFX.join();
      });
    });
    setTimeout(function () { btn.disabled = false; }, 6000);
  };

  /* try to rejoin after a refresh */
  (function tryResume() {
    var raw;
    try { raw = JSON.parse(sessionStorage.getItem('moki.session') || 'null'); } catch (e) { raw = null; }
    if (!raw || !raw.pin) return;
    socket.on('connect', function once() {
      socket.off('connect', once);
      socket.emit('player:join', { pin: raw.pin, nick: raw.nick, moki: profile.moki, token: raw.token }, function (res) {
        if (!res || !res.ok) { try { sessionStorage.removeItem('moki.session'); } catch (e) {} return; }
        me.role = 'player'; me.pin = res.pin; me.playerId = res.playerId; me.token = res.token; me.score = res.score || 0;
        $('lobbyNick').textContent = res.nick;
        $('lobbyTitle').textContent = res.title;
        mokiInto($('lobbyMoki'), profile.moki, 'idle');
        if (res.state === 'lobby') show('playerlobby');
        toast('Reconnected to game ' + res.pin);
      });
    });
  })();

  /* ---------------- socket events ---------------- */
  socket.on('lobby:update', function (d) {
    if (d.teams) teamState.list = d.teams;
    teamCards($('hostTeams'), d.teamBoard);
    if (me.role === 'host') {
      $('hostCount').textContent = d.count;
      $('hostQCount').textContent = d.questionCount;
      paintChips($('hostPlayers'), d.players, true);
    } else {
      paintChips($('lobbyPlayers'), d.players, false);
    }
  });

  function paintChips(host, players, allowKick) {
    host.innerHTML = '';
    players.forEach(function (p) {
      var c = document.createElement('div');
      c.className = 'player-chip' + (p.connected ? '' : ' off');
      var m = document.createElement('div');
      m.className = 'moki-xs';
      m.innerHTML = MOKI.svg(p.moki, { mood: 'idle', flat: true });
      var n = document.createElement('div');
      n.className = 'nm';
      n.textContent = p.nick;
      c.appendChild(m); c.appendChild(n);
      if (allowKick) {
        var k = document.createElement('button');
        k.className = 'icon-btn';
        k.textContent = '✕';
        k.title = 'Remove ' + p.nick;
        k.style.fontSize = '12px';
        k.onclick = function () { socket.emit('host:kick', { playerId: p.id }); };
        c.appendChild(k);
      }
      host.appendChild(c);
    });
  }

  socket.on('player:entered', function () { SFX.join(); });

  socket.on('game:starting', function () {
    mokiInto($('countMoki'), profile.moki, 'idle');
    show('count');
    var n = 3;
    $('countNum').textContent = n;
    SFX.tick();
    var iv = setInterval(function () {
      n--;
      if (n <= 0) { clearInterval(iv); return; }
      $('countNum').textContent = n;
      SFX.tick();
    }, 1000);
  });

  socket.on('game:question', function (q) {
    lastQuestion = q;
    me.answered = !!q.alreadyAnswered;
    $('qNum').textContent = 'Q' + (q.index + 1) + ' / ' + q.total;
    $('qReactions').innerHTML = '';
    cornerMoki('idle');
    $('qScore').textContent = me.role === 'host' ? 'HOST SCREEN' : me.score + ' pts';
    $('qText').textContent = q.text;
    var img = $('qImage');
    if (q.image) { img.src = q.image; img.hidden = false; } else { img.hidden = true; img.removeAttribute('src'); }

    var host = $('qAnswers');
    host.innerHTML = '';
    q.answers.forEach(function (a, i) {
      var b = document.createElement('button');
      b.className = 'ans ans' + i;
      b.innerHTML = '<span class="shape">' + SHAPES[i] + '</span><span class="label">' + esc(a) + '</span>';
      b.setAttribute('aria-label', 'Answer ' + (i + 1) + ': ' + a);
      if (me.role !== 'host') {          // players and solo runs both answer
        b.onclick = function () { answer(i); };
      } else {
        b.style.cursor = 'default';
      }
      host.appendChild(b);
    });

    $('qStatus').hidden = true;
    $('hostQControls').hidden = me.role !== 'host';
    $('qResponses').textContent = '0';
    if (me.answered) lockAnswers(null);

    applyPhoneMode();
    $('qText').classList.remove('reveal-text');
    var showText = $('btnShowText');
    if (showText) {
      showText.hidden = !phoneMode();
      showText.onclick = function () {
        $('qText').classList.toggle('reveal-text');
        showText.textContent = $('qText').classList.contains('reveal-text')
          ? 'Hide question text' : 'Show question text';
      };
      showText.textContent = 'Show question text';
    }
    show('question');
    startTimer(q);
    startMusic('tense');
  });

  var RING_LEN = 276.46;   // 2 * PI * r, r = 44
  function startTimer(q) {
    stopTimer();
    var offset = Date.now() - q.serverNow;      // rough clock skew correction
    var end = q.endsAt + offset;
    var total = q.time * 1000;
    var el = $('qTimer');
    var ring = $('qRing');
    var bar = $('qRingBar');
    var lastShown = -1;
    function paint() {
      var msLeft = Math.max(0, end - Date.now());
      var left = Math.max(0, Math.ceil(msLeft / 1000));
      if (bar) bar.style.strokeDashoffset = String(RING_LEN * (1 - msLeft / total));
      if (left !== lastShown) {
        lastShown = left;
        el.textContent = left;
        if (ring) ring.classList.toggle('warn', left <= 5);
        if (left <= 5 && left > 0) SFX.tick();
      }
      if (left <= 0) {
        stopTimer();
        if (me.role !== 'host' && !me.answered) {
          $('qStatus').hidden = false;
          $('qStatus').textContent = "Time's up!";
        }
      }
    }
    paint();
    timerHandle = setInterval(paint, 120);
  }

  function answer(i) {
    if (me.answered) return;
    me.answered = true;
    lockAnswers(i);
    SFX.lock();
    socket.emit('player:answer', { choice: i }, function (res) {
      if (!res || !res.ok) {
        me.answered = false;
        $('qAnswers').querySelectorAll('.ans').forEach(function (b) { b.classList.remove('dim'); });
        $('qStatus').hidden = false;
        $('qStatus').textContent = (res && res.error) || 'Could not send answer.';
        return;
      }
      $('qStatus').hidden = false;
      $('qStatus').className = 'awaiting dots';
      $('qStatus').textContent = 'Answer locked in';
    });
  }
  function lockAnswers(chosen) {
    $('qAnswers').querySelectorAll('.ans').forEach(function (b, k) {
      b.classList.toggle('dim', chosen !== null && k !== chosen);
      b.classList.toggle('picked', chosen !== null && k === chosen);
      b.disabled = true;
    });
    $('qStatus').hidden = false;
    $('qStatus').className = 'awaiting dots';
    $('qStatus').textContent = 'Answer locked in';
  }

  // keyboard: 1-4 to answer
  document.addEventListener('keydown', function (e) {
    if (current !== 'question' || me.role === 'host' || !me.role) return;
    var n = ['1', '2', '3', '4'].indexOf(e.key);
    if (n >= 0) answer(n);
  });

  socket.on('reaction:locked', function (d) {
    if (d.id === me.playerId) return;                 // you already know you answered
    var label = d.order === 1 ? 'answered first! ⚡' : 'locked in 🔒';
    reactionChip(d.nick, d.moki, label, false);
    SFX.tick();
  });

  socket.on('answer:count', function (d) {
    $('qResponses').textContent = d.responses + ' / ' + d.players;
  });

  socket.on('game:reveal', function (d) {
    stopTimer();
    stopMusic();
    SFX.reveal();
    teamCards($('teamStandings'), d.teamBoard);
    var isHost = me.role === 'host';
    $('revealPlayer').hidden = isHost;
    $('revealHost').hidden = !isHost;
    $('btnNextQ').hidden = !isHost;
    $('btnNextQ').textContent = d.isLast ? 'Final results →' : 'Next question →';

    if (isHost) {
      $('revealCorrect').textContent = 'Answer: ' + d.answers[d.correct];
      var bars = $('revealBars');
      bars.innerHTML = '';
      d.answers.forEach(function (a, i) {
        var b = document.createElement('div');
        b.className = 'ans ans' + i + (i === d.correct ? ' right' : ' dim');
        b.innerHTML = '<span class="shape">' + SHAPES[i] + '</span><span>' + esc(a) +
          '</span><span class="count">' + d.counts[i] + '</span>';
        bars.appendChild(b);
      });
      var rx = $('qReactions');
      if (rx) rx.innerHTML = '';
      (d.gotIt || []).slice(0, 6).forEach(function (g) {
        reactionChip(g.nick, g.moki, 'got it! 🎉', true);
      });
    } else {
      var v = $('verdict');
      var you = d.you;
      me.score = you.score;
      if (!you.answered) {
        v.className = 'verdict none';
        $('verdictText').textContent = 'No answer';
        $('verdictPts').textContent = 'Correct: ' + d.answers[d.correct];
        mokiInto($('revealMoki'), profile.moki, 'wrong');
        SFX.bad();
      } else if (you.wasCorrect) {
        v.className = 'verdict good';
        $('verdictText').textContent = you.streak > 1 ? 'Correct! ' + you.streak + ' in a row 🔥' : 'Correct!';
        $('verdictPts').textContent = '+' + you.points;
        mokiInto($('revealMoki'), profile.moki, 'correct');
        SFX.good();
      } else {
        v.className = 'verdict bad';
        $('verdictText').textContent = 'Not this time';
        $('verdictPts').textContent = 'Correct: ' + d.answers[d.correct];
        mokiInto($('revealMoki'), profile.moki, 'wrong');
        SFX.bad();
      }
      $('verdictRank').textContent = 'Rank ' + you.rank + ' · ' + you.score + ' pts';
      if (you.wasCorrect && you.points > 0) popPoints('+' + you.points);
      cornerMoki(you.wasCorrect ? 'correct' : 'wrong');
    }
    paintLb($('revealLb'), d.leaderboard);
    show('reveal');
  });

  function paintLb(host, rows) {
    host.innerHTML = '';
    rows.forEach(function (r, i) {
      var row = document.createElement('div');
      row.className = 'lb-row' + (r.rank <= 3 ? ' r' + r.rank : '') + (r.id === me.playerId ? ' me' : '');
      row.style.animationDelay = (i * 0.06) + 's';
      var mk = document.createElement('div');
      mk.className = 'moki-xs';
      mk.innerHTML = MOKI.svg(r.moki, { mood: r.rank === 1 ? 'win' : 'idle', flat: true });
      row.innerHTML = '<span class="rk">' + (r.rank === 1 ? '👑' : r.rank) + '</span>';
      row.appendChild(mk);
      var nm = document.createElement('span');
      nm.className = 'nm';
      nm.textContent = r.nick;
      var sc = document.createElement('span');
      sc.className = 'sc';
      sc.textContent = r.score;
      row.appendChild(nm); row.appendChild(sc);
      host.appendChild(row);
    });
  }

  socket.on('game:over', function (d) {
    stopTimer();
    stopMusic();
    teamCards($('teamFinal'), d.teamBoard);
    $('finalTitle').textContent = d.title;

    var top = d.leaderboard.slice(0, 3);
    var pod = $('podium');
    pod.innerHTML = '';
    var MEDALS = ['🥇', '🥈', '🥉'];
    [1, 0, 2].forEach(function (idx) {
      var r = top[idx];
      if (!r) return;
      var col = document.createElement('div');
      col.className = 'pod pod' + (idx + 1);
      var medal = document.createElement('div');
      medal.className = 'medal';
      medal.textContent = MEDALS[idx];
      col.appendChild(medal);
      var mk = document.createElement('div');
      mk.className = 'moki-md';
      mk.innerHTML = MOKI.svg(r.moki, { mood: 'win' });
      if (idx === 0) {
        var cr = document.createElement('div');
        cr.className = 'crown';
        cr.textContent = '👑';
        col.appendChild(cr);
      }
      col.appendChild(mk);
      var nm = document.createElement('div');
      nm.className = 'nm';
      nm.textContent = r.nick;
      var sc = document.createElement('div');
      sc.className = 'sc';
      sc.textContent = r.score + ' pts';
      var bar = document.createElement('div');
      bar.className = 'bar';
      bar.textContent = idx + 1;
      col.appendChild(nm); col.appendChild(sc); col.appendChild(bar);
      pod.appendChild(col);
    });

    paintLb($('finalLb'), d.leaderboard);

    if (d.you) {
      $('finalYou').hidden = false;
      $('fRank').textContent = d.you.rank;
      $('fScore').textContent = d.you.score;
      $('fAcc').textContent = d.you.accuracy + '%';
      $('fXp').textContent = '+' + d.you.xp;

      var levelBefore = levelOf(profile.xp);
      profile.xp += d.you.xp;
      profile.games += 1;
      profile.correct += d.you.correct;
      profile.answered += d.you.answered;
      if (d.you.rank === 1) profile.wins += 1;
      save();
      var levelAfter = levelOf(profile.xp);
      $('fLevelText').textContent = 'Level ' + levelAfter + ' · ' + profile.xp + ' XP total';
      setTimeout(function () { $('fXpBar').style.width = levelProgress(profile.xp) + '%'; }, 250);

      // count the XP up rather than just printing it
      countUp($('fXp'), d.you.xp, '+');

      var lvlBanner = $('levelUp');
      if (lvlBanner) {
        if (levelAfter > levelBefore) {
          lvlBanner.textContent = 'LEVEL UP!  ' + levelBefore + ' → ' + levelAfter + '  🎉';
          lvlBanner.hidden = false;
          setTimeout(function () { SFX.levelup(); }, 700);
        } else {
          lvlBanner.hidden = true;
        }
      }
    } else {
      $('finalYou').hidden = true;
    }

    show('final');
    SFX.win();
    confetti();
    try { sessionStorage.removeItem('moki.session'); } catch (e) {}
  });

  socket.on('game:closed', function (d) {
    stopTimer();
    toast((d && d.reason) || 'Game closed.');
    me = { role: null, pin: null, playerId: null, token: null, score: 0, answered: false };
    try { sessionStorage.removeItem('moki.session'); } catch (e) {}
    if (current !== 'final') show('home');
  });

  socket.on('disconnect', function () {
    if (me.role) toast('Lost connection - reconnecting…');
  });

  $('btnAgain').onclick = function () {
    if (me.role === 'solo') { SFX.tap(); show('solosetup'); me.role = null; me.playerId = null; me.score = 0; return; }
    SFX.tap();
    if (me.role === 'host') { show('create'); }
    else { show('join'); $('joinPin').value = ''; $('joinPin').focus(); }
    me.role = null; me.playerId = null; me.score = 0;
  };

  /* Counts a number up so earning XP feels like earning something. */
  function countUp(el, target, prefix) {
    if (!el) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = (prefix || '') + target;
      return;
    }
    var start = performance.now(), dur = 900, finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      el.textContent = (prefix || '') + target;
    }
    // requestAnimationFrame is paused while the tab is in the background, so a
    // timer guarantees the real number lands even if the animation never runs
    setTimeout(finish, dur + 250);
    (function step(now) {
      if (finished) return;
      var t = Math.min(1, (now - start) / dur);
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = (prefix || '') + Math.round(target * eased);
      if (t < 1) requestAnimationFrame(step); else finish();
    })(start);
  }

  /* ---------------- confetti ---------------- */
  function confetti() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var cv = $('confetti');
    var ctx = cv.getContext('2d');
    cv.width = innerWidth; cv.height = innerHeight;
    var colors = ['#FFC93C', '#FF5A7A', '#3EC8FF', '#25E0B0', '#7C4DFF', '#FFFFFF'];
    var bits = [];
    for (var i = 0; i < 140; i++) {
      bits.push({
        x: Math.random() * cv.width, y: -20 - Math.random() * cv.height,
        w: 6 + Math.random() * 8, h: 8 + Math.random() * 10,
        c: colors[Math.floor(Math.random() * colors.length)],
        vy: 2 + Math.random() * 3.5, vx: -1.4 + Math.random() * 2.8,
        rot: Math.random() * 6.28, vr: -0.14 + Math.random() * 0.28
      });
    }
    var frames = 0;
    (function loop() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      bits.forEach(function (b) {
        b.x += b.vx; b.y += b.vy; b.rot += b.vr;
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot);
        ctx.fillStyle = b.c;
        ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
        ctx.restore();
      });
      frames++;
      if (frames < 380) requestAnimationFrame(loop);
      else ctx.clearRect(0, 0, cv.width, cv.height);
    })();
  }
  window.addEventListener('resize', function () {
    var cv = $('confetti'); cv.width = innerWidth; cv.height = innerHeight;
  });

  /* Installable on phones. Registration is best-effort: if it fails the game
     works exactly as before. */
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    });
  }

  /* ---------------- boot ---------------- */
  if (!profile.name) profile.moki = MOKI.randomConfig(1);
  save();
  // show() also hides every other screen from screen readers and the tab order
  show('home');
  var deep = location.hash.match(/^#(\d{6})$/);
  if (deep) { $('joinPin').value = deep[1]; show('join'); }
})();
