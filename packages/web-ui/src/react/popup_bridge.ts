import {message} from './i18n_client';
import type {OptionsPatch, RequestExplanation} from './options_client_types';
import type {NamedProfile, ProfileKey} from './profile_types';
import {callBackground, callBackgroundWithRefresh} from './background_client';
import {
  closeWindow,
  extensionBrowserName,
  extensionChrome,
  extensionRuntime,
  reloadHistory,
  runtimeLastErrorMessage,
  setBodyOpacity
} from './browser_env';

export type {ProfileKey};

export type Profile = NamedProfile & {
  attachedToProfileName?: string;
  defaultProfileName?: string;
  desc?: string;
  hiddenInContextMenu?: boolean;
  hiddenInPopup?: boolean;
  profileGroupEnabled?: boolean;
  profileGroupId?: string;
  role?: string;
  validResultProfiles?: string[];
};

export type ProfileMap = Record<ProfileKey, Profile | undefined>;

export type PageInfo = {
  domain?: string;
  errorCount?: number;
  failedRequestDetectionEnabled?: boolean;
  networkRequestIgnoreListEnabled?: boolean;
  networkRequestIgnoreList?: string[];
  profileScope?: ProfileScopeInfo;
  requestExplanations?: RequestExplanation[];
  requestLimitExceeded?: boolean;
  routeInfoEnabled?: boolean;
  routeInfoRequestDetailsEnabled?: boolean;
  requests?: Array<{
    error?: string;
    id: string;
    ignored?: boolean;
    ignoreMatches?: string[];
    status?: string;
    type?: string;
    url: string;
  }>;
  summary?: Record<string, {errorCount?: number}>;
  tempRuleProfileName?: string;
  url?: string;
};

export type ProfileScopeInfo = {
  assignments?: {
    containers?: Record<string, string>;
    normalDefaultProfileName?: string;
    privateDefaultProfileName?: string;
    rules?: Array<{
      condition: Record<string, unknown>;
      profileName: string;
      quickKey?: string;
      quickTarget?: 'page' | 'site';
      [key: string]: unknown;
    }>;
  };
  capabilities?: ProfileScopeSettings;
  containerProfileName?: string;
  cookieStoreId?: string;
  effectiveProfileName?: string;
  effectiveScope?: 'container' | 'current' | 'group' | 'normal' | 'private' | 'page' | 'site' | 'tab';
  enabled?: ProfileScopeSettings;
  groupId?: number;
  groupProfileName?: string;
  incognito?: boolean;
  isContainer?: boolean;
  pageProfileName?: string;
  pageUrl?: string;
  siteProfileName?: string;
  tabId?: number;
  tabProfileName?: string;
  windowId?: number;
  windowProfileName?: string;
};

export type ProfileScopeSettings = {
  container?: boolean;
  group?: boolean;
  site?: boolean;
  tab?: boolean;
  window?: boolean;
};

export type ProfileScopeSetRequest = {
  cookieStoreId?: string;
  groupId?: number;
  incognito?: boolean;
  profileName?: string;
  scope: 'container' | 'group' | 'normal' | 'page' | 'private' | 'site' | 'tab';
  tabId?: number;
  url?: string;
  windowId?: number;
};

export type PageInfoOptions = {
  includeExplanations?: boolean;
};

export type PopupState = {
  availableProfiles?: ProfileMap;
  currentProfileCanAddRule?: boolean;
  currentProfileName?: string;
  externalProfile?: Profile;
  isSystemProfile?: boolean;
  lastProfileNameForCondition?: string;
  profileGroups?: Array<{color?: string; icon?: string; id: string; name: string; order?: number}>;
  profileGroupsEnabled?: boolean;
  proxyNotControllable?: string;
  refreshOnProfileChange?: boolean;
  scopeAssignableProfiles?: string[];
  showExternalProfile?: boolean;
  showPopupAddCondition?: boolean;
  showPopupAddTempRule?: boolean;
  uiLocale?: string;
  uiTheme?: string;
  validResultProfiles?: string[];
};

export type PopupStateKey = keyof PopupState;
export type PopupWritableStateKey = 'lastProfileNameForCondition';
export type PopupMode = 'condition' | 'external' | 'menu' | 'routeInfo';

export type PopupConditionType =
  | 'HostRegexCondition'
  | 'HostWildcardCondition'
  | 'KeywordCondition'
  | 'UrlRegexCondition'
  | 'UrlWildcardCondition';

export type PopupCondition = {
  conditionType: PopupConditionType;
  pattern: string;
};

export type PopupConditionInput = PopupCondition | PopupCondition[];

type PopupTab = {
  cookieStoreId?: string;
  groupId?: number;
  id?: number;
  incognito?: boolean;
  pendingUrl?: string;
  url?: string;
  windowId?: number;
};

