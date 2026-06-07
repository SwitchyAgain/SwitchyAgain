import {chromeApiPromisify} from './chrome_api';
import OmegaTargetModule = require('omega-target');

type StorageItems = Record<string, unknown>;
type StorageKeys = string | string[] | StorageItems | null;
type WatchKeys = string | string[] | null;
type WatchKeyMap = Record<string, boolean> | null;
type WatchCallback = (changes: StorageItems) => unknown;
type StorageAreaName = 'local' | 'sync';
type WatchUnsubscribe = () => void;

type ChromeStorageChange = {
  newValue?: unknown;
};

type StorageArea = {
  clear: () => PromiseLike<unknown>;
  get: (keys: StorageKeys) => PromiseLike<unknown>;
  remove: (keys: WatchKeys) => PromiseLike<unknown>;
  set: (items: StorageItems) => PromiseLike<unknown>;
};

type ChromeCallbackStorageArea = {
  clear(callback?: () => void): void;
  get(keys: StorageKeys, callback?: (items: StorageItems) => void): void;
  remove(keys: WatchKeys, callback?: () => void): void;
  set(items: StorageItems, callback?: () => void): void;
};

type Watcher = {
  callback: WatchCallback;
  keys: WatchKeyMap;
};

type StorageError = Error & {
  maxItems?: boolean;
  perHour?: boolean;
  perItem?: boolean;
  perMinute?: boolean;
  sustained?: number;
};

const OmegaTarget = OmegaTargetModule;
const OmegaPromise = OmegaTarget.Promise;

function normalizeWatchKeys(keys: WatchKeys): WatchKeyMap {
  if (keys == null) {
    return null;
  }
  const keyMap: Record<string, boolean> = {};
  if (Array.isArray(keys)) {
    for (const key of keys) {
      keyMap[key] = true;
    }
  } else {
    keyMap[keys] = true;
  }
  return keyMap;
}

class ChromeStorage extends OmegaTarget.Storage {
  static onChangedListenerInstalled = false;
  static watchers: Record<string, Record<string, Watcher>> = {};

  areaName: StorageAreaName;
  storage: StorageArea;

  static parseStorageErrors(err: StorageError) {
    if (err?.message) {
      const sustainedPerMinute = 'MAX_SUSTAINED_WRITE_OPERATIONS_PER_MINUTE';
      if (err.message.indexOf('QUOTA_BYTES_PER_ITEM') >= 0) {
        err = new OmegaTarget.Storage.QuotaExceededError();
        err.perItem = true;
      } else if (err.message.indexOf('QUOTA_BYTES') >= 0) {
        err = new OmegaTarget.Storage.QuotaExceededError();
      } else if (err.message.indexOf('MAX_ITEMS') >= 0) {
        err = new OmegaTarget.Storage.QuotaExceededError();
        err.maxItems = true;
      } else if (err.message.indexOf('MAX_WRITE_OPERATIONS_') >= 0) {
        err = new OmegaTarget.Storage.RateLimitExceededError();
        if (err.message.indexOf('MAX_WRITE_OPERATIONS_PER_HOUR') >= 0) {
          err.perHour = true;
        } else if (err.message.indexOf('MAX_WRITE_OPERATIONS_PER_MINUTE') >= 0) {
          err.perMinute = true;
        }
      } else if (err.message.indexOf(sustainedPerMinute) >= 0) {
        err = new OmegaTarget.Storage.RateLimitExceededError();
        err.perMinute = true;
        err.sustained = 10;
      } else if (err.message.indexOf('is not available') >= 0) {
        err = new OmegaTarget.Storage.StorageUnavailableError();
      } else if (err.message.indexOf('Please set webextensions.storage.sync.enabled to true') >= 0) {
        err = new OmegaTarget.Storage.StorageUnavailableError();
      }
    }
    return OmegaPromise.reject(err);
  }

  constructor(areaName: StorageAreaName) {
    super();
    this.areaName = areaName;
    if (typeof browser !== 'undefined' && browser?.storage?.[this.areaName]) {
      this.storage = browser.storage[this.areaName] as StorageArea;
    } else {
      const storageArea = chrome.storage[this.areaName] as ChromeCallbackStorageArea;
      this.storage = {
        get: chromeApiPromisify<StorageItems>(storageArea, 'get'),
        set: chromeApiPromisify<void>(storageArea, 'set'),
        remove: chromeApiPromisify<void>(storageArea, 'remove'),
        clear: chromeApiPromisify(storageArea, 'clear')
      } as StorageArea;
    }
  }

  get(keys: StorageKeys = null) {
    return OmegaPromise.resolve(this.storage.get(keys)).catch(ChromeStorage.parseStorageErrors);
  }

  set(items: StorageItems) {
    if (Object.keys(items).length === 0) {
      return OmegaPromise.resolve({});
    }
    return OmegaPromise.resolve(this.storage.set(items)).catch(ChromeStorage.parseStorageErrors);
  }

  remove(keys: WatchKeys) {
    if (keys == null) {
      return OmegaPromise.resolve(this.storage.clear());
    }
    if (Array.isArray(keys) && keys.length === 0) {
      return OmegaPromise.resolve({});
    }
    return OmegaPromise.resolve(this.storage.remove(keys)).catch(ChromeStorage.parseStorageErrors);
  }

  watch(keys: WatchKeys, callback: WatchCallback): WatchUnsubscribe {
    if (ChromeStorage.watchers[this.areaName] == null) {
      ChromeStorage.watchers[this.areaName] = {};
    }
    const area = ChromeStorage.watchers[this.areaName];
    let id = Date.now().toString();
    while (area[id]) {
      id = Date.now().toString();
    }
    area[id] = {
      keys: normalizeWatchKeys(keys),
      callback
    };
    if (!ChromeStorage.onChangedListenerInstalled) {
      chrome.storage.onChanged.addListener(ChromeStorage.onChangedListener);
      ChromeStorage.onChangedListenerInstalled = true;
    }
    return () => {
      delete area[id];
    };
  }

  static onChangedListener(changes: Record<string, ChromeStorageChange>, areaName: string) {
    let map: StorageItems | null = null;
    const area = ChromeStorage.watchers[areaName] || {};
    const results = [];
    for (const id of Object.keys(area)) {
      const watcher = area[id];
      let match = watcher.keys === null;
      if (!match) {
        for (const key of Object.keys(changes)) {
          if (watcher.keys?.[key]) {
            match = true;
            break;
          }
        }
      }
      if (match) {
        if (map == null) {
          map = {};
          for (const key of Object.keys(changes)) {
            map[key] = changes[key].newValue;
          }
        }
        results.push(watcher.callback(map));
      } else {
        results.push(undefined);
      }
    }
    return results;
  }
}

export = ChromeStorage;
