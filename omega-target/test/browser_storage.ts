var chai, should;

chai = require('chai');

should = chai.should();

describe('BrowserStorage', function() {
  var BrowserStorage, Promise;

  BrowserStorage = require('../build-ts/browser_storage');
  Promise = require('bluebird');

  function createStorage(data, ready) {
    var Storage;
    Storage = function() {};
    Storage.prototype.getItem = function(key) {
      return data[key] || null;
    };
    Storage.prototype.setItem = function(key, value) {
      data[key] = value;
    };
    Storage.prototype.removeItem = function(key) {
      delete data[key];
    };
    Storage.prototype.key = function(index) {
      return Object.keys(data)[index] || null;
    };
    Storage.prototype.clear = function() {
      data = {};
    };
    var storage = new Storage();
    storage.ready = ready;
    return storage;
  }

  describe('#get', function() {
    it('should wait for storage readiness before reading values', function() {
      var data, getResult, ready, resolveReady, storage;
      data = {};
      ready = new Promise(function(resolve) {
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
      }).then(function(result) {
        result.currentProfileName.should.equal('proxy');
      });
    });
  });
});
