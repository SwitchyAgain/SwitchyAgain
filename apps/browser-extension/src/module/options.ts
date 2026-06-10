import OmegaTarget from '@switchyagain/extension-runtime';
import ChromePort from './chrome_port';
import fetchUrl from './fetch_url';
import upgradeSwitchyOptions from './upgrade';
import WebRequestMonitor from './web_request_monitor';
import type {ProxyImplInstance, ProxyProfile} from './proxy/proxy_types';

const OmegaPac = OmegaTarget.OmegaPac;
const OmegaPromise = OmegaTarget.Promise;

type BadgeOptions = {
  color: string;
  text: string;
  title?: string;
};

type Profile = ProxyProfile;

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

type TabRequestInfo = {
  badgeSet?: boolean;
  errorCount: number;
  summary: Record<string, RequestSummaryItem>;
  [key: string]: unknown;
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

type SwitchySharpLike = {
  getOptions(): {
    timeout(milliseconds: number): Promise<Record<string, string>>;
  };
};

type UpgradeOptions = Record<string, unknown> & {
  config?: string;
  schemaVersion?: unknown;
};

type PageInfoArgs = {
  tabId: number;
  url?: string;
};

function actionApi(): ChromeActionApi {
  const legacyKey = 'browser' + 'Action';
  return (chrome.action || chrome[legacyKey]) as ChromeActionApi;
}

interface ChromeOptions extends OmegaOptionsBase {}

function defaultUiLocaleFromBrowser(language = chrome.i18n?.getUILanguage?.() || '') {
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

class ChromeOptions extends OmegaTarget.Options {
  externalApi: ExternalApiLike;
  fetchUrl: typeof fetchUrl;
  proxyImpl: ProxyImplInstance;
  switchySharp: SwitchySharpLike | null;
  private _alarms: Record<string, () => void> | null;
  private _badgeTitle: string | null;
  private _inspect: InspectLike | null;
  private _monitorWebRequests: boolean;
  private _proxyNotControllable: string | null;
  private _quickSwitchCanEnable: boolean;
  private _quickSwitchHandlerReady: boolean;
  private _quickSwitchInit: boolean;
  private _requestMonitor: RequestMonitorLike | null;
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
    this._monitorWebRequests = false;
    this._tabRequestInfoPorts = null;
    this._alarms = null;
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
    if (quickSwitch || actionApi().setPopup == null) {
      const api = actionApi();
      if (typeof api.setPopup === 'function') {
        api.setPopup({
          popup: ''
        });
      }
      if (!this._quickSwitchInit) {
        this._quickSwitchInit = true;
        actionApi().onClicked.addListener((tab: {id?: number; url?: string}) => {
          this.clearBadge();
          if (!this._options['-enableQuickSwitch']) {
            chrome.tabs.create({
              url: 'popup/index.html'
            });
            return;
          }
          const profiles = this._options['-quickSwitchProfiles'];
          let index = profiles.indexOf(this._currentProfileName);
          index = (index + 1) % profiles.length;
          return this.applyProfile(profiles[index]).then(() => {
            if (this._options['-refreshOnProfileChange']) {
              const url = tab.url;
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
      actionApi().setPopup({
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
      this._requestMonitor = new WebRequestMonitor(wildcardForReq);
      this._requestMonitor.watchTabs((tabId: number, info: TabRequestInfo) => {
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
        port.onMessage.addListener((msg: {tabId: number}) => {
          tabId = msg.tabId;
          if (this._tabRequestInfoPorts) {
            this._tabRequestInfoPorts[tabId] = port;
          }
          const info = this._requestMonitor.tabInfo[tabId];
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
    return super.upgrade(options).catch((err: unknown) => {
      if (options?.schemaVersion) {
        return OmegaPromise.reject(err);
      }
      let getOldOptions: Promise<Record<string, string> | UpgradeOptions> = this.switchySharp
        ? this.switchySharp.getOptions().timeout(1000)
        : OmegaPromise.reject();
      getOldOptions = getOldOptions.catch(() => {
        if (options?.config) {
          return OmegaPromise.resolve(options);
        }
        if (localStorage.config) {
          return OmegaPromise.resolve(localStorage as unknown as Record<string, string>);
        }
        return OmegaPromise.reject(new OmegaTarget.Options.NoOptionsError());
      });
      return getOldOptions.then((oldOptions) => {
        const i18n = {
          upgrade_profile_auto: chrome.i18n.getMessage('upgrade_profile_auto')
        };
        let upgraded;
        try {
          upgraded = upgradeSwitchyOptions(oldOptions as Record<string, string>, i18n);
        } catch (error) {
          this.log.error(error);
          return OmegaPromise.reject(error);
        }
        if (localStorage.config) {
          Object.getPrototypeOf(localStorage).clear.call(localStorage);
        }
        this._state.set({
          firstRun: 'upgrade'
        });
        return super.upgrade(upgraded, upgraded);
      });
    });
  }

  onFirstRun(_reason: string) {
    return chrome.tabs.create({
      url: chrome.runtime.getURL('options.html')
    });
  }

  getPageInfo({tabId, url}: PageInfoArgs) {
    const tabInfo = this._requestMonitor?.tabInfo[tabId];
    const errorCount = tabInfo?.errorCount;
    const summary = tabInfo?.summary;
    const result = errorCount ? {
      errorCount,
      summary
    } : null;
    const getBadge = new OmegaPromise((resolve: (value: string) => void) => {
      if (actionApi().getBadgeText == null) {
        resolve('');
        return;
      }
      return actionApi().getBadgeText({
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
      return {
        url,
        domain,
        tempRuleProfileName: this.queryTempRule(domain),
        errorCount,
        summary
      };
    });
  }
}

export default ChromeOptions;
