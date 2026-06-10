import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
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
  const response = await driver.executeAsyncScript(`
    const done = arguments[arguments.length - 1];
    try {
      chrome.runtime.sendMessage({method: 'getState', args: ['firstRun']}, (message) => {
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
  `);
  if (!response?.ok) {
    throw new Error(`${label}: background messaging failed: ${response?.error || 'unknown error'}`);
  }
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
