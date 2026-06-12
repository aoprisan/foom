import '@testing-library/jest-dom/vitest'

// Node 22+/25 ships an experimental built-in Web Storage that, without a valid
// --localstorage-file, is a degraded stub with no getItem/setItem/clear — and
// jsdom 28 defers to it rather than supplying its own. The result is a
// `localStorage` global that throws on every method, breaking MockGameClient's
// persistence and these tests. Install a real in-memory Storage so every code
// path (bare `localStorage` and `window.localStorage`) sees one working store.
class MemoryStorage implements Storage {
  private store = new Map<string, string>()
  get length() { return this.store.size }
  clear() { this.store.clear() }
  getItem(key: string) { return this.store.has(key) ? this.store.get(key)! : null }
  setItem(key: string, value: string) { this.store.set(key, String(value)) }
  removeItem(key: string) { this.store.delete(key) }
  key(i: number) { return Array.from(this.store.keys())[i] ?? null }
}

const memoryStorage = new MemoryStorage()
for (const target of [globalThis, typeof window !== 'undefined' ? window : undefined]) {
  if (target) {
    Object.defineProperty(target, 'localStorage', {
      value: memoryStorage,
      configurable: true,
      writable: true,
    })
  }
}
