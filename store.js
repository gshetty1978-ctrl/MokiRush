'use strict';
/* Quiz library storage.
 *
 * Two backends, chosen automatically:
 *   - DATABASE_URL set  -> PostgreSQL (survives restarts and redeploys)
 *   - DATABASE_URL unset -> a JSON file on disk (fine for local dev)
 *
 * Both expose the same async API: init(), put(quiz), get(code).
 */
const fs = require('fs');
const path = require('path');

const MAX_STORED = 3000;

/* Random codes, not sequential - a sequential code would let anyone walk the
   whole library by counting up. The alphabet drops 0/O/1/I/5/S so a code read
   off a screen cannot be mistyped into someone else's quiz. */
const CODE_ALPHABET = '2346789ABCDEFGHJKLMNPQRTUVWXYZ';
const CODE_LEN = 5;

function randomCode() {
  let body = '';
  for (let i = 0; i < CODE_LEN; i++) {
    body += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return 'MOKI-' + body;
}

// accepts "MOKI-X7K4P", "moki x7k4p" or plain "x7k4p"
function normalizeCode(input) {
  const body = String(input == null ? '' : input)
    .toUpperCase()
    .replace(/^MOKI/, '')
    .replace(/[^A-Z0-9]/g, '');
  if (body.length !== CODE_LEN) return '';
  return 'MOKI-' + body;
}

/* ------------------------------------------------------------------ *
 * file backend
 * ------------------------------------------------------------------ */
function fileStore() {
  const DATA_DIR = process.env.MOKI_DATA_DIR || path.join(__dirname, 'data');
  const FILE = path.join(DATA_DIR, 'quizzes.json');
  let items = {};
  let timer = null;

  function persist() {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(FILE, JSON.stringify({ items }));
      } catch (e) { /* read-only disk: codes still work until restart */ }
    }, 400);
  }

  return {
    kind: 'file',
    async init() {
      try {
        const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
        if (raw && raw.items) items = raw.items;
      } catch (e) { /* first boot */ }
      return 'file (' + FILE + ')';
    },
    async put(quiz) {
      const codes = Object.keys(items);
      if (codes.length >= MAX_STORED) {
        codes
          .sort((a, b) => (items[a].createdAt || 0) - (items[b].createdAt || 0))
          .slice(0, Math.ceil(MAX_STORED * 0.1))
          .forEach(c => { delete items[c]; });
      }
      for (let i = 0; i < 200; i++) {
        const code = randomCode();
        if (items[code]) continue;
        items[code] = { quiz, createdAt: Date.now() };
        persist();
        return code;
      }
      return null;
    },
    async get(code) {
      const entry = items[code];
      return entry ? entry.quiz : null;
    }
  };
}

/* ------------------------------------------------------------------ *
 * postgres backend
 * ------------------------------------------------------------------ */
function pgStore(url) {
  const { Pool } = require('pg');
  const local = /@(localhost|127\.0\.0\.1)/.test(url);
  const pool = new Pool({
    connectionString: url,
    ssl: local ? false : { rejectUnauthorized: false },
    max: 4
  });

  return {
    kind: 'postgres',
    async init() {
      await pool.query(
        'CREATE TABLE IF NOT EXISTS moki_quizzes (' +
        '  code TEXT PRIMARY KEY,' +
        '  quiz JSONB NOT NULL,' +
        '  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()' +
        ')'
      );
      await pool.query('CREATE INDEX IF NOT EXISTS moki_quizzes_created_at ON moki_quizzes (created_at)');
      return 'postgres';
    },
    async put(quiz) {
      // ON CONFLICT DO NOTHING means a code collision simply retries
      for (let i = 0; i < 200; i++) {
        const code = randomCode();
        const res = await pool.query(
          'INSERT INTO moki_quizzes (code, quiz) VALUES ($1, $2) ON CONFLICT (code) DO NOTHING RETURNING code',
          [code, JSON.stringify(quiz)]
        );
        if (res.rowCount === 1) {
          pool.query(
            'DELETE FROM moki_quizzes WHERE code IN (' +
            '  SELECT code FROM moki_quizzes ORDER BY created_at DESC OFFSET $1' +
            ')', [MAX_STORED]
          ).catch(() => {});
          return code;
        }
      }
      return null;
    },
    async get(code) {
      const res = await pool.query('SELECT quiz FROM moki_quizzes WHERE code = $1', [code]);
      return res.rowCount ? res.rows[0].quiz : null;
    }
  };
}

module.exports = {
  normalizeCode,
  MAX_STORED,
  create() {
    const url = process.env.DATABASE_URL;
    return url ? pgStore(url) : fileStore();
  }
};
