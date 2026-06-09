import {Buffer} from 'buffer';
import OmegaTarget from '@switchyagain/extension-runtime';
import type {
  ProxyCondition,
  ProxyServer
} from './proxy/proxy_types';

const OmegaPac = OmegaTarget.OmegaPac;

type LegacyOptions = Record<string, string | undefined>;
type Options = Record<string, unknown>;

type I18nMessages = {
  upgrade_profile_auto: string;
};

type LegacyConfig = Record<string, unknown> & {
  preventProxyChanges?: boolean;
  quickSwitch?: boolean;
  refreshTab?: boolean;
  ruleListAutoProxy?: boolean;
  ruleListEnabled?: boolean;
  ruleListProfileId?: string;
  ruleListReload?: string;
  ruleListUrl?: string;
  startupProfileId?: string;
};

type LegacyProfile = {
  color?: string;
  id?: string;
  name?: string;
  proxyConfigUrl?: string;
  proxyExceptions?: string;
  proxyFtp?: string;
  proxyHttp?: string;
  proxyHttps?: string;
  proxyMode?: string;
  proxySocks?: string;
  socksVersion?: number;
  useSameProxy?: boolean;
};

type LegacyRule = {
  name?: string;
  patternType?: string;
  profileId?: string;
  urlPattern?: string;
};

type BypassCondition = ProxyCondition & {
  conditionType: 'BypassCondition';
  pattern: string;
};

type Profile = Record<string, unknown> & {
  bypassList?: BypassCondition[];
  color?: string;
  defaultProfileName?: string;
  fallbackProxy?: ProxyServer;
  format?: string;
  matchProfileName?: string;
  name?: string;
  pacScript?: string;
  pacUrl?: string;
  profileType?: string;
  proxyForFtp?: ProxyServer;
  proxyForHttp?: ProxyServer;
  proxyForHttps?: ProxyServer;
  rules?: Array<{
    condition: unknown;
    note?: string;
    profileName: string;
  }>;
  sourceUrl?: string;
};

function parseJson<T>(value: string | undefined): T | undefined {
  try {
    return value == null ? undefined : JSON.parse(value);
  } catch (error) {
    return undefined;
  }
}

function initialOptions(): Options {
  const root = globalThis as typeof globalThis & {changes?: Options | null};
  return root.changes != null ? root.changes : {};
}

function conditionFromRule(rule: LegacyRule) {
  switch (rule.patternType) {
    case 'wildcard':
      return OmegaPac.RuleList.Switchy.conditionFromLegacyWildcard(rule.urlPattern);
    default:
      return {
        conditionType: 'UrlRegexCondition',
        pattern: rule.urlPattern
      };
  }
}

function parseProxy(value: string | undefined, scheme: string): ProxyServer {
  return OmegaPac.Profiles.parseHostPort(value, scheme) as ProxyServer;
}

