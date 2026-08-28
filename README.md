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

## Running it offline

The game needs a network but not the internet - it makes **no external requests at all**.
Socket.IO, the MOKI characters, the QR encoder, the sound effects, the question bank and
the Baloo 2 font are all served from your own machine.

- **Same Wi-Fi:** run `npm start`, then open the app on the host PC at your LAN address
  (e.g. `http://192.168.1.5:3000`), *not* `localhost` - the QR encodes whatever address
  the host browser is on, so `localhost` would send every phone back to itself.
- **No router at all:** turn on Windows Mobile Hotspot, let the phones join it, and use the
  hotspot IP the same way.

Quiz codes still work offline - with no `DATABASE_URL` the store falls back to
`data/quizzes.json`. Those codes are local only and will not resolve on the deployed site.

The font lives in `public/fonts/` (Baloo 2, SIL Open Font License 1.1, licence included).
It is a variable font, so one file per script covers every weight the UI uses, and the
browser fetches only the scripts actually on screen - 33KB for Latin.

---

## Keeping the service awake

A Render free web service sleeps after ~15 minutes with no traffic, and the next
visitor waits 30-60s for it to boot. That is rough when a room full of people is
trying to join at once.

### Recommended: an external pinger (UptimeRobot)

1. Sign up at <https://uptimerobot.com> (free plan).
2. **+ New monitor** → type **HTTP(s)**.
3. URL: `https://<your-service>.onrender.com/healthz`
4. Interval: **5 minutes**.
5. Save.

That is it. An external pinger is better than pinging from inside the app for
two reasons: it does not spend the instance’s own free hours on the requests,
and it still reaches the service after it has fallen asleep - a self-ping cannot
wake something that is already down.

`/healthz` returns a plain `ok` and touches neither the database nor any game
state, so it is cheap to hit every 5 minutes.

### Built-in fallback

`waker.js` can do the same from inside the app if you would rather not use an
external service. It is **off** unless `KEEP_AWAKE=1`, and refuses to ping
localhost so local runs are unaffected.

| Variable | Value |
| --- | --- |
| `KEEP_AWAKE` | `1` to enable |
| `KEEP_AWAKE_HOURS` | optional UTC window, e.g. `2-18` |
| `KEEP_AWAKE_MINUTES` | optional, default 12, capped at 14 |
| `PUBLIC_URL` | only if `RENDER_EXTERNAL_URL` is not set |

A free instance gets ~750 hours a month and staying awake 24/7 burns ~720, so
run only one always-awake free service per account, and prefer
`KEEP_AWAKE_HOURS` to stay warm only when people actually play.

---

## Joining by QR

The host lobby shows a QR code next to the PIN. It encodes `<origin>/#<pin>`, and
the client reads that hash on load to pre-fill the PIN, so scanning drops a player
straight onto the join screen.

`public/js/qr.js` is a small from-scratch encoder (byte mode, ECC level M,
versions 1-10) - no library, no CDN, no image service, so it works offline. If it
ever throws, the card simply stays hidden and the PIN still works.

## Accessibility

- Answers are reachable by keyboard; players can also press **1–4** to answer.
- Visible focus rings on every control.
- `prefers-reduced-motion` disables animations and confetti.
- Sound is off-by-default-safe: a toggle on the home screen persists your choice.
