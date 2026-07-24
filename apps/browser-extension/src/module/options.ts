import ExtensionRuntime from '@switchyagain/extension-runtime';
import ChromePort from './chrome_port';
import {ContextMenuRefreshQueue, setContextMenuQuickSwitchHandler} from './context_menu';
import fetchUrl from './fetch_url';
import {tabUrl} from './tabs';
import WebRequestMonitor from './web_request_monitor';
import {optionsWithProxyExceptions} from './proxy_exceptions';
import type {ProxyCondition, ProxyImplInstance, ProxyProfile, ProxyRequestDetails} from './proxy/proxy_types';

const ProxyEngine = ExtensionRuntime.ProxyEngine;

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
const PAGE_PROFILE_CONTEXT_MENU_ROOT_ID = 'useProfileForThisPage';
const PAGE_PROFILE_CONTEXT_MENU_ITEM_PREFIX = `${PAGE_PROFILE_CONTEXT_MENU_ROOT_ID}:`;
const CLEAR_PAGE_PROFILE_CONTEXT_MENU_ID = `${PAGE_PROFILE_CONTEXT_MENU_ROOT_ID}:clear`;
const SITE_PROFILE_CONTEXT_MENU_ROOT_ID = 'useProfileForThisSite';
const SITE_PROFILE_CONTEXT_MENU_ITEM_PREFIX = `${SITE_PROFILE_CONTEXT_MENU_ROOT_ID}:`;
const CLEAR_SITE_PROFILE_CONTEXT_MENU_ID = `${SITE_PROFILE_CONTEXT_MENU_ROOT_ID}:clear`;
const NORMAL_WINDOW_PROFILE_CONTEXT_MENU_ROOT_ID = 'useProfileForNormalWindows';
const NORMAL_WINDOW_PROFILE_CONTEXT_MENU_ITEM_PREFIX = `${NORMAL_WINDOW_PROFILE_CONTEXT_MENU_ROOT_ID}:`;
const CLEAR_NORMAL_WINDOW_PROFILE_CONTEXT_MENU_ID = `${NORMAL_WINDOW_PROFILE_CONTEXT_MENU_ROOT_ID}:clear`;
const PRIVATE_WINDOW_PROFILE_CONTEXT_MENU_ROOT_ID = 'useProfileForPrivateWindows';
const PRIVATE_WINDOW_PROFILE_CONTEXT_MENU_ITEM_PREFIX = `${PRIVATE_WINDOW_PROFILE_CONTEXT_MENU_ROOT_ID}:`;
const CLEAR_PRIVATE_WINDOW_PROFILE_CONTEXT_MENU_ID = `${PRIVATE_WINDOW_PROFILE_CONTEXT_MENU_ROOT_ID}:clear`;
const TAB_GROUP_ID_NONE = -1;
const WEB_LINK_PATTERNS = ['http://*/*', 'https://*/*'];
const ROUTE_INFO_ENABLED_KEY = '-routeInfoEnabled';
const ROUTE_INFO_REQUEST_DETAILS_ENABLED_KEY = '-routeInfoRequestDetailsEnabled';
const NETWORK_REQUEST_IGNORE_LIST_ENABLED_KEY = '-networkRequestIgnoreListEnabled';
const NETWORK_REQUEST_IGNORE_LIST_KEY = '-networkRequestIgnoreList';
const PROXY_EXCEPTIONS_APPLIED_OPTION_KEYS = new Set([
  '-proxyExceptionsEnabled',
  '-globalBypassListId',
  '-profileGroups',
  '-profileGroupsEnabled',
  '-supplementalLists'
]);
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
  FixedProfile:
    '<circle cx="12" cy="12" r="8"/><path d="M4 12h16"/><path d="M12 4c2 2.4 3 5.1 3 8s-1 5.6-3 8"/><path d="M12 4c-2 2.4-3 5.1-3 8s1 5.6 3 8"/>',
  PacProfile: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h4"/>',
  RuleListProfile:
    '<path d="M7 7h10"/><path d="M7 12h10"/><path d="M7 17h10"/><circle cx="4.5" cy="7" r=".7"/><circle cx="4.5" cy="12" r=".7"/><circle cx="4.5" cy="17" r=".7"/>',
  SwitchProfile:
    '<path d="M6 8h8c2.8 0 5 2.2 5 5"/><path d="M16 10l3 3 3-3"/><path d="M18 16h-8c-2.8 0-5-2.2-5-5"/><path d="M8 14l-3-3-3 3"/>',
  SystemProfile: '<path d="M12 4v8"/><path d="M7 6.7a8 8 0 1 0 10 0"/>',
  VirtualProfile: '<path d="M9 9a3 3 0 1 1 4.6 2.5c-1.1.7-1.6 1.3-1.6 2.5"/><path d="M12 18h.01"/>'
};
const PROFILE_CONTEXT_MENU_TYPE_LABELS: Record<string, string> = {
  AutoDetectProfile: '[pac]',
  DirectProfile: '[direct]',
  FixedProfile: '[proxy]',
  PacProfile: '[pac]',
  SwitchProfile: '[switch]',
  SystemProfile: '[system]',
  VirtualProfile: '[virtual]'
};

type BadgeOptions = {
  color: string;
  text: string;
  title?: string;
};

type Profile = ProxyProfile;
type ContextMenuProfile = Profile & {name: string};
type ProfileGroup = {
  color?: string;
  icon?: string;
  id: string;
  name: string;
  order?: number;
  supplementalListIds?: string[];
};
type ContextMenuProfileGroup = ProfileGroup & {
  profiles: ContextMenuProfile[];
};
type ContextMenuProfileGroups = {
  groups: ContextMenuProfileGroup[];
  hidden: ContextMenuProfile[];
  visible: ContextMenuProfile[];
};
type ContextMenuProfileItemOptions = {
  checked?: boolean;
  contexts: string[];
  documentUrlPatterns?: string[];
  id: string;
  parentId: string;
  profile: ContextMenuProfile;
  radio?: boolean;
  targetUrlPatterns?: string[];
  title?: string;
  useIcons: boolean;
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
  clearable?: boolean;
  fallbackTitle: string;
  itemPrefix: string;
  rootId: string;
  setArgs: Omit<ProfileScopeSetArgs, 'profileName'>;
  titleKey: string;
};
type FixedProfileProxyField = 'fallbackProxy' | 'proxyForHttp' | 'proxyForHttps' | 'proxyForWs' | 'proxyForWss';

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

const FIXED_PROFILE_PROXY_FIELDS: FixedProfileProxyField[] = [
  'fallbackProxy',
  'proxyForHttp',
  'proxyForHttps',
  'proxyForWs',
  'proxyForWss'
];

type ExternalApiLike = {
  disabled: boolean;
};

type RequestSummaryItem = {
  errorCount: number;
};

type RequestStatus = 'start' | 'ongoing' | 'timeout' | 'error' | 'timeoutAbort' | 'done' | 'unknown';

type MonitoredRequestInfo = {
  _startTime?: number;
  error?: string;
  requestId: string;
  routeInfoHidden?: boolean;
  type?: string;
  url: string;
  [key: string]: unknown;
};

type PageRequestInfo = {
  error?: string;
  id: string;
  ignored?: boolean;
  ignoreMatches?: string[];
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
  site: boolean;
  tab: boolean;
  window: boolean;
};

type ContextMenuOptions = {
  containerProfile: boolean;
  groupProfile: boolean;
  linkProfileNewPrivateWindow: boolean;
  linkProfileNewTab: boolean;
  linkProfileNewWindow: boolean;
  pageProfile: boolean;
  siteProfile: boolean;
  switchProfile: boolean;
  tabProfile: boolean;
  windowProfile: boolean;
};

type ProfileScopeAssignments = {
  containers: Record<string, string>;
  normalDefaultProfileName?: string;
  privateDefaultProfileName?: string;
  rules: ProfileScopeRule[];
};

type ProfileScopeRule = {
  condition: ProxyCondition;
  note?: string;
  profileName: string;
  quickKey?: string;
  quickTarget?: 'page' | 'site';
  [key: string]: unknown;
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
  scope: 'container' | 'group' | 'normal' | 'private' | 'page' | 'site' | 'tab';
  tabId?: number;
  url?: string;
  windowId?: number;
};

type ProfileScopeInfoArgs = {
  cookieStoreId?: string;
  groupId?: number;
  incognito?: boolean;
  url?: string;
  tabId?: number;
  windowId?: number;
};

type TabProfileContext = {
  cookieStoreId?: string;
  groupId?: number;
  incognito?: boolean;
  pageUrl?: string;
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
  setEnabled(enabled: boolean): void;
  tabInfo: Record<string, TabRequestInfo | undefined>;
  watchTabs(callback: (tabId: number, info: TabRequestInfo, req?: unknown, status?: unknown) => unknown): unknown;
};

type ChromePortLike = InstanceType<typeof ChromePort>;

type UpgradeOptions = Record<string, unknown> & {
  schema?: unknown;
  version?: unknown;
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

function ignoreChromeLastError() {
  chrome.runtime.lastError;
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
    site: scopes.site === true,
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
  const assignments: ProfileScopeAssignments = {containers, rules: []};
  if (typeof rawAssignments.normalDefaultProfileName === 'string' && rawAssignments.normalDefaultProfileName) {
    assignments.normalDefaultProfileName = rawAssignments.normalDefaultProfileName;
  }
  if (typeof rawAssignments.privateDefaultProfileName === 'string' && rawAssignments.privateDefaultProfileName) {
    assignments.privateDefaultProfileName = rawAssignments.privateDefaultProfileName;
  }
  const rules: ProfileScopeRule[] = [];
  if (Array.isArray(rawAssignments.rules)) {
    for (const rawRule of rawAssignments.rules) {
      if (!isRecordValue(rawRule) || !isRecordValue(rawRule.condition)) {
        continue;
      }
      if (typeof rawRule.condition.conditionType !== 'string' || typeof rawRule.profileName !== 'string' || !rawRule.profileName) {
        continue;
      }
      const rule: ProfileScopeRule = {
        ...rawRule,
        condition: {...rawRule.condition} as ProxyCondition,
        profileName: rawRule.profileName
      };
      if (typeof rawRule.note !== 'string') {
        delete rule.note;
      }
      if (rawRule.quickTarget !== 'page' && rawRule.quickTarget !== 'site') {
        delete rule.quickTarget;
        delete rule.quickKey;
      } else if (typeof rawRule.quickKey !== 'string' || !rawRule.quickKey) {
        delete rule.quickTarget;
        delete rule.quickKey;
      }
      rules.push(rule);
    }
  }
  assignments.rules = rules;
  return assignments;
}

function scopeUrl(value?: string) {
  if (typeof value !== 'string' || !value) {
    return undefined;
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return undefined;
    }
    // Page identity intentionally excludes credentials and fragments. URL.origin
    // also normalizes the default port, while pathname/search retain the full
    // path and query identity.
    return `${parsed.origin}${parsed.pathname || '/'}${parsed.search}`;
  } catch (_error) {
    return undefined;
  }
}

