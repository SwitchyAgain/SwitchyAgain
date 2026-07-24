import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {
  assertExtensionBuild,
  extensionBuildDir,
  loadEnglishMessages,
  loadManifest,
  loadPackage,
  temporaryDir
} from './smoke-lib.mjs';

assertExtensionBuild();

const execFileAsync = promisify(execFile);
const messages = loadEnglishMessages();
const manifest = loadManifest();
const seleniumHelp = 'Run this smoke through `npm run smoke:extension:firefox`.';
const webdriver = loadPackage('selenium-webdriver', 'selenium-webdriver', seleniumHelp);
const firefox = loadPackage('selenium-webdriver', 'selenium-webdriver/firefox', seleniumHelp);
const {Builder, By, until} = webdriver;

function messageForKey(key) {
  return messages[key]?.message || '';
}

function isExecutable(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch (_error) {
    return false;
  }
}

function findOnPath(names) {
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    if (!dir) {
      continue;
    }
    for (const name of names) {
      const candidate = path.join(dir, name);
      if (isExecutable(candidate)) {
        return candidate;
      }
    }
  }
  return null;
}

function resolveFirefoxBinary() {
  const explicit = process.env.FIREFOX_BIN?.trim();
  if (explicit) {
    const resolved = explicit.includes(path.sep) || path.isAbsolute(explicit)
      ? path.resolve(explicit)
      : findOnPath([explicit]);
    if (resolved && isExecutable(resolved)) {
      return resolved;
    }
    throw new Error(`FIREFOX_BIN does not point to an executable Firefox binary: ${explicit}`);
  }

  const found = findOnPath(['firefox-esr', 'firefox']);
  if (found) {
    return found;
  }
  throw new Error('Firefox binary is unavailable. Install Firefox ESR 140+ or set FIREFOX_BIN=/path/to/firefox.');
}

async function assertFirefoxVersion(firefoxBin) {
  const {stdout, stderr} = await execFileAsync(firefoxBin, ['--version'], {timeout: 10000});
  const versionText = `${stdout}${stderr}`.trim();
  const match = versionText.match(/(\d+)(?:\.\d+)?/);
  if (!match) {
    console.warn(`Unable to parse Firefox version from: ${versionText || firefoxBin}`);
    return;
  }
  const majorVersion = Number(match[1]);
  if (majorVersion < 140) {
    throw new Error(`Firefox 140+ is required by the extension manifest. Found: ${versionText}`);
  }
  console.log(`using ${versionText} at ${firefoxBin}`);
}

function firefoxManifestFromBuild(buildManifest) {
  const firefoxManifest = JSON.parse(JSON.stringify(buildManifest));
  if (Array.isArray(firefoxManifest.permissions)) {
    firefoxManifest.permissions = firefoxManifest.permissions.filter((permission) => permission !== 'downloads');
  }
  delete firefoxManifest.key;
  delete firefoxManifest.minimum_chrome_version;
  return firefoxManifest;
}

async function writeFirefoxExtension(tempExtensionDir) {
  await fsp.cp(extensionBuildDir, tempExtensionDir, {recursive: true});
  await fsp.writeFile(
    path.join(tempExtensionDir, 'manifest.json'),
    JSON.stringify(firefoxManifestFromBuild(manifest))
  );
}

async function expectText(driver, text, label) {
  await driver.wait(async () => {
    try {
      const body = await driver.findElement(By.css('body'));
      const bodyText = await body.getText();
      return bodyText.includes(text);
    } catch (_error) {
      return false;
    }
  }, 10000, `${label}: expected visible text ${JSON.stringify(text)}`);
}

async function expectSelector(driver, selector, label) {
  const element = await driver.wait(
    until.elementLocated(By.css(selector)),
    10000,
    `${label}: expected visible selector ${selector}`
  );
  await driver.wait(
    until.elementIsVisible(element),
    10000,
    `${label}: expected visible selector ${selector}`
  );
}

async function withFirefoxChromeContext(driver, callback) {
  if (!firefox.Context?.CHROME || typeof driver.setContext !== 'function') {
    throw new Error('Firefox chrome context is unavailable in selenium-webdriver.');
  }
  await driver.setContext(firefox.Context.CHROME);
  try {
    return await callback();
  } finally {
    await driver.setContext(firefox.Context.CONTENT);
  }
}

