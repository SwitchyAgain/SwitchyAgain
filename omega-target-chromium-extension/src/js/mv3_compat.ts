(function(global: any) {
  'use strict';

  if (typeof window === 'undefined') {
    global.window = global;
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
    var data = {};
    var persist = function(key) {
      if (chromeApi && chromeApi.storage && chromeApi.storage.local) {
        var item = {};
        item['__localStorage__.' + key] = data[key];
        chromeApi.storage.local.set(item);
      }
    };

    var LocalStorageShim = function() {};
    Object.defineProperty(LocalStorageShim.prototype, 'length', {
      get: function() {
        return Object.keys(data).length;
      }
    });
    LocalStorageShim.prototype.key = function(index) {
      return Object.keys(data)[index] || null;
    };
    LocalStorageShim.prototype.getItem = function(key) {
      key = String(key);
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    };
    LocalStorageShim.prototype.setItem = function(key, value) {
      key = String(key);
      data[key] = String(value);
      persist(key);
    };
    LocalStorageShim.prototype.removeItem = function(key) {
      key = String(key);
      delete data[key];
      if (chromeApi && chromeApi.storage && chromeApi.storage.local) {
        chromeApi.storage.local.remove('__localStorage__.' + key);
      }
    };
    LocalStorageShim.prototype.clear = function() {
      data = {};
    };

    global.localStorage = new Proxy(new LocalStorageShim(), {
      get: function(target, prop) {
        if (prop in target) {
          return target[prop];
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
    global.saveAs = function(blob, filename) {
      if (!chromeApi || !chromeApi.downloads || typeof URL === 'undefined') {
        return;
      }
      var url = URL.createObjectURL(blob);
      chromeApi.downloads.download({url: url, filename: filename, saveAs: true});
    };
  }
})(this);
