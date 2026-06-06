interface LegacyDynamic {
  (...args: unknown[]): LegacyDynamic;
  new (...args: unknown[]): LegacyDynamic;
  [index: number]: LegacyDynamic;
  [key: string]: LegacyDynamic;
  [Symbol.iterator](): Iterator<LegacyDynamic>;
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
  sendMessage(message: unknown, responseCallback?: (response: LegacyDynamic) => void): void;
  sendMessage(
    extensionId: string,
    message: unknown,
    responseCallback?: (response: LegacyDynamic) => void
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

interface OmegaPacApi extends LegacyDynamic {
  Conditions: LegacyDynamic & {
    localHosts: string[];
    requestFromUrl(url: string): unknown;
    str(condition: unknown): string;
  };
  PacGenerator: LegacyDynamic & {
    ascii(value: unknown): string;
  };
  Profiles: LegacyDynamic & {
    byKey(key: unknown, options?: unknown): LegacyDynamic;
    byName(name: unknown, options?: unknown): LegacyDynamic;
    create(profile: unknown): LegacyDynamic;
    each(options: unknown, callback: (key: string, profile: LegacyDynamic) => unknown): unknown;
    match(profile: unknown, request: unknown): LegacyDynamic;
    nameAsKey(profileName: unknown): string;
    schemes: OmegaProfileScheme[];
    pacResult(value: unknown): string;
  };
  Revision: LegacyDynamic & {
    compare(left: unknown, right: unknown): number;
  };
  getBaseDomain(hostname: string | null | undefined): string;
  wildcardForUrl(url: string): string;
}

interface QueryStringModule {
  parse(value: string): Record<string, string | string[] | undefined>;
}

interface UrlModule {
  format(urlObject: unknown): string;
  parse(url: string, parseQueryString?: boolean): {
    hostname?: string | null;
    query: Record<string, unknown>;
    search?: string | null;
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
  promisify(fn: unknown): LegacyDynamic;
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

interface OmegaDebugApi {
  downloadLog(): unknown;
  getExtensionVersion(): string;
  getProjectVersion(): string;
  reportIssue(): unknown;
  resetOptions(): unknown;
}

interface OmegaTargetPopupApi {
  addCondition(condition: unknown, profileName: string, addToBottom: boolean, cb?: (...args: unknown[]) => void): void;
  addProfile(profile: unknown, cb?: (...args: unknown[]) => void): void;
  addTempRule(domain: string, profileName: string, cb?: (...args: unknown[]) => void): void;
  applyProfile(name: string, cb?: (...args: unknown[]) => void): void;
  getActivePageInfo(cb: (...args: unknown[]) => void): void;
  getMessage(messageName: string, substitutions?: string | string[]): string;
  getState(keys: string[], cb?: (...args: unknown[]) => void): void;
  openManage(domain?: string, profileName?: string, cb?: (...args: unknown[]) => void): void;
  openOptions(hash?: string, cb?: (...args: unknown[]) => void): void;
  setDefaultProfile(profileName: string, defaultProfileName: string, cb?: (...args: unknown[]) => void): void;
  setState(name: string, value: unknown, cb?: (...args: unknown[]) => void): void;
}

type ProxyFindFunction = (url: string, host: string, details?: unknown) => unknown;

declare var chrome: ChromeGlobal;
declare var browser: BrowserGlobal;
declare var angular: LegacyDynamic;
declare var exports: Record<string, unknown>;
declare var FindProxyForURL: ProxyFindFunction;
declare var module: {exports: unknown};
declare var OmegaDebug: OmegaDebugApi;
declare var OmegaPac: OmegaPacApi;
declare var OmegaTargetChromium: LegacyDynamic;
declare var OmegaTargetPopup: OmegaTargetPopupApi;
declare var saveAs: (blob: Blob, filename: string) => unknown;
declare function drawOmega(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  resultColor: string,
  profileColor?: string
): void;
declare function require(id: 'omega-target'): OmegaTargetModule;
declare function require(id: 'omega-pac'): OmegaPacApi;
declare function require(id: 'querystring'): QueryStringModule;
declare function require(id: 'url'): UrlModule;
declare function require(id: string): LegacyDynamic;

interface Window {
  FindProxyForURL: ProxyFindFunction;
  OmegaContextMenuClickHandlers: Record<string, (info: unknown, tab: ChromeTab) => unknown>;
  OmegaContextMenuQuickSwitchHandler: (info: {checked: boolean}) => unknown;
  OmegaDebug: OmegaDebugApi;
  OmegaTargetPopup: OmegaTargetPopupApi;
  UglifyJS_NoUnsafeEval: boolean;
}
