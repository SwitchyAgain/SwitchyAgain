import {applyUiTheme, uiThemeForOptions} from './ui_theme';
import {callBackground, callBackgroundWithRefresh, decodeBackgroundError} from './background_client';
import {setUiLocale, uiLocaleForOptions} from './i18n_client';
import type {
  Options,
  OptionsPatch,
  ProfileUpdateResults,
  RequestExplainArgs,
  WebDavSyncActionArgs,
  WebDavSyncConfig
} from './options_client_types';

async function applyOptionsUi(options: Options) {
  applyUiTheme(uiThemeForOptions(options));
  await setUiLocale(uiLocaleForOptions(options));
  return options;
}

export function loadOptions() {
  return callBackground('getAll').then(applyOptionsUi);
}

export function applyProfile(name: string) {
  return callBackgroundWithRefresh('applyProfile', name);
}

export function patchOptions(patch: OptionsPatch) {
  return callBackground('patch', patch).then(applyOptionsUi);
}

export function patchAndLoadOptions(patch: Options) {
  return patchOptions(patch).then(loadOptions);
}

export function resetOptions(options?: Options | string) {
  return callBackground('reset', options).then(applyOptionsUi);
}

export function setOptionsSync(enabled: boolean, args?: unknown) {
  return callBackground('setOptionsSync', enabled, args);
}

export function resetOptionsSync() {
  return callBackground('resetOptionsSync');
}

export function getWebDavSyncConfig() {
  return callBackground('getWebDavSyncConfig');
}

export function setWebDavSyncConfig(config: WebDavSyncConfig) {
  return callBackground('setWebDavSyncConfig', config);
}

export function testWebDavSync(config?: WebDavSyncConfig) {
  return callBackground('testWebDavSync', config);
}

export function setWebDavOptionsSync(enabled: boolean, args?: WebDavSyncActionArgs) {
  return callBackground('setWebDavOptionsSync', enabled, args);
}

export function explainRequest(args: RequestExplainArgs | string) {
  return callBackground('explainRequest', args);
}

export function renameProfile(fromName: string, toName: string) {
  return callBackground('renameProfile', fromName, toName).then(applyOptionsUi);
}

export function replaceRef(fromName: string, toName: string) {
  return callBackground('replaceRef', fromName, toName).then(applyOptionsUi);
}

export function updateProfile(name?: string, bypassCache = 'bypass_cache') {
  return callBackground('updateProfile', name, bypassCache)
    .then((results) => {
      const decoded: ProfileUpdateResults = {};
      for (const key of Object.keys(results || {})) {
        decoded[key] = decodeBackgroundError(results[key]);
      }
      return decoded;
    })
    .then((results) =>
      loadOptions().then((options) => ({
        options,
        results
      }))
    );
}
