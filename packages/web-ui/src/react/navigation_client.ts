import {
  createTab,
  downloadBlobFile,
  extensionBrowser,
  extensionId,
  extensionManifestVersion,
  extensionUrl,
  queryTabsByUrl,
  setLocationHref,
  shouldAutoMountScript,
  updateTab
} from './browser_env';

export function manifestVersion() {
  return extensionManifestVersion();
}

export function shouldAutoMount(scriptName: string) {
  return shouldAutoMountScript(scriptName);
}

export function openShortcutConfig() {
  const browser = extensionBrowser();
  if (typeof browser?.commands?.openShortcutSettings === 'function') {
    void Promise.resolve(browser.commands.openShortcutSettings()).catch(() => {
      createTab('about:addons');
    });
    return;
  }
  createTab(browser ? 'about:addons' : 'chrome://extensions/configureCommands');
}

export function openManage() {
  createTab(`chrome://extensions/?id=${extensionId()}`);
}

export function openOptions(hash?: string) {
  const optionsUrl = extensionUrl('options.html');
  if (!queryTabsByUrl(optionsUrl, (tabs) => {
    let targetUrl = optionsUrl;
    if (hash) {
      try {
        const parsed = new URL(tabs?.[0]?.url || optionsUrl);
        parsed.hash = hash;
        targetUrl = parsed.href;
      } catch (_err) {
        targetUrl = `${optionsUrl}${hash}`;
      }
    }
    if (tabs?.length > 0) {
      updateTab(tabs[0].id, {
        active: true,
        ...(hash ? {url: targetUrl} : {})
      });
      return;
    }
    createTab(targetUrl);
  })) {
    setLocationHref(hash ? `${optionsUrl}${hash}` : optionsUrl);
    return;
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  downloadBlobFile(blob, filename);
}