function scopeSitePattern(value?: string) {
  const normalized = scopeUrl(value);
  if (!normalized) {
    return undefined;
  }
  try {
    return ProxyEngine.wildcardForUrl(normalized);
  } catch (_error) {
    return undefined;
  }
}

function regexEscape(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function profileScopeRuleForTarget(target: 'page' | 'site', url?: string): {condition: ProxyCondition; key: string} | undefined {
  if (target === 'page') {
    const normalized = scopeUrl(url);
    if (!normalized) {
      return undefined;
    }
    return {
      condition: {
        conditionType: 'UrlRegexCondition',
        pattern: `^${regexEscape(normalized)}$`
      },
      key: normalized
    };
  }
  const pattern = scopeSitePattern(url);
  if (!pattern) {
    return undefined;
  }
  return {
    condition: {
      conditionType: 'HostWildcardCondition',
      pattern
    },
    key: pattern
  };
}

function profileScopeRuleTarget(rule: ProfileScopeRule): 'page' | 'site' {
  return rule.condition.conditionType === 'UrlRegexCondition' || rule.condition.conditionType === 'UrlWildcardCondition' ? 'page' : 'site';
}

function isMatchingQuickProfileScopeRule(
  rule: ProfileScopeRule,
  target: 'page' | 'site',
  generated: {condition: ProxyCondition; key: string}
) {
  return (
    rule.quickTarget === target &&
    rule.quickKey === generated.key &&
    rule.condition.conditionType === generated.condition.conditionType &&
    rule.condition.pattern === generated.condition.pattern
  );
}

function isScopeRequestUrl(value?: string) {
  return scopeUrl(value) != null;
}

function normalizeContextMenuOptions(value: unknown, capabilities?: ContextMenuOptions): ContextMenuOptions {
  const raw = isRecordValue(value) ? value : {};
  const options = {
    switchProfile: raw.switchProfile !== false,
    tabProfile: raw.tabProfile === true,
    groupProfile: raw.groupProfile === true,
    containerProfile: raw.containerProfile === true,
    pageProfile: raw.pageProfile === true,
    siteProfile: raw.siteProfile === true,
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
    pageProfile: options.pageProfile && capabilities.pageProfile,
    siteProfile: options.siteProfile && capabilities.siteProfile,
    windowProfile: options.windowProfile && capabilities.windowProfile,
    linkProfileNewTab: options.linkProfileNewTab && capabilities.linkProfileNewTab,
    linkProfileNewWindow: options.linkProfileNewWindow && capabilities.linkProfileNewWindow,
    linkProfileNewPrivateWindow: options.linkProfileNewPrivateWindow && capabilities.linkProfileNewPrivateWindow
  };
}

function isFirefoxContainerId(cookieStoreId?: string): cookieStoreId is string {
  return !!cookieStoreId && cookieStoreId !== 'firefox-default' && cookieStoreId !== 'firefox-private';
}

function normalizeNetworkRequestIgnoreList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen: Record<string, boolean> = {};
  const result: string[] = [];
  for (const item of value) {
    const pattern = String(item || '').trim();
    if (!pattern || seen[pattern]) {
      continue;
    }
    seen[pattern] = true;
    result.push(pattern);
  }
  return result;
}

function isNetworkRequestIgnoreListEnabled(options: Record<string, unknown>) {
  return options[NETWORK_REQUEST_IGNORE_LIST_ENABLED_KEY] === true;
}

function isRouteInfoEnabled(options: Record<string, unknown>) {
  return options[ROUTE_INFO_ENABLED_KEY] !== false;
}

function isRouteInfoRequestDetailsEnabled(options: Record<string, unknown>) {
  return options[ROUTE_INFO_REQUEST_DETAILS_ENABLED_KEY] === true;
}

function isFailedRequestDetectionEnabled(options: Record<string, unknown>) {
  return isRouteInfoEnabled(options) && options['-monitorWebRequests'] !== false;
}

function effectiveNetworkRequestIgnoreList(options: Record<string, unknown>) {
  if (!isFailedRequestDetectionEnabled(options)) {
    return [];
  }
  if (!isNetworkRequestIgnoreListEnabled(options)) {
    return [];
  }
  return normalizeNetworkRequestIgnoreList(options[NETWORK_REQUEST_IGNORE_LIST_KEY]);
}

function routeInfoIgnoreRuleMatches(url: string, pattern: string) {
  try {
    const conditionType = pattern.indexOf('://') >= 0 || pattern.indexOf('/') >= 0 ? 'UrlWildcardCondition' : 'HostWildcardCondition';
    const request = ProxyEngine.Conditions.requestFromUrl(url) as Record<string, unknown>;
    return Boolean(
      (ProxyEngine.Conditions as {match?: (condition: Record<string, unknown>, request: Record<string, unknown>) => boolean}).match?.(
        {
          conditionType,
          pattern
        },
        request
      )
    );
  } catch (_error) {
    return false;
  }
}

function routeInfoIgnoreMatches(url: string, ignoreList: string[]) {
  if (!ignoreList.length || !url) {
    return [];
  }
  return ignoreList.filter((pattern) => routeInfoIgnoreRuleMatches(url, pattern));
}

function requestIgnoreInfo(url: string, ignoreList: string[]) {
  const ignoreMatches = routeInfoIgnoreMatches(url, ignoreList);
  if (!ignoreMatches.length) {
    return {};
  }
  return {
    ignored: true,
    ignoreMatches
  };
}

function requestStatusHasError(status?: RequestStatus, request?: MonitoredRequestInfo) {
  return !!request?.error || status === 'error' || status === 'timeout' || status === 'timeoutAbort';
}

function requestSummaryId(request: MonitoredRequestInfo) {
  try {
    return ProxyEngine.wildcardForUrl(request.url);
  } catch (_error) {
    return undefined;
  }
}

function incrementRequestSummary(summary: Record<string, RequestSummaryItem>, summaryKey?: string) {
  if (summaryKey == null) {
    return;
  }
  let summaryItem = summary[summaryKey];
  if (summaryItem == null) {
    summaryItem = summary[summaryKey] = {
      errorCount: 0
    };
  }
  summaryItem.errorCount++;
}

function filteredTabRequestInfo(tabInfo: TabRequestInfo | undefined, ignoreList: string[]) {
  const summary: Record<string, RequestSummaryItem> = {};
  let errorCount = 0;
  const rawRequests = tabInfo?.requests || {};
  for (const requestId in rawRequests) {
    if (!Object.prototype.hasOwnProperty.call(rawRequests, requestId)) {
      continue;
    }
    const request = rawRequests[requestId];
    const status = tabInfo?.requestStatus?.[requestId];
    if (
      !request ||
      request.routeInfoHidden ||
      !requestStatusHasError(status, request) ||
      routeInfoIgnoreMatches(request.url, ignoreList).length > 0
    ) {
      continue;
    }
    errorCount++;
    incrementRequestSummary(summary, requestSummaryId(request));
  }
  return {
    errorCount,
    summary
  };
}

