type PopupCallback<T = unknown> = (error?: unknown, result?: T) => unknown;

type BackgroundResponse<T = unknown> = {
  error?: unknown;
  result?: T;
};

type PopupPageInfo = {
  url?: string;
  [key: string]: unknown;
};

type PageInfoRequest = {
  tabId?: number;
  url: string;
};

type PopupBackgroundMethodArgs = {
  addCondition: [condition: unknown, profileName: string, addToBottom: boolean];
  addProfile: [profile: unknown];
  addTempRule: [domain: string, profileName: string];
  applyProfile: [name: string];
  getPageInfo: [args: PageInfoRequest];
  getState: [keys: string[]];
  setDefaultProfile: [profileName: string, defaultProfileName: string];
  setState: [name: string, value: unknown];
};

type PopupBackgroundMethodResult = {
  addCondition: unknown;
  addProfile: unknown;
  addTempRule: unknown;
  applyProfile: unknown;
  getPageInfo: PopupPageInfo;
  getState: Record<string, unknown>;
  setDefaultProfile: unknown;
  setState: unknown;
};

type PopupBackgroundMethod = keyof PopupBackgroundMethodArgs;
type PopupNoReplyMethod = 'addTempRule' | 'applyProfile' | 'setDefaultProfile';

type BackgroundMessage<M extends PopupBackgroundMethod = PopupBackgroundMethod> = {
  args: PopupBackgroundMethodArgs[M];
  method: M;
  noReply?: boolean;
  refreshActivePage?: boolean;
};

function handleBackgroundResponse<T>(response?: BackgroundResponse<T>, cb?: PopupCallback<T>) {
  if (!cb) {
    return;
  }
  if (chrome.runtime.lastError != null) {
    cb(chrome.runtime.lastError);
    return;
  }
  if (response != null && response.error) {
    cb(response.error);
    return;
  }
  cb(null, response != null ? response.result : undefined);
}

function sendBackgroundMessage<M extends PopupBackgroundMethod>(
  message: BackgroundMessage<M>,
  cb?: PopupCallback<PopupBackgroundMethodResult[M]>
) {
  chrome.runtime.sendMessage(message, (response?: BackgroundResponse<PopupBackgroundMethodResult[M]>) => {
    handleBackgroundResponse(response, cb);
  });
}

function callBackgroundNoReply<M extends PopupNoReplyMethod>(
  method: M,
  args: PopupBackgroundMethodArgs[M],
  cb?: PopupCallback
) {
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

function callBackground<M extends PopupBackgroundMethod>(
  method: M,
  args: PopupBackgroundMethodArgs[M],
  cb?: PopupCallback<PopupBackgroundMethodResult[M]>
) {
  sendBackgroundMessage({
    method: method,
    args: args,
  }, cb);
}

function callBackgroundWithRefresh<M extends PopupBackgroundMethod>(
  method: M,
  args: PopupBackgroundMethodArgs[M],
  cb?: PopupCallback<PopupBackgroundMethodResult[M]>
) {
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
  getState(keys: string[], cb?: PopupCallback<Record<string, unknown>>) {
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
  openOptions(hash?: string | null, cb?: PopupCallback) {
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
  getActivePageInfo(cb: PopupCallback<PopupPageInfo>) {
    chrome.tabs.query({active: true, lastFocusedWindow: true}, (tabs) => {
      if (tabs.length === 0 || !tabs[0].url) return cb();
      const args = {tabId: tabs[0].id, url: tabs[0].url};
      callBackground('getPageInfo', [args], (err?: unknown, info?: PopupPageInfo) => {
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
  openManage(domainOrCallback?: string | PopupCallback, _profileName?: string, cb?: PopupCallback) {
    const callback = typeof domainOrCallback === 'function' ? domainOrCallback : cb;
    chrome.tabs.create({
      url: 'chrome://extensions/?id=' + chrome.runtime.id,
    }, callback);
  },
  getMessage: chrome.i18n.getMessage.bind(chrome.i18n),
};
