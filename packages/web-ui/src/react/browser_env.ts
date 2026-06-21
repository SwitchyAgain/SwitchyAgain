export type ExtensionManifest = {
  manifest_version?: number;
  version?: string;
};

export type ExtensionRuntimeApi = {
  getManifest?: () => ExtensionManifest;
  getURL?: (path: string) => string;
  id?: string;
  lastError?: {message?: string};
  sendMessage?: (message: unknown, callback: (response?: unknown) => void) => void;
};

export type ExtensionChromeApi = {
  i18n?: {
    getMessage?: (key: string, substitutions?: string | string[]) => string;
    getUILanguage?: () => string;
  };
  runtime?: ExtensionRuntimeApi;
  tabs?: {
    create?: (props: {url: string}, callback?: () => void) => void;
    query?: (queryInfo: {url?: string}, callback: (tabs: Array<{id?: number; url?: string}>) => void) => void;
    update?: (tabId: number | undefined, props: {active?: boolean; url?: string}, callback?: () => void) => void;
  };
};

export type ExtensionBrowserApi = {
  commands?: {
    openShortcutSettings?: () => Promise<void> | void;
  };
};

type BrowserGlobal = typeof globalThis & {
  browser?: ExtensionBrowserApi;
  chrome?: ExtensionChromeApi;
  OmegaTargetPopup?: unknown;
};

function browserGlobal() {
  return globalThis as BrowserGlobal;
}

export function extensionChrome() {
  return browserGlobal().chrome || {};
}

export function extensionBrowser() {
  return browserGlobal().browser;
}

export function extensionRuntime() {
  return extensionChrome().runtime;
}

export function runtimeAvailable() {
  return typeof extensionRuntime()?.sendMessage === 'function';
}

export function runtimeLastErrorMessage() {
  return extensionRuntime()?.lastError?.message;
}

export function sendRuntimeMessage(message: unknown, callback: (response?: unknown) => void) {
  const runtime = extensionRuntime();
  if (!runtime?.sendMessage) {
    return false;
  }
  runtime.sendMessage(message, callback);
  return true;
}

export function extensionManifest() {
  return extensionRuntime()?.getManifest?.();
}

export function extensionManifestVersion() {
  return extensionManifest()?.version || 'unknown';
}

export function extensionManifestVersionNumber() {
  return extensionManifest()?.manifest_version;
}

export function extensionId() {
  return extensionRuntime()?.id || '';
}

export function extensionUrl(path: string, fallback = path) {
  return extensionRuntime()?.getURL?.(path) || fallback;
}

export function extensionMessage(key: string, fallback: string, substitutions?: string | string[]) {
  return extensionChrome().i18n?.getMessage?.(key, substitutions) || fallback;
}

export function extensionUiLanguage() {
  return extensionChrome().i18n?.getUILanguage?.() || '';
}

export function createTab(url: string) {
  extensionChrome().tabs?.create?.({url});
}

export function queryTabsByUrl(url: string, callback: (tabs: Array<{id?: number; url?: string}>) => void) {
  const tabs = extensionChrome().tabs;
  if (!tabs?.query) {
    return false;
  }
  tabs.query({url}, callback);
  return true;
}

export function updateTab(tabId: number | undefined, props: {active?: boolean; url?: string}) {
  extensionChrome().tabs?.update?.(tabId, props);
}

export function setLocationHref(url: string) {
  globalThis.location.href = url;
}

export function locationHash() {
  return globalThis.location.hash || '';
}

export function setLocationHash(hash: string) {
  globalThis.location.hash = hash;
}

export function reloadLocation() {
  globalThis.location.reload();
}

export function confirmDialog(messageText: string) {
  return globalThis.confirm(messageText);
}

export function setWindowTimeout(callback: () => void, delay = 0) {
  return globalThis.setTimeout(callback, delay);
}

export function clearWindowTimeout(timeout: ReturnType<typeof globalThis.setTimeout> | undefined) {
  if (timeout != null) {
    globalThis.clearTimeout(timeout);
  }
}

export function setBeforeUnload(handler: ((event: BeforeUnloadEvent) => string | void) | null) {
  globalThis.onbeforeunload = handler;
}

export function getJsonLocalStorage<T = unknown>(key: string) {
  try {
    const value = globalThis.localStorage.getItem(key);
    return value == null ? undefined : (JSON.parse(value) as T);
  } catch (_err) {
    return undefined;
  }
}

export function setJsonLocalStorage<T>(key: string, value: T) {
  globalThis.localStorage.setItem(key, JSON.stringify(value));
}

export function applyRootLocale(locale: string, dir: string) {
  globalThis.document.documentElement.lang = locale;
  globalThis.document.documentElement.dir = dir;
}

export function shouldAutoMountScript(scriptName: string) {
  const script = globalThis.document.currentScript as HTMLScriptElement | null;
  const src = script?.src || '';
  if (src.endsWith(`/${scriptName}`) || src.endsWith(scriptName)) {
    return true;
  }
  return Array.from(globalThis.document.scripts).some((candidate) => {
    const candidateSrc = candidate.src || candidate.getAttribute('src') || '';
    return candidate.type === 'module' && (candidateSrc.endsWith(`/${scriptName}`) || candidateSrc.endsWith(scriptName));
  });
}

export function downloadBlobFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = globalThis.document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  globalThis.document.body.appendChild(link);
  link.click();
  link.remove();
  globalThis.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function getGlobalValue<T>(name: string) {
  return browserGlobal()[name as keyof BrowserGlobal] as T | undefined;
}

export function closeWindow() {
  globalThis.close();
}

export function setBodyOpacity(opacity: string) {
  globalThis.document.body.style.opacity = opacity;
}

export function reloadHistory() {
  globalThis.history.go(0);
}
