/* @module omega-target/options_sync */

import PromiseImpl from 'bluebird';
import {create as createJsonDiffPatch} from 'jsondiffpatch';
import limiterModule from 'limiter';
import OmegaPac from 'omega-pac';
import Log from './log';
import StorageClass from './storage';
import type {
  BluebirdStatic,
  BluebirdPromise,
  StorageApplyOperations,
  StorageChanges,
  StorageItems,
  StorageLike,
  StorageOperations,
  StorageValue,
  SyncableProfileValue
} from './types';

type TokenBucketLike = {
  clear?: () => unknown;
  content: number;
  removeTokens: (count: number, callback: () => unknown) => unknown;
  tryRemoveTokens: (count: number) => boolean;
};

type StorageModule = {
  operationsForChanges: (
    changes: StorageChanges,
    arg?: {
      base?: StorageItems;
      merge?: (key: string, newValue: StorageValue, oldValue: StorageValue) => StorageValue;
    }
  ) => StorageOperations;
  QuotaExceededError: new () => Error;
  RateLimitExceededError: new () => Error;
};

type JsonDiffPatch = {
  diff: (oldValue: StorageValue, newValue: StorageValue) => unknown;
};

type LimiterModule = {
  TokenBucket: new (
    bucketSize: number,
    tokensPerInterval: number,
    interval: string,
    parentBucket: unknown
  ) => TokenBucketLike;
};

type OmegaPacModule = {
  Revision: {
    compare: (left: unknown, right: unknown) => number;
  };
};

type TimerHandle = ReturnType<typeof setTimeout>;

const Promise = PromiseImpl as BluebirdStatic;
const Storage = StorageClass as unknown as StorageModule;
const Revision = (OmegaPac as OmegaPacModule).Revision;
const TokenBucket = (limiterModule as LimiterModule).TokenBucket;

class OptionsSync {
  static TokenBucket = TokenBucket;

  _timeout: TimerHandle | null = null;
  _bucket: TokenBucketLike | null = null;
  _waiting: boolean = false;
  _pending: StorageChanges;

  /**
   * The debounce timeout (ms) for requestPush scheduling. See requestPush.
   * @type number
   */
  debounce: number = 1000;

  /**
   * The throttling timeout (ms) for watchAndPull. See watchAndPull.
   * @type number
   */
  pullThrottle: number = 1000;

  /**
   * The remote storage of syncing.
   * @type Storage
   */
  storage: StorageLike | null = null;

  /**
   * Whether syncing is enabled or not. See requestPush for the effect.
   * @type boolean
   */
  enabled: boolean = true;

  constructor(storage: StorageLike, _bucket?: TokenBucketLike) {
    this.storage = storage;
    this._bucket = _bucket;
    this._pending = {};
    if (this._bucket == null) {
      this._bucket = new TokenBucket(10, 10, 'minute', null) as TokenBucketLike;
    }
    if (this._bucket.clear == null) {
      this._bucket.clear = () => {
        return this._bucket.tryRemoveTokens(this._bucket.content);
      };
    }
  }

  /**
   * Transform storage values for syncing. The default implementation applies no
   * transformation, but the behavior can be altered by assigning to this field.
   * Note: Transformation is applied before merging.
   * @param {{}} value The value to transform
   * @param {{}} key The key of the item
   * @returns {{}} The transformed value
   */
  transformValue(v: StorageValue, key?: string): StorageValue {
    return v;
  }

  /**
   * Merge newVal and oldVal of a given key.
   */
  _mergeDiff: JsonDiffPatch = createJsonDiffPatch({
    objectHash(obj: object) {
      return JSON.stringify(obj);
    }
  }) as JsonDiffPatch;

  merge = (key: string, newVal: StorageValue, oldVal: StorageValue): StorageValue => {
    let result;
    const oldProfile = oldVal as SyncableProfileValue | null | undefined;
    const newProfile = newVal as SyncableProfileValue | null | undefined;
    if (newVal === oldVal) {
      return oldVal;
    }
    if ((oldProfile != null ? oldProfile.syncOptions : void 0) === 'disabled' ||
        (newProfile != null ? newProfile.syncOptions : void 0) === 'disabled') {
      return oldVal;
    }
    if ((oldProfile != null ? oldProfile.revision : void 0) != null &&
        (newProfile != null ? newProfile.revision : void 0) != null) {
      result = Revision.compare(oldProfile.revision, newProfile.revision);
      if (result >= 0) {
        return oldVal;
      }
    }
    if (this._mergeDiff.diff(oldVal, newVal) == null) {
      return oldVal;
    }
    return newVal;
  };

  /**
   * Request pushing the changes to remote storage.
   * @param {Object.<string, {}>} changes A map from keys to values.
   */
  requestPush(changes: StorageChanges): TimerHandle | void {
    if (this._timeout != null) {
      clearTimeout(this._timeout);
    }
    for (const key in changes) {
      if (!Object.prototype.hasOwnProperty.call(changes, key)) continue;
      let value = changes[key];
      if (typeof value !== 'undefined') {
        value = this.transformValue(value, key);
        if (typeof value === 'undefined') {
          continue;
        }
      }
      this._pending[key] = value;
    }
    if (!this.enabled) {
      return;
    }
    this._timeout = setTimeout(this._doPush.bind(this), this.debounce);
    return this._timeout;
  }

