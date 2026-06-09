type BackgroundMethodArgs = {
  addCondition: [condition: unknown, profileName: string, addToBottom: boolean];
  addProfile: [profile: unknown];
  addTempRule: [domain: string, profileName: string];
  applyProfile: [name: string];
  getAll: [];
  getPageInfo: [args: PageInfoArgs];
  getState: [name: string | string[]];
  patch: [patch: Record<string, unknown>];
  renameProfile: [fromName: string, toName: string];
  replaceRef: [fromName: string, toName: string];
  reset: [options?: OmegaOptionsData | string];
  resetOptionsSync: [];
  setDefaultProfile: [profileName: string, defaultProfileName: string];
  setOptionsSync: [enabled: boolean, args?: unknown];
  setState: [items: Record<string, unknown>] | [name: string, value: unknown];
  updateProfile: [name?: string | string[] | null, bypassCache?: boolean | string];
};

type PageInfoArgs = {
  tabId: number;
  url?: string;
};

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
  transformValue?: unknown;
  [key: string]: unknown;
};

type BackgroundLog = OmegaOptionsBase['log'] & {
  method(name: string, self: unknown, args: IArguments | unknown[]): void;
  str(obj: unknown): string;
};

type BackgroundPromiseStatic = OmegaPromiseStatic & {
  longStackTraces(): void;
  onPossiblyUnhandledRejection(callback: (reason: unknown, promise: unknown) => unknown): void;
  onUnhandledRejectionHandled(callback: (promise: unknown) => unknown): void;
};

type BackgroundExternalApi = {
  disabled: boolean;
  listen(): unknown;
};

type BackgroundInspect = {
  disable?(): unknown;
  enable?(): unknown;
};

type BackgroundState = {
  get(keys: unknown): OmegaPromise<Record<string, unknown>>;
  remove(keys: string | string[]): OmegaPromise<unknown>;
  set(items: Record<string, unknown>): OmegaPromise<unknown>;
};

type BackgroundTabBadge = {
  color: string;
  text: string;
};

type BackgroundTabs = {
  processTab(tab: ChromeTab): unknown;
  resetAll(details: {
    icon: BackgroundIcon | null;
    shortTitle: string;
    title: string;
  }): unknown;
  setTabBadge(tab: ChromeTab, badge: BackgroundTabBadge): unknown;
  watch(): unknown;
};

type BackgroundProxyImpl = {
  features: string[];
  parseExternalProfile(details: ProxyChangeDetails, options?: OmegaOptionsData): BackgroundProfile | null | undefined;
  watchProxyChange(callback: (details: ProxyChangeDetails | null | undefined) => unknown): void | null;
};

type BackgroundOptions = BackgroundOptionMethods & {
  currentProfileChanged: (reason?: string) => unknown;
  clearBadge(): unknown;
  currentProfile(): BackgroundProfile | null | undefined;
  externalApi: BackgroundExternalApi;
  isCurrentProfileStatic(): boolean;
  matchProfile(request: unknown): OmegaPromise<BackgroundMatchResult>;
  printProfile(profile?: BackgroundProfile | null): unknown;
  profile(name?: unknown): BackgroundProfile;
  proxyNotControllable(): string | null;
  queryTempRule(domain: string): unknown;
  ready: OmegaPromise<unknown>;
  setBadge(): unknown;
  setExternalProfile(profile: BackgroundProfile, args?: {internal?: boolean; noRevert?: boolean}): Promise<unknown> | void;
  setProxyNotControllable(reason: string | null): unknown;
  _inspect: BackgroundInspect | null;
  _options: OmegaOptionsData;
};

type BackgroundCallable = (...args: unknown[]) => unknown;

