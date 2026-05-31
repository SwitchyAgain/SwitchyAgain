// @ts-nocheck
var OmegaTarget, Promise, ProxyImpl, ScriptProxyImpl,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

OmegaTarget = require('omega-target');

Promise = OmegaTarget.Promise;

ProxyImpl = require('./proxy_impl');

ScriptProxyImpl = (function(superClass) {
  extend(ScriptProxyImpl, superClass);

  function ScriptProxyImpl() {
    return ScriptProxyImpl.__super__.constructor.apply(this, arguments);
  }

  ScriptProxyImpl.isSupported = function() {
    var ref, ref1;
    return ((typeof browser !== "undefined" && browser !== null ? (ref = browser.proxy) != null ? ref.register : void 0 : void 0) != null) || ((typeof browser !== "undefined" && browser !== null ? (ref1 = browser.proxy) != null ? ref1.registerProxyScript : void 0 : void 0) != null);
  };

  ScriptProxyImpl.prototype.features = ['socks5Auth'];

  ScriptProxyImpl.prototype._proxyScriptUrl = 'js/omega_webext_proxy_script.min.js';

  ScriptProxyImpl.prototype._proxyScriptDisabled = false;

  ScriptProxyImpl.prototype._proxyScriptInitialized = false;

  ScriptProxyImpl.prototype._proxyScriptState = {};

  ScriptProxyImpl.prototype.watchProxyChange = function(callback) {
    return null;
  };

  ScriptProxyImpl.prototype.applyProfile = function(profile, state, options) {
    this.log.error('Your browser is outdated! Full-URL based matching, etc. unsupported! ' + "Please update your browser ASAP!");
    state = state != null ? state : {};
    this._options = options;
    state.currentProfileName = profile.name;
    if (profile.name === '') {
      state.tempProfile = profile;
    }
    if (profile.profileType === 'SystemProfile') {
      if (browser.proxy.unregister != null) {
        browser.proxy.unregister();
      } else {
        browser.proxy.registerProxyScript('js/omega_invalid_proxy_script.js');
      }
      this._proxyScriptDisabled = true;
    } else {
      this._proxyScriptState = state;
      this._initWebextProxyScript().then((function(_this) {
        return function() {
          return _this._proxyScriptStateChanged();
        };
      })(this));
    }
    return this.setProxyAuth(profile, options);
  };

  ScriptProxyImpl.prototype._initWebextProxyScript = function() {
    var promise;
    if (!this._proxyScriptInitialized) {
      browser.proxy.onProxyError.addListener((function(_this) {
        return function(err) {
          if (((err != null ? err.message : void 0) != null) && err.message.indexOf('Invalid Proxy Rule: DIRECT') >= 0) {
            return;
          }
          return _this.log.error(err);
        };
      })(this));
      browser.runtime.onMessage.addListener((function(_this) {
        return function(message) {
          if (message.event !== 'proxyScriptLog') {
            return;
          }
          if (message.level === 'error') {
            return _this.log.error(message);
          } else if (message.level === 'warn') {
            return _this.log.error(message);
          } else {
            return _this.log.log(message);
          }
        };
      })(this));
    }
    if (!this._proxyScriptInitialized || this._proxyScriptDisabled) {
      promise = new Promise(function(resolve) {
        var onMessage;
        onMessage = function(message) {
          if (message.event !== 'proxyScriptLoaded') {
            return;
          }
          resolve();
          browser.runtime.onMessage.removeListener(onMessage);
        };
        return browser.runtime.onMessage.addListener(onMessage);
      });
      if (browser.proxy.register != null) {
        browser.proxy.register(this._proxyScriptUrl);
      } else {
        browser.proxy.registerProxyScript(this._proxyScriptUrl);
      }
      this._proxyScriptDisabled = false;
    } else {
      promise = Promise.resolve();
    }
    this._proxyScriptInitialized = true;
    return promise;
  };

  ScriptProxyImpl.prototype._proxyScriptStateChanged = function() {
    return browser.runtime.sendMessage({
      event: 'proxyScriptStateChanged',
      state: this._proxyScriptState,
      options: this._options
    }, {
      toProxyScript: true
    });
  };

  return ScriptProxyImpl;

})(ProxyImpl);

module.exports = ScriptProxyImpl;

export {};
