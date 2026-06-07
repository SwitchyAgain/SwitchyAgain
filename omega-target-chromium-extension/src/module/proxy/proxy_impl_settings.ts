import OmegaTarget from 'omega-target';
import {chromeApiPromisify} from '../chrome_api';
import ProxyImpl from './proxy_impl';
import type {
  ExternalProxyDetails,
  ProxyChangeDetails,
  ProxyChangeWatcher,
  ProxyCondition,
  ProxyLog,
  ProxyProfile,
  ProxyRules,
  ProxyServer,
  ProxySettingsConfig
} from './proxy_types';

const OmegaPac = OmegaTarget.OmegaPac;

const FIXED_PROXY_RULE_KEYS = [
  'proxyForHttp',
  'proxyForHttps',
  'proxyForFtp',
  'fallbackProxy',
  'singleProxy'
] as const;

const PROTOCOL_PROXY_RULE_KEYS = ['proxyForHttp', 'proxyForHttps', 'proxyForFtp'] as const;

type FixedProxyRuleKey = typeof FIXED_PROXY_RULE_KEYS[number];

class SettingsProxyImpl extends ProxyImpl {
  private _proxyChangeListener: (details: ProxyChangeDetails) => unknown[];
  private _proxyChangeWatchers: ProxyChangeWatcher[] | null;

  constructor(log: ProxyLog) {
    super(log);
    this.features = ['fullUrlHttp', 'pacScript', 'watchProxyChange'];
    this._proxyChangeWatchers = null;
    this._proxyChangeListener = this._handleProxyChange.bind(this);
  }

  static isSupported() {
    return chrome?.proxy?.settings != null;
  }

  applyProfile(profile: ProxyProfile, meta: ProxyProfile = profile, options?: unknown) {
    if (profile.profileType === 'SystemProfile') {
      return chromeApiPromisify<void>(chrome.proxy.settings, 'clear')({}).then(() => {
        chrome.proxy.settings.get({}, this._proxyChangeListener);
      });
    }

    let config: ProxySettingsConfig = {};
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
      return chromeApiPromisify<void>(chrome.proxy.settings, 'set')({
        value: config
      });
    }).then(() => {
      chrome.proxy.settings.get({}, this._proxyChangeListener);
    });
  }

  private _fixedProfileConfig(profile: ProxyProfile) {
    const config: ProxySettingsConfig = {
      mode: 'fixed_servers'
    };
    const rules: ProxyRules = {};
    let protocolProxySet = false;
    for (const protocol of PROTOCOL_PROXY_RULE_KEYS) {
      const proxy = profile[protocol] as ProxyServer | undefined;
      if (proxy == null) {
        continue;
      }
      rules[protocol] = proxy;
      protocolProxySet = true;
    }

    if (profile.fallbackProxy) {
      if (profile.fallbackProxy.scheme === 'http') {
        if (!protocolProxySet) {
          rules.singleProxy = profile.fallbackProxy;
        } else {
          for (const protocol of PROTOCOL_PROXY_RULE_KEYS) {
            if (rules[protocol] == null) {
              rules[protocol] = JSON.parse(JSON.stringify(profile.fallbackProxy)) as ProxyServer;
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

  private _formatBypassItem(condition: ProxyCondition) {
    const str = OmegaPac.Conditions.str(condition);
    const index = str.indexOf(' ');
    return str.slice(index + 1);
  }

  private _handleProxyChange(details: ProxyChangeDetails) {
    const watchers = this._proxyChangeWatchers || [];
    return watchers.map((watcher) => watcher(details));
  }

  watchProxyChange(callback: ProxyChangeWatcher) {
    if (this._proxyChangeWatchers == null) {
      this._proxyChangeWatchers = [];
      if (chrome?.proxy?.settings?.onChange != null) {
        chrome.proxy.settings.onChange.addListener(this._proxyChangeListener.bind(this));
      }
    }
    this._proxyChangeWatchers.push(callback);
  }

  parseExternalProfile(details: ExternalProxyDetails | ProxyProfile, options?: unknown) {
    if (!this._isExternalProxyDetails(details)) {
      return details;
    }
    switch (details.value.mode) {
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
        return this._parsePacScriptExternalProfile(details, options);
      case 'fixed_servers':
        return this._parseFixedExternalProfile(details, options);
    }
  }

  private _isExternalProxyDetails(details: ExternalProxyDetails | ProxyProfile): details is ExternalProxyDetails {
    return typeof (details as ExternalProxyDetails).value?.mode === 'string';
  }

  private _parsePacScriptExternalProfile(details: ExternalProxyDetails, options: unknown) {
    const url = details.value.pacScript?.url;
    if (url) {
      let profile: ProxyProfile | null = null;
      OmegaPac.Profiles.each(options, (_key: string, candidate: ProxyProfile) => {
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

    let profile: ProxyProfile | null = null;
    let script = details.value.pacScript?.data || '';
    OmegaPac.Profiles.each(options, (_key: string, candidate: ProxyProfile) => {
      if (candidate.profileType === 'PacProfile' && candidate.pacScript === script) {
        profile = candidate;
      }
    });
    if (profile) {
      return profile;
    }

    script = script.trim();
    const magic = '/*OmegaProfile*';
    if (script.startsWith(magic)) {
      const end = script.indexOf('*/');
      if (end > 0) {
        const tokens = script.substring(magic.length, end).split('*');
        let profileName: unknown = tokens[0];
        const revision = tokens[1];
        try {
          profileName = JSON.parse(String(profileName));
        } catch (error) {
          profileName = null;
        }
        if (typeof profileName === 'string' && profileName && revision) {
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
    const rules = details.value.rules || {};
    const proxies: Partial<Record<FixedProxyRuleKey, string>> = {};
    for (const prop of FIXED_PROXY_RULE_KEYS) {
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

    let profile: ProxyProfile | null = null;
    OmegaPac.Profiles.each(options, (_key: string, candidate: ProxyProfile) => {
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
      for (const prop of FIXED_PROXY_RULE_KEYS) {
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
    for (const prop of FIXED_PROXY_RULE_KEYS) {
      const proxy = rules[prop] as ProxyServer | undefined;
      if (proxy) {
        if (prop === 'singleProxy') {
          profile.fallbackProxy = proxy;
        } else {
          profile[prop] = proxy;
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

export default SettingsProxyImpl;
