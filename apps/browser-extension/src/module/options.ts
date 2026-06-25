import OmegaTarget from '@switchyagain/extension-runtime';
import ChromePort from './chrome_port';
import fetchUrl from './fetch_url';
import {tabUrl} from './tabs';
import WebRequestMonitor from './web_request_monitor';
import type {ProxyImplInstance, ProxyProfile, ProxyRequestDetails} from './proxy/proxy_types';

const OmegaPac = OmegaTarget.OmegaPac;
const OmegaPromise = OmegaTarget.Promise;

const LINK_PROFILE_CONTEXT_MENU_ROOT_ID = 'openLinkInNewTabWithProfile';
const SWITCH_PROFILE_CONTEXT_MENU_ROOT_ID = 'switchProfile';
const SWITCH_PROFILE_CONTEXT_MENU_ITEM_PREFIX = `${SWITCH_PROFILE_CONTEXT_MENU_ROOT_ID}:`;
const SWITCH_PROFILE_HIDDEN_CONTEXT_MENU_ROOT_ID = `${SWITCH_PROFILE_CONTEXT_MENU_ROOT_ID}:hidden`;
const SWITCH_PROFILE_HIDDEN_CONTEXT_MENU_ITEM_PREFIX = `${SWITCH_PROFILE_CONTEXT_MENU_ROOT_ID}:hidden:`;
const TAB_PROFILE_CONTEXT_MENU_ROOT_ID = 'useProfileForThisTab';
const TAB_PROFILE_CONTEXT_MENU_ITEM_PREFIX = `${TAB_PROFILE_CONTEXT_MENU_ROOT_ID}:`;
const CLEAR_TAB_PROFILE_CONTEXT_MENU_ID = `${TAB_PROFILE_CONTEXT_MENU_ROOT_ID}:clear`;
const GROUP_PROFILE_CONTEXT_MENU_ROOT_ID = 'useProfileForThisTabGroup';
const GROUP_PROFILE_CONTEXT_MENU_ITEM_PREFIX = `${GROUP_PROFILE_CONTEXT_MENU_ROOT_ID}:`;
const CLEAR_GROUP_PROFILE_CONTEXT_MENU_ID = `${GROUP_PROFILE_CONTEXT_MENU_ROOT_ID}:clear`;
const CONTAINER_PROFILE_CONTEXT_MENU_ROOT_ID = 'useProfileForThisContainer';
const CONTAINER_PROFILE_CONTEXT_MENU_ITEM_PREFIX = `${CONTAINER_PROFILE_CONTEXT_MENU_ROOT_ID}:`;
const CLEAR_CONTAINER_PROFILE_CONTEXT_MENU_ID = `${CONTAINER_PROFILE_CONTEXT_MENU_ROOT_ID}:clear`;
const NORMAL_WINDOW_PROFILE_CONTEXT_MENU_ROOT_ID = 'useProfileForNormalWindows';
const NORMAL_WINDOW_PROFILE_CONTEXT_MENU_ITEM_PREFIX = `${NORMAL_WINDOW_PROFILE_CONTEXT_MENU_ROOT_ID}:`;
const CLEAR_NORMAL_WINDOW_PROFILE_CONTEXT_MENU_ID = `${NORMAL_WINDOW_PROFILE_CONTEXT_MENU_ROOT_ID}:clear`;
const PRIVATE_WINDOW_PROFILE_CONTEXT_MENU_ROOT_ID = 'useProfileForPrivateWindows';
const PRIVATE_WINDOW_PROFILE_CONTEXT_MENU_ITEM_PREFIX = `${PRIVATE_WINDOW_PROFILE_CONTEXT_MENU_ROOT_ID}:`;
const CLEAR_PRIVATE_WINDOW_PROFILE_CONTEXT_MENU_ID = `${PRIVATE_WINDOW_PROFILE_CONTEXT_MENU_ROOT_ID}:clear`;
const TAB_GROUP_ID_NONE = -1;
const WEB_LINK_PATTERNS = ['http://*/*', 'https://*/*'];
const PROFILE_MENU_ORDER: Record<string, number> = {
  FixedProfile: -2000,
  PacProfile: -1000,
  VirtualProfile: 1000,
  SwitchProfile: 2000,
  RuleListProfile: 3000
};
const PROFILE_ICON_PATHS: Record<string, string> = {
  AutoDetectProfile: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h4"/>',
  DirectProfile: '<path d="M4 8h13"/><path d="M13 4l4 4-4 4"/><path d="M20 16H7"/><path d="M11 12l-4 4 4 4"/>',
  FixedProfile: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16"/><path d="M12 4c2 2.4 3 5.1 3 8s-1 5.6-3 8"/><path d="M12 4c-2 2.4-3 5.1-3 8s1 5.6 3 8"/>',
  PacProfile: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h4"/>',
  RuleListProfile: '<path d="M7 7h10"/><path d="M7 12h10"/><path d="M7 17h10"/><circle cx="4.5" cy="7" r=".7"/><circle cx="4.5" cy="12" r=".7"/><circle cx="4.5" cy="17" r=".7"/>',
  SwitchProfile: '<path d="M6 8h8c2.8 0 5 2.2 5 5"/><path d="M16 10l3 3 3-3"/><path d="M18 16h-8c-2.8 0-5-2.2-5-5"/><path d="M8 14l-3-3-3 3"/>',
  SystemProfile: '<path d="M12 4v8"/><path d="M7 6.7a8 8 0 1 0 10 0"/>',
  VirtualProfile: '<path d="M9 9a3 3 0 1 1 4.6 2.5c-1.1.7-1.6 1.3-1.6 2.5"/><path d="M12 18h.01"/>'
};

type BadgeOptions = {
  color: string;
  text: string;
  title?: string;
};

type Profile = ProxyProfile;
type ContextMenuProfile = Profile & {name: string};
type ContextMenuProfileGroups = {
  hidden: ContextMenuProfile[];
  visible: ContextMenuProfile[];
};
type LinkProfileContextMenuTarget = 'tab' | 'window' | 'privateWindow';
type LinkProfileContextMenuSelection = {
  profileName: string;
  target: LinkProfileContextMenuTarget;
};
type ProfileScopeContextMenuSelection = ProfileScopeSetArgs;
type ProfileScopeContextMenuUpdateOptions = {
  forceRebuild?: boolean;
};
type ProfileScopeContextMenuTarget = {
  activeProfileName?: string;
  clearId: string;
  fallbackTitle: string;
  itemPrefix: string;
  rootId: string;
  setArgs: Omit<ProfileScopeSetArgs, 'profileName'>;
  titleKey: string;
};
type FixedProfileProxyField = 'fallbackProxy' | 'proxyForHttp' | 'proxyForHttps';

const LINK_PROFILE_CONTEXT_MENU_ROOTS: Array<{
  fallbackTitle: string;
  id: string;
  itemPrefix: string;
  optionKey: keyof ContextMenuOptions;
  target: LinkProfileContextMenuTarget;
  titleKey: string;
}> = [
  {
    fallbackTitle: 'Open Link in New Tab with Profile',
    id: LINK_PROFILE_CONTEXT_MENU_ROOT_ID,
    itemPrefix: `${LINK_PROFILE_CONTEXT_MENU_ROOT_ID}:`,
    optionKey: 'linkProfileNewTab',
    target: 'tab',
    titleKey: 'contextMenu_openLinkInNewTabWithProfile'
  },
  {
    fallbackTitle: 'Open Link in New Window with Profile',
    id: 'openLinkInNewWindowWithProfile',
    itemPrefix: 'openLinkInNewWindowWithProfile:',
    optionKey: 'linkProfileNewWindow',
    target: 'window',
    titleKey: 'contextMenu_openLinkInNewWindowWithProfile'
  },
  {
    fallbackTitle: 'Open Link in New Private Window with Profile',
    id: 'openLinkInNewPrivateWindowWithProfile',
    itemPrefix: 'openLinkInNewPrivateWindowWithProfile:',
    optionKey: 'linkProfileNewPrivateWindow',
    target: 'privateWindow',
    titleKey: 'contextMenu_openLinkInNewPrivateWindowWithProfile'
  }
];

const FIXED_PROFILE_PROXY_FIELDS: FixedProfileProxyField[] = ['fallbackProxy', 'proxyForHttp', 'proxyForHttps'];

type ExternalApiLike = {
  disabled: boolean;
};

type RequestSummaryItem = {
  errorCount: number;
};

type RequestStatus = 'start' | 'ongoing' | 'timeout' | 'error' | 'timeoutAbort' | 'done';

type MonitoredRequestInfo = {
  _startTime?: number;
  error?: string;
  requestId: string;
  type?: string;
  url: string;
  [key: string]: unknown;
};

type PageRequestInfo = {
  error?: string;
  id: string;
  status?: RequestStatus;
  type?: string;
  url: string;
};

type TabRequestInfo = {
  badgeSet?: boolean;
  errorCount: number;
  mainFrameRequestId?: string;
  mainFrameStartTime?: number;
  mainFrameUrl?: string;
  requestCount?: number;
  requests?: Record<string, MonitoredRequestInfo>;
  requestStatus?: Record<string, RequestStatus>;
  summary: Record<string, RequestSummaryItem>;
  [key: string]: unknown;
};

type ProfileScopeSettings = {
  container: boolean;
  group: boolean;
  tab: boolean;
  window: boolean;
};

type ContextMenuOptions = {
  containerProfile: boolean;
  groupProfile: boolean;
  linkProfileNewPrivateWindow: boolean;
  linkProfileNewTab: boolean;
  linkProfileNewWindow: boolean;
  switchProfile: boolean;
  tabProfile: boolean;
  windowProfile: boolean;
};

type ProfileScopeAssignments = {
  containers: Record<string, string>;
  normalDefaultProfileName?: string;
  privateDefaultProfileName?: string;
};

type ProfileScopeContainerInfo = {
  color?: string;
  colorCode?: string;
  cookieStoreId: string;
  icon?: string;
  iconUrl?: string;
  name?: string;
};

type ProfileScopeSetArgs = {
  cookieStoreId?: string;
  groupId?: number;
  incognito?: boolean;
  profileName?: string;
  scope: 'container' | 'group' | 'normal' | 'private' | 'tab';
  tabId?: number;
  windowId?: number;
};

type ProfileScopeInfoArgs = {
  cookieStoreId?: string;
  groupId?: number;
  incognito?: boolean;
  tabId?: number;
  windowId?: number;
};

type TabProfileContext = {
  cookieStoreId?: string;
  groupId?: number;
  incognito?: boolean;
  windowId?: number;
};

type ContextualIdentity = {
  color?: string;
  colorCode?: string;
  cookieStoreId?: string;
  icon?: string;
  iconUrl?: string;
  name?: string;
};

type ContextualIdentitiesApi = {
  query(details: Record<string, unknown>): Promise<ContextualIdentity[]>;
};

type RequestMonitorLike = {
  tabInfo: Record<string, TabRequestInfo | undefined>;
  watchTabs(callback: (
    tabId: number,
    info: TabRequestInfo,
    req?: unknown,
    status?: unknown
  ) => unknown): unknown;
};

type ChromePortLike = InstanceType<typeof ChromePort>;

