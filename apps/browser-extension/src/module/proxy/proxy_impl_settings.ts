import OmegaTarget from '@switchyagain/extension-runtime';
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
  'fallbackProxy',
  'singleProxy'
] as const;

const PROTOCOL_PROXY_RULE_KEYS = ['proxyForHttp', 'proxyForHttps'] as const;

type FixedProxyRuleKey = typeof FIXED_PROXY_RULE_KEYS[number];
type ProxySettingsScope = 'regular' | 'incognito_persistent';

type ProfileScopeAssignments = {
  normalDefaultProfileName?: string;
  privateDefaultProfileName?: string;
};

function isRecordValue(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function windowScopeEnabled(options?: unknown) {
  if (!isRecordValue(options)) {
    return false;
  }
  const scopes = options['-profileScopes'];
  return isRecordValue(scopes) && scopes.window === true;
}

function profileScopeAssignments(options?: unknown): ProfileScopeAssignments {
  if (!isRecordValue(options)) {
    return {};
  }
  const assignments = options['-profileScopeAssignments'];
  return isRecordValue(assignments) ? assignments : {};
}

class SettingsProxyImpl extends ProxyImpl {
  private _proxyChangeListener: (details: ProxyChangeDetails) => unknown[];
  private _proxyChangeWatchers: ProxyChangeWatcher[] | null;

  constructor(log: ProxyLog) {
    super(log);
    this.features = ['fullUrlHttp', 'pacScript', 'watchProxyChange', 'windowProfileScope'];
    this.proxyAuthCapabilities = {
      http: true,
      https: true,
      socks4: false,
      socks5: false
    };
    this._proxyChangeWatchers = null;
    this._proxyChangeListener = this._handleProxyChange.bind(this);
  }

  static isSupported() {
    return chrome?.proxy?.settings != null;
  }

  async applyProfile(profile: ProxyProfile, meta: ProxyProfile = profile, options?: unknown) {
    const windowProfiles = this._windowScopeProfiles(profile, meta, options);
    const authProfileNames = windowProfiles ? [windowProfiles.regular.profile.name, windowProfiles.private.profile.name] : [];
    await (this.setProxyAuth(
      profile,
      options,
      authProfileNames.filter((name): name is string => typeof name === 'string')
    ) as unknown as PromiseLike<unknown>);
    if (windowProfiles) {
      await this._applyWindowScopeProfiles(windowProfiles, options);
    } else {
      await this._clearPrivateScopeProfile();
      await this._applyProfileConfig(profile, meta, options);
    }
    chrome.proxy.settings.get({}, this._proxyChangeListener);
  }

  private _applyProfileConfig(profile: ProxyProfile, meta: ProxyProfile = profile, options?: unknown, scope?: ProxySettingsScope) {
    const details = scope ? {scope} : {};
    if (profile.profileType === 'SystemProfile') {
      return chromeApiPromisify<void>(chrome.proxy.settings, 'clear')(details);
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

    return chromeApiPromisify<void>(chrome.proxy.settings, 'set')({
      ...details,
      value: config
    });
  }

  private _windowScopeProfiles(profile: ProxyProfile, meta: ProxyProfile, options?: unknown) {
    if (!windowScopeEnabled(options)) {
      return null;
    }
    const assignments = profileScopeAssignments(options);
    const regularProfile = this._profileByName(assignments.normalDefaultProfileName, options) || profile;
    const privateProfile = this._profileByName(assignments.privateDefaultProfileName, options) || profile;
    return {
      regular: {
        profile: regularProfile,
        meta: regularProfile === profile ? meta : regularProfile
      },
      private: {
        profile: privateProfile,
        meta: privateProfile === profile ? meta : privateProfile
      }
    };
  }

  private _profileByName(profileName: unknown, options?: unknown) {
    return typeof profileName === 'string' && profileName
      ? OmegaPac.Profiles.byName(profileName, options)
      : null;
  }

  private _applyWindowScopeProfiles(
    profiles: {
      private: {meta: ProxyProfile; profile: ProxyProfile};
      regular: {meta: ProxyProfile; profile: ProxyProfile};
    },
    options?: unknown
  ) {
    const applyRegular = this._applyProfileConfig(profiles.regular.profile, profiles.regular.meta, options, 'regular');
    const applyPrivate = this._applyProfileConfig(profiles.private.profile, profiles.private.meta, options, 'incognito_persistent')
      .catch((error: unknown) => {
        this.log.error('Failed to apply private window proxy profile:', error);
      });
    return Promise.all([applyRegular, applyPrivate]);
  }

  private _clearPrivateScopeProfile() {
    return chromeApiPromisify<void>(chrome.proxy.settings, 'clear')({
      scope: 'incognito_persistent'
    }).catch(() => {});
  }

  private _fixedProfileConfig(profile: ProxyProfile) {
    const config: ProxySettingsConfig = {
      mode: 'fixed_servers'
    };
    const rules: ProxyRules = {};
    let protocolProxySet = false;
    for (const protocol of PROTOCOL_PROXY_RULE_KEYS) {
      const proxy = this._proxyForSettings(profile[protocol] as ProxyServer | undefined);
      if (proxy == null) {
        continue;
      }
      rules[protocol] = proxy;
      protocolProxySet = true;
    }

    const fallbackProxy = this._proxyForSettings(profile.fallbackProxy);
    if (fallbackProxy) {
      if (fallbackProxy.scheme === 'http') {
        if (!protocolProxySet) {
          rules.singleProxy = fallbackProxy;
        } else {
          for (const protocol of PROTOCOL_PROXY_RULE_KEYS) {
            if (rules[protocol] == null) {
              rules[protocol] = JSON.parse(JSON.stringify(fallbackProxy)) as ProxyServer;
            }
          }
        }
      } else {
        rules.fallbackProxy = fallbackProxy;
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

  private _proxyForSettings(proxy?: ProxyServer) {
    if (!proxy) {
      return undefined;
    }
    if (proxy.scheme !== 'socks5-local') {
      return proxy;
    }
    return {
      ...proxy,
      scheme: 'socks5'
    };
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
