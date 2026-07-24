import fsp from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
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

async function getProfileScopeInfo(page, tab, incognito) {
  const pageInfo = await callRuntime(page, 'getPageInfo', [{
    incognito,
    tabId: tab.id,
    url: 'https://www.example.com/',
    windowId: tab.windowId
  }]);
  return pageInfo.profileScope;
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
  const backgroundGlobals = await serviceWorker.evaluate(() => ({
    BrowserExtensionRuntime: typeof globalThis.BrowserExtensionRuntime,
    ExtensionRuntime: typeof globalThis.ExtensionRuntime,
    ProxyEngine: typeof globalThis.ProxyEngine,
    window: typeof globalThis.window
  }));
  for (const [name, type] of Object.entries(backgroundGlobals)) {
    if (type !== 'undefined') {
      throw new Error(`Legacy background global ${name} is still exposed as ${type}.`);
    }
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
  const chromiumProfileScopes = {
    container: false,
    group: false,
    site: false,
    tab: false,
    window: true
  };
  const capabilityState = await callRuntime(optionsPage, 'getState', ['profileScopeCapabilities']);
  assert.deepStrictEqual(
    capabilityState.profileScopeCapabilities,
    chromiumProfileScopes,
    'Chromium should expose only Window profile scope capability'
  );

  const optionsBeforeScopeTest = await callRuntime(optionsPage, 'getAll');
  const forcedAssignments = {
    containers: {},
    rules: [
      {
        condition: {
          conditionType: 'HostWildcardCondition',
          pattern: 'www.example.com'
        },
        profileName: 'direct'
      }
    ]
  };
  await callRuntime(optionsPage, 'patch', [
    {
      '-profileScopeAssignments': [optionsBeforeScopeTest['-profileScopeAssignments'], forcedAssignments],
      '-profileScopes': [
        optionsBeforeScopeTest['-profileScopes'],
        {
          container: true,
          group: true,
          site: true,
          tab: true,
          window: true
        }
      ]
    }
  ]);

  const forcedProfileScope = await getProfileScopeInfo(optionsPage, activeTab, false);
  assert.deepStrictEqual(
    forcedProfileScope.capabilities,
    chromiumProfileScopes,
    'Profile scope capabilities should remain gated after forcing all options on'
  );
  assert.deepStrictEqual(
    forcedProfileScope.enabled,
    chromiumProfileScopes,
    'Unsupported profile scopes should not become effective when raw options are enabled'
  );
  assert.equal(forcedProfileScope.siteProfileName, 'direct');
  assert.equal(forcedProfileScope.effectiveScope, 'current');

  const assignmentsBeforeUnsupportedSet = (await callRuntime(optionsPage, 'getAll'))['-profileScopeAssignments'];
  const unsupportedScopeRequests = [
    {
      profileName: 'direct',
      scope: 'tab',
      tabId: activeTab.id
    },
    {
      groupId: 1,
      profileName: 'direct',
      scope: 'group',
      windowId: activeTab.windowId
    },
    {
      cookieStoreId: 'firefox-container-1',
      profileName: 'direct',
      scope: 'container'
    },
    {
      profileName: 'direct',
      scope: 'page',
      url: 'https://www.example.com/'
    },
    {
      profileName: 'direct',
      scope: 'site',
      url: 'https://www.example.com/'
    }
  ];
  for (const request of unsupportedScopeRequests) {
    await callRuntime(optionsPage, 'setProfileScope', [request]);
  }
  const assignmentsAfterUnsupportedSet = (await callRuntime(optionsPage, 'getAll'))['-profileScopeAssignments'];
  assert.deepStrictEqual(
    assignmentsAfterUnsupportedSet,
    assignmentsBeforeUnsupportedSet,
    'Unsupported profile scope requests should not modify assignments'
  );

  await callRuntime(optionsPage, 'setProfileScope', [
    {
      profileName: 'direct',
      scope: 'normal'
    }
  ]);
  await callRuntime(optionsPage, 'setProfileScope', [
    {
      profileName: 'proxy',
      scope: 'private'
    }
  ]);
  const windowScopeOptions = await callRuntime(optionsPage, 'getAll');
  assert.equal(windowScopeOptions['-profileScopeAssignments'].normalDefaultProfileName, 'direct');
  assert.equal(windowScopeOptions['-profileScopeAssignments'].privateDefaultProfileName, 'proxy');
  const normalWindowScope = await getProfileScopeInfo(optionsPage, activeTab, false);
  const privateWindowScope = await getProfileScopeInfo(optionsPage, activeTab, true);
  assert.equal(normalWindowScope.effectiveScope, 'normal');
  assert.equal(normalWindowScope.effectiveProfileName, 'direct');
  assert.equal(privateWindowScope.effectiveScope, 'private');
  assert.equal(privateWindowScope.effectiveProfileName, 'proxy');

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
