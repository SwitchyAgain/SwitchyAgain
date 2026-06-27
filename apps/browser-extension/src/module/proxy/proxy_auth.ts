import OmegaTarget from '@switchyagain/extension-runtime';
import {NETWORK_REQUEST_URLS} from '../network_request_urls';
import type {
  ProxyAuthEndpoint,
  ProxyCredentials,
  ProxyLog,
  ProxyProfile
} from './proxy_types';

const OmegaPac = OmegaTarget.OmegaPac;

type ProxyAuthEntry = {
  auth: ProxyCredentials;
  config?: ProxyAuthEndpoint;
  name: string;
};

type AuthRequest = {
  authTries: number;
};

type AuthDetails = {
  challenger: ProxyAuthEndpoint;
  isProxy?: boolean;
  requestId: string;
};

type AuthResponse = {
  authCredentials?: ProxyCredentials;
};

class ProxyAuth {
  listening: boolean;
  log: ProxyLog;
  private _fallbacks: ProxyAuthEntry[];
  private _proxies: Record<string, ProxyAuthEntry[]>;
  private _requests: Record<string, AuthRequest>;

  constructor(log: ProxyLog) {
    this._requests = {};
    this._proxies = {};
    this._fallbacks = [];
    this.log = log;
    this.listening = false;
  }

  listen() {
    if (this.listening) {
      return;
    }
    if (!chrome.webRequest) {
      this.log.error('Proxy auth disabled! No webRequest permission.');
      return;
    }
    if (!chrome.webRequest.onAuthRequired) {
      this.log.error('Proxy auth disabled! onAuthRequired not available.');
      return;
    }
    chrome.webRequest.onAuthRequired.addListener(this.authHandler.bind(this), {
      urls: NETWORK_REQUEST_URLS
    }, ['asyncBlocking']);
    chrome.webRequest.onCompleted.addListener(this._requestDone.bind(this), {
      urls: NETWORK_REQUEST_URLS
    });
    chrome.webRequest.onErrorOccurred.addListener(this._requestDone.bind(this), {
      urls: NETWORK_REQUEST_URLS
    });
    this.listening = true;
  }

  private _keyForProxy(proxy: ProxyAuthEndpoint) {
    return `${proxy.host.toLowerCase()}:${proxy.port}`;
  }

  setProxies(profiles: ProxyProfile[]) {
    this._proxies = {};
    this._fallbacks = [];
    const results = [];
    for (const profile of profiles) {
      if (!profile.auth) {
        continue;
      }
      for (const scheme of OmegaPac.Profiles.schemes) {
        const prop = scheme.prop as string;
        if (!profile[prop]) {
          continue;
        }
        const auth = profile.auth?.[prop];
        if (!auth) {
          continue;
        }
        const proxy = profile[prop] as ProxyAuthEndpoint;
        const key = this._keyForProxy(proxy);
        let list = this._proxies[key];
        if (list == null) {
          this._proxies[key] = list = [];
        }
        list.push({
          config: proxy,
          auth,
          name: `${profile.name}.${prop}`
        });
      }
      const fallback = profile.auth?.all;
      if (fallback != null) {
        results.push(this._fallbacks.push({
          auth: fallback,
          name: `${profile.name}.all`
        }));
      } else {
        results.push(undefined);
      }
    }
    return results;
  }

  authHandler(details: AuthDetails, callback?: (result: AuthResponse) => void) {
    const respond = (result: AuthResponse) => {
      if (callback != null) {
        return callback(result);
      }
      return result;
    };
    if (!details.isProxy) {
      return respond({});
    }
    let req = this._requests[details.requestId];
    if (req == null) {
      this._requests[details.requestId] = req = {
        authTries: 0
      };
    }
    const key = this._keyForProxy({
      host: details.challenger.host,
      port: details.challenger.port
    });
    const list = this._proxies[key];
    const listLen = list != null ? list.length : 0;
    const proxy = req.authTries < listLen
      ? list[req.authTries]
      : this._fallbacks[req.authTries - listLen];
    this.log.log('ProxyAuth', key, req.authTries, proxy?.name);
    if (proxy == null) {
      return respond({});
    }
    req.authTries++;
    return respond({
      authCredentials: proxy.auth
    });
  }

  private _requestDone(details: {requestId: string}) {
    return delete this._requests[details.requestId];
  }
}

export default ProxyAuth;