type BackgroundDispatch = {
  method: BackgroundCallable;
  target: object;
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

type BackgroundMatchTuple = [
  result: unknown,
  condition?: BackgroundMatchConditionSource | null,
  ...rest: unknown[]
];

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

type BackgroundOmegaTarget = {
  BrowserStorage: new (storage: Storage, prefix: string) => BackgroundState;
  ChromeTabs: new (actionForUrl: (url: string) => Promise<BackgroundActionInfo | null>) => BackgroundTabs;
  ExternalApi: new (options: BackgroundOptions) => BackgroundExternalApi;
  Inspect: new (onInspect: (url: string, tab: ChromeTab) => unknown) => BackgroundInspect;
  Log: BackgroundLog;
  Options: (new (
    options: null,
    storage: unknown,
    state: BackgroundState,
    log: BackgroundLog,
    sync: BackgroundSync | undefined,
    proxyImpl: BackgroundProxyImpl
  ) => BackgroundOptions) & {
    transformValueForSync: unknown;
  };
  OptionsSync: new (storage: unknown) => BackgroundSync;
  Promise: BackgroundPromiseStatic;
  Storage: new (areaName: string) => unknown;
  Url: UrlModule;
  proxy: {
    getProxyImpl(log: BackgroundLog): BackgroundProxyImpl;
  };
};

(function() {
  const hasProp = {}.hasOwnProperty;

  const OmegaTargetChromiumModule = OmegaTargetChromium as unknown as BackgroundOmegaTarget & {
    default?: BackgroundOmegaTarget;
  };
  const OmegaTargetBase = OmegaTargetChromiumModule.default || OmegaTargetChromiumModule;
  const OmegaTargetCurrent = Object.create(OmegaTargetBase) as BackgroundOmegaTarget;

  const Promise = OmegaTargetCurrent.Promise;

  Promise.longStackTraces();

  function actionApi(): ChromeActionApi {
    let legacyKey = 'browser';
    legacyKey += 'Action';
    return (chrome.action || chrome[legacyKey]) as ChromeActionApi;
  }

  OmegaTargetCurrent.Log = Object.create(OmegaTargetCurrent.Log);

  const Log = OmegaTargetCurrent.Log;

  function writeLogToLocalStorage(content: string) {
    try {
      return localStorage['log'] += content;
    } catch (_) {
      return localStorage['log'] = content;
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

  function drawIcon(resultColor?: string, profileColor?: string): BackgroundIcon | null {
    const cacheKey = `omega+${resultColor != null ? resultColor : ''}+${profileColor}`;
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
      icon = {};
      for (const size of [16, 19, 24, 32, 38]) {
        drawContext.scale(size, size);
        drawContext.clearRect(0, 0, 1, 1);
        if (resultColor != null) {
          drawOmega(drawContext, resultColor, profileColor);
        } else {
          drawOmega(drawContext, profileColor);
        }
        drawContext.setTransform(1, 0, 0, 1, 0, 0);
        icon[size] = drawContext.getImageData(0, 0, size, size);
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
    return iconCache[cacheKey] = icon;
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

  function stringOrUndefined(value: unknown): string | undefined {
    return value == null ? undefined : String(value);
  }

  function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object';
  }

  let options: BackgroundOptions;
  let state: BackgroundState;
  let tabs: BackgroundTabs;
  let proxyImpl: BackgroundProxyImpl;

  function actionForUrl(url: string) {
    return options.ready.then(() => {
      const request = OmegaPac.Conditions.requestFromUrl(url);
      return options.matchProfile(request);
    }).then((arg) => {
      const profile = arg.profile;
      const results = arg.results;
      let current = options.currentProfile() as BackgroundProfile;
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
        return isRecord(condition) && condition.pattern != null
          ? String(condition.pattern)
          : OmegaPac.Conditions.str(condition);
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
      let resultColor = profile.color;
      let profileColor = current.color;
      let icon = null;
      if (direct) {
        resultColor = stringOrUndefined(options.profile('direct').color);
        profileColor = profile.color;
      } else if (profile.name === current.name && options.isCurrentProfileStatic()) {
        resultColor = profileColor = profile.color;
        icon = drawIcon(profile.color);
      } else {
        resultColor = profile.color;
        profileColor = current.color;
      }
      if (icon == null) {
        icon = drawIcon(resultColor, profileColor);
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
    }).catch((): null => {
      return null;
    });
  }

  const storage = new OmegaTargetCurrent.Storage('local');

  state = new OmegaTargetCurrent.BrowserStorage(localStorage, 'omega.local.');

  let sync: BackgroundSync | undefined;
  if (
    (typeof chrome !== "undefined" && chrome !== null && chrome.storage?.sync) ||
    (typeof browser !== "undefined" && browser !== null && browser.storage?.sync)
  ) {
    const syncStorage = new OmegaTargetCurrent.Storage('sync');
    sync = new OmegaTargetCurrent.OptionsSync(syncStorage) as BackgroundSync;
    if (localStorage['omega.local.syncOptions'] !== '"sync"') {
      sync.enabled = false;
    }
    sync.transformValue = OmegaTargetCurrent.Options.transformValueForSync;
  }

  proxyImpl = OmegaTargetCurrent.proxy.getProxyImpl(Log);

  state.set({
    proxyImplFeatures: proxyImpl.features
  });

  options = new OmegaTargetCurrent.Options(null, storage, state, Log, sync, proxyImpl);

  options.externalApi = new OmegaTargetCurrent.ExternalApi(options);

  options.externalApi.listen();

  tabs = new OmegaTargetCurrent.ChromeTabs(actionForUrl);

  tabs.watch();

  options._inspect = new OmegaTargetCurrent.Inspect((url: string, tab: ChromeTab) => {
    if (url === tab.url) {
      options.clearBadge();
      tabs.processTab(tab);
      state.remove('inspectUrl');
      return;
    }
    state.set({
      inspectUrl: url
    });
    return actionForUrl(url).then((action) => {
      if (!action) {
        return;
      }
      const parsedUrl = OmegaTargetCurrent.Url.parse(url);
      let urlDisp: string | undefined;
      if (parsedUrl.hostname === OmegaTargetCurrent.Url.parse(tab.url).hostname) {
        urlDisp = stringOrUndefined(parsedUrl.path);
      } else {
        urlDisp = stringOrUndefined(parsedUrl.hostname);
      }
      let title = chrome.i18n.getMessage('browserAction_titleInspect', urlDisp) + '\n';
      title += action.title;
      actionApi().setTitle({
        title: title,
        tabId: tab.id
      });
      return tabs.setTabBadge(tab, {
        text: '#',
        color: action.resultColor
      });
    });
  });

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
      case "controlled_by_other_extensions":
      case "not_controllable":
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
    if (!current.name || !OmegaPac.Profiles.isInclusive(current)) {
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
    return chrome.tabs.query({
      active: true,
      lastFocusedWindow: true
    }, (tabs) => {
      const url = tabs[0].url;
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
      return chrome.tabs.reload(tabs[0].id, {
        bypassCache: true
      }, () => {
        chrome.runtime.lastError;
      });
    });
  }

  function isBackgroundMethod(method: unknown): method is BackgroundMethod {
    switch (method) {
      case 'addCondition':
      case 'addProfile':
      case 'addTempRule':
      case 'applyProfile':
      case 'getAll':
      case 'getPageInfo':
      case 'getState':
      case 'patch':
      case 'renameProfile':
      case 'replaceRef':
      case 'reset':
      case 'resetOptionsSync':
      case 'setDefaultProfile':
      case 'setOptionsSync':
      case 'setState':
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

  chrome.runtime.onMessage.addListener((request: unknown, _sender: unknown, respond: BackgroundRespond) => {
    if (!isRecord(request) || typeof request.method !== 'string') {
      return;
    }
    const backgroundRequest = request as RawBackgroundRequest;
    options.ready.then(() => {
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
        return promise.then(() => {
          if (backgroundRequest.refreshActivePage) {
            return refreshActivePageIfEnabled();
          }
        }, (error: unknown) => {
          return Log.error(backgroundRequest.method + ' ==>', error);
        });
      }
      return promise.then((result: unknown) => {
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
      }, (error: unknown) => {
        Log.error(backgroundRequest.method + ' ==>', error);
        return respond({
          error: encodeError(error)
        });
      });
    });
    if (!backgroundRequest.noReply) {
      return true;
    }
  });

}).call(this);
