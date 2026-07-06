type BackgroundMethodArgs = {
  addCondition: [condition: unknown, profileName: string, addToBottom: boolean];
  addProfile: [profile: unknown];
  addTempRule: [domain: string, profileName: string];
  applyProfile: [name: string];
  beginOptionsHandoff: [tabId: number];
  cancelOptionsHandoff: [handoffId: string];
  explainRequest: [args: unknown];
  getAll: [];
  getOptionsPageState: [tabId: number];
  getPageInfo: [args: PageInfoArgs];
  getState: [name: string | string[]];
  getWebDavSyncConfig: [];
  patch: [patch: Record<string, unknown>];
  renameProfile: [fromName: string, toName: string];
  replaceRef: [fromName: string, toName: string];
  reset: [options?: OmegaOptionsData | string];
  resetOptionsSync: [];
  refreshProfileScopeContainerNames: [];
  resolveOptionsHandoff: [handoffId: string, action: OptionsHandoffAction];
  setDefaultProfile: [profileName: string, defaultProfileName: string];
  setOptionsSync: [enabled: boolean, args?: unknown];
  setWebDavOptionsSync: [enabled: boolean, args?: WebDavSyncActionArgs];
  setWebDavSyncConfig: [config: WebDavSyncConfigInput];
  setProfileScope: [args: ProfileScopeSetArgs];
  setState: [items: Record<string, unknown>] | [name: string, value: unknown];
  testWebDavSync: [config?: WebDavSyncConfigInput];
  updateProfile: [name?: string | string[] | null, bypassCache?: boolean | string];
};

type SyncProvider = '' | 'browser' | 'webdav';

type WebDavSyncActionArgs = {
  config?: WebDavSyncConfigInput;
  mode?: 'download' | 'upload';
};

type WebDavSyncConfigInput = {
  intervalMinutes?: number;
  password?: string;
  remotePath?: string;
  serverUrl?: string;
  username?: string;
};

type WebDavSyncConfig = Required<Pick<WebDavSyncConfigInput, 'intervalMinutes' | 'remotePath' | 'serverUrl'>> &
  Omit<WebDavSyncConfigInput, 'intervalMinutes' | 'remotePath' | 'serverUrl'> & {
    deviceId: string;
  };

type WebDavSyncPublicConfig = Omit<WebDavSyncConfig, 'password'> & {
  hasPassword: boolean;
};

type WebDavSyncTestResult = {
  exists: boolean;
  ok: boolean;
  schemaVersion?: unknown;
};

