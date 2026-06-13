import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ZipArchive} from 'archiver';
import * as esbuild from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workspaceRoot = path.resolve(root, '../..');
const isRelease = process.argv.includes('release');

type PathFilter = (filePath: string) => boolean;

type BundleOptions = {
  entry: string;
  globalName: string;
  minify?: boolean;
};

type BrowserEntrypoints = {
  background: {
    documentScriptExclusions?: string[];
    serviceWorkerScripts: string[];
  };
};

type LocaleMessage = {
  message: string;
  placeholders?: Record<string, {
    content: string;
  }>;
};

type ReleaseManifest = Record<string, unknown> & {
  background: Record<string, unknown>;
  key?: string;
  minimum_chrome_version?: string;
  optional_permissions?: string[];
  permissions: string[];
};

type PoEntry = {
  msgid: string;
  msgstr: string;
};

async function ensureDir(filePath: string) {
  await fsp.mkdir(path.dirname(filePath), {recursive: true});
}

async function copyFile(src: string, dest: string) {
  await ensureDir(dest);
  await fsp.copyFile(src, dest);
}

async function copyTree(src: string, dest: string, filter: PathFilter = () => true) {
  const entries = await fsp.readdir(src, {withFileTypes: true});
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (!filter(srcPath)) {
      continue;
    }
    if (entry.isDirectory()) {
      await copyTree(srcPath, destPath, filter);
    } else if (entry.isFile()) {
      await copyFile(srcPath, destPath);
    }
  }
}

async function writeBundle(dest: string, options: BundleOptions) {
  await ensureDir(dest);
  await esbuild.build({
    absWorkingDir: root,
    bundle: true,
    define: {global: 'globalThis'},
    entryPoints: [options.entry],
    format: 'iife',
    globalName: options.globalName,
    legalComments: 'eof',
    minify: isRelease && !!options.minify,
    outfile: dest,
    platform: 'browser',
    target: 'es2022'
  });
}

async function readBrowserEntrypoints() {
  const content = await fsp.readFile(path.join(root, 'browser-entrypoints.json'), 'utf8');
  return JSON.parse(content) as BrowserEntrypoints;
}

function backgroundDocumentScripts(entrypoints: BrowserEntrypoints) {
  const exclusions = new Set(entrypoints.background.documentScriptExclusions || []);
  return entrypoints.background.serviceWorkerScripts.filter((script) => !exclusions.has(script));
}

async function writeServiceWorker(dest: string, scripts: string[]) {
  await ensureDir(dest);
  await fsp.writeFile(dest, [
    'importScripts(',
    ...scripts.map((script, index) => `  '${script}'${index === scripts.length - 1 ? '' : ','}`),
    ');',
    ''
  ].join('\n'));
}

async function writeBackgroundHtml(dest: string, scripts: string[]) {
  await ensureDir(dest);
  await fsp.writeFile(dest, [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="utf-8" />',
    '  <title>SwitchyAgain Background</title>',
    '</head>',
    '<body>',
    '  <canvas id="canvas-icon"></canvas>',
    ...scripts.map((script) => `  <script src="${script}"></script>`),
    '</body>',
    '</html>',
    ''
  ].join('\n'));
}