  /**
   * Returning the pending changes not written to the remote storage.
   * @returns {Object.<string, {}>} The pending changes.
   */
  pendingChanges(): StorageChanges {
    return this._pending;
  }

  _doPush(): unknown {
    this._timeout = null;
    if (this._waiting) {
      return;
    }
    this._waiting = true;
    return this._bucket!.removeTokens(1, () => {
      return this.storage!.get(null).then((base: StorageItems) => {
        const changes = this._pending;
        this._pending = {};
        this._waiting = false;
        return Storage.operationsForChanges(changes, {
          base: base,
          merge: this.merge
        });
      }).then(({set, remove}: StorageOperations) => {
        const doSet = Object.keys(set).length === 0
          ? Promise.resolve(0)
          : (Log.log('OptionsSync::set', set), this.storage!.set(set).return(1));
        return doSet.then((cost: number) => {
          set = {};
          if (remove.length > 0) {
            if (this._bucket!.tryRemoveTokens(cost)) {
              Log.log('OptionsSync::remove', remove);
              return this.storage!.remove(remove);
            }
            return Promise.reject('bucket');
          }
        }).catch((e: unknown) => {
          let valuesAffected;
          for (const key in set) {
            if (!Object.prototype.hasOwnProperty.call(set, key)) continue;
            const value = set[key];
            if (!(key in this._pending)) {
              this._pending[key] = value;
            }
          }
          for (const key of remove) {
            if (!(key in this._pending)) {
              this._pending[key] = void 0;
            }
          }
          if (e === 'bucket') {
            return this._doPush();
          } else if (e instanceof Storage.RateLimitExceededError) {
            Log.log('OptionsSync::rateLimitExceeded');
            this._bucket.clear();
            this.requestPush({});
          } else if (e instanceof Storage.QuotaExceededError) {
            valuesAffected = 0;
            for (const key in set) {
              if (!Object.prototype.hasOwnProperty.call(set, key)) continue;
              const value = set[key] as SyncableProfileValue;
              if (key[0] === '+' && value.syncOptions !== 'disabled') {
                value.syncOptions = 'disabled';
                value.syncError = {
                  reason: 'quotaPerItem'
                };
                valuesAffected++;
              }
            }
            if (valuesAffected > 0) {
              this.requestPush({});
            } else {
              this._pending = {};
            }
          } else {
            return Promise.reject(e);
          }
        });
      });
    });
  }

  _logOperations(text: string, operations: StorageOperations): void {
    if (Object.keys(operations.set).length) {
      Log.log(text + '::set', operations.set);
    }
    if (operations.remove.length) {
      Log.log(text + '::remove', operations.remove);
    }
  }

  /**
   * Pull the remote storage for changes, and write them to local.
   * @param {Storage} local The local storage to be written to
   * @returns {function} Calling the returned function will stop watching.
   */
  copyTo(local: StorageLike): BluebirdPromise<unknown> {
    return Promise.join(local.get(null), this.storage!.get(null), (base: StorageItems, changes: StorageChanges) => {
      for (const key in base) {
        if (!Object.prototype.hasOwnProperty.call(base, key)) continue;
        if (!(key in changes)) {
          const syncOptions = (base[key] as SyncableProfileValue | null | undefined)?.syncOptions;
          if (key[0] === '+' && (!syncOptions as unknown) === 'disabled') {
            changes[key] = void 0;
          }
        }
      }
      return local.apply({
        changes: changes,
        base: base,
        merge: this.merge
      }).then((operations: StorageOperations) => {
        return this._logOperations('OptionsSync::copyTo', operations);
      });
    });
  }

  /**
   * Watch the remote storage for changes, and write them to local.
   * The actual writing is throttled by pullThrottle with initial delay.
   * @param {Storage} local The local storage to be written to
   * @returns {function} Calling the returned function will stop watching.
   */
  watchAndPull(local: StorageLike) {
    let pullScheduled: TimerHandle | null = null;
    let pull: StorageChanges = {};
    const doPull = () => {
      return local.get(null).then((base: StorageItems) => {
        const changes = pull;
        pull = {};
        pullScheduled = null;
        return Storage.operationsForChanges(changes, {
          base: base,
          merge: this.merge
        });
      }).then((operations: StorageApplyOperations & StorageOperations) => {
        this._logOperations('OptionsSync::pull', operations);
        return local.apply(operations);
      });
    };
    return this.storage!.watch(null, (changes: StorageChanges) => {
      for (const key in changes) {
        if (!Object.prototype.hasOwnProperty.call(changes, key)) continue;
        const value = changes[key];
        pull[key] = value;
      }
      if (pullScheduled != null) {
        return;
      }
      pullScheduled = setTimeout(doPull, this.pullThrottle);
      return pullScheduled;
    });
  }
}

export default OptionsSync;
