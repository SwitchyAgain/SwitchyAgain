let chai: any, should: any;

chai = require('chai');

should = chai.should();

describe('BrowserStorage', function() {
  let BrowserStorage: any, Promise: any;

  BrowserStorage = require('../build-ts/browser_storage').default;
  Promise = require('bluebird');

  function createStorage(data: Record<string, any>, ready: any): any {
    let Storage: any;
    Storage = function() {};
    Storage.prototype.getItem = function(key: string) {
      return data[key] || null;
    };
    Storage.prototype.setItem = function(key: string, value: any) {
      data[key] = value;
    };
    Storage.prototype.removeItem = function(key: string) {
      delete data[key];
    };
    Storage.prototype.key = function(index: number) {
      return Object.keys(data)[index] || null;
    };
    Storage.prototype.clear = function() {
      data = {};
    };
    let storage = new Storage();
    storage.ready = ready;
    return storage;
  }

  describe('#get', function() {
    it('should wait for storage readiness before reading values', function() {
      let data: Record<string, any>, getResult: any, ready: any, resolveReady: () => void, storage: any;
      data = {};
      ready = new Promise(function(resolve: () => void) {
        resolveReady = resolve;
      });
      storage = new BrowserStorage(createStorage(data, ready), 'omega.local.');
      getResult = storage.get({
        currentProfileName: 'system'
      });
      return Promise.delay(0).then(function() {
        data['omega.local.currentProfileName'] = '"proxy"';
        resolveReady();
        return getResult;
      }).then(function(result: any) {
        result.currentProfileName.should.equal('proxy');
      });
    });
  });
});
