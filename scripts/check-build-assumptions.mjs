import {readdir, readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const tsconfigTargets = [
  'packages/proxy-engine/tsconfig.build.json',
  'packages/proxy-engine/tsconfig.json',
  'packages/proxy-engine/tsconfig.test.json',
  'packages/extension-runtime/tsconfig.build.json',
  'packages/extension-runtime/tsconfig.json',
  'packages/extension-runtime/tsconfig.test.json',
  'packages/web-ui/tsconfig.react.json',
  'packages/web-ui/tsconfig.scripts.json',
  'packages/web-ui/tsconfig.build-script.json',
  'apps/browser-extension/tsconfig.build.json',
  'apps/browser-extension/tsconfig.json',
  'apps/browser-extension/tsconfig.scripts.json',
  'apps/browser-extension/tsconfig.build-script.json'
];

const failures = [];

async function readText(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

async function readJson(relativePath) {
  return JSON.parse(await readText(relativePath));
}

async function readBrowserEntrypoints() {
  return readJson('apps/browser-extension/browser-entrypoints.json');
}

function backgroundDocumentScripts(entrypoints) {
  return entrypoints.background.serviceWorkerScripts;
}

function fail(message) {
  failures.push(message);
}

function assertEqual(actual, expected, label) {
  const same = JSON.stringify(actual) === JSON.stringify(expected);
  if (!same) {
    fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

async function checkTsconfigTargets() {
  for (const file of tsconfigTargets) {
    const config = await readJson(file);
    const target = String(config.compilerOptions?.target || '').toLowerCase();
    if (target !== 'es2022') {
      fail(`${file}: compilerOptions.target must stay es2022, got ${JSON.stringify(config.compilerOptions?.target)}`);
    }
  }
}

async function walkFiles(dir, result = []) {
  const entries = await readdir(path.join(root, dir), {withFileTypes: true});
  for (const entry of entries) {
    const relativePath = path.join(dir, entry.name).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      if (['.git', 'node_modules', 'build', 'build-ts', 'dist', 'release', 'tmp'].includes(entry.name)) {
        continue;
      }
      await walkFiles(relativePath, result);
    } else if (/\.(json|mjs|mts|ts|tsx)$/.test(entry.name)) {
      result.push(relativePath);
    }
  }
  return result;
}

async function checkLegacyTargets() {
  const patterns = [
    /"target"\s*:\s*"es5"/,
    /"target"\s*:\s*"es2015"/,
    /--target=es5\b/,
    /--target=es2015\b/,
    /target\s*:\s*['"]es5['"]/,
    /target\s*:\s*['"]es2015['"]/
  ];
  for (const file of await walkFiles('.')) {
    if (file === 'scripts/check-build-assumptions.mjs') {
      continue;
    }
    const content = await readText(file);
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        fail(`${file}: legacy JavaScript target matched ${pattern}`);
      }
    }
  }
}

async function checkBundleTargetDefaults() {
  const script = await readText('scripts/bundle-esbuild.mjs');
  if (!/const target = args\['--target'\] \|\| 'es2022';/.test(script)) {
    fail('scripts/bundle-esbuild.mjs: default target must stay es2022');
  }
}

function parseImportScripts(source) {
  const match = source.match(/importScripts\(([\s\S]*?)\);/);
  if (!match) {
    return [];
  }
  return Array.from(match[1].matchAll(/['"]([^'"]+)['"]/g), (entry) => entry[1]);
}

function parseHtmlScripts(source) {
  return Array.from(source.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g), (entry) => entry[1]);
}

async function checkClassicScriptEntrypoints() {
  const entrypoints = await readBrowserEntrypoints();
  assertEqual(entrypoints.background.serviceWorkerScripts, ['js/background.js'], 'background must use one shared classic IIFE bundle');
  const serviceWorker = await readText('apps/browser-extension/src/js/service_worker.ts');
  assertEqual(
    parseImportScripts(serviceWorker),
    entrypoints.background.serviceWorkerScripts,
    'apps/browser-extension/src/js/service_worker.ts importScripts order'
  );

  const backgroundHtml = await readText('apps/browser-extension/overlay/background.html');
  assertEqual(
    parseHtmlScripts(backgroundHtml),
    backgroundDocumentScripts(entrypoints),
    'apps/browser-extension/overlay/background.html script order'
  );

  for (const [file, expected] of Object.entries(entrypoints.popupScripts)) {
    assertEqual(parseHtmlScripts(await readText(file)), expected, `${file} script order`);
  }
}

async function checkBackgroundPersistentListeners() {
  const file = 'apps/browser-extension/src/module/background.ts';
  const source = await readText(file);
  const stateRestore = source.indexOf('Object.assign(localState, await stateStorage.get(null));');
  if (stateRestore < 0) {
    fail(`${file}: background state restore was not found`);
    return;
  }
  for (const listener of [
    'chrome.runtime.onConnect.addListener(onOptionsHandoffConnect);',
    'chrome.runtime.onMessage.addListener(onBackgroundMessage);'
  ]) {
    const registration = source.indexOf(listener);
    if (registration < 0 || registration > stateRestore) {
      fail(`${file}: ${listener} must be registered before the first asynchronous state restore`);
    }
  }
  const startupGate = /backgroundStartup\s*\.then\(\s*\(\)\s*=>\s*readinessForRequest\(typedRequest\)\s*\)/.test(source);
  const startupComplete = source.indexOf('resolveBackgroundStartup();');
  if (!startupGate) {
    fail(`${file}: runtime messages must wait for background startup`);
  }
  if (startupComplete < stateRestore) {
    fail(`${file}: background startup must not complete before state restore`);
  }
}

await checkTsconfigTargets();
await checkLegacyTargets();
await checkBundleTargetDefaults();
await checkClassicScriptEntrypoints();
await checkBackgroundPersistentListeners();

if (failures.length > 0) {
  console.error('Build assumption checks failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log('ok build assumptions');
}
