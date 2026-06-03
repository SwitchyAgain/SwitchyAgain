// @ts-nocheck
var ChromePort, ExternalApi, OmegaPac, OmegaTarget, Promise, actionApi;

OmegaTarget = require('omega-target');

OmegaPac = OmegaTarget.OmegaPac;

Promise = OmegaTarget.Promise;

ChromePort = require('./chrome_port');

actionApi = function() {
  var legacyKey;
  legacyKey = 'browser';
  legacyKey += 'Action';
  return chrome.action || chrome[legacyKey];
};

module.exports = ExternalApi = (function() {
  function ExternalApi(options) {
    this.options = options;
  }

  ExternalApi.prototype.knownExts = {
    'padekgcemlokbadohgkifijomclgjgif': 32
  };

  ExternalApi.prototype.disabled = false;

  ExternalApi.prototype.listen = function() {
    if (!chrome.runtime.onConnectExternal) {
      return;
    }
    return chrome.runtime.onConnectExternal.addListener((function(_this) {
      return function(rawPort) {
        var port;
        port = new ChromePort(rawPort);
        port.onMessage.addListener(function(msg) {
          return _this.onMessage(msg, port);
        });
        return port.onDisconnect.addListener(_this.reenable.bind(_this));
      };
    })(this));
  };

  ExternalApi.prototype._previousProfileName = null;

  ExternalApi.prototype.reenable = function() {
    var base;
    if (!this.disabled) {
      return;
    }
    this.options.setProxyNotControllable(null);
    if (typeof (base = actionApi()).setPopup === "function") {
      base.setPopup({
        popup: 'popup/index.html'
      });
    }
    this.options.reloadQuickSwitch();
    this.disabled = false;
    this.options.clearBadge();
    return this.options.applyProfile(this._previousProfileName);
  };

  ExternalApi.prototype.checkPerm = function(port, level) {
    var perm;
    perm = this.knownExts[port.sender.id] || 0;
    if (perm < level) {
      port.postMessage({
        action: 'error',
        error: 'permission'
      });
      return false;
    } else {
      return true;
    }
  };

  ExternalApi.prototype.onMessage = function(msg, port) {
    var base, ref;
    this.options.log.log(port.sender.id + " -> " + msg.action, msg);
    switch (msg.action) {
      case 'disable':
        if (!this.checkPerm(port, 16)) {
          return;
        }
        if (this.disabled) {
          return;
        }
        this.disabled = true;
        this._previousProfileName = ((ref = this.options.currentProfile()) != null ? ref.name : void 0) || 'system';
        this.options.applyProfile('system').then((function(_this) {
          return function() {
            var reason;
            reason = 'disabled';
            if (_this.knownExts[port.sender.id] >= 32) {
              reason = 'upgrade';
            }
            return _this.options.setProxyNotControllable(reason, {
              text: 'X',
              color: '#5ab432'
            });
          };
        })(this));
        if (typeof (base = actionApi()).setPopup === "function") {
          base.setPopup({
            popup: 'popup/index.html'
          });
        }
        return port.postMessage({
          action: 'state',
          state: 'disabled'
        });
      case 'enable':
        this.reenable();
        return port.postMessage({
          action: 'state',
          state: 'enabled'
        });
      case 'getOptions':
        if (!this.checkPerm(port, 8)) {
          return;
        }
        return port.postMessage({
          action: 'options',
          options: this.options.getAll()
        });
      default:
        return port.postMessage({
          action: 'error',
          error: 'noSuchAction',
          action_name: msg.action
        });
    }
  };

  return ExternalApi;

})();

export {};
