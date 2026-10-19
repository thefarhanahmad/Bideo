/**
 * Small in-memory TTL cache for expensive read-only queries.
 * Concurrent callers for the same key share one in-flight load;
 * failed loads are not cached.
 *
 * staleWhileRevalidate: once a value exists, an expired entry is still
 * returned immediately while a single background load refreshes it, so
 * callers never wait on a slow query after the first load.
 */
const createTtlCache = (ttlMs, maxKeys = 100, { staleWhileRevalidate = false } = {}) => {
  const entries = new Map();

  const load = (key, loader, previous) => {
    const pending = loader()
      .then((value) => {
        entries.set(key, { value, hasValue: true, expiresAt: Date.now() + ttlMs, pending: null });
        return value;
      })
      .catch((err) => {
        if (previous && previous.hasValue) {
          entries.set(key, { ...previous, pending: null });
        } else {
          entries.delete(key);
        }
        throw err;
      });
    entries.set(key, { ...(previous || { value: null, hasValue: false, expiresAt: 0 }), pending });
    if (entries.size > maxKeys) {
      entries.delete(entries.keys().next().value);
    }
    return pending;
  };

  return async (key, loader) => {
    const hit = entries.get(key);
    if (hit && hit.hasValue && hit.expiresAt > Date.now()) return hit.value;
    if (hit && hit.hasValue && staleWhileRevalidate) {
      if (!hit.pending) {
        load(key, loader, hit).catch((err) => {
          console.error(`[ttlCache] background refresh failed for "${key}":`, err.message);
        });
      }
      return hit.value;
    }
    if (hit && hit.pending) return hit.pending;
    return load(key, loader, hit);
  };
};

module.exports = { createTtlCache };
