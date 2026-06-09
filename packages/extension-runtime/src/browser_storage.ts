import PromiseImpl from 'bluebird';
import Storage from './storage';
import type {
  BluebirdPromise,
  BluebirdStatic,
  StorageGetKeys,
  StorageItems,
  StorageRemoveKeys
} from './types';

const Promise = PromiseImpl as BluebirdStatic;

type BrowserStorageBackend = {
  ready?: unknown;
};

type BrowserStorageProto = {
  clear: () => void;
  getItem: (key: string) => string | null;
  key: (index: number) => string | null;
  removeItem: (key: string) => void;
  setItem: (key: string, value: string) => void;
};

class BrowserStorage extends Storage {
  storage: BrowserStorageBackend;
  prefix: string;
  proto: BrowserStorageProto;
  key?: string;

  constructor(storage: BrowserStorageBackend, prefix?: string) {
    super();
    this.storage = storage;
    this.prefix = prefix != null ? prefix : '';
    this.proto = Object.getPrototypeOf(this.storage) as BrowserStorageProto;
  }

  ready(): BluebirdPromise<unknown> {
    return Promise.resolve(this.storage.ready);
  }

  get(keys: StorageGetKeys): BluebirdPromise<StorageItems> {
    return this.ready().then(() => {
      let map: StorageItems = {};
      if (typeof keys === 'string') {
        map[keys] = void 0;
      } else if (Array.isArray(keys)) {
        for (const key of keys) {
          map[key] = void 0;
        }
      } else if (typeof keys === 'object') {
        map = keys as StorageItems;
      }
      for (const key in map) {
        if (!Object.prototype.hasOwnProperty.call(map, key)) continue;
        let value;
        try {
          value = JSON.parse(this.proto.getItem.call(this.storage, this.prefix + key));
        } catch (error) {}
        if (value != null) {
          map[key] = value;
        }
        if (typeof map[key] === 'undefined') {
          delete map[key];
        }
      }
      return map;
    });
  }

  set(items: StorageItems): BluebirdPromise<StorageItems> {
    return this.ready().then(() => {
      for (const key in items) {
        if (!Object.prototype.hasOwnProperty.call(items, key)) continue;
        let value = items[key];
        value = JSON.stringify(value);
        this.proto.setItem.call(this.storage, this.prefix + key, value);
      }
      return items;
    });
  }

  remove(keys?: StorageRemoveKeys): BluebirdPromise<void> {
    return this.ready().then(() => {
      if (keys == null) {
        if (!this.prefix) {
          this.proto.clear.call(this.storage);
        } else {
          let index = 0;
          while (true) {
            const key = this.proto.key.call(this.storage, index);
            if (key === null) {
              break;
            }
            if (key.startsWith(this.prefix)) {
              this.proto.removeItem.call(this.storage, key);
            } else {
              index++;
            }
          }
        }
        return;
      }
      if (typeof keys === 'string') {
        this.proto.removeItem.call(this.storage, this.prefix + keys);
        return;
      }
      for (const key of keys) {
        this.proto.removeItem.call(this.storage, this.prefix + key);
      }
    });
  }
}

export default BrowserStorage;
