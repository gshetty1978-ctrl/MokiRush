'use strict';
/* Keeps a Render free web service from going to sleep.
 *
 * Render suspends a free instance after ~15 minutes with no inbound traffic,
 * and the next visitor then waits ~30-60s for a cold start - painful when a
 * room full of people is trying to join a game. This pings the service's own
 * public URL on an interval so it stays warm.
 *
 * Off unless KEEP_AWAKE=1 and a public URL is known. Never runs locally.
 *
 * Trade-offs worth knowing:
 *  - A free instance has ~750 hours/month; staying awake 24/7 uses ~720 of
 *    them, so run only ONE always-awake free service per account.
 *  - Set KEEP_AWAKE_HOURS to keep it warm only when people actually play,
 *    which leaves plenty of headroom.
 */

const DEFAULT_INTERVAL_MIN = 12;   // under Render's ~15 minute idle window

function parseWindow(spec) {
  // "6-23" -> awake 06:00 to 23:59 UTC; empty -> always
  if (!spec) return null;
  const m = String(spec).match(/^(\d{1,2})\s*-\s*(\d{1,2})$/);
  if (!m) return null;
  const from = Math.min(23, Math.max(0, Number(m[1])));
  const to = Math.min(23, Math.max(0, Number(m[2])));
  return { from, to };
}

function inWindow(win, date) {
  if (!win) return true;
  const h = date.getUTCHours();
  return win.from <= win.to
    ? (h >= win.from && h <= win.to)
    : (h >= win.from || h <= win.to);   // window wrapping midnight
}

function resolveUrl() {
  const explicit = process.env.PUBLIC_URL || process.env.KEEP_AWAKE_URL;
  if (explicit) return explicit.replace(/\/+$/, '');
  // Render sets this automatically for web services
  if (process.env.RENDER_EXTERNAL_URL) return process.env.RENDER_EXTERNAL_URL.replace(/\/+$/, '');
  return null;
}

function start(log) {
  const say = log || console.log;

  if (process.env.KEEP_AWAKE !== '1') return { enabled: false, reason: 'KEEP_AWAKE is not 1' };

  const base = resolveUrl();
  if (!base) return { enabled: false, reason: 'no PUBLIC_URL / RENDER_EXTERNAL_URL to ping' };
  if (/localhost|127\.0\.0\.1/.test(base)) return { enabled: false, reason: 'refusing to ping localhost' };
  if (typeof fetch !== 'function') return { enabled: false, reason: 'fetch is unavailable (needs Node 18+)' };

  const minutes = Math.min(14, Math.max(2, Number(process.env.KEEP_AWAKE_MINUTES) || DEFAULT_INTERVAL_MIN));
  const win = parseWindow(process.env.KEEP_AWAKE_HOURS);
  const target = base + '/healthz';
  let ok = 0, failed = 0;

  async function ping() {
    if (!inWindow(win, new Date())) return;
    const control = new AbortController();
    const bail = setTimeout(() => control.abort(), 10000);
    try {
      const res = await fetch(target, {
        signal: control.signal,
        headers: { 'User-Agent': 'moki-keepalive' }
      });
      if (res.ok) ok += 1; else failed += 1;
    } catch (e) {
      failed += 1;
    } finally {
      clearTimeout(bail);
    }
  }

  // a little jitter so the pings do not land on an exact clock boundary
  const jitter = Math.floor(Math.random() * 45000);
  const timer = setInterval(ping, minutes * 60000 + jitter);
  if (timer.unref) timer.unref();
  setTimeout(ping, 30000).unref?.();

  say('MOKI keep-awake: pinging ' + target + ' every ~' + minutes + ' min' +
      (win ? ' between ' + win.from + ':00 and ' + win.to + ':59 UTC' : ''));

  return {
    enabled: true,
    target,
    minutes,
    window: win,
    stats: () => ({ ok, failed })
  };
}

module.exports = { start };
