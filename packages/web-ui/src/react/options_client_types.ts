import type {OptionsData} from './profile_types';

export type Options = OptionsData;
export type OptionsPatch = Record<string, unknown>;

export type BackgroundError = Error & {
  original?: {
    statusCode?: number | string;
    [key: string]: unknown;
  };
  reason?: string;
  statusCode?: number | string;
};

export type BackgroundResponse<T> = {
  error?: unknown;
  result?: T;
};

export type ProfileUpdateResults = Record<string, BackgroundError | unknown>;

export type ProfileScopeContainerInfo = {
  color?: string;
  colorCode?: string;
  cookieStoreId: string;
  icon?: string;
  iconUrl?: string;
  name?: string;
};

export type ProxyFeature = string;

export type RequestExplainProfile = {
  attachedToProfileName?: string;
  builtin?: boolean;
  color?: unknown;
  name?: string;
  profileType?: unknown;
  role?: string;
};

export type RequestExplainStep = {
  auth?: boolean;
  condition?: string;
  isTempRule?: boolean;
  kind: string;
  pacResult?: string;
  profile?: RequestExplainProfile;
  proxy?: unknown;
  scheme?: string;
  source?: string;
  supplementalListName?: string;
  targetProfile?: RequestExplainProfile;
};

export type RequestExplanation = {
  currentProfile?: RequestExplainProfile;
  errors?: string[];
  final: {
    auth?: boolean;
    delegated?: boolean;
    kind: string;
    limited?: boolean;
    pacResult?: string;
    profile?: RequestExplainProfile;
    proxy?: unknown;
  };
  finalProfile?: RequestExplainProfile;
  request: Record<string, unknown> & {
    host?: string;
    port?: string;
    scheme?: string;
    url?: string;
  };
  startProfile?: RequestExplainProfile;
  steps: RequestExplainStep[];
  tempRulesActive: boolean;
  warnings: string[];
};

export type RequestExplainArgs = {
  includeTempRules?: boolean;
  profileName?: string;
  request?: Record<string, unknown>;
  url?: string;
};

export type WebDavSyncConfig = {
  hasPassword?: boolean;
  intervalMinutes?: number;
  password?: string;
  remotePath?: string;
  serverUrl?: string;
  username?: string;
};

export type WebDavSyncActionArgs = {
  config?: WebDavSyncConfig;
  mode?: 'download' | 'upload';
};

export type WebDavSyncManualAction = 'downloadNow' | 'uploadNow';

export type WebDavSyncTestResult = {
  exists: boolean;
  ok: boolean;
  schema?: unknown;
  version?: unknown;
};

export type WebDavSyncStatus = {
  backoffIndex?: number;
  failureCount?: number;
  lastAttemptAt?: string;
  lastErrorAt?: string;
  lastSuccessAt?: string;
  message?: string;
  needsDirection?: boolean;
  nextRetryAt?: string;
  operation?: 'download' | 'poll' | 'upload';
  pendingUpload?: boolean;
  state: 'success' | 'retrying' | 'error';
};

export type BackgroundMethodArgs = {
  applyProfile: [name: string];
  cancelOptionsHandoff: [handoffId: string];
  explainRequest: [args: RequestExplainArgs | string];
  getAll: [];
  getLog: [];
  getState: [name: string | string[]];
  getWebDavSyncConfig: [];
  patch: [patch: OptionsPatch];
  renameProfile: [fromName: string, toName: string];
  replaceRef: [fromName: string, toName: string];
  reset: [options?: Options | string];
  resetOptionsSync: [];
  refreshProfileScopeContainerNames: [];
  resolveOptionsHandoff: [handoffId: string, action: 'apply' | 'discard'];
  runWebDavSyncAction: [action: WebDavSyncManualAction];
  setOptionsSync: [enabled: boolean, args?: unknown];
  setWebDavOptionsSync: [enabled: boolean, args?: WebDavSyncActionArgs];
  setWebDavSyncConfig: [config: WebDavSyncConfig];
  setState: [items: Record<string, unknown>];
  testWebDavSync: [config?: WebDavSyncConfig];
  updateProfile: [name?: string | string[] | null, bypassCache?: boolean | string];
};

export type BackgroundMethodResult = {
  applyProfile: unknown;
  cancelOptionsHandoff: void;
  explainRequest: RequestExplanation;
  getAll: Options;
  getLog: string;
  getState: Record<string, unknown>;
  getWebDavSyncConfig: WebDavSyncConfig | null;
  patch: Options;
  renameProfile: Options;
  replaceRef: Options;
  reset: Options;
  resetOptionsSync: void;
  refreshProfileScopeContainerNames: ProfileScopeContainerInfo[];
  resolveOptionsHandoff: void;
  runWebDavSyncAction: void;
  setOptionsSync: void;
  setWebDavOptionsSync: void;
  setWebDavSyncConfig: WebDavSyncConfig;
  setState: Record<string, unknown>;
  testWebDavSync: WebDavSyncTestResult;
  updateProfile: Record<string, unknown>;
};

export type BackgroundMethod = keyof BackgroundMethodArgs;

export type BackgroundMessage<M extends BackgroundMethod = BackgroundMethod> = {
  args: BackgroundMethodArgs[M];
  method: M;
  noReply?: boolean;
  refreshActivePage?: boolean;
};
