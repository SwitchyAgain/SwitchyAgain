type Mv3CompatGlobal = typeof globalThis & {
  chrome?: ChromeGlobal;
  localStorage?: unknown;
  saveAs?: (blob: Blob, filename: string) => unknown;
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

  var chromeApi = global.chrome;
  if (chromeApi) {
    var legacyActionKey = 'browser';
    legacyActionKey += 'Action';
    if (!chromeApi[legacyActionKey] && chromeApi.action) {
      chromeApi[legacyActionKey] = chromeApi.action;
    }
  }

  if (typeof global.localStorage === 'undefined') {
    var data: Record<string, string> = {};
    var dirty: Record<string, boolean> = {};
    var ready: Promise<unknown> = Promise.resolve();
    var persist = function(key: string) {
      dirty[key] = true;
      if (chromeApi && chromeApi.storage && chromeApi.storage.local) {
        var item: Record<string, unknown> = {};
        item['__localStorage__.' + key] = data[key];
        chromeApi.storage.local.set(item);
      }
    };

    if (chromeApi && chromeApi.storage && chromeApi.storage.local) {
      ready = new Promise<unknown>(function(resolve) {
        chromeApi.storage.local.get(null, function(items) {
          var prefix = '__localStorage__.';
          if (items) {
            Object.keys(items).forEach(function(key: string) {
              if (key.substr(0, prefix.length) !== prefix) {
                return;
              }
              var localKey = key.substr(prefix.length);
              if (!dirty[localKey]) {
                data[localKey] = items[key] as string;
              }
            });
          }
          resolve(null);
        });
      });
    }

    var LocalStorageShim = function() {} as unknown as LocalStorageShimConstructor;
    Object.defineProperty(LocalStorageShim.prototype, 'length', {
      get: function() {
        return Object.keys(data).length;
      }
    });
    LocalStorageShim.prototype.key = function(index: number) {
      return Object.keys(data)[index] || null;
    };
    LocalStorageShim.prototype.getItem = function(key: unknown) {
      var storageKey = String(key);
      return Object.prototype.hasOwnProperty.call(data, storageKey) ? data[storageKey] : null;
    };
    LocalStorageShim.prototype.setItem = function(key: unknown, value: unknown) {
      var storageKey = String(key);
      data[storageKey] = String(value);
      persist(storageKey);
    };
    LocalStorageShim.prototype.removeItem = function(key: unknown) {
      var storageKey = String(key);
      delete data[storageKey];
      if (chromeApi && chromeApi.storage && chromeApi.storage.local) {
        chromeApi.storage.local.remove('__localStorage__.' + storageKey);
      }
    };
    LocalStorageShim.prototype.clear = function() {
      Object.keys(data).forEach(function(key: string) {
        dirty[key] = true;
      });
      data = {};
    };

    var localStorageShim = new LocalStorageShim();
    Object.defineProperty(localStorageShim, 'ready', {
      value: ready
    });

    global.localStorage = new Proxy(localStorageShim, {
      get: function(target, prop) {
        if (prop in target) {
          return (target as Record<PropertyKey, unknown>)[prop];
        }
        return target.getItem(prop);
      },
      set: function(target, prop, value) {
        target.setItem(prop, value);
        return true;
      },
      deleteProperty: function(target, prop) {
        target.removeItem(prop);
        return true;
      }
    });
  }

  if (typeof global.saveAs === 'undefined') {
    global.saveAs = function(blob: Blob, filename: string) {
      if (!chromeApi || !chromeApi.downloads || typeof URL === 'undefined') {
        return;
      }
      var url = URL.createObjectURL(blob);
      chromeApi.downloads.download({url: url, filename: filename, saveAs: true});
    };
  }
})(this as unknown as Mv3CompatGlobal);
