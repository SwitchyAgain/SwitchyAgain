import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

const packages = [
  {
    name: '@switchyagain/proxy-engine',
    packageJson: 'packages/proxy-engine/package.json',
    exports: ['Conditions', 'PacGenerator', 'Profiles', 'RuleList']
  },
  {
    name: '@switchyagain/extension-runtime',
    packageJson: 'packages/extension-runtime/package.json',
    exports: ['BrowserStorage', 'Options', 'OptionsSync', 'Storage'],
    excludedExports: ['Promise']
  }
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
}

function assertExportShape(moduleValue, packageName, exportNames, label) {
  for (const exportName of exportNames) {
    assert(moduleValue?.[exportName] != null, `${packageName} ${label} is missing ${exportName}`);
  }
}

function assertExportsExcluded(moduleValue, packageName, exportNames, label) {
  for (const exportName of exportNames || []) {
    assert(moduleValue?.[exportName] == null, `${packageName} ${label} should not export ${exportName}`);
  }
}

function assertDeepImportBlocked(packageName) {
  try {
    require(`${packageName}/src/index`);
  } catch (error) {
    if (error?.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED') {
      return;
    }
    throw error;
  }
  throw new Error(`${packageName} should not allow deep import ${packageName}/src/index`);
}

for (const packageInfo of packages) {
  const manifest = await readJson(packageInfo.packageJson);
  assert(manifest.exports?.['.']?.require === './index.js', `${packageInfo.name} must keep CJS require export at ./index.js`);
  assert(manifest.exports?.['.']?.default === './index.js', `${packageInfo.name} must keep default export at ./index.js`);
  assert(manifest.exports?.['.']?.types === './index.d.ts', `${packageInfo.name} must keep checked-in type export at ./index.d.ts`);

  let required;
  try {
    required = require(packageInfo.name);
  } catch (error) {
    throw new Error(`${packageInfo.name} require failed. Run npm run build before checking package entrypoints. ${error.message}`);
  }
  assertExportShape(required, packageInfo.name, packageInfo.exports, 'require export');
  assertExportsExcluded(required, packageInfo.name, packageInfo.excludedExports, 'require export');

  const imported = await import(packageInfo.name);
  assertExportShape(imported.default, packageInfo.name, packageInfo.exports, 'dynamic import default export');
  assertExportsExcluded(imported.default, packageInfo.name, packageInfo.excludedExports, 'dynamic import default export');
  assertDeepImportBlocked(packageInfo.name);
}

console.log('ok package entrypoints');
