interface DynamicGlobalValue {
  (...args: unknown[]): DynamicGlobalValue;
  new (...args: unknown[]): DynamicGlobalValue;
  [index: number]: DynamicGlobalValue;
  [key: string]: DynamicGlobalValue;
  [Symbol.iterator](): Iterator<DynamicGlobalValue>;
}

type ChromeListener = (...args: unknown[]) => unknown;

type ChromeContextMenuClickInfo = Record<string, unknown> & {
  checked?: boolean;
  linkUrl?: string;
  menuItemId: string;
};

type ChromeWebRequestDetails = Record<string, unknown> & {
  error?: string;
  redirectUrl?: string;
  requestId: string;
  tabId: number;
  type?: string;
  url: string;
};

type ChromeWebRequestAuthDetails = ChromeWebRequestDetails & {
  challenger: {
    host: string;
    port: number | string;
  };
  isProxy?: boolean;
};

interface ChromeEvent<T extends ChromeListener = ChromeListener> {
  addListener(callback: T, ...extra: unknown[]): void;
  removeListener(callback: T): void;
  hasListener?(callback: T): boolean;
  hasListeners?(): boolean;
  addRules?: (...args: unknown[]) => void;
  getRules?: (...args: unknown[]) => void;
  removeRules?: (...args: unknown[]) => void;
  [method: string]: unknown;
}

interface ChromeLastError {
  message?: string;
  [key: string]: unknown;
}

interface ChromeManifest {
  manifest_version?: number;
  version: string;
  [key: string]: unknown;
}

