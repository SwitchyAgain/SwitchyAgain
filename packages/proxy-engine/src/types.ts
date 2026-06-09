export type ConditionType =
  | 'TrueCondition'
  | 'FalseCondition'
  | 'UrlRegexCondition'
  | 'UrlWildcardCondition'
  | 'HostRegexCondition'
  | 'HostWildcardCondition'
  | 'BypassCondition'
  | 'KeywordCondition'
  | 'IpCondition'
  | 'HostLevelsCondition'
  | 'WeekdayCondition'
  | 'TimeCondition'
  | string;

export type Condition = {
  conditionType: ConditionType;
  days?: string;
  endDay?: number;
  endHour?: number;
  ip?: string;
  maxValue?: number;
  minValue?: number;
  pattern?: string;
  prefixLength?: number;
  startDay?: number;
  startHour?: number;
  [key: string]: unknown;
};

export type PacRequest = {
  host: string;
  port?: string;
  scheme: string;
  url: string;
  [key: string]: unknown;
};

export type ProxyServer = {
  host?: string;
  port?: number | string;
  scheme?: string;
  [key: string]: unknown;
};

export type ProfileAuth = {
  password?: string;
  username?: string;
  [key: string]: unknown;
};

export type ProfileAuthMap = Record<string, ProfileAuth | undefined> & {
  all?: ProfileAuth;
};

export type ProfileType =
  | 'SystemProfile'
  | 'DirectProfile'
  | 'FixedProfile'
  | 'PacProfile'
  | 'AutoDetectProfile'
  | 'SwitchProfile'
  | 'VirtualProfile'
  | 'RuleListProfile'
  | 'SwitchyRuleListProfile'
  | 'AutoProxyRuleListProfile'
  | string;

export type Profile = {
  auth?: ProfileAuthMap;
  builtin?: boolean;
  bypassList?: Condition[];
  color?: string;
  defaultProfileName?: string;
  fallbackProxy?: ProxyServer;
  format?: string;
  lastUpdate?: number | string | null;
  matchProfileName?: string;
  name?: string;
  pacScript?: string;
  pacUrl?: string;
  profileType?: ProfileType;
  proxyForFtp?: ProxyServer;
  proxyForHttp?: ProxyServer;
  proxyForHttps?: ProxyServer;
  revision?: string;
  ruleList?: string;
  rules?: SwitchRule[];
  sourceUrl?: string;
  syncError?: {
    reason?: string;
    [key: string]: unknown;
  };
  syncOptions?: string;
  [key: string]: unknown;
};

export type OptionsMap = Record<string, unknown>;

export type SwitchRule = {
  condition: Condition;
  isTempRule?: boolean;
  note?: string;
  profileName?: string | null;
  source?: string;
  [key: string]: unknown;
};

export type RuleListComposeOptions = {
  useExclusive?: boolean;
  withResult?: boolean;
};

export type RuleListParseOptions = {
  source?: boolean;
  strict?: boolean;
};

export type ReferenceSet = Record<string, string>;

export type ReferenceSetOptions = {
  out?: ReferenceSet;
  profileNotFound?: unknown;
};

export type PacGeneratorOptions = {
  profileNotFound?: unknown;
};

export type PacResultTuple = [
  result: string,
  source?: unknown,
  proxy?: ProxyServer,
  auth?: ProfileAuth
];

export type ProfileMatchResult = SwitchRule | PacResultTuple | undefined;
