export type ProxyLog = {
  error(...args: unknown[]): void;
  log(...args: unknown[]): void;
};

export type ProxyCredentials = {
  password?: string;
  username?: string;
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

export type ProxyProfile = Record<string, unknown> & {
  auth?: Record<string, ProxyCredentials | undefined>;
  bypassList?: ProxyCondition[];
  defaultProfileName?: string;
  fallbackProxy?: ProxyServer;
  name?: string;
  pacScript?: string;
  pacUrl?: string;
  profileType?: string;
  revision?: string;
};

export type ProxyRules = Record<string, unknown> & {
  bypassList?: string[];
  fallbackProxy?: ProxyServer;
  proxyForFtp?: ProxyServer;
  proxyForHttp?: ProxyServer;
  proxyForHttps?: ProxyServer;
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
  applyProfile(profile: ProxyProfile, meta?: unknown, options?: unknown): Promise<unknown>;
  parseExternalProfile(details: ExternalProxyDetails | ProxyProfile, options?: unknown): unknown;
  watchProxyChange(callback: ProxyChangeWatcher): void | null;
};

export type ProxyImplConstructor = {
  isSupported(): boolean;
  new(log: ProxyLog): ProxyImplInstance;
};
