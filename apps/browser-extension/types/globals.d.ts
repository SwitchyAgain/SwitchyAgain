interface DynamicGlobalValue {
  (...args: unknown[]): DynamicGlobalValue;
  new (...args: unknown[]): DynamicGlobalValue;
  [index: number]: DynamicGlobalValue;
  [key: string]: DynamicGlobalValue;
  [Symbol.iterator](): Iterator<DynamicGlobalValue>;
}

type ChromeListener = (...args: unknown[]) => unknown;

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
  onMessage: ChromeEvent<(
    message: unknown,
    sender: unknown,
    respond: (...args: unknown[]) => void
  ) => void>;
  getManifest(): ChromeManifest;
  getURL(path: string): string;
  reload(): void;
  sendMessage<T = unknown>(message: unknown, responseCallback?: (response: T) => void): void;
  sendMessage<T = unknown>(
    extensionId: string,
    message: unknown,
    responseCallback?: (response: T) => void
  ): void;
  [key: string]: unknown;
}

interface BrowserRuntimeApi {
  id: string;
  lastError?: ChromeLastError;
  onConnect: ChromeEvent<(port: ChromeRuntimePort) => void>;
  onConnectExternal?: ChromeEvent<(port: ChromeRuntimePort) => void>;
  onMessage: ChromeEvent<(
    message: unknown,
    sender: unknown,
    respond: (...args: unknown[]) => void
  ) => void>;
  getManifest(): ChromeManifest;
  getURL(path: string): string;
  reload(): void;
  sendMessage(message: unknown, options?: unknown): Promise<unknown>;
  [key: string]: unknown;
}

interface ChromeTab {
  active?: boolean;
  id?: number;
  url?: string;
  [key: string]: unknown;
}

interface ChromeTabsApi {
  create(properties: Record<string, unknown>, callback?: (...args: unknown[]) => void): void;
  get(tabId: number, callback: (tab: ChromeTab) => void): void;
  query(queryInfo: Record<string, unknown>, callback: (tabs: ChromeTab[]) => void): void;
  reload(tabId?: number, callback?: (...args: unknown[]) => void): void;
  reload(
    tabId?: number,
    reloadProperties?: Record<string, unknown>,
    callback?: (...args: unknown[]) => void
  ): void;
  update(tabId: number | undefined, properties: Record<string, unknown>, callback?: (...args: unknown[]) => void): void;
  onActivated: ChromeEvent<(info: {tabId: number}) => void>;
  onCreated: ChromeEvent<(tab: ChromeTab) => void>;
  onRemoved: ChromeEvent;
  onReplaced?: ChromeEvent<(addedTabId: number, removedTabId: number) => void>;
  onUpdated: ChromeEvent<(tabId: number, changeInfo: Record<string, unknown>, tab: ChromeTab) => void>;
  [key: string]: unknown;
}

interface ChromeActionApi {
  onClicked: ChromeEvent<(tab: ChromeTab) => void>;
  getBadgeText?(details: Record<string, unknown>, callback: (text: string) => void): void;
  setBadgeBackgroundColor?(details: Record<string, unknown>, callback?: (...args: unknown[]) => void): void;
  setBadgeText?(details: Record<string, unknown>, callback?: (...args: unknown[]) => void): void;
  setIcon?(details: Record<string, unknown>, callback?: (...args: unknown[]) => void): void;
  setPopup?(details: Record<string, unknown>, callback?: (...args: unknown[]) => void): void;
  setTitle(details: Record<string, unknown>, callback?: (...args: unknown[]) => void): void;
  [key: string]: unknown;
}

interface ChromeContextMenusApi {
  create(properties: Record<string, unknown>, callback?: (...args: unknown[]) => void): void;
  remove(menuItemId: string, callback?: (...args: unknown[]) => void): void;
  removeAll?(callback?: (...args: unknown[]) => void): void;
  update(menuItemId: string, updateProperties: Record<string, unknown>, callback?: (...args: unknown[]) => void): void;
  onClicked: ChromeEvent<(info: Record<string, unknown>, tab: ChromeTab) => void>;
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
  onChanged: ChromeEvent<(
    changes: Record<string, {newValue?: unknown; oldValue?: unknown}>,
    areaName: string
  ) => void>;
  [areaName: string]: unknown;
}

interface BrowserStorageApi {
  local: BrowserStorageArea;
  sync: BrowserStorageArea;
  [areaName: string]: unknown;
}

