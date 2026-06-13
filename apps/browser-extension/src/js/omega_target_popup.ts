type PopupCallback<T = unknown> = (error?: unknown, result?: T) => unknown;

type BackgroundResponse<T = unknown> = {
  error?: unknown;
  result?: T;
};

type PageInfoRequest = {
  includeExplanations?: boolean;
  tabId?: number;
  url: string;
};

type PageInfoOptions = {
  includeExplanations?: boolean;
};

function popupTabUrl(tab?: Pick<ChromeTab, 'pendingUrl' | 'url'> | null) {
  return tab?.pendingUrl || tab?.url;
}

type PopupBackgroundMethodArgs = {
  addCondition: [condition: PopupApiConditionInput, profileName: string, addToBottom: boolean];
  addProfile: [profile: PopupApiProfile];
  addTempRule: [domain: string, profileName: string];
  applyProfile: [name: string];
  getPageInfo: [args: PageInfoRequest];
  getState: [keys: PopupApiStateKey[]];
  setDefaultProfile: [profileName: string, defaultProfileName: string];
  setState: [name: PopupApiWritableStateKey, value: PopupApiState[PopupApiWritableStateKey]];
};

type PopupBackgroundMethodResult = {
  addCondition: unknown;
  addProfile: unknown;
  addTempRule: unknown;
  applyProfile: unknown;
  getPageInfo: PopupApiPageInfo;
  getState: PopupApiState;
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

function cacheActivePageInfo(info?: PopupApiPageInfo | null) {
  if (!info || !info.url || typeof localStorage === 'undefined') return;
  try {
    localStorage[localStatePrefix + 'web.last_page_info'] = JSON.stringify(info);
  } catch (_) {
  }
}

(globalThis as typeof globalThis & {OmegaTargetPopup: OmegaTargetPopupApi}).OmegaTargetPopup = {
  getState(keys: PopupApiStateKey[], cb?: PopupCallback<PopupApiState>) {
    if (isManifestV3 || typeof localStorage === 'undefined' ||
        !localStorage.length) {
      callBackground('getState', [keys], cb);
      return;
    }
    const results: Partial<PopupApiState> = {};
    keys.forEach((key: PopupApiStateKey) => {
      try {
        Object.assign(results, {
          [key]: JSON.parse(localStorage['omega.local.' + key])
        });
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
  getActivePageInfo(optionsOrCallback?: PageInfoOptions | PopupCallback<PopupApiPageInfo>, cb?: PopupCallback<PopupApiPageInfo>) {
    const options = typeof optionsOrCallback === 'function' ? {} : optionsOrCallback || {};
    const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : cb;
    chrome.tabs.query({active: true, lastFocusedWindow: true}, (tabs) => {
      const tab = tabs[0];
      const url = popupTabUrl(tab);
      if (tabs.length === 0 || !url) return callback?.();
      const args = {
        includeExplanations: options.includeExplanations,
        tabId: tab.id,
        url
      };
      callBackground('getPageInfo', [args], (err?: unknown, info?: PopupApiPageInfo) => {
        if (!err) cacheActivePageInfo(info);
        callback?.(err, info);
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
  addCondition(condition: PopupApiConditionInput, profileName: string, addToBottom: boolean, cb?: PopupCallback) {
    callBackgroundWithRefresh('addCondition',
      [condition, profileName, addToBottom], cb);
  },
  addProfile(profile: PopupApiProfile, cb?: PopupCallback) {
    callBackgroundWithRefresh('addProfile', [profile], cb);
  },
  setState(name: PopupApiWritableStateKey, value: PopupApiState[PopupApiWritableStateKey], cb?: PopupCallback) {
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