function effectiveFailedRequestInfo(options: Record<string, unknown>, tabInfo?: TabRequestInfo) {
  if (!isFailedRequestDetectionEnabled(options)) {
    return {
      errorCount: 0,
      summary: {}
    };
  }
  return filteredTabRequestInfo(tabInfo, effectiveNetworkRequestIgnoreList(options));
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

function pageRequestsFromTabInfo(tabInfo?: TabRequestInfo, pageUrl?: string, ignoreList: string[] = []) {
  const monitored: MonitoredRequestInfo[] = [];
  const rawRequests = tabInfo?.requests || {};
  for (const requestId in rawRequests) {
    if (!Object.prototype.hasOwnProperty.call(rawRequests, requestId)) {
      continue;
    }
    const request = rawRequests[requestId];
    if (request && !request.routeInfoHidden && explainableRequestUrl(request.url)) {
      monitored.push(request);
    }
  }
  monitored.sort((a, b) => requestStartTime(a) - requestStartTime(b));
  const requests: PageRequestInfo[] = [];
  if (explainableRequestUrl(pageUrl) && !monitored.some((request) => request.url === pageUrl && request.type === 'main_frame')) {
    requests.push({
      id: 'page',
      ...requestIgnoreInfo(pageUrl as string, ignoreList),
      status: 'done',
      type: 'main_frame',
      url: pageUrl as string
    });
  }
  for (const request of monitored) {
    requests.push({
      error: request.error,
      id: request.requestId,
      ...requestIgnoreInfo(request.url, ignoreList),
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

// ChromeOptions merges the runtime class with its declared base shape.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unsafe-declaration-merging
interface ChromeOptions extends RuntimeOptionsBase {}

function defaultUiLocaleFromBrowser(language?: string) {
  if (language == null) {
    const getUILanguage = chrome.i18n && chrome.i18n.getUILanguage;
    language = typeof getUILanguage === 'function' ? getUILanguage.call(chrome.i18n) : '';
  }
  const normalized = language.replace(/_/g, '-').toLowerCase();
  if (normalized === 'zh' || normalized.startsWith('zh-hans') || normalized.startsWith('zh-cn') || normalized.startsWith('zh-sg')) {
    return 'zh-Hans';
  }
  if (
    normalized.startsWith('zh-hant') ||
    normalized.startsWith('zh-tw') ||
    normalized.startsWith('zh-hk') ||
    normalized.startsWith('zh-mo')
  ) {
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
class ChromeOptions extends ExtensionRuntime.Options {
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
  private _linkProfileContextMenuRefreshQueue: ContextMenuRefreshQueue;
  private _linkProfileContextMenuRefreshToken: number;
  private _switchProfileContextMenuIds: string[];
  private _switchProfileContextMenuProfiles: Record<string, string>;
  private _switchProfileContextMenuRefreshQueue: ContextMenuRefreshQueue;
  private _switchProfileContextMenuRefreshToken: number;
  private _profileScopeContextMenuIds: string[];
  private _profileScopeContextMenuSelections: Record<string, ProfileScopeContextMenuSelection>;
  private _profileScopeContextMenuRefreshQueue: ContextMenuRefreshQueue;
  private _profileScopeContextMenuRefreshToken: number;
  private _profileScopeContextMenuSignature: string;
  private _contextMenuWindowIncognito: boolean;
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
    this._linkProfileContextMenuRefreshQueue = new ContextMenuRefreshQueue((error) => {
      this.log.error('Refreshing link profile context menu failed.', error);
    });
    this._linkProfileContextMenuRefreshToken = 0;
    this._switchProfileContextMenuIds = [];
    this._switchProfileContextMenuProfiles = {};
    this._switchProfileContextMenuRefreshQueue = new ContextMenuRefreshQueue((error) => {
      this.log.error('Refreshing switch profile context menu failed.', error);
    });
    this._switchProfileContextMenuRefreshToken = 0;
    this._profileScopeContextMenuIds = [];
    this._profileScopeContextMenuSelections = {};
    this._profileScopeContextMenuRefreshQueue = new ContextMenuRefreshQueue((error) => {
      this.log.error('Refreshing profile scope context menu failed.', error);
    });
    this._profileScopeContextMenuRefreshToken = 0;
    this._profileScopeContextMenuSignature = '';
    this._contextMenuWindowIncognito = false;
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

  optionAffectsAppliedProfile(key: string) {
    return PROXY_EXCEPTIONS_APPLIED_OPTION_KEYS.has(key);
  }

  additionalAppliedProfileNames() {
    return this.scopeProfileNames();
  }

  private initProfileScopes() {
    this.proxyImpl.setProfileResolver?.(
      (details) => this.profileForScopeRequest(details),
      () => this.scopeProfileNames()
    );
    this._state.set({
      profileScopeCapabilities: this.profileScopeCapabilities(),
      proxyAuthCapabilities: this.proxyImpl.proxyAuthCapabilities,
      proxyDnsCapabilities: this.proxyImpl.proxyDnsCapabilities,
      proxyFeatures: this.proxyImpl.features
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
    chrome.tabs.onUpdated.addListener((tabId: number, changeInfo: Record<string, unknown>, tab: ChromeTab) => {
      this.updateTabProfileContext(tabId, {
        ...tab,
        url: typeof changeInfo.url === 'string' ? changeInfo.url : tab.url
      });
    });
    chrome.tabs.onActivated.addListener((info) => {
      chrome.tabs.get(info.tabId, (tab: ChromeTab) => {
        if (!chrome.runtime.lastError && tab?.id != null) {
          this.updateTabProfileContext(tab.id, tab);
        }
      });
      this.updateContextMenuWindowIncognitoFromCurrentTab(true, info.windowId);
    });
    chrome.tabs.onCreated.addListener((tab: ChromeTab) => {
      if (tab.id != null) {
        this.updateTabProfileContext(tab.id, tab);
      }
      if (tab.active) {
        this.updateContextMenuWindowIncognitoFromCurrentTab(true, tab.windowId);
      }
    });
    chrome.tabs.onMoved?.addListener((tabId: number) => {
      chrome.tabs.get(tabId, (tab: ChromeTab) => {
        if (!chrome.runtime.lastError && tab?.id != null) {
          this.updateTabProfileContext(tab.id, tab);
        }
      });
    });
    chrome.windows?.onFocusChanged?.addListener((windowId) => {
      if (windowId === chrome.windows?.WINDOW_ID_NONE) {
        return;
      }
      this.updateContextMenuWindowIncognitoFromCurrentTab(true, windowId);
    });
    const tabGroups = chrome.tabGroups as
      | {
          onRemoved?: {
            addListener(callback: (group: {id?: number; windowId?: number}) => void): void;
          };
        }
      | undefined;
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
      this.updateContextMenuWindowIncognitoFromCurrentTab(true);
    });
    const webNavigation = (typeof browser !== 'undefined' ? (browser as unknown as Record<string, unknown>).webNavigation : undefined) as
      | {
          onCommitted?: {addListener(callback: (details: {tabId?: number; url?: string}) => void): void};
          onHistoryStateUpdated?: {addListener(callback: (details: {tabId?: number; url?: string}) => void): void};
          onReferenceFragmentUpdated?: {addListener(callback: (details: {tabId?: number; url?: string}) => void): void};
        }
      | undefined;
    const rememberNavigationUrl = (details: {tabId?: number; url?: string}) => {
      if (typeof details.tabId === 'number' && typeof details.url === 'string') {
        this.updateTabProfileContext(details.tabId, {url: details.url});
      }
    };
    webNavigation?.onCommitted?.addListener(rememberNavigationUrl);
    webNavigation?.onHistoryStateUpdated?.addListener(rememberNavigationUrl);
    webNavigation?.onReferenceFragmentUpdated?.addListener(rememberNavigationUrl);
  }

  private updateTabProfileContext(
    tabId: number,
    tab: Pick<ChromeTab, 'cookieStoreId' | 'groupId' | 'incognito' | 'windowId'> & {pendingUrl?: string; url?: string}
  ) {
    if (isFirefoxContainerId(tab.cookieStoreId)) {
      this.rememberProfileScopeContainer(tab.cookieStoreId);
    }
    this._tabProfileContexts[tabId] = {
      cookieStoreId: typeof tab.cookieStoreId === 'string' ? tab.cookieStoreId : this._tabProfileContexts[tabId]?.cookieStoreId,
      groupId: typeof tab.groupId === 'number' ? tab.groupId : this._tabProfileContexts[tabId]?.groupId,
      incognito: typeof tab.incognito === 'boolean' ? tab.incognito : this._tabProfileContexts[tabId]?.incognito,
      pageUrl:
        typeof tab.pendingUrl === 'string'
          ? tab.pendingUrl
          : typeof tab.url === 'string'
            ? tab.url
            : this._tabProfileContexts[tabId]?.pageUrl,
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
    return api
      .query({})
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
    const sessionStorage = chrome?.storage?.session as
      | {
          get?: (keys: string | string[] | Record<string, unknown> | null) => Promise<Record<string, unknown>>;
        }
      | undefined;
    if (!sessionStorage?.get) {
      return;
    }
    sessionStorage
      .get(null)
      .then((data: Record<string, unknown>) => {
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
      })
      .catch(() => {
        // Session storage may not be available in some contexts
      });
  }

  private saveTabProfileToStorage(tabId: number, profileName?: string) {
    const sessionStorage = chrome?.storage?.session as
      | {
          set?: (items: Record<string, unknown>) => Promise<void>;
          remove?: (keys: string | string[]) => Promise<void>;
        }
      | undefined;
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
    const sessionStorage = chrome?.storage?.session as
      | {
          remove?: (keys: string | string[]) => Promise<void>;
        }
      | undefined;
    if (!sessionStorage?.remove) {
      return;
    }
    sessionStorage.remove(`tabProfile_${tabId}`).catch(() => {
      // Silently ignore storage errors
    });
  }

  private groupProfileKey(windowId?: number, groupId?: number) {
    if (typeof windowId !== 'number' || typeof groupId !== 'number' || groupId === TAB_GROUP_ID_NONE || groupId < 0) {
      return undefined;
    }
    return `${windowId}:${groupId}`;
  }

  private validGroupProfileKey(key: string) {
    return /^\d+:\d+$/.test(key);
  }

  private saveGroupProfileToStorage(groupKey: string, profileName?: string) {
    const sessionStorage = chrome?.storage?.session as
      | {
          set?: (items: Record<string, unknown>) => Promise<void>;
          remove?: (keys: string | string[]) => Promise<void>;
        }
      | undefined;
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
      site: features.indexOf('siteProfileScope') >= 0,
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
      site: scopes.site && capabilities.site,
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
      pageProfile: capabilities.site,
      siteProfile: capabilities.site,
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
    return profileName && ProxyEngine.Profiles.byName(profileName, this._options) ? profileName : undefined;
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

  private isScopeAssignableProfileName(name?: string) {
    return !!name && name.charAt(0) !== '_';
  }

  private localizedProfileName(profile: ContextMenuProfile) {
    return chrome.i18n.getMessage(`profile_${profile.name}`) || profile.name;
  }

  private contextMenuProfileTitle(profile: ContextMenuProfile, useIcons: boolean) {
    const title = this.localizedProfileName(profile);
    if (useIcons) {
      return title;
    }
    const label = PROFILE_CONTEXT_MENU_TYPE_LABELS[profile.profileType || ''];
    return label ? `${label} ${title}` : title;
  }

  private contextMenuGroupedProfileTitle(group: ProfileGroup, profile: ContextMenuProfile, useIcons: boolean) {
    const title = `[${group.name}] ${this.localizedProfileName(profile)}`;
    if (useIcons) {
      return title;
    }
    const label = PROFILE_CONTEXT_MENU_TYPE_LABELS[profile.profileType || ''];
    return label ? `${label} ${title}` : title;
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
      checked ? '<circle cx="17.7" cy="17.7" r="5.1" fill="#198754" stroke="#fff" stroke-width="1.7"/>' : '',
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

  private contextMenuProfilesMatching(acceptName: (name: string) => boolean): ContextMenuProfile[] {
    const profiles: Profile[] = [];
    ProxyEngine.Profiles.each(this._options, (_key: string, profile: Profile) => {
      profiles.push(profile);
    });
    const seen = new Set<string>();
    return profiles
      .filter((profile): profile is ContextMenuProfile => {
        const name = profile.name;
        if (typeof name !== 'string' || !acceptName(name) || seen.has(name)) {
          return false;
        }
        seen.add(name);
        return true;
      })
      .sort((a, b) => this.compareProfile(a, b));
  }

  private createContextMenuProfileItem(options: ContextMenuProfileItemOptions) {
    const baseItem: Record<string, unknown> = {
      id: options.id,
      parentId: options.parentId,
      title: options.title || this.contextMenuProfileTitle(options.profile, options.useIcons),
      contexts: options.contexts
    };
    if (options.documentUrlPatterns) {
      baseItem.documentUrlPatterns = options.documentUrlPatterns;
    }
    if (options.targetUrlPatterns) {
      baseItem.targetUrlPatterns = options.targetUrlPatterns;
    }
    const fallbackItem = options.radio
      ? {
          ...baseItem,
          type: 'radio',
          checked: options.checked === true
        }
      : baseItem;
    return this.createContextMenuItem(
      options.useIcons
        ? {
            ...baseItem,
            icons: this.contextMenuIconForProfile(options.profile, options.checked === true)
          }
        : fallbackItem,
      fallbackItem
    );
  }

  private profileScopeContextMenuProfiles(): ContextMenuProfile[] {
    if (!chrome?.contextMenus || !chrome?.tabs || !chrome?.i18n?.getMessage) {
      return [];
    }
    if (!this._currentProfileName) {
      return [];
    }
    return this.contextMenuProfilesMatching((name) => this.isScopeAssignableProfileName(name));
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
    return this.contextMenuProfilesMatching((name) => this.isVisibleResultProfileName(name));
  }

  private profileGroupsEnabled(): boolean {
    return this._options['-profileGroupsEnabled'] === true;
  }

  private profileGroups(): ProfileGroup[] {
    const rawGroups = this._options['-profileGroups'];
    if (!Array.isArray(rawGroups)) {
      return [];
    }
    const seen: Record<string, boolean> = {};
    const groups: ProfileGroup[] = [];
    rawGroups.forEach((rawGroup, index) => {
      if (!rawGroup || typeof rawGroup !== 'object') {
        return;
      }
      const group = rawGroup as Record<string, unknown>;
      const id = typeof group.id === 'string' ? group.id.trim() : '';
      const name = typeof group.name === 'string' ? group.name.trim() : '';
      if (!id || !name || seen[id]) {
        return;
      }
      seen[id] = true;
      groups.push({
        color: typeof group.color === 'string' ? group.color : undefined,
        icon: typeof group.icon === 'string' ? group.icon : undefined,
        id,
        name,
        order: typeof group.order === 'number' ? group.order : index
      });
    });
    return groups.sort((a, b) => {
      return a.name.localeCompare(b.name);
    });
  }

  private splitContextMenuProfiles(profiles: ContextMenuProfile[], activeProfileName?: string): ContextMenuProfileGroups {
    const visible: ContextMenuProfile[] = [];
    const hidden: ContextMenuProfile[] = [];
    const groupProfiles: Record<string, ContextMenuProfile[]> = {};
    const groups = this.profileGroups();
    const groupIds: Record<string, boolean> = {};
    groups.forEach((group) => {
      groupIds[group.id] = true;
    });
    const groupsEnabled = this.profileGroupsEnabled();
    for (const profile of profiles) {
      const groupId = typeof profile.profileGroupId === 'string' ? profile.profileGroupId : '';
      if (groupsEnabled && profile.profileGroupEnabled === true && groupIds[groupId]) {
        (groupProfiles[groupId] ||= []).push(profile);
        continue;
      }
      if (profile.hiddenInContextMenu === true && profile.name !== activeProfileName) {
        hidden.push(profile);
      } else {
        visible.push(profile);
      }
    }
    return {
      groups: groups
        .filter((group) => groupProfiles[group.id]?.length)
        .map((group) => ({
          ...group,
          profiles: groupProfiles[group.id]
        })),
      hidden,
      visible
    };
  }

  private removeContextMenuItems(ids: string[]) {
    const contextMenus = chrome.contextMenus;
    if (!ids.length || contextMenus == null) {
      return Promise.resolve();
    }
    return Promise.all(
      ids.map(
        (id) =>
          new Promise<void>((resolve) => {
            try {
              contextMenus.remove(id, () => {
                chrome.runtime.lastError;
                resolve();
              });
            } catch (_error) {
              resolve();
            }
          })
      )
    ).then(() => undefined);
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
    const browserRuntime = (typeof browser !== 'undefined' ? browser.runtime : undefined) as
      | {
          getBrowserInfo?: () => Promise<unknown>;
        }
      | undefined;
    return typeof browserRuntime?.getBrowserInfo === 'function';
  }

  private createContextMenuItem(properties: Record<string, unknown>, fallbackProperties?: Record<string, unknown>) {
    const contextMenus = chrome.contextMenus;
    if (contextMenus == null) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      try {
        contextMenus.create(properties, () => {
          const error = chrome.runtime.lastError;
          if (!error) {
            resolve();
            return;
          }
          if (properties.icons == null) {
            this.log.error('Creating context menu item failed.', error.message || error);
            resolve();
            return;
          }
          this.log.error('Creating context menu item with icons failed; retrying without icons.', error.message || error);
          const fallback = {
            ...(fallbackProperties || properties)
          };
          delete fallback.icons;
          try {
            contextMenus.create(fallback, () => {
              chrome.runtime.lastError;
              resolve();
            });
          } catch (_error) {
            resolve();
          }
        });
      } catch (error) {
        this.log.error('Creating context menu item failed.', error);
        resolve();
      }
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
    return this._linkProfileContextMenuRefreshQueue.request(async () => {
      const contextMenuOptions = this.contextMenuOptions();
      const roots = LINK_PROFILE_CONTEXT_MENU_ROOTS.filter((root) => contextMenuOptions[root.optionKey]);
      const profiles = roots.length ? this.linkProfileContextMenuProfiles() : [];
      const oldIds = this._linkProfileContextMenuIds;
      this._linkProfileContextMenuIds = [];
      this._linkProfileContextMenuSelections = {};
      await this.removeContextMenuItems(oldIds);
      if (token !== this._linkProfileContextMenuRefreshToken || profiles.length === 0) {
        return;
      }
      const nextIds: string[] = [];
      const nextSelections: Record<string, LinkProfileContextMenuSelection> = {};
      const creations: Promise<void>[] = [];
      const useIcons = this.contextMenuItemIconsSupported();
      for (const root of roots) {
        const profileGroups = this.splitContextMenuProfiles(profiles);
        creations.push(
          this.createContextMenuItem({
            id: root.id,
            title: chrome.i18n.getMessage(root.titleKey) || root.fallbackTitle,
            contexts: ['link'],
            targetUrlPatterns: WEB_LINK_PATTERNS
          })
        );
        nextIds.push(root.id);
        profileGroups.visible.forEach((profile, index) => {
          const id = `${root.itemPrefix}${index}`;
          nextIds.push(id);
          nextSelections[id] = {
            profileName: profile.name,
            target: root.target
          };
          creations.push(
            this.createContextMenuProfileItem({
              id,
              parentId: root.id,
              profile,
              contexts: ['link'],
              targetUrlPatterns: WEB_LINK_PATTERNS,
              useIcons
            })
          );
        });
        profileGroups.groups.forEach((group, groupIndex) => {
          const groupRootId = `${root.id}:group:${groupIndex}`;
          const groupItemPrefix = `${root.itemPrefix}group:${groupIndex}:`;
          nextIds.push(groupRootId);
          creations.push(
            this.createContextMenuItem({
              id: groupRootId,
              parentId: root.id,
              title: group.name,
              contexts: ['link'],
              targetUrlPatterns: WEB_LINK_PATTERNS
            })
          );
          group.profiles.forEach((profile, index) => {
            const id = `${groupItemPrefix}${index}`;
            nextIds.push(id);
            nextSelections[id] = {
              profileName: profile.name,
              target: root.target
            };
            creations.push(
              this.createContextMenuProfileItem({
                id,
                parentId: groupRootId,
                profile,
                contexts: ['link'],
                targetUrlPatterns: WEB_LINK_PATTERNS,
                useIcons
              })
            );
          });
        });
        if (profileGroups.hidden.length > 0) {
          const hiddenRootId = `${root.id}:hidden`;
          const hiddenItemPrefix = `${root.itemPrefix}hidden:`;
          nextIds.push(hiddenRootId);
          creations.push(
            this.createContextMenuItem({
              id: hiddenRootId,
              parentId: root.id,
              title: chrome.i18n.getMessage('popup_hiddenProfilesMenu') || 'Hidden',
              contexts: ['link'],
              targetUrlPatterns: WEB_LINK_PATTERNS
            })
          );
          profileGroups.hidden.forEach((profile, index) => {
            const id = `${hiddenItemPrefix}${index}`;
            nextIds.push(id);
            nextSelections[id] = {
              profileName: profile.name,
              target: root.target
            };
            creations.push(
              this.createContextMenuProfileItem({
                id,
                parentId: hiddenRootId,
                profile,
                contexts: ['link'],
                targetUrlPatterns: WEB_LINK_PATTERNS,
                useIcons
              })
            );
          });
        }
      }
      this._linkProfileContextMenuIds = nextIds;
      this._linkProfileContextMenuSelections = nextSelections;
      await Promise.all(creations);
    });
  }

  private updateSwitchProfileContextMenu() {
    const contextMenus = chrome.contextMenus;
    if (contextMenus == null || chrome.i18n?.getMessage == null) {
      return;
    }
    this.ensureLinkProfileContextMenuClickListener();
    const token = ++this._switchProfileContextMenuRefreshToken;
    return this._switchProfileContextMenuRefreshQueue.request(async () => {
      const profiles = this.switchProfileContextMenuProfiles();
      const oldIds = this._switchProfileContextMenuIds;
      this._switchProfileContextMenuIds = [];
      this._switchProfileContextMenuProfiles = {};
      await this.removeContextMenuItems(oldIds);
      if (token !== this._switchProfileContextMenuRefreshToken || profiles.length === 0) {
        return;
      }
      const creations: Promise<void>[] = [];
      creations.push(
        this.createContextMenuItem({
          id: SWITCH_PROFILE_CONTEXT_MENU_ROOT_ID,
          title: chrome.i18n.getMessage('contextMenu_switchProfile') || 'Switch Profile',
          contexts: ['page'],
          documentUrlPatterns: WEB_LINK_PATTERNS
        })
      );
      const nextIds = [SWITCH_PROFILE_CONTEXT_MENU_ROOT_ID];
      const nextProfiles: Record<string, string> = {};
      const useIcons = this.contextMenuItemIconsSupported();
      const profileGroups = this.splitContextMenuProfiles(profiles, this._currentProfileName);
      profileGroups.visible.forEach((profile, index) => {
        const id = `${SWITCH_PROFILE_CONTEXT_MENU_ITEM_PREFIX}${index}`;
        const checked = profile.name === this._currentProfileName;
        nextIds.push(id);
        nextProfiles[id] = profile.name;
        creations.push(
          this.createContextMenuProfileItem({
            id,
            parentId: SWITCH_PROFILE_CONTEXT_MENU_ROOT_ID,
            profile,
            checked,
            contexts: ['page'],
            documentUrlPatterns: WEB_LINK_PATTERNS,
            radio: true,
            useIcons
          })
        );
      });
      const activeGroup = profileGroups.groups.find((group) => group.profiles.some((profile) => profile.name === this._currentProfileName));
      const activeGroupedProfile = activeGroup?.profiles.find((profile) => profile.name === this._currentProfileName);
      if (activeGroup && activeGroupedProfile) {
        const id = `${SWITCH_PROFILE_CONTEXT_MENU_ROOT_ID}:groupedCurrent`;
        nextIds.push(id);
        nextProfiles[id] = activeGroupedProfile.name;
        creations.push(
          this.createContextMenuProfileItem({
            id,
            parentId: SWITCH_PROFILE_CONTEXT_MENU_ROOT_ID,
            profile: activeGroupedProfile,
            checked: true,
            contexts: ['page'],
            documentUrlPatterns: WEB_LINK_PATTERNS,
            radio: true,
            title: this.contextMenuGroupedProfileTitle(activeGroup, activeGroupedProfile, useIcons),
            useIcons
          })
        );
      }
      profileGroups.groups.forEach((group, groupIndex) => {
        const groupRootId = `${SWITCH_PROFILE_CONTEXT_MENU_ROOT_ID}:group:${groupIndex}`;
        const groupItemPrefix = `${SWITCH_PROFILE_CONTEXT_MENU_ITEM_PREFIX}group:${groupIndex}:`;
        nextIds.push(groupRootId);
        creations.push(
          this.createContextMenuItem({
            id: groupRootId,
            parentId: SWITCH_PROFILE_CONTEXT_MENU_ROOT_ID,
            title: group.name,
            contexts: ['page'],
            documentUrlPatterns: WEB_LINK_PATTERNS
          })
        );
        group.profiles.forEach((profile, index) => {
          const id = `${groupItemPrefix}${index}`;
          nextIds.push(id);
          nextProfiles[id] = profile.name;
          creations.push(
            this.createContextMenuProfileItem({
              id,
              parentId: groupRootId,
              profile,
              checked: profile.name === this._currentProfileName,
              contexts: ['page'],
              documentUrlPatterns: WEB_LINK_PATTERNS,
              radio: true,
              useIcons
            })
          );
        });
      });
      if (profileGroups.hidden.length > 0) {
        nextIds.push(SWITCH_PROFILE_HIDDEN_CONTEXT_MENU_ROOT_ID);
        creations.push(
          this.createContextMenuItem({
            id: SWITCH_PROFILE_HIDDEN_CONTEXT_MENU_ROOT_ID,
            parentId: SWITCH_PROFILE_CONTEXT_MENU_ROOT_ID,
            title: chrome.i18n.getMessage('popup_hiddenProfilesMenu') || 'Hidden',
            contexts: ['page'],
            documentUrlPatterns: WEB_LINK_PATTERNS
          })
        );
        profileGroups.hidden.forEach((profile, index) => {
          const id = `${SWITCH_PROFILE_HIDDEN_CONTEXT_MENU_ITEM_PREFIX}${index}`;
          nextIds.push(id);
          nextProfiles[id] = profile.name;
          creations.push(
            this.createContextMenuProfileItem({
              id,
              parentId: SWITCH_PROFILE_HIDDEN_CONTEXT_MENU_ROOT_ID,
              profile,
              contexts: ['page'],
              documentUrlPatterns: WEB_LINK_PATTERNS,
              useIcons
            })
          );
        });
      }
      this._switchProfileContextMenuIds = nextIds;
      this._switchProfileContextMenuProfiles = nextProfiles;
      await Promise.all(creations);
    });
  }

  private profileScopeContextMenuTargets(tab: ChromeTab): ProfileScopeContextMenuTarget[] {
    if (tab.id == null) {
      return [];
    }
    this.updateTabProfileContext(tab.id, tab);
    const url = tab.pendingUrl || tab.url;
    const profileScope = this.getProfileScopeInfo({
      cookieStoreId: tab.cookieStoreId,
      groupId: tab.groupId,
      incognito: tab.incognito,
      tabId: tab.id,
      url,
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
    if (
      contextMenuOptions.pageProfile &&
      profileScope.enabled.site &&
      isScopeRequestUrl(url) &&
      (!profileScope.pageProfileName || profileScope.pageQuickProfileName)
    ) {
      targets.push({
        activeProfileName: profileScope.pageQuickProfileName,
        clearId: CLEAR_PAGE_PROFILE_CONTEXT_MENU_ID,
        clearable: Boolean(profileScope.pageQuickProfileName),
        fallbackTitle: 'Use Profile for This Page',
        itemPrefix: PAGE_PROFILE_CONTEXT_MENU_ITEM_PREFIX,
        rootId: PAGE_PROFILE_CONTEXT_MENU_ROOT_ID,
        setArgs: {
          scope: 'page',
          tabId: profileScope.tabId,
          url
        },
        titleKey: 'contextMenu_useProfileForThisPage'
      });
    }
    if (
      contextMenuOptions.siteProfile &&
      profileScope.enabled.site &&
      isScopeRequestUrl(url) &&
      (!profileScope.siteProfileName || profileScope.siteQuickProfileName)
    ) {
      targets.push({
        activeProfileName: profileScope.siteQuickProfileName,
        clearId: CLEAR_SITE_PROFILE_CONTEXT_MENU_ID,
        clearable: Boolean(profileScope.siteQuickProfileName),
        fallbackTitle: 'Use Profile for This Site',
        itemPrefix: SITE_PROFILE_CONTEXT_MENU_ITEM_PREFIX,
        rootId: SITE_PROFILE_CONTEXT_MENU_ROOT_ID,
        setArgs: {
          scope: 'site',
          tabId: profileScope.tabId,
          url
        },
        titleKey: 'contextMenu_useProfileForThisSite'
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
    const creations: Promise<void>[] = [];
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
    creations.push(this.createContextMenuItem(rootItem));
    if (target.clearable ?? Boolean(target.activeProfileName)) {
      nextIds.push(target.clearId);
      nextSelections[target.clearId] = target.setArgs;
      creations.push(
        this.createContextMenuItem({
          id: target.clearId,
          parentId: target.rootId,
          title: chrome.i18n.getMessage('popup_profileScopeUseDefault') || 'Use Default',
          contexts: ['page'],
          documentUrlPatterns: WEB_LINK_PATTERNS
        })
      );
    }
    profileGroups.visible.forEach((profile, index) => {
      const id = `${target.itemPrefix}${index}`;
      const checked = profile.name === target.activeProfileName;
      nextIds.push(id);
      nextSelections[id] = {
        ...target.setArgs,
        profileName: profile.name
      };
      creations.push(
        this.createContextMenuProfileItem({
          id,
          parentId: target.rootId,
          profile,
          checked,
          contexts: ['page'],
          documentUrlPatterns: WEB_LINK_PATTERNS,
          radio: true,
          useIcons
        })
      );
    });
    profileGroups.groups.forEach((group, groupIndex) => {
      const groupRootId = `${target.rootId}:group:${groupIndex}`;
      const groupItemPrefix = `${target.itemPrefix}group:${groupIndex}:`;
      nextIds.push(groupRootId);
      creations.push(
        this.createContextMenuItem({
          id: groupRootId,
          parentId: target.rootId,
          title: group.name,
          contexts: ['page'],
          documentUrlPatterns: WEB_LINK_PATTERNS
        })
      );
      group.profiles.forEach((profile, index) => {
        const id = `${groupItemPrefix}${index}`;
        nextIds.push(id);
        nextSelections[id] = {
          ...target.setArgs,
          profileName: profile.name
        };
        creations.push(
          this.createContextMenuProfileItem({
            id,
            parentId: groupRootId,
            profile,
            checked: profile.name === target.activeProfileName,
            contexts: ['page'],
            documentUrlPatterns: WEB_LINK_PATTERNS,
            radio: true,
            useIcons
          })
        );
      });
    });
    if (profileGroups.hidden.length > 0) {
      const hiddenRootId = `${target.rootId}:hidden`;
      const hiddenItemPrefix = `${target.itemPrefix}hidden:`;
      nextIds.push(hiddenRootId);
      creations.push(
        this.createContextMenuItem({
          id: hiddenRootId,
          parentId: target.rootId,
          title: chrome.i18n.getMessage('popup_hiddenProfilesMenu') || 'Hidden',
          contexts: ['page'],
          documentUrlPatterns: WEB_LINK_PATTERNS
        })
      );
      profileGroups.hidden.forEach((profile, index) => {
        const id = `${hiddenItemPrefix}${index}`;
        nextIds.push(id);
        nextSelections[id] = {
          ...target.setArgs,
          profileName: profile.name
        };
        creations.push(
          this.createContextMenuProfileItem({
            id,
            parentId: hiddenRootId,
            profile,
            contexts: ['page'],
            documentUrlPatterns: WEB_LINK_PATTERNS,
            useIcons
          })
        );
      });
    }
    return creations;
  }

  private useStaticWindowProfileContextMenu() {
    const capabilities = this.profileScopeCapabilities();
    return (
      capabilities.window &&
      !capabilities.tab &&
      !capabilities.group &&
      !capabilities.container &&
      !capabilities.site &&
      !this.contextMenuItemIconsSupported()
    );
  }

  private staticWindowProfileContextMenuSignature(profiles: ContextMenuProfile[], targets: ProfileScopeContextMenuTarget[]) {
    return JSON.stringify({
      profileGroups: this.profileGroups(),
      profileGroupsEnabled: this.profileGroupsEnabled(),
      profiles: profiles.map((profile) => [
        profile.name,
        profile.hiddenInContextMenu === true,
        profile.profileGroupEnabled === true,
        typeof profile.profileGroupId === 'string' ? profile.profileGroupId : ''
      ]),
      targets: targets.map((target) => [target.rootId, target.activeProfileName || ''])
    });
  }

  private contextMenuTabIncognito(tab?: ChromeTab) {
    if (typeof tab?.incognito === 'boolean') {
      return tab.incognito;
    }
    if (typeof tab?.id === 'number') {
      const cached = this._tabProfileContexts[tab.id]?.incognito;
      if (typeof cached === 'boolean') {
        return cached;
      }
    }
    return this._contextMenuWindowIncognito;
  }

  private contextMenuWindowId(tab?: ChromeTab) {
    return typeof tab?.windowId === 'number'
      ? tab.windowId
      : typeof tab?.id === 'number'
        ? this._tabProfileContexts[tab.id]?.windowId
        : undefined;
  }

  private rememberContextMenuWindowIncognito(privateWindow: boolean, refreshStaticMenu = false) {
    this._contextMenuWindowIncognito = privateWindow;
    if (refreshStaticMenu && this.useStaticWindowProfileContextMenu() && this._profileScopeContextMenuIds.length > 0) {
      this.updateStaticWindowProfileContextMenuVisibility(privateWindow);
    }
  }

  private getContextMenuWindow(windowId: number, callback: (window?: ChromeWindow) => void) {
    const windowsApi = chrome?.windows;
    if (typeof windowId !== 'number' || typeof windowsApi?.get !== 'function') {
      callback();
      return;
    }
    try {
      windowsApi.get.call(windowsApi, windowId, {populate: false}, (window) => {
        callback(chrome.runtime.lastError ? undefined : window);
      });
    } catch (_error) {
      callback();
    }
  }

  private getLastFocusedContextMenuWindow(callback: (window?: ChromeWindow) => void) {
    const windowsApi = chrome?.windows;
    if (typeof windowsApi?.getLastFocused !== 'function') {
      callback();
      return;
    }
    try {
      windowsApi.getLastFocused.call(windowsApi, {populate: false}, (window) => {
        callback(chrome.runtime.lastError ? undefined : window);
      });
    } catch (_error) {
      callback();
    }
  }

  private queryCurrentContextMenuTab(callback: (tab?: ChromeTab) => void) {
    const tabsApi = chrome?.tabs;
    if (typeof tabsApi?.query !== 'function') {
      callback();
      return;
    }
    try {
      tabsApi.query.call(tabsApi, {active: true, lastFocusedWindow: true}, (tabs: ChromeTab[]) => {
        callback(chrome.runtime.lastError ? undefined : tabs[0]);
      });
    } catch (_error) {
      callback();
    }
  }

  private resolveContextMenuWindowIncognitoForWindowId(windowId: number, fallback: boolean, callback: (privateWindow: boolean) => void) {
    this.getContextMenuWindow(windowId, (window) => {
      if (typeof window?.incognito === 'boolean') {
        this.rememberContextMenuWindowIncognito(window.incognito);
        callback(window.incognito);
        return;
      }
      callback(fallback);
    });
  }

  private resolveLastFocusedContextMenuWindowIncognito(fallback: boolean, callback: (privateWindow: boolean) => void) {
    this.getLastFocusedContextMenuWindow((window) => {
      if (typeof window?.incognito === 'boolean') {
        this.rememberContextMenuWindowIncognito(window.incognito);
        callback(window.incognito);
        return;
      }
      callback(fallback);
    });
  }

  private getCurrentContextMenuTab(callback: (tab?: ChromeTab) => void) {
    this.queryCurrentContextMenuTab((activeTab) => {
      if (activeTab?.id != null) {
        this.updateTabProfileContext(activeTab.id, activeTab);
      }
      callback(activeTab);
    });
  }

  private resolveContextMenuTabWindowIncognito(tab: ChromeTab | undefined, callback: (privateWindow: boolean) => void) {
    const fallback = this.contextMenuTabIncognito(tab);
    if (typeof tab?.incognito === 'boolean') {
      this.rememberContextMenuWindowIncognito(tab.incognito);
      callback(tab.incognito);
      return;
    }
    const windowId = this.contextMenuWindowId(tab);
    if (typeof windowId === 'number') {
      this.resolveContextMenuWindowIncognitoForWindowId(windowId, fallback, (privateWindow) => {
        if (typeof tab?.id === 'number') {
          this.updateTabProfileContext(tab.id, {
            incognito: privateWindow,
            windowId
          });
        }
        callback(privateWindow);
      });
      return;
    }
    callback(fallback);
  }

  private resolveCurrentContextMenuWindowIncognito(hintTab: ChromeTab | undefined, callback: (privateWindow: boolean) => void) {
    this.getCurrentContextMenuTab((currentTab) => {
      const tab = currentTab || hintTab;
      if (tab) {
        this.resolveContextMenuTabWindowIncognito(tab, callback);
        return;
      }
      this.resolveLastFocusedContextMenuWindowIncognito(this._contextMenuWindowIncognito, callback);
    });
  }

  private resolveCurrentContextMenuWindowIncognitoAsync(hintTab: ChromeTab | undefined) {
    return new Promise<boolean>((resolve) => {
      this.resolveCurrentContextMenuWindowIncognito(hintTab, resolve);
    });
  }

  private updateContextMenuWindowIncognitoFromCurrentTab(refreshStaticMenu = false, hintWindowId?: number) {
    this.getCurrentContextMenuTab((tab) => {
      const apply = (privateWindow: boolean) => {
        this.rememberContextMenuWindowIncognito(privateWindow, refreshStaticMenu);
      };
      if (tab) {
        this.resolveContextMenuTabWindowIncognito(tab, apply);
        return;
      }
      if (typeof hintWindowId === 'number') {
        this.resolveContextMenuWindowIncognitoForWindowId(hintWindowId, this._contextMenuWindowIncognito, apply);
        return;
      }
      this.resolveLastFocusedContextMenuWindowIncognito(this._contextMenuWindowIncognito, apply);
    });
  }

  private updateStaticWindowProfileContextMenuVisibility(privateWindow: boolean) {
    let remaining = 2;
    const done = () => {
      remaining--;
      if (remaining === 0) {
        this.refreshContextMenuItems();
      }
    };
    this.updateContextMenuItem(
      NORMAL_WINDOW_PROFILE_CONTEXT_MENU_ROOT_ID,
      {
        visible: !privateWindow
      },
      done
    );
    this.updateContextMenuItem(
      PRIVATE_WINDOW_PROFILE_CONTEXT_MENU_ROOT_ID,
      {
        visible: privateWindow
      },
      done
    );
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
      this.resolveCurrentContextMenuWindowIncognito(tab, (privateWindow) => {
        this.updateStaticWindowProfileContextMenuVisibility(privateWindow);
      });
      return;
    }
    const token = ++this._profileScopeContextMenuRefreshToken;
    return this._profileScopeContextMenuRefreshQueue.request(async () => {
      const oldIds = this._profileScopeContextMenuIds;
      this._profileScopeContextMenuIds = [];
      this._profileScopeContextMenuSelections = {};
      this._profileScopeContextMenuSignature = '';
      await this.removeContextMenuItems(oldIds);
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
      const privateWindow = await this.resolveCurrentContextMenuWindowIncognitoAsync(tab);
      if (token !== this._profileScopeContextMenuRefreshToken) {
        return;
      }
      const creations: Promise<void>[] = [];
      for (const target of targets) {
        const visible = privateWindow ? target.setArgs.scope === 'private' : target.setArgs.scope === 'normal';
        creations.push(...this.createProfileScopeContextMenuTarget(target, profiles, nextIds, nextSelections, visible));
      }
      this._profileScopeContextMenuIds = nextIds;
      this._profileScopeContextMenuSelections = nextSelections;
      this._profileScopeContextMenuSignature = signature;
      await Promise.all(creations);
      this.refreshContextMenuItems();
    });
  }

  private updateProfileScopeContextMenuForTab(tab?: ChromeTab, options: ProfileScopeContextMenuUpdateOptions = {}) {
    const contextMenus = chrome.contextMenus;
    if (contextMenus == null || chrome.i18n?.getMessage == null) {
      return;
    }
    if (this.useStaticWindowProfileContextMenu()) {
      return this.updateStaticWindowProfileContextMenuForTab(tab, options);
    }
    this.ensureLinkProfileContextMenuClickListener();
    const token = ++this._profileScopeContextMenuRefreshToken;
    return this._profileScopeContextMenuRefreshQueue.request(async () => {
      const profiles = this.profileScopeContextMenuProfiles();
      const oldIds = this._profileScopeContextMenuIds;
      this._profileScopeContextMenuIds = [];
      this._profileScopeContextMenuSelections = {};
      this._profileScopeContextMenuSignature = '';
      await this.removeContextMenuItems(oldIds);
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
      const creations: Promise<void>[] = [];
      for (const target of targets) {
        creations.push(...this.createProfileScopeContextMenuTarget(target, profiles, nextIds, nextSelections));
      }
      this._profileScopeContextMenuIds = nextIds;
      this._profileScopeContextMenuSelections = nextSelections;
      await Promise.all(creations);
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
    const browserWindows = (typeof browser !== 'undefined' ? browser.windows : undefined) as
      | {
          create?: (properties: Record<string, unknown>) => Promise<ChromeWindow>;
        }
      | undefined;
    if (browserWindows?.create) {
      return browserWindows.create(properties);
    }
    const chromeWindows = chrome?.windows as
      | {
          create?: (properties: Record<string, unknown>, callback?: (...args: unknown[]) => void) => void;
        }
      | undefined;
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
    chrome.tabs.reload(
      tab.id,
      {
        bypassCache: true
      },
      () => {
        chrome.runtime.lastError;
      }
    );
  }

  private async refreshWebRequestHandlerBehavior() {
    try {
      const browserWebRequest = (typeof browser !== 'undefined' ? browser.webRequest : undefined) as
        | {
            handlerBehaviorChanged?: () => Promise<void>;
          }
        | undefined;
      const chromeWebRequest = chrome?.webRequest as
        | {
            handlerBehaviorChanged?: (callback?: () => void) => Promise<void> | void;
          }
        | undefined;
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
    await Promise.resolve(
      this.setProfileScope({
        profileName,
        scope: 'tab',
        tabId
      })
    );
    await this.refreshWebRequestHandlerBehavior();
    await this.updateTab(tabId, {
      url: linkUrl
    });
  }

  private _onLinkProfileContextMenuClicked(info: ChromeContextMenuClickInfo, tab: ChromeTab | undefined) {
    const switchProfileName = this._switchProfileContextMenuProfiles[info.menuItemId];
    if (switchProfileName) {
      this.applyProfile(switchProfileName)
        .then(() => {
          this.reloadContextMenuTabIfEnabled(tab);
        })
        .catch((error: unknown) => {
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
        const setScope = (scopeSelection: ProfileScopeContextMenuSelection) => {
          this.setProfileScope(scopeSelection)
            .then(() => {
              this.reloadContextMenuTabIfEnabled(currentTab);
              this.updateProfileScopeContextMenuForTab(currentTab);
            })
            .catch((error: unknown) => {
              this.log.error('Failed to set profile scope from context menu.', error);
            });
        };
        if (this.useStaticWindowProfileContextMenu() && (selection.scope === 'normal' || selection.scope === 'private')) {
          this.resolveCurrentContextMenuWindowIncognito(currentTab, (privateWindow) => {
            setScope({
              ...selection,
              scope: privateWindow ? 'private' : 'normal'
            });
          });
          return;
        }
        setScope(
          selection.scope === 'page' || selection.scope === 'site'
            ? {
                ...selection,
                url: currentTab.pendingUrl || currentTab.url || selection.url
              }
            : selection
        );
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

  private scopeContext(
    args: ProfileScopeInfoArgs | ProxyRequestDetails
  ): Required<Pick<ProfileScopeInfoArgs, 'tabId'>> & TabProfileContext {
    const tabId = typeof args.tabId === 'number' ? args.tabId : -1;
    const cached = tabId >= 0 ? this._tabProfileContexts[tabId] : undefined;
    const requestType = typeof (args as Record<string, unknown>).type === 'string' ? String((args as Record<string, unknown>).type) : '';
    const isProxyRequest = Object.prototype.hasOwnProperty.call(args, 'url') && requestType !== '';
    const explicitUrl = typeof args.url === 'string' ? args.url : undefined;
    const pageUrl = isProxyRequest ? (requestType === 'main_frame' ? explicitUrl : cached?.pageUrl) : explicitUrl || cached?.pageUrl;
    const context = {
      tabId,
      cookieStoreId: typeof args.cookieStoreId === 'string' ? args.cookieStoreId : cached?.cookieStoreId,
      groupId: typeof args.groupId === 'number' ? args.groupId : cached?.groupId,
      incognito: typeof args.incognito === 'boolean' ? args.incognito : cached?.incognito,
      pageUrl,
      windowId: typeof args.windowId === 'number' ? args.windowId : cached?.windowId
    };
    if (tabId >= 0) {
      this._tabProfileContexts[tabId] = {
        cookieStoreId: context.cookieStoreId,
        groupId: context.groupId,
        incognito: context.incognito,
        pageUrl: context.pageUrl,
        windowId: context.windowId
      };
    }
    return context;
  }

  private matchingProfileScopeRule(pageUrl?: string, target?: 'page' | 'site') {
    const normalized = scopeUrl(pageUrl);
    if (!normalized) {
      return undefined;
    }
    const request = ProxyEngine.Conditions.requestFromUrl(normalized);
    const assignments = this.profileScopeAssignments();
    for (const rule of assignments.rules) {
      const profileName = this.validProfileName(rule.profileName);
      if (!profileName || !rule.condition || typeof rule.condition.conditionType !== 'string') {
        continue;
      }
      const scope = profileScopeRuleTarget(rule);
      if (target && scope !== target) {
        continue;
      }
      try {
        if (ProxyEngine.Conditions.match(rule.condition, request)) {
          return {
            profileName,
            rule,
            scope
          } as const;
        }
      } catch (_error) {
        // Ignore malformed user-entered conditions and continue with the next rule.
      }
    }
    return undefined;
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
    if (scopes.site) {
      const pageRule = this.matchingProfileScopeRule(context.pageUrl);
      if (pageRule?.profileName) {
        return {
          profileName: pageRule.profileName,
          scope: pageRule.scope
        };
      }
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
    return ProxyEngine.Profiles.byName(profileName, this._options);
  }

  matchProfileFromProfileName(profileName: string, request: Record<string, unknown>) {
    const effectiveOptions = optionsWithProxyExceptions(this._options) as Record<string, unknown>;
    let profile = this.validProfileName(profileName) ? ProxyEngine.Profiles.byName(profileName, effectiveOptions) : null;
    if (!profile) {
      return Promise.reject(new Error(`Profile ${profileName} does not exist!`));
    }
    const results: unknown[] = [];
    let currentProfile = profile;
    let lastProfile = profile;
    while (currentProfile) {
      lastProfile = currentProfile;
      const result = ProxyEngine.Profiles.match(currentProfile, request);
      if (result == null) {
        break;
      }
      results.push(result);
      let next;
      if (Array.isArray(result)) {
        next = result[0];
      } else if (result.profileName) {
        next = ProxyEngine.Profiles.nameAsKey(result.profileName);
      } else {
        break;
      }
      currentProfile = ProxyEngine.Profiles.byKey(next, effectiveOptions);
    }
    return Promise.resolve({
      profile: lastProfile,
      results
    });
  }

  matchProfile(request: Record<string, unknown>) {
    const originalOptions = this._options;
    this._options = optionsWithProxyExceptions(originalOptions) as Record<string, unknown>;
    try {
      return (
        ExtensionRuntime.Options.prototype as unknown as {
          matchProfile(this: ChromeOptions, request: Record<string, unknown>): ReturnType<ChromeOptions['matchProfileFromProfileName']>;
        }
      ).matchProfile.call(this, request);
    } finally {
      this._options = originalOptions;
    }
  }

  explainRequest(input?: string | Record<string, unknown>) {
    const originalOptions = this._options;
    this._options = optionsWithProxyExceptions(originalOptions) as Record<string, unknown>;
    try {
      return super.explainRequest(input);
    } finally {
      this._options = originalOptions;
    }
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
    for (const rule of assignments.rules) {
      if (this.validProfileName(rule.profileName)) {
        names.add(rule.profileName);
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
    const pageRule = this.matchingProfileScopeRule(context.pageUrl, 'page');
    const siteRule = this.matchingProfileScopeRule(context.pageUrl, 'site');
    const generatedPageRule = profileScopeRuleForTarget('page', context.pageUrl);
    const generatedSiteRule = profileScopeRuleForTarget('site', context.pageUrl);
    const pageProfileName = this.validProfileName(pageRule?.profileName);
    const siteProfileName = this.validProfileName(siteRule?.profileName);
    const pageQuickProfileName =
      pageRule && generatedPageRule && isMatchingQuickProfileScopeRule(pageRule.rule, 'page', generatedPageRule)
        ? pageProfileName
        : undefined;
    const siteQuickProfileName =
      siteRule && generatedSiteRule && isMatchingQuickProfileScopeRule(siteRule.rule, 'site', generatedSiteRule)
        ? siteProfileName
        : undefined;
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
      pageProfileName,
      pageQuickProfileName,
      pageUrl: scopeUrl(context.pageUrl),
      siteProfileName,
      siteQuickProfileName,
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
      return Promise.reject(new Error(`Profile ${args.profileName} does not exist!`));
    }
    if (args.scope === 'tab') {
      if (!capabilities.tab || !scopes.tab || args.tabId == null) {
        return Promise.resolve();
      }
      if (profileName) {
        this._tabProfileNames[args.tabId] = profileName;
      } else {
        delete this._tabProfileNames[args.tabId];
      }
      this.saveTabProfileToStorage(args.tabId, profileName);
      return this._currentProfileName ? this.applyProfile(this._currentProfileName, {update: false}) : Promise.resolve();
    }
    if (args.scope === 'group') {
      if (!capabilities.group || !scopes.group) {
        return Promise.resolve();
      }
      const groupKey = this.groupProfileKey(args.windowId, args.groupId);
      if (!groupKey) {
        return Promise.resolve();
      }
      if (profileName) {
        this._groupProfileNames[groupKey] = profileName;
      } else {
        delete this._groupProfileNames[groupKey];
      }
      this.saveGroupProfileToStorage(groupKey, profileName);
      return this._currentProfileName ? this.applyProfile(this._currentProfileName, {update: false}) : Promise.resolve();
    }
    if (args.scope === 'container') {
      if (!capabilities.container || !scopes.container || !isFirefoxContainerId(args.cookieStoreId)) {
        return Promise.resolve();
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
    if (args.scope === 'page' || args.scope === 'site') {
      if (!capabilities.site || !scopes.site) {
        return Promise.resolve();
      }
      const target = args.scope;
      const generated = profileScopeRuleForTarget(target, args.url);
      if (!generated) {
        return Promise.resolve();
      }
      const assignments = this.profileScopeAssignments();
      const matchingRule = this.matchingProfileScopeRule(args.url, target);
      const matchingRuleIsQuick = Boolean(matchingRule && isMatchingQuickProfileScopeRule(matchingRule.rule, target, generated));
      if (!profileName) {
        if (!matchingRuleIsQuick) {
          return Promise.resolve();
        }
        assignments.rules = assignments.rules.filter((rule) => !isMatchingQuickProfileScopeRule(rule, target, generated));
      } else if (matchingRule) {
        if (!matchingRuleIsQuick) {
          return Promise.resolve();
        }
        const index = assignments.rules.findIndex((rule) => isMatchingQuickProfileScopeRule(rule, target, generated));
        if (index < 0) {
          return Promise.resolve();
        }
        assignments.rules[index].profileName = profileName;
      } else {
        const rule: ProfileScopeRule = {
          condition: generated.condition,
          profileName,
          quickKey: generated.key,
          quickTarget: target
        };
        if (target === 'page') {
          assignments.rules.unshift(rule);
        } else {
          const normalized = scopeUrl(args.url);
          const request = normalized ? ProxyEngine.Conditions.requestFromUrl(normalized) : undefined;
          let insertIndex = 0;
          if (request) {
            assignments.rules.forEach((candidate, index) => {
              if (profileScopeRuleTarget(candidate) !== 'page' || !this.validProfileName(candidate.profileName)) {
                return;
              }
              try {
                if (ProxyEngine.Conditions.match(candidate.condition, request)) {
                  insertIndex = index + 1;
                }
              } catch (_error) {
                // Ignore malformed Page rules when choosing a safe Site insertion point.
              }
            });
          }
          assignments.rules.splice(insertIndex, 0, rule);
        }
      }
      return this._setOptions({
        '-profileScopeAssignments': assignments
      });
    }
    if (args.scope === 'normal' || args.scope === 'private') {
      if (!capabilities.window || !scopes.window) {
        return Promise.resolve();
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
    return Promise.resolve();
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
      options = this._proxyNotControllable
        ? {
            text: '=',
            color: '#da4f49'
          }
        : {
            text: '?',
            color: '#49afcd'
          };
    }
    chrome.action.setBadgeText(
      {
        text: options.text
      },
      ignoreChromeLastError
    );
    chrome.action.setBadgeBackgroundColor(
      {
        color: options.color
      },
      ignoreChromeLastError
    );
    if (options.title) {
      this._badgeTitle = options.title;
      return chrome.action.setTitle(
        {
          title: options.title
        },
        ignoreChromeLastError
      );
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
      const api = chrome.action;
      if (typeof api.setBadgeText === 'function') {
        api.setBadgeText(
          {
            text: ''
          },
          ignoreChromeLastError
        );
      }
    }
  }

  setQuickSwitch(quickSwitch: string[] | null, canEnable: boolean) {
    this._quickSwitchCanEnable = canEnable;
    if (!this._quickSwitchHandlerReady) {
      this._quickSwitchHandlerReady = true;
      setContextMenuQuickSwitchHandler((info: {checked: boolean}) => {
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
      });
    }
    const api = chrome.action;
    if (quickSwitch || api.setPopup == null) {
      if (typeof api.setPopup === 'function') {
        api.setPopup({
          popup: ''
        });
      }
      if (!this._quickSwitchInit) {
        this._quickSwitchInit = true;
        chrome.action.onClicked.addListener((tab: ChromeTab) => {
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
    return Promise.resolve();
  }

  private clearFailedRequestBadge(tabId: number, info: TabRequestInfo) {
    if (!info.badgeSet) {
      return;
    }
    info.badgeSet = false;
    chrome.action.setBadgeText(
      {
        text: '',
        tabId
      },
      ignoreChromeLastError
    );
  }

  private clearFailedRequestBadges() {
    const tabInfo = this._requestMonitor?.tabInfo || {};
    for (const [tabIdText, info] of Object.entries(tabInfo)) {
      const tabId = Number(tabIdText);
      if (!info || !Number.isInteger(tabId)) {
        continue;
      }
      this.clearFailedRequestBadge(tabId, info);
    }
  }

  private updateFailedRequestBadge(tabId: number, info: TabRequestInfo, errorCount: number) {
    if (!isFailedRequestDetectionEnabled(this._options) || errorCount <= 0) {
      this.clearFailedRequestBadge(tabId, info);
      return;
    }
    info.badgeSet = true;
    chrome.action.setBadgeText(
      {
        text: errorCount.toString(),
        tabId
      },
      ignoreChromeLastError
    );
    chrome.action.setBadgeBackgroundColor(
      {
        color: '#f0ad4e',
        tabId
      },
      ignoreChromeLastError
    );
  }

  private refreshFailedRequestBadges() {
    const tabInfo = this._requestMonitor?.tabInfo || {};
    for (const [tabIdText, info] of Object.entries(tabInfo)) {
      const tabId = Number(tabIdText);
      if (!info || !Number.isInteger(tabId)) {
        continue;
      }
      const failedInfo = effectiveFailedRequestInfo(this._options, info);
      this.updateFailedRequestBadge(tabId, info, failedInfo.errorCount);
    }
  }

  setMonitorWebRequests(enabled: boolean) {
    if (!enabled || !isFailedRequestDetectionEnabled(this._options)) {
      this.clearFailedRequestBadges();
    }
    this._monitorWebRequests = enabled;
    this._requestMonitor?.setEnabled(enabled);
    if (!enabled) {
      this.clearBadge();
    } else if (isFailedRequestDetectionEnabled(this._options)) {
      this.refreshFailedRequestBadges();
    }
    if (enabled && this._requestMonitor == null) {
      this._tabRequestInfoPorts = {};
      const wildcardForReq = (req: {url: string}) => {
        return ProxyEngine.wildcardForUrl(req.url);
      };
      const requestMonitor = new WebRequestMonitor(wildcardForReq);
      this._requestMonitor = requestMonitor;
      requestMonitor.watchTabs((tabId: number, info: TabRequestInfo) => {
        if (!this._monitorWebRequests) {
          return;
        }
        const filteredInfo = effectiveFailedRequestInfo(this._options, info);
        this.updateFailedRequestBadge(tabId, info, filteredInfo.errorCount);
        return this._tabRequestInfoPorts?.[tabId]?.postMessage({
          errorCount: filteredInfo.errorCount,
          summary: filteredInfo.summary
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
            const filteredInfo = effectiveFailedRequestInfo(this._options, info);
            return port.postMessage({
              errorCount: filteredInfo.errorCount,
              summary: filteredInfo.summary
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
    name = `task.${name}`;
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
    return Promise.resolve();
  }

  printFixedProfile(profile: Profile) {
    if (profile.profileType !== 'FixedProfile') {
      return undefined;
    }
    let result = '';
    for (const scheme of ProxyEngine.Profiles.schemes) {
      if (!profile[scheme.prop]) {
        continue;
      }
      const pacResult = ProxyEngine.Profiles.pacResult(profile[scheme.prop]);
      if (scheme.scheme) {
        result += `${scheme.scheme}: ${pacResult}\n`;
      } else {
        result += `${pacResult}\n`;
      }
    }
    result || (result = chrome.i18n.getMessage('toolbarIconTooltip_profileDetails_DirectProfile'));
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
    return chrome.i18n.getMessage(`toolbarIconTooltip_profileDetails_${type}`) || null;
  }

  upgrade(options: UpgradeOptions | null | undefined, changes?: Record<string, unknown>) {
    if (options == null || Object.keys(options).length === 0 || options.schema == null) {
      return Promise.reject(new ExtensionRuntime.Options.NoOptionsError());
    }
    return super.upgrade(options, changes).then((upgradeResult: unknown) => {
      const [upgradedOptions, upgradedChanges] = upgradeResult as [Record<string, unknown>, Record<string, unknown>];
      if (this.proxyImpl.proxyDnsCapabilities.socks5) {
        return [upgradedOptions, upgradedChanges];
      }
      ProxyEngine.Profiles.each(upgradedOptions, (key: string, profile: Profile) => {
        if (!normalizeSocks5LocalDnsProfile(profile)) {
          return;
        }
        ProxyEngine.Profiles.updateRevision(profile);
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
    const routeInfoEnabled = isRouteInfoEnabled(this._options);
    const failedRequestDetectionEnabled = isFailedRequestDetectionEnabled(this._options);
    const routeInfoRequestDetailsEnabled = routeInfoEnabled && isRouteInfoRequestDetailsEnabled(this._options);
    const tabInfo = failedRequestDetectionEnabled || routeInfoRequestDetailsEnabled ? this._requestMonitor?.tabInfo[tabId] : undefined;
    const networkRequestIgnoreList = normalizeNetworkRequestIgnoreList(this._options[NETWORK_REQUEST_IGNORE_LIST_KEY]);
    const networkRequestIgnoreListEnabled = failedRequestDetectionEnabled && isNetworkRequestIgnoreListEnabled(this._options);
    const effectiveIgnoreList = networkRequestIgnoreListEnabled ? networkRequestIgnoreList : [];
    const filteredInfo = effectiveFailedRequestInfo(this._options, tabInfo);
    const profileScopeUrl = tabInfoPageUrl(tabInfo, url);
    const profileScope = this.getProfileScopeInfo({
      cookieStoreId,
      groupId,
      incognito,
      tabId,
      url: profileScopeUrl,
      windowId
    });
    const errorCount = filteredInfo.errorCount;
    const summary = filteredInfo.summary;
    const result = errorCount
      ? {
          errorCount,
          failedRequestDetectionEnabled,
          networkRequestIgnoreListEnabled,
          networkRequestIgnoreList,
          routeInfoEnabled,
          routeInfoRequestDetailsEnabled,
          summary
        }
      : null;
    this.clearBadge();
    url = profileScopeUrl;
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
    const domain = ProxyEngine.getBaseDomain(new URL(url).hostname.replace(/^\[(.*)\]$/, '$1'));
    const pageRequests = routeInfoRequestDetailsEnabled
      ? pageRequestsFromTabInfo(tabInfo, url, effectiveIgnoreList)
      : {requestLimitExceeded: false, requests: []};
    const basePageInfo = {
      url,
      domain,
      tempRuleProfileName: this.queryTempRule(domain),
      profileScope,
      errorCount,
      failedRequestDetectionEnabled,
      networkRequestIgnoreListEnabled,
      networkRequestIgnoreList,
      routeInfoEnabled,
      routeInfoRequestDetailsEnabled,
      summary,
      ...(routeInfoRequestDetailsEnabled
        ? {
            requests: pageRequests.requests,
            requestLimitExceeded: pageRequests.requestLimitExceeded
          }
        : {})
    };
    if (!routeInfoRequestDetailsEnabled || !includeExplanations) {
      return basePageInfo;
    }
    const explanations = pageRequests.requests.map((request) => {
      const explainArgs =
        profileScope.effectiveScope && profileScope.effectiveScope !== 'current'
          ? {profileName: profileScope.effectiveProfileName, url: request.url}
          : {url: request.url};
      return this.explainRequest(explainArgs).catch((error: unknown) => ({
        currentProfile: undefined as Partial<RuntimeRequestProfile> | undefined,
        errors: [error instanceof Error ? error.message : String(error)],
        final: {
          kind: 'error'
        },
        finalProfile: undefined as Partial<RuntimeRequestProfile> | undefined,
        request: {
          url: request.url
        },
        startProfile: undefined as Partial<RuntimeRequestProfile> | undefined,
        steps: [] as Array<Record<string, unknown>>,
        tempRulesActive: false,
        warnings: [] as string[]
      }));
    });
    return Promise.all(explanations).then((requestExplanations: RuntimeRequestExplanation[]) => ({
      ...basePageInfo,
      requestExplanations
    }));
  }
}

export default ChromeOptions;
