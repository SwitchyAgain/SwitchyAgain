// @ts-nocheck
var ChromeTabs, actionApi,
  hasProp = {}.hasOwnProperty;

actionApi = function() {
  var legacyKey;
  legacyKey = 'browser';
  legacyKey += 'Action';
  return chrome.action || chrome[legacyKey];
};

ChromeTabs = (function() {
  ChromeTabs.prototype._defaultAction = null;

  ChromeTabs.prototype._badgeTab = null;

  function ChromeTabs(actionForUrl) {
    this.actionForUrl = actionForUrl;
    this._dirtyTabs = {};
    return;
  }

  ChromeTabs.prototype.ignoreError = function() {
    chrome.runtime.lastError;
  };

  ChromeTabs.prototype.watch = function() {
    chrome.tabs.onUpdated.addListener(this.onUpdated.bind(this));
    return chrome.tabs.onActivated.addListener((function(_this) {
      return function(info) {
        return chrome.tabs.get(info.tabId, function(tab) {
          if (chrome.runtime.lastError) {
            return;
          }
          if (_this._dirtyTabs.hasOwnProperty(info.tabId)) {
            return _this.onUpdated(tab.id, {}, tab);
          }
        });
      };
    })(this));
  };

  ChromeTabs.prototype.resetAll = function(action) {
    this._defaultAction = action;
    chrome.tabs.query({}, (function(_this) {
      return function(tabs) {
        _this._dirtyTabs = {};
        return tabs.forEach(function(tab) {
          _this._dirtyTabs[tab.id] = tab.id;
          if (tab.active) {
            return _this.onUpdated(tab.id, {}, tab);
          }
        });
      };
    })(this));
    if (actionApi().setPopup != null) {
      actionApi().setTitle({
        title: action.title
      });
    } else {
      actionApi().setTitle({
        title: action.shortTitle
      });
    }
    return this.setIcon(action.icon);
  };

  ChromeTabs.prototype.onUpdated = function(tabId, changeInfo, tab) {
    if (this._dirtyTabs.hasOwnProperty(tab.id)) {
      delete this._dirtyTabs[tab.id];
    } else if (changeInfo.url == null) {
      if ((changeInfo.status != null) && changeInfo.status !== 'loading') {
        return;
      }
    }
    return this.processTab(tab, changeInfo);
  };

  ChromeTabs.prototype.processTab = function(tab, changeInfo) {
    var base, id, ref;
    if (this._badgeTab) {
      ref = this._badgeTab;
      for (id in ref) {
        if (!hasProp.call(ref, id)) continue;
        try {
          if (typeof (base = actionApi()).setBadgeText === "function") {
            base.setBadgeText({
              text: '',
              tabId: id
            });
          }
        } catch (error) {}
        this._badgeTab = null;
      }
    }
    if ((tab.url == null) || tab.url.indexOf("chrome") === 0) {
      if (this._defaultAction) {
        actionApi().setTitle({
          title: this._defaultAction.title,
          tabId: tab.id
        });
        this.clearIcon(tab.id);
      }
      return;
    }
    return this.actionForUrl(tab.url).then((function(_this) {
      return function(action) {
        if (!action) {
          _this.clearIcon(tab.id);
          return;
        }
        _this.setIcon(action.icon, tab.id);
        if (actionApi().setPopup != null) {
          return actionApi().setTitle({
            title: action.title,
            tabId: tab.id
          });
        } else {
          return actionApi().setTitle({
            title: action.shortTitle,
            tabId: tab.id
          });
        }
      };
    })(this));
  };

  ChromeTabs.prototype.setTabBadge = function(tab, badge) {
    var base, base1;
    if (this._badgeTab == null) {
      this._badgeTab = {};
    }
    this._badgeTab[tab.id] = true;
    if (typeof (base = actionApi()).setBadgeText === "function") {
      base.setBadgeText({
        text: badge.text,
        tabId: tab.id
      });
    }
    return typeof (base1 = actionApi()).setBadgeBackgroundColor === "function" ? base1.setBadgeBackgroundColor({
      color: badge.color,
      tabId: tab.id
    }) : void 0;
  };

  ChromeTabs.prototype.setIcon = function(icon, tabId) {
    var params;
    if (icon == null) {
      return;
    }
    if (tabId != null) {
      params = {
        imageData: icon,
        tabId: tabId
      };
    } else {
      params = {
        imageData: icon
      };
    }
    return this._chromeSetIcon(params);
  };

  ChromeTabs.prototype._chromeSetIcon = function(params) {
    var _, base, base1;
    try {
      return typeof (base = actionApi()).setIcon === "function" ? base.setIcon(params, this.ignoreError) : void 0;
    } catch (error) {
      _ = error;
      params.imageData = {
        19: params.imageData[19],
        38: params.imageData[38]
      };
      return typeof (base1 = actionApi()).setIcon === "function" ? base1.setIcon(params, this.ignoreError) : void 0;
    }
  };

  ChromeTabs.prototype.clearIcon = function(tabId) {
    var ref;
    if (((ref = this._defaultAction) != null ? ref.icon : void 0) == null) {
      return;
    }
    return this._chromeSetIcon({
      imageData: this._defaultAction.icon,
      tabId: tabId
    }, this.ignoreError);
  };

  return ChromeTabs;

})();

module.exports = ChromeTabs;

export {};
