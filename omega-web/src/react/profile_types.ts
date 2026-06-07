export type ProfileAuth = {
  password?: string;
  username?: string;
  [key: string]: string | undefined;
};

export type ProfileAuthMap = Record<string, ProfileAuth | undefined>;

export type ProfileSyncError = {
  reason?: string;
  [key: string]: unknown;
};

export type Profile = {
  builtin?: boolean;
  color?: string;
  name?: string;
  profileType?: string;
  syncError?: ProfileSyncError;
  syncOptions?: string;
  [key: string]: unknown;
};

export type ProfileKey = `+${string}`;

export type OptionsData = {
  [key: string]: unknown;
  '-addConditionsToBottom'?: boolean;
  '-confirmDeletion'?: boolean;
  '-downloadInterval'?: number | string;
  '-enableQuickSwitch'?: boolean;
  '-exportLegacyRuleList'?: boolean;
  '-monitorWebRequests'?: boolean;
  '-quickSwitchProfiles'?: string[];
  '-refreshOnProfileChange'?: boolean;
  '-showConditionTypes'?: number;
  '-showExternalProfile'?: boolean;
  '-showInspectMenu'?: boolean;
  '-startupProfileName'?: string;
};

export type VirtualProfileModel = Profile & {
  defaultProfileName?: string;
};

export type RuleListProfileModel = Profile & {
  defaultProfileName?: string;
  format?: string;
  lastUpdate?: number | string | null;
  matchProfileName?: string;
  ruleList?: string;
  sourceUrl?: string;
};

export type PacProfileModel = Profile & {
  auth?: ProfileAuthMap & {
    all?: ProfileAuth;
  };
  lastUpdate?: number | string | null;
  pacScript?: string;
  pacUrl?: string;
};

export type ProxyEditor = {
  host?: string;
  port?: number | string;
  scheme?: string;
};

export type FixedProfileProxyField = 'fallbackProxy' | 'proxyForHttp' | 'proxyForHttps';

export type FixedProfileScheme = '' | 'http' | 'https';

export type FixedProfileBypassCondition = {
  conditionType: 'BypassCondition';
  pattern: string;
};

export type FixedProfileModel = Profile & {
  auth?: ProfileAuthMap;
  bypassList?: FixedProfileBypassCondition[];
  fallbackProxy?: ProxyEditor;
  proxyForHttp?: ProxyEditor;
  proxyForHttps?: ProxyEditor;
};
