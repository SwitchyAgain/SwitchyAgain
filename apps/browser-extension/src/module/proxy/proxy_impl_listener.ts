import OmegaTarget from '@switchyagain/extension-runtime';
import {NETWORK_REQUEST_URLS} from '../network_request_urls';
import ProxyImpl from './proxy_impl';
import type {
  ProxyCredentials,
  ProxyChangeWatcher,
  ProxyLog,
  ProxyProfile,
  ProxyProfileResolver,
  ProxyRequestDetails,
  ProxyServer
} from './proxy_types';

const OmegaPac = OmegaTarget.OmegaPac;
const NativePromise = typeof Promise !== 'undefined' && Promise !== null ? Promise : null;

type MatchedProxyServer = ProxyServer & {
  host: string;
  port: number;
  scheme: string;
};

type DirectProxyInfo = {
  type: 'direct';
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
  private _profileResolver: ProxyProfileResolver | null;
  private _scopeProfileNames: (() => string[]) | null;

  constructor(log: ProxyLog) {
    super(log);
    this.features = ['fullUrl', 'socks5Auth', 'tabProfileScope', 'groupProfileScope', 'containerProfileScope', 'windowProfileScope'];
    this.proxyAuthCapabilities = {
      http: true,
      https: true,
      socks4: false,
      socks5: true
    };
    this.proxyDnsCapabilities = {
      socks5: true
    };
    this._optionsReadyCallback = null;
    this._optionsReady = new (NativePromise as PromiseConstructor)((resolve) => {
      this._optionsReadyCallback = resolve;
    });
    this._profileResolver = null;
    this._scopeProfileNames = null;
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
      urls: NETWORK_REQUEST_URLS
    });
    return browser.proxy.onError.addListener(this.onError.bind(this));
  }

  watchProxyChange(_callback: ProxyChangeWatcher): null {
    return null;
  }

  setProfileResolver(resolver: ProxyProfileResolver | null, profileNames?: () => string[]) {
    this._profileResolver = resolver;
    this._scopeProfileNames = profileNames || null;
  }

  applyProfile(profile: ProxyProfile, _state?: unknown, options?: unknown) {
    this._options = options;
    this._profile = profile;
    if (typeof this._optionsReadyCallback === 'function') {
      this._optionsReadyCallback();
    }
    this._optionsReadyCallback = null;
    return this.setProxyAuth(profile, options, this._scopeProfileNames?.() || []);
  }

  onRequest(requestDetails: ProxyRequestDetails) {
    return (NativePromise as PromiseConstructor).resolve(this._optionsReady.then(() => {
      const request = OmegaPac.Conditions.requestFromUrl(requestDetails.url);
      let profile = this._profileResolver?.(requestDetails) || this._profile;
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
          const resultValue = result[0];
          if (typeof resultValue === 'string' && resultValue.charAt(0) === '+') {
            next = resultValue;
            profile = OmegaPac.Profiles.byKey(next, this._options);
            continue;
          }
          const proxy = result[2] as ProxyServer | undefined;
          const auth = result[3] as ProxyCredentials | undefined;
          return this.proxyInfoFromMatch(resultValue, proxy, auth);
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

  directProxyInfo(): DirectProxyInfo {
    return {
      type: 'direct'
    };
  }

  proxyInfoFromMatch(result: unknown, proxy?: ProxyServer, auth?: ProxyCredentials) {
    if (this.isDirectResult(result, proxy)) {
      return this.directProxyInfo();
    }
    const matchedProxy = this.normalizeProxyServer(proxy);
    if (!matchedProxy) {
      throw new Error(`Invalid proxy result: ${String(result)}`);
    }
    return this.proxyInfo(matchedProxy, auth);
  }

  isDirectResult(result: unknown, proxy?: ProxyServer) {
    return result === 'DIRECT' || proxy?.scheme === 'direct';
  }

  normalizeProxyServer(proxy?: ProxyServer): MatchedProxyServer | null {
    if (!proxy || typeof proxy.host !== 'string' || typeof proxy.scheme !== 'string') {
      return null;
    }
    const port = typeof proxy.port === 'number'
      ? proxy.port
      : typeof proxy.port === 'string'
        ? parseInt(proxy.port, 10)
        : NaN;
    if (!proxy.host || !proxy.scheme || !Number.isInteger(port) || port <= 0) {
      return null;
    }
    return {
      ...proxy,
      host: proxy.host,
      port,
      scheme: proxy.scheme
    };
  }

  proxyInfo(proxy: MatchedProxyServer, auth?: ProxyCredentials) {
    const proxyInfo: ProxyInfo = {
      type: proxy.scheme === 'socks5-local' ? 'socks5' : proxy.scheme,
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
      proxyInfo.proxyDNS = proxy.scheme !== 'socks5-local';
    }
    return [proxyInfo];
  }
}

export default ListenerProxyImpl;
