type Mv3CompatGlobal = typeof globalThis & {
  chrome?: ChromeGlobal;
  localStorage?: unknown;
  window?: unknown;
};

type LocalStorageShimInstance = {
  readonly length: number;
  clear(): void;
  getItem(key: unknown): string | null;
  key(index: number): string | null;
  ready?: Promise<unknown>;
  removeItem(key: unknown): void;
  setItem(key: unknown, value: unknown): void;
  [key: string]: unknown;
};

type LocalStorageShimConstructor = {
  new(): LocalStorageShimInstance;
  prototype: LocalStorageShimInstance;
};

(function(global: Mv3CompatGlobal) {
  'use strict';

  if (typeof window === 'undefined') {
    global.window = global as unknown as Window & typeof globalThis;
  }

  const chromeApi = global.chrome;
  if (chromeApi) {
    let legacyActionKey = 'browser';
    legacyActionKey += 'Action';
    if (!chromeApi[legacyActionKey] && chromeApi.action) {
      chromeApi[legacyActionKey] = chromeApi.action;
    }
  }

  if (typeof global.localStorage === 'undefined') {
    let data: Record<string, string> = {};
    const dirty: Record<string, boolean> = {};
    let ready: Promise<unknown> = Promise.resolve();
    const persist = (key: string) => {
      dirty[key] = true;
      if (chromeApi && chromeApi.storage && chromeApi.storage.local) {
        const item: Record<string, unknown> = {};
        item['__localStorage__.' + key] = data[key];
        chromeApi.storage.local.set(item);
      }
    };

    if (chromeApi && chromeApi.storage && chromeApi.storage.local) {
      ready = new Promise<unknown>((resolve) => {
        chromeApi.storage.local.get(null, (items) => {
          const prefix = '__localStorage__.';
          if (items) {
            Object.keys(items).forEach((key: string) => {
              if (!key.startsWith(prefix)) {
                return;
              }
              const localKey = key.slice(prefix.length);
              if (!dirty[localKey]) {
                data[localKey] = items[key] as string;
              }
            });
          }
          resolve(null);
        });
      });
    }

    const LocalStorageShim = function() {} as unknown as LocalStorageShimConstructor;
    Object.defineProperty(LocalStorageShim.prototype, 'length', {
      get() {
        return Object.keys(data).length;
      }
    });
    LocalStorageShim.prototype.key = (index: number) => {
      return Object.keys(data)[index] || null;
    };
    LocalStorageShim.prototype.getItem = (key: unknown) => {
      const storageKey = String(key);
      return Object.prototype.hasOwnProperty.call(data, storageKey) ? data[storageKey] : null;
    };
    LocalStorageShim.prototype.setItem = (key: unknown, value: unknown) => {
      const storageKey = String(key);
      data[storageKey] = String(value);
      persist(storageKey);
    };
    LocalStorageShim.prototype.removeItem = (key: unknown) => {
      const storageKey = String(key);
      delete data[storageKey];
      if (chromeApi && chromeApi.storage && chromeApi.storage.local) {
        chromeApi.storage.local.remove('__localStorage__.' + storageKey);
      }
    };
    LocalStorageShim.prototype.clear = () => {
      Object.keys(data).forEach((key: string) => {
        dirty[key] = true;
      });
      data = {};
    };

    const localStorageShim = new LocalStorageShim();
    Object.defineProperty(localStorageShim, 'ready', {
      value: ready
    });

    global.localStorage = new Proxy(localStorageShim, {
      get(target, prop) {
        if (prop in target) {
          return (target as Record<PropertyKey, unknown>)[prop];
        }
        return target.getItem(prop);
      },
      set(target, prop, value) {
        target.setItem(prop, value);
        return true;
      },
      deleteProperty(target, prop) {
        target.removeItem(prop);
        return true;
      }
    });
  }
})(this as unknown as Mv3CompatGlobal);
