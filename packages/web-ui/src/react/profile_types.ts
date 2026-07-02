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

export type BuiltinProfileType = 'DirectProfile' | 'SystemProfile';

export type EditableProfileType = 'FixedProfile' | 'PacProfile' | 'RuleListProfile' | 'SwitchProfile' | 'VirtualProfile';

export type LegacyRuleListProfileType = 'AutoProxyRuleListProfile' | 'SwitchyRuleListProfile';

export type KnownProfileType = BuiltinProfileType | EditableProfileType | LegacyRuleListProfileType | 'AutoDetectProfile';

export type ProfileType = KnownProfileType | (string & {});

export type Profile = {
  builtin?: boolean;
  color?: string;
  hiddenInContextMenu?: boolean;
  hiddenInOptions?: boolean;
  hiddenInPopup?: boolean;
  name?: string;
  profileType?: ProfileType;
  syncError?: ProfileSyncError;
  syncOptions?: string;
  [key: string]: unknown;
};

export type NamedProfile = Profile & {
  name: string;
};

export type NamedProfileOfType<TProfileType extends ProfileType> = NamedProfile & {
  profileType: TProfileType;
};

export type NamedDirectProfileModel = NamedProfileOfType<'DirectProfile'> & {
  builtin?: true;
};

export type NamedSystemProfileModel = NamedProfileOfType<'SystemProfile'> & {
  builtin?: true;
};

export type NamedBuiltinProfileModel = NamedDirectProfileModel | NamedSystemProfileModel;

export type ProfileKey = `+${string}`;

export type ProfileActionMenuOptions = {
  browserColor?: boolean;
  browserExport?: boolean;
  sidebarColor?: boolean;
  sidebarExport?: boolean;
};

export type OptionsData = {
  [key: string]: unknown;
  '-addConditionsToBottom'?: boolean;
  '-confirmDeletion'?: boolean;
  '-contextMenuOptions'?: {
    containerProfile?: boolean;
    groupProfile?: boolean;
    linkProfileNewPrivateWindow?: boolean;
    linkProfileNewTab?: boolean;
    linkProfileNewWindow?: boolean;
    switchProfile?: boolean;
    tabProfile?: boolean;
    windowProfile?: boolean;
  };
  '-downloadInterval'?: number | string;
  '-enableQuickSwitch'?: boolean;
  '-exportLegacyRuleList'?: boolean;
  '-keepSettingsExpanded'?: boolean;
  '-monitorWebRequests'?: boolean;
  '-networkRequestIgnoreList'?: string[];
  '-profileActionMenuOptions'?: ProfileActionMenuOptions;
  '-profileScopeAssignments'?: {
    containers?: Record<string, string>;
    normalDefaultProfileName?: string;
    privateDefaultProfileName?: string;
  };
  '-profileScopes'?: {
    container?: boolean;
    group?: boolean;
    tab?: boolean;
    window?: boolean;
  };
  '-quickSwitchProfiles'?: string[];
  '-refreshOnProfileChange'?: boolean;
  '-showConditionTypes'?: number;
  '-showExternalProfile'?: boolean;
  '-showRouteLens'?: boolean;
  '-showBypassListGroups'?: boolean;
  '-showHttpProxyOverrideRows'?: boolean;
  '-showSocks5LocalDnsOption'?: boolean;
  '-showWebSocketProxyOverrideRows'?: boolean;
  '-showProfileOptions'?: boolean;
  '-showPopupAddCondition'?: boolean;
  '-showPopupAddTempRule'?: boolean;
  '-startupProfileName'?: string;
  '-uiLocale'?: string;
  '-uiTheme'?: string;
};

export type VirtualProfileModel = Profile & {
  defaultProfileName?: string;
  profileType?: 'VirtualProfile';
};

export type NamedVirtualProfileModel = VirtualProfileModel & NamedProfileOfType<'VirtualProfile'>;

export type RuleListProfileModel = Profile & {
  defaultProfileName?: string;
  format?: string;
  lastUpdate?: number | string | null;
  matchProfileName?: string;
  omitRuleListFromExport?: boolean;
  profileType?: 'RuleListProfile' | LegacyRuleListProfileType;
  ruleList?: string;
  sourceUrl?: string;
};

export type NamedRuleListProfileModel = RuleListProfileModel & NamedProfileOfType<'RuleListProfile'>;

export type PacProfileModel = Profile & {
  auth?: ProfileAuthMap & {
    all?: ProfileAuth;
  };
  lastUpdate?: number | string | null;
  pacScript?: string;
  pacUrl?: string;
  profileType?: 'PacProfile';
};

export type NamedPacProfileModel = PacProfileModel & NamedProfileOfType<'PacProfile'>;

export type PacProfileField = 'pacScript' | 'pacUrl';

export type FixedProfileProxyProtocol = 'direct' | 'http' | 'https' | 'socks4' | 'socks5' | 'socks5-local';

export type FixedProfileServerProtocol = Exclude<FixedProfileProxyProtocol, 'direct'>;

export type ProxyAuthCapabilities = Record<Exclude<FixedProfileServerProtocol, 'socks5-local'>, boolean>;

export type ProxyDnsCapabilities = {
  socks5: boolean;
};

export type ProxyEditor = {
  host?: string;
  port?: number | string;
  scheme?: FixedProfileProxyProtocol | (string & {});
};

export type FixedProfileProxyField = 'fallbackProxy' | 'proxyForHttp' | 'proxyForHttps' | 'proxyForWs' | 'proxyForWss';

export type ProfileAuthKey = 'all' | FixedProfileProxyField;

export type FixedProfileScheme = '' | 'http' | 'https' | 'ws' | 'wss';

export type FixedProfileProxyEditorField = 'host' | 'port' | 'scheme';

export type FixedProfileProxyEditors = Record<FixedProfileScheme, ProxyEditor>;

export type FixedProfileProxyChangeOptions = {
  clearAuth?: boolean;
};

export type FixedProfileBypassCondition = {
  conditionType: 'BypassCondition';
  pattern: string;
};

export type FixedProfileBypassGroup = {
  bypassList?: FixedProfileBypassCondition[];
  enabled?: boolean;
  name?: string;
};

export type FixedProfileModel = Profile & {
  auth?: ProfileAuthMap;
  bypassGroups?: FixedProfileBypassGroup[];
  bypassList?: FixedProfileBypassCondition[];
  fallbackProxy?: ProxyEditor;
  profileType?: 'FixedProfile';
  proxyForHttp?: ProxyEditor;
  proxyForHttps?: ProxyEditor;
  proxyForWs?: ProxyEditor;
  proxyForWss?: ProxyEditor;
};

export type NamedFixedProfileModel = FixedProfileModel & NamedProfileOfType<'FixedProfile'>;

export type RuleListProfileSourceField = 'format' | 'ruleList' | 'sourceUrl';

export type RuleListProfileAttachedField = RuleListProfileSourceField | 'omitRuleListFromExport';

export type RuleListProfileField = 'defaultProfileName' | 'matchProfileName' | 'omitRuleListFromExport' | RuleListProfileSourceField;