type PopupTabsApi = {
  create?: (props: {url: string}, callback?: (tab?: PopupTab) => void) => void;
  query?: (queryInfo: {active?: boolean; lastFocusedWindow?: boolean; url?: string}, callback: (tabs: PopupTab[]) => void) => void;
  remove?: (tabId: number, callback?: () => void) => void;
  update?: (tabId: number, props: {active?: boolean; url?: string}, callback?: (tab?: PopupTab) => void) => void;
};

type PopupWindow = {
  state?: 'docked' | 'fullscreen' | 'maximized' | 'minimized' | 'normal';
};

type PopupWindowsApi = {
  get?: (windowId: number, callback: (window?: PopupWindow) => void) => void;
  update?: (
    windowId: number,
    props: {focused?: boolean; state?: 'fullscreen' | 'maximized' | 'minimized' | 'normal'},
    callback?: (window?: PopupWindow) => void
  ) => void;
};

const localStatePrefix = 'state.';

export function closePopup() {
  closeWindow();
  setBodyOpacity('0');
  setTimeout(() => reloadHistory(), 300);
}

function popupTabs() {
  return extensionChrome().tabs as PopupTabsApi | undefined;
}

function popupWindows() {
  return extensionChrome().windows as PopupWindowsApi | undefined;
}

function popupTabUrl(tab?: PopupTab | null) {
  return tab?.pendingUrl || tab?.url;
}

function extensionApiError(fallback: string) {
  return new Error(runtimeLastErrorMessage() || fallback);
}

function queryTabs(queryInfo: {active?: boolean; lastFocusedWindow?: boolean; url?: string}) {
  return new Promise<PopupTab[]>((resolve, reject) => {
    const tabsApi = popupTabs();
    const query = tabsApi?.query;
    if (!query) {
      reject(new Error('tabs.query is unavailable.'));
      return;
    }
    query.call(tabsApi, queryInfo, (tabs) => {
      if (runtimeLastErrorMessage()) {
        reject(extensionApiError('Unable to query browser tabs.'));
        return;
      }
      resolve(tabs || []);
    });
  });
}

function createTab(url: string) {
  return new Promise<PopupTab | undefined>((resolve, reject) => {
    const tabsApi = popupTabs();
    const create = tabsApi?.create;
    if (!create) {
      reject(new Error('tabs.create is unavailable.'));
      return;
    }
    create.call(tabsApi, {url}, (tab) => {
      if (runtimeLastErrorMessage()) {
        reject(extensionApiError('Unable to create browser tab.'));
        return;
      }
      resolve(tab);
    });
  });
}

function getPopupWindow(windowId: number) {
  return new Promise<PopupWindow | undefined>((resolve, reject) => {
    const windowsApi = popupWindows();
    const get = windowsApi?.get;
    if (!get) {
      resolve(undefined);
      return;
    }
    get.call(windowsApi, windowId, (window) => {
      if (runtimeLastErrorMessage()) {
        reject(extensionApiError('Unable to get browser window.'));
        return;
      }
      resolve(window);
    });
  });
}

function updatePopupWindow(windowId: number, props: {focused?: boolean; state?: 'fullscreen' | 'maximized' | 'minimized' | 'normal'}) {
  return new Promise<void>((resolve, reject) => {
    const windowsApi = popupWindows();
    const update = windowsApi?.update;
    if (!update) {
      resolve();
      return;
    }
    update.call(windowsApi, windowId, props, () => {
      if (runtimeLastErrorMessage()) {
        reject(extensionApiError('Unable to update browser window.'));
        return;
      }
      resolve();
    });
  });
}

async function focusPopupWindow(windowId?: number) {
  if (typeof windowId !== 'number') {
    return;
  }
  const window = await getPopupWindow(windowId);
  if (window?.state === 'minimized') {
    await updatePopupWindow(windowId, {state: 'normal'});
  }
  await updatePopupWindow(windowId, {focused: true});
}

async function createFocusedTab(url: string) {
  const tab = await createTab(url);
  await focusPopupWindow(tab?.windowId);
}

function updateTab(tabId: number, props: {active?: boolean; url?: string}) {
  return new Promise<void>((resolve, reject) => {
    const tabsApi = popupTabs();
    const update = tabsApi?.update;
    if (!update) {
      reject(new Error('tabs.update is unavailable.'));
      return;
    }
    update.call(tabsApi, tabId, props, () => {
      if (runtimeLastErrorMessage()) {
        reject(extensionApiError('Unable to update browser tab.'));
        return;
      }
      resolve();
    });
  });
}

function removeTab(tabId: number) {
  return new Promise<void>((resolve, reject) => {
    const tabsApi = popupTabs();
    const remove = tabsApi?.remove;
    if (!remove) {
      reject(new Error('tabs.remove is unavailable.'));
      return;
    }
    remove.call(tabsApi, tabId, () => {
      if (runtimeLastErrorMessage()) {
        reject(extensionApiError('Unable to remove browser tab.'));
        return;
      }
      resolve();
    });
  });
}

function cacheActivePageInfo(info?: PageInfo | null) {
  if (!info?.url || typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage[localStatePrefix + 'web.last_page_info'] = JSON.stringify(info);
  } catch (_) {}
}

