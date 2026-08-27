'use strict';
/* Tiny in-memory rate limiter. No dependency, no store - this server already
   keeps all its game state in memory, so a per-process limiter is consistent
   with the rest of it (and MOKI runs as a single instance by design). */

function createLimiter(opts) {
  const windowMs = opts.windowMs;
  const max = opts.max;
  const name = opts.name || 'requests';
  const hits = new Map();   // key -> { count, resetAt }

  // keep the map from growing without bound
  const sweep = setInterval(() => {
    const now = Date.now();
    hits.forEach((v, k) => { if (v.resetAt <= now) hits.delete(k); });
  }, Math.max(windowMs, 30000));
  if (sweep.unref) sweep.unref();

  return function limit(req, res, next) {
    const key = req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
    const now = Date.now();
    let entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;

    const remaining = Math.max(0, max - entry.count);
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));

    if (entry.count > max) {
      const retry = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retry));
      return res.status(429).json({
        ok: false,
        error: 'Too many ' + name + ' from this device. Try again in ' + retry + 's.'
      });
    }
    next();
  };
}

/* Socket events need the same protection - a socket can spam host:create or
   player:join far faster than HTTP. This counts per socket id. */
function createSocketLimiter(opts) {
  const windowMs = opts.windowMs;
  const max = opts.max;
  const hits = new Map();

  const sweep = setInterval(() => {
    const now = Date.now();
    hits.forEach((v, k) => { if (v.resetAt <= now) hits.delete(k); });
  }, Math.max(windowMs, 30000));
  if (sweep.unref) sweep.unref();

  return {
    /* returns true when the action is allowed */
    allow(key) {
      const now = Date.now();
      let entry = hits.get(key);
      if (!entry || entry.resetAt <= now) {
        entry = { count: 0, resetAt: now + windowMs };
        hits.set(key, entry);
      }
      entry.count += 1;
      return entry.count <= max;
    },
    forget(key) { hits.delete(key); }
  };
}

module.exports = { createLimiter, createSocketLimiter };
