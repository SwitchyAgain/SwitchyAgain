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
  explainRequest: [args: RequestExplainArgs | string];
  getAll: [];
  getState: [name: string | string[]];
  patch: [patch: OptionsPatch];
  renameProfile: [fromName: string, toName: string];
  replaceRef: [fromName: string, toName: string];
  reset: [options?: Options | string];
  resetOptionsSync: [];
  setOptionsSync: [enabled: boolean, args?: unknown];
  setState: [items: Record<string, unknown>];
  updateProfile: [name?: string | string[] | null, bypassCache?: boolean | string];
};

export type BackgroundMethodResult = {
  explainRequest: RequestExplanation;
  getAll: Options;
  getState: Record<string, unknown>;
  patch: Options;
  renameProfile: Options;
  replaceRef: Options;
  reset: Options;
  resetOptionsSync: void;
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

declare const chrome: {
  i18n?: {
    getMessage?: (key: string, substitutions?: string | string[]) => string;
    getUILanguage?: () => string;
  };
  runtime?: {
    getManifest?: () => {manifest_version?: number; version?: string};
    getURL?: (path: string) => string;
    id?: string;
    lastError?: {message?: string};
    sendMessage?: <M extends BackgroundMethod>(
      message: BackgroundMessage<M>,
      callback: (response?: BackgroundResponse<BackgroundMethodResult[M]>) => void
    ) => void;
  };
  tabs?: {
    create?: (props: {url: string}, callback?: () => void) => void;
    query?: (queryInfo: {url?: string}, callback: (tabs: Array<{id?: number; url?: string}>) => void) => void;
    update?: (tabId: number | undefined, props: {active?: boolean; url?: string}, callback?: () => void) => void;
  };
};

declare const browser: {
  commands?: {
    openShortcutSettings?: () => Promise<void> | void;
  };
} | undefined;

export type UiLocale = 'en' | 'zh-Hans' | 'zh-Hant' | 'es' | 'ru' | 'cs' | 'fa';

export type UiLocaleOption = {
  dir?: 'rtl';
  extensionLocale: string;
  label: string;
  value: UiLocale;
};

type LocaleMessage = {
  message: string;
  placeholders?: Record<string, {
    content: string;
  }>;
};

type LocaleCatalog = Record<string, LocaleMessage>;

export const UI_LOCALES: UiLocaleOption[] = [
  {value: 'en', extensionLocale: 'en', label: 'English'},
  {value: 'zh-Hans', extensionLocale: 'zh_CN', label: '简体中文'},
  {value: 'zh-Hant', extensionLocale: 'zh_TW', label: '繁體中文'},
  {value: 'es', extensionLocale: 'es', label: 'Español'},
  {value: 'ru', extensionLocale: 'ru', label: 'Русский'},
  {value: 'cs', extensionLocale: 'cs', label: 'Čeština'},
  {value: 'fa', extensionLocale: 'fa', label: 'فارسی', dir: 'rtl'}
];

const UI_LOCALE_BY_VALUE = new Map(UI_LOCALES.map((locale) => [locale.value, locale]));
const UI_LOCALE_BY_EXTENSION = new Map(UI_LOCALES.map((locale) => [locale.extensionLocale, locale]));
const localeCatalogs = new Map<UiLocale, LocaleCatalog | null>();

let currentUiLocale: UiLocale = 'en';
let currentCatalog: LocaleCatalog | null = null;
let englishCatalog: LocaleCatalog | null = null;

export function normalizeUiLocale(value: unknown): UiLocale | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.replace(/_/g, '-');
  if (UI_LOCALE_BY_VALUE.has(normalized as UiLocale)) {
    return normalized as UiLocale;
  }
  const extensionLocale = UI_LOCALE_BY_EXTENSION.get(value);
  return extensionLocale?.value || null;
}

export function browserUiLocale(language = chrome?.i18n?.getUILanguage?.() || ''): UiLocale {
  const normalized = language.replace(/_/g, '-').toLowerCase();
  if (normalized === 'zh' || normalized.startsWith('zh-hans') || normalized.startsWith('zh-cn') || normalized.startsWith('zh-sg')) {
    return 'zh-Hans';
  }
  if (normalized.startsWith('zh-hant') || normalized.startsWith('zh-tw') || normalized.startsWith('zh-hk') || normalized.startsWith('zh-mo')) {
    return 'zh-Hant';
  }
  if (normalized.startsWith('cs')) {
    return 'cs';
  }
  if (normalized.startsWith('es')) {
    return 'es';
  }
  if (normalized.startsWith('fa')) {
    return 'fa';
  }
  if (normalized.startsWith('ru')) {
    return 'ru';
  }
  return 'en';
}

export function uiLocaleForOptions(options?: Options | null): UiLocale {
  return normalizeUiLocale(options?.['-uiLocale']) || browserUiLocale();
}

function substitutionsArray(substitutions?: string | string[]) {
  if (Array.isArray(substitutions)) {
    return substitutions;
  }
  if (substitutions == null) {
    return [];
  }
  return [substitutions];
}

function replaceAllText(text: string, search: string, replacement: string) {
  return text.split(search).join(replacement);
}

