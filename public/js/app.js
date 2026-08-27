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
  var SFX = {
    tap: function () { beep(520, 0.08, 'square', 0.05); },
    tick: function () { beep(880, 0.06, 'sine', 0.04); },
    good: function () { beep(660, 0.12); setTimeout(function () { beep(990, 0.18); }, 110); },
    bad: function () { beep(200, 0.22, 'sawtooth', 0.06); },
    win: function () { [523, 659, 784, 1046].forEach(function (f, i) { setTimeout(function () { beep(f, 0.22); }, i * 130); }); },
    join: function () { beep(700, 0.1); }
  };

  /* ---------------- screens ---------------- */
  var current = 'home';
  function show(name) {
    var el = $('s-' + name);
    if (!el) return;
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('active'); });
    el.classList.add('active');
    current = name;
    window.scrollTo(0, 0);
    if (name === 'home') paintHome();
    if (name === 'profile') paintProfile();
    if (name === 'customize') paintCustomizer();
    if (name === 'create') { paintTopics(); renderQList(); }
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
  function paintHome() {
    mokiInto($('homeMoki'), profile.moki, 'idle');
    $('homeName').textContent = profile.name || 'New player';
    $('homeLevel').textContent = levelOf(profile.xp);
    $('homeXp').style.width = levelProgress(profile.xp) + '%';
    $('btnSound').textContent = profile.sound ? '🔊 Sound: on' : '🔇 Sound: off';
  }
  $('btnSound').onclick = function () {
    profile.sound = !profile.sound; save(); paintHome(); if (profile.sound) SFX.tap();
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
      skin: 'Skin', hair: 'Hair style', hairColor: 'Hair colour', eyes: 'Eyes', mouth: 'Mouth',
      outfit: 'Outfit', pants: 'Pants', shoes: 'Shoes', hat: 'Hats', accessory: 'Accessories'
    })[p] || p;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------------- customizer ---------------- */
  var activePart = 'skin';
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

  /* ---------------- game state ---------------- */
  var me = { role: null, pin: null, playerId: null, token: null, score: 0, answered: false };
  var timerHandle = null;
  var lastQuestion = null;

  function leaveGame() {
    if (me.role) {
      socket.emit(me.role === 'host' ? 'host:end' : 'disconnectRequest');
    }
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

    socket.emit('host:create', { quiz: quiz }, function (res) {
      if (!res || !res.ok) { msgBox('createMsg', (res && res.error) || 'Could not create the game.'); return; }
      me.role = 'host';
      me.pin = res.pin;
      $('hostPin').textContent = res.pin;
      $('hostTitle').textContent = res.quiz.title;
      $('hostQCount').textContent = res.quiz.questions.length;
      $('hostUrl').textContent = location.host;
      show('hostlobby');
      SFX.join();
    });
  };
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
      if (res.state === 'lobby') show('playerlobby');
      SFX.join();
    });
  };
  $('playerQuit').onclick = function () { leaveGame(); show('home'); };

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
      m.innerHTML = MOKI.svg(p.moki, { mood: 'idle' });
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
    $('qScore').textContent = me.role === 'host' ? 'HOST' : me.score + ' pts';
    $('qText').textContent = q.text;
    var img = $('qImage');
    if (q.image) { img.src = q.image; img.hidden = false; } else { img.hidden = true; img.removeAttribute('src'); }

    var host = $('qAnswers');
    host.innerHTML = '';
    q.answers.forEach(function (a, i) {
      var b = document.createElement('button');
      b.className = 'ans ans' + i;
      b.innerHTML = '<span class="shape">' + SHAPES[i] + '</span><span>' + esc(a) + '</span>';
      b.setAttribute('aria-label', 'Answer ' + (i + 1) + ': ' + a);
      if (me.role === 'player') {
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

    show('question');
    startTimer(q);
  });

  function startTimer(q) {
    stopTimer();
    var offset = Date.now() - q.serverNow;      // rough clock skew correction
    var end = q.endsAt + offset;
    var el = $('qTimer');
    var lastShown = -1;
    function paint() {
      var left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      if (left !== lastShown) {
        lastShown = left;
        el.textContent = left;
        el.classList.toggle('warn', left <= 5);
        if (left <= 5 && left > 0) SFX.tick();
      }
      if (left <= 0) {
        stopTimer();
        if (me.role === 'player' && !me.answered) {
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
    SFX.tap();
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
      b.disabled = true;
    });
    $('qStatus').hidden = false;
    $('qStatus').className = 'awaiting dots';
    $('qStatus').textContent = 'Answer locked in';
  }

  // keyboard: 1-4 to answer
  document.addEventListener('keydown', function (e) {
    if (current !== 'question' || me.role !== 'player') return;
    var n = ['1', '2', '3', '4'].indexOf(e.key);
    if (n >= 0) answer(n);
  });

  socket.on('answer:count', function (d) {
    $('qResponses').textContent = d.responses + ' / ' + d.players;
  });

  socket.on('game:reveal', function (d) {
    stopTimer();
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
      mk.innerHTML = MOKI.svg(r.moki, { mood: r.rank === 1 ? 'win' : 'idle' });
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
    $('finalTitle').textContent = d.title;

    var top = d.leaderboard.slice(0, 3);
    var pod = $('podium');
    pod.innerHTML = '';
    [1, 0, 2].forEach(function (idx) {
      var r = top[idx];
      if (!r) return;
      var col = document.createElement('div');
      col.className = 'pod pod' + (idx + 1);
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

      profile.xp += d.you.xp;
      profile.games += 1;
      profile.correct += d.you.correct;
      profile.answered += d.you.answered;
      if (d.you.rank === 1) profile.wins += 1;
      save();
      $('fLevelText').textContent = 'Level ' + levelOf(profile.xp) + ' · ' + profile.xp + ' XP total';
      setTimeout(function () { $('fXpBar').style.width = levelProgress(profile.xp) + '%'; }, 250);
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
    SFX.tap();
    if (me.role === 'host') { show('create'); }
    else { show('join'); $('joinPin').value = ''; $('joinPin').focus(); }
    me.role = null; me.playerId = null; me.score = 0;
  };

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

  /* ---------------- boot ---------------- */
  if (!profile.name) profile.moki = MOKI.randomConfig(1);
  save();
  paintHome();
  var deep = location.hash.match(/^#(\d{6})$/);
  if (deep) { $('joinPin').value = deep[1]; show('join'); }
})();