interface ChromeRuntimePort {
  disconnect(): void;
  name: string;
  onDisconnect: ChromeEvent;
  onMessage: ChromeEvent;
  postMessage(...args: unknown[]): void;
  sender?: {
    id?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface ChromeRuntimeApi {
  id: string;
  lastError?: ChromeLastError;
  onConnect: ChromeEvent<(port: ChromeRuntimePort) => void>;
  onConnectExternal?: ChromeEvent<(port: ChromeRuntimePort) => void>;
  onMessage: ChromeEvent<(message: unknown, sender: unknown, respond: (...args: unknown[]) => void) => void>;
  getManifest(): ChromeManifest;
  getURL(path: string): string;
  reload(): void;
  sendMessage<T = unknown>(message: unknown, responseCallback?: (response: T) => void): void;
  sendMessage<T = unknown>(extensionId: string, message: unknown, responseCallback?: (response: T) => void): void;
  [key: string]: unknown;
}

interface BrowserRuntimeApi {
  id: string;
  lastError?: ChromeLastError;
  onConnect: ChromeEvent<(port: ChromeRuntimePort) => void>;
  onConnectExternal?: ChromeEvent<(port: ChromeRuntimePort) => void>;
  onMessage: ChromeEvent<(message: unknown, sender: unknown, respond: (...args: unknown[]) => void) => void>;
  getManifest(): ChromeManifest;
  getURL(path: string): string;
  reload(): void;
  sendMessage(message: unknown, options?: unknown): Promise<unknown>;
  [key: string]: unknown;
}

interface ChromeTab {
  active?: boolean;
  cookieStoreId?: string;
  groupId?: number;
  id?: number;
  incognito?: boolean;
  pendingUrl?: string;
  url?: string;
  windowId?: number;
  [key: string]: unknown;
}

interface ChromeWindow {
  id?: number;
  incognito?: boolean;
  tabs?: ChromeTab[];
  [key: string]: unknown;
}

interface ChromeTabsApi {
  create(properties: Record<string, unknown>, callback?: (...args: unknown[]) => void): void;
  get(tabId: number, callback: (tab: ChromeTab) => void): void;
  query(queryInfo: Record<string, unknown>, callback: (tabs: ChromeTab[]) => void): void;
  reload(tabId?: number, callback?: (...args: unknown[]) => void): void;
  reload(tabId?: number, reloadProperties?: Record<string, unknown>, callback?: (...args: unknown[]) => void): void;
  update(tabId: number | undefined, properties: Record<string, unknown>, callback?: (...args: unknown[]) => void): void;
  onActivated: ChromeEvent<(info: {tabId: number; windowId?: number}) => void>;
  onCreated: ChromeEvent<(tab: ChromeTab) => void>;
  onMoved?: ChromeEvent<(tabId: number, moveInfo?: unknown) => void>;
  onRemoved: ChromeEvent<(tabId: number, removeInfo?: unknown) => void>;
  onReplaced?: ChromeEvent<(addedTabId: number, removedTabId: number) => void>;
  onUpdated: ChromeEvent<(tabId: number, changeInfo: Record<string, unknown>, tab: ChromeTab) => void>;
  [key: string]: unknown;
}

interface ChromeWindowsApi {
  WINDOW_ID_NONE?: number;
  create?(properties: Record<string, unknown>, callback?: (...args: unknown[]) => void): void;
  get?(windowId: number, getInfo: Record<string, unknown>, callback: (window: ChromeWindow) => void): void;
  getLastFocused?(getInfo: Record<string, unknown>, callback: (window: ChromeWindow) => void): void;
  onFocusChanged?: ChromeEvent<(windowId: number) => void>;
  [key: string]: unknown;
}

interface ChromeActionApi {
  onClicked: ChromeEvent<(tab: ChromeTab) => void>;
  getBadgeText?(details: Record<string, unknown>, callback: (text: string) => void): void;
  setBadgeBackgroundColor(details: Record<string, unknown>, callback?: (...args: unknown[]) => void): void;
  setBadgeText(details: Record<string, unknown>, callback?: (...args: unknown[]) => void): void;
  setIcon?(details: Record<string, unknown>, callback?: (...args: unknown[]) => void): void;
  setPopup?(details: Record<string, unknown>, callback?: (...args: unknown[]) => void): void;
  setTitle(details: Record<string, unknown>, callback?: (...args: unknown[]) => void): void;
  [key: string]: unknown;
}

interface ChromeContextMenusApi {
  create(properties: Record<string, unknown>, callback?: (...args: unknown[]) => void): void;
  refresh?(): void;
  remove(menuItemId: string, callback?: (...args: unknown[]) => void): void;
  removeAll?(callback?: (...args: unknown[]) => void): void;
  update(menuItemId: string, updateProperties: Record<string, unknown>, callback?: (...args: unknown[]) => void): void;
  onClicked: ChromeEvent<(info: ChromeContextMenuClickInfo, tab: ChromeTab) => void>;
  onShown?: ChromeEvent<(info: Record<string, unknown>, tab?: ChromeTab) => void>;
  [key: string]: unknown;
}

interface ChromeI18nApi {
  getMessage(messageName: string, substitutions?: string | string[]): string;
  getUILanguage?(): string;
  [key: string]: unknown;
}

interface ChromeStorageArea {
  clear(callback?: (...args: unknown[]) => void): void;
  get(keys: unknown, callback?: (items: Record<string, unknown>) => void): void;
  remove(keys: unknown, callback?: (...args: unknown[]) => void): void;
  set(items: Record<string, unknown>, callback?: (...args: unknown[]) => void): void;
  [method: string]: unknown;
}

interface BrowserStorageArea {
  clear(): Promise<unknown>;
  get(keys: unknown): Promise<Record<string, unknown>>;
  remove(keys: unknown): Promise<unknown>;
  set(items: Record<string, unknown>): Promise<unknown>;
  [method: string]: unknown;
}

interface ChromeStorageApi {
  local: ChromeStorageArea;
  sync: ChromeStorageArea;
  onChanged: ChromeEvent<(changes: Record<string, {newValue?: unknown; oldValue?: unknown}>, areaName: string) => void>;
  [areaName: string]: unknown;
}

interface BrowserStorageApi {
  local: BrowserStorageArea;
  sync: BrowserStorageArea;
  [areaName: string]: unknown;
}

interface ChromeWebRequestApi {
  onAuthRequired?: ChromeEvent<
    (
      details: ChromeWebRequestAuthDetails,
      callback?: (response: {authCredentials?: {password?: string; username?: string}}) => void
    ) => unknown
  >;
  onBeforeRedirect: ChromeEvent<(details: ChromeWebRequestDetails) => unknown>;
  onBeforeRequest: ChromeEvent<(details: ChromeWebRequestDetails) => unknown>;
  onCompleted: ChromeEvent<(details: ChromeWebRequestDetails) => unknown>;
  onErrorOccurred: ChromeEvent<(details: ChromeWebRequestDetails) => unknown>;
  onHeadersReceived: ChromeEvent<(details: ChromeWebRequestDetails) => unknown>;
  [key: string]: unknown;
}

interface ChromeProxySettingsApi {
  clear(details: Record<string, unknown>, callback?: (...args: unknown[]) => void): void;
  get(details: Record<string, unknown>, callback: (details: unknown) => void): void;
  set(details: Record<string, unknown>, callback?: (...args: unknown[]) => void): void;
  onChange: ChromeEvent<(details: unknown) => void>;
  [key: string]: unknown;
}

interface ChromeProxyApi {
  settings: ChromeProxySettingsApi;
  [key: string]: unknown;
}

interface BrowserProxyApi {
  onError: ChromeEvent<(error: unknown) => void>;
  onProxyError: ChromeEvent<(error: {message?: string}) => void>;
  onRequest: ChromeEvent<
    (details: {cookieStoreId?: string; groupId?: number; incognito?: boolean; tabId?: number; url: string; windowId?: number}) => unknown
  >;
  [key: string]: unknown;
}

interface ChromeAlarmsApi {
  clear(name: string, callback?: (...args: unknown[]) => void): void;
  create(name: string, alarmInfo: Record<string, unknown>): void;
  onAlarm: ChromeEvent<(alarm: {name: string}) => void>;
  [key: string]: unknown;
}

interface ChromeDownloadsApi {
  download(options: Record<string, unknown>, callback?: (...args: unknown[]) => void): void;
  [key: string]: unknown;
}

interface BrowserDownloadsApi {
  download(options: Record<string, unknown>): Promise<unknown>;
  [key: string]: unknown;
}

interface BrowserTabsApi {
  create(properties: Record<string, unknown>): Promise<ChromeTab>;
  query(queryInfo: Record<string, unknown>): Promise<ChromeTab[]>;
  update(tabId: number, properties: Record<string, unknown>): Promise<ChromeTab>;
  [key: string]: unknown;
}

interface BrowserContextualIdentity {
  color?: string;
  colorCode?: string;
  cookieStoreId?: string;
  icon?: string;
  iconUrl?: string;
  name?: string;
}

interface BrowserContextualIdentitiesApi {
  query(details: Record<string, unknown>): Promise<BrowserContextualIdentity[]>;
  [key: string]: unknown;
}

interface ChromeGlobal {
  action: ChromeActionApi;
  alarms: ChromeAlarmsApi;
  contextMenus?: ChromeContextMenusApi;
  downloads?: ChromeDownloadsApi;
  i18n: ChromeI18nApi;
  proxy: ChromeProxyApi;
  runtime: ChromeRuntimeApi;
  storage: ChromeStorageApi;
  tabs: ChromeTabsApi;
  webRequest: ChromeWebRequestApi;
  windows?: ChromeWindowsApi;
  [key: string]: unknown;
}

interface BrowserGlobal {
  contextualIdentities?: BrowserContextualIdentitiesApi;
  downloads?: BrowserDownloadsApi;
  proxy: BrowserProxyApi;
  runtime: BrowserRuntimeApi;
  storage: BrowserStorageApi;
  tabs?: BrowserTabsApi;
  [key: string]: unknown;
}

type ProxyProfileScheme = {
  prop: string;
  scheme?: string;
};

interface ProxyEngineApi extends DynamicGlobalValue {
  Conditions: DynamicGlobalValue & {
    localHosts: string[];
    match(condition: unknown, request: unknown): boolean;
    requestFromUrl(url: string): unknown;
    str(condition: unknown): string;
  };
  PacGenerator: DynamicGlobalValue & {
    ascii(value: unknown): string;
  };
  Profiles: DynamicGlobalValue & {
    byKey(key: unknown, options?: unknown): DynamicGlobalValue;
    byName(name: unknown, options?: unknown): DynamicGlobalValue;
    create(profile: unknown): DynamicGlobalValue;
    each(options: unknown, callback: (key: string, profile: DynamicGlobalValue) => unknown): unknown;
    match(profile: unknown, request: unknown): DynamicGlobalValue;
    nameAsKey(profileName: unknown): string;
    schemes: ProxyProfileScheme[];
    pacResult(value: unknown): string;
  };
  Revision: DynamicGlobalValue & {
    compare(left: unknown, right: unknown): number;
  };
  getBaseDomain(hostname: string | null | undefined): string;
  wildcardForUrl(url: string): string;
}

interface UrlModule {
  parse(url: string): {
    hostname?: string | null;
    path?: string | null;
    query: Record<string, unknown>;
    search?: string | null;
    protocol?: string | null;
    [key: string]: unknown;
  };
}

type RuntimePromise<T = unknown> = Promise<T>;

interface RuntimePromiseStatic {
  new <T = unknown>(
    executor: (resolve: (value?: T | PromiseLike<T>) => void, reject: (reason?: unknown) => void) => void
  ): RuntimePromise<T>;
  all<T>(values: Array<T | PromiseLike<T>>): RuntimePromise<T[]>;
  reject<T = never>(reason?: unknown): RuntimePromise<T>;
  resolve<T = unknown>(value?: T | PromiseLike<T>): RuntimePromise<T>;
  try<T = unknown>(fn: () => T | PromiseLike<T>): RuntimePromise<T>;
  [key: string]: unknown;
}

interface RuntimeOptionsState {
  get<T extends Record<string, unknown>>(defaults: T): RuntimePromise<T>;
  remove(keys: string[]): RuntimePromise<unknown>;
  set(items: Record<string, unknown>): RuntimePromise<unknown>;
}

interface RuntimeOptionsData extends Record<string, unknown> {
  '-enableQuickSwitch'?: boolean;
  '-networkRequestIgnoreList'?: string[];
  '-profileScopeAssignments'?: {
    containers?: Record<string, string>;
    normalDefaultProfileName?: string;
    privateDefaultProfileName?: string;
  };
  '-profileScopes'?: {
    container?: boolean;
    tab?: boolean;
    window?: boolean;
  };
  '-quickSwitchProfiles'?: string[];
  '-refreshOnProfileChange'?: boolean;
  '-showPopupAddCondition'?: boolean;
  '-showPopupAddTempRule'?: boolean;
  '-uiTheme'?: string;
}

interface RuntimeOptionsBase {
  _currentProfileName: string;
  _isSystem: boolean;
  _options: RuntimeOptionsData;
  _setAvailableProfiles(): Promise<unknown>;
  _setOptions(changes: Record<string, unknown>): RuntimePromise<unknown>;
  _state: RuntimeOptionsState;
  fallbackProfileName: string;
  log: {
    error(...args: unknown[]): void;
    log(...args: unknown[]): void;
  };
  applyProfile(profileName: string, options?: Record<string, unknown>): RuntimePromise<unknown>;
  currentProfile(): unknown;
  currentProfileChanged(reason: string): unknown;
  explainRequest(args: unknown): RuntimePromise<PopupApiRequestExplanation>;
  queryTempRule(domain: string): unknown;
  updateProfile(...args: unknown[]): Promise<Record<string, unknown>>;
  upgrade(options?: unknown, ...args: unknown[]): Promise<unknown>;
}

interface RuntimeOptionsConstructor {
  new (...args: unknown[]): RuntimeOptionsBase;
  NoOptionsError: new () => Error;
}

interface RuntimeStorageError extends Error {
  maxItems?: boolean;
  perHour?: boolean;
  perItem?: boolean;
  perMinute?: boolean;
  sustained?: number;
}

interface RuntimeStorageConstructor {
  new (...args: unknown[]): Record<string, unknown>;
  QuotaExceededError: new () => RuntimeStorageError;
  RateLimitExceededError: new () => RuntimeStorageError;
  StorageUnavailableError: new () => RuntimeStorageError;
}

interface ExtensionRuntimeModule extends Record<string, unknown> {
  ContentTypeRejectedError: new (message?: string) => Error;
  HttpError: new (error?: unknown) => Error;
  HttpNotFoundError: new (error?: unknown) => Error;
  HttpServerError: new (error?: unknown) => Error;
  NetworkError: new (error?: unknown) => Error;
  ProxyEngine: ProxyEngineApi;
  Options: RuntimeOptionsConstructor;
  Promise: RuntimePromiseStatic;
  Storage: RuntimeStorageConstructor;
}

type PopupApiCallback<T = unknown> = (error?: unknown, result?: T) => void;

type PopupApiProfileKey = `+${string}`;

type PopupApiProfile = {
  builtin?: boolean;
  color?: string;
  defaultProfileName?: string;
  desc?: string;
  name: string;
  profileType?: string;
  validResultProfiles?: string[];
  [key: string]: unknown;
};

type PopupApiProfileMap = Record<PopupApiProfileKey, PopupApiProfile | undefined>;

type PopupApiRequestExplanation = {
  currentProfile?: Partial<PopupApiProfile>;
  errors?: string[];
  final: {
    auth?: boolean;
    delegated?: boolean;
    kind: string;
    limited?: boolean;
    pacResult?: string;
    profile?: Partial<PopupApiProfile>;
    proxy?: unknown;
  };
  finalProfile?: Partial<PopupApiProfile>;
  request: Record<string, unknown>;
  startProfile?: Partial<PopupApiProfile>;
  steps: Array<Record<string, unknown>>;
  tempRulesActive: boolean;
  warnings: string[];
};

type PopupApiPageInfo = {
  domain?: string;
  errorCount?: number;
  failedRequestDetectionEnabled?: boolean;
  networkRequestIgnoreList?: string[];
  networkRequestIgnoreListEnabled?: boolean;
  profileScope?: {
    assignments?: {
      containers?: Record<string, string>;
      normalDefaultProfileName?: string;
      privateDefaultProfileName?: string;
    };
    capabilities?: {
      container?: boolean;
      tab?: boolean;
      window?: boolean;
    };
    containerProfileName?: string;
    cookieStoreId?: string;
    effectiveProfileName?: string;
    effectiveScope?: string;
    enabled?: {
      container?: boolean;
      tab?: boolean;
      window?: boolean;
    };
    incognito?: boolean;
    isContainer?: boolean;
    tabId?: number;
    tabProfileName?: string;
    windowProfileName?: string;
  };
  requestExplanations?: PopupApiRequestExplanation[];
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
  [key: string]: unknown;
};

type PopupApiPageInfoOptions = {
  includeExplanations?: boolean;
};

type PopupApiState = {
  availableProfiles?: PopupApiProfileMap;
  currentProfileCanAddRule?: boolean;
  currentProfileName?: string;
  externalProfile?: PopupApiProfile;
  isSystemProfile?: boolean;
  lastProfileNameForCondition?: string;
  proxyNotControllable?: string;
  refreshOnProfileChange?: boolean;
  showExternalProfile?: boolean;
  showPopupAddCondition?: boolean;
  showPopupAddTempRule?: boolean;
  uiLocale?: string;
  uiTheme?: string;
  validResultProfiles?: string[];
};

type PopupApiStateKey = keyof PopupApiState;
type PopupApiWritableStateKey = 'lastProfileNameForCondition';

type PopupApiConditionType =
  | 'HostRegexCondition'
  | 'HostWildcardCondition'
  | 'KeywordCondition'
  | 'UrlRegexCondition'
  | 'UrlWildcardCondition';

type PopupApiCondition = {
  conditionType: PopupApiConditionType;
  pattern: string;
};

type PopupApiConditionInput = PopupApiCondition | PopupApiCondition[];

interface PopupBridgeApi {
  addCondition(condition: PopupApiConditionInput, profileName: string, addToBottom: boolean, cb?: PopupApiCallback): void;
  addProfile(profile: PopupApiProfile, cb?: PopupApiCallback): void;
  addTempRule(domain: string, profileName: string, cb?: PopupApiCallback): void;
  applyProfile(name: string, cb?: PopupApiCallback): void;
  getActivePageInfo(cb: PopupApiCallback<PopupApiPageInfo>): void;
  getActivePageInfo(options: PopupApiPageInfoOptions, cb: PopupApiCallback<PopupApiPageInfo>): void;
  getMessage(messageName: string, substitutions?: string | string[]): string;
  getState(keys: PopupApiStateKey[], cb?: PopupApiCallback<PopupApiState>): void;
  openManage(cb?: PopupApiCallback): void;
  openManage(domain?: string, profileName?: string, cb?: PopupApiCallback): void;
  openOptions(hash?: string | null, cb?: PopupApiCallback): void;
  patchOptions(patch: Record<string, unknown>, cb?: PopupApiCallback): void;
  setDefaultProfile(profileName: string, defaultProfileName: string, cb?: PopupApiCallback): void;
  setProfileScope(
    args: {
      cookieStoreId?: string;
      incognito?: boolean;
      profileName?: string;
      scope: 'container' | 'group' | 'normal' | 'private' | 'tab';
      tabId?: number;
    },
    cb?: PopupApiCallback
  ): void;
  setState(name: PopupApiWritableStateKey, value: PopupApiState[PopupApiWritableStateKey], cb?: PopupApiCallback): void;
}

type ProxyFindFunction = (url: string, host: string, details?: unknown) => unknown;

declare var chrome: ChromeGlobal;
declare var browser: BrowserGlobal;
declare var FindProxyForURL: ProxyFindFunction;
declare var ProxyEngine: ProxyEngineApi;
declare var ExtensionRuntime: ExtensionRuntimeModule;
declare var BrowserExtensionRuntime: DynamicGlobalValue;
declare var PopupBridge: PopupBridgeApi;
declare function importScripts(...urls: string[]): void;
declare function drawActionIcon(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  resultColor: string,
  profileColor?: string
): void;

declare module '@switchyagain/extension-runtime' {
  const value: ExtensionRuntimeModule;
  export default value;
}

declare module 'buffer' {
  export const Buffer: {
    from(
      value: string,
      encoding?: string
    ): {
      toString(encoding?: string): string;
    };
  };
}

interface Window {
  FindProxyForURL: ProxyFindFunction;
  ContextMenuClickHandlers: Record<string, (info: ChromeContextMenuClickInfo, tab: ChromeTab) => unknown>;
  ContextMenuQuickSwitchHandler: (info: {checked: boolean}) => unknown;
  PopupBridge: PopupBridgeApi;
}