type UpgradeOptions = Record<string, unknown> & {
  schemaVersion?: unknown;
};

function normalizeSocks5LocalDnsProfile(profile: Profile) {
  if (profile.profileType !== 'FixedProfile') {
    return false;
  }
  let changed = false;
  for (const field of FIXED_PROFILE_PROXY_FIELDS) {
    const proxy = profile[field] as {scheme?: unknown} | undefined;
    if (proxy?.scheme === 'socks5-local') {
      proxy.scheme = 'socks5';
      changed = true;
    }
  }
  return changed;
}

type PageInfoArgs = {
  cookieStoreId?: string;
  groupId?: number;
  includeExplanations?: boolean;
  incognito?: boolean;
  tabId: number;
  url?: string;
  windowId?: number;
};

const MAX_PAGE_EXPLAIN_REQUESTS = 100;

function actionApi(): ChromeActionApi {
  const legacyKey = 'browser' + 'Action';
  return (chrome.action || chrome[legacyKey]) as ChromeActionApi;
}

function explainableRequestUrl(url?: string) {
  return !!url && /^(https?|ws|wss):/i.test(url);
}

function isRecordValue(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function normalizeProfileScopes(value: unknown): ProfileScopeSettings {
  const scopes = isRecordValue(value) ? value : {};
  return {
    tab: scopes.tab === true,
    group: scopes.group === true,
    container: scopes.container === true,
    window: scopes.window === true
  };
}

function normalizeProfileScopeAssignments(value: unknown): ProfileScopeAssignments {
  const rawAssignments = isRecordValue(value) ? value : {};
  const rawContainers = isRecordValue(rawAssignments.containers) ? rawAssignments.containers : {};
  const containers: Record<string, string> = {};
  for (const [cookieStoreId, profileName] of Object.entries(rawContainers)) {
    if (cookieStoreId && typeof profileName === 'string' && profileName) {
      containers[cookieStoreId] = profileName;
    }
  }
  const assignments: ProfileScopeAssignments = {containers};
  if (typeof rawAssignments.normalDefaultProfileName === 'string' && rawAssignments.normalDefaultProfileName) {
    assignments.normalDefaultProfileName = rawAssignments.normalDefaultProfileName;
  }
  if (typeof rawAssignments.privateDefaultProfileName === 'string' && rawAssignments.privateDefaultProfileName) {
    assignments.privateDefaultProfileName = rawAssignments.privateDefaultProfileName;
  }
  return assignments;
}

function normalizeContextMenuOptions(value: unknown, capabilities?: ContextMenuOptions): ContextMenuOptions {
  const raw = isRecordValue(value) ? value : {};
  const options = {
    switchProfile: raw.switchProfile !== false,
    tabProfile: raw.tabProfile === true,
    groupProfile: raw.groupProfile === true,
    containerProfile: raw.containerProfile === true,
    windowProfile: raw.windowProfile === true,
    linkProfileNewTab: raw.linkProfileNewTab === true,
    linkProfileNewWindow: raw.linkProfileNewWindow === true,
    linkProfileNewPrivateWindow: raw.linkProfileNewPrivateWindow === true
  };
  if (!capabilities) {
    return options;
  }
  return {
    switchProfile: options.switchProfile && capabilities.switchProfile,
    tabProfile: options.tabProfile && capabilities.tabProfile,
    groupProfile: options.groupProfile && capabilities.groupProfile,
    containerProfile: options.containerProfile && capabilities.containerProfile,
    windowProfile: options.windowProfile && capabilities.windowProfile,
    linkProfileNewTab: options.linkProfileNewTab && capabilities.linkProfileNewTab,
    linkProfileNewWindow: options.linkProfileNewWindow && capabilities.linkProfileNewWindow,
    linkProfileNewPrivateWindow: options.linkProfileNewPrivateWindow && capabilities.linkProfileNewPrivateWindow
  };
}

function isFirefoxContainerId(cookieStoreId?: string): cookieStoreId is string {
  return !!cookieStoreId && cookieStoreId !== 'firefox-default' && cookieStoreId !== 'firefox-private';
}

function requestStartTime(request: MonitoredRequestInfo) {
  return typeof request._startTime === 'number' ? request._startTime : 0;
}

function tabInfoPageUrl(tabInfo?: TabRequestInfo, currentUrl?: string) {
  const requestId = tabInfo?.mainFrameRequestId;
  if (!requestId) {
    return currentUrl;
  }
  const status = tabInfo?.requestStatus?.[requestId];
  const request = tabInfo?.requests?.[requestId];
  const monitoredUrl = request?.url || tabInfo?.mainFrameUrl;
  if (!explainableRequestUrl(monitoredUrl)) {
    return currentUrl;
  }
  switch (status) {
    case 'start':
    case 'ongoing':
    case 'timeout':
    case 'error':
    case 'timeoutAbort':
      return monitoredUrl;
    default:
      return currentUrl;
  }
}

function pageRequestsFromTabInfo(tabInfo?: TabRequestInfo, pageUrl?: string) {
  const monitored: MonitoredRequestInfo[] = [];
  const rawRequests = tabInfo?.requests || {};
  for (const requestId in rawRequests) {
    if (!Object.prototype.hasOwnProperty.call(rawRequests, requestId)) {
      continue;
    }
    const request = rawRequests[requestId];
    if (request && explainableRequestUrl(request.url)) {
      monitored.push(request);
    }
  }
  monitored.sort((a, b) => requestStartTime(a) - requestStartTime(b));
  const requests: PageRequestInfo[] = [];
  if (explainableRequestUrl(pageUrl) && !monitored.some((request) => request.url === pageUrl && request.type === 'main_frame')) {
    requests.push({
      id: 'page',
      status: 'done',
      type: 'main_frame',
      url: pageUrl as string
    });
  }
  for (const request of monitored) {
    requests.push({
      error: request.error,
      id: request.requestId,
      status: tabInfo?.requestStatus?.[request.requestId],
      type: request.type,
      url: request.url
    });
    if (requests.length >= MAX_PAGE_EXPLAIN_REQUESTS) {
      break;
    }
  }
  return {
    requests,
    requestLimitExceeded: monitored.length + (requests[0]?.id === 'page' ? 1 : 0) > MAX_PAGE_EXPLAIN_REQUESTS
  };
}

// ChromeOptions merges the runtime class with the legacy OmegaOptionsBase shape.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unsafe-declaration-merging
interface ChromeOptions extends OmegaOptionsBase {}

function defaultUiLocaleFromBrowser(language?: string) {
  if (language == null) {
    const getUILanguage = chrome.i18n && chrome.i18n.getUILanguage;
    language = typeof getUILanguage === 'function'
      ? getUILanguage.call(chrome.i18n)
      : '';
  }
  const normalized = language.replace(/_/g, '-').toLowerCase();
  if (normalized === 'zh' || normalized.startsWith('zh-hans') || normalized.startsWith('zh-cn') || normalized.startsWith('zh-sg')) {
    return 'zh-Hans';
  }
  if (normalized.startsWith('zh-hant') || normalized.startsWith('zh-tw') || normalized.startsWith('zh-hk') || normalized.startsWith('zh-mo')) {
    return 'zh-Hant';
  }
  if (normalized.startsWith('cs')) {
    return 'cs';
  }
  if (normalized.startsWith('es')) {
    return 'es';
  }
  if (normalized.startsWith('fa')) {
    return 'fa';
  }
  if (normalized.startsWith('ru')) {
    return 'ru';
  }
  return 'en';
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
class ChromeOptions extends OmegaTarget.Options {
  externalApi!: ExternalApiLike;
  fetchUrl: typeof fetchUrl;
  declare proxyImpl: ProxyImplInstance;
  private _alarms: Record<string, () => void> | null;
  private _badgeTitle: string | null;
  private _monitorWebRequests: boolean;
  private _proxyNotControllable: string | null;
  private _profileScopeContainers: Record<string, ProfileScopeContainerInfo>;
  private _profileScopeContainerOrder: string[];
  private _quickSwitchCanEnable: boolean;
  private _quickSwitchHandlerReady: boolean;
  private _quickSwitchInit: boolean;
  private _linkProfileContextMenuClickReady: boolean;
  private _linkProfileContextMenuIds: string[];
  private _linkProfileContextMenuSelections: Record<string, LinkProfileContextMenuSelection>;
  private _linkProfileContextMenuRefreshToken: number;
  private _switchProfileContextMenuIds: string[];
  private _switchProfileContextMenuProfiles: Record<string, string>;
  private _switchProfileContextMenuRefreshToken: number;
  private _profileScopeContextMenuIds: string[];
  private _profileScopeContextMenuSelections: Record<string, ProfileScopeContextMenuSelection>;
  private _profileScopeContextMenuRefreshToken: number;
  private _profileScopeContextMenuSignature: string;
  private _requestMonitor: RequestMonitorLike | null;
  private _tabProfileContexts: Record<number, TabProfileContext>;
  private _groupProfileNames: Record<string, string | undefined>;
  private _tabProfileNames: Record<number, string | undefined>;
  private _tabProfileScopeWatching: boolean;
  private _tabRequestInfoPorts: Record<number, ChromePortLike> | null;

  constructor(...args: unknown[]) {
    super(...args);
    this.fetchUrl = fetchUrl;
    this._proxyNotControllable = null;
    this._badgeTitle = null;
    this._quickSwitchInit = false;
    this._quickSwitchHandlerReady = false;
    this._quickSwitchCanEnable = false;
    this._linkProfileContextMenuClickReady = false;
    this._linkProfileContextMenuIds = [];
    this._linkProfileContextMenuSelections = {};
    this._linkProfileContextMenuRefreshToken = 0;
    this._switchProfileContextMenuIds = [];
    this._switchProfileContextMenuProfiles = {};
    this._switchProfileContextMenuRefreshToken = 0;
    this._profileScopeContextMenuIds = [];
    this._profileScopeContextMenuSelections = {};
    this._profileScopeContextMenuRefreshToken = 0;
    this._profileScopeContextMenuSignature = '';
    this._requestMonitor = null;
    this._profileScopeContainers = {};
    this._profileScopeContainerOrder = [];
    this._tabProfileContexts = {};
    this._groupProfileNames = {};
    this._tabProfileNames = {};
    this._tabProfileScopeWatching = false;
    this._monitorWebRequests = false;
    this._tabRequestInfoPorts = null;
    this._alarms = null;
    this._onLinkProfileContextMenuClicked = this._onLinkProfileContextMenuClicked.bind(this);
    this._onContextMenuShown = this._onContextMenuShown.bind(this);
    this.initProfileScopes();
    this.restoreTabProfileNames();
  }

  private initProfileScopes() {
    this.proxyImpl.setProfileResolver?.(
      (details) => this.profileForScopeRequest(details),
      () => this.scopeProfileNames()
    );
    this._state.set({
      profileScopeCapabilities: this.profileScopeCapabilities(),
      proxyAuthCapabilities: this.proxyImpl.proxyAuthCapabilities,
      proxyDnsCapabilities: this.proxyImpl.proxyDnsCapabilities
    });
    this.refreshProfileScopeContainers();
    this.watchTabProfileContexts();
  }

  private watchTabProfileContexts() {
    if (this._tabProfileScopeWatching || !chrome?.tabs) {
      return;
    }
    this._tabProfileScopeWatching = true;
    chrome.tabs.onRemoved.addListener((tabId: number) => {
      delete this._tabProfileNames[tabId];
      this.removeTabProfileFromStorage(tabId);
      delete this._tabProfileContexts[tabId];
    });
    chrome.tabs.onReplaced?.addListener((added: number, removed: number) => {
      if (this._tabProfileNames[removed] != null) {
        this._tabProfileNames[added] = this._tabProfileNames[removed];
      }
      if (this._tabProfileContexts[removed]) {
        this._tabProfileContexts[added] = this._tabProfileContexts[removed];
      }
      delete this._tabProfileNames[removed];
      delete this._tabProfileContexts[removed];
    });
    chrome.tabs.onUpdated.addListener((tabId: number, _changeInfo: Record<string, unknown>, tab: ChromeTab) => {
      this.updateTabProfileContext(tabId, tab);
    });
    chrome.tabs.onMoved?.addListener((tabId: number) => {
      chrome.tabs.get(tabId, (tab: ChromeTab) => {
        if (!chrome.runtime.lastError && tab?.id != null) {
          this.updateTabProfileContext(tab.id, tab);
        }
      });
    });
    const tabGroups = chrome.tabGroups as {
      onRemoved?: {
        addListener(callback: (group: {id?: number; windowId?: number}) => void): void;
      };
    } | undefined;
    tabGroups?.onRemoved?.addListener((group) => {
      const key = this.groupProfileKey(group.windowId, group.id);
      if (key) {
        delete this._groupProfileNames[key];
        this.saveGroupProfileToStorage(key);
      }
    });
    chrome.tabs.query({}, (tabs: ChromeTab[]) => {
      for (const tab of tabs) {
        if (tab.id != null) {
          this.updateTabProfileContext(tab.id, tab);
        }
      }
    });
  }

  private updateTabProfileContext(tabId: number, tab: Pick<ChromeTab, 'cookieStoreId' | 'groupId' | 'incognito' | 'windowId'>) {
    if (isFirefoxContainerId(tab.cookieStoreId)) {
      this.rememberProfileScopeContainer(tab.cookieStoreId);
    }
    this._tabProfileContexts[tabId] = {
      cookieStoreId: typeof tab.cookieStoreId === 'string' ? tab.cookieStoreId : this._tabProfileContexts[tabId]?.cookieStoreId,
      groupId: typeof tab.groupId === 'number' ? tab.groupId : this._tabProfileContexts[tabId]?.groupId,
      incognito: typeof tab.incognito === 'boolean' ? tab.incognito : this._tabProfileContexts[tabId]?.incognito,
      windowId: typeof tab.windowId === 'number' ? tab.windowId : this._tabProfileContexts[tabId]?.windowId
    };
  }

  private rememberProfileScopeContainer(cookieStoreId: string, details: Partial<ProfileScopeContainerInfo> = {}) {
    const current = this._profileScopeContainers[cookieStoreId];
    const next: ProfileScopeContainerInfo = {
      ...current,
      ...details,
      cookieStoreId
    };
    if (
      current &&
      current.name === next.name &&
      current.color === next.color &&
      current.colorCode === next.colorCode &&
      current.icon === next.icon &&
      current.iconUrl === next.iconUrl
    ) {
      return;
    }
    if (this._profileScopeContainerOrder.indexOf(cookieStoreId) < 0) {
      this._profileScopeContainerOrder.push(cookieStoreId);
    }
    this._profileScopeContainers[cookieStoreId] = next;
    this.saveProfileScopeContainers();
  }

  private profileScopeContainerList() {
    const seen = new Set<string>();
    const containers: ProfileScopeContainerInfo[] = [];
    for (const cookieStoreId of this._profileScopeContainerOrder) {
      const container = this._profileScopeContainers[cookieStoreId];
      if (container) {
        seen.add(cookieStoreId);
        containers.push(container);
      }
    }
    for (const [cookieStoreId, container] of Object.entries(this._profileScopeContainers)) {
      if (!seen.has(cookieStoreId)) {
        containers.push(container);
      }
    }
    return containers;
  }

  private saveProfileScopeContainers() {
    const containers = this.profileScopeContainerList();
    this._state.set({
      profileScopeContainers: containers
    });
    return containers;
  }

  private refreshProfileScopeContainers() {
    const api = (typeof browser !== 'undefined' ? browser.contextualIdentities : null) as ContextualIdentitiesApi | undefined | null;
    if (!api?.query) {
      return Promise.resolve(this.saveProfileScopeContainers());
    }
    return api.query({})
      .then((identities) => {
        const containers: Record<string, ProfileScopeContainerInfo> = {};
        const order: string[] = [];
        for (const identity of identities || []) {
          if (isFirefoxContainerId(identity.cookieStoreId)) {
            containers[identity.cookieStoreId] = {
              color: identity.color,
              colorCode: identity.colorCode,
              cookieStoreId: identity.cookieStoreId,
              icon: identity.icon,
              iconUrl: identity.iconUrl,
              name: identity.name
            };
            order.push(identity.cookieStoreId);
          }
        }
        this._profileScopeContainers = containers;
        this._profileScopeContainerOrder = order;
        return this.saveProfileScopeContainers();
      })
      .catch(() => {
        return this.saveProfileScopeContainers();
      });
  }

  refreshProfileScopeContainerNames() {
    return this.refreshProfileScopeContainers();
  }

  private restoreTabProfileNames() {
    const sessionStorage = chrome?.storage?.session as {
      get?: (keys: string | string[] | Record<string, unknown> | null) => Promise<Record<string, unknown>>;
    } | undefined;
    if (!sessionStorage?.get) {
      return;
    }
    sessionStorage.get(null).then((data: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(data)) {
        if (key.startsWith('tabProfile_')) {
          const tabId = parseInt(key.substring(11), 10);
          if (!isNaN(tabId) && typeof value === 'string') {
            this._tabProfileNames[tabId] = value;
          }
        } else if (key.startsWith('tabGroupProfile_') && typeof value === 'string') {
          const groupKey = key.substring(16);
          if (this.validGroupProfileKey(groupKey)) {
            this._groupProfileNames[groupKey] = value;
          }
        }
      }
    }).catch(() => {
      // Session storage may not be available in some contexts
    });
  }

  private saveTabProfileToStorage(tabId: number, profileName?: string) {
    const sessionStorage = chrome?.storage?.session as {
      set?: (items: Record<string, unknown>) => Promise<void>;
      remove?: (keys: string | string[]) => Promise<void>;
    } | undefined;
    if (!sessionStorage) {
      return;
    }
    const key = `tabProfile_${tabId}`;
    if (profileName) {
      sessionStorage.set?.({[key]: profileName}).catch(() => {
        // Silently ignore storage errors
      });
    } else {
      sessionStorage.remove?.(key).catch(() => {
        // Silently ignore storage errors
      });
    }
  }

  private removeTabProfileFromStorage(tabId: number) {
    const sessionStorage = chrome?.storage?.session as {
      remove?: (keys: string | string[]) => Promise<void>;
    } | undefined;
    if (!sessionStorage?.remove) {
      return;
    }
    sessionStorage.remove(`tabProfile_${tabId}`).catch(() => {
      // Silently ignore storage errors
    });
  }

  private groupProfileKey(windowId?: number, groupId?: number) {
    if (
      typeof windowId !== 'number' ||
      typeof groupId !== 'number' ||
      groupId === TAB_GROUP_ID_NONE ||
      groupId < 0
    ) {
      return undefined;
    }
    return `${windowId}:${groupId}`;
  }

  private validGroupProfileKey(key: string) {
    return /^\d+:\d+$/.test(key);
  }

  private saveGroupProfileToStorage(groupKey: string, profileName?: string) {
    const sessionStorage = chrome?.storage?.session as {
      set?: (items: Record<string, unknown>) => Promise<void>;
      remove?: (keys: string | string[]) => Promise<void>;
    } | undefined;
    if (!sessionStorage) {
      return;
    }
    const key = `tabGroupProfile_${groupKey}`;
    if (profileName) {
      sessionStorage.set?.({[key]: profileName}).catch(() => {
        // Silently ignore storage errors
      });
    } else {
      sessionStorage.remove?.(key).catch(() => {
        // Silently ignore storage errors
      });
    }
  }

  private profileScopeCapabilities(): ProfileScopeSettings {
    const features = this.proxyImpl.features || [];
    return {
      tab: features.indexOf('tabProfileScope') >= 0,
      group: features.indexOf('groupProfileScope') >= 0,
      container: features.indexOf('containerProfileScope') >= 0,
      window: features.indexOf('windowProfileScope') >= 0
    };
  }

  private enabledProfileScopes(): ProfileScopeSettings {
    const scopes = normalizeProfileScopes(this._options['-profileScopes']);
    const capabilities = this.profileScopeCapabilities();
    return {
      tab: scopes.tab && capabilities.tab,
      group: scopes.group && capabilities.group,
      container: scopes.container && capabilities.container,
      window: scopes.window && capabilities.window
    };
  }

  private profileScopeAssignments() {
    return normalizeProfileScopeAssignments(this._options['-profileScopeAssignments']);
  }

  private contextMenuCapabilities(): ContextMenuOptions {
    const capabilities = this.profileScopeCapabilities();
    return {
      switchProfile: true,
      tabProfile: capabilities.tab,
      groupProfile: capabilities.group,
      containerProfile: capabilities.container,
      windowProfile: capabilities.window,
      linkProfileNewTab: capabilities.tab,
      linkProfileNewWindow: capabilities.tab,
      linkProfileNewPrivateWindow: capabilities.tab
    };
  }

  private contextMenuOptions() {
    return normalizeContextMenuOptions(this._options['-contextMenuOptions'], this.contextMenuCapabilities());
  }

  private validProfileName(profileName?: string) {
    return profileName && OmegaPac.Profiles.byName(profileName, this._options) ? profileName : undefined;
  }

  private compareProfile(a: Profile, b: Profile) {
    const diff = (PROFILE_MENU_ORDER[a.profileType || ''] || 0) - (PROFILE_MENU_ORDER[b.profileType || ''] || 0);
    if (diff !== 0) {
      return diff;
    }
    const aName = a.name || '';
    const bName = b.name || '';
    return aName === bName ? 0 : aName < bName ? -1 : 1;
  }

  private isVisibleResultProfileName(name?: string) {
    return !!name && (name.charAt(0) !== '_' || name.charAt(1) !== '_');
  }

  private localizedProfileName(profile: ContextMenuProfile) {
    return chrome.i18n.getMessage(`profile_${profile.name}`) || profile.name;
  }

  private profileIconColor(profile: ContextMenuProfile) {
    const color = typeof profile.color === 'string' ? profile.color.trim() : '';
    return /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : '#777777';
  }

  private contextMenuIconForProfile(profile: ContextMenuProfile, checked = false) {
    const color = this.profileIconColor(profile);
    const glyph = PROFILE_ICON_PATHS[profile.profileType || ''] || PROFILE_ICON_PATHS.VirtualProfile;
    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">',
      `<circle cx="12" cy="12" r="11" fill="${color}"/>`,
      '<g fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
      glyph,
      '</g>',
      checked
        ? '<circle cx="17.7" cy="17.7" r="5.1" fill="#198754" stroke="#fff" stroke-width="1.7"/>'
        : '',
      checked
        ? '<path d="M15.4 17.7l1.5 1.5 3.2-3.6" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>'
        : '',
      '</svg>'
    ].join('');
    const dataUrl = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    return {
      16: dataUrl,
      32: dataUrl
    };
  }

  private profileScopeContextMenuProfiles(): ContextMenuProfile[] {
    if (!chrome?.contextMenus || !chrome?.tabs || !chrome?.i18n?.getMessage) {
      return [];
    }
    if (this._isSystem || !this._currentProfileName) {
      return [];
    }
    const current = this.currentProfile() as Profile | null;
    if (!current) {
      return [];
    }
    let profiles: Profile[] = [];
    if (OmegaPac.Profiles.isInclusive(current)) {
      profiles = OmegaPac.Profiles.validResultProfilesFor(current, this._options) as unknown as Profile[];
    } else if (OmegaPac.Profiles.isIncludable(current)) {
      OmegaPac.Profiles.each(this._options, (_key: string, profile: Profile) => {
        if (OmegaPac.Profiles.isIncludable(profile)) {
          profiles.push(profile);
        }
      });
    }
    const seen = new Set<string>();
    return profiles
      .filter((profile): profile is ContextMenuProfile => {
        const name = profile.name;
        if (typeof name !== 'string' || !this.isVisibleResultProfileName(name) || seen.has(name)) {
          return false;
        }
        seen.add(name);
        return true;
      })
      .sort((a, b) => this.compareProfile(a, b));
  }

  private linkProfileContextMenuProfiles(): ContextMenuProfile[] {
    if (!this.enabledProfileScopes().tab) {
      return [];
    }
    return this.profileScopeContextMenuProfiles();
  }

  private switchProfileContextMenuProfiles(): ContextMenuProfile[] {
    if (!chrome?.contextMenus || !chrome?.tabs || !chrome?.i18n?.getMessage) {
      return [];
    }
    if (!this.contextMenuOptions().switchProfile) {
      return [];
    }
    const profiles: Profile[] = [];
    OmegaPac.Profiles.each(this._options, (_key: string, profile: Profile) => {
      profiles.push(profile);
    });
    const seen = new Set<string>();
    return profiles
      .filter((profile): profile is ContextMenuProfile => {
        const name = profile.name;
        if (typeof name !== 'string' || !this.isVisibleResultProfileName(name) || seen.has(name)) {
          return false;
        }
        seen.add(name);
        return true;
      })
      .sort((a, b) => this.compareProfile(a, b));
  }

  private splitContextMenuProfiles(profiles: ContextMenuProfile[], activeProfileName?: string): ContextMenuProfileGroups {
    const visible: ContextMenuProfile[] = [];
    const hidden: ContextMenuProfile[] = [];
    for (const profile of profiles) {
      if (profile.hiddenInContextMenu === true && profile.name !== activeProfileName) {
        hidden.push(profile);
      } else {
        visible.push(profile);
      }
    }
    return {hidden, visible};
  }

  private removeContextMenuItems(ids: string[], callback: () => void) {
    const contextMenus = chrome.contextMenus;
    if (!ids.length || contextMenus == null) {
      callback();
      return;
    }
    let remaining = ids.length;
    const done = () => {
      remaining--;
      if (remaining === 0) {
        callback();
      }
    };
    for (const id of ids) {
      try {
        contextMenus.remove(id, () => {
          chrome.runtime.lastError;
          done();
        });
      } catch (_error) {
        done();
      }
    }
  }

  private ensureLinkProfileContextMenuClickListener() {
    const contextMenus = chrome.contextMenus;
    if (contextMenus == null || this._linkProfileContextMenuClickReady) {
      return;
    }
    contextMenus.onClicked.addListener(this._onLinkProfileContextMenuClicked);
    contextMenus.onShown?.addListener(this._onContextMenuShown);
    this._linkProfileContextMenuClickReady = true;
  }

  private contextMenuItemIconsSupported() {
    const browserRuntime = (typeof browser !== 'undefined' ? browser.runtime : undefined) as {
      getBrowserInfo?: () => Promise<unknown>;
    } | undefined;
    return typeof browserRuntime?.getBrowserInfo === 'function';
  }

  private createContextMenuItem(properties: Record<string, unknown>, fallbackProperties?: Record<string, unknown>) {
    const contextMenus = chrome.contextMenus;
    if (contextMenus == null) {
      return;
    }
    contextMenus.create(properties, () => {
      const error = chrome.runtime.lastError;
      if (!error) {
        return;
      }
      if (properties.icons == null) {
        this.log.error('Creating context menu item failed.', error.message || error);
        return;
      }
      this.log.error('Creating context menu item with icons failed; retrying without icons.', error.message || error);
      const fallback = {
        ...(fallbackProperties || properties)
      };
      delete fallback.icons;
      contextMenus.create(fallback, () => {
        chrome.runtime.lastError;
      });
    });
  }

  private refreshContextMenuItems() {
    const refresh = chrome.contextMenus?.refresh;
    if (typeof refresh === 'function') {
      refresh.call(chrome.contextMenus);
    }
  }

  private updateContextMenuItem(id: string, properties: Record<string, unknown>, callback?: () => void) {
    const contextMenus = chrome.contextMenus;
    if (contextMenus == null) {
      callback?.();
      return;
    }
    try {
      contextMenus.update(id, properties, () => {
        const error = chrome.runtime.lastError;
        if (error) {
          this.log.error('Updating context menu item failed.', error.message || error);
        }
        callback?.();
      });
    } catch (error) {
      this.log.error('Updating context menu item failed.', error);
      callback?.();
    }
  }

  private updateLinkProfileContextMenu() {
    const contextMenus = chrome.contextMenus;
    if (contextMenus == null || chrome.i18n?.getMessage == null) {
      return;
    }
    this.ensureLinkProfileContextMenuClickListener();
    const token = ++this._linkProfileContextMenuRefreshToken;
    const contextMenuOptions = this.contextMenuOptions();
    const roots = LINK_PROFILE_CONTEXT_MENU_ROOTS.filter((root) => contextMenuOptions[root.optionKey]);
    const profiles = roots.length ? this.linkProfileContextMenuProfiles() : [];
    const oldIds = this._linkProfileContextMenuIds;
    this._linkProfileContextMenuIds = [];
    this._linkProfileContextMenuSelections = {};
    this.removeContextMenuItems(oldIds, () => {
      if (token !== this._linkProfileContextMenuRefreshToken || profiles.length === 0) {
        return;
      }
      const nextIds: string[] = [];
      const nextSelections: Record<string, LinkProfileContextMenuSelection> = {};
      for (const root of roots) {
        const profileGroups = this.splitContextMenuProfiles(profiles);
        this.createContextMenuItem({
          id: root.id,
          title: chrome.i18n.getMessage(root.titleKey) || root.fallbackTitle,
          contexts: ['link'],
          targetUrlPatterns: WEB_LINK_PATTERNS
        });
        nextIds.push(root.id);
        profileGroups.visible.forEach((profile, index) => {
          const id = `${root.itemPrefix}${index}`;
          nextIds.push(id);
          nextSelections[id] = {
            profileName: profile.name,
            target: root.target
          };
          this.createContextMenuItem({
            id,
            icons: this.contextMenuIconForProfile(profile),
            parentId: root.id,
            title: this.localizedProfileName(profile),
            contexts: ['link'],
            targetUrlPatterns: WEB_LINK_PATTERNS
          });
        });
        if (profileGroups.hidden.length > 0) {
          const hiddenRootId = `${root.id}:hidden`;
          const hiddenItemPrefix = `${root.itemPrefix}hidden:`;
          nextIds.push(hiddenRootId);
          this.createContextMenuItem({
            id: hiddenRootId,
            parentId: root.id,
            title: chrome.i18n.getMessage('popup_hiddenProfilesMenu') || 'Hidden',
            contexts: ['link'],
            targetUrlPatterns: WEB_LINK_PATTERNS
          });
          profileGroups.hidden.forEach((profile, index) => {
            const id = `${hiddenItemPrefix}${index}`;
            nextIds.push(id);
            nextSelections[id] = {
              profileName: profile.name,
              target: root.target
            };
            this.createContextMenuItem({
              id,
              icons: this.contextMenuIconForProfile(profile),
              parentId: hiddenRootId,
              title: this.localizedProfileName(profile),
              contexts: ['link'],
              targetUrlPatterns: WEB_LINK_PATTERNS
            });
          });
        }
      }
      this._linkProfileContextMenuIds = nextIds;
      this._linkProfileContextMenuSelections = nextSelections;
    });
  }

  private updateSwitchProfileContextMenu() {
    const contextMenus = chrome.contextMenus;
    if (contextMenus == null || chrome.i18n?.getMessage == null) {
      return;
    }
    this.ensureLinkProfileContextMenuClickListener();
    const token = ++this._switchProfileContextMenuRefreshToken;
    const profiles = this.switchProfileContextMenuProfiles();
    const oldIds = this._switchProfileContextMenuIds;
    this._switchProfileContextMenuIds = [];
    this._switchProfileContextMenuProfiles = {};
    this.removeContextMenuItems(oldIds, () => {
      if (token !== this._switchProfileContextMenuRefreshToken || profiles.length === 0) {
        return;
      }
      this.createContextMenuItem({
        id: SWITCH_PROFILE_CONTEXT_MENU_ROOT_ID,
        title: chrome.i18n.getMessage('contextMenu_switchProfile') || 'Switch Profile',
        contexts: ['page'],
        documentUrlPatterns: WEB_LINK_PATTERNS
      });
      const nextIds = [SWITCH_PROFILE_CONTEXT_MENU_ROOT_ID];
      const nextProfiles: Record<string, string> = {};
      const useIcons = this.contextMenuItemIconsSupported();
      const profileGroups = this.splitContextMenuProfiles(profiles, this._currentProfileName);
      profileGroups.visible.forEach((profile, index) => {
        const id = `${SWITCH_PROFILE_CONTEXT_MENU_ITEM_PREFIX}${index}`;
        const checked = profile.name === this._currentProfileName;
        nextIds.push(id);
        nextProfiles[id] = profile.name;
        const baseItem = {
          id,
          parentId: SWITCH_PROFILE_CONTEXT_MENU_ROOT_ID,
          title: this.localizedProfileName(profile),
          contexts: ['page'],
          documentUrlPatterns: WEB_LINK_PATTERNS
        };
        const radioItem = {
          ...baseItem,
          type: 'radio',
          checked
        };
        this.createContextMenuItem(
          useIcons
            ? {
                ...baseItem,
                icons: this.contextMenuIconForProfile(profile, checked)
              }
            : radioItem,
          radioItem
        );
      });
      if (profileGroups.hidden.length > 0) {
        nextIds.push(SWITCH_PROFILE_HIDDEN_CONTEXT_MENU_ROOT_ID);
        this.createContextMenuItem({
          id: SWITCH_PROFILE_HIDDEN_CONTEXT_MENU_ROOT_ID,
          parentId: SWITCH_PROFILE_CONTEXT_MENU_ROOT_ID,
          title: chrome.i18n.getMessage('popup_hiddenProfilesMenu') || 'Hidden',
          contexts: ['page'],
          documentUrlPatterns: WEB_LINK_PATTERNS
        });
        profileGroups.hidden.forEach((profile, index) => {
          const id = `${SWITCH_PROFILE_HIDDEN_CONTEXT_MENU_ITEM_PREFIX}${index}`;
          nextIds.push(id);
          nextProfiles[id] = profile.name;
          const baseItem = {
            id,
            parentId: SWITCH_PROFILE_HIDDEN_CONTEXT_MENU_ROOT_ID,
            title: this.localizedProfileName(profile),
            contexts: ['page'],
            documentUrlPatterns: WEB_LINK_PATTERNS
          };
          this.createContextMenuItem(
            useIcons
              ? {
                  ...baseItem,
                  icons: this.contextMenuIconForProfile(profile)
                }
              : baseItem,
            baseItem
          );
        });
      }
      this._switchProfileContextMenuIds = nextIds;
      this._switchProfileContextMenuProfiles = nextProfiles;
    });
  }

  private profileScopeContextMenuTargets(tab: ChromeTab): ProfileScopeContextMenuTarget[] {
    if (tab.id == null) {
      return [];
    }
    this.updateTabProfileContext(tab.id, tab);
    const profileScope = this.getProfileScopeInfo({
      cookieStoreId: tab.cookieStoreId,
      groupId: tab.groupId,
      incognito: tab.incognito,
      tabId: tab.id,
      windowId: tab.windowId
    });
    const contextMenuOptions = this.contextMenuOptions();
    const targets: ProfileScopeContextMenuTarget[] = [];
    if (contextMenuOptions.tabProfile && profileScope.enabled.tab && profileScope.tabId != null) {
      targets.push({
        activeProfileName: profileScope.tabProfileName,
        clearId: CLEAR_TAB_PROFILE_CONTEXT_MENU_ID,
        fallbackTitle: 'Use Profile for This Tab',
        itemPrefix: TAB_PROFILE_CONTEXT_MENU_ITEM_PREFIX,
        rootId: TAB_PROFILE_CONTEXT_MENU_ROOT_ID,
        setArgs: {
          scope: 'tab',
          tabId: profileScope.tabId
        },
        titleKey: 'contextMenu_useProfileForThisTab'
      });
    }
    if (contextMenuOptions.groupProfile && profileScope.enabled.group && profileScope.groupId != null) {
      targets.push({
        activeProfileName: profileScope.groupProfileName,
        clearId: CLEAR_GROUP_PROFILE_CONTEXT_MENU_ID,
        fallbackTitle: 'Use Profile for This Tab Group',
        itemPrefix: GROUP_PROFILE_CONTEXT_MENU_ITEM_PREFIX,
        rootId: GROUP_PROFILE_CONTEXT_MENU_ROOT_ID,
        setArgs: {
          groupId: profileScope.groupId,
          scope: 'group',
          windowId: profileScope.windowId
        },
        titleKey: 'contextMenu_useProfileForThisTabGroup'
      });
    }
    if (contextMenuOptions.containerProfile && profileScope.enabled.container && profileScope.isContainer && profileScope.cookieStoreId) {
      targets.push({
        activeProfileName: profileScope.containerProfileName,
        clearId: CLEAR_CONTAINER_PROFILE_CONTEXT_MENU_ID,
        fallbackTitle: 'Use Profile for This Container',
        itemPrefix: CONTAINER_PROFILE_CONTEXT_MENU_ITEM_PREFIX,
        rootId: CONTAINER_PROFILE_CONTEXT_MENU_ROOT_ID,
        setArgs: {
          cookieStoreId: profileScope.cookieStoreId,
          scope: 'container'
        },
        titleKey: 'contextMenu_useProfileForThisContainer'
      });
    }
    if (contextMenuOptions.windowProfile && profileScope.enabled.window) {
      const privateWindow = profileScope.incognito;
      targets.push({
        activeProfileName: profileScope.windowProfileName,
        clearId: privateWindow ? CLEAR_PRIVATE_WINDOW_PROFILE_CONTEXT_MENU_ID : CLEAR_NORMAL_WINDOW_PROFILE_CONTEXT_MENU_ID,
        fallbackTitle: privateWindow ? 'Use Profile for Private Windows' : 'Use Profile for Normal Windows',
        itemPrefix: privateWindow ? PRIVATE_WINDOW_PROFILE_CONTEXT_MENU_ITEM_PREFIX : NORMAL_WINDOW_PROFILE_CONTEXT_MENU_ITEM_PREFIX,
        rootId: privateWindow ? PRIVATE_WINDOW_PROFILE_CONTEXT_MENU_ROOT_ID : NORMAL_WINDOW_PROFILE_CONTEXT_MENU_ROOT_ID,
        setArgs: {
          scope: privateWindow ? 'private' : 'normal'
        },
        titleKey: privateWindow ? 'contextMenu_useProfileForPrivateWindows' : 'contextMenu_useProfileForNormalWindows'
      });
    }
    return targets;
  }

  private windowProfileContextMenuTargets(): ProfileScopeContextMenuTarget[] {
    const assignments = this.profileScopeAssignments();
    return [
      {
        activeProfileName: this.validProfileName(assignments.normalDefaultProfileName),
        clearId: CLEAR_NORMAL_WINDOW_PROFILE_CONTEXT_MENU_ID,
        fallbackTitle: 'Use Profile for Normal Windows',
        itemPrefix: NORMAL_WINDOW_PROFILE_CONTEXT_MENU_ITEM_PREFIX,
        rootId: NORMAL_WINDOW_PROFILE_CONTEXT_MENU_ROOT_ID,
        setArgs: {
          scope: 'normal'
        },
        titleKey: 'contextMenu_useProfileForNormalWindows'
      },
      {
        activeProfileName: this.validProfileName(assignments.privateDefaultProfileName),
        clearId: CLEAR_PRIVATE_WINDOW_PROFILE_CONTEXT_MENU_ID,
        fallbackTitle: 'Use Profile for Private Windows',
        itemPrefix: PRIVATE_WINDOW_PROFILE_CONTEXT_MENU_ITEM_PREFIX,
        rootId: PRIVATE_WINDOW_PROFILE_CONTEXT_MENU_ROOT_ID,
        setArgs: {
          scope: 'private'
        },
        titleKey: 'contextMenu_useProfileForPrivateWindows'
      }
    ];
  }

  private createProfileScopeContextMenuTarget(
    target: ProfileScopeContextMenuTarget,
    profiles: ContextMenuProfile[],
    nextIds: string[],
    nextSelections: Record<string, ProfileScopeContextMenuSelection>,
    visible?: boolean
  ) {
    const profileGroups = this.splitContextMenuProfiles(profiles, target.activeProfileName);
    const useIcons = this.contextMenuItemIconsSupported();
    const rootItem: Record<string, unknown> = {
      id: target.rootId,
      title: chrome.i18n.getMessage(target.titleKey) || target.fallbackTitle,
      contexts: ['page'],
      documentUrlPatterns: WEB_LINK_PATTERNS
    };
    if (visible != null) {
      rootItem.visible = visible;
    }
    nextIds.push(target.rootId);
    this.createContextMenuItem(rootItem);
    if (target.activeProfileName) {
      nextIds.push(target.clearId);
      nextSelections[target.clearId] = target.setArgs;
      this.createContextMenuItem({
        id: target.clearId,
        parentId: target.rootId,
        title: chrome.i18n.getMessage('popup_profileScopeUseDefault') || 'Use Default',
        contexts: ['page'],
        documentUrlPatterns: WEB_LINK_PATTERNS
      });
    }
    profileGroups.visible.forEach((profile, index) => {
      const id = `${target.itemPrefix}${index}`;
      const checked = profile.name === target.activeProfileName;
      nextIds.push(id);
      nextSelections[id] = {
        ...target.setArgs,
        profileName: profile.name
      };
      const baseItem = {
        id,
        parentId: target.rootId,
        title: this.localizedProfileName(profile),
        contexts: ['page'],
        documentUrlPatterns: WEB_LINK_PATTERNS
      };
      const radioItem = {
        ...baseItem,
        type: 'radio',
        checked
      };
      this.createContextMenuItem(
        useIcons
          ? {
              ...baseItem,
              icons: this.contextMenuIconForProfile(profile, checked)
            }
          : radioItem,
        radioItem
      );
    });
    if (profileGroups.hidden.length > 0) {
      const hiddenRootId = `${target.rootId}:hidden`;
      const hiddenItemPrefix = `${target.itemPrefix}hidden:`;
      nextIds.push(hiddenRootId);
      this.createContextMenuItem({
        id: hiddenRootId,
        parentId: target.rootId,
        title: chrome.i18n.getMessage('popup_hiddenProfilesMenu') || 'Hidden',
        contexts: ['page'],
        documentUrlPatterns: WEB_LINK_PATTERNS
      });
      profileGroups.hidden.forEach((profile, index) => {
        const id = `${hiddenItemPrefix}${index}`;
        nextIds.push(id);
        nextSelections[id] = {
          ...target.setArgs,
          profileName: profile.name
        };
        const baseItem = {
          id,
          parentId: hiddenRootId,
          title: this.localizedProfileName(profile),
          contexts: ['page'],
          documentUrlPatterns: WEB_LINK_PATTERNS
        };
        this.createContextMenuItem(
          useIcons
            ? {
                ...baseItem,
                icons: this.contextMenuIconForProfile(profile)
              }
            : baseItem,
          baseItem
        );
      });
    }
  }

  private useStaticWindowProfileContextMenu() {
    const capabilities = this.profileScopeCapabilities();
    return capabilities.window &&
      !capabilities.tab &&
      !capabilities.group &&
      !capabilities.container &&
      !this.contextMenuItemIconsSupported();
  }

  private staticWindowProfileContextMenuSignature(profiles: ContextMenuProfile[], targets: ProfileScopeContextMenuTarget[]) {
    return JSON.stringify({
      profiles: profiles.map((profile) => [
        profile.name,
        profile.hiddenInContextMenu === true
      ]),
      targets: targets.map((target) => [
        target.rootId,
        target.activeProfileName || ''
      ])
    });
  }

  private updateStaticWindowProfileContextMenuVisibility(tab?: ChromeTab) {
    const privateWindow = !!tab?.incognito;
    let remaining = 2;
    const done = () => {
      remaining--;
      if (remaining === 0) {
        this.refreshContextMenuItems();
      }
    };
    this.updateContextMenuItem(NORMAL_WINDOW_PROFILE_CONTEXT_MENU_ROOT_ID, {
      visible: !privateWindow
    }, done);
    this.updateContextMenuItem(PRIVATE_WINDOW_PROFILE_CONTEXT_MENU_ROOT_ID, {
      visible: privateWindow
    }, done);
  }

  private updateStaticWindowProfileContextMenuForTab(tab?: ChromeTab, options: ProfileScopeContextMenuUpdateOptions = {}) {
    const contextMenus = chrome.contextMenus;
    if (contextMenus == null || chrome.i18n?.getMessage == null) {
      return;
    }
    this.ensureLinkProfileContextMenuClickListener();
    const profiles = this.profileScopeContextMenuProfiles();
    const contextMenuOptions = this.contextMenuOptions();
    const scopes = this.enabledProfileScopes();
    const targets = this.windowProfileContextMenuTargets();
    const signature = this.staticWindowProfileContextMenuSignature(profiles, targets);
    if (
      !options.forceRebuild &&
      tab?.id != null &&
      this._profileScopeContextMenuIds.length > 0 &&
      this._profileScopeContextMenuSignature === signature
    ) {
      this.updateStaticWindowProfileContextMenuVisibility(tab);
      return;
    }
    const token = ++this._profileScopeContextMenuRefreshToken;
    const oldIds = this._profileScopeContextMenuIds;
    this._profileScopeContextMenuIds = [];
    this._profileScopeContextMenuSelections = {};
    this._profileScopeContextMenuSignature = '';
    this.removeContextMenuItems(oldIds, () => {
      if (
        token !== this._profileScopeContextMenuRefreshToken ||
        profiles.length === 0 ||
        !contextMenuOptions.windowProfile ||
        !scopes.window
      ) {
        this.refreshContextMenuItems();
        return;
      }
      const nextIds: string[] = [];
      const nextSelections: Record<string, ProfileScopeContextMenuSelection> = {};
      const privateWindow = !!tab?.incognito;
      for (const target of targets) {
        const visible = privateWindow
          ? target.setArgs.scope === 'private'
          : target.setArgs.scope === 'normal';
        this.createProfileScopeContextMenuTarget(target, profiles, nextIds, nextSelections, visible);
      }
      this._profileScopeContextMenuIds = nextIds;
      this._profileScopeContextMenuSelections = nextSelections;
      this._profileScopeContextMenuSignature = signature;
      this.refreshContextMenuItems();
    });
  }

  private updateProfileScopeContextMenuForTab(tab?: ChromeTab, options: ProfileScopeContextMenuUpdateOptions = {}) {
    const contextMenus = chrome.contextMenus;
    if (contextMenus == null || chrome.i18n?.getMessage == null) {
      return;
    }
    if (this.useStaticWindowProfileContextMenu()) {
      this.updateStaticWindowProfileContextMenuForTab(tab, options);
      return;
    }
    this.ensureLinkProfileContextMenuClickListener();
    const token = ++this._profileScopeContextMenuRefreshToken;
    const profiles = this.profileScopeContextMenuProfiles();
    const oldIds = this._profileScopeContextMenuIds;
    this._profileScopeContextMenuIds = [];
    this._profileScopeContextMenuSelections = {};
    this._profileScopeContextMenuSignature = '';
    this.removeContextMenuItems(oldIds, () => {
      if (token !== this._profileScopeContextMenuRefreshToken || profiles.length === 0) {
        this.refreshContextMenuItems();
        return;
      }
      if (tab?.id == null) {
        this.refreshContextMenuItems();
        return;
      }
      if (token !== this._profileScopeContextMenuRefreshToken) {
        return;
      }
      const targets = this.profileScopeContextMenuTargets(tab);
      if (targets.length === 0) {
        this.refreshContextMenuItems();
        return;
      }
      const nextIds: string[] = [];
      const nextSelections: Record<string, ProfileScopeContextMenuSelection> = {};
      for (const target of targets) {
        this.createProfileScopeContextMenuTarget(target, profiles, nextIds, nextSelections);
      }
      this._profileScopeContextMenuIds = nextIds;
      this._profileScopeContextMenuSelections = nextSelections;
      this.refreshContextMenuItems();
    });
  }

  private _onContextMenuShown(_info: Record<string, unknown>, tab?: ChromeTab) {
    this.updateProfileScopeContextMenuForTab(tab);
  }

  private isHttpLinkUrl(url: unknown): url is string {
    if (typeof url !== 'string') {
      return false;
    }
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (_error) {
      return false;
    }
  }

  private chromeLastErrorMessage(action: string) {
    return chrome.runtime.lastError?.message || `${action} failed.`;
  }

  private createTab(properties: Record<string, unknown>) {
    const browserTabs = typeof browser !== 'undefined' ? browser.tabs : undefined;
    if (browserTabs?.create) {
      return browserTabs.create(properties);
    }
    return new Promise<ChromeTab>((resolve, reject) => {
      chrome.tabs.create(properties, (createdTab: unknown) => {
        if (chrome.runtime.lastError) {
          reject(new Error(this.chromeLastErrorMessage('tabs.create')));
          return;
        }
        resolve((createdTab || {}) as ChromeTab);
      });
    });
  }

  private createWindow(properties: Record<string, unknown>) {
    const browserWindows = (typeof browser !== 'undefined' ? browser.windows : undefined) as {
      create?: (properties: Record<string, unknown>) => Promise<ChromeWindow>;
    } | undefined;
    if (browserWindows?.create) {
      return browserWindows.create(properties);
    }
    const chromeWindows = chrome?.windows as {
      create?: (properties: Record<string, unknown>, callback?: (...args: unknown[]) => void) => void;
    } | undefined;
    const createWindow = chromeWindows?.create;
    if (!createWindow) {
      return Promise.reject(new Error('windows.create is unavailable.'));
    }
    return new Promise<ChromeWindow>((resolve, reject) => {
      createWindow.call(chromeWindows, properties, (createdWindow: unknown) => {
        if (chrome.runtime.lastError) {
          reject(new Error(this.chromeLastErrorMessage('windows.create')));
          return;
        }
        resolve((createdWindow || {}) as ChromeWindow);
      });
    });
  }

  private queryTabs(queryInfo: Record<string, unknown>) {
    const browserTabs = typeof browser !== 'undefined' ? browser.tabs : undefined;
    if (browserTabs?.query) {
      return browserTabs.query(queryInfo);
    }
    return new Promise<ChromeTab[]>((resolve, reject) => {
      chrome.tabs.query(queryInfo, (tabs: ChromeTab[]) => {
        if (chrome.runtime.lastError) {
          reject(new Error(this.chromeLastErrorMessage('tabs.query')));
          return;
        }
        resolve(tabs || []);
      });
    });
  }

  private updateTab(tabId: number, properties: Record<string, unknown>) {
    const browserTabs = typeof browser !== 'undefined' ? browser.tabs : undefined;
    if (browserTabs?.update) {
      return browserTabs.update(tabId, properties);
    }
    return new Promise<ChromeTab>((resolve, reject) => {
      chrome.tabs.update(tabId, properties, (updatedTab: unknown) => {
        if (chrome.runtime.lastError) {
          reject(new Error(this.chromeLastErrorMessage('tabs.update')));
          return;
        }
        resolve((updatedTab || {}) as ChromeTab);
      });
    });
  }

  private reloadContextMenuTabIfEnabled(tab: ChromeTab | undefined) {
    if (!this._options['-refreshOnProfileChange'] || typeof tab?.id !== 'number') {
      return;
    }
    const url = this.getMonitoredTabUrl(tab.id, tabUrl(tab));
    if (!url) {
      return;
    }
    if (url.substring(0, 6) === 'chrome') {
      return;
    }
    if (url.substring(0, 6) === 'about:') {
      return;
    }
    if (url.substring(0, 4) === 'moz-') {
      return;
    }
    chrome.tabs.reload(tab.id, {
      bypassCache: true
    }, () => {
      chrome.runtime.lastError;
    });
  }

  private async refreshWebRequestHandlerBehavior() {
    try {
      const browserWebRequest = (typeof browser !== 'undefined' ? browser.webRequest : undefined) as {
        handlerBehaviorChanged?: () => Promise<void>;
      } | undefined;
      const chromeWebRequest = chrome?.webRequest as {
        handlerBehaviorChanged?: (callback?: () => void) => Promise<void> | void;
      } | undefined;
      const handlerBehaviorChanged = browserWebRequest?.handlerBehaviorChanged || chromeWebRequest?.handlerBehaviorChanged;
      if (typeof handlerBehaviorChanged !== 'function') {
        return;
      }
      if (browserWebRequest?.handlerBehaviorChanged) {
        await browserWebRequest.handlerBehaviorChanged();
        return;
      }
      await new Promise<void>((resolve, reject) => {
        handlerBehaviorChanged.call(chromeWebRequest, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(this.chromeLastErrorMessage('webRequest.handlerBehaviorChanged')));
            return;
          }
          resolve();
        });
      });
    } catch (error) {
      this.log.error('Refreshing webRequest handler behavior failed; continuing to open link.', error);
    }
  }

  private async createBlankTab(sourceTab: ChromeTab | undefined) {
    const createProperties: Record<string, unknown> = {
      active: false,
      url: 'about:blank'
    };
    if (typeof sourceTab?.id === 'number') {
      createProperties.openerTabId = sourceTab.id;
    }
    try {
      return await this.createTab(createProperties);
    } catch (error) {
      if (createProperties.openerTabId == null) {
        throw error;
      }
      delete createProperties.openerTabId;
      this.log.error('Creating tab with openerTabId failed; retrying without openerTabId.', error);
      return this.createTab(createProperties);
    }
  }

  private async createBlankWindow(incognito: boolean) {
    const createdWindow = await this.createWindow({
      focused: true,
      incognito,
      url: 'about:blank'
    });
    const firstTab = createdWindow.tabs?.find((tab) => typeof tab.id === 'number');
    if (firstTab) {
      return firstTab;
    }
    if (typeof createdWindow.id !== 'number') {
      throw new Error('windows.create did not return a window id.');
    }
    const tabs = await this.queryTabs({
      windowId: createdWindow.id
    });
    const queriedTab = tabs.find((tab) => typeof tab.id === 'number');
    if (!queriedTab) {
      throw new Error('windows.create did not return a tab id.');
    }
    return queriedTab;
  }

  private async createBlankProfileTarget(target: LinkProfileContextMenuTarget, sourceTab: ChromeTab | undefined) {
    if (target === 'tab') {
      return this.createBlankTab(sourceTab);
    }
    return this.createBlankWindow(target === 'privateWindow');
  }

  private async openLinkWithProfile(
    linkUrl: string,
    sourceTab: ChromeTab | undefined,
    profileName: string,
    target: LinkProfileContextMenuTarget
  ) {
    const createdTab = await this.createBlankProfileTarget(target, sourceTab);
    if (typeof createdTab.id !== 'number') {
      throw new Error('Target creation did not return a tab id.');
    }
    const tabId = createdTab.id;
    await Promise.resolve(this.setProfileScope({
        profileName,
        scope: 'tab',
        tabId
    }));
    await this.refreshWebRequestHandlerBehavior();
    await this.updateTab(tabId, {
      url: linkUrl
    });
  }

  private _onLinkProfileContextMenuClicked(info: ChromeContextMenuClickInfo, tab: ChromeTab | undefined) {
    const switchProfileName = this._switchProfileContextMenuProfiles[info.menuItemId];
    if (switchProfileName) {
      this.applyProfile(switchProfileName).then(() => {
        this.reloadContextMenuTabIfEnabled(tab);
      }).catch((error: unknown) => {
        this.log.error('Failed to switch profile from context menu.', error);
      });
      return;
    }
    if (Object.prototype.hasOwnProperty.call(this._profileScopeContextMenuSelections, info.menuItemId)) {
      if (tab?.id == null) {
        return;
      }
      const selection = this._profileScopeContextMenuSelections[info.menuItemId];
      chrome.tabs.get(tab.id, (currentTab: ChromeTab) => {
        if (chrome.runtime.lastError || currentTab?.id == null) {
          return;
        }
        this.updateTabProfileContext(currentTab.id, currentTab);
        this.setProfileScope(selection).then(() => {
          this.reloadContextMenuTabIfEnabled(currentTab);
          this.updateProfileScopeContextMenuForTab(currentTab);
        }).catch((error: unknown) => {
          this.log.error('Failed to set profile scope from context menu.', error);
        });
      });
      return;
    }
    const selection = this._linkProfileContextMenuSelections[info.menuItemId];
    if (!selection || !this.isHttpLinkUrl(info.linkUrl)) {
      return;
    }
    const profileStillAvailable = this.linkProfileContextMenuProfiles().some((profile) => profile.name === selection.profileName);
    if (!profileStillAvailable) {
      this.updateLinkProfileContextMenu();
      return;
    }
    this.openLinkWithProfile(info.linkUrl, tab, selection.profileName, selection.target).catch((error: unknown) => {
      this.log.error('Failed to open link with profile.', error);
    });
  }

  _setAvailableProfiles() {
    const result = super._setAvailableProfiles();
    return result.then((value: unknown) => {
      this.updateLinkProfileContextMenu();
      this.updateSwitchProfileContextMenu();
      this.updateProfileScopeContextMenuForTab();
      return value;
    });
  }

  private scopeContext(args: ProfileScopeInfoArgs | ProxyRequestDetails): Required<Pick<ProfileScopeInfoArgs, 'tabId'>> & TabProfileContext {
    const tabId = typeof args.tabId === 'number' ? args.tabId : -1;
    const cached = tabId >= 0 ? this._tabProfileContexts[tabId] : undefined;
    const context = {
      tabId,
      cookieStoreId: typeof args.cookieStoreId === 'string' ? args.cookieStoreId : cached?.cookieStoreId,
      groupId: typeof args.groupId === 'number' ? args.groupId : cached?.groupId,
      incognito: typeof args.incognito === 'boolean' ? args.incognito : cached?.incognito,
      windowId: typeof args.windowId === 'number' ? args.windowId : cached?.windowId
    };
    if (tabId >= 0) {
      this._tabProfileContexts[tabId] = {
        cookieStoreId: context.cookieStoreId,
        groupId: context.groupId,
        incognito: context.incognito,
        windowId: context.windowId
      };
    }
    return context;
  }

  private scopeProfileName(args: ProfileScopeInfoArgs | ProxyRequestDetails) {
    const scopes = this.enabledProfileScopes();
    const assignments = this.profileScopeAssignments();
    const context = this.scopeContext(args);
    const tabProfileName = context.tabId >= 0 ? this.validProfileName(this._tabProfileNames[context.tabId]) : undefined;
    if (scopes.tab && tabProfileName) {
      return {
        profileName: tabProfileName,
        scope: 'tab'
      };
    }
    const groupKey = this.groupProfileKey(context.windowId, context.groupId);
    const groupProfileName = groupKey ? this.validProfileName(this._groupProfileNames[groupKey]) : undefined;
    if (scopes.group && groupProfileName) {
      return {
        profileName: groupProfileName,
        scope: 'group'
      };
    }
    const containerProfileName = isFirefoxContainerId(context.cookieStoreId)
      ? this.validProfileName(assignments.containers[context.cookieStoreId as string])
      : undefined;
    if (scopes.container && containerProfileName) {
      return {
        profileName: containerProfileName,
        scope: 'container'
      };
    }
    if (scopes.window) {
      const windowProfileName = this.validProfileName(
        context.incognito ? assignments.privateDefaultProfileName : assignments.normalDefaultProfileName
      );
      if (windowProfileName) {
        return {
          profileName: windowProfileName,
          scope: context.incognito ? 'private' : 'normal'
        };
      }
    }
    return {
      profileName: this._currentProfileName || this.fallbackProfileName,
      scope: 'current'
    };
  }

  private profileForScopeRequest(details: ProxyRequestDetails) {
    const {profileName, scope} = this.scopeProfileName(details);
    if (scope === 'current') {
      return null;
    }
    return OmegaPac.Profiles.byName(profileName, this._options);
  }

  matchProfileFromProfileName(profileName: string, request: Record<string, unknown>) {
    let profile = this.validProfileName(profileName)
      ? OmegaPac.Profiles.byName(profileName, this._options)
      : null;
    if (!profile) {
      return OmegaPromise.reject(new Error(`Profile ${profileName} does not exist!`));
    }
    const results: unknown[] = [];
    let currentProfile = profile;
    let lastProfile = profile;
    while (currentProfile) {
      lastProfile = currentProfile;
      const result = OmegaPac.Profiles.match(currentProfile, request);
      if (result == null) {
        break;
      }
      results.push(result);
      let next;
      if (Array.isArray(result)) {
        next = result[0];
      } else if (result.profileName) {
        next = OmegaPac.Profiles.nameAsKey(result.profileName);
      } else {
        break;
      }
      currentProfile = OmegaPac.Profiles.byKey(next, this._options);
    }
    return OmegaPromise.resolve({
      profile: lastProfile,
      results
    });
  }

  private scopeProfileNames() {
    const assignments = this.profileScopeAssignments();
    const names = new Set<string>();
    for (const profileName of Object.values(this._tabProfileNames)) {
      if (this.validProfileName(profileName)) {
        names.add(profileName as string);
      }
    }
    for (const profileName of Object.values(this._groupProfileNames)) {
      if (this.validProfileName(profileName)) {
        names.add(profileName as string);
      }
    }
    for (const profileName of Object.values(assignments.containers)) {
      if (this.validProfileName(profileName)) {
        names.add(profileName);
      }
    }
    if (this.validProfileName(assignments.normalDefaultProfileName)) {
      names.add(assignments.normalDefaultProfileName as string);
    }
    if (this.validProfileName(assignments.privateDefaultProfileName)) {
      names.add(assignments.privateDefaultProfileName as string);
    }
    return Array.from(names);
  }

  getProfileScopeInfo(args: ProfileScopeInfoArgs) {
    const context = this.scopeContext(args);
    const capabilities = this.profileScopeCapabilities();
    const enabled = this.enabledProfileScopes();
    const assignments = this.profileScopeAssignments();
    const tabProfileName = context.tabId >= 0 ? this.validProfileName(this._tabProfileNames[context.tabId]) : undefined;
    const groupKey = this.groupProfileKey(context.windowId, context.groupId);
    const groupProfileName = groupKey ? this.validProfileName(this._groupProfileNames[groupKey]) : undefined;
    const containerProfileName = isFirefoxContainerId(context.cookieStoreId)
      ? this.validProfileName(assignments.containers[context.cookieStoreId as string])
      : undefined;
    const windowProfileName = this.validProfileName(
      context.incognito ? assignments.privateDefaultProfileName : assignments.normalDefaultProfileName
    );
    const effective = this.scopeProfileName(args);
    return {
      assignments,
      capabilities,
      cookieStoreId: context.cookieStoreId,
      enabled,
      effectiveProfileName: effective.profileName,
      effectiveScope: effective.scope,
      groupId: context.groupId != null && context.groupId !== TAB_GROUP_ID_NONE ? context.groupId : undefined,
      groupProfileName,
      incognito: !!context.incognito,
      isContainer: isFirefoxContainerId(context.cookieStoreId),
      tabId: context.tabId >= 0 ? context.tabId : undefined,
      tabProfileName,
      windowId: context.windowId,
      containerProfileName,
      windowProfileName
    };
  }

  setProfileScope(args: ProfileScopeSetArgs) {
    const capabilities = this.profileScopeCapabilities();
    const scopes = normalizeProfileScopes(this._options['-profileScopes']);
    const profileName = this.validProfileName(args.profileName);
    if (args.profileName && !profileName) {
      return OmegaPromise.reject(new Error(`Profile ${args.profileName} does not exist!`));
    }
    if (args.scope === 'tab') {
      if (!capabilities.tab || !scopes.tab || args.tabId == null) {
        return OmegaPromise.resolve();
      }
      if (profileName) {
        this._tabProfileNames[args.tabId] = profileName;
      } else {
        delete this._tabProfileNames[args.tabId];
      }
      this.saveTabProfileToStorage(args.tabId, profileName);
      return this._currentProfileName
        ? this.applyProfile(this._currentProfileName, {update: false})
        : OmegaPromise.resolve();
    }
    if (args.scope === 'group') {
      if (!capabilities.group || !scopes.group) {
        return OmegaPromise.resolve();
      }
      const groupKey = this.groupProfileKey(args.windowId, args.groupId);
      if (!groupKey) {
        return OmegaPromise.resolve();
      }
      if (profileName) {
        this._groupProfileNames[groupKey] = profileName;
      } else {
        delete this._groupProfileNames[groupKey];
      }
      this.saveGroupProfileToStorage(groupKey, profileName);
      return this._currentProfileName
        ? this.applyProfile(this._currentProfileName, {update: false})
        : OmegaPromise.resolve();
    }
    if (args.scope === 'container') {
      if (!capabilities.container || !scopes.container || !isFirefoxContainerId(args.cookieStoreId)) {
        return OmegaPromise.resolve();
      }
      const assignments = this.profileScopeAssignments();
      if (profileName) {
        assignments.containers[args.cookieStoreId as string] = profileName;
      } else {
        delete assignments.containers[args.cookieStoreId as string];
      }
      return this._setOptions({
        '-profileScopeAssignments': assignments
      });
    }
    if (args.scope === 'normal' || args.scope === 'private') {
      if (!capabilities.window || !scopes.window) {
        return OmegaPromise.resolve();
      }
      const assignments = this.profileScopeAssignments();
      if (args.scope === 'private') {
        if (profileName) {
          assignments.privateDefaultProfileName = profileName;
        } else {
          delete assignments.privateDefaultProfileName;
        }
      } else if (profileName) {
        assignments.normalDefaultProfileName = profileName;
      } else {
        delete assignments.normalDefaultProfileName;
      }
      const setOptions = this._setOptions({
        '-profileScopeAssignments': assignments
      });
      if (this.useStaticWindowProfileContextMenu()) {
        return setOptions.then((value: unknown) => {
          this.updateProfileScopeContextMenuForTab(undefined, {forceRebuild: true});
          return value;
        });
      }
      return setOptions;
    }
    return OmegaPromise.resolve();
  }

  updateProfile(...args: unknown[]) {
    return super.updateProfile(...args).then((results: Record<string, unknown>) => {
      let error = false;
      for (const profileName of Object.keys(results)) {
        const result = results[profileName];
        if (result instanceof Error) {
          error = true;
          break;
        }
      }
      if (error) {
        /*
        this.setBadge({
          text: '!',
          color: '#faa732',
          title: chrome.i18n.getMessage('browserAction_titleDownloadFail')
        });
         */
      }
      return results;
    });
  }

  proxyNotControllable() {
    return this._proxyNotControllable;
  }

  defaultUiLocale() {
    return defaultUiLocaleFromBrowser();
  }

  setProxyNotControllable(reason: string | null, badge?: BadgeOptions) {
    this._proxyNotControllable = reason;
    if (reason) {
      this._state.set({
        proxyNotControllable: reason
      });
      return this.setBadge(badge);
    }
    this._state.remove(['proxyNotControllable']);
    return this.clearBadge();
  }

  setBadge(options?: BadgeOptions) {
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
    }
    this._badgeTitle = null;
  }

  clearBadge() {
    if (this.externalApi.disabled) {
      return;
    }
    if (this._badgeTitle) {
      this.currentProfileChanged('clearBadge');
    }
    if (this._proxyNotControllable) {
      this.setBadge();
    } else {
      const api = actionApi();
      if (typeof api.setBadgeText === 'function') {
        api.setBadgeText({
          text: ''
        });
      }
    }
  }

  setQuickSwitch(quickSwitch: string[] | null, canEnable: boolean) {
    this._quickSwitchCanEnable = canEnable;
    if (!this._quickSwitchHandlerReady) {
      this._quickSwitchHandlerReady = true;
      window.OmegaContextMenuQuickSwitchHandler = (info: {checked: boolean}) => {
        const changes: Record<string, unknown> = {};
        changes['-enableQuickSwitch'] = info.checked;
        const setOptions = this._setOptions(changes);
        if (info.checked && !this._quickSwitchCanEnable) {
          return setOptions.then(() => {
            return chrome.tabs.create({
              url: chrome.runtime.getURL('options.html#/ui')
            });
          });
        }
      };
    }
    const api = actionApi();
    if (quickSwitch || api.setPopup == null) {
      if (typeof api.setPopup === 'function') {
        api.setPopup({
          popup: ''
        });
      }
      if (!this._quickSwitchInit) {
        this._quickSwitchInit = true;
        actionApi().onClicked.addListener((tab: ChromeTab) => {
          this.clearBadge();
          if (!this._options['-enableQuickSwitch']) {
            chrome.tabs.create({
              url: 'popup/index.html'
            });
            return;
          }
          const profiles = this._options['-quickSwitchProfiles'];
          if (!Array.isArray(profiles) || profiles.length === 0) {
            return;
          }
          let index = profiles.indexOf(this._currentProfileName);
          index = (index + 1) % profiles.length;
          const nextProfile = profiles[index];
          if (typeof nextProfile !== 'string') {
            return;
          }
          return this.applyProfile(nextProfile).then(() => {
            if (this._options['-refreshOnProfileChange']) {
              const url = tabUrl(tab);
              if (!url) {
                return;
              }
              if (url.slice(0, 6) === 'chrome') {
                return;
              }
              if (url.slice(0, 6) === 'about:') {
                return;
              }
              if (url.slice(0, 4) === 'moz-') {
                return;
              }
              return chrome.tabs.reload(tab.id, () => {
                chrome.runtime.lastError;
              });
            }
          });
        });
      }
    } else {
      api.setPopup({
        popup: 'popup/index.html'
      });
    }
    chrome.contextMenus?.update('enableQuickSwitch', {
      checked: !!quickSwitch
    });
    return OmegaPromise.resolve();
  }

  setMonitorWebRequests(enabled: boolean) {
    this._monitorWebRequests = enabled;
    if (enabled && this._requestMonitor == null) {
      this._tabRequestInfoPorts = {};
      const wildcardForReq = (req: {url: string}) => {
        return OmegaPac.wildcardForUrl(req.url);
      };
      const requestMonitor = new WebRequestMonitor(wildcardForReq);
      this._requestMonitor = requestMonitor;
      requestMonitor.watchTabs((tabId: number, info: TabRequestInfo) => {
        if (!this._monitorWebRequests) {
          return;
        }
        if (info.errorCount > 0) {
          info.badgeSet = true;
          const badge = {
            text: info.errorCount.toString(),
            color: '#f0ad4e'
          };
          actionApi().setBadgeText({
            text: badge.text,
            tabId
          });
          actionApi().setBadgeBackgroundColor({
            color: badge.color,
            tabId
          });
        } else if (info.badgeSet) {
          info.badgeSet = false;
          actionApi().setBadgeText({
            text: '',
            tabId
          });
        }
        return this._tabRequestInfoPorts?.[tabId]?.postMessage({
          errorCount: info.errorCount,
          summary: info.summary
        });
      });
      return chrome.runtime.onConnect.addListener((rawPort: ChromeRuntimePort) => {
        if (rawPort.name !== 'tabRequestInfo') {
          return;
        }
        if (!this._monitorWebRequests) {
          return;
        }
        let tabId: number | null = null;
        const port = new ChromePort(rawPort);
        port.onMessage.addListener((msg: unknown) => {
          if (!isRecordValue(msg) || typeof msg.tabId !== 'number') {
            return;
          }
          tabId = msg.tabId;
          if (this._tabRequestInfoPorts) {
            this._tabRequestInfoPorts[tabId] = port;
          }
          const info = requestMonitor.tabInfo[tabId];
          if (info) {
            return port.postMessage({
              errorCount: info.errorCount,
              summary: info.summary
            });
          }
        });
        return port.onDisconnect.addListener(() => {
          if (tabId != null && this._tabRequestInfoPorts) {
            return delete this._tabRequestInfoPorts[tabId];
          }
        });
      });
    }
  }

  schedule(name: string, periodInMinutes: number, callback: () => void) {
    name = `omega.${name}`;
    const root = globalThis as typeof globalThis & {_alarms?: unknown};
    if (typeof root._alarms === 'undefined' || root._alarms === null) {
      this._alarms = {};
      chrome.alarms.onAlarm.addListener((alarm: {name: string}) => {
        const scheduled = this._alarms?.[alarm.name];
        return typeof scheduled === 'function' ? scheduled() : undefined;
      });
    }
    if (periodInMinutes < 0) {
      delete this._alarms?.[name];
      chrome.alarms.clear(name);
    } else {
      if (this._alarms) {
        this._alarms[name] = callback;
      }
      chrome.alarms.create(name, {
        periodInMinutes
      });
    }
    return OmegaPromise.resolve();
  }

  printFixedProfile(profile: Profile) {
    if (profile.profileType !== 'FixedProfile') {
      return undefined;
    }
    let result = '';
    for (const scheme of OmegaPac.Profiles.schemes) {
      if (!profile[scheme.prop]) {
        continue;
      }
      const pacResult = OmegaPac.Profiles.pacResult(profile[scheme.prop]);
      if (scheme.scheme) {
        result += `${scheme.scheme}: ${pacResult}\n`;
      } else {
        result += `${pacResult}\n`;
      }
    }
    result || (result = chrome.i18n.getMessage('browserAction_profileDetails_DirectProfile'));
    return result;
  }

  printProfile(profile: Profile) {
    let type = profile.profileType || '';
    if (type.indexOf('RuleListProfile') >= 0) {
      type = 'RuleListProfile';
    }
    if (type === 'FixedProfile') {
      return this.printFixedProfile(profile);
    }
    if (type === 'PacProfile' && profile.pacUrl) {
      return profile.pacUrl;
    }
    return chrome.i18n.getMessage(`browserAction_profileDetails_${type}`) || null;
  }

  upgrade(options: UpgradeOptions | null | undefined, changes?: Record<string, unknown>) {
    if (options == null || Object.keys(options).length === 0 || options.schemaVersion == null) {
      return OmegaPromise.reject(new OmegaTarget.Options.NoOptionsError());
    }
    return super.upgrade(options, changes).then((upgradeResult: unknown) => {
      const [upgradedOptions, upgradedChanges] = upgradeResult as [Record<string, unknown>, Record<string, unknown>];
      if (this.proxyImpl.proxyDnsCapabilities.socks5) {
        return [upgradedOptions, upgradedChanges];
      }
      OmegaPac.Profiles.each(upgradedOptions, (key: string, profile: Profile) => {
        if (!normalizeSocks5LocalDnsProfile(profile)) {
          return;
        }
        OmegaPac.Profiles.updateRevision(profile);
        upgradedChanges[key] = profile;
      });
      return [upgradedOptions, upgradedChanges];
    });
  }

  onFirstRun(_reason: string) {
    return chrome.tabs.create({
      url: chrome.runtime.getURL('options.html')
    });
  }

  getMonitoredTabUrl(tabId: number, url?: string) {
    return tabInfoPageUrl(this._requestMonitor?.tabInfo[tabId], url);
  }

  getPageInfo({cookieStoreId, groupId, includeExplanations = false, incognito, tabId, url, windowId}: PageInfoArgs) {
    const tabInfo = this._requestMonitor?.tabInfo[tabId];
    const profileScope = this.getProfileScopeInfo({
      cookieStoreId,
      groupId,
      incognito,
      tabId,
      windowId
    });
    const errorCount = tabInfo?.errorCount;
    const summary = tabInfo?.summary;
    const result = errorCount ? {
      errorCount,
      summary
    } : null;
    this.clearBadge();
    url = tabInfoPageUrl(tabInfo, url);
    if (!url) {
      return result;
    }
    if (url.slice(0, 6) === 'chrome') {
      const errorPagePrefix = 'chrome://errorpage/';
      if (url.startsWith(errorPagePrefix)) {
        url = new URL(url).searchParams.get('lasturl') || undefined;
        if (!url) {
          return result;
        }
      } else {
        return result;
      }
    }
    if (url.slice(0, 6) === 'about:') {
      return result;
    }
    if (url.slice(0, 4) === 'moz-') {
      return result;
    }
    const domain = OmegaPac.getBaseDomain(new URL(url).hostname.replace(/^\[(.*)\]$/, '$1'));
    const pageRequests = pageRequestsFromTabInfo(tabInfo, url);
    const basePageInfo = {
      url,
      domain,
      tempRuleProfileName: this.queryTempRule(domain),
      profileScope,
      errorCount,
      summary,
      requests: pageRequests.requests,
      requestLimitExceeded: pageRequests.requestLimitExceeded
    };
    if (!includeExplanations) {
      return basePageInfo;
    }
    const explanations = pageRequests.requests.map((request) => {
      const explainArgs = profileScope.effectiveScope && profileScope.effectiveScope !== 'current'
        ? {profileName: profileScope.effectiveProfileName, url: request.url}
        : {url: request.url};
      return this.explainRequest(explainArgs).catch((error: unknown) => ({
        currentProfile: undefined as Partial<PopupApiProfile> | undefined,
        errors: [error instanceof Error ? error.message : String(error)],
        final: {
          kind: 'error'
        },
        finalProfile: undefined as Partial<PopupApiProfile> | undefined,
        request: {
          url: request.url
        },
        startProfile: undefined as Partial<PopupApiProfile> | undefined,
        steps: [] as Array<Record<string, unknown>>,
        tempRulesActive: false,
        warnings: [] as string[]
      }));
    });
    return OmegaPromise.all(explanations).then((requestExplanations: PopupApiRequestExplanation[]) => ({
      ...basePageInfo,
      requestExplanations
    }));
  }
}

export default ChromeOptions;
