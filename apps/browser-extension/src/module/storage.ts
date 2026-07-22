import {chromeApiPromisify} from './chrome_api';
import ExtensionRuntime from '@switchyagain/extension-runtime';
import {migrateLegacyOptions} from './options_import';

type StorageItems = Record<string, unknown>;
type StorageKeys = string | string[] | StorageItems | null;
type WatchKeys = string | string[] | null;
type WatchKeyMap = Record<string, boolean> | null;
type WatchCallback = (changes: StorageItems) => unknown;
type StorageAreaName = 'local' | 'sync';
type WatchUnsubscribe = () => void;

const INTERNAL_STORAGE_PREFIX = '__switchyagain_internal__.';
const LEGACY_LOCAL_STORAGE_PREFIX = '__localStorage__.';

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

class ChromeStorage extends ExtensionRuntime.Storage {
  static onChangedListenerInstalled = false;
  static watchers: Record<string, Record<string, Watcher>> = {};

  areaName: StorageAreaName;
  keyPrefix: string;
  storage: StorageArea;

  static parseStorageErrors(err: StorageError) {
    if (err?.message) {
      const sustainedPerMinute = 'MAX_SUSTAINED_WRITE_OPERATIONS_PER_MINUTE';
      if (err.message.indexOf('QUOTA_BYTES_PER_ITEM') >= 0) {
        err = new ExtensionRuntime.Storage.QuotaExceededError();
        err.perItem = true;
      } else if (err.message.indexOf('QUOTA_BYTES') >= 0) {
        err = new ExtensionRuntime.Storage.QuotaExceededError();
      } else if (err.message.indexOf('MAX_ITEMS') >= 0) {
        err = new ExtensionRuntime.Storage.QuotaExceededError();
        err.maxItems = true;
      } else if (err.message.indexOf('MAX_WRITE_OPERATIONS_') >= 0) {
        err = new ExtensionRuntime.Storage.RateLimitExceededError();
        if (err.message.indexOf('MAX_WRITE_OPERATIONS_PER_HOUR') >= 0) {
          err.perHour = true;
        } else if (err.message.indexOf('MAX_WRITE_OPERATIONS_PER_MINUTE') >= 0) {
          err.perMinute = true;
        }
      } else if (err.message.indexOf(sustainedPerMinute) >= 0) {
        err = new ExtensionRuntime.Storage.RateLimitExceededError();
        err.perMinute = true;
        err.sustained = 10;
      } else if (err.message.indexOf('is not available') >= 0) {
        err = new ExtensionRuntime.Storage.StorageUnavailableError();
      } else if (err.message.indexOf('Please set webextensions.storage.sync.enabled to true') >= 0) {
        err = new ExtensionRuntime.Storage.StorageUnavailableError();
      }
    }
    return Promise.reject(err);
  }

  constructor(areaName: StorageAreaName, namespace?: string) {
    super();
    this.areaName = areaName;
    this.keyPrefix = namespace ? `${INTERNAL_STORAGE_PREFIX}${namespace}.` : '';
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

  private storageKeys(keys: StorageKeys): StorageKeys {
    if (!this.keyPrefix || keys == null) {
      return keys;
    }
    if (typeof keys === 'string') {
      return this.keyPrefix + keys;
    }
    if (Array.isArray(keys)) {
      return keys.map((key) => this.keyPrefix + key);
    }
    const mapped: StorageItems = {};
    for (const [key, value] of Object.entries(keys)) {
      mapped[this.keyPrefix + key] = value;
    }
    return mapped;
  }

  private storageItems(items: StorageItems) {
    if (!this.keyPrefix) {
      return items;
    }
    const mapped: StorageItems = {};
    for (const [key, value] of Object.entries(items)) {
      mapped[this.keyPrefix + key] = value;
    }
    return mapped;
  }

  private logicalItems(items: StorageItems) {
    const mapped: StorageItems = {};
    for (const [key, value] of Object.entries(items)) {
      if (this.keyPrefix) {
        if (key.startsWith(this.keyPrefix)) {
          mapped[key.slice(this.keyPrefix.length)] = value;
        }
      } else if (!key.startsWith(INTERNAL_STORAGE_PREFIX) && !key.startsWith(LEGACY_LOCAL_STORAGE_PREFIX)) {
        mapped[key] = value;
      }
    }
    return mapped;
  }

  get(keys: StorageKeys = null) {
    return Promise.resolve(this.storage.get(this.storageKeys(keys)))
      .then((items) => {
        const storageItems = this.logicalItems(items as StorageItems);
        if (this.keyPrefix || this.areaName !== 'local' || keys !== null) {
          return storageItems;
        }
        const migrated = migrateLegacyOptions(storageItems);
        if (!migrated) {
          return storageItems;
        }
        return Promise.resolve(
          this.storage.set({
            schema: migrated.schema,
            version: migrated.version
          })
        )
          .then(() => this.storage.remove('schemaVersion'))
          .then(() => migrated);
      })
      .catch(ChromeStorage.parseStorageErrors);
  }

  set(items: StorageItems) {
    if (Object.keys(items).length === 0) {
      return Promise.resolve({});
    }
    return Promise.resolve(this.storage.set(this.storageItems(items))).catch(ChromeStorage.parseStorageErrors);
  }

  remove(keys: WatchKeys) {
    if (keys == null && !this.keyPrefix) {
      return Promise.resolve(this.storage.clear());
    }
    if (keys == null) {
      return Promise.resolve(this.storage.get(null))
        .then((items) => Object.keys(items as StorageItems).filter((key) => key.startsWith(this.keyPrefix)))
        .then((storageKeys) => (storageKeys.length === 0 ? undefined : this.storage.remove(storageKeys)))
        .catch(ChromeStorage.parseStorageErrors);
    }
    if (Array.isArray(keys) && keys.length === 0) {
      return Promise.resolve({});
    }
    return Promise.resolve(this.storage.remove(this.storageKeys(keys) as WatchKeys)).catch(ChromeStorage.parseStorageErrors);
  }

  watch(keys: WatchKeys, callback: WatchCallback): WatchUnsubscribe {
    if (ChromeStorage.watchers[this.areaName] == null) {
      ChromeStorage.watchers[this.areaName] = {};
    }
    const area = ChromeStorage.watchers[this.areaName];
    const storageKeys = this.storageKeys(keys) as WatchKeys;
    let id = Date.now().toString();
    while (area[id]) {
      id = Date.now().toString();
    }
    area[id] = {
      keys: normalizeWatchKeys(storageKeys),
      callback: (changes) => {
        const logicalChanges = this.logicalItems(changes);
        if (Object.keys(logicalChanges).length > 0) {
          callback(logicalChanges);
        }
      }
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

export default ChromeStorage;