interface ChromeWebRequestApi {
  onAuthRequired?: ChromeEvent;
  onBeforeRedirect: ChromeEvent;
  onBeforeRequest: ChromeEvent;
  onCompleted: ChromeEvent;
  onErrorOccurred: ChromeEvent;
  onHeadersReceived: ChromeEvent;
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
  onRequest: ChromeEvent<(details: {url: string}) => unknown>;
  register?(scriptUrl: string): Promise<unknown> | void;
  registerProxyScript(scriptUrl: string): Promise<unknown> | void;
  unregister?(): Promise<unknown> | void;
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

interface ChromeGlobal {
  action?: ChromeActionApi;
  alarms: ChromeAlarmsApi;
  browserAction?: ChromeActionApi;
  contextMenus?: ChromeContextMenusApi;
  downloads?: ChromeDownloadsApi;
  i18n: ChromeI18nApi;
  proxy: ChromeProxyApi;
  runtime: ChromeRuntimeApi;
  storage: ChromeStorageApi;
  tabs: ChromeTabsApi;
  webRequest: ChromeWebRequestApi;
  [key: string]: unknown;
}

interface BrowserGlobal {
  downloads?: BrowserDownloadsApi;
  proxy: BrowserProxyApi;
  runtime: BrowserRuntimeApi;
  storage: BrowserStorageApi;
  [key: string]: unknown;
}

type OmegaProfileScheme = {
  prop: string;
  scheme?: string;
};

interface OmegaPacApi extends DynamicGlobalValue {
  Conditions: DynamicGlobalValue & {
    localHosts: string[];
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
    schemes: OmegaProfileScheme[];
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

interface OmegaPromise<T = unknown> extends Promise<T> {
  timeout(milliseconds: number): OmegaPromise<T>;
}

interface OmegaPromiseStatic {
  new <T = unknown>(
    executor: (
      resolve: (value?: T | PromiseLike<T>) => void,
      reject: (reason?: unknown) => void
    ) => void
  ): OmegaPromise<T>;
  all<T>(values: Array<T | PromiseLike<T>>): OmegaPromise<T[]>;
  promisify(fn: unknown): DynamicGlobalValue;
  reject<T = never>(reason?: unknown): OmegaPromise<T>;
  resolve<T = unknown>(value?: T | PromiseLike<T>): OmegaPromise<T>;
  try<T = unknown>(fn: () => T | PromiseLike<T>): OmegaPromise<T>;
  join<A, B, R>(
    a: A | PromiseLike<A>,
    b: B | PromiseLike<B>,
    handler: (a: A, b: B) => R
  ): OmegaPromise<R>;
  [key: string]: unknown;
}

interface OmegaOptionsState {
  get<T extends Record<string, unknown>>(defaults: T): OmegaPromise<T>;
  remove(keys: string[]): OmegaPromise<unknown>;
  set(items: Record<string, unknown>): OmegaPromise<unknown>;
}

interface OmegaOptionsData extends Record<string, unknown> {
  '-enableQuickSwitch'?: boolean;
  '-quickSwitchProfiles'?: string[];
  '-refreshOnProfileChange'?: boolean;
  '-uiTheme'?: string;
}

interface OmegaOptionsBase {
  _currentProfileName: string;
  _options: OmegaOptionsData;
  _setOptions(changes: Record<string, unknown>): OmegaPromise<unknown>;
  _state: OmegaOptionsState;
  log: {
    error(...args: unknown[]): void;
    log(...args: unknown[]): void;
  };
  applyProfile(profileName: string): OmegaPromise<unknown>;
  currentProfileChanged(reason: string): unknown;
  explainRequest(args: unknown): OmegaPromise<PopupApiRequestExplanation>;
  queryTempRule(domain: string): unknown;
  updateProfile(...args: unknown[]): Promise<Record<string, unknown>>;
  upgrade(options?: unknown, ...args: unknown[]): Promise<unknown>;
}

interface OmegaOptionsConstructor {
  new (...args: unknown[]): OmegaOptionsBase;
  NoOptionsError: new () => Error;
}

interface OmegaStorageError extends Error {
  maxItems?: boolean;
  perHour?: boolean;
  perItem?: boolean;
  perMinute?: boolean;
  sustained?: number;
}

interface OmegaStorageConstructor {
  new (...args: unknown[]): Record<string, unknown>;
  QuotaExceededError: new () => OmegaStorageError;
  RateLimitExceededError: new () => OmegaStorageError;
  StorageUnavailableError: new () => OmegaStorageError;
}

interface OmegaTargetModule extends Record<string, unknown> {
  ContentTypeRejectedError: new (message?: string) => Error;
  HttpError: new (error?: unknown) => Error;
  HttpNotFoundError: new (error?: unknown) => Error;
  HttpServerError: new (error?: unknown) => Error;
  NetworkError: new (error?: unknown) => Error;
  OmegaPac: OmegaPacApi;
  Options: OmegaOptionsConstructor;
  Promise: OmegaPromiseStatic;
  Storage: OmegaStorageConstructor;
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
  requestExplanations?: PopupApiRequestExplanation[];
  requestLimitExceeded?: boolean;
  requests?: Array<{
    error?: string;
    id: string;
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

interface OmegaTargetPopupApi {
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
  setDefaultProfile(profileName: string, defaultProfileName: string, cb?: PopupApiCallback): void;
  setState(
    name: PopupApiWritableStateKey,
    value: PopupApiState[PopupApiWritableStateKey],
    cb?: PopupApiCallback
  ): void;
}

type ProxyFindFunction = (url: string, host: string, details?: unknown) => unknown;

declare var chrome: ChromeGlobal;
declare var browser: BrowserGlobal;
declare var FindProxyForURL: ProxyFindFunction;
declare var OmegaPac: OmegaPacApi;
declare var OmegaTarget: OmegaTargetModule;
declare var OmegaTargetChromium: DynamicGlobalValue;
declare var OmegaTargetPopup: OmegaTargetPopupApi;
declare function importScripts(...urls: string[]): void;
declare function drawOmega(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  resultColor: string,
  profileColor?: string
): void;

declare module '@switchyagain/extension-runtime' {
  const value: OmegaTargetModule;
  export default value;
}

declare module 'buffer' {
  export const Buffer: {
    from(value: string, encoding?: string): {
      toString(encoding?: string): string;
    };
  };
}

interface Window {
  FindProxyForURL: ProxyFindFunction;
  OmegaContextMenuClickHandlers: Record<string, (info: unknown, tab: ChromeTab) => unknown>;
  OmegaContextMenuQuickSwitchHandler: (info: {checked: boolean}) => unknown;
  OmegaTargetPopup: OmegaTargetPopupApi;
}