function formatMessage(entry: LocaleMessage | undefined, substitutions?: string | string[]) {
  if (!entry) {
    return '';
  }
  let text = entry.message || '';
  const values = substitutionsArray(substitutions);
  if (entry.placeholders) {
    for (const [name, placeholder] of Object.entries(entry.placeholders)) {
      const match = placeholder.content.match(/^\$(\d+)$/);
      if (!match) {
        continue;
      }
      const value = values[Number(match[1]) - 1];
      if (value != null) {
        text = replaceAllText(text, `$${name}$`, String(value));
      }
    }
  }
  for (let i = 0; i < values.length; i++) {
    text = replaceAllText(text, `$${i}$`, String(values[i]));
    text = replaceAllText(text, `$${i + 1}$`, String(values[i]));
  }
  return text;
}

async function fetchLocaleCatalog(locale: UiLocale) {
  if (localeCatalogs.has(locale)) {
    return localeCatalogs.get(locale) || null;
  }
  const option = UI_LOCALE_BY_VALUE.get(locale);
  const url = option && chrome?.runtime?.getURL?.(`_locales/${option.extensionLocale}/messages.json`);
  if (!url) {
    localeCatalogs.set(locale, null);
    return null;
  }
  if (url.startsWith('file:')) {
    localeCatalogs.set(locale, null);
    return null;
  }
  try {
    const response = await fetch(url, {cache: 'no-store'});
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    const catalog = await response.json() as LocaleCatalog;
    localeCatalogs.set(locale, catalog);
    return catalog;
  } catch (_error) {
    localeCatalogs.set(locale, null);
    return null;
  }
}

function applyDocumentLocale(locale: UiLocale) {
  const option = UI_LOCALE_BY_VALUE.get(locale);
  document.documentElement.lang = locale;
  document.documentElement.dir = option?.dir || 'ltr';
}

export async function setUiLocale(locale: unknown) {
  const nextLocale = normalizeUiLocale(locale) || browserUiLocale();
  const [nextCatalog, fallbackCatalog] = await Promise.all([
    fetchLocaleCatalog(nextLocale),
    fetchLocaleCatalog('en')
  ]);
  currentUiLocale = nextLocale;
  currentCatalog = nextCatalog;
  englishCatalog = fallbackCatalog;
  applyDocumentLocale(nextLocale);
  return nextLocale;
}

async function applyOptionsLocale(options: Options) {
  await setUiLocale(uiLocaleForOptions(options));
  return options;
}

export function message(key: string, fallback = key, substitutions?: string | string[]) {
  const catalogMessage = formatMessage(currentCatalog?.[key] || englishCatalog?.[key], substitutions);
  return catalogMessage || chrome?.i18n?.getMessage?.(key, substitutions) || fallback;
}

export function manifestVersion() {
  return chrome?.runtime?.getManifest?.()?.version || 'unknown';
}

export function runtimeAvailable() {
  return Boolean(chrome?.runtime?.sendMessage);
}

export function shouldAutoMount(scriptName: string) {
  const script = document.currentScript as HTMLScriptElement | null;
  const src = script?.src || '';
  if (src.endsWith(`/${scriptName}`) || src.endsWith(scriptName)) {
    return true;
  }
  return Array.from(document.scripts).some((candidate) => {
    const candidateSrc = candidate.src || candidate.getAttribute('src') || '';
    return candidate.type === 'module' && (
      candidateSrc.endsWith(`/${scriptName}`) ||
      candidateSrc.endsWith(scriptName)
    );
  });
}

function isManifestV3() {
  const manifest = chrome?.runtime?.getManifest?.();
  return Boolean(manifest?.manifest_version && manifest.manifest_version >= 3);
}

export function callBackground<M extends BackgroundMethod>(method: M, ...args: BackgroundMethodArgs[M]): Promise<BackgroundMethodResult[M]> {
  return new Promise((resolve, reject) => {
    if (!chrome?.runtime?.sendMessage) {
      reject(new Error('Extension runtime is unavailable.'));
      return;
    }
    chrome.runtime.sendMessage({method, args}, (response) => {
      if (chrome.runtime?.lastError) {
        reject(new Error(chrome.runtime.lastError.message || 'Unknown runtime error.'));
        return;
      }
      if (response?.error) {
        reject(decodeBackgroundError(response.error));
        return;
      }
      resolve(response?.result as BackgroundMethodResult[M]);
    });
  });
}

export function callBackgroundNoReply<M extends BackgroundMethod>(method: M, ...args: BackgroundMethodArgs[M]) {
  chrome?.runtime?.sendMessage?.({
    method,
    args,
    noReply: true
  }, () => {
    chrome?.runtime?.lastError;
  });
}

export function decodeBackgroundError(error: unknown): BackgroundError | unknown {
  const serialized = error as {
    _error?: string;
    message?: string;
    name?: string;
    original?: BackgroundError['original'];
    reason?: string;
    stack?: string;
    statusCode?: number | string;
  } | null | undefined;
  if (serialized?._error !== 'error') {
    return error;
  }
  const decoded = new Error(serialized.message || serialized.name || 'Background error') as BackgroundError;
  decoded.name = serialized.name || decoded.name;
  decoded.original = serialized.original;
  decoded.reason = serialized.reason;
  decoded.statusCode = serialized.statusCode;
  if (serialized.stack) {
    decoded.stack = serialized.stack;
  }
  return decoded;
}

