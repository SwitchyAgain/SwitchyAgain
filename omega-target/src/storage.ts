/* @module omega-target/storage */

const Promise = require('bluebird');
const Log = require('./log');

class RateLimitExceededError extends Error {
  constructor() {
    super();
    Object.setPrototypeOf(this, RateLimitExceededError.prototype);
  }
}

class QuotaExceededError extends Error {
  constructor() {
    super();
    Object.setPrototypeOf(this, QuotaExceededError.prototype);
  }
}

class StorageUnavailableError extends Error {
  constructor() {
    super();
    Object.setPrototypeOf(this, StorageUnavailableError.prototype);
  }
}

class Storage {
  static RateLimitExceededError = RateLimitExceededError;
  static QuotaExceededError = QuotaExceededError;
  static StorageUnavailableError = StorageUnavailableError;

  _items: any;

  /**
   * Calculate the actual operations against storage that should be performed to
   * replay the changes on a storage.
   * @param {Object.<string, {}>} changes The changes to apply
   * @param {?{}} args Extra arguments
   * @param {Object.<string, {}>?} args.base The original items in the storage.
   * @param {function(key, newVal, oldVal)} args.merge A function that merges
   * the newVal and oldVal. oldVal is provided only if args.base is present.
   * Otherwise it will be equal to newVal (i.e. merge(key, newVal, newVal)).
   * @returns {WriteOperations} The operations that should be performed.
   */
  static operationsForChanges(changes: any, arg?: any): any {
    const {base, merge} = arg != null ? arg : {};
    const set: any = {};
    const remove: any[] = [];
    for (const key in changes) {
      let newVal = changes[key];
      const oldVal = base != null ? base[key] : newVal;
      if (merge) {
        newVal = merge(key, newVal, oldVal);
      }
      if (base != null && newVal === oldVal) {
        continue;
      }
      if (typeof newVal === 'undefined') {
        if (typeof oldVal !== 'undefined' || base == null) {
          remove.push(key);
        }
      } else {
        set[key] = newVal;
      }
    }
    return {set, remove};
  }

  /**
   * Get the requested values by keys from the storage.
   * @param {(string|string[]|null|Object.<string,{}>)} keys The keys to retrive,
   * or null for all.
   * @returns {Promise<(Object.<string, {}>)>} A map from keys to values
   */
  get(keys: any): any {
    Log.method('Storage#get', this, arguments);
    if (!this._items) {
      return Promise.resolve({});
    }
    if (keys == null) {
      keys = this._items;
    }
    const map: any = {};
    if (typeof keys === 'string') {
      map[keys] = this._items[keys];
    } else if (Array.isArray(keys)) {
      for (const key of keys) {
        map[key] = this._items[key];
      }
    } else if (typeof keys === 'object') {
      for (const key in keys) {
        const value = keys[key];
        map[key] = this._items[key] != null ? this._items[key] : value;
      }
    }
    return Promise.resolve(map);
  }

  /**
   * Set multiple values by keys in the storage.
   * @param {(string|Object.<string,{}>)} items A map from key to value to set.
   * @returns {Promise<(Object.<string, {}>)>} A map of key-value pairs just set.
   */
  set(items: any): any {
    Log.method('Storage#set', this, arguments);
    if (this._items == null) {
      this._items = {};
    }
    for (const key in items) {
      const value = items[key];
      this._items[key] = value;
    }
    return Promise.resolve(items);
  }

  /**
   * Remove items by keys from the storage.
   * @param {(string|string[]|null)} keys The keys to remove, or null for all.
   * @returns {Promise} A promise that fulfills on successful removal.
   */
  remove(keys: any): any {
    Log.method('Storage#remove', this, arguments);
    if (this._items != null) {
      if (keys == null) {
        this._items = {};
      } else if (Array.isArray(keys)) {
        for (const key of keys) {
          delete this._items[key];
        }
      } else {
        delete this._items[keys];
      }
    }
    return Promise.resolve();
  }

  /**
   * Watch for any changes to the storage.
   * @param {(string|string[]|null)} keys The keys to watch, or null for all.
   * @param {watchCallback} callback Called everytime something changes.
   * @returns {function} Calling the returned function will stop watching.
   */
  watch(keys: any, callback: any): any {
    Log.method('Storage#watch', this, arguments);
    return function() {
      return null;
    };
  }

  /**
   * Apply WriteOperations to the storage.
   * @param {WriteOperations|{changes: Object.<string,{}>}} operations The
   * operations to apply, or the changes to be applied. If changes is provided,
   * the operations are calculated by Storage.operationsForChanges, with extra
   * fields passed through as the second argument.
   * @returns {Promise} A promise that fulfills on operation success.
   */
  apply(operations: any): any {
    if ('changes' in operations) {
      operations = Storage.operationsForChanges(operations.changes, operations);
    }
    return this.set(operations.set).then(() => {
      return this.remove(operations.remove);
    }).return(operations);
  }
}

module.exports = Storage;

export {};
