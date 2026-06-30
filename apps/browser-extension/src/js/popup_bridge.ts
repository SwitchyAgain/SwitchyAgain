type PopupCallback<T = unknown> = (error?: unknown, result?: T) => unknown;

type BackgroundResponse<T = unknown> = {
  error?: unknown;
  result?: T;
};

type PageInfoRequest = {
  cookieStoreId?: string;
  groupId?: number;
  includeExplanations?: boolean;
  incognito?: boolean;
  tabId?: number;
  url: string;
  windowId?: number;
};

type PageInfoOptions = {
  includeExplanations?: boolean;
};

type OptionsTab = Pick<ChromeTab, 'id' | 'incognito' | 'url' | 'windowId'>;

function popupTabUrl(tab?: Pick<ChromeTab, 'pendingUrl' | 'url'> | null) {
  return tab?.pendingUrl || tab?.url;
}

type ProfileScopeSetRequest = {
  cookieStoreId?: string;
  groupId?: number;
  incognito?: boolean;
  profileName?: string;
  scope: 'container' | 'group' | 'normal' | 'private' | 'tab';
  tabId?: number;
  windowId?: number;
};

type PopupBackgroundMethodArgs = {
  addCondition: [condition: PopupApiConditionInput, profileName: string, addToBottom: boolean];
  addProfile: [profile: PopupApiProfile];
  addTempRule: [domain: string, profileName: string];
  applyProfile: [name: string];
  beginOptionsHandoff: [tabId: number];
  getOptionsPageState: [tabId: number];
  getPageInfo: [args: PageInfoRequest];
  getState: [keys: PopupApiStateKey[]];
  setDefaultProfile: [profileName: string, defaultProfileName: string];
  setProfileScope: [args: ProfileScopeSetRequest];
  setState: [name: PopupApiWritableStateKey, value: PopupApiState[PopupApiWritableStateKey]];
};

type PopupBackgroundMethodResult = {
  addCondition: unknown;
  addProfile: unknown;
  addTempRule: unknown;
  applyProfile: unknown;
  beginOptionsHandoff: string;
  getOptionsPageState: {
    dirty: boolean;
    registered: boolean;
  };
  getPageInfo: PopupApiPageInfo;
  getState: PopupApiState;
  setDefaultProfile: unknown;
  setProfileScope: unknown;
  setState: unknown;
};

type PopupBackgroundMethod = keyof PopupBackgroundMethodArgs;
type PopupNoReplyMethod = 'addTempRule' | 'applyProfile' | 'setDefaultProfile' | 'setProfileScope';

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

function callBackgroundNoReply<M extends PopupNoReplyMethod>(method: M, args: PopupBackgroundMethodArgs[M], cb?: PopupCallback) {
  chrome.runtime.sendMessage(
    {
      method: method,
      args: args,
      noReply: true,
      refreshActivePage: true
    },
    () => {
      chrome.runtime.lastError;
    }
  );
  if (cb) return cb();
}

function callBackground<M extends PopupBackgroundMethod>(
  method: M,
  args: PopupBackgroundMethodArgs[M],
  cb?: PopupCallback<PopupBackgroundMethodResult[M]>
) {
  sendBackgroundMessage(
    {
      method: method,
      args: args
    },
    cb
  );
}

function callBackgroundWithRefresh<M extends PopupBackgroundMethod>(
  method: M,
  args: PopupBackgroundMethodArgs[M],
  cb?: PopupCallback<PopupBackgroundMethodResult[M]>
) {
  sendBackgroundMessage(
    {
      method: method,
      args: args,
      refreshActivePage: true
    },
    cb
  );
}

const isManifestV3 = chrome.runtime.getManifest && (chrome.runtime.getManifest().manifest_version ?? 2) >= 3;
const localStatePrefix = 'omega.local.';

function cacheActivePageInfo(info?: PopupApiPageInfo | null) {
  if (!info || !info.url || typeof localStorage === 'undefined') return;
  try {
    localStorage[localStatePrefix + 'web.last_page_info'] = JSON.stringify(info);
  } catch (_) {}
}

function optionsTabSameWindowType(tab: OptionsTab | undefined, currentTab: OptionsTab | undefined) {
  if (typeof tab?.incognito !== 'boolean' || typeof currentTab?.incognito !== 'boolean') {
    return true;
  }
  return tab.incognito === currentTab.incognito;
}

function optionsUrlForOpen(optionsUrl: string, sourceUrl: string | undefined, hash?: string | null) {
  let targetUrl = optionsUrl;
  if (!hash) {
    return targetUrl;
  }
  try {
    const url = new URL(sourceUrl || optionsUrl);
    url.hash = hash;
    targetUrl = url.href;
  } catch (_) {
    targetUrl = optionsUrl + hash;
  }
  return targetUrl;
}

function optionsUrlWithHandoff(url: string, handoffId: string) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('handoff', handoffId);
    return parsed.href;
  } catch (_) {
    const [base, hash = ''] = url.split('#');
    const separator = base.indexOf('?') >= 0 ? '&' : '?';
    return `${base}${separator}handoff=${encodeURIComponent(handoffId)}${hash ? `#${hash}` : ''}`;
  }
}

