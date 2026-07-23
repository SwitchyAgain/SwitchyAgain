export type ProxyLog = {
  error(...args: unknown[]): void;
  log(...args: unknown[]): void;
};

export type ProxyCredentials = {
  password?: string;
  username?: string;
};

export type ProxyAuthCapabilities = {
  http: boolean;
  https: boolean;
  socks4: boolean;
  socks5: boolean;
};

export type ProxyDnsCapabilities = {
  socks5: boolean;
};

export type ProxyServer = Record<string, unknown> & {
  host?: string;
  port?: number;
  scheme?: string;
};

export type ProxyAuthEndpoint = {
  host: string;
  port: number | string;
};

export type ProxyCondition = Record<string, unknown> & {
  pattern?: string;
};

export type ProxyBypassSection = {
  bypassList?: ProxyCondition[];
  enabled?: boolean;
  name?: string;
};

export type ProxyProfile = Record<string, unknown> & {
  auth?: Record<string, ProxyCredentials | undefined>;
  bypassSections?: ProxyBypassSection[];
  bypassList?: ProxyCondition[];
  defaultProfileName?: string;
  fallbackProxy?: ProxyServer;
  hiddenInContextMenu?: boolean;
  name?: string;
  pacScript?: string;
  pacUrl?: string;
  profileGroupEnabled?: boolean;
  profileGroupId?: string;
  profileType?: string;
  proxyForHttp?: ProxyServer;
  proxyForHttps?: ProxyServer;
  proxyForWs?: ProxyServer;
  proxyForWss?: ProxyServer;
  revision?: string;
  supplementalListIds?: string[];
};

export type ProxyRequestDetails = {
  cookieStoreId?: string;
  groupId?: number;
  incognito?: boolean;
  tabId?: number;
  type?: string;
  url: string;
  windowId?: number;
  [key: string]: unknown;
};

export type ProxyProfileResolver = (details: ProxyRequestDetails) => ProxyProfile | null | undefined;
export type ProxyScopeProfileNames = () => string[];

export type ProxyRules = Record<string, unknown> & {
  bypassList?: string[];
  fallbackProxy?: ProxyServer;
  proxyForHttp?: ProxyServer;
  proxyForHttps?: ProxyServer;
  proxyForWs?: ProxyServer;
  proxyForWss?: ProxyServer;
  singleProxy?: ProxyServer;
};

export type ProxySettingsConfig = {
  mode?: string;
  pacScript?: {
    data?: string;
    mandatory: boolean;
    url?: string;
  };
  rules?: ProxyRules;
};

export type ProxyChangeDetails = Record<string, unknown> & {
  levelOfControl?: string;
  value?: ProxySettingsConfig;
};

export type ExternalProxyDetails = ProxyChangeDetails & {
  name?: string;
  value: ProxySettingsConfig & {
    mode: string;
  };
};

export type ProxyChangeWatcher = (details: ProxyChangeDetails) => unknown;

export type ProxyImplInstance = {
  features: string[];
  proxyAuthCapabilities: ProxyAuthCapabilities;
  proxyDnsCapabilities: ProxyDnsCapabilities;
  applyProfile(profile: ProxyProfile, meta?: unknown, options?: unknown): Promise<unknown>;
  parseExternalProfile(details: ExternalProxyDetails | ProxyProfile, options?: unknown): unknown;
  setProfileResolver?(resolver: ProxyProfileResolver | null, profileNames?: ProxyScopeProfileNames): void;
  watchProxyChange(callback: ProxyChangeWatcher): void | null;
};

export type ProxyImplConstructor = {
  isSupported(): boolean;
  new (log: ProxyLog): ProxyImplInstance;
};
