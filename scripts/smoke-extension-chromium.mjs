import fsp from 'node:fs/promises';
import path from 'node:path';
import {
  assertExtensionBuild,
  expectSelector,
  expectText,
  extensionBuildDir,
  installBrowserErrorGuards,
  loadEnglishMessages,
  loadPlaywright,
  loadManifest,
  temporaryDir
} from './smoke-lib.mjs';

assertExtensionBuild();

const messages = loadEnglishMessages();
const manifest = loadManifest();
const userDataDir = await temporaryDir('switchyagain-smoke-chromium-');
const extensionPath = path.resolve(extensionBuildDir);
const {chromium} = loadPlaywright();

function messageForKey(key) {
  return messages[key]?.message || '';
}

async function callRuntime(page, method, args = []) {
  return page.evaluate(({args, method}) => {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({method, args}, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message || 'Unknown runtime error.'));
          return;
        }
        if (response?.error) {
          reject(new Error(response.error.message || response.error.reason || JSON.stringify(response.error)));
          return;
        }
        resolve(response?.result);
      });
    });
  }, {args, method});
}

const context = await chromium.launchPersistentContext(userDataDir, {
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`
  ],
  executablePath: chromium.executablePath(),
  headless: true
});

try {
  let serviceWorker = context.serviceWorkers()[0];
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker', {timeout: 10000});
  }
  const extensionId = new URL(serviceWorker.url()).host;
  if (!extensionId) {
    throw new Error(`Unable to derive extension id from service worker URL: ${serviceWorker.url()}`);
  }

  const optionsPage = await context.newPage();
  const optionsGuard = installBrowserErrorGuards(optionsPage, 'chromium extension options');
  await optionsPage.goto(`chrome-extension://${extensionId}/options.html#/about`, {waitUntil: 'domcontentloaded'});
  await expectText(optionsPage, messageForKey('about_title') || 'About', 'chromium extension options');
  await callRuntime(optionsPage, 'patch', [{'-routeInfoRequestDetailsEnabled': [false, true]}]);
  await callRuntime(optionsPage, 'applyProfile', ['auto switch']);
  await callRuntime(optionsPage, 'setState', [{smokePersisted: true}]);
  const persistedState = await optionsPage.evaluate(() => {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get('__switchyagain_internal__.state.smokePersisted', (items) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message || 'Unknown storage error.'));
          return;
        }
        resolve(items['__switchyagain_internal__.state.smokePersisted']);
      });
    });
  });
  if (persistedState !== true) {
    throw new Error('Background state was not persisted through the namespaced storage backend.');
  }
  const storedOptions = await callRuntime(optionsPage, 'getAll');
  if (Object.keys(storedOptions).some((key) => key.startsWith('__switchyagain_internal__.'))) {
    throw new Error('Internal background storage leaked into extension options.');
  }
  const backgroundLog = await callRuntime(optionsPage, 'getLog');
  if (typeof backgroundLog !== 'string' || backgroundLog.length === 0) {
    throw new Error('Persistent background log is unavailable.');
  }
  const [activeTab] = await optionsPage.evaluate(() => {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({active: true, lastFocusedWindow: true}, (tabs) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message || 'Unknown runtime error.'));
          return;
        }
        resolve(tabs);
      });
    });
  });
  const pageInfo = await callRuntime(optionsPage, 'getPageInfo', [{
    tabId: activeTab.id,
    url: 'https://www.example.com/'
  }]);
  if (pageInfo.requestExplanations) {
    throw new Error('getPageInfo should not compute request explanations for the popup menu path.');
  }
  const explainedPageInfo = await callRuntime(optionsPage, 'getPageInfo', [{
    includeExplanations: true,
    tabId: activeTab.id,
    url: 'https://www.example.com/'
  }]);
  if (!Array.isArray(explainedPageInfo.requestExplanations) || explainedPageInfo.requestExplanations.length === 0) {
    throw new Error('getPageInfo did not return request explanations on demand.');
  }
  optionsGuard.assertNoErrors();
  console.log(`ok chromium extension options (${manifest.version})`);
  await optionsPage.close();

  const popupPage = await context.newPage();
  const popupGuard = installBrowserErrorGuards(popupPage, 'chromium extension popup');
  await popupPage.goto(`chrome-extension://${extensionId}/popup/index.html`, {waitUntil: 'domcontentloaded'});
  await expectSelector(popupPage, '#js-option', 'chromium extension popup');
  popupGuard.assertNoErrors();
  console.log('ok chromium extension popup');
  await popupPage.close();
} finally {
  await context.close();
  await fsp.rm(userDataDir, {recursive: true, force: true});
}
