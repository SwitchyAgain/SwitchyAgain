const OmegaTarget = require('omega-target');
const OmegaPac = OmegaTarget.OmegaPac;
const {chromeApiPromisify} = require('../chrome_api');
const ProxyImpl = require('./proxy_impl');

type ProxyServer = {
  host?: string;
  port?: number;
  scheme?: string;
};

type Condition = {
  pattern?: string;
  [key: string]: unknown;
};

type Profile = Record<string, unknown> & {
  bypassList?: Condition[];
  fallbackProxy?: ProxyServer;
  name?: string;
  pacScript?: string;
  pacUrl?: string;
  profileType?: string;
};

type ProxyRules = Record<string, unknown> & {
  bypassList?: string[];
  fallbackProxy?: ProxyServer;
  proxyForFtp?: ProxyServer;
  proxyForHttp?: ProxyServer;
  proxyForHttps?: ProxyServer;
  singleProxy?: ProxyServer;
};

type ProxyConfig = {
  mode?: string;
  pacScript?: {
    data?: string;
    mandatory: boolean;
    url?: string;
  };
  rules?: ProxyRules;
};

type ExternalProxyDetails = {
  name?: string;
  value: {
    mode: string;
    pacScript?: {
      data?: string;
      url?: string;
    };
    rules?: ProxyRules;
  };
};

class SettingsProxyImpl extends ProxyImpl {
  features: string[];
  private _proxyChangeWatchers: Array<(details: unknown) => unknown> | null;

  constructor(...args: unknown[]) {
    super(...args);
    this.features = ['fullUrlHttp', 'pacScript', 'watchProxyChange'];
    this._proxyChangeWatchers = null;
  }

  static isSupported() {
    return chrome?.proxy?.settings != null;
  }

  applyProfile(profile: Profile, meta: Profile = profile, options: unknown) {
    if (profile.profileType === 'SystemProfile') {
      return chromeApiPromisify(chrome.proxy.settings, 'clear')({}).then(() => {
        chrome.proxy.settings.get({}, this._proxyChangeListener);
      });
    }

    let config: ProxyConfig = {};
    if (profile.profileType === 'DirectProfile') {
      config.mode = 'direct';
    } else if (profile.profileType === 'PacProfile') {
      config.mode = 'pac_script';
      config.pacScript = !profile.pacScript || OmegaPac.Profiles.isFileUrl(profile.pacUrl) ? {
        url: profile.pacUrl,
        mandatory: true
      } : {
        data: OmegaPac.PacGenerator.ascii(profile.pacScript),
        mandatory: true
      };
    } else if (profile.profileType === 'FixedProfile') {
      config = this._fixedProfileConfig(profile);
    } else {
      config.mode = 'pac_script';
      config.pacScript = {
        mandatory: true,
        data: this.getProfilePacScript(profile, meta, options)
      };
    }

    return this.setProxyAuth(profile, options).then(() => {
      return chromeApiPromisify(chrome.proxy.settings, 'set')({
        value: config
      });
    }).then(() => {
      chrome.proxy.settings.get({}, this._proxyChangeListener);
    });
  }

  private _fixedProfileConfig(profile: Profile) {
    const config: ProxyConfig = {
      mode: 'fixed_servers'
    };
    const rules: ProxyRules = {};
    const protocols = ['proxyForHttp', 'proxyForHttps', 'proxyForFtp'];
    let protocolProxySet = false;
    for (const protocol of protocols) {
      if (profile[protocol] == null) {
        continue;
      }
      rules[protocol] = profile[protocol];
      protocolProxySet = true;
    }

    if (profile.fallbackProxy) {
      if (profile.fallbackProxy.scheme === 'http') {
        if (!protocolProxySet) {
          rules.singleProxy = profile.fallbackProxy;
        } else {
          for (const protocol of protocols) {
            if (rules[protocol] == null) {
              rules[protocol] = JSON.parse(JSON.stringify(profile.fallbackProxy));
            }
          }
        }
      } else {
        rules.fallbackProxy = profile.fallbackProxy;
      }
    } else if (!protocolProxySet) {
      config.mode = 'direct';
    }

    if (config.mode !== 'direct') {
      const bypassList: string[] = [];
      for (const condition of profile.bypassList || []) {
        bypassList.push(this._formatBypassItem(condition));
      }
      rules.bypassList = bypassList;
      config.rules = rules;
    }
    return config;
  }

  private _formatBypassItem(condition: Condition) {
    const str = OmegaPac.Conditions.str(condition);
    const index = str.indexOf(' ');
    return str.substr(index + 1);
  }

  private _proxyChangeListener(details: unknown) {
    const watchers = this._proxyChangeWatchers || [];
    return watchers.map((watcher) => watcher(details));
  }

  watchProxyChange(callback: (details: unknown) => unknown) {
    if (this._proxyChangeWatchers == null) {
      this._proxyChangeWatchers = [];
      if (chrome?.proxy?.settings?.onChange != null) {
        chrome.proxy.settings.onChange.addListener(this._proxyChangeListener.bind(this));
      }
    }
    this._proxyChangeWatchers.push(callback);
  }

