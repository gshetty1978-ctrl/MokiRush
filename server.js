'use strict';
const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const CATALOG = require('./public/js/moki-catalog.js');
const BANK = require('./question-bank.js');
const { create: createStore, normalizeCode } = require('./store.js');

const store = createStore();

const app = express();
app.use(express.json({ limit: '3mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

/* ------------------------------------------------------------------ *
 * limits & helpers
 * ------------------------------------------------------------------ */
const LIMITS = {
  title: 60, qText: 200, answer: 100, nick: 14,
  maxQuestions: 60, maxPlayers: 200, image: 600,
  minTime: 5, maxTime: 120
};
const BASE_POINTS = 1000;
const STREAK_BONUS = 50;
const REVEAL_MS = 4500;

function clean(str, max) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/[\u0000-\u001F]/g, ' ')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, max);
}
function isSafeImage(url) {
  if (typeof url !== 'string' || !url) return false;
  if (url.length > LIMITS.image) return false;
  return /^https:\/\/[^\s"']+$/i.test(url) ||
    /^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(url);
}
function newPin() {
  let pin, guard = 0;
  do { pin = String(Math.floor(100000 + Math.random() * 900000)); }
  while (games.has(pin) && ++guard < 5000);
  return pin;
}

/* ------------------------------------------------------------------ *
 * validation
 * ------------------------------------------------------------------ */
function validateQuiz(raw) {
  if (!raw || typeof raw !== 'object') return { error: 'Quiz data missing.' };
  const title = clean(raw.title, LIMITS.title) || 'Untitled MOKI Quiz';
  const topic = clean(raw.topic, 40) || 'General';
  if (!Array.isArray(raw.questions) || raw.questions.length === 0) {
    return { error: 'Add at least one question before starting.' };
  }
  if (raw.questions.length > LIMITS.maxQuestions) {
    return { error: 'Too many questions (max ' + LIMITS.maxQuestions + ').' };
  }
  const questions = [];
  for (let i = 0; i < raw.questions.length; i++) {
    const q = raw.questions[i] || {};
    const text = clean(q.text, LIMITS.qText);
    if (!text) return { error: 'Question ' + (i + 1) + ' has no text.' };
    if (!Array.isArray(q.answers) || q.answers.length !== 4) {
      return { error: 'Question ' + (i + 1) + ' needs exactly 4 answers.' };
    }
    const answers = q.answers.map(a => clean(a, LIMITS.answer));
    if (answers.some(a => !a)) return { error: 'Question ' + (i + 1) + ' has an empty answer.' };
    const correct = Number(q.correct);
    if (!Number.isInteger(correct) || correct < 0 || correct > 3) {
      return { error: 'Question ' + (i + 1) + ' has no correct answer selected.' };
    }
    let time = Number(q.time);
    if (!Number.isFinite(time)) time = 20;
    time = Math.min(LIMITS.maxTime, Math.max(LIMITS.minTime, Math.round(time)));
    const image = isSafeImage(q.image) ? q.image : '';
    questions.push({ text, answers, correct, time, image });
  }
  return { quiz: { title, topic, questions } };
}

function validateMoki(raw) {
  const out = {};
  Object.keys(CATALOG).forEach(part => {
    const list = CATALOG[part];
    const wanted = raw && typeof raw === 'object' ? raw[part] : null;
    const found = list.find(o => o.id === wanted);
    out[part] = found ? found.id : list[0].id;
  });
  return out;
}

/* ------------------------------------------------------------------ *
 * game store
 * ------------------------------------------------------------------ */
const games = new Map();
const socketIndex = new Map();

function makeGame(pin, hostSocketId, quiz) {
  return {
    pin, hostSocketId, hostConnected: true, quiz,
    players: new Map(),
    state: 'lobby',
    qIndex: -1, askedAt: 0, deadline: 0,
    timer: null, revealTimer: null,
    answers: new Map(),
    createdAt: Date.now()
  };
}

function publicPlayers(game) {
  return [...game.players.values()]
    .map(p => ({ id: p.id, nick: p.nick, moki: p.moki, score: p.score, connected: p.connected }));
}

function leaderboard(game) {
  return [...game.players.values()]
    .sort((a, b) => b.score - a.score || a.nick.localeCompare(b.nick))
    .map((p, i) => ({
      rank: i + 1, id: p.id, nick: p.nick, moki: p.moki,
      score: p.score, streak: p.streak, correct: p.correct
    }));
}

function sendLobby(game) {
  io.to('g:' + game.pin).emit('lobby:update', {
    players: publicPlayers(game),
    count: game.players.size,
    title: game.quiz.title,
    topic: game.quiz.topic,
    questionCount: game.quiz.questions.length
  });
}

function clearTimers(game) {
  if (game.timer) { clearTimeout(game.timer); game.timer = null; }
  if (game.revealTimer) { clearTimeout(game.revealTimer); game.revealTimer = null; }
}

function destroyGame(pin, reason) {
  const game = games.get(pin);
  if (!game) return;
  clearTimers(game);
  io.to('g:' + pin).emit('game:closed', { reason: reason || 'The host ended this MOKI game.' });
  games.delete(pin);
}

/* ------------------------------------------------------------------ *
 * game flow
 * ------------------------------------------------------------------ */
function askQuestion(game) {
  clearTimers(game);
  game.qIndex += 1;
  if (game.qIndex >= game.quiz.questions.length) return finishGame(game);

  const q = game.quiz.questions[game.qIndex];
  game.state = 'question';
  game.answers = new Map();
  game.askedAt = Date.now();
  game.deadline = game.askedAt + q.time * 1000;

  // the correct index is never sent while the question is live
  io.to('g:' + game.pin).emit('game:question', {
    index: game.qIndex,
    total: game.quiz.questions.length,
    text: q.text,
    answers: q.answers,
    image: q.image,
    time: q.time,
    endsAt: game.deadline,
    serverNow: Date.now()
  });

  game.timer = setTimeout(() => revealAnswer(game), q.time * 1000 + 400);
}

function revealAnswer(game) {
  if (game.state !== 'question') return;
  clearTimers(game);
  game.state = 'reveal';
  const q = game.quiz.questions[game.qIndex];

  const counts = [0, 0, 0, 0];
  game.players.forEach(p => {
    const a = game.answers.get(p.id);
    if (a) {
      counts[a.choice] += 1;
      p.answered += 1;
    }
    if (a && a.correct) {
      p.correct += 1;
      p.streak += 1;
      p.bestStreak = Math.max(p.bestStreak, p.streak);
    } else {
      p.streak = 0;
    }
  });

  const board = leaderboard(game);
  const rankOf = new Map(board.map(r => [r.id, r.rank]));
  const isLast = game.qIndex >= game.quiz.questions.length - 1;

  // safe to share once the answer is out
  const gotIt = [];
  game.players.forEach(p => {
    const a = game.answers.get(p.id);
    if (a && a.correct) gotIt.push({ nick: p.nick, moki: p.moki, points: a.points });
  });
  gotIt.sort((x, y) => y.points - x.points);

  io.to('h:' + game.pin).emit('game:reveal', {
    index: game.qIndex,
    total: game.quiz.questions.length,
    correct: q.correct,
    answers: q.answers,
    counts,
    leaderboard: board.slice(0, 8),
    gotIt,
    responses: game.answers.size,
    players: game.players.size,
    isLast
  });

  game.players.forEach(p => {
    if (!p.socketId) return;
    const a = game.answers.get(p.id);
    io.to(p.socketId).emit('game:reveal', {
      index: game.qIndex,
      total: game.quiz.questions.length,
      correct: q.correct,
      answers: q.answers,
      counts,
      you: {
        answered: !!a,
        choice: a ? a.choice : null,
        wasCorrect: !!(a && a.correct),
        points: a ? a.points : 0,
        score: p.score,
        rank: rankOf.get(p.id) || 0,
        streak: p.streak
      },
      leaderboard: board.slice(0, 5),
      gotIt,
      isLast
    });
  });

  // a solo run has nobody to press Next, so the server advances it
  if (game.solo) {
    game.revealTimer = setTimeout(() => {
      if (game.state === 'reveal') nextStep(game);
    }, 4200);
    return;
  }

  // if the host vanished, keep the game moving for the players
  game.revealTimer = setTimeout(() => {
    if (game.state === 'reveal' && !game.hostConnected) nextStep(game);
  }, REVEAL_MS * 3);
}

function nextStep(game) {
  if (game.state === 'over') return;
  if (game.qIndex >= game.quiz.questions.length - 1) return finishGame(game);
  askQuestion(game);
}

function finishGame(game) {
  clearTimers(game);
  game.state = 'over';
  const board = leaderboard(game);
  const total = game.quiz.questions.length;

  const withXp = board.map(r => {
    const p = game.players.get(r.id);
    const xp = 15
      + (p ? p.answered * 5 : 0)
      + (p ? p.correct * 12 : 0)
      + (r.rank === 1 ? 60 : r.rank === 2 ? 40 : r.rank === 3 ? 25 : 0);
    const accuracy = total ? Math.round((r.correct / total) * 100) : 0;
    return Object.assign({}, r, {
      xp, accuracy,
      answered: p ? p.answered : 0,
      bestStreak: p ? p.bestStreak : 0,
      totalQuestions: total
    });
  });

  io.to('h:' + game.pin).emit('game:over', {
    title: game.quiz.title,
    leaderboard: withXp,
    totalQuestions: total
  });

  withXp.forEach(row => {
    const p = game.players.get(row.id);
    if (p && p.socketId) {
      io.to(p.socketId).emit('game:over', {
        title: game.quiz.title,
        leaderboard: withXp.slice(0, 10),
        totalQuestions: total,
        you: row
      });
    }
  });
}

function scoreAnswer(q, elapsedMs) {
  const limit = q.time * 1000;
  const ratio = Math.max(0, Math.min(1, elapsedMs / limit));
  return Math.round(BASE_POINTS * (1 - ratio * 0.5));
}

function resendCurrent(game, player) {
  if (game.state !== 'question') return;
  const q = game.quiz.questions[game.qIndex];
  io.to(player.socketId).emit('game:question', {
    index: game.qIndex,
    total: game.quiz.questions.length,
    text: q.text,
    answers: q.answers,
    image: q.image,
    time: q.time,
    endsAt: game.deadline,
    serverNow: Date.now(),
    alreadyAnswered: game.answers.has(player.id)
  });
}

/* ------------------------------------------------------------------ *
 * sockets
 * ------------------------------------------------------------------ */
io.on('connection', socket => {

  socket.on('host:create', (payload, ack) => {
    const cb = typeof ack === 'function' ? ack : () => {};
    const res = validateQuiz(payload && payload.quiz);
    if (res.error) return cb({ ok: false, error: res.error });
    if (games.size > 500) return cb({ ok: false, error: 'Server is at capacity, try again shortly.' });

    const pin = newPin();
    const game = makeGame(pin, socket.id, res.quiz);
    games.set(pin, game);
    socket.join('g:' + pin);
    socket.join('h:' + pin);
    socketIndex.set(socket.id, { pin, role: 'host' });
    cb({ ok: true, pin, quiz: res.quiz });
    sendLobby(game);
  });

  socket.on('host:resume', (payload, ack) => {
    const cb = typeof ack === 'function' ? ack : () => {};
    const pin = clean(payload && payload.pin, 6);
    const game = games.get(pin);
    if (!game) return cb({ ok: false, error: 'Game no longer exists.' });
    if (game.hostConnected) return cb({ ok: false, error: 'This game already has a host.' });
    game.hostConnected = true;
    game.hostSocketId = socket.id;
    socket.join('g:' + pin);
    socket.join('h:' + pin);
    socketIndex.set(socket.id, { pin, role: 'host' });
    cb({ ok: true, pin, quiz: game.quiz, state: game.state });
    sendLobby(game);
  });

  socket.on('player:join', (payload, ack) => {
    const cb = typeof ack === 'function' ? ack : () => {};
    const pin = clean(payload && payload.pin, 6);
    if (!/^\d{6}$/.test(pin)) return cb({ ok: false, error: 'PIN must be 6 digits.' });
    const game = games.get(pin);
    if (!game) return cb({ ok: false, error: 'No MOKI game found with that PIN.' });

    const nick = clean(payload && payload.nick, LIMITS.nick);
    if (nick.length < 2) return cb({ ok: false, error: 'Nickname needs at least 2 characters.' });
    if (!/[A-Za-z0-9]/.test(nick)) return cb({ ok: false, error: 'Nickname needs a letter or number.' });

    const moki = validateMoki(payload && payload.moki);
    const token = clean(payload && payload.token, 40);

    let existing = null;
    game.players.forEach(p => { if (!existing && token && p.token === token) existing = p; });
    if (!existing) {
      game.players.forEach(p => {
        if (!existing && !p.connected && p.nick.toLowerCase() === nick.toLowerCase()) existing = p;
      });
    }

    if (existing) {
      existing.connected = true;
      existing.socketId = socket.id;
      existing.moki = moki;
      socket.join('g:' + pin);
      socketIndex.set(socket.id, { pin, role: 'player', playerId: existing.id });
      cb({
        ok: true, pin, playerId: existing.id, token: existing.token, nick: existing.nick,
        title: game.quiz.title, topic: game.quiz.topic, state: game.state,
        resumed: true, score: existing.score
      });
      sendLobby(game);
      resendCurrent(game, existing);
      return;
    }

    if (game.state !== 'lobby') return cb({ ok: false, error: 'That game has already started.' });
    if (game.players.size >= LIMITS.maxPlayers) return cb({ ok: false, error: 'This game is full.' });

    const taken = [...game.players.values()].some(p => p.nick.toLowerCase() === nick.toLowerCase());
    if (taken) return cb({ ok: false, error: 'That nickname is taken - pick another.' });

    const id = 'p' + Math.random().toString(36).slice(2, 10);
    const player = {
      id,
      token: Math.random().toString(36).slice(2) + Date.now().toString(36),
      nick, moki, score: 0, streak: 0, bestStreak: 0, correct: 0, answered: 0,
      connected: true, socketId: socket.id
    };
    game.players.set(id, player);
    socket.join('g:' + pin);
    socketIndex.set(socket.id, { pin, role: 'player', playerId: id });

    cb({
      ok: true, pin, playerId: id, token: player.token, nick,
      title: game.quiz.title, topic: game.quiz.topic, state: game.state, score: 0
    });
    sendLobby(game);
    io.to('h:' + pin).emit('player:entered', { nick, moki });
  });

  socket.on('player:moki', payload => {
    const ref = socketIndex.get(socket.id);
    if (!ref || ref.role !== 'player') return;
    const game = games.get(ref.pin);
    if (!game || game.state !== 'lobby') return;
    const p = game.players.get(ref.playerId);
    if (!p) return;
    p.moki = validateMoki(payload && payload.moki);
    sendLobby(game);
  });

  socket.on('host:start', (_payload, ack) => {
    const cb = typeof ack === 'function' ? ack : () => {};
    const ref = socketIndex.get(socket.id);
    if (!ref || ref.role !== 'host') return cb({ ok: false, error: 'You are not hosting a game.' });
    const game = games.get(ref.pin);
    if (!game || game.hostSocketId !== socket.id) return cb({ ok: false, error: 'Game not found.' });
    if (game.state !== 'lobby') return cb({ ok: false, error: 'Game already started.' });
    if (game.players.size === 0) return cb({ ok: false, error: 'Wait for at least one player to join.' });
    cb({ ok: true });
    io.to('g:' + game.pin).emit('game:starting', { in: 3 });
    setTimeout(() => { if (games.has(game.pin)) askQuestion(game); }, 3000);
  });

  socket.on('host:skip', () => {
    const ref = socketIndex.get(socket.id);
    if (!ref || ref.role !== 'host') return;
    const game = games.get(ref.pin);
    if (game && game.state === 'question') revealAnswer(game);
  });

  socket.on('host:next', () => {
    const ref = socketIndex.get(socket.id);
    if (!ref || ref.role !== 'host') return;
    const game = games.get(ref.pin);
    if (game && game.state === 'reveal') nextStep(game);
  });

  socket.on('host:end', () => {
    const ref = socketIndex.get(socket.id);
    if (!ref || ref.role !== 'host') return;
    const game = games.get(ref.pin);
    if (game && game.state !== 'over') finishGame(game);
  });

  socket.on('host:kick', payload => {
    const ref = socketIndex.get(socket.id);
    if (!ref || ref.role !== 'host') return;
    const game = games.get(ref.pin);
    if (!game) return;
    const p = game.players.get(clean(payload && payload.playerId, 20));
    if (!p) return;
    if (p.socketId) io.to(p.socketId).emit('game:closed', { reason: 'The host removed you from this game.' });
    game.players.delete(p.id);
    sendLobby(game);
  });

  socket.on('player:answer', (payload, ack) => {
    const cb = typeof ack === 'function' ? ack : () => {};
    const ref = socketIndex.get(socket.id);
    if (!ref || ref.role !== 'player') return cb({ ok: false, error: 'Not in a game.' });
    const game = games.get(ref.pin);
    if (!game || game.state !== 'question') return cb({ ok: false, error: 'No live question.' });

    const p = game.players.get(ref.playerId);
    if (!p) return cb({ ok: false, error: 'Player not found.' });
    if (game.answers.has(p.id)) return cb({ ok: false, error: 'You already answered.' });

    const choice = Number(payload && payload.choice);
    if (!Number.isInteger(choice) || choice < 0 || choice > 3) return cb({ ok: false, error: 'Invalid answer.' });

    // scored from the server clock only
    const now = Date.now();
    if (now > game.deadline + 500) return cb({ ok: false, error: 'Too late.' });
    const elapsed = Math.max(0, now - game.askedAt);

    const q = game.quiz.questions[game.qIndex];
    const correct = choice === q.correct;
    let points = 0;
    if (correct) {
      points = scoreAnswer(q, elapsed) + Math.min(5, p.streak) * STREAK_BONUS;
      p.score += points;
    }
    game.answers.set(p.id, { choice, ms: elapsed, correct, points });

    cb({ ok: true, locked: choice });

    // everyone sees THAT someone answered - never what they picked
    io.to('g:' + game.pin).emit('reaction:locked', {
      id: p.id, nick: p.nick, moki: p.moki,
      order: game.answers.size, players: game.players.size
    });

    io.to('h:' + game.pin).emit('answer:count', {
      responses: game.answers.size,
      players: game.players.size
    });

    const live = [...game.players.values()].filter(x => x.connected).length;
    if (game.answers.size >= live) {
      setTimeout(() => { if (game.state === 'question') revealAnswer(game); }, 350);
    }
  });

  /* Solo run: one socket is both the host and the only player. It reuses the
     whole normal question/score/reveal path, so scoring stays server-side. */
  socket.on('solo:start', (payload, ack) => {
    const cb = typeof ack === 'function' ? ack : () => {};
    const res = validateQuiz(payload && payload.quiz);
    if (res.error) return cb({ ok: false, error: res.error });
    if (games.size > 500) return cb({ ok: false, error: 'Server is busy, try again shortly.' });

    let nick = clean(payload && payload.nick, LIMITS.nick);
    if (nick.length < 2) nick = 'You';
    const moki = validateMoki(payload && payload.moki);

    const pin = newPin();
    const game = makeGame(pin, socket.id, res.quiz);
    game.solo = true;
    games.set(pin, game);

    const id = 'p' + Math.random().toString(36).slice(2, 10);
    game.players.set(id, {
      id,
      token: Math.random().toString(36).slice(2) + Date.now().toString(36),
      nick, moki, score: 0, streak: 0, bestStreak: 0, correct: 0, answered: 0,
      connected: true, socketId: socket.id
    });

    socket.join('g:' + pin);
    socketIndex.set(socket.id, { pin, role: 'player', playerId: id });

    cb({
      ok: true, pin, playerId: id, nick,
      title: game.quiz.title, topic: game.quiz.topic,
      questionCount: game.quiz.questions.length
    });

    io.to(socket.id).emit('game:starting', { in: 3 });
    setTimeout(() => { if (games.has(pin)) askQuestion(game); }, 3000);
  });

  socket.on('solo:quit', () => {
    const ref = socketIndex.get(socket.id);
    if (!ref) return;
    const game = games.get(ref.pin);
    if (game && game.solo) destroyGame(ref.pin, 'Solo run ended.');
  });

  socket.on('disconnect', () => {
    const ref = socketIndex.get(socket.id);
    socketIndex.delete(socket.id);
    if (!ref) return;
    const game = games.get(ref.pin);
    if (!game) return;

    if (ref.role === 'host') {
      game.hostConnected = false;
      setTimeout(() => {
        const g = games.get(ref.pin);
        if (g && !g.hostConnected) destroyGame(ref.pin, 'The host left - this game is over.');
      }, 20000);
    } else {
      if (game.solo) return destroyGame(ref.pin, 'Solo run ended.');
      const p = game.players.get(ref.playerId);
      if (p) {
        p.connected = false;
        p.socketId = null;
        if (game.state === 'lobby') game.players.delete(p.id);
        sendLobby(game);
      }
    }
  });
});

/* sweep abandoned games */
setInterval(() => {
  const now = Date.now();
  games.forEach((g, pin) => {
    const stale = now - g.createdAt > 1000 * 60 * 60 * 6;
    const empty = g.players.size === 0 && !g.hostConnected;
    if (stale || empty) destroyGame(pin, 'Game expired.');
  });
}, 60000);

/* ------------------------------------------------------------------ *
 * http api
 * ------------------------------------------------------------------ */
app.get('/api/catalog', (_req, res) => res.json(CATALOG));

app.get('/api/pin/:pin', (req, res) => {
  const g = games.get(String(req.params.pin));
  if (!g) return res.status(404).json({ ok: false });
  res.json({ ok: true, title: g.quiz.title, topic: g.quiz.topic, state: g.state, players: g.players.size });
});

app.get('/api/topics', (_req, res) => res.json(BANK.topics()));

// Offline "MOKI Spark" generator - no external or paid API involved.
app.post('/api/spark', (req, res) => {
  const topic = clean(req.body && req.body.topic, 40);
  const count = Math.min(10, Math.max(1, Number(req.body && req.body.count) || 5));
  const questions = BANK.generate(topic, count);
  if (!questions.length) {
    return res.status(422).json({
      ok: false,
      error: 'MOKI Spark has no ready-made questions for "' + topic + '" yet - write your own below.'
    });
  }
  res.json({ ok: true, topic, questions });
});

/* ------------------------------------------------------------------ *
 * quiz library - share a quiz with a short code instead of a file
 * ------------------------------------------------------------------ */
app.post('/api/quiz', async (req, res) => {
  const result = validateQuiz(req.body && req.body.quiz);
  if (result.error) return res.status(400).json({ ok: false, error: result.error });
  try {
    const code = await store.put(result.quiz);
    if (!code) return res.status(503).json({ ok: false, error: 'Quiz library is busy, try again.' });
    res.json({ ok: true, code, title: result.quiz.title, questionCount: result.quiz.questions.length });
  } catch (err) {
    console.error('quiz save failed:', err.message);
    res.status(500).json({ ok: false, error: 'Could not save the quiz right now.' });
  }
});

app.get('/api/quiz/:code', async (req, res) => {
  const code = normalizeCode(req.params.code);
  if (!code) return res.status(404).json({ ok: false, error: 'No quiz found with that code.' });
  try {
    const quiz = await store.get(code);
    if (!quiz) return res.status(404).json({ ok: false, error: 'No quiz found with that code.' });
    res.json({ ok: true, code, quiz });
  } catch (err) {
    console.error('quiz load failed:', err.message);
    res.status(500).json({ ok: false, error: 'Could not reach the quiz library.' });
  }
});

app.get('/healthz', (_req, res) => res.send('ok'));

const PORT = process.env.PORT || 3000;

/* The quiz library is the only thing that touches storage. If it fails to
   initialise the server still starts - live games are in memory and keep
   working; only quiz codes are unavailable. */
store.init()
  .then(where => console.log('MOKI quiz library: ' + where))
  .catch(err => console.error('MOKI quiz library unavailable:', err.message))
  .finally(() => {
    server.listen(PORT, () => console.log('MOKI running on http://localhost:' + PORT));
  });
