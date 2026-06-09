import assert from 'assert';
import Promise from 'bluebird';
import LogClass from '../src/log';
import OptionsSyncClass from '../src/options_sync';
import StorageClass from '../src/storage';
import {assertCalledOnce, assertCalledTwice, assertCalledWith, spyOn, stubOn} from './helpers/test_helpers';

const slice = [].slice;

describe('OptionsSync', function() {
  let Log: any,
    OptionsSync: any,
    Storage: any,
    hookPost: (...args: any[]) => any,
    hookPostBasic: (func: (...args: any[]) => any, hook: (...args: any[]) => any) => (...args: any[]) => any;
  OptionsSync = OptionsSyncClass;
  Storage = StorageClass;
  Log = LogClass;
  before(function() {
    return stubOn(Log, 'log');
  });
  after(function() {
    return Log.log.restore();
  });
  hookPostBasic = function(func: (...args: any[]) => any, hook: (...args: any[]) => any): (...args: any[]) => any {
    return function(this: any, ...args: any[]): any {
      let result;
      result = func.apply(this, args);
      hook.apply(this, args);
      return result;
    };
  };
  hookPost = function(...hookArgs: any[]): any {
    let args: any[], func, hook, method, obj;
    args = 1 <= hookArgs.length ? slice.call(hookArgs, 0) : [];
    if (args.length === 2) {
      func = args[0], hook = args[1];
      return hookPostBasic(func, hook);
    } else {
      obj = args[0], method = args[1], hook = args[2];
      return obj[method] = hookPostBasic(obj[method], hook);
    }
  };
  describe('#merge', function() {
    let sync;
    sync = new OptionsSync();
    it('should choose the one with newer revision', function() {
      let newVal, oldVal;
      newVal = {
        revision: '2'
      };
      oldVal = {
        revision: '1'
      };
      return assert.strictEqual(sync.merge('example', newVal, oldVal), newVal);
    });
    it('should use oldVal when sync is disabled in newVal', function() {
      let newVal, oldVal;
      newVal = {
        revision: '2',
        is: 'newVal',
        syncOptions: 'disabled'
      };
      oldVal = {
        revision: '1',
        is: 'oldVal'
      };
      return assert.strictEqual(sync.merge('example', newVal, oldVal), oldVal);
    });
    it('should use oldVal when sync is disabled in oldVal', function() {
      let newVal, oldVal;
      newVal = {
        revision: '2',
        is: 'newVal'
      };
      oldVal = {
        revision: '1',
        is: 'oldVal',
        syncOptions: 'disabled'
      };
      return assert.strictEqual(sync.merge('example', newVal, oldVal), oldVal);
    });
    it('should favor oldVal when revisions are equal', function() {
      let newVal, oldVal;
      newVal = {
        revision: '1',
        is: 'newVal'
      };
      oldVal = {
        revision: '1',
        is: 'oldVal'
      };
      return assert.strictEqual(sync.merge('example', newVal, oldVal), oldVal);
    });
    it('should favor oldVal when newVal deeply equals oldVal', function() {
      let newVal, oldVal;
      newVal = {
        they: 'are',
        the: 'same'
      };
      oldVal = {
        they: 'are',
        the: 'same'
      };
      return assert.strictEqual(sync.merge('example', newVal, oldVal), oldVal);
    });
    return it('should choose newVal when newVal is different', function() {
      let newVal, oldVal;
      newVal = {
        they: 'are',
        not: 'equal'
      };
      oldVal = {
        they: 'are',
        not: 'identical'
      };
      return assert.strictEqual(sync.merge('example', newVal, oldVal), newVal);
    });
  });
  describe('#requestPush', function() {
    let unlimited;
    unlimited = new OptionsSync.TokenBucket({
      bucketSize: 0,
      tokensPerInterval: 0,
      interval: 'minute'
    });
    it('should store pendingChanges', function() {
      let sync;
      sync = new OptionsSync();
      sync.enabled = false;
      sync.requestPush({
        a: 1
      });
      return assert.deepStrictEqual(sync.pendingChanges(), {
        a: 1
      });
    });
    it('should schedule storage write', function(done) {
      let check: () => void, storage: any, sync: any;
      check = function(): void {
        if (storage.set.callCount === 0 || storage.remove.callCount === 0) {
          return;
        }
        assertCalledOnce(storage.set);
        assertCalledWith(storage.set, {
          b: 1
        });
        assertCalledOnce(storage.remove);
        assertCalledWith(storage.remove, ['a']);
        return done();
      };
      storage = new Storage();
      storage.set({
        a: 1
      });
      hookPost(storage, 'set', check);
      hookPost(storage, 'remove', check);
      spyOn(storage, 'set');
      spyOn(storage, 'remove');
      sync = new OptionsSync(storage, unlimited);
      sync.debounce = 0;
      return sync.requestPush({
        a: void 0,
        b: 1
      });
    });
    it('should combine multiple write operations', function(done) {
      let check: () => void, storage: any, sync: any;
      check = function(): void {
        if (storage.set.callCount === 0 || storage.remove.callCount === 0) {
          return;
        }
        assertCalledOnce(storage.set);
        assertCalledWith(storage.set, {
          c: 1,
          d: 1
        });
        assertCalledOnce(storage.remove);
        assertCalledWith(storage.remove, ['a', 'b']);
        return done();
      };
      storage = new Storage();
      storage.set({
        a: 1,
        b: 1
      });
      hookPost(storage, 'set', check);
      hookPost(storage, 'remove', check);
      spyOn(storage, 'set');
      spyOn(storage, 'remove');
      sync = new OptionsSync(storage, unlimited);
      sync.debounce = 0;
      sync.requestPush({
        a: void 0
      });
      sync.requestPush({
        b: 2
      });
      sync.requestPush({
        b: void 0
      });
      sync.requestPush({
        c: 1
      });
      sync.requestPush({
        d: 1
      });
      sync.requestPush({
        e: 1
      });
      return sync.requestPush({
        e: void 0
      });
    });
    return it('should disable syncing for the profiles if quota is exceeded', function(done) {
      let options: any, storage: any, sync: any;
      options = {
        '+a': {
          is: 'a',
          oversized: true
        },
        b: {
          is: 'b'
        }
      };
      storage = new Storage();
      storage.set = function(changes: Record<string, any>) {
        let err, key, value;
        for (key in changes) {
          value = changes[key];
          if (value.oversized) {
            err = new Storage.QuotaExceededError();
            err.perItem = true;
            return Promise.reject(err);
          }
        }
        assertCalledTwice(storage.set);
        assertCalledWith(storage.set, options);
        assertCalledWith(storage.set, {
          b: {
            is: 'b'
          }
        });
        assert.strictEqual(options['+a'].syncOptions, 'disabled');
        assert.strictEqual(options['+a'].syncError.reason, 'quotaPerItem');
        done();
        return Promise.resolve();
      };
      spyOn(storage, 'set');
      sync = new OptionsSync(storage, unlimited);
      sync.debounce = 0;
      return sync.requestPush(options);
    });
  });
  describe('#copyTo', function() {
    it('should fetch all items from remote storage', function(done) {
      let remote: any, storage: any, sync: any;
      remote = new Storage();
      remote.set({
        a: 1,
        b: 2,
        c: 3
      });
      storage = new Storage();
      hookPost(storage, 'set', function() {
        assertCalledOnce(storage.set);
        assertCalledWith(storage.set, {
          a: 1,
          b: 2,
          c: 3
        });
        return done();
      });
      spyOn(storage, 'set');
      sync = new OptionsSync(remote);
      sync.copyTo(storage).catch(done);
    });
    return it('should merge with local as base', function(done) {
      let check: () => void, remote: any, storage: any, sync: any;
      check = function(): void {
        if (storage.set.callCount === 0 || storage.remove.callCount === 0) {
          return;
        }
        assertCalledOnce(storage.set);
        assertCalledWith(storage.set, {
          b: 2,
          c: 3
        });
        assertCalledOnce(storage.remove);
        assertCalledWith(storage.remove, ['d']);
        return done();
      };
      remote = new Storage();
      remote.set({
        a: 1,
        b: 2,
        c: 3,
        d: void 0
      });
      storage = new Storage();
      storage.set({
        a: 1,
        b: 0,
        d: 4
      });
      hookPost(storage, 'set', check);
      hookPost(storage, 'remove', check);
      spyOn(storage, 'set');
      spyOn(storage, 'remove');
      sync = new OptionsSync(remote);
      sync.copyTo(storage);
    });
  });
  return describe('#watchAndPull', function() {
    return it('should pull changes into local when remote changes', function(done) {
      let check: () => void, remote: any, storage: any, sync: any;
      check = function(): void {
        if (storage.set.callCount === 0 || storage.remove.callCount === 0) {
          return;
        }
        assertCalledOnce(remote.watch);
        assertCalledOnce(storage.set);
        assertCalledWith(storage.set, {
          b: 2,
          c: 3
        });
        assertCalledOnce(storage.remove);
        assertCalledWith(storage.remove, ['d']);
        return done();
      };
      remote = new Storage();
      hookPost(remote, 'watch', function(_: any, callback: any) {
        return setTimeout((function() {
          callback({
            a: 1
          });
          callback({
            b: 2
          });
          callback({
            c: 3
          });
          return callback({
            d: void 0
          });
        }), 10);
      });
      spyOn(remote, 'watch');
      storage = new Storage();
      storage.set({
        a: 1,
        b: 0,
        d: 4
      });
      hookPost(storage, 'set', check);
      hookPost(storage, 'remove', check);
      spyOn(storage, 'set');
      spyOn(storage, 'remove');
      sync = new OptionsSync(remote);
      sync.pullThrottle = 0;
      return sync.watchAndPull(storage);
    });
  });
});
