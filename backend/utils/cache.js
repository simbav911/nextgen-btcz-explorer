const cache = new Map();

function get(key) {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expires) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function set(key, value, ttlMs) {
  cache.set(key, { value, expires: Date.now() + ttlMs });
}

function clear() {
  cache.clear();
}

module.exports = { get, set, clear };
