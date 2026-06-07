type PopupCallback = (error?: unknown, result?: unknown) => unknown;

type BackgroundResponse = {
  error?: unknown;
  result?: unknown;
};

type PopupPageInfo = {
  url?: string;
  [key: string]: unknown;
};

type BackgroundMessage = {
  args: unknown[];
  method: string;
  noReply?: boolean;
  refreshActivePage?: boolean;
};

function handleBackgroundResponse(response: LegacyDynamic, cb?: PopupCallback) {
  if (!cb) {
    return;
  }
  const backgroundResponse = response as unknown as BackgroundResponse | undefined;
  if (chrome.runtime.lastError != null) {
    cb(chrome.runtime.lastError);
    return;
  }
  if (backgroundResponse != null && backgroundResponse.error) {
    cb(backgroundResponse.error);
    return;
  }
  cb(null, backgroundResponse != null ? backgroundResponse.result : undefined);
}

function sendBackgroundMessage(message: BackgroundMessage, cb?: PopupCallback) {
  chrome.runtime.sendMessage(message, (response: LegacyDynamic) => {
    handleBackgroundResponse(response, cb);
  });
}

function callBackgroundNoReply(method: string, args: unknown[], cb?: PopupCallback) {
  chrome.runtime.sendMessage({
    method: method,
    args: args,
    noReply: true,
    refreshActivePage: true,
  }, () => {
    chrome.runtime.lastError;
  });
  if (cb) return cb();
}

function callBackground(method: string, args: unknown[], cb?: PopupCallback) {
  sendBackgroundMessage({
    method: method,
    args: args,
  }, cb);
}

function callBackgroundWithRefresh(method: string, args: unknown[], cb?: PopupCallback) {
  sendBackgroundMessage({
    method: method,
    args: args,
    refreshActivePage: true,
  }, cb);
}

const isManifestV3 = chrome.runtime.getManifest &&
  chrome.runtime.getManifest().manifest_version >= 3;
const localStatePrefix = 'omega.local.';

function cacheActivePageInfo(info?: PopupPageInfo | null) {
  if (!info || !info.url || typeof localStorage === 'undefined') return;
  try {
    localStorage[localStatePrefix + 'web.last_page_info'] = JSON.stringify(info);
  } catch (_) {
  }
}

(globalThis as typeof globalThis & {OmegaTargetPopup: OmegaTargetPopupApi}).OmegaTargetPopup = {
  getState(keys: string[], cb?: PopupCallback) {
    if (isManifestV3 || typeof localStorage === 'undefined' ||
        !localStorage.length) {
      callBackground('getState', [keys], cb);
      return;
    }
    const results: Record<string, unknown> = {};
    keys.forEach((key: string) => {
      try {
        results[key] = JSON.parse(localStorage['omega.local.' + key]);
      } catch (_) {
        return null;
      }
    });
    if (cb) cb(null, results);
  },
  applyProfile(name: string, cb?: PopupCallback) {
    callBackgroundNoReply('applyProfile', [name], cb);
  },
  openOptions(hash?: string, cb?: PopupCallback) {
    const optionsUrl = chrome.runtime.getURL('options.html');

    chrome.tabs.query({
      url: optionsUrl
    }, (tabs) => {
      let targetUrl = optionsUrl;
      if (hash) {
        try {
          const url = new URL((tabs && tabs[0] && tabs[0].url) || optionsUrl);
          url.hash = hash;
          targetUrl = url.href;
        } catch (_) {
          targetUrl = optionsUrl + hash;
        }
      }
      if (!chrome.runtime.lastError && tabs && tabs.length > 0) {
        const props: {active: boolean; url?: string} = {
          active: true
        };
        if (hash) {
          props.url = targetUrl;
        }
        chrome.tabs.update(tabs[0].id, props);
      } else {
        chrome.tabs.create({
          url: targetUrl
        });
      }
      if (cb) return cb();
    });
  },
  getActivePageInfo(cb: PopupCallback) {
    chrome.tabs.query({active: true, lastFocusedWindow: true}, (tabs) => {
      if (tabs.length === 0 || !tabs[0].url) return cb();
      const args = {tabId: tabs[0].id, url: tabs[0].url};
      callBackground('getPageInfo', [args], (err: unknown, info: PopupPageInfo) => {
        if (!err) cacheActivePageInfo(info);
        cb(err, info);
      });
    });
  },
  setDefaultProfile(profileName: string, defaultProfileName: string, cb?: PopupCallback) {
    callBackgroundNoReply('setDefaultProfile',
      [profileName, defaultProfileName], cb);
  },
  addTempRule(domain: string, profileName: string, cb?: PopupCallback) {
    callBackgroundNoReply('addTempRule', [domain, profileName], cb);
  },
  addCondition(condition: unknown, profileName: string, addToBottom: boolean, cb?: PopupCallback) {
    callBackgroundWithRefresh('addCondition',
      [condition, profileName, addToBottom], cb);
  },
  addProfile(profile: unknown, cb?: PopupCallback) {
    callBackgroundWithRefresh('addProfile', [profile], cb);
  },
  setState(name: string, value: unknown, cb?: PopupCallback) {
    callBackground('setState', [name, value], cb);
  },
  openManage(domain?: string, profileName?: string, cb?: PopupCallback) {
    chrome.tabs.create({
      url: 'chrome://extensions/?id=' + chrome.runtime.id,
    }, cb);
  },
  getMessage: chrome.i18n.getMessage.bind(chrome.i18n),
};
