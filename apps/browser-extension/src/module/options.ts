import OmegaTarget from '@switchyagain/extension-runtime';
import ChromePort from './chrome_port';
import fetchUrl from './fetch_url';
import {tabUrl} from './tabs';
import WebRequestMonitor from './web_request_monitor';
import type {ProxyImplInstance, ProxyProfile, ProxyRequestDetails} from './proxy/proxy_types';

const OmegaPac = OmegaTarget.OmegaPac;
const OmegaPromise = OmegaTarget.Promise;

type BadgeOptions = {
  color: string;
  text: string;
  title?: string;
};

type Profile = ProxyProfile;
type FixedProfileProxyField = 'fallbackProxy' | 'proxyForHttp' | 'proxyForHttps';

const FIXED_PROFILE_PROXY_FIELDS: FixedProfileProxyField[] = ['fallbackProxy', 'proxyForHttp', 'proxyForHttps'];

type ExternalApiLike = {
  disabled: boolean;
};

type InspectLike = {
  disable(): unknown;
  enable(): unknown;
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
  tab: boolean;
  window: boolean;
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
  incognito?: boolean;
  profileName?: string;
  scope: 'container' | 'normal' | 'private' | 'tab';
  tabId?: number;
};

type ProfileScopeInfoArgs = {
  cookieStoreId?: string;
  incognito?: boolean;
  tabId?: number;
};

type TabProfileContext = {
  cookieStoreId?: string;
  incognito?: boolean;
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
  includeExplanations?: boolean;
  incognito?: boolean;
  tabId: number;
  url?: string;
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
  private _inspect: InspectLike | null;
  private _monitorWebRequests: boolean;
  private _proxyNotControllable: string | null;
  private _profileScopeContainers: Record<string, ProfileScopeContainerInfo>;
  private _profileScopeContainerOrder: string[];
  private _quickSwitchCanEnable: boolean;
  private _quickSwitchHandlerReady: boolean;
  private _quickSwitchInit: boolean;
  private _requestMonitor: RequestMonitorLike | null;
  private _tabProfileContexts: Record<number, TabProfileContext>;
  private _tabProfileNames: Record<number, string | undefined>;
  private _tabProfileScopeWatching: boolean;
  private _tabRequestInfoPorts: Record<number, ChromePortLike> | null;

  constructor(...args: unknown[]) {
    super(...args);
    this.fetchUrl = fetchUrl;
    this._inspect = null;
    this._proxyNotControllable = null;
    this._badgeTitle = null;
    this._quickSwitchInit = false;
    this._quickSwitchHandlerReady = false;
    this._quickSwitchCanEnable = false;
    this._requestMonitor = null;
    this._profileScopeContainers = {};
    this._profileScopeContainerOrder = [];
    this._tabProfileContexts = {};
    this._tabProfileNames = {};
    this._tabProfileScopeWatching = false;
    this._monitorWebRequests = false;
    this._tabRequestInfoPorts = null;
    this._alarms = null;
    this.initProfileScopes();
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
    chrome.tabs.query({}, (tabs: ChromeTab[]) => {
      for (const tab of tabs) {
        if (tab.id != null) {
          this.updateTabProfileContext(tab.id, tab);
        }
      }
    });
  }

  private updateTabProfileContext(tabId: number, tab: Pick<ChromeTab, 'cookieStoreId' | 'incognito'>) {
    if (isFirefoxContainerId(tab.cookieStoreId)) {
      this.rememberProfileScopeContainer(tab.cookieStoreId);
    }
    this._tabProfileContexts[tabId] = {
      cookieStoreId: typeof tab.cookieStoreId === 'string' ? tab.cookieStoreId : this._tabProfileContexts[tabId]?.cookieStoreId,
      incognito: typeof tab.incognito === 'boolean' ? tab.incognito : this._tabProfileContexts[tabId]?.incognito
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

  private profileScopeCapabilities(): ProfileScopeSettings {
    const features = this.proxyImpl.features || [];
    return {
      tab: features.indexOf('tabProfileScope') >= 0,
      container: features.indexOf('containerProfileScope') >= 0,
      window: features.indexOf('windowProfileScope') >= 0
    };
  }

  private enabledProfileScopes(): ProfileScopeSettings {
    const scopes = normalizeProfileScopes(this._options['-profileScopes']);
    const capabilities = this.profileScopeCapabilities();
    return {
      tab: scopes.tab && capabilities.tab,
      container: scopes.container && capabilities.container,
      window: scopes.window && capabilities.window
    };
  }

  private profileScopeAssignments() {
    return normalizeProfileScopeAssignments(this._options['-profileScopeAssignments']);
  }

  private validProfileName(profileName?: string) {
    return profileName && OmegaPac.Profiles.byName(profileName, this._options) ? profileName : undefined;
  }

  private scopeContext(args: ProfileScopeInfoArgs | ProxyRequestDetails): Required<Pick<ProfileScopeInfoArgs, 'tabId'>> & TabProfileContext {
    const tabId = typeof args.tabId === 'number' ? args.tabId : -1;
    const cached = tabId >= 0 ? this._tabProfileContexts[tabId] : undefined;
    const context = {
      tabId,
      cookieStoreId: typeof args.cookieStoreId === 'string' ? args.cookieStoreId : cached?.cookieStoreId,
      incognito: typeof args.incognito === 'boolean' ? args.incognito : cached?.incognito
    };
    if (tabId >= 0) {
      this._tabProfileContexts[tabId] = {
        cookieStoreId: context.cookieStoreId,
        incognito: context.incognito
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
      incognito: !!context.incognito,
      isContainer: isFirefoxContainerId(context.cookieStoreId),
      tabId: context.tabId >= 0 ? context.tabId : undefined,
      tabProfileName,
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
      return this._setOptions({
        '-profileScopeAssignments': assignments
      });
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

  setInspect(settings: {showMenu?: boolean}) {
    if (this._inspect) {
      if (settings.showMenu) {
        this._inspect.enable();
      } else {
        this._inspect.disable();
      }
    }
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

  getPageInfo({cookieStoreId, includeExplanations = false, incognito, tabId, url}: PageInfoArgs) {
    const tabInfo = this._requestMonitor?.tabInfo[tabId];
    const profileScope = this.getProfileScopeInfo({
      cookieStoreId,
      incognito,
      tabId
    });
    const errorCount = tabInfo?.errorCount;
    const summary = tabInfo?.summary;
    const result = errorCount ? {
      errorCount,
      summary
    } : null;
    const getBadge = new OmegaPromise((resolve: (value: string) => void) => {
      const api = actionApi();
      if (typeof api.getBadgeText !== 'function') {
        resolve('');
        return;
      }
      return api.getBadgeText({
        tabId
      }, (badgeText: string) => {
        return resolve(badgeText);
      });
    });
    const getInspectUrl = this._state.get({
      inspectUrl: ''
    });
    return OmegaPromise.join(getBadge, getInspectUrl, (badge: string, state: {inspectUrl?: string}) => {
      const inspectUrl = state.inspectUrl;
      if (badge === '#' && inspectUrl) {
        url = inspectUrl;
      } else {
        this.clearBadge();
        url = tabInfoPageUrl(tabInfo, url);
      }
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
        requestExplanations,
      }));
    });
  }
}

export default ChromeOptions;
