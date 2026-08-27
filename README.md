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

## Quiz JSON format

Export/Import in the creator uses this shape:

```json
{
  "title": "Space Showdown",
  "topic": "space",
  "questions": [
    {
      "text": "Which planet is known as the Red Planet?",
      "answers": ["Mars", "Venus", "Jupiter", "Mercury"],
      "correct": 0,
      "time": 20,
      "image": ""
    }
  ]
}
```

Invalid files are rejected with a message instead of breaking the creator.

---

## Accessibility

- Answers are reachable by keyboard; players can also press **1–4** to answer.
- Visible focus rings on every control.
- `prefers-reduced-motion` disables animations and confetti.
- Sound is off-by-default-safe: a toggle on the home screen persists your choice.
