export type {
  BackgroundError,
  BackgroundMessage,
  BackgroundMethod,
  BackgroundMethodArgs,
  BackgroundMethodResult,
  BackgroundResponse,
  Options,
  OptionsPatch,
  ProfileScopeContainerInfo,
  ProfileUpdateResults,
  RequestExplainArgs,
  RequestExplainProfile,
  RequestExplainStep,
  RequestExplanation,
  WebDavSyncActionArgs,
  WebDavSyncConfig,
  WebDavSyncTestResult
} from './options_client_types';

export {UI_LOCALES, browserUiLocale, message, normalizeUiLocale, setUiLocale, uiLocaleForOptions} from './i18n_client';

export {
  callBackground,
  callBackgroundNoReply,
  callBackgroundWithRefresh,
  decodeBackgroundError,
  runtimeAvailable
} from './background_client';

export {
  applyProfile,
  explainRequest,
  getWebDavSyncConfig,
  loadOptions,
  patchAndLoadOptions,
  patchOptions,
  renameProfile,
  replaceRef,
  resetOptions,
  resetOptionsSync,
  setOptionsSync,
  setWebDavOptionsSync,
  setWebDavSyncConfig,
  testWebDavSync,
  updateProfile
} from './options_api_client';

export {getLocalState, getState, lastUrl, setLocalState, setState} from './state_client';

export {downloadBlob, manifestVersion, openManage, openOptions, openShortcutConfig, shouldAutoMount} from './navigation_client';

export {optionPatch} from './option_patch';