async function readWebExtensionUuids(driver) {
  const raw = await withFirefoxChromeContext(driver, () => {
    return driver.executeScript(`
      const Services = globalThis.Services ||
        ChromeUtils.importESModule('resource://gre/modules/Services.sys.mjs').Services;
      return Services.prefs.getStringPref('extensions.webextensions.uuids', '{}');
    `);
  });
  return JSON.parse(raw || '{}');
}

async function waitForExtensionUuid(driver, extensionIds) {
  const deadline = Date.now() + 10000;
  let uuids = {};
  do {
    uuids = await readWebExtensionUuids(driver);
    for (const extensionId of extensionIds) {
      if (extensionId && uuids[extensionId]) {
        return uuids[extensionId];
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  } while (Date.now() < deadline);

  throw new Error([
    'Unable to find Firefox internal UUID for installed extension.',
    `Expected extension ids: ${extensionIds.filter(Boolean).join(', ') || '(none)'}.`,
    `Known extension ids: ${Object.keys(uuids).sort().join(', ') || '(none)'}.`
  ].join(' '));
}

async function expectBackgroundMessaging(driver, label) {
  await callBackground(driver, 'getState', ['firstRun'], label);
}

async function callBackground(driver, method, args = [], label = method) {
  const response = await driver.executeAsyncScript(`
    const method = arguments[0];
    const args = arguments[1];
    const done = arguments[arguments.length - 1];
    try {
      chrome.runtime.sendMessage({method, args}, (message) => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          done({ok: false, error: lastError.message || String(lastError)});
          return;
        }
        if (message && message.error) {
          done({ok: false, error: JSON.stringify(message.error)});
          return;
        }
        done({ok: true, result: message ? message.result : undefined});
      });
    } catch (error) {
      done({ok: false, error: error && (error.stack || error.message) || String(error)});
    }
  `, method, args);
  if (!response?.ok) {
    throw new Error(`${label}: background messaging failed: ${response?.error || 'unknown error'}`);
  }
  return response.result;
}

async function activeTab(driver) {
  const tab = await driver.executeAsyncScript(`
    const done = arguments[arguments.length - 1];
    chrome.tabs.query({active: true, lastFocusedWindow: true}, (tabs) => done(tabs[0] || null));
  `);
  if (!tab || typeof tab.id !== 'number' || typeof tab.windowId !== 'number') {
    throw new Error('Unable to find an active Firefox tab for profile scope smoke tests.');
  }
  return tab;
}

async function profileScopeInfo(driver, tab, values = {}) {
  const pageInfo = await callBackground(driver, 'getPageInfo', [
    {
      tabId: tab.id,
      url: 'https://www.example.com/profile/path?mode=1',
      windowId: tab.windowId,
      ...values
    }
  ]);
  return pageInfo.profileScope;
}

const tempRoot = await temporaryDir('switchyagain-smoke-firefox-');
const tempExtensionDir = path.join(tempRoot, 'extension');
const profileDir = path.join(tempRoot, 'profile');
const firefoxBin = resolveFirefoxBinary();
let driver;

try {
  await assertFirefoxVersion(firefoxBin);
  await fsp.mkdir(profileDir, {recursive: true});
  await writeFirefoxExtension(tempExtensionDir);

  const options = new firefox.Options()
    .setBinary(firefoxBin)
    .addArguments('-headless')
    .addArguments('-remote-allow-system-access')
    .setProfile(profileDir)
    .setPreference('extensions.update.enabled', false)
    .setPreference('extensions.systemAddon.update.enabled', false)
    .setPreference('xpinstall.signatures.required', false);

  driver = await new Builder()
    .forBrowser('firefox')
    .setFirefoxOptions(options)
    .build();

  const addonId = await driver.installAddon(tempExtensionDir, true);
  const manifestExtensionId = manifest.browser_specific_settings?.gecko?.id;
  const extensionUuid = await waitForExtensionUuid(driver, [addonId, manifestExtensionId]);

  await driver.get(`moz-extension://${extensionUuid}/options.html#/about`);
  await expectText(driver, messageForKey('about_title') || 'About', 'firefox extension options');
  await expectBackgroundMessaging(driver, 'firefox extension options');
  await callBackground(driver, 'applyProfile', ['auto switch'], 'firefox profile scope setup');
  const tab = await activeTab(driver);
  const allProfileScopes = {
    container: true,
    group: true,
    site: true,
    tab: true,
    window: true
  };
  const capabilityState = await callBackground(driver, 'getState', ['profileScopeCapabilities']);
  assert.deepStrictEqual(
    capabilityState.profileScopeCapabilities,
    allProfileScopes,
    'Firefox should expose all profile scope capabilities'
  );

  const optionsBeforeScopeTest = await callBackground(driver, 'getAll');
  await callBackground(driver, 'patch', [
    {
      '-profileScopeAssignments': [optionsBeforeScopeTest['-profileScopeAssignments'], {containers: {}, rules: []}],
      '-profileScopes': [optionsBeforeScopeTest['-profileScopes'], allProfileScopes]
    }
  ], 'firefox profile scope options setup');

  await callBackground(driver, 'setProfileScope', [
    {
      profileName: 'direct',
      scope: 'page',
      url: 'https://www.example.com/profile/path?mode=1'
    }
  ]);
  let scope = await profileScopeInfo(driver, tab);
  assert.equal(scope.effectiveScope, 'page');
  assert.equal(scope.effectiveProfileName, 'direct');
  scope = await profileScopeInfo(driver, tab, {url: 'https://www.example.com/profile/path?mode=2'});
  assert.notEqual(scope.effectiveScope, 'page');
  await callBackground(driver, 'setProfileScope', [
    {
      scope: 'page',
      url: 'https://www.example.com/profile/path?mode=1'
    }
  ]);

  await callBackground(driver, 'setProfileScope', [
    {
      profileName: 'proxy',
      scope: 'site',
      url: 'https://www.example.com/profile/path?mode=1'
    }
  ]);
  scope = await profileScopeInfo(driver, tab, {url: 'https://www.example.com/another-path'});
  assert.equal(scope.effectiveScope, 'site');
  assert.equal(scope.effectiveProfileName, 'proxy');
  await callBackground(driver, 'setProfileScope', [
    {
      scope: 'site',
      url: 'https://www.example.com/profile/path?mode=1'
    }
  ]);

  await callBackground(driver, 'setProfileScope', [
    {
      profileName: 'direct',
      scope: 'tab',
      tabId: tab.id
    }
  ]);
  scope = await profileScopeInfo(driver, tab);
  assert.equal(scope.effectiveScope, 'tab');
  assert.equal(scope.effectiveProfileName, 'direct');
  await callBackground(driver, 'setProfileScope', [{scope: 'tab', tabId: tab.id}]);

  const groupId = 7;
  await callBackground(driver, 'setProfileScope', [
    {
      groupId,
      profileName: 'proxy',
      scope: 'group',
      windowId: tab.windowId
    }
  ]);
  scope = await profileScopeInfo(driver, tab, {groupId});
  assert.equal(scope.effectiveScope, 'group');
  assert.equal(scope.effectiveProfileName, 'proxy');
  await callBackground(driver, 'setProfileScope', [{groupId, scope: 'group', windowId: tab.windowId}]);

  const cookieStoreId = 'firefox-container-1';
  await callBackground(driver, 'setProfileScope', [
    {
      cookieStoreId,
      profileName: 'direct',
      scope: 'container'
    }
  ]);
  scope = await profileScopeInfo(driver, tab, {cookieStoreId});
  assert.equal(scope.effectiveScope, 'container');
  assert.equal(scope.effectiveProfileName, 'direct');
  await callBackground(driver, 'setProfileScope', [{cookieStoreId, scope: 'container'}]);

  await callBackground(driver, 'setProfileScope', [{profileName: 'direct', scope: 'normal'}]);
  await callBackground(driver, 'setProfileScope', [{profileName: 'proxy', scope: 'private'}]);
  const normalScope = await profileScopeInfo(driver, tab, {incognito: false});
  const privateScope = await profileScopeInfo(driver, tab, {incognito: true});
  assert.equal(normalScope.effectiveScope, 'normal');
  assert.equal(normalScope.effectiveProfileName, 'direct');
  assert.equal(privateScope.effectiveScope, 'private');
  assert.equal(privateScope.effectiveProfileName, 'proxy');

  console.log(`ok firefox extension options (${manifest.version})`);

  await driver.get(`moz-extension://${extensionUuid}/popup/index.html`);
  await expectSelector(driver, '#js-option', 'firefox extension popup');
  console.log('ok firefox extension popup');
} finally {
  if (driver) {
    await driver.quit().catch((error) => {
      console.warn(`Unable to quit Firefox driver cleanly: ${error instanceof Error ? error.message : String(error)}`);
    });
  }
  await fsp.rm(tempRoot, {recursive: true, force: true});
}
