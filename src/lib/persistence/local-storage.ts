"use client";

const NAMESPACE = "sudoku-arena";

function key(name: string) {
  return `${NAMESPACE}:${name}`;
}

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export const localPersistence = {
  get<T>(name: string, fallback: T): T {
    if (!isBrowser()) return fallback;
    try {
      const raw = window.localStorage.getItem(key(name));
      if (raw === null) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },

  set<T>(name: string, value: T): void {
    if (!isBrowser()) return;
    try {
      window.localStorage.setItem(key(name), JSON.stringify(value));
    } catch {
      // ignore
    }
  },

  remove(name: string): void {
    if (!isBrowser()) return;
    try {
      window.localStorage.removeItem(key(name));
    } catch {
      // ignore
    }
  },

  has(name: string): boolean {
    if (!isBrowser()) return false;
    return window.localStorage.getItem(key(name)) !== null;
  },

  keys(): string[] {
    if (!isBrowser()) return [];
    const out: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(`${NAMESPACE}:`)) out.push(k);
    }
    return out;
  },

  clearAll(): void {
    if (!isBrowser()) return;
    const keys = this.keys();
    for (const k of keys) {
      window.localStorage.removeItem(k);
    }
  },

  exportAll(): string {
    const dump: Record<string, unknown> = {};
    for (const k of this.keys()) {
      const short = k.slice(`${NAMESPACE}:`.length);
      try {
        dump[short] = JSON.parse(window.localStorage.getItem(k) ?? "null");
      } catch {
        dump[short] = null;
      }
    }
    return JSON.stringify({ app: NAMESPACE, version: 1, exportedAt: new Date().toISOString(), data: dump }, null, 2);
  },

  importAll(json: string): boolean {
    if (!isBrowser()) return false;
    try {
      const parsed = JSON.parse(json) as { data?: Record<string, unknown> };
      if (!parsed.data) return false;
      for (const [short, value] of Object.entries(parsed.data)) {
        window.localStorage.setItem(key(short), JSON.stringify(value));
      }
      return true;
    } catch {
      return false;
    }
  },
};

export type Persistence = typeof localPersistence;
