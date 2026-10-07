// Minimal Storage stand-in. Options simulate private mode / quota errors.
export function memoryStorage(initial = {}, { throwOnGet = false, throwOnSet = false } = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem(key) {
      if (throwOnGet) throw new Error('SecurityError');
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      if (throwOnSet) throw new Error('QuotaExceededError');
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
  };
}