type PageInfoArgs = {
  cookieStoreId?: string;
  groupId?: number;
  includeExplanations?: boolean;
  incognito?: boolean;
  tabId: number;
  url?: string;
  windowId?: number;
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

type ProfileScopeName = 'container' | 'current' | 'group' | 'normal' | 'private' | 'tab';

type ProfileScopeMarker = Exclude<ProfileScopeName, 'current'>;

type ProfileScopeInfo = {
  effectiveProfileName?: string;
  effectiveScope?: ProfileScopeName;
};

type ProfileScopeInfoArgs = {
  cookieStoreId?: string;
  groupId?: number;
  incognito?: boolean;
  tabId?: number;
  windowId?: number;
};

function backgroundTabUrl(tab?: Pick<ChromeTab, 'pendingUrl' | 'url'> | null) {
  return tab?.pendingUrl || tab?.url;
}

type BackgroundMethod = keyof BackgroundMethodArgs;
type BackgroundStateMethod = 'getState' | 'setState';
type BackgroundOptionMethod = Exclude<BackgroundMethod, BackgroundStateMethod>;
type BackgroundOptionMethods = {
  [K in BackgroundOptionMethod]: BackgroundCallable;
};

type RawBackgroundRequest = {
  args?: unknown[];
  method?: string;
  noReply?: boolean;
  refreshActivePage?: boolean;
};

type BackgroundRequest<M extends BackgroundMethod = BackgroundMethod> = RawBackgroundRequest & {
  args?: BackgroundMethodArgs[M];
  method: M;
};

type BackgroundRuntimeResponse<T = unknown> = {
  error?: unknown;
  result?: T;
};

type BackgroundRespond = (response: BackgroundRuntimeResponse) => void;

type BackgroundSync = {
  enabled: boolean;
  storage?: {
    get(keys: unknown): RuntimePromise<Record<string, unknown>>;
    remove(keys?: unknown): RuntimePromise<unknown>;
  };
  transformValue?: unknown;
  _pending?: Record<string, unknown>;
  _timeout?: ReturnType<typeof setTimeout> | null;
  [key: string]: unknown;
};

type BackgroundLog = OmegaOptionsBase['log'] & {
  method(name: string, self: unknown, args: IArguments | unknown[]): void;
  str(obj: unknown): string;
};

type BackgroundPromiseStatic = RuntimePromiseStatic & {
  longStackTraces(): void;
  onPossiblyUnhandledRejection(callback: (reason: unknown, promise: unknown) => unknown): void;
  onUnhandledRejectionHandled(callback: (promise: unknown) => unknown): void;
};

type BackgroundExternalApi = {
  disabled: boolean;
  listen(): unknown;
};

type BackgroundState = {
  get(keys: unknown): RuntimePromise<Record<string, unknown>>;
  set(items: Record<string, unknown>): RuntimePromise<unknown>;
};

type BackgroundTabBadge = {
  color: string;
  text: string;
};

type BackgroundTabs = {
  processTab(tab: ChromeTab): unknown;
  resetAll(details: {icon: BackgroundIcon | null; shortTitle: string; title: string}): unknown;
  setTabBadge(tab: ChromeTab, badge: BackgroundTabBadge): unknown;
  watch(): unknown;
};

type BackgroundProxyImpl = {
  features: string[];
  parseExternalProfile(details: ProxyChangeDetails, options?: OmegaOptionsData): BackgroundProfile | null | undefined;
  watchProxyChange(callback: (details: ProxyChangeDetails | null | undefined) => unknown): void | null;
};

type BackgroundOptions = BackgroundOptionMethods & {
  sync?: BackgroundSync;
  currentProfileChanged: (reason?: string) => unknown;
  clearBadge(): unknown;
  currentProfile(): BackgroundProfile | null | undefined;
  externalApi: BackgroundExternalApi;
  explainRequest(args: unknown): RuntimePromise<unknown>;
  getProfileScopeInfo(args: ProfileScopeInfoArgs): ProfileScopeInfo;
  isCurrentProfileStatic(): boolean;
  matchProfileFromProfileName(profileName: string, request: unknown): RuntimePromise<BackgroundMatchResult>;
  matchProfile(request: unknown): RuntimePromise<BackgroundMatchResult>;
  getMonitoredTabUrl(tabId: number, url?: string): string | undefined;
  optionsLoaded: RuntimePromise<unknown> | null;
  printProfile(profile?: BackgroundProfile | null): unknown;
  profile(name?: unknown): BackgroundProfile;
  proxyNotControllable(): string | null;
  queryTempRule(domain: string): unknown;
  ready: RuntimePromise<unknown>;
  resetOptionsSync(): RuntimePromise<unknown>;
  setBadge(): unknown;
  setExternalProfile(profile: BackgroundProfile, args?: {internal?: boolean; noRevert?: boolean}): Promise<unknown> | void;
  setOptionsSync(enabled: boolean, args?: unknown): RuntimePromise<unknown>;
  setProxyNotControllable(reason: string | null): unknown;
  _options: OmegaOptionsData;
};

type BackgroundCallable = (...args: unknown[]) => unknown;

type BackgroundDispatch = {
  method: BackgroundCallable;
  target: object;
};

type OptionsHandoffAction = 'apply' | 'discard';

type OptionsHandoffPortEntry = {
  dirty: boolean;
  port: ChromeRuntimePort;
  tabId: number;
};

type OptionsHandoffEntry = {
  handoffId: string;
  reject?: (error: Error) => void;
  resolve?: () => void;
  sourceTabId: number;
  targetTabId?: number;
  timeout?: ReturnType<typeof setTimeout>;
};

type BackgroundIcon = Record<number, ImageData>;

type DrawingContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

type BackgroundProfile = Record<string, unknown> & {
  color?: string;
  defaultProfileName?: string;
  name: string;
  profileType?: string;
};

type BackgroundActionInfo = {
  icon: BackgroundIcon | null;
  profileColor?: string;
  resultColor?: string;
  shortTitle: string;
  title: string;
};

type BackgroundMatchCondition = Record<string, unknown> & {
  condition?: unknown;
  length?: number;
  pattern?: unknown;
};

type BackgroundMatchConditionSource = BackgroundMatchCondition | string | unknown[];

type BackgroundMatchTuple = [result: unknown, condition?: BackgroundMatchConditionSource | null, ...rest: unknown[]];

type BackgroundMatchRule = Record<string, unknown> & {
  condition?: unknown;
  isTempRule?: boolean;
  profileName?: string | null;
  source?: unknown;
};

type BackgroundMatchResult = {
  profile: BackgroundProfile;
  results: Array<BackgroundMatchTuple | BackgroundMatchRule>;
};

type ProxyChangeDetails = Record<string, unknown> & {
  levelOfControl?: string;
};

type BackgroundExtensionRuntime = {
  BrowserStorage: new (storage: Storage, prefix: string) => BackgroundState;
  ChromeTabs: new (actionForUrl: (tab: ChromeTab, url: string) => Promise<BackgroundActionInfo | null>) => BackgroundTabs;
  ExternalApi: new (options: BackgroundOptions) => BackgroundExternalApi;
  Log: BackgroundLog;
  Options: (new (
    options: null,
    storage: unknown,
    state: BackgroundState,
    log: BackgroundLog,
    sync: BackgroundSync | undefined,
    proxyImpl: BackgroundProxyImpl
  ) => BackgroundOptions) & {
    transformValueForSync(value: unknown, key: string): unknown;
  };
  OptionsSync: new (storage: unknown) => BackgroundSync;
  Promise: BackgroundPromiseStatic;
  Storage: new (areaName: string) => unknown;
  Url: UrlModule;
  proxy: {
    getProxyImpl(log: BackgroundLog): BackgroundProxyImpl;
  };
  WebDavStorage: new (config: WebDavSyncConfig) => unknown;
};

(function () {
  const hasProp = {}.hasOwnProperty;

  const BrowserExtensionRuntimeModule = BrowserExtensionRuntime as unknown as BackgroundExtensionRuntime & {
    default?: BackgroundExtensionRuntime;
  };
  const ExtensionRuntimeBase = BrowserExtensionRuntimeModule.default || BrowserExtensionRuntimeModule;
  const ExtensionRuntimeCurrent = Object.create(ExtensionRuntimeBase) as BackgroundExtensionRuntime;

  const Promise = ExtensionRuntimeCurrent.Promise;

  Promise.longStackTraces();

  ExtensionRuntimeCurrent.Log = Object.create(ExtensionRuntimeCurrent.Log);

  const Log = ExtensionRuntimeCurrent.Log;

  function writeLogToLocalStorage(content: string) {
    try {
      return (localStorage['log'] += content);
    } catch (_) {
      return (localStorage['log'] = content);
    }
  }

  Log.log = (...args: unknown[]) => {
    console.log(...args);
    const content = args.map(Log.str.bind(Log)).join(' ') + '\n';
    return writeLogToLocalStorage(content);
  };

  Log.error = (...args: unknown[]) => {
    console.error(...args);
    const content = args.map(Log.str.bind(Log)).join(' ');
    localStorage['logLastError'] = content;
    return writeLogToLocalStorage('ERROR: ' + content + '\n');
  };

  const unhandledPromises: unknown[] = [];

  const unhandledPromisesId: number[] = [];

  let unhandledPromisesNextId = 1;

  Promise.onPossiblyUnhandledRejection((reason: unknown, promise: unknown) => {
    const id = unhandledPromisesNextId++;
    unhandledPromises.push(promise);
    unhandledPromisesId.push(id);
    return setTimeout(() => {
      if (unhandledPromises.indexOf(promise) >= 0) {
        return Log.error(`[${id}] Unhandled rejection:\n`, Log.str(reason));
      }
    }, 0);
  });

  Promise.onUnhandledRejectionHandled((promise: unknown) => {
    const index = unhandledPromises.indexOf(promise);
    Log.log(`[${unhandledPromisesId[index]}] Rejection handled!`, promise);
    unhandledPromises.splice(index, 1);
    return unhandledPromisesId.splice(index, 1);
  });

  let iconCache: Record<string, BackgroundIcon | null> = {};

  let drawContext: DrawingContext | null = null;

  let drawError: unknown = null;

  const profileScopeMarkerColors: Record<ProfileScopeMarker, string> = {
    tab: '#3d8bfd',
    group: '#0f766e',
    container: '#8f6ed5',
    normal: '#38a169',
    private: '#c47f17'
  };

  function drawProfileScopeMarker(ctx: DrawingContext, marker: ProfileScopeMarker) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.arc(0.22, 0.22, 0.2, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0.22, 0.22, 0.17, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = profileScopeMarkerColors[marker];
    ctx.beginPath();
    ctx.arc(0.22, 0.22, 0.12, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.fill();
  }

  function drawIcon(resultColor?: string, profileColor?: string, scopeMarker?: ProfileScopeMarker): BackgroundIcon | null {
    const cacheKey = `omega+${resultColor != null ? resultColor : ''}+${profileColor || ''}+${scopeMarker || ''}`;
    const cachedIcon = iconCache[cacheKey];
    if (cachedIcon) {
      return cachedIcon;
    }
    let icon: BackgroundIcon | null;
    try {
      if (drawContext == null) {
        if (typeof OffscreenCanvas !== 'undefined') {
          drawContext = new OffscreenCanvas(38, 38).getContext('2d');
        } else if (typeof document !== 'undefined') {
          let canvas = document.getElementById('canvas-icon') as HTMLCanvasElement | null;
          if (canvas == null) {
            canvas = document.createElement('canvas');
            canvas.id = 'canvas-icon';
            if (document.body != null) {
              document.body.appendChild(canvas);
            }
          }
          drawContext = canvas.getContext('2d');
        } else {
          throw new Error('Canvas is unavailable in this background context.');
        }
      }
      const ctx = drawContext;
      if (ctx == null) {
        throw new Error('Canvas drawing context is unavailable.');
      }
      icon = {};
      for (const size of [16, 19, 24, 32, 38]) {
        ctx.scale(size, size);
        ctx.clearRect(0, 0, 1, 1);
        if (resultColor != null) {
          drawActionIcon(ctx, resultColor, profileColor);
        } else {
          drawActionIcon(ctx, profileColor || '#777');
        }
        if (scopeMarker) {
          drawProfileScopeMarker(ctx, scopeMarker);
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        icon[size] = ctx.getImageData(0, 0, size, size);
        if (icon[size].data[3] === 255) {
          throw new Error('Icon drawing blocked by privacy.resistFingerprinting.');
        }
      }
    } catch (error) {
      if (drawError == null) {
        drawError = error;
        Log.error(error);
        Log.error('Profile-colored icon disabled. Falling back to static icon.');
      }
      icon = null;
    }
    return (iconCache[cacheKey] = icon);
  }

  const charCodeUnderscore = '_'.charCodeAt(0);

  function isHidden(name: string) {
    return name.charCodeAt(0) === charCodeUnderscore && name.charCodeAt(1) === charCodeUnderscore;
  }

  function dispName(name?: string) {
    if (!name) {
      return '';
    }
    return chrome.i18n.getMessage('profile_' + name) || name;
  }

  function profileScopeMarker(scope?: ProfileScopeName): ProfileScopeMarker | undefined {
    switch (scope) {
      case 'tab':
      case 'group':
      case 'container':
      case 'normal':
      case 'private':
        return scope;
      default:
        return undefined;
    }
  }

  function profileScopeLabel(scope: ProfileScopeMarker) {
    const messageKey = {
      tab: 'popup_profileScopeTab',
      group: 'popup_profileScopeGroup',
      container: 'popup_profileScopeContainer',
      normal: 'popup_profileScopeNormal',
      private: 'popup_profileScopePrivate'
    }[scope];
    const fallback = {
      tab: 'This Tab',
      group: 'Tab Group',
      container: 'Container',
      normal: 'Normal',
      private: 'Private'
    }[scope];
    return chrome.i18n.getMessage(messageKey) || fallback;
  }

  function profileScopeTitleLine(profileScope: ProfileScopeInfo, marker: ProfileScopeMarker) {
    const group = chrome.i18n.getMessage('options_group_profileScope') || 'Profile Scope';
    return `${group}: ${profileScopeLabel(marker)} -> ${dispName(profileScope.effectiveProfileName)}\n`;
  }

  function staticProfile(profile: BackgroundProfile | null | undefined) {
    return !profile?.name || !ProxyEngine.Profiles.isInclusive(profile);
  }

  function stringOrUndefined(value: unknown): string | undefined {
    return value == null ? undefined : String(value);
  }

  function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object';
  }

  const SYNC_PROVIDER_STATE = 'syncProvider';
  const WEBDAV_SYNC_CONFIG_STATE = 'webDavSyncConfig';
  const DEFAULT_WEBDAV_REMOTE_PATH = 'SwitchyAgain/options-sync.json';
  const DEFAULT_WEBDAV_INTERVAL_MINUTES = 5;

  function stateStorageKey(name: string) {
    return `omega.local.${name}`;
  }

  function getLocalState<T = unknown>(name: string): T | undefined {
    try {
      const raw = localStorage[stateStorageKey(name)];
      return raw == null ? undefined : (JSON.parse(raw) as T);
    } catch (_) {
      return undefined;
    }
  }

  function setLocalState(name: string, value: unknown) {
    localStorage[stateStorageKey(name)] = JSON.stringify(value);
  }

  function randomId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  function normalizeWebDavInterval(value: unknown) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return DEFAULT_WEBDAV_INTERVAL_MINUTES;
    }
    return Math.max(0, Math.floor(value));
  }

  function normalizeWebDavConfig(input?: WebDavSyncConfigInput, previous?: WebDavSyncConfig): WebDavSyncConfig {
    const serverUrl = String(input?.serverUrl || previous?.serverUrl || '').trim();
    if (!serverUrl) {
      throw new Error('WebDAV server URL is required.');
    }
    const password =
      typeof input?.password === 'string' && input.password.length > 0
        ? input.password
        : typeof input?.password === 'string'
          ? undefined
          : previous?.password;
    return {
      deviceId: previous?.deviceId || randomId(),
      intervalMinutes: normalizeWebDavInterval(input?.intervalMinutes ?? previous?.intervalMinutes),
      password,
      remotePath: String(input?.remotePath || previous?.remotePath || DEFAULT_WEBDAV_REMOTE_PATH)
        .trim()
        .replace(/^\/+/, ''),
      serverUrl,
      username: String(input?.username ?? previous?.username ?? '').trim() || undefined
    };
  }

  function savedWebDavConfig() {
    const config = getLocalState<WebDavSyncConfig>(WEBDAV_SYNC_CONFIG_STATE);
    if (!config?.serverUrl) {
      return undefined;
    }
    return normalizeWebDavConfig(config, config);
  }

  function publicWebDavConfig(config?: WebDavSyncConfig): WebDavSyncPublicConfig | undefined {
    if (!config) {
      return undefined;
    }
    const {password, ...publicConfig} = config;
    return {
      ...publicConfig,
      hasPassword: Boolean(password)
    };
  }

  let options: BackgroundOptions;
  let state: BackgroundState;
  let tabs: BackgroundTabs;
  let proxyImpl: BackgroundProxyImpl;
  let activeSyncProvider: SyncProvider = '';
  let browserSync: BackgroundSync | undefined;

  function actionForUrl(tab: ChromeTab, url: string) {
    return options.ready
      .then(() => {
        const request = ProxyEngine.Conditions.requestFromUrl(url);
        const profileScope = options.getProfileScopeInfo({
          cookieStoreId: tab.cookieStoreId,
          groupId: tab.groupId,
          incognito: tab.incognito,
          tabId: tab.id,
          windowId: tab.windowId
        });
        const scopeMarker = profileScopeMarker(profileScope.effectiveScope);
        const match =
          scopeMarker && profileScope.effectiveProfileName
            ? options.matchProfileFromProfileName(profileScope.effectiveProfileName, request)
            : options.matchProfile(request);
        return match.then((result) => ({
          ...result,
          profileScope,
          scopeMarker
        }));
      })
      .then((arg) => {
        const profile = arg.profile;
        const profileScope = arg.profileScope;
        const results = arg.results;
        const scopeMarker = arg.scopeMarker;
        let current =
          scopeMarker && profileScope.effectiveProfileName
            ? options.profile(profileScope.effectiveProfileName)
            : (options.currentProfile() as BackgroundProfile);
        let currentName = dispName(current.name);
        let realCurrentName: string | undefined;
        if (current.profileType === 'VirtualProfile') {
          realCurrentName = current.defaultProfileName;
          currentName += ` [${dispName(realCurrentName)}]`;
          current = options.profile(realCurrentName) as BackgroundProfile;
        }
        let details = '';
        let direct = false;
        let attached = false;
        const condition2Str = (condition: unknown): string => {
          return isRecord(condition) && condition.pattern != null ? String(condition.pattern) : ProxyEngine.Conditions.str(condition);
        };
        for (let i = 0, len = results.length; i < len; i++) {
          const result = results[i];
          let condition: string;
          if (Array.isArray(result)) {
            if (result[1] == null) {
              attached = false;
              let name = String(result[0]);
              if (name[0] === '+') {
                name = name.substring(1);
              }
              if (isHidden(name)) {
                attached = true;
              } else if (name !== realCurrentName) {
                details += chrome.i18n.getMessage('browserAction_defaultRuleDetails');
                details += ` => ${dispName(name)}\n`;
              }
            } else if (result[1].length === 0) {
              if (result[0] === 'DIRECT') {
                details += chrome.i18n.getMessage('browserAction_directResult');
                details += '\n';
                direct = true;
              } else {
                details += `${result[0]}\n`;
              }
            } else if (typeof result[1] === 'string') {
              details += `${result[1]} => ${result[0]}\n`;
            } else {
              const source = result[1];
              condition = condition2Str(isRecord(source) && source.condition != null ? source.condition : source);
              details += `${condition} => `;
              if (result[0] === 'DIRECT') {
                details += chrome.i18n.getMessage('browserAction_directResult');
                details += '\n';
                direct = true;
              } else {
                details += `${result[0]}\n`;
              }
            }
          } else if (result.profileName) {
            if (result.isTempRule) {
              details += chrome.i18n.getMessage('browserAction_tempRulePrefix');
            } else if (attached) {
              details += chrome.i18n.getMessage('browserAction_attachedPrefix');
              attached = false;
            }
            condition = result.source != null ? String(result.source) : condition2Str(result.condition);
            details += `${condition} => ${dispName(stringOrUndefined(result.profileName))}\n`;
          }
        }
        if (!details) {
          details = stringOrUndefined(options.printProfile(current)) || '';
        }
        if (scopeMarker) {
          details = profileScopeTitleLine(profileScope, scopeMarker) + details;
        }
        let resultColor = profile.color;
        let profileColor = current.color;
        let icon = null;
        if (direct) {
          resultColor = stringOrUndefined(options.profile('direct').color);
          profileColor = profile.color;
        } else if (profile.name === current.name && (scopeMarker ? staticProfile(current) : options.isCurrentProfileStatic())) {
          resultColor = profileColor = profile.color;
          icon = drawIcon(profile.color, undefined, scopeMarker);
        } else {
          resultColor = profile.color;
          profileColor = current.color;
        }
        if (icon == null) {
          icon = drawIcon(resultColor, profileColor, scopeMarker);
        }
        let shortTitle = 'Again: ' + currentName;
        if (profile.name !== currentName) {
          shortTitle += ' => ' + profile.name;
        }
        return {
          title: chrome.i18n.getMessage('browserAction_titleWithResult', [currentName, dispName(profile.name), details]),
          shortTitle,
          icon,
          resultColor,
          profileColor
        };
      })
      .catch((): null => {
        return null;
      });
  }

  const storage = new ExtensionRuntimeCurrent.Storage('local');

  state = new ExtensionRuntimeCurrent.BrowserStorage(localStorage, 'omega.local.');

  function createOptionsSync(syncStorage: unknown) {
    const sync = new ExtensionRuntimeCurrent.OptionsSync(syncStorage) as BackgroundSync;
    sync.transformValue = ExtensionRuntimeCurrent.Options.transformValueForSync;
    return sync;
  }

  function createWebDavOptionsSync(config: WebDavSyncConfig) {
    return createOptionsSync(new ExtensionRuntimeCurrent.WebDavStorage(config));
  }

  let sync: BackgroundSync | undefined;
  if (
    (typeof chrome !== 'undefined' && chrome !== null && chrome.storage?.sync) ||
    (typeof browser !== 'undefined' && browser !== null && browser.storage?.sync)
  ) {
    const syncStorage = new ExtensionRuntimeCurrent.Storage('sync');
    browserSync = createOptionsSync(syncStorage);
  }

  const savedProvider = getLocalState<SyncProvider>(SYNC_PROVIDER_STATE);
  const webDavConfig = savedWebDavConfig();
  if (savedProvider === 'webdav' && webDavConfig) {
    sync = createWebDavOptionsSync(webDavConfig);
    activeSyncProvider = 'webdav';
  } else {
    sync = browserSync;
    activeSyncProvider = sync ? 'browser' : '';
  }
  if (sync && localStorage['omega.local.syncOptions'] !== '"sync"') {
    sync.enabled = false;
  }

  proxyImpl = ExtensionRuntimeCurrent.proxy.getProxyImpl(Log);

  state.set({
    proxyImplFeatures: proxyImpl.features
  });

  options = new ExtensionRuntimeCurrent.Options(null, storage, state, Log, sync, proxyImpl);

  options.externalApi = new ExtensionRuntimeCurrent.ExternalApi(options);

  options.externalApi.listen();

  function setActiveSyncProvider(provider: SyncProvider, syncInstance?: BackgroundSync) {
    activeSyncProvider = provider;
    options.sync = syncInstance;
    setLocalState(SYNC_PROVIDER_STATE, provider);
    return state.set({
      [SYNC_PROVIDER_STATE]: provider
    });
  }

  function ensureNoActiveOtherSyncProvider(provider: SyncProvider) {
    return state
      .get({
        syncOptions: ''
      })
      .then((items) => {
        if (items.syncOptions === 'sync' && activeSyncProvider && activeSyncProvider !== provider) {
          const activeName = activeSyncProvider === 'webdav' ? 'WebDAV sync' : 'Browser sync';
          const nextName = provider === 'webdav' ? 'WebDAV sync' : 'Browser sync';
          return Promise.reject(new Error(`Disable ${activeName} before enabling ${nextName}.`));
        }
      });
  }

  function normalizeSyncCompareValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map(normalizeSyncCompareValue);
    }
    if (value && typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(value as Record<string, unknown>).sort()) {
        const normalized = normalizeSyncCompareValue((value as Record<string, unknown>)[key]);
        if (typeof normalized !== 'undefined') {
          result[key] = normalized;
        }
      }
      return result;
    }
    return value;
  }

  function syncPayloadForOptions(optionsData: OmegaOptionsData) {
    const payload: Record<string, unknown> = {};
    for (const key of Object.keys(optionsData)) {
      const value = optionsData[key];
      if (typeof value === 'undefined') {
        continue;
      }
      const transformed = ExtensionRuntimeCurrent.Options.transformValueForSync(value, key);
      if (typeof transformed !== 'undefined') {
        payload[key] = transformed;
      }
    }
    return payload;
  }

  function isSameSyncPayload(left: Record<string, unknown>, right: Record<string, unknown>) {
    return JSON.stringify(normalizeSyncCompareValue(left)) === JSON.stringify(normalizeSyncCompareValue(right));
  }

  function cancelPendingSyncPush(syncInstance?: BackgroundSync) {
    if (!syncInstance) {
      return;
    }
    if (syncInstance._timeout != null) {
      clearTimeout(syncInstance._timeout);
      syncInstance._timeout = null;
    }
    syncInstance._pending = {};
  }

  function cancelPendingBrowserSyncPush() {
    cancelPendingSyncPush(browserSync);
  }

  function disableBrowserOptionsSync() {
    if (!browserSync?.storage) {
      return Promise.reject(new Error('Browser sync is unsupported.'));
    }
    const localPayload = syncPayloadForOptions(options._options);
    cancelPendingBrowserSyncPush();
    return Promise.resolve(browserSync.storage.get(null))
      .then((syncPayload) => {
        const canClearSyncStorage = Object.keys(syncPayload).length === 0 || isSameSyncPayload(syncPayload, localPayload);
        return Promise.resolve(options.setOptionsSync(false)).then(() => {
          if (!canClearSyncStorage) {
            return;
          }
          return browserSync!.storage!.remove().then(() =>
            state.set({
              syncOptions: 'pristine'
            })
          );
        });
      })
      .then(() => setActiveSyncProvider('', undefined));
  }

  function setBrowserOptionsSync(enabled: boolean, args?: unknown) {
    if (enabled) {
      if (!browserSync) {
        return Promise.reject(new Error('Browser sync is unsupported.'));
      }
      return ensureNoActiveOtherSyncProvider('browser')
        .then(() => setActiveSyncProvider('browser', browserSync))
        .then(() => options.setOptionsSync(true, args));
    }
    if (activeSyncProvider !== 'browser') {
      return Promise.resolve();
    }
    return disableBrowserOptionsSync();
  }

  function resetBrowserOptionsSync() {
    if (!browserSync) {
      return Promise.reject(new Error('Browser sync is unsupported.'));
    }
    return ensureNoActiveOtherSyncProvider('browser')
      .then(() => setActiveSyncProvider('browser', browserSync))
      .then(() => options.resetOptionsSync());
  }

  function getWebDavSyncConfig() {
    return Promise.resolve(publicWebDavConfig(savedWebDavConfig()) || null);
  }

  function setWebDavSyncConfig(configInput: WebDavSyncConfigInput) {
    const config = normalizeWebDavConfig(configInput, savedWebDavConfig());
    setLocalState(WEBDAV_SYNC_CONFIG_STATE, config);
    return state
      .set({
        [WEBDAV_SYNC_CONFIG_STATE]: config
      })
      .then(() => publicWebDavConfig(config));
  }

  function testWebDavSync(configInput?: WebDavSyncConfigInput) {
    const config = normalizeWebDavConfig(configInput, savedWebDavConfig());
    const storage = new ExtensionRuntimeCurrent.WebDavStorage(config) as {
      get(keys: unknown): RuntimePromise<Record<string, unknown>>;
      remoteExists(): Promise<boolean>;
    };
    return Promise.resolve(storage.remoteExists()).then((exists): Promise<WebDavSyncTestResult> => {
      if (!exists) {
        return Promise.resolve({
          exists: false,
          ok: true
        });
      }
      return storage.get('schemaVersion').then((items) => ({
        exists: true,
        ok: true,
        schemaVersion: items.schemaVersion
      }));
    });
  }

  function setWebDavOptionsSync(enabled: boolean, args?: WebDavSyncActionArgs) {
    if (!enabled) {
      if (activeSyncProvider !== 'webdav') {
        return state
          .get({
            syncProvider: ''
          })
          .then((items) => {
            if (items.syncProvider !== 'webdav') {
              return;
            }
            return state
              .set({
                syncOptions: 'pristine'
              })
              .then(() => setActiveSyncProvider('', undefined));
          });
      }
      cancelPendingSyncPush(options.sync);
      return Promise.resolve(options.setOptionsSync(false))
        .then(() =>
          state.set({
            syncOptions: 'pristine'
          })
        )
        .then(() => setActiveSyncProvider('', undefined));
    }
    const config = normalizeWebDavConfig(args?.config, savedWebDavConfig());
    const webDavSync = createWebDavOptionsSync(config);
    setLocalState(WEBDAV_SYNC_CONFIG_STATE, config);
    return ensureNoActiveOtherSyncProvider('webdav')
      .then(() =>
        state.set({
          [WEBDAV_SYNC_CONFIG_STATE]: config
        })
      )
      .then(() => setActiveSyncProvider('webdav', webDavSync))
      .then(() => {
        if (args?.mode === 'download') {
          return state.set({
            syncOptions: 'conflict'
          });
        }
        return state.set({
          syncOptions: 'pristine'
        });
      })
      .then(() => options.setOptionsSync(true, args?.mode === 'download' ? {force: true} : undefined));
  }

  const syncApi = {
    getWebDavSyncConfig,
    resetOptionsSync: resetBrowserOptionsSync,
    setOptionsSync: setBrowserOptionsSync,
    setWebDavOptionsSync,
    setWebDavSyncConfig,
    testWebDavSync
  };

  tabs = new ExtensionRuntimeCurrent.ChromeTabs(actionForUrl);

  tabs.watch();

  options.setProxyNotControllable(null);

  let timeout: ReturnType<typeof setTimeout> | null = null;

  proxyImpl.watchProxyChange((details: ProxyChangeDetails | null | undefined) => {
    if (options.externalApi.disabled) {
      return;
    }
    if (!details) {
      return;
    }
    const notControllableBefore = options.proxyNotControllable();
    let internal = false;
    let noRevert = false;
    switch (details['levelOfControl']) {
      case 'controlled_by_other_extensions':
      case 'not_controllable':
        const reason = details['levelOfControl'] === 'not_controllable' ? 'policy' : 'app';
        options.setProxyNotControllable(reason);
        noRevert = true;
        break;
      default:
        options.setProxyNotControllable(null);
    }
    if (details['levelOfControl'] === 'controlled_by_this_extension') {
      internal = true;
      if (!notControllableBefore) {
        return;
      }
    }
    Log.log('external proxy: ', details);
    if (timeout != null) {
      clearTimeout(timeout);
    }
    let parsed: BackgroundProfile | null | undefined = null;
    timeout = setTimeout(() => {
      if (parsed) {
        const result = options.setExternalProfile(parsed, {
          noRevert: noRevert,
          internal: internal
        });
        return Promise.resolve(result).catch((error: unknown) => {
          Log.error('Set external profile failed:', error);
        });
      }
    }, 500);
    parsed = proxyImpl.parseExternalProfile(details, options._options);
  });

  let external = false;

  options.currentProfileChanged = (reason) => {
    iconCache = {};
    if (reason === 'external') {
      external = true;
    } else if (reason !== 'clearBadge') {
      external = false;
    }
    let current = options.currentProfile() as BackgroundProfile;
    let currentName = '';
    if (current) {
      currentName = dispName(current.name);
      if (current.profileType === 'VirtualProfile') {
        const realCurrentName = current.defaultProfileName;
        currentName += ` [${dispName(realCurrentName)}]`;
        current = options.profile(realCurrentName) as BackgroundProfile;
      }
    }
    const details = options.printProfile(current) as unknown as string;
    let title;
    let shortTitle;
    if (currentName) {
      title = chrome.i18n.getMessage('browserAction_titleWithResult', [currentName, '', details]);
      shortTitle = 'Again: ' + currentName;
    } else {
      title = details;
      shortTitle = 'Again: ' + details;
    }
    if (external && current.profileType !== 'SystemProfile') {
      const message = chrome.i18n.getMessage('browserAction_titleExternalProxy');
      title = message + '\n' + title;
      shortTitle = 'Again-Extern: ' + details;
      options.setBadge();
    }
    let icon;
    if (!current.name || !ProxyEngine.Profiles.isInclusive(current)) {
      icon = drawIcon(current.color);
    } else {
      icon = drawIcon(stringOrUndefined(options.profile('direct').color), current.color);
    }
    return tabs.resetAll({
      icon: icon,
      title: title,
      shortTitle: shortTitle
    });
  };

  function encodeError(obj: unknown) {
    if (obj instanceof Error) {
      return {
        _error: 'error',
        name: obj.name,
        message: obj.message,
        stack: obj.stack,
        original: obj
      };
    } else {
      return obj;
    }
  }

  function refreshActivePageIfEnabled() {
    if (!options._options['-refreshOnProfileChange']) {
      return;
    }
    return chrome.tabs.query(
      {
        active: true,
        lastFocusedWindow: true
      },
      (tabs) => {
        const tab = tabs[0];
        if (tab?.id == null) {
          return;
        }
        const url = options.getMonitoredTabUrl(tab.id, backgroundTabUrl(tab));
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
        return chrome.tabs.reload(
          tab.id,
          {
            bypassCache: true
          },
          () => {
            chrome.runtime.lastError;
          }
        );
      }
    );
  }

  const optionsHandoffPorts: Record<number, OptionsHandoffPortEntry> = {};
  const optionsHandoffs: Record<string, OptionsHandoffEntry> = {};

  function optionsHandoffId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function isOptionsHandoffRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  function removeTab(tabId: number) {
    return new Promise<void>((resolve, reject) => {
      const remove = chrome.tabs.remove;
      if (typeof remove !== 'function') {
        reject(new Error('tabs.remove is unavailable.'));
        return;
      }
      remove.call(chrome.tabs, tabId, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message || 'Unable to close the old settings page.'));
          return;
        }
        resolve();
      });
    });
  }

  function postOptionsHandoffMessage(tabId: number, message: Record<string, unknown>) {
    const entry = optionsHandoffPorts[tabId];
    if (!entry) {
      return false;
    }
    try {
      entry.port.postMessage(message);
      return true;
    } catch (_err) {
      return false;
    }
  }

  function clearOptionsHandoffCallbacks(handoff: OptionsHandoffEntry) {
    if (handoff.timeout != null) {
      clearTimeout(handoff.timeout);
      delete handoff.timeout;
    }
    delete handoff.resolve;
    delete handoff.reject;
  }

  function getOptionsPageState(tabId: number) {
    const entry = optionsHandoffPorts[tabId];
    return {
      dirty: Boolean(entry?.dirty),
      registered: Boolean(entry)
    };
  }

  function beginOptionsHandoff(tabId: number) {
    if (!optionsHandoffPorts[tabId]) {
      throw new Error('The existing settings page is not ready.');
    }
    const handoffId = optionsHandoffId();
    optionsHandoffs[handoffId] = {
      handoffId,
      sourceTabId: tabId
    };
    if (
      !postOptionsHandoffMessage(tabId, {
        handoffId,
        type: 'optionsHandoffLock'
      })
    ) {
      delete optionsHandoffs[handoffId];
      throw new Error('Unable to lock the existing settings page.');
    }
    return handoffId;
  }

  function unlockOptionsHandoffSource(handoff: OptionsHandoffEntry) {
    postOptionsHandoffMessage(handoff.sourceTabId, {
      handoffId: handoff.handoffId,
      type: 'optionsHandoffUnlock'
    });
    delete optionsHandoffs[handoff.handoffId];
  }

  function cancelOptionsHandoff(handoffId: string) {
    const handoff = optionsHandoffs[handoffId];
    if (!handoff) {
      return;
    }
    const targetTabId = handoff.targetTabId;
    if (typeof targetTabId !== 'number') {
      return Promise.reject(new Error('The new settings page is not ready.'));
    }
    clearOptionsHandoffCallbacks(handoff);
    return removeTab(targetTabId).then(() => {
      unlockOptionsHandoffSource(handoff);
    });
  }

  function resolveOptionsHandoff(handoffId: string, action: OptionsHandoffAction) {
    const handoff = optionsHandoffs[handoffId];
    if (!handoff) {
      return Promise.reject(new Error('The settings page handoff is no longer available.'));
    }
    clearOptionsHandoffCallbacks(handoff);
    return new Promise<void>((resolve, reject) => {
      handoff.resolve = resolve;
      handoff.reject = reject;
      handoff.timeout = setTimeout(() => {
        clearOptionsHandoffCallbacks(handoff);
        reject(new Error('Timed out waiting for the existing settings page.'));
      }, 30000);
      if (
        !postOptionsHandoffMessage(handoff.sourceTabId, {
          action,
          handoffId,
          type: 'optionsHandoffResolve'
        })
      ) {
        clearOptionsHandoffCallbacks(handoff);
        reject(new Error('Unable to reach the existing settings page.'));
      }
    });
  }

  const optionsHandoffApi = {
    beginOptionsHandoff,
    cancelOptionsHandoff,
    getOptionsPageState,
    resolveOptionsHandoff
  };

  function isBackgroundMethod(method: unknown): method is BackgroundMethod {
    switch (method) {
      case 'addCondition':
      case 'addProfile':
      case 'addTempRule':
      case 'applyProfile':
      case 'beginOptionsHandoff':
      case 'cancelOptionsHandoff':
      case 'explainRequest':
      case 'getAll':
      case 'getOptionsPageState':
      case 'getPageInfo':
      case 'getState':
      case 'getWebDavSyncConfig':
      case 'patch':
      case 'renameProfile':
      case 'replaceRef':
      case 'reset':
      case 'resetOptionsSync':
      case 'refreshProfileScopeContainerNames':
      case 'resolveOptionsHandoff':
      case 'setDefaultProfile':
      case 'setOptionsSync':
      case 'setWebDavOptionsSync':
      case 'setWebDavSyncConfig':
      case 'setProfileScope':
      case 'setState':
      case 'testWebDavSync':
      case 'updateProfile':
        return true;
      default:
        return false;
    }
  }

  function resolveBackgroundDispatch(request: RawBackgroundRequest): BackgroundDispatch | null {
    if (!isBackgroundMethod(request.method)) {
      return null;
    }
    let method: unknown;
    let target: object;
    if (request.method === 'getState') {
      target = state;
      method = state.get;
    } else if (request.method === 'setState') {
      target = state;
      method = (itemsOrName: Record<string, unknown> | string, value?: unknown) => {
        if (typeof itemsOrName === 'string') {
          return state.set({
            [itemsOrName]: value
          });
        }
        return state.set(itemsOrName);
      };
    } else if (
      request.method === 'beginOptionsHandoff' ||
      request.method === 'cancelOptionsHandoff' ||
      request.method === 'getOptionsPageState' ||
      request.method === 'resolveOptionsHandoff'
    ) {
      target = optionsHandoffApi;
      method = optionsHandoffApi[request.method];
    } else if (
      request.method === 'getWebDavSyncConfig' ||
      request.method === 'resetOptionsSync' ||
      request.method === 'setOptionsSync' ||
      request.method === 'setWebDavOptionsSync' ||
      request.method === 'setWebDavSyncConfig' ||
      request.method === 'testWebDavSync'
    ) {
      target = syncApi;
      method = syncApi[request.method];
    } else {
      target = options;
      method = options[request.method];
    }
    if (typeof method !== 'function') {
      return null;
    }
    return {
      method: method as BackgroundCallable,
      target
    };
  }

  function readinessForRequest(request: BackgroundRequest): RuntimePromise<unknown> {
    switch (request.method) {
      case 'getAll':
      case 'getPageInfo':
      case 'getState':
        return options.optionsLoaded || options.ready;
      default:
        return options.ready;
    }
  }

  chrome.runtime.onConnect.addListener((port: ChromeRuntimePort) => {
    if (port.name !== 'optionsHandoff') {
      return;
    }
    const sender = port.sender as {tab?: {id?: unknown}} | undefined;
    const tabId = sender?.tab?.id;
    if (typeof tabId !== 'number') {
      port.disconnect();
      return;
    }
    optionsHandoffPorts[tabId] = {
      dirty: false,
      port,
      tabId
    };
    port.onMessage.addListener((message: unknown) => {
      if (!isOptionsHandoffRecord(message) || typeof message.type !== 'string') {
        return;
      }
      if (message.type === 'optionsHandoffState') {
        const entry = optionsHandoffPorts[tabId];
        if (entry) {
          entry.dirty = message.dirty === true;
        }
        return;
      }
      if (message.type === 'optionsHandoffClaim' && typeof message.handoffId === 'string') {
        const handoff = optionsHandoffs[message.handoffId];
        if (handoff && handoff.sourceTabId !== tabId) {
          handoff.targetTabId = tabId;
        }
        return;
      }
      if (message.type !== 'optionsHandoffResolved' || typeof message.handoffId !== 'string') {
        return;
      }
      const handoff = optionsHandoffs[message.handoffId];
      if (!handoff || handoff.sourceTabId !== tabId) {
        return;
      }
      const resolve = handoff.resolve;
      const reject = handoff.reject;
      clearOptionsHandoffCallbacks(handoff);
      if (message.ok !== true) {
        reject?.(new Error(typeof message.error === 'string' && message.error ? message.error : 'Unable to apply changes.'));
        return;
      }
      removeTab(tabId)
        .then(() => {
          delete optionsHandoffs[handoff.handoffId];
          resolve?.();
        })
        .catch((error) => {
          reject?.(error instanceof Error ? error : new Error(String(error)));
        });
    });
    port.onDisconnect.addListener(() => {
      delete optionsHandoffPorts[tabId];
      for (const handoffId in optionsHandoffs) {
        if (!hasProp.call(optionsHandoffs, handoffId)) continue;
        const handoff = optionsHandoffs[handoffId];
        if (handoff.sourceTabId === tabId) {
          const reject = handoff.reject;
          clearOptionsHandoffCallbacks(handoff);
          delete optionsHandoffs[handoffId];
          reject?.(new Error('The existing settings page was closed.'));
          continue;
        }
        if (handoff.targetTabId === tabId && !handoff.resolve && !handoff.reject) {
          clearOptionsHandoffCallbacks(handoff);
          unlockOptionsHandoffSource(handoff);
        }
      }
    });
  });

  chrome.runtime.onMessage.addListener((request: unknown, _sender: unknown, respond: BackgroundRespond) => {
    if (!isRecord(request) || typeof request.method !== 'string') {
      return;
    }
    const backgroundRequest = request as RawBackgroundRequest;
    if (!isBackgroundMethod(backgroundRequest.method)) {
      Log.error(`No such method ${backgroundRequest.method}!`);
      respond({
        error: {
          reason: 'noSuchMethod'
        }
      });
      return;
    }
    const typedRequest = backgroundRequest as BackgroundRequest;
    readinessForRequest(typedRequest).then(
      () => {
        const dispatch = resolveBackgroundDispatch(backgroundRequest);
        if (!dispatch) {
          Log.error(`No such method ${backgroundRequest.method}!`);
          respond({
            error: {
              reason: 'noSuchMethod'
            }
          });
          return;
        }
        const promise = Promise.resolve().then(() => {
          return dispatch.method.apply(dispatch.target, backgroundRequest.args || []);
        });
        if (backgroundRequest.noReply) {
          return promise.then(
            () => {
              if (backgroundRequest.refreshActivePage) {
                return refreshActivePageIfEnabled();
              }
            },
            (error: unknown) => {
              return Log.error(backgroundRequest.method + ' ==>', error);
            }
          );
        }
        return promise.then(
          (result: unknown) => {
            if (backgroundRequest.refreshActivePage) {
              refreshActivePageIfEnabled();
            }
            let responseResult: unknown = result;
            if (backgroundRequest.method === 'updateProfile' && isRecord(result)) {
              const encodedResult: Record<string, unknown> = {};
              for (const key in result) {
                if (!hasProp.call(result, key)) continue;
                const value = result[key];
                encodedResult[key] = encodeError(value);
              }
              responseResult = encodedResult;
            }
            return respond({
              result: responseResult
            });
          },
          (error: unknown) => {
            Log.error(backgroundRequest.method + ' ==>', error);
            return respond({
              error: encodeError(error)
            });
          }
        );
      },
      (error: unknown) => {
        Log.error(backgroundRequest.method + ' ==>', error);
        if (!backgroundRequest.noReply) {
          respond({
            error: encodeError(error)
          });
        }
      }
    );
    if (!backgroundRequest.noReply) {
      return true;
    }
  });
}).call(this);
