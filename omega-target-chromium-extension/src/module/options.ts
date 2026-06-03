// @ts-nocheck
var ChromeOptions, ChromePort, OmegaPac, OmegaTarget, Promise, Url, WebRequestMonitor, actionApi, fetchUrl, querystring,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty,
  slice = [].slice;

OmegaTarget = require('omega-target');

OmegaPac = OmegaTarget.OmegaPac;

Promise = OmegaTarget.Promise;

querystring = require('querystring');

WebRequestMonitor = require('./web_request_monitor');

ChromePort = require('./chrome_port');

fetchUrl = require('./fetch_url');

Url = require('url');

actionApi = function() {
  var legacyKey;
  legacyKey = 'browser';
  legacyKey += 'Action';
  return chrome.action || chrome[legacyKey];
};

ChromeOptions = (function(superClass) {
  extend(ChromeOptions, superClass);

  function ChromeOptions() {
    return ChromeOptions.__super__.constructor.apply(this, arguments);
  }

  ChromeOptions.prototype._inspect = null;

  ChromeOptions.prototype.fetchUrl = fetchUrl;

  ChromeOptions.prototype.updateProfile = function() {
    var args;
    args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
    return ChromeOptions.__super__.updateProfile.apply(this, args).then(function(results) {
      var error, profileName, result;
      error = false;
      for (profileName in results) {
        if (!hasProp.call(results, profileName)) continue;
        result = results[profileName];
        if (result instanceof Error) {
          error = true;
          break;
        }
      }
      if (error) {

        /*
        @setBadge(
          text: '!'
          color: '#faa732'
          title: chrome.i18n.getMessage('browserAction_titleDownloadFail')
        )
         */
      }
      return results;
    });
  };

  ChromeOptions.prototype._proxyNotControllable = null;

  ChromeOptions.prototype.proxyNotControllable = function() {
    return this._proxyNotControllable;
  };

  ChromeOptions.prototype.setProxyNotControllable = function(reason, badge) {
    this._proxyNotControllable = reason;
    if (reason) {
      this._state.set({
        'proxyNotControllable': reason
      });
      return this.setBadge(badge);
    } else {
      this._state.remove(['proxyNotControllable']);
      return this.clearBadge();
    }
  };

  ChromeOptions.prototype._badgeTitle = null;

  ChromeOptions.prototype.setBadge = function(options) {
    if (!options) {
      options = this._proxyNotControllable ? {
        text: '=',
        color: '#da4f49'
      } : {
        text: '?',
        color: '#49afcd'
      };
    }
    actionApi().setBadgeText({
      text: options.text
    });
    actionApi().setBadgeBackgroundColor({
      color: options.color
    });
    if (options.title) {
      this._badgeTitle = options.title;
      return actionApi().setTitle({
        title: options.title
      });
    } else {
      return this._badgeTitle = null;
    }
  };

  ChromeOptions.prototype.clearBadge = function() {
    var base;
    if (this.externalApi.disabled) {
      return;
    }
    if (this._badgeTitle) {
      this.currentProfileChanged('clearBadge');
    }
    if (this._proxyNotControllable) {
      this.setBadge();
    } else {
      if (typeof (base = actionApi()).setBadgeText === "function") {
        base.setBadgeText({
          text: ''
        });
      }
    }
  };

  ChromeOptions.prototype._quickSwitchInit = false;

  ChromeOptions.prototype._quickSwitchHandlerReady = false;

  ChromeOptions.prototype._quickSwitchCanEnable = false;

  ChromeOptions.prototype.setQuickSwitch = function(quickSwitch, canEnable) {
    var base, ref;
    this._quickSwitchCanEnable = canEnable;
    if (!this._quickSwitchHandlerReady) {
      this._quickSwitchHandlerReady = true;
      window.OmegaContextMenuQuickSwitchHandler = (function(_this) {
        return function(info) {
          var changes, setOptions;
          changes = {};
          changes['-enableQuickSwitch'] = info.checked;
          setOptions = _this._setOptions(changes);
          if (info.checked && !_this._quickSwitchCanEnable) {
            return setOptions.then(function() {
              return chrome.tabs.create({
                url: chrome.runtime.getURL('options.html#/ui')
              });
            });
          }
        };
      })(this);
    }
    if (quickSwitch || (actionApi().setPopup == null)) {
      if (typeof (base = actionApi()).setPopup === "function") {
        base.setPopup({
          popup: ''
        });
      }
      if (!this._quickSwitchInit) {
        this._quickSwitchInit = true;
        actionApi().onClicked.addListener((function(_this) {
          return function(tab) {
            var index, profiles;
            _this.clearBadge();
            if (!_this._options['-enableQuickSwitch']) {
              chrome.tabs.create({
                url: 'popup/index.html'
              });
              return;
            }
            profiles = _this._options['-quickSwitchProfiles'];
            index = profiles.indexOf(_this._currentProfileName);
            index = (index + 1) % profiles.length;
            return _this.applyProfile(profiles[index]).then(function() {
              var url;
              if (_this._options['-refreshOnProfileChange']) {
                url = tab.url;
                if (!url) {
                  return;
                }
                if (url.substr(0, 6) === 'chrome') {
                  return;
                }
                if (url.substr(0, 6) === 'about:') {
                  return;
                }
                if (url.substr(0, 4) === 'moz-') {
                  return;
                }
                return chrome.tabs.reload(tab.id, function() {
                  chrome.runtime.lastError;
                });
              }
            });
          };
        })(this));
      }
    } else {
      actionApi().setPopup({
        popup: 'popup/index.html'
      });
    }
    if ((ref = chrome.contextMenus) != null) {
      ref.update('enableQuickSwitch', {
        checked: !!quickSwitch
      });
    }
    return Promise.resolve();
  };

  ChromeOptions.prototype.setInspect = function(settings) {
    if (this._inspect) {
      if (settings.showMenu) {
        this._inspect.enable();
      } else {
        this._inspect.disable();
      }
    }
    return Promise.resolve();
  };

  ChromeOptions.prototype._requestMonitor = null;

  ChromeOptions.prototype._monitorWebRequests = false;

  ChromeOptions.prototype._tabRequestInfoPorts = null;

  ChromeOptions.prototype.setMonitorWebRequests = function(enabled) {
    var wildcardForReq;
    this._monitorWebRequests = enabled;
    if (enabled && (this._requestMonitor == null)) {
      this._tabRequestInfoPorts = {};
      wildcardForReq = function(req) {
        return OmegaPac.wildcardForUrl(req.url);
      };
      this._requestMonitor = new WebRequestMonitor(wildcardForReq);
      this._requestMonitor.watchTabs((function(_this) {
        return function(tabId, info) {
          var badge, ref;
          if (!_this._monitorWebRequests) {
            return;
          }
          if (info.errorCount > 0) {
            info.badgeSet = true;
            badge = {
              text: info.errorCount.toString(),
              color: '#f0ad4e'
            };
            actionApi().setBadgeText({
              text: badge.text,
              tabId: tabId
            });
            actionApi().setBadgeBackgroundColor({
              color: badge.color,
              tabId: tabId
            });
          } else if (info.badgeSet) {
            info.badgeSet = false;
            actionApi().setBadgeText({
              text: '',
              tabId: tabId
            });
          }
          return (ref = _this._tabRequestInfoPorts[tabId]) != null ? ref.postMessage({
            errorCount: info.errorCount,
            summary: info.summary
          }) : void 0;
        };
      })(this));
      return chrome.runtime.onConnect.addListener((function(_this) {
        return function(rawPort) {
          var port, tabId;
          if (rawPort.name !== 'tabRequestInfo') {
            return;
          }
          if (!_this._monitorWebRequests) {
            return;
          }
          tabId = null;
          port = new ChromePort(rawPort);
          port.onMessage.addListener(function(msg) {
            var info;
            tabId = msg.tabId;
            _this._tabRequestInfoPorts[tabId] = port;
            info = _this._requestMonitor.tabInfo[tabId];
            if (info) {
              return port.postMessage({
                errorCount: info.errorCount,
                summary: info.summary
              });
            }
          });
          return port.onDisconnect.addListener(function() {
            if (tabId != null) {
              return delete _this._tabRequestInfoPorts[tabId];
            }
          });
        };
      })(this));
    }
  };

  ChromeOptions.prototype._alarms = null;

  ChromeOptions.prototype.schedule = function(name, periodInMinutes, callback) {
    name = 'omega.' + name;
    if (typeof _alarms === "undefined" || _alarms === null) {
      this._alarms = {};
      chrome.alarms.onAlarm.addListener((function(_this) {
        return function(alarm) {
          var base, name1;
          return typeof (base = _this._alarms)[name1 = alarm.name] === "function" ? base[name1]() : void 0;
        };
      })(this));
    }
    if (periodInMinutes < 0) {
      delete this._alarms[name];
      chrome.alarms.clear(name);
    } else {
      this._alarms[name] = callback;
      chrome.alarms.create(name, {
        periodInMinutes: periodInMinutes
      });
    }
    return Promise.resolve();
  };

  ChromeOptions.prototype.printFixedProfile = function(profile) {
    var i, len, pacResult, ref, result, scheme;
    if (profile.profileType !== 'FixedProfile') {
      return;
    }
    result = '';
    ref = OmegaPac.Profiles.schemes;
    for (i = 0, len = ref.length; i < len; i++) {
      scheme = ref[i];
      if (!profile[scheme.prop]) {
        continue;
      }
      pacResult = OmegaPac.Profiles.pacResult(profile[scheme.prop]);
      if (scheme.scheme) {
        result += scheme.scheme + ": " + pacResult + "\n";
      } else {
        result += pacResult + "\n";
      }
    }
    result || (result = chrome.i18n.getMessage('browserAction_profileDetails_DirectProfile'));
    return result;
  };

  ChromeOptions.prototype.printProfile = function(profile) {
    var type;
    type = profile.profileType;
    if (type.indexOf('RuleListProfile') >= 0) {
      type = 'RuleListProfile';
    }
    if (type === 'FixedProfile') {
      return this.printFixedProfile(profile);
    } else if (type === 'PacProfile' && profile.pacUrl) {
      return profile.pacUrl;
    } else {
      return chrome.i18n.getMessage('browserAction_profileDetails_' + type) || null;
    }
  };

  ChromeOptions.prototype.upgrade = function(options, changes) {
    return ChromeOptions.__super__.upgrade.call(this, options)["catch"]((function(_this) {
      return function(err) {
        var getOldOptions;
        if (options != null ? options['schemaVersion'] : void 0) {
          return Promise.reject(err);
        }
        getOldOptions = _this.switchySharp ? _this.switchySharp.getOptions().timeout(1000) : Promise.reject();
        getOldOptions = getOldOptions["catch"](function() {
          if (options != null ? options['config'] : void 0) {
            return Promise.resolve(options);
          } else if (localStorage['config']) {
            return Promise.resolve(localStorage);
          } else {
            return Promise.reject(new OmegaTarget.Options.NoOptionsError());
          }
        });
        return getOldOptions.then(function(oldOptions) {
          var ex, i18n, upgraded;
          i18n = {
            upgrade_profile_auto: chrome.i18n.getMessage('upgrade_profile_auto')
          };
          try {
            upgraded = require('./upgrade')(oldOptions, i18n);
          } catch (error1) {
            ex = error1;
            _this.log.error(ex);
            return Promise.reject(ex);
          }
          if (localStorage['config']) {
            Object.getPrototypeOf(localStorage).clear.call(localStorage);
          }
          _this._state.set({
            'firstRun': 'upgrade'
          });
          return _this && ChromeOptions.__super__.upgrade.call(_this, upgraded, upgraded);
        });
      };
    })(this));
  };

  ChromeOptions.prototype.onFirstRun = function(reason) {
    return chrome.tabs.create({
      url: chrome.runtime.getURL('options.html')
    });
  };

  ChromeOptions.prototype.getPageInfo = function(arg) {
    var errorCount, getBadge, getInspectUrl, ref, ref1, result, tabId, url;
    tabId = arg.tabId, url = arg.url;
    errorCount = (ref = this._requestMonitor) != null ? (ref1 = ref.tabInfo[tabId]) != null ? ref1.errorCount : void 0 : void 0;
    result = errorCount ? {
      errorCount: errorCount
    } : null;
    getBadge = new Promise(function(resolve, reject) {
      if (actionApi().getBadgeText == null) {
        resolve('');
        return;
      }
      return actionApi().getBadgeText({
        tabId: tabId
      }, function(result) {
        return resolve(result);
      });
    });
    getInspectUrl = this._state.get({
      inspectUrl: ''
    });
    return Promise.join(getBadge, getInspectUrl, (function(_this) {
      return function(badge, arg1) {
        var domain, errorPagePrefix, inspectUrl;
        inspectUrl = arg1.inspectUrl;
        if (badge === '#' && inspectUrl) {
          url = inspectUrl;
        } else {
          _this.clearBadge();
        }
        if (!url) {
          return result;
        }
        if (url.substr(0, 6) === 'chrome') {
          errorPagePrefix = 'chrome://errorpage/';
          if (url.substr(0, errorPagePrefix.length) === errorPagePrefix) {
            url = querystring.parse(url.substr(url.indexOf('?') + 1)).lasturl;
            if (!url) {
              return result;
            }
          } else {
            return result;
          }
        }
        if (url.substr(0, 6) === 'about:') {
          return result;
        }
        if (url.substr(0, 4) === 'moz-') {
          return result;
        }
        domain = OmegaPac.getBaseDomain(Url.parse(url).hostname);
        return {
          url: url,
          domain: domain,
          tempRuleProfileName: _this.queryTempRule(domain),
          errorCount: errorCount
        };
      };
    })(this));
  };

  return ChromeOptions;

})(OmegaTarget.Options);

module.exports = ChromeOptions;

export {};