  parseExternalProfile(details: ExternalProxyDetails | Profile, options?: unknown) {
    if ((details as Profile).name) {
      return details;
    }
    const externalDetails = details as ExternalProxyDetails;
    switch (externalDetails.value.mode) {
      case 'system':
        return OmegaPac.Profiles.byName('system');
      case 'direct':
        return OmegaPac.Profiles.byName('direct');
      case 'auto_detect':
        return OmegaPac.Profiles.create({
          profileType: 'PacProfile',
          name: '',
          pacUrl: 'http://wpad/wpad.dat'
        });
      case 'pac_script':
        return this._parsePacScriptExternalProfile(externalDetails, options);
      case 'fixed_servers':
        return this._parseFixedExternalProfile(externalDetails, options);
    }
  }

  private _parsePacScriptExternalProfile(details: ExternalProxyDetails, options: unknown) {
    const url = details.value.pacScript?.url;
    if (url) {
      let profile: Profile | null = null;
      OmegaPac.Profiles.each(options, (_key: string, candidate: Profile) => {
        if (candidate.profileType === 'PacProfile' && candidate.pacUrl === url) {
          profile = candidate;
        }
      });
      return profile != null ? profile : OmegaPac.Profiles.create({
        profileType: 'PacProfile',
        name: '',
        pacUrl: url
      });
    }

    let profile: Profile | null = null;
    let script = details.value.pacScript?.data || '';
    OmegaPac.Profiles.each(options, (_key: string, candidate: Profile) => {
      if (candidate.profileType === 'PacProfile' && candidate.pacScript === script) {
        profile = candidate;
      }
    });
    if (profile) {
      return profile;
    }

    script = script.trim();
    const magic = '/*OmegaProfile*';
    if (script.substr(0, magic.length) === magic) {
      const end = script.indexOf('*/');
      if (end > 0) {
        const tokens = script.substring(magic.length, end).split('*');
        let profileName = tokens[0] as string | null;
        const revision = tokens[1];
        try {
          profileName = JSON.parse(profileName);
        } catch (error) {
          profileName = null;
        }
        if (profileName && revision) {
          profile = OmegaPac.Profiles.byName(profileName, options);
          if (OmegaPac.Revision.compare(profile.revision, revision) === 0) {
            return profile;
          }
        }
      }
    }

    return OmegaPac.Profiles.create({
      profileType: 'PacProfile',
      name: '',
      pacScript: script
    });
  }

  private _parseFixedExternalProfile(details: ExternalProxyDetails, options: unknown) {
    const props = ['proxyForHttp', 'proxyForHttps', 'proxyForFtp', 'fallbackProxy', 'singleProxy'];
    const rules = details.value.rules || {};
    const proxies: Record<string, unknown> = {};
    for (const prop of props) {
      const result = OmegaPac.Profiles.pacResult(rules[prop]);
      if (prop === 'singleProxy' && rules[prop] != null) {
        proxies.fallbackProxy = result;
      } else {
        proxies[prop] = result;
      }
    }

    const bypassSet: Record<string, boolean> = {};
    let bypassCount = 0;
    if (rules.bypassList) {
      for (const pattern of rules.bypassList) {
        bypassSet[pattern] = true;
        bypassCount++;
      }
    }
    if (bypassSet['<local>']) {
      for (const host of OmegaPac.Conditions.localHosts) {
        if (!bypassSet[host]) {
          continue;
        }
        delete bypassSet[host];
        bypassCount--;
      }
    }

    let profile: Profile | null = null;
    OmegaPac.Profiles.each(options, (_key: string, candidate: Profile) => {
      if (candidate.profileType !== 'FixedProfile') {
        return;
      }
      if ((candidate.bypassList || []).length !== bypassCount) {
        return;
      }
      for (const condition of candidate.bypassList || []) {
        if (!condition.pattern || !bypassSet[condition.pattern]) {
          return;
        }
      }
      const candidateRules = this._fixedProfileConfig(candidate).rules;
      if (!candidateRules) {
        return;
      }
      if (candidateRules.singleProxy) {
        candidateRules.fallbackProxy = candidateRules.singleProxy;
        delete candidateRules.singleProxy;
      }
      for (const prop of props) {
        if (candidateRules[prop] || proxies[prop]) {
          if (OmegaPac.Profiles.pacResult(candidateRules[prop]) !== proxies[prop]) {
            return;
          }
        }
      }
      profile = candidate;
    });
    if (profile) {
      return profile;
    }

    profile = OmegaPac.Profiles.create({
      profileType: 'FixedProfile',
      name: ''
    });
    for (const prop of props) {
      if (rules[prop]) {
        if (prop === 'singleProxy') {
          profile.fallbackProxy = rules[prop] as ProxyServer;
        } else {
          profile[prop] = rules[prop];
        }
      }
    }
    profile.bypassList = Object.keys(bypassSet).map((pattern) => ({
      conditionType: 'BypassCondition',
      pattern
    }));
    return profile;
  }
}

export = SettingsProxyImpl;