function optionsTabSameWindowType(tab: PopupTab | undefined, currentTab: PopupTab | undefined) {
  if (extensionBrowserName() !== 'firefox') {
    return true;
  }
  if (typeof tab?.incognito !== 'boolean' || typeof currentTab?.incognito !== 'boolean') {
    return true;
  }
  return tab.incognito === currentTab.incognito;
}

function optionsUrlForOpen(optionsUrl: string, sourceUrl: string | undefined, hash?: string | null) {
  if (!hash) {
    return optionsUrl;
  }
  try {
    const url = new URL(sourceUrl || optionsUrl);
    url.hash = hash;
    return url.href;
  } catch (_) {
    return optionsUrl + hash;
  }
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

export function getPopupState(keys: PopupStateKey[]) {
  return callBackground('getState', keys) as Promise<PopupState>;
}

export async function getPopupPageInfo(options: PageInfoOptions = {}) {
  const tabs = await queryTabs({active: true, lastFocusedWindow: true});
  const tab = tabs[0];
  const url = popupTabUrl(tab);
  if (!tab || !url) {
    return undefined;
  }
  const info = (await callBackground('getPageInfo', {
    cookieStoreId: typeof tab.cookieStoreId === 'string' ? tab.cookieStoreId : undefined,
    groupId: typeof tab.groupId === 'number' ? tab.groupId : undefined,
    includeExplanations: options.includeExplanations,
    incognito: typeof tab.incognito === 'boolean' ? tab.incognito : undefined,
    tabId: tab.id,
    url,
    windowId: typeof tab.windowId === 'number' ? tab.windowId : undefined
  })) as PageInfo;
  cacheActivePageInfo(info);
  return info;
}

export function applyPopupProfile(name: string) {
  return callBackgroundWithRefresh('applyProfile', name);
}

export function addPopupCondition(condition: PopupConditionInput, profileName: string, addToBottom: boolean) {
  return callBackgroundWithRefresh('addCondition', condition, profileName, addToBottom);
}

export function addPopupProfile(profile: Profile) {
  return callBackgroundWithRefresh('addProfile', profile);
}

export function addPopupTempRule(domain: string, profileName: string) {
  return callBackgroundWithRefresh('addTempRule', domain, profileName);
}

export function patchPopupOptions(patch: OptionsPatch) {
  return callBackground('patch', patch);
}

export function setPopupDefaultProfile(profileName: string, defaultProfileName: string) {
  return callBackgroundWithRefresh('setDefaultProfile', profileName, defaultProfileName);
}

export function setPopupProfileScope(args: ProfileScopeSetRequest) {
  return callBackgroundWithRefresh('setProfileScope', args);
}

export function setPopupState<TKey extends PopupWritableStateKey>(name: TKey, value: PopupState[TKey]) {
  return callBackground('setState', {[name]: value});
}

export async function openPopupOptions(hash?: string | null) {
  const optionsUrl = extensionRuntime()?.getURL?.('options.html');
  if (!optionsUrl) {
    throw new Error('Extension options URL is unavailable.');
  }
  const [currentTabs, optionTabs] = await Promise.all([queryTabs({active: true, lastFocusedWindow: true}), queryTabs({url: optionsUrl})]);
  const currentTab = currentTabs[0];
  const sameWindowTypeTab = optionTabs.find((tab) => optionsTabSameWindowType(tab, currentTab));
  const targetTab = sameWindowTypeTab || optionTabs[0];
  const targetUrl = optionsUrlForOpen(optionsUrl, targetTab?.url, hash);
  if (!targetTab) {
    await createFocusedTab(targetUrl);
    return;
  }
  if (optionsTabSameWindowType(targetTab, currentTab)) {
    if (typeof targetTab.id !== 'number') {
      await createFocusedTab(targetUrl);
      return;
    }
    try {
      await updateTab(targetTab.id, {active: true, ...(hash ? {url: targetUrl} : {})});
    } catch (_) {
      await createFocusedTab(targetUrl);
      return;
    }
    await focusPopupWindow(targetTab.windowId);
    return;
  }
  if (typeof targetTab.id !== 'number') {
    await createFocusedTab(targetUrl);
    return;
  }
  const state = await callBackground('getOptionsPageState', targetTab.id);
  if (!state.registered) {
    throw new Error('The existing settings page is not ready.');
  }
  if (!state.dirty) {
    await removeTab(targetTab.id);
    await createFocusedTab(targetUrl);
    return;
  }
  const handoffId = await callBackground('beginOptionsHandoff', targetTab.id);
  await createFocusedTab(optionsUrlWithHandoff(targetUrl, handoffId));
}

export function openExtensionManager() {
  const runtimeId = extensionRuntime()?.id;
  if (!runtimeId) {
    return Promise.reject(new Error('Extension runtime ID is unavailable.'));
  }
  return createTab('chrome://extensions/?id=' + runtimeId);
}

export function popupMessage(key: string, fallback = key, substitutions?: string | string[]) {
  return message(key, '', substitutions) || fallback;
}
