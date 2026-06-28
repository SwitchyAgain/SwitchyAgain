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

export type BackgroundMethodArgs = {
  applyProfile: [name: string];
  cancelOptionsHandoff: [handoffId: string];
  explainRequest: [args: RequestExplainArgs | string];
  getAll: [];
  getState: [name: string | string[]];
  patch: [patch: OptionsPatch];
  renameProfile: [fromName: string, toName: string];
  replaceRef: [fromName: string, toName: string];
  reset: [options?: Options | string];
  resetOptionsSync: [];
  refreshProfileScopeContainerNames: [];
  resolveOptionsHandoff: [handoffId: string, action: 'apply' | 'discard'];
  setOptionsSync: [enabled: boolean, args?: unknown];
  setState: [items: Record<string, unknown>];
  updateProfile: [name?: string | string[] | null, bypassCache?: boolean | string];
};

export type BackgroundMethodResult = {
  applyProfile: unknown;
  cancelOptionsHandoff: void;
  explainRequest: RequestExplanation;
  getAll: Options;
  getState: Record<string, unknown>;
  patch: Options;
  renameProfile: Options;
  replaceRef: Options;
  reset: Options;
  resetOptionsSync: void;
  refreshProfileScopeContainerNames: ProfileScopeContainerInfo[];
  resolveOptionsHandoff: void;
  setOptionsSync: void;
  setState: Record<string, unknown>;
  updateProfile: Record<string, unknown>;
};

export type BackgroundMethod = keyof BackgroundMethodArgs;

export type BackgroundMessage<M extends BackgroundMethod = BackgroundMethod> = {
  args: BackgroundMethodArgs[M];
  method: M;
  noReply?: boolean;
  refreshActivePage?: boolean;
};