function upgradeSwitchyOptions(oldOptions: LegacyOptions, i18n: I18nMessages) {
  const config = parseJson<LegacyConfig>(oldOptions.config);
  if (!config) {
    return undefined;
  }

  const options = initialOptions();
  options.schemaVersion = 2;

  const boolItems: Record<string, keyof LegacyConfig> = {
    '-confirmDeletion': 'confirmDeletion',
    '-refreshOnProfileChange': 'refreshTab',
    '-enableQuickSwitch': 'quickSwitch',
    '-revertProxyChanges': 'preventProxyChanges'
  };
  for (const key of Object.keys(boolItems)) {
    options[key] = Boolean(config[boolItems[key]]);
  }

  options['-downloadInterval'] = parseInt(config.ruleListReload || '', 10) || 15;

  const auto = OmegaPac.Profiles.create({
    profileType: 'SwitchProfile',
    name: i18n.upgrade_profile_auto,
    color: '#55bb55',
    defaultProfileName: 'direct'
  }) as Profile;
  OmegaPac.Profiles.updateRevision(auto);
  options[OmegaPac.Profiles.nameAsKey(auto.name)] = auto;

  const rulelist = OmegaPac.Profiles.create({
    profileType: 'RuleListProfile',
    name: `__ruleListOf_${auto.name}`,
    color: '#dd6633',
    format: config.ruleListAutoProxy ? 'AutoProxy' : 'Switchy',
    defaultProfileName: 'direct',
    sourceUrl: config.ruleListUrl || ''
  }) as Profile;
  options[OmegaPac.Profiles.nameAsKey(rulelist.name)] = rulelist;
  auto.defaultProfileName = rulelist.name;

  const nameMap: Record<string, string | undefined> = {
    auto: auto.name,
    direct: 'direct'
  };
  const oldProfiles = parseJson<Record<string, LegacyProfile>>(oldOptions.profiles) || {};
  const colorTranslations: Record<string, string> = {
    blue: '#99ccee',
    green: '#99dd99',
    red: '#ffaa88',
    yellow: '#ffee99',
    purple: '#d497ee',
    '': '#99ccee'
  };
  let seenFixedProfile = false;

  for (const key of Object.keys(oldProfiles)) {
    const oldProfile = oldProfiles[key];
    let profile: Profile | null = null;
    switch (oldProfile.proxyMode) {
      case 'auto': {
        profile = OmegaPac.Profiles.create({
          profileType: 'PacProfile'
        });
        const url = oldProfile.proxyConfigUrl || '';
        if (url.startsWith('data:')) {
          const text = url.slice(url.indexOf(',') + 1);
          profile.pacScript = Buffer.from(text, 'base64').toString('utf8');
        } else {
          profile.pacUrl = url;
        }
        break;
      }
      case 'manual':
        seenFixedProfile = true;
        profile = OmegaPac.Profiles.create({
          profileType: 'FixedProfile'
        });
        if (oldProfile.useSameProxy) {
          profile.fallbackProxy = parseProxy(oldProfile.proxyHttp, 'http');
        } else if (oldProfile.proxySocks) {
          const protocol = oldProfile.socksVersion === 5 ? 'socks5' : 'socks4';
          profile.fallbackProxy = parseProxy(oldProfile.proxySocks, protocol);
        } else {
          profile.proxyForHttp = parseProxy(oldProfile.proxyHttp, 'http');
          profile.proxyForHttps = parseProxy(oldProfile.proxyHttps, 'http');
          profile.proxyForFtp = parseProxy(oldProfile.proxyFtp, 'http');
        }
        if (oldProfile.proxyExceptions != null) {
          let hasLocalPattern = false;
          profile.bypassList = [];
          oldProfile.proxyExceptions.split(';').forEach((line) => {
            line = line.trim();
            if (!line) {
              return;
            }
            if (line === '<local>') {
              hasLocalPattern = true;
            }
            profile?.bypassList?.push({
              conditionType: 'BypassCondition',
              pattern: line
            });
          });
          if (hasLocalPattern) {
            profile.bypassList = profile.bypassList.filter((cond) => {
              return OmegaPac.Conditions.localHosts.indexOf(cond.pattern) < 0;
            });
          }
        }
        break;
    }

    if (profile) {
      const color = oldProfile.color || '';
      profile.color = colorTranslations[color] ?? colorTranslations[''];
      let name = (oldProfile.name ?? oldProfile.id ?? '').trim();
      if (name[0] === '_') {
        name = `p${name}`;
      }
      profile.name = name;
      let num = 1;
      while (OmegaPac.Profiles.byName(profile.name, options)) {
        profile.name = name + num;
        num++;
      }
      if (oldProfile.id) {
        nameMap[oldProfile.id] = profile.name;
      }
      OmegaPac.Profiles.updateRevision(profile);
      options[OmegaPac.Profiles.nameAsKey(profile.name)] = profile;
    }
  }

  if (!seenFixedProfile) {
    const exampleFixedProfileName = 'Example Profile';
    options[OmegaPac.Profiles.nameAsKey(exampleFixedProfileName)] = {
      bypassList: [
        {
          pattern: '127.0.0.1',
          conditionType: 'BypassCondition'
        },
        {
          pattern: '::1',
          conditionType: 'BypassCondition'
        },
        {
          pattern: 'localhost',
          conditionType: 'BypassCondition'
        }
      ],
      profileType: 'FixedProfile',
      name: exampleFixedProfileName,
      color: '#99ccee',
      fallbackProxy: {
        port: 8080,
        scheme: 'http',
        host: 'proxy.example.com'
      }
    };
  }

  options['-startupProfileName'] = nameMap[config.startupProfileId || ''] || '';

  const quickSwitch = parseJson<string[]>(oldOptions.quickSwitchProfiles);
  options['-quickSwitchProfiles'] = quickSwitch == null ? [] : quickSwitch.map((profileId) => {
    return nameMap[profileId];
  });

  if (config.ruleListProfileId) {
    rulelist.matchProfileName = nameMap[config.ruleListProfileId] || 'direct';
  }

  const defaultRule = parseJson<{profileId?: string}>(oldOptions.defaultRule);
  if (defaultRule) {
    rulelist.defaultProfileName = nameMap[defaultRule.profileId || ''] || 'direct';
    if (!config.ruleListEnabled) {
      auto.defaultProfileName = rulelist.defaultProfileName;
    }
  }
  OmegaPac.Profiles.updateRevision(rulelist);

  const rules = parseJson<Record<string, LegacyRule>>(oldOptions.rules);
  if (rules) {
    auto.rules = Object.keys(rules).map((key) => {
      const rule = rules[key];
      return {
        profileName: nameMap[rule.profileId || ''] || 'direct',
        condition: conditionFromRule(rule),
        note: rule.name
      };
    });
  }

  return options;
}

export default upgradeSwitchyOptions;
