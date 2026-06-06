type PopupCallback = (error?: unknown, result?: unknown) => unknown;

type BackgroundResponse = {
  error?: unknown;
  result?: unknown;
};

type PopupPageInfo = {
  url?: string;
  [key: string]: unknown;
};

function callBackgroundNoReply(method: string, args: unknown[], cb?: PopupCallback) {
  chrome.runtime.sendMessage({
    method: method,
    args: args,
    noReply: true,
    refreshActivePage: true,
  }, function() {
    chrome.runtime.lastError;
  });
  if (cb) return cb();
}

function callBackground(method: string, args: unknown[], cb?: PopupCallback) {
  chrome.runtime.sendMessage({
    method: method,
    args: args,
  }, function(response: LegacyDynamic) {
    var backgroundResponse = response as unknown as BackgroundResponse;
    if (chrome.runtime.lastError != null)
      return cb && cb(chrome.runtime.lastError)
    if (backgroundResponse.error) return cb && cb(backgroundResponse.error)
    return cb && cb(null, backgroundResponse.result)
  });
}

function callBackgroundWithRefresh(method: string, args: unknown[], cb?: PopupCallback) {
  chrome.runtime.sendMessage({
    method: method,
    args: args,
    refreshActivePage: true,
  }, function(response: LegacyDynamic) {
    var backgroundResponse = response as unknown as BackgroundResponse;
    if (chrome.runtime.lastError != null)
      return cb && cb(chrome.runtime.lastError)
    if (backgroundResponse.error) return cb && cb(backgroundResponse.error)
    return cb && cb(null, backgroundResponse.result)
  });
}

var requestInfoCallback: PopupCallback | null = null;
var isManifestV3 = chrome.runtime.getManifest &&
  chrome.runtime.getManifest().manifest_version >= 3;
var localStatePrefix = 'omega.local.';

function cacheActivePageInfo(info?: PopupPageInfo | null) {
  if (!info || !info.url || typeof localStorage === 'undefined') return;
  try {
    localStorage[localStatePrefix + 'web.last_page_info'] = JSON.stringify(info);
  } catch (_) {
  }
}

(globalThis as typeof globalThis & {OmegaTargetPopup: OmegaTargetPopupApi}).OmegaTargetPopup = {
  getState: function (keys: string[], cb?: PopupCallback) {
    if (isManifestV3 || typeof localStorage === 'undefined' ||
        !localStorage.length) {
      callBackground('getState', [keys], cb);
      return;
    }
    var results: Record<string, unknown> = {};
    keys.forEach(function(key: string) {
      try {
        results[key] = JSON.parse(localStorage['omega.local.' + key]);
      } catch (_) {
        return null;
      }
    });
    if (cb) cb(null, results);
  },
  applyProfile: function (name: string, cb?: PopupCallback) {
    callBackgroundNoReply('applyProfile', [name], cb);
  },
  openOptions: function (hash?: string, cb?: PopupCallback) {
    var options_url = chrome.runtime.getURL('options.html');

    chrome.tabs.query({
      url: options_url
    }, function(tabs) {
      var target_url = options_url;
      if (hash) {
        try {
          var url = new URL((tabs && tabs[0] && tabs[0].url) || options_url);
          url.hash = hash;
          target_url = url.href;
        } catch (_) {
          target_url = options_url + hash;
        }
      }
      if (!chrome.runtime.lastError && tabs && tabs.length > 0) {
        var props: {active: boolean; url?: string} = {
          active: true
        };
        if (hash) {
          props.url = target_url;
        }
        chrome.tabs.update(tabs[0].id, props);
      } else {
        chrome.tabs.create({
          url: target_url
        });
      }
      if (cb) return cb();
    });
  },
  getActivePageInfo: function(cb: PopupCallback) {
    chrome.tabs.query({active: true, lastFocusedWindow: true}, function (tabs) {
      if (tabs.length === 0 || !tabs[0].url) return cb();
      var args = {tabId: tabs[0].id, url: tabs[0].url};
      callBackground('getPageInfo', [args], function(err: unknown, info: PopupPageInfo) {
        if (!err) cacheActivePageInfo(info);
        cb(err, info);
      })
    });
  },
  setDefaultProfile: function(profileName: string, defaultProfileName: string, cb?: PopupCallback) {
    callBackgroundNoReply('setDefaultProfile',
      [profileName, defaultProfileName], cb);
  },
  addTempRule: function(domain: string, profileName: string, cb?: PopupCallback) {
    callBackgroundNoReply('addTempRule', [domain, profileName], cb);
  },
  addCondition: function(condition: unknown, profileName: string, addToBottom: boolean, cb?: PopupCallback) {
    callBackgroundWithRefresh('addCondition',
      [condition, profileName, addToBottom], cb);
  },
  addProfile: function(profile: unknown, cb?: PopupCallback) {
    callBackgroundWithRefresh('addProfile', [profile], cb);
  },
  setState: function(name: string, value: unknown, cb?: PopupCallback) {
    callBackground('setState', [name, value], cb);
  },
  openManage: function(domain?: string, profileName?: string, cb?: PopupCallback) {
    chrome.tabs.create({
      url: 'chrome://extensions/?id=' + chrome.runtime.id,
    }, cb);
  },
  getMessage: chrome.i18n.getMessage.bind(chrome.i18n),
};
