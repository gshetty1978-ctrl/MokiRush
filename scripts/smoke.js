/* MOKI smoke test. Run the server on PORT=3210, then: node scripts/smoke.js
   Covers the paths most likely to break: joining, server-side scoring, answer
   validation, teams, solo, cosmetic validation and the quiz-code API. */
const path = require('path');

let io;
try {
  io = require(path.join(__dirname, '..', 'node_modules', 'socket.io-client')).io;
} catch (e) {
  console.error([
    '',
    'The test client is missing. Install it with:',
    '',
    '  npm install',
    ''
  ].join('\n'));
  process.exit(1);
}
const URL = process.env.SMOKE_URL || 'http://localhost:3210';

let fails = 0;
const check = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) fails++; };
const post = (p, b) => fetch(URL + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(async r => ({ s: r.status, d: await r.json() }));
const get = p => fetch(URL + p).then(async r => ({ s: r.status, d: await r.json() }));
const connect = async () => { const s = io(URL); await new Promise(r => s.on('connect', r)); return s; };

const quiz = {
  title: 'Smoke', topic: 'space',
  questions: [
    { text: 'Red planet?', answers: ['Mars', 'Venus', 'Io', 'Ceres'], correct: 0, time: 6 },
    { text: '2+2?', answers: ['3', '4', '5', '6'], correct: 1, time: 5, image: 'javascript:bad' }
  ]
};

(async () => {
  /* ---- cosmetics are validated against the shared catalog ---- */
  const cat = await get('/api/catalog');
  check('catalog serves species + aura', Array.isArray(cat.d.species) && Array.isArray(cat.d.aura));

  /* ---- core multiplayer ---- */
  const host = await connect();
  const g = await new Promise(r => host.emit('host:create', { quiz }, r));
  check('game created with a 6-digit pin', g.ok && /^\d{6}$/.test(g.pin));
  check('unsafe image stripped', g.quiz.questions[1].image === '');

  const p1 = await connect(), p2 = await connect();
  const j1 = await new Promise(r => p1.emit('player:join', {
    pin: g.pin, nick: 'Ava', moki: { species: 'fox', skin: 'NOT_REAL', aura: 'flames' }
  }, r));
  check('player joins', j1.ok);
  check('duplicate nickname rejected', !(await new Promise(r => p2.emit('player:join', { pin: g.pin, nick: 'ava' }, r))).ok);
  check('bad pin rejected', !(await new Promise(r => p2.emit('player:join', { pin: '999999', nick: 'Bob' }, r))).ok);
  const j2 = await new Promise(r => p2.emit('player:join', { pin: g.pin, nick: 'Bo<script>' }, r));
  check('xss stripped from nickname', j2.ok && !j2.nick.includes('<'));

  await new Promise(r => host.emit('host:start', {}, r));
  const q1 = await new Promise(r => p1.once('game:question', r));
  check('correct index withheld while live', q1.correct === undefined);

  check('answer accepted', (await new Promise(r => p1.emit('player:answer', { choice: 0 }, r))).ok);
  check('second answer rejected', !(await new Promise(r => p1.emit('player:answer', { choice: 1 }, r))).ok);
  check('out-of-range answer rejected', !(await new Promise(r => p2.emit('player:answer', { choice: 9 }, r))).ok);
  await new Promise(r => p2.emit('player:answer', { choice: 2 }, r));

  const rev = await new Promise(r => p1.once('game:reveal', r));
  check('fast correct answer scores', rev.correct === 0 && rev.you.wasCorrect && rev.you.points > 0);
  check('invalid cosmetic replaced with a valid one',
    cat.d.skin.some(s => s.id === rev.leaderboard[0].moki.skin));
  check('valid species survived', rev.leaderboard[0].moki.species === 'fox');

  host.emit('host:next');
  await new Promise(r => p1.once('game:question', r));
  const rev2 = await new Promise(r => p1.once('game:reveal', r));       // times out
  check('question times out and reveals', rev2.index === 1 && rev2.isLast);
  check('late answer rejected', !(await new Promise(r => p1.emit('player:answer', { choice: 1 }, r))).ok);

  host.emit('host:next');
  const over = await new Promise(r => p1.once('game:over', r));
  check('game over with xp + accuracy', over.you.xp > 0 && typeof over.you.accuracy === 'number');
  check('winner is Ava', over.leaderboard[0].nick === 'Ava');
  [host, p1, p2].forEach(s => s.close());

  /* ---- teams ---- */
  const th = await connect();
  const tg = await new Promise(r => th.emit('host:create', { quiz, teams: true }, r));
  check('team game created', tg.ok && tg.teams === true);
  const tp = await connect();
  const tj = await new Promise(r => tp.emit('player:join', { pin: tg.pin, nick: 'Cal' }, r));
  check('joiner gets a team', tj.ok && !!tj.team && tj.teams.length === 4);
  check('team switch works in the lobby', (await new Promise(r => tp.emit('player:team', { team: 'gold' }, r))).ok);
  check('unknown team rejected', !(await new Promise(r => tp.emit('player:team', { team: 'purple' }, r))).ok);
  [th, tp].forEach(s => s.close());

  /* ---- solo ---- */
  const solo = await connect();
  const sr = await new Promise(r => solo.emit('solo:start', { quiz, nick: 'Loner', moki: { species: 'dragon' } }, r));
  check('solo run starts', sr.ok && !!sr.playerId);
  await new Promise(r => solo.once('game:question', r));
  check('solo answer accepted', (await new Promise(r => solo.emit('player:answer', { choice: 0 }, r))).ok);
  const srev = await new Promise(r => solo.once('game:reveal', r));
  check('solo scores server-side', srev.you.wasCorrect && srev.you.points > 0);
  solo.close();

  /* ---- quiz codes ---- */
  const saved = await post('/api/quiz', { quiz });
  check('quiz code issued', saved.d.ok && /^MOKI-[2-9A-Z]{5}$/.test(saved.d.code));
  const body = saved.d.code.replace('MOKI-', '').toLowerCase();
  check('code loads back, any casing', (await get('/api/quiz/' + body)).d.ok);
  check('unknown code 404s', (await get('/api/quiz/ZZZZZ')).s === 404);
  check('spark generates questions', (await post('/api/spark', { topic: 'space', count: 4 })).d.questions.length === 4);

  console.log(fails ? '\n' + fails + ' FAILURES' : '\nALL SMOKE TESTS PASSED');
  process.exit(fails ? 1 : 0);
})().catch(e => {
  const msg = (e && e.message) || '';
  if (msg.includes('fetch failed') || msg.includes('ECONNREFUSED')) {
    console.error([
      '',
      'Could not reach ' + URL + '.',
      'Start the server in another terminal first, on the port the tests expect:',
      '',
      '  PORT=3210 npm start',
      ''
    ].join('\n'));
    process.exit(1);
  }
  console.error('ERROR', e);
  process.exit(1);
});