function parsePoString(value: string) {
  try {
    return JSON.parse(value) as string;
  } catch (error) {
    throw new Error(`Invalid PO string ${value}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function parsePo(content: string): Record<string, string> {
  const entries: PoEntry[] = [];
  let current: PoEntry | null = null;
  let activeField: 'msgid' | 'msgstr' | null = null;

  function flush() {
    if (current) {
      entries.push(current);
      current = null;
      activeField = null;
    }
  }

  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.startsWith('#')) {
      continue;
    }

    const msgid = line.match(/^msgid\s+("(?:[^"\\]|\\.)*")$/);
    if (msgid) {
      flush();
      current = {msgid: parsePoString(msgid[1]), msgstr: ''};
      activeField = 'msgid';
      continue;
    }

    const msgstr = line.match(/^msgstr\s+("(?:[^"\\]|\\.)*")$/);
    if (msgstr) {
      if (!current) {
        throw new Error('Found msgstr before msgid.');
      }
      current.msgstr = parsePoString(msgstr[1]);
      activeField = 'msgstr';
      continue;
    }

    const continued = line.match(/^("(?:[^"\\]|\\.)*")$/);
    if (continued && current && activeField) {
      current[activeField] += parsePoString(continued[1]);
      continue;
    }

    if (/^(msgctxt|msgid_plural|msgstr\[)/.test(line)) {
      throw new Error(`Unsupported PO syntax: ${line}`);
    }
  }
  flush();

  const result: Record<string, string> = {};
  for (const entry of entries) {
    if (entry.msgid) {
      result[entry.msgid] = entry.msgstr;
    }
  }
  return result;
}

async function convertPo(src: string) {
  const json = parsePo(await fsp.readFile(src, 'utf8'));
  const result: Record<string, LocaleMessage> = {};
  for (const key of Object.keys(json)) {
    let message = json[key];
    const refs: string[] = [];
    let matchCount = 0;
    message = message.replace(/\$(\d+:)?(\w+)\$/g, (_match: string, order: string | undefined, ref: string) => {
      matchCount++;
      refs[order ? parseInt(order, 10) : matchCount] = ref;
      return '$' + ref + '$';
    });
    let placeholders: LocaleMessage['placeholders'];
    if (matchCount) {
      placeholders = {};
      for (let i = 0; i < refs.length; i++) {
        const placeholder = refs[i] || '_unused_' + i;
        placeholders[placeholder] = {content: '$' + i};
      }
    }
    if (message === ' ') {
      message = '';
    }
    result[key] = {message, placeholders};
  }
  return result;
}

async function writeLocale(dest: string, src: string) {
  await ensureDir(dest);
  await fsp.writeFile(dest, JSON.stringify(await convertPo(src)));
}

async function writeReleaseManifest(dest: string, target: 'chrome' | 'firefox') {
  const manifestPath = path.join(root, 'overlay/manifest.json');
  const manifest = JSON.parse(await fsp.readFile(manifestPath, 'utf8')) as ReleaseManifest;
  manifest.permissions = manifest.permissions.filter((permission: string) => permission !== 'downloads');
  delete manifest.optional_permissions;
  if (target === 'chrome') {
    delete manifest.background.scripts;
    delete manifest.background.preferred_environment;
  }
  if (target === 'firefox') {
    delete manifest.key;
    delete manifest.minimum_chrome_version;
    manifest.permissions = Array.from(new Set([
      ...manifest.permissions,
      'contextualIdentities'
    ]));
  }
  await ensureDir(dest);
  await fsp.writeFile(dest, JSON.stringify(manifest));
}

async function listFiles(dir: string, filter: PathFilter = () => true) {
  const files: string[] = [];
  async function visit(current: string) {
    const entries = await fsp.readdir(current, {withFileTypes: true});
    for (const entry of entries) {
      const filePath = path.join(current, entry.name);
      if (!filter(filePath)) {
        continue;
      }
      if (entry.isDirectory()) {
        await visit(filePath);
      } else if (entry.isFile()) {
        files.push(filePath);
      }
    }
  }
  await visit(dir);
  return files;
}

async function zipRelease(archivePath: string, manifestPath: string) {
  await ensureDir(archivePath);
  await fsp.rm(archivePath, {force: true});
  const output = fs.createWriteStream(archivePath);
  const archive = new ZipArchive();
  const finished = new Promise((resolve, reject) => {
    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);
  });
  archive.pipe(output);

  const buildDir = path.join(root, 'build');
  const files = await listFiles(buildDir, (filePath) => {
    const rel = path.relative(buildDir, filePath).replace(/\\/g, '/');
    return rel !== 'manifest.json' &&
      !/^lib\/bootstrap\/fonts\/[^/]+\.(eot|svg|ttf)$/.test(rel);
  });
  for (const file of files) {
    archive.file(file, {name: path.relative(buildDir, file).replace(/\\/g, '/')});
  }
  archive.file(manifestPath, {name: 'manifest.json'});
  archive.finalize();
  await finished;
}

async function main() {
  await fsp.rm(path.join(root, 'build'), {recursive: true, force: true});
  await fsp.rm(path.join(root, 'tmp'), {recursive: true, force: true});

  const browserEntrypoints = await readBrowserEntrypoints();

  const indexSource = path.join(root, 'src/module/index.ts');
  await writeBundle(path.join(root, 'index.js'), {
    entry: indexSource,
    globalName: 'OmegaTargetChromium'
  });
  await writeBundle(path.join(root, 'omega_target_chromium_extension.min.js'), {
    entry: indexSource,
    globalName: 'OmegaTargetChromium',
    minify: true
  });
  const fontFilter = (base: string): PathFilter => (filePath: string) => {
    const rel = path.relative(base, filePath).replace(/\\/g, '/');
    return !/^lib\/bootstrap\/fonts\/[^/]+\.(eot|svg|ttf)$/.test(rel);
  };
  const webBuildRoot = path.join(workspaceRoot, 'packages/web-ui/build');
  await copyTree(webBuildRoot, path.join(root, 'build'), fontFilter(webBuildRoot));
  await copyFile(path.join(workspaceRoot, 'packages/extension-runtime/omega_target.min.js'), path.join(root, 'build/js/omega_target.min.js'));
  await copyFile(path.join(root, 'omega_target_chromium_extension.min.js'), path.join(root, 'build/js/omega_target_chromium_extension.min.js'));
  await copyFile(path.join(root, 'build-ts/js/omega_target_popup.js'), path.join(root, 'build/js/omega_target_popup.js'));
  await copyFile(path.join(root, 'build-ts/js/runtime_preload.js'), path.join(root, 'build/js/runtime_preload.js'));
  for (const script of ['background.js', 'background_preload.js']) {
    await copyFile(path.join(root, 'build-ts/js', script), path.join(root, 'build/js', script));
  }
  await writeServiceWorker(path.join(root, 'build/service_worker.js'), browserEntrypoints.background.serviceWorkerScripts);
  await copyTree(path.join(root, 'overlay'), path.join(root, 'build'));
  await writeBackgroundHtml(path.join(root, 'build/background.html'), backgroundDocumentScripts(browserEntrypoints));
  await copyFile(path.join(workspaceRoot, 'COPYING'), path.join(root, 'build/COPYING'));
  await copyFile(path.join(workspaceRoot, 'AUTHORS'), path.join(root, 'build/AUTHORS'));

  const localeRoot = path.join(workspaceRoot, 'resources/locales');
  await writeLocale(path.join(root, 'build/_locales/en/messages.json'), path.join(localeRoot, 'en_US/LC_MESSAGES/web-ui-messages.po'));
  await writeLocale(path.join(root, 'build/_locales/zh/messages.json'), path.join(localeRoot, 'zh_Hans/LC_MESSAGES/web-ui-messages.po'));
  await writeLocale(path.join(root, 'build/_locales/cs/messages.json'), path.join(localeRoot, 'cs/LC_MESSAGES/web-ui-messages.po'));
  await writeLocale(path.join(root, 'build/_locales/es/messages.json'), path.join(localeRoot, 'es/LC_MESSAGES/web-ui-messages.po'));
  await writeLocale(path.join(root, 'build/_locales/fa/messages.json'), path.join(localeRoot, 'fa/LC_MESSAGES/web-ui-messages.po'));
  await writeLocale(path.join(root, 'build/_locales/ru/messages.json'), path.join(localeRoot, 'ru/LC_MESSAGES/web-ui-messages.po'));
  await writeLocale(path.join(root, 'build/_locales/zh_CN/messages.json'), path.join(localeRoot, 'zh_Hans/LC_MESSAGES/web-ui-messages.po'));
  await writeLocale(path.join(root, 'build/_locales/zh_TW/messages.json'), path.join(localeRoot, 'zh_Hant/LC_MESSAGES/web-ui-messages.po'));

  if (isRelease) {
    const releaseDir = path.join(root, 'release');
    const chromeManifest = path.join(root, 'tmp/manifest-chrome.json');
    const firefoxManifest = path.join(root, 'tmp/manifest-firefox.json');
    await writeReleaseManifest(chromeManifest, 'chrome');
    await writeReleaseManifest(firefoxManifest, 'firefox');
    await zipRelease(path.join(releaseDir, 'chromium-release.zip'), chromeManifest);
    await zipRelease(path.join(releaseDir, 'firefox-unsigned.xpi'), firefoxManifest);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
