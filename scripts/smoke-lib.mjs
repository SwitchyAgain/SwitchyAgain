import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';

export const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const extensionBuildDir = path.join(workspaceRoot, 'apps/browser-extension/build');
const require = createRequire(import.meta.url);

export function extensionFileUrl(relativePath, hash = '') {
  const url = pathToFileURL(path.join(extensionBuildDir, relativePath));
  url.hash = hash;
  return url.href;
}

export function assertExtensionBuild() {
  const manifestPath = path.join(extensionBuildDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('Extension build output is missing. Run `npm run build` first.');
  }
}

export async function temporaryDir(prefix) {
  return fsp.mkdtemp(path.join(os.tmpdir(), prefix));
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function defaultOptions() {
  return {
    schemaVersion: 3,
    '-enableQuickSwitch': false,
    '-refreshOnProfileChange': false,
    '-startupProfileName': '',
    '-quickSwitchProfiles': [],
    '-revertProxyChanges': true,
    '-confirmDeletion': true,
    '-showInspectMenu': true,
    '-addConditionsToBottom': false,
    '-showExternalProfile': true,
    '-downloadInterval': 1440,
    '+proxy': {
      bypassList: [
        {pattern: '127.0.0.1', conditionType: 'BypassCondition'},
        {pattern: '::1', conditionType: 'BypassCondition'},
        {pattern: 'localhost', conditionType: 'BypassCondition'}
      ],
      profileType: 'FixedProfile',
      name: 'proxy',
      color: '#99ccee',
      fallbackProxy: {
        port: 8080,
        scheme: 'http',
        host: 'proxy.example.com'
      }
    },
    '+auto switch': {
      profileType: 'SwitchProfile',
      rules: [
        {
          condition: {
            pattern: 'internal.example.com',
            conditionType: 'HostWildcardCondition'
          },
          profileName: 'direct'
        },
        {
          condition: {
            pattern: '*.example.com',
            conditionType: 'HostWildcardCondition'
          },
          profileName: 'proxy'
        }
      ],
      name: 'auto switch',
      color: '#99dd99',
      defaultProfileName: 'direct'
    }
  };
}

function popupProfiles() {
  return {
    '+direct': {
      builtin: true,
      color: '#aaa',
      name: 'direct',
      profileType: 'DirectProfile'
    },
    '+system': {
      builtin: true,
      color: '#000',
      name: 'system',
      profileType: 'SystemProfile'
    },
    '+proxy': {
      color: '#99ccee',
      name: 'proxy',
      profileType: 'FixedProfile'
    },
    '+auto switch': {
      color: '#99dd99',
      defaultProfileName: 'direct',
      name: 'auto switch',
      profileType: 'SwitchProfile',
      validResultProfiles: ['direct', 'proxy']
    }
  };
}

export function popupStateForPath(pathname) {
  return {
    availableProfiles: popupProfiles(),
    currentProfileCanAddRule: true,
    currentProfileName: 'proxy',
    isSystemProfile: false,
    lastProfileNameForCondition: 'proxy',
    proxyNotControllable: pathname.includes('proxy_not_controllable') ? 'app' : '',
    refreshOnProfileChange: false,
    showExternalProfile: false,
    validResultProfiles: ['direct', 'proxy']
  };
}

export function popupPageInfo() {
  return {
    domain: 'www.example.com',
    errorCount: 0,
    summary: {},
    url: 'https://www.example.com/'
  };
}

export function installBrowserErrorGuards(page, label) {
  const errors = [];
  page.on('pageerror', (error) => {
    errors.push(`${label}: page error: ${error.stack || error.message}`);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(`${label}: console error: ${message.text()}`);
    }
  });
  page.on('requestfailed', (request) => {
    const type = request.resourceType();
    if (type === 'document' || type === 'script' || type === 'stylesheet') {
      errors.push(`${label}: ${type} request failed: ${request.url()} ${request.failure()?.errorText || ''}`);
    }
  });
  return {
    assertNoErrors() {
      if (errors.length) {
        throw new Error(errors.join('\n'));
      }
    }
  };
}

export async function expectText(page, text, label) {
  await page.getByText(text, {exact: false}).first().waitFor({
    state: 'visible',
    timeout: 7000
  }).catch((error) => {
    throw new Error(`${label}: expected visible text ${JSON.stringify(text)}: ${error.message}`);
  });
}

export async function expectSelector(page, selector, label) {
  await page.locator(selector).first().waitFor({
    state: 'visible',
    timeout: 7000
  }).catch((error) => {
    throw new Error(`${label}: expected visible selector ${selector}: ${error.message}`);
  });
}

export function loadEnglishMessages() {
  return readJson(path.join(extensionBuildDir, '_locales/en/messages.json'));
}

export function loadManifest() {
  return readJson(path.join(extensionBuildDir, 'manifest.json'));
}

export function loadPackage(packageName, packagePath = packageName, helpText = '') {
  try {
    return require(packagePath);
  } catch (error) {
    for (const entry of (process.env.PATH || '').split(path.delimiter)) {
      if (!entry.endsWith(`${path.sep}node_modules${path.sep}.bin`)) {
        continue;
      }
      const nodeModules = path.dirname(entry);
      try {
        return createRequire(path.join(nodeModules, packageName, 'package.json'))(packagePath);
      } catch (_innerError) {
      }
    }
    const hint = helpText ? ` ${helpText}` : '';
    throw new Error(`${packagePath} is unavailable.${hint}`);
  }
}

export function loadPlaywright() {
  return loadPackage(
    'playwright',
    'playwright',
    'Run this smoke through `npm run smoke:ui:chromium`, `npm run smoke:ui:firefox`, or `npm run smoke:extension`.'
  );
}
