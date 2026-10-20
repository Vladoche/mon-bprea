import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../assets/theme-init.js', import.meta.url), 'utf8');

export function appearanceStorage(initial = {}) {
  const entries = new Map(Object.entries(initial));
  return {
    getItem(key) { return entries.get(key) ?? null; },
    setItem(key, value) { entries.set(key, String(value)); },
    removeItem(key) { entries.delete(key); },
    clear() { entries.clear(); },
    snapshot() { return Object.fromEntries(entries); },
  };
}

function events(properties = {}) {
  const listeners = new Map();
  return {
    ...properties,
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    dispatchEvent(event) {
      for (const listener of listeners.get(event.type) ?? []) listener(event);
    },
  };
}

/** Execute the real pre-CSS classic script; only its browser boundary is simulated. */
export function appearanceRuntime(storage = appearanceStorage()) {
  const window = events({ setInterval() { return 1; } });
  const document = events({ documentElement: { dataset: {} }, hidden: false });
  const context = vm.createContext({
    window,
    document,
    localStorage: storage,
    Date,
    CustomEvent: class {
      constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
    },
  });
  vm.runInContext(source, context, { filename: 'assets/theme-init.js' });
  return { api: window.BpreaAppearance, window, document, storage };
}
