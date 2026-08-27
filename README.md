# MOKI

A fast, colourful live multiplayer knowledge game. One person hosts on a big screen,
everyone else joins from their phone with a 6-digit PIN, and each player has their own
customizable cartoon MOKI character.

Original branding, UI, characters, animations and code — no third-party game assets,
no paid APIs.

---

## Run it locally

```bash
npm install
```

```bash
npm start
```

Then open <http://localhost:3000>.

- **Host:** Create Game → title + topic → add questions (or hit *MOKI Spark*) → Start game → share the PIN.
- **Players:** open the same address on their phones → Join Game → PIN → nickname → play.

To test on your own machine, open a second browser tab (or an incognito window) as the player.
Players on other devices need your LAN address, e.g. `http://192.168.1.5:3000`.

---

## Deploy to Render

1. Push this folder to a GitHub repository.
2. On Render: **New → Web Service**, connect the repo.
3. Settings:
   - **Environment:** Node
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Instance type:** any (free tier works)
4. No environment variables are required — the server reads `process.env.PORT`,
   which Render sets automatically.

Socket.IO works over Render's default HTTP service; no extra configuration is needed.
Because game state lives in memory, run a **single instance** (scaling to multiple
instances would split games across processes).

---

## Architecture

```
server.js            Express + Socket.IO. Owns ALL game state and scoring.
question-bank.js     "MOKI Spark" — offline question generator, no external API.
public/
  index.html         Every screen as a section; only one is .active at a time.
  css/style.css      The whole MOKI visual system.
  js/moki-catalog.js Character part catalog. Loaded by the browser AND require()d
                     by the server, so both validate against the same list.
  js/moki-render.js  Layered inline-SVG character renderer + animation moods.
  js/app.js          Screens, quiz creator, customizer, socket play, XP, confetti.
```

**Rooms.** Each game gets two Socket.IO rooms: `g:<pin>` (host + all players) and
`h:<pin>` (host only). Reveal payloads differ per audience — the host sees answer
distribution, each player sees only their own result — so many games run side by side
without leaking anything between them.

**Server authority.** The client never computes a score. On `player:answer` the server
checks the game state, that the player hasn't already answered, that the choice is
0–3, and that the server clock is still inside the question window. Points are
`1000 × (1 − 0.5 × elapsed/limit)` plus a streak bonus, computed server-side only.
The correct answer index is never included in the live `game:question` payload — it is
sent only at reveal — so it cannot be read out of the network tab.

**Validation.** Quiz text, nicknames, topics and image URLs are stripped of angle
brackets and control characters and length-capped before storage. Image URLs must be
`https:` or a base64 `data:image/*`. Every cosmetic a client claims is checked against
`moki-catalog.js` and silently falls back to the default if unknown.

**Lifecycle.** A player disconnect in the lobby removes them; mid-game they keep their
score and can reconnect with their token (or their nickname) and drop straight back into
the live question. A host disconnect gives a 20-second grace window for a refresh before
the game closes; if the host stays gone, the reveal auto-advances so players aren't
stranded. Abandoned games are swept every minute.

**XP and cosmetics.** XP, level and unlocks are stored in the browser's `localStorage`
and are purely visual — they never touch scoring or matchmaking. XP is awarded by the
server at the end of a game (participation + correct answers + podium bonus).

---

## Sharing quizzes with a code

Nobody downloads or uploads a file. In the creator:

- **Share this quiz** saves it on the server and shows a code like `MOKI-X7K4P`.
- **Load a quiz code** pulls that quiz into anyone else's creator.

Codes are random, not sequential, so nobody can count upward through other
people's quizzes. The alphabet leaves out `0 O 1 I 5 S` so a code read off a screen
can't be mistyped into someone else's quiz. Input is forgiving: `MOKI-X7K4P`,
`moki x7k4p` and `x7k4p` all work.

The library holds 3000 quizzes and drops the oldest beyond that.

### Where quizzes are stored

`store.js` picks its backend from the environment — nothing else in the app knows
the difference:

| `DATABASE_URL` | Backend | Survives a restart? |
| --- | --- | --- |
| not set | `data/quizzes.json` on disk (override the folder with `MOKI_DATA_DIR`) | Locally yes; on Render's free tier **no** — the disk is wiped on every deploy |
| set | PostgreSQL, table `moki_quizzes` | Yes |

Live games always live in memory either way. If the database is unreachable the
server still starts and games run normally — only quiz codes are unavailable, and
the creator says so instead of hanging.

### Free database on Neon (recommended)

Render's own free Postgres is deleted after 30 days; [Neon](https://neon.com)'s free
tier has no expiry.

1. Sign up at <https://neon.com> and create a project (any region near you).
2. Copy the **connection string** — it looks like
   `postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`.
3. In Render: your service → **Environment** → **Add Environment Variable**
   - Key: `DATABASE_URL`
   - Value: the connection string
4. Save. Render redeploys, and the log shows `MOKI quiz library: postgres`.

The table is created automatically on first boot — there is no migration to run.
Supabase or Render Postgres work identically; only the connection string changes.

---

## Accessibility

- Answers are reachable by keyboard; players can also press **1–4** to answer.
- Visible focus rings on every control.
- `prefers-reduced-motion` disables animations and confetti.
- Sound is off-by-default-safe: a toggle on the home screen persists your choice.
