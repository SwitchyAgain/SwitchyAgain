type RuntimePreloadGlobal = typeof globalThis & {
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
  new (): LocalStorageShimInstance;
  prototype: LocalStorageShimInstance;
};

(function (global: RuntimePreloadGlobal) {
  'use strict';

  if (typeof global.window === 'undefined') {
    global.window = global as unknown as Window & typeof globalThis;
  }

  const chromeApi = global.chrome;
  if (chromeApi) {
    const actionAliasKey = 'browser' + 'Action';
    if (!chromeApi[actionAliasKey] && chromeApi.action) {
      chromeApi[actionAliasKey] = chromeApi.action;
    }
  }

  if (typeof global.localStorage === 'undefined') {
    let data: Record<string, string> = {};
    const dirty: Record<string, boolean> = {};
    let ready: Promise<unknown> = Promise.resolve();
    const storagePrefix = '__localStorage__.';

    const persist = (key: string) => {
      dirty[key] = true;
      if (chromeApi?.storage?.local) {
        const item: Record<string, unknown> = {};
        item[storagePrefix + key] = data[key];
        chromeApi.storage.local.set(item);
      }
    };

    const removePersisted = (key: string) => {
      if (chromeApi?.storage?.local) {
        chromeApi.storage.local.remove(storagePrefix + key);
      }
    };

    if (chromeApi?.storage?.local) {
      ready = new Promise<unknown>((resolve) => {
        chromeApi.storage.local.get(null, (items) => {
          if (items) {
            Object.keys(items).forEach((key: string) => {
              if (!key.startsWith(storagePrefix)) {
                return;
              }
              const localKey = key.slice(storagePrefix.length);
              if (!dirty[localKey]) {
                data[localKey] = items[key] as string;
              }
            });
          }
          resolve(null);
        });
      });
    }

    const LocalStorageShim = function () {} as unknown as LocalStorageShimConstructor;
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
      removePersisted(storageKey);
    };
    LocalStorageShim.prototype.clear = () => {
      const keys = Object.keys(data);
      for (const key of keys) {
        dirty[key] = true;
        removePersisted(key);
      }
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
})(globalThis as RuntimePreloadGlobal);
