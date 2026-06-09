import OmegaTarget from '@switchyagain/extension-runtime';
import ProxyImpl from './proxy_impl';
import type {ProxyChangeWatcher, ProxyLog, ProxyProfile} from './proxy_types';

const OmegaPromise = OmegaTarget.Promise;

type ProxyScriptState = Record<string, unknown> & {
  currentProfileName?: string;
  tempProfile?: ProxyProfile;
};

class ScriptProxyImpl extends ProxyImpl {
  private _options?: unknown;
  private _proxyScriptDisabled: boolean;
  private _proxyScriptInitialized: boolean;
  private _proxyScriptState: ProxyScriptState;
  private _proxyScriptUrl: string;

  constructor(log: ProxyLog) {
    super(log);
    this.features = ['socks5Auth'];
    this._proxyScriptUrl = 'js/omega_webext_proxy_script.min.js';
    this._proxyScriptDisabled = false;
    this._proxyScriptInitialized = false;
    this._proxyScriptState = {};
  }

  static isSupported() {
    return typeof browser !== 'undefined' &&
      (browser?.proxy?.register != null || browser?.proxy?.registerProxyScript != null);
  }

  watchProxyChange(_callback: ProxyChangeWatcher): null {
    return null;
  }

  applyProfile(profile: ProxyProfile, state: ProxyScriptState = {}, options?: unknown) {
    this.log.error(
      'Your browser is outdated! Full-URL based matching, etc. unsupported! Please update your browser ASAP!'
    );
    this._options = options;
    state.currentProfileName = profile.name;
    if (profile.name === '') {
      state.tempProfile = profile;
    }
    if (profile.profileType === 'SystemProfile') {
      if (browser.proxy.unregister != null) {
        browser.proxy.unregister();
      } else {
        browser.proxy.registerProxyScript('js/omega_invalid_proxy_script.js');
      }
      this._proxyScriptDisabled = true;
    } else {
      this._proxyScriptState = state;
      this._initWebextProxyScript().then(() => {
        return this._proxyScriptStateChanged();
      });
    }
    return this.setProxyAuth(profile, options);
  }

  private _initWebextProxyScript() {
    let promise;
    if (!this._proxyScriptInitialized) {
      browser.proxy.onProxyError.addListener((err: {message?: string}) => {
        if (err?.message != null && err.message.indexOf('Invalid Proxy Rule: DIRECT') >= 0) {
          return;
        }
        return this.log.error(err);
      });
      browser.runtime.onMessage.addListener((message: {event?: string; level?: string}) => {
        if (message.event !== 'proxyScriptLog') {
          return;
        }
        if (message.level === 'error') {
          return this.log.error(message);
        }
        if (message.level === 'warn') {
          return this.log.error(message);
        }
        return this.log.log(message);
      });
    }
    if (!this._proxyScriptInitialized || this._proxyScriptDisabled) {
      promise = new OmegaPromise((resolve: () => void) => {
        const onMessage = (message: {event?: string}) => {
          if (message.event !== 'proxyScriptLoaded') {
            return;
          }
          resolve();
          browser.runtime.onMessage.removeListener(onMessage);
        };
        return browser.runtime.onMessage.addListener(onMessage);
      });
      if (browser.proxy.register != null) {
        browser.proxy.register(this._proxyScriptUrl);
      } else {
        browser.proxy.registerProxyScript(this._proxyScriptUrl);
      }
      this._proxyScriptDisabled = false;
    } else {
      promise = OmegaPromise.resolve();
    }
    this._proxyScriptInitialized = true;
    return promise;
  }

  private _proxyScriptStateChanged() {
    return browser.runtime.sendMessage({
      event: 'proxyScriptStateChanged',
      state: this._proxyScriptState,
      options: this._options
    }, {
      toProxyScript: true
    }).catch((error: {message?: string}) => {
      if (error && /Receiving end does not exist/.test(error.message || '')) {
        return;
      }
      throw error;
    });
  }
}

export default ScriptProxyImpl;
