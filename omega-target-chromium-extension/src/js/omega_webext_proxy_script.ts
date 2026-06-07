type WebExtProxyProfile = Record<string, unknown> & {
  profileType?: string;
};

type WebExtProxyState = Record<string, unknown> & {
  currentProfileName?: string;
  tempProfile?: WebExtProxyProfile;
};

type WebExtProxyServer = {
  host: string;
  port: number;
  scheme: string;
};

type WebExtProxyAuth = {
  password?: string;
  username?: string;
};

type WebExtProxyInfo = {
  host: string;
  password?: string;
  port: number;
  proxyDNS?: boolean;
  type: string;
  username?: string;
};

type WebExtProxyMessage = {
  event?: string;
  options?: Record<string, unknown>;
  state?: WebExtProxyState;
};

(globalThis as typeof globalThis & {FindProxyForURL: ProxyFindFunction}).FindProxyForURL = (function () {
  const OmegaPac = require('omega-pac');
  let options: Record<string, unknown> = {};
  let state: WebExtProxyState = {};
  let activeProfile: WebExtProxyProfile | null = null;
  const fallbackResult = 'DIRECT';

  init();

  return FindProxyForURL;

  function FindProxyForURL(url: string, host: string, details?: unknown) {
    if (!activeProfile) {
      warn('Warning: Proxy script not initialized on handling: ' + url);
      return fallbackResult;
    }
    // Moz: Neither path or query is included url regardless of scheme for now.
    // This is even more strict than Chromium restricting HTTPS URLs.
    // Therefore, it leads to different behavior than the icon and badge.
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1337001
    const request = OmegaPac.Conditions.requestFromUrl(url);
    let profile = activeProfile;
    let next;
    while (profile) {
      const matchResult = OmegaPac.Profiles.match(profile, request)
      if (!matchResult) {
        if (profile.profileType === 'DirectProfile') {
          return 'DIRECT';
        } else {
          warn('Warning: Unsupported profile: ' + profile.profileType);
          return fallbackResult;
        }
      }

      if (Array.isArray(matchResult)) {
        next = matchResult[0];
        const proxy = matchResult[2] as WebExtProxyServer | undefined;
        const auth = matchResult[3] as WebExtProxyAuth | undefined;
        if (proxy) {
          const proxyInfo: WebExtProxyInfo = {
            type: proxy.scheme,
            host: proxy.host,
            port: proxy.port,
          };
          if (proxyInfo.type === 'socks5') {
            // MOZ: SOCKS5 proxies are identified by "type": "socks".
            // https://dxr.mozilla.org/mozilla-central/rev/ffe6cc09ccf38cca6f0e727837bbc6cb722d1e71/toolkit/components/extensions/ProxyScriptContext.jsm#51
            proxyInfo.type = 'socks';
            // Enable SOCKS5 remote DNS.
            // TODO(catus): Maybe allow the users to configure this?
            proxyInfo.proxyDNS = true;
          }
          if (auth) {
            proxyInfo.username = auth.username;
            proxyInfo.password = auth.password;
          }
          return [proxyInfo];
        }
      } else if (matchResult.profileName) {
        next = OmegaPac.Profiles.nameAsKey(matchResult.profileName)
      } else {
        return fallbackResult;
      }
      profile = OmegaPac.Profiles.byKey(next, options)
    }
    warn('Warning: Cannot find profile: ' + next);
    return fallbackResult;
  }

  function warn(message: string, error?: unknown) {
    // We don't have console here and alert is not implemented.
    // Throwing and messaging seems to be the only ways to communicate.
    // MOZ: alert(): https://bugzilla.mozilla.org/show_bug.cgi?id=1353510
    const result = browser.runtime.sendMessage({
      event: 'proxyScriptLog',
      message: message,
      error: error,
      level: 'warn',
    });
    if (result && result.catch) {
      result.catch(() => {});
    }
  }

  function init() {
    browser.runtime.onMessage.addListener((message: WebExtProxyMessage) => {
      if (message.event === 'proxyScriptStateChanged') {
        state = message.state!;
        options = message.options!;
        if (!state.currentProfileName) {
          activeProfile = state.tempProfile;
        } else {
          activeProfile = OmegaPac.Profiles.byName(state.currentProfileName,
            options);
        }
      }
    });
    const result = browser.runtime.sendMessage({event: 'proxyScriptLoaded'});
    if (result && result.catch) {
      result.catch(() => {});
    }
  }
})();