function removeOptionsTab(tabId: number | undefined, callback: () => void) {
  if (typeof tabId !== 'number') {
    callback();
    return;
  }
  const tabs = chrome.tabs as typeof chrome.tabs & {
    remove?: (tabId: number, callback?: () => void) => void;
  };
  if (typeof tabs.remove !== 'function') {
    callback();
    return;
  }
  tabs.remove(tabId, () => {
    chrome.runtime.lastError;
    callback();
  });
}

(globalThis as typeof globalThis & {PopupBridge: PopupBridgeApi}).PopupBridge = {
  getState(keys: PopupApiStateKey[], cb?: PopupCallback<PopupApiState>) {
    if (isManifestV3 || typeof localStorage === 'undefined' || !localStorage.length) {
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

    chrome.tabs.query({active: true, lastFocusedWindow: true}, (currentTabs) => {
      const currentTab = currentTabs?.[0] as OptionsTab | undefined;
      chrome.tabs.query(
        {
          url: optionsUrl
        },
        (tabs) => {
          const optionTabs = (tabs || []) as OptionsTab[];
          const sameWindowTypeTab = optionTabs.find((tab) => optionsTabSameWindowType(tab, currentTab));
          const targetTab = sameWindowTypeTab || optionTabs[0];
          const targetUrl = optionsUrlForOpen(optionsUrl, targetTab?.url, hash);
          if (chrome.runtime.lastError || !targetTab) {
            chrome.tabs.create({
              url: targetUrl
            });
            if (cb) return cb();
            return;
          }
          if (optionsTabSameWindowType(targetTab, currentTab)) {
            if (typeof targetTab.id !== 'number') {
              chrome.tabs.create({
                url: targetUrl
              });
              if (cb) return cb();
              return;
            }
            const props: {active: boolean; url?: string} = {
              active: true
            };
            if (hash) {
              props.url = targetUrl;
            }
            chrome.tabs.update(targetTab.id, props, () => {
              if (chrome.runtime.lastError) {
                chrome.tabs.create({
                  url: targetUrl
                });
              }
              if (cb) return cb();
            });
            return;
          }
          if (typeof targetTab.id !== 'number') {
            chrome.tabs.create({
              url: targetUrl
            });
            if (cb) return cb();
            return;
          }
          const targetTabId = targetTab.id;
          callBackground('getOptionsPageState', [targetTabId], (stateError, state) => {
            if (stateError) {
              if (cb) return cb(stateError);
              return;
            }
            if (!state?.registered) {
              if (cb) return cb(new Error('The existing settings page is not ready.'));
              return;
            }
            if (!state?.dirty) {
              removeOptionsTab(targetTabId, () => {
                chrome.tabs.create({
                  url: targetUrl
                });
                if (cb) return cb();
              });
              return;
            }
            callBackground('beginOptionsHandoff', [targetTabId], (handoffError, handoffId) => {
              if (handoffError || !handoffId) {
                if (cb) return cb(handoffError);
                return;
              }
              chrome.tabs.create({
                url: optionsUrlWithHandoff(targetUrl, handoffId)
              });
              if (cb) return cb();
            });
          });
        }
      );
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
        cookieStoreId: typeof tab.cookieStoreId === 'string' ? tab.cookieStoreId : undefined,
        groupId: typeof tab.groupId === 'number' ? tab.groupId : undefined,
        includeExplanations: options.includeExplanations,
        incognito: typeof tab.incognito === 'boolean' ? tab.incognito : undefined,
        tabId: tab.id,
        url,
        windowId: typeof tab.windowId === 'number' ? tab.windowId : undefined
      };
      callBackground('getPageInfo', [args], (err?: unknown, info?: PopupApiPageInfo) => {
        if (!err) cacheActivePageInfo(info);
        callback?.(err, info);
      });
    });
  },
  setDefaultProfile(profileName: string, defaultProfileName: string, cb?: PopupCallback) {
    callBackgroundNoReply('setDefaultProfile', [profileName, defaultProfileName], cb);
  },
  setProfileScope(args: ProfileScopeSetRequest, cb?: PopupCallback) {
    callBackgroundNoReply('setProfileScope', [args], cb);
  },
  addTempRule(domain: string, profileName: string, cb?: PopupCallback) {
    callBackgroundNoReply('addTempRule', [domain, profileName], cb);
  },
  addCondition(condition: PopupApiConditionInput, profileName: string, addToBottom: boolean, cb?: PopupCallback) {
    callBackgroundWithRefresh('addCondition', [condition, profileName, addToBottom], cb);
  },
  addProfile(profile: PopupApiProfile, cb?: PopupCallback) {
    callBackgroundWithRefresh('addProfile', [profile], cb);
  },
  setState(name: PopupApiWritableStateKey, value: PopupApiState[PopupApiWritableStateKey], cb?: PopupCallback) {
    callBackground('setState', [name, value], cb);
  },
  openManage(domainOrCallback?: string | PopupCallback, _profileName?: string, cb?: PopupCallback) {
    const callback = typeof domainOrCallback === 'function' ? domainOrCallback : cb;
    chrome.tabs.create(
      {
        url: 'chrome://extensions/?id=' + chrome.runtime.id
      },
      callback
    );
  },
  getMessage: chrome.i18n.getMessage.bind(chrome.i18n)
};
