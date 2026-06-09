import OmegaTarget from '@switchyagain/extension-runtime';
import ProxyImpl from './proxy_impl';
import type {
  ProxyCredentials,
  ProxyChangeWatcher,
  ProxyLog,
  ProxyProfile,
  ProxyServer
} from './proxy_types';

const OmegaPac = OmegaTarget.OmegaPac;
const NativePromise = typeof Promise !== 'undefined' && Promise !== null ? Promise : null;

type MatchedProxyServer = ProxyServer & {
  host: string;
  port: number;
  scheme: string;
};

type RequestDetails = {
  url: string;
};

type ProxyInfo = {
  host: string;
  password?: string;
  port: number;
  proxyDNS?: boolean;
  type: string;
  username?: string;
};

class ListenerProxyImpl extends ProxyImpl {
  private _options?: unknown;
  private _optionsReady: Promise<void>;
  private _optionsReadyCallback: (() => void) | null;
  private _profile?: ProxyProfile;

  constructor(log: ProxyLog) {
    super(log);
    this.features = ['fullUrl', 'socks5Auth'];
    this._optionsReadyCallback = null;
    this._optionsReady = new (NativePromise as PromiseConstructor)((resolve) => {
      this._optionsReadyCallback = resolve;
    });
    this._initRequestListeners();
  }

  static isSupported() {
    return typeof Promise !== 'undefined' &&
      Promise !== null &&
      typeof browser !== 'undefined' &&
      browser?.proxy?.onRequest != null;
  }

  private _initRequestListeners() {
    browser.proxy.onRequest.addListener(this.onRequest.bind(this), {
      urls: ['<all_urls>']
    });
    return browser.proxy.onError.addListener(this.onError.bind(this));
  }

  watchProxyChange(_callback: ProxyChangeWatcher): null {
    return null;
  }

  applyProfile(profile: ProxyProfile, _state?: unknown, options?: unknown) {
    this._options = options;
    this._profile = profile;
    if (typeof this._optionsReadyCallback === 'function') {
      this._optionsReadyCallback();
    }
    this._optionsReadyCallback = null;
    return this.setProxyAuth(profile, options);
  }

  onRequest(requestDetails: RequestDetails) {
    return (NativePromise as PromiseConstructor).resolve(this._optionsReady.then(() => {
      const request = OmegaPac.Conditions.requestFromUrl(requestDetails.url);
      let profile = this._profile;
      let next;
      while (profile) {
        const result = OmegaPac.Profiles.match(profile, request);
        if (!result) {
          switch (profile.profileType) {
            case 'DirectProfile':
              return {
                type: 'direct'
              };
            case 'SystemProfile':
              return undefined;
            default:
              throw new Error(`Unsupported profile: ${profile.profileType}`);
          }
        }
        if (Array.isArray(result)) {
          const proxy = result[2] as MatchedProxyServer | undefined;
          const auth = result[3] as ProxyCredentials | undefined;
          if (proxy) {
            return this.proxyInfo(proxy, auth);
          }
          next = result[0];
        } else if (result.profileName) {
          next = OmegaPac.Profiles.nameAsKey(result.profileName);
        } else {
          break;
        }
        profile = OmegaPac.Profiles.byKey(next, this._options);
      }
      throw new Error(`Profile not found: ${next}`);
    }));
  }

  onError(error: unknown) {
    return this.log.error(error);
  }

  proxyInfo(proxy: MatchedProxyServer, auth?: ProxyCredentials) {
    const proxyInfo: ProxyInfo = {
      type: proxy.scheme,
      host: proxy.host,
      port: proxy.port
    };
    if (proxyInfo.type === 'socks5') {
      proxyInfo.type = 'socks';
      if (auth) {
        proxyInfo.username = auth.username;
        proxyInfo.password = auth.password;
      }
    }
    if (proxyInfo.type === 'socks') {
      proxyInfo.proxyDNS = true;
    }
    return [proxyInfo];
  }
}

export default ListenerProxyImpl;
