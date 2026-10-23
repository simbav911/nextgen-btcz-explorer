// Bounded in-memory TTL cache (LRU eviction).
//
// The previous implementation was a plain Map that only dropped expired
// entries when the same key was read again, so every block / raw transaction
// ever fetched stayed in memory until pm2 restarted the process.
//
// - MAX_ENTRIES caps the number of keys (least recently used evicted first)
// - a periodic sweep removes expired entries that are never read again
// - wrap() de-duplicates concurrent loads of the same key (no stampedes)

const MAX_ENTRIES = parseInt(process.env.CACHE_MAX_ENTRIES, 10) || 5000;
const SWEEP_INTERVAL_MS = 30000;

const cache = new Map(); // key -> { value, expires }
const inflight = new Map(); // key -> Promise

function get(key) {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expires) {
    cache.delete(key);
    return undefined;
  }
  // Refresh recency (Map keeps insertion order)
  cache.delete(key);
  cache.set(key, entry);
  return entry.value;
}

function set(key, value, ttlMs) {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, { value, expires: Date.now() + ttlMs });
  while (cache.size > MAX_ENTRIES) {
    cache.delete(cache.keys().next().value);
  }
}

function del(key) {
  cache.delete(key);
}

function clear() {
  cache.clear();
}

/**
 * Return the cached value for key, or run loader() once (even under
 * concurrent callers) and cache its result for ttlMs.
 */
function wrap(key, ttlMs, loader) {
  const cached = get(key);
  if (cached !== undefined) return Promise.resolve(cached);
  if (inflight.has(key)) return inflight.get(key);

  const p = Promise.resolve()
    .then(loader)
    .then((value) => {
      if (value !== undefined) set(key, value, ttlMs);
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

function sweep() {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now > entry.expires) cache.delete(key);
  }
}

setInterval(sweep, SWEEP_INTERVAL_MS).unref();

/**
 * Helper for module-local caches keyed by user input (dates etc.):
 * a Map with a max size and an optional per-entry TTL.
 */
function createBoundedMap(maxEntries) {
  const m = new Map();
  return {
    get(key) {
      const e = m.get(key);
      if (!e) return undefined;
      if (Date.now() > e.expires) {
        m.delete(key);
        return undefined;
      }
      return e.value;
    },
    set(key, value, ttlMs = Infinity) {
      if (m.has(key)) m.delete(key);
      m.set(key, { value, expires: Date.now() + ttlMs });
      while (m.size > maxEntries) m.delete(m.keys().next().value);
    },
    has(key) {
      return this.get(key) !== undefined;
    },
    clear() {
      m.clear();
    },
    get size() {
      return m.size;
    }
  };
}

module.exports = { get, set, del, clear, wrap, createBoundedMap, size: () => cache.size };