export function loadOptions() {
  return callBackground('getAll').then(applyOptionsLocale);
}

export function patchOptions(patch: OptionsPatch) {
  return callBackground('patch', patch).then(applyOptionsLocale);
}

export function patchAndLoadOptions(patch: Options) {
  return patchOptions(patch).then(loadOptions);
}

export function resetOptions(options?: Options | string) {
  return callBackground('reset', options).then(applyOptionsLocale);
}

export function setOptionsSync(enabled: boolean, args?: unknown) {
  return callBackground('setOptionsSync', enabled, args);
}

export function resetOptionsSync() {
  return callBackground('resetOptionsSync');
}

export function explainRequest(args: RequestExplainArgs | string) {
  return callBackground('explainRequest', args);
}

function stateKey(name: string) {
  return `omega.local.${name}`;
}

export function getLocalState<T = unknown>(name: string) {
  try {
    const value = window.localStorage.getItem(stateKey(name));
    return value == null ? undefined : JSON.parse(value) as T;
  } catch (err) {
    return undefined;
  }
}

export function setLocalState<T>(name: string, value: T) {
  window.localStorage.setItem(stateKey(name), JSON.stringify(value));
}

export function getState<T = unknown>(name: string): Promise<T | undefined>;
export function getState<T = unknown>(name: string[]): Promise<Array<T | undefined>>;
export function getState<T = unknown>(name: string | string[]) {
  if (isManifestV3()) {
    return callBackground('getState', name).then((result) => {
      const typedResult = result as Record<string, T>;
      if (Array.isArray(name)) {
        return name.map((key) => typedResult?.[key]);
      }
      return typedResult?.[name];
    });
  }
  if (Array.isArray(name)) {
    return Promise.resolve(name.map((key) => getLocalState<T>(key)));
  }
  return Promise.resolve(getLocalState<T>(name));
}

export function setState<T = unknown>(name: string, value: T) {
  if (isManifestV3()) {
    return callBackground('setState', {[name]: value}).then(() => value);
  }
  setLocalState(name, value);
  return Promise.resolve(value);
}

export function lastUrl(url?: string) {
  const name = 'web.last_url';
  if (url) {
    setState(name, url);
    return url;
  }
  return getLocalState<string>(name);
}

export function renameProfile(fromName: string, toName: string) {
  return callBackground('renameProfile', fromName, toName).then(loadOptions);
}

export function replaceRef(fromName: string, toName: string) {
  return callBackground('replaceRef', fromName, toName).then(loadOptions);
}

export function updateProfile(name?: string, bypassCache = 'bypass_cache') {
  return callBackground('updateProfile', name, bypassCache).then((results) => {
    const decoded: ProfileUpdateResults = {};
    for (const key of Object.keys(results || {})) {
      decoded[key] = decodeBackgroundError(results[key]);
    }
    return decoded;
  }).then((results) => loadOptions().then((options) => ({
    options,
    results
  })));
}

export function openShortcutConfig() {
  if (typeof browser !== 'undefined' && typeof browser.commands?.openShortcutSettings === 'function') {
    void Promise.resolve(browser.commands.openShortcutSettings()).catch(() => {
      chrome?.tabs?.create?.({
        url: 'about:addons'
      });
    });
    return;
  }
  chrome?.tabs?.create?.({
    url: typeof browser !== 'undefined' ? 'about:addons' : 'chrome://extensions/configureCommands'
  });
}

export function openManage() {
  const id = chrome?.runtime?.id || '';
  chrome?.tabs?.create?.({
    url: `chrome://extensions/?id=${id}`
  });
}

export function openOptions(hash?: string) {
  const optionsUrl = chrome?.runtime?.getURL?.('options.html') || 'options.html';
  if (!chrome?.tabs?.query) {
    window.location.href = hash ? `${optionsUrl}${hash}` : optionsUrl;
    return;
  }
  chrome.tabs.query({url: optionsUrl}, (tabs) => {
    let targetUrl = optionsUrl;
    if (hash) {
      try {
        const parsed = new URL(tabs?.[0]?.url || optionsUrl);
        parsed.hash = hash;
        targetUrl = parsed.href;
      } catch (err) {
        targetUrl = `${optionsUrl}${hash}`;
      }
    }
    if (tabs?.length > 0) {
      chrome.tabs?.update?.(tabs[0].id, {
        active: true,
        ...(hash ? {url: targetUrl} : {})
      });
      return;
    }
    chrome.tabs?.create?.({
      url: targetUrl
    });
  });
}

export function optionPatch(before: Options, after: Options, keys: string[]) {
  const patch: OptionsPatch = {};
  for (const key of keys) {
    if (before[key] !== after[key]) {
      patch[key] = [before[key], after[key]];
    }
  }
  return patch;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
