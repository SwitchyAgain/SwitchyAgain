import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import * as archiver from 'archiver';
import * as esbuild from 'esbuild';
import * as po2json from 'po2json/index.js';

const root = path.resolve(__dirname, '..');
const isRelease = process.argv.includes('release');

type PathFilter = (filePath: string) => boolean;

type BundleOptions = {
  entry: string;
  globalName: string;
  minify?: boolean;
};

type LocaleJson = Record<string, [unknown, string]>;

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
  permissions: string[];
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
    target: 'es5'
  });
}

function convertPo(src: string) {
  const json = po2json.parseFileSync(src) as LocaleJson;
  const result: Record<string, LocaleMessage> = {};
  for (const key of Object.keys(json)) {
    if (!key) {
      continue;
    }
    let message = json[key][1];
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
  await fsp.writeFile(dest, JSON.stringify(convertPo(src)));
}

async function writeReleaseManifest(dest: string, target: 'chrome' | 'firefox') {
  const manifestPath = path.join(root, 'overlay/manifest.json');
  const manifest = JSON.parse(await fsp.readFile(manifestPath, 'utf8')) as ReleaseManifest;
  manifest.permissions = manifest.permissions.filter((permission: string) => permission !== 'downloads');
  if (target === 'chrome') {
    delete manifest.background.scripts;
    delete manifest.background.preferred_environment;
  }
  if (target === 'firefox') {
    delete manifest.key;
    delete manifest.minimum_chrome_version;
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
  const archive = archiver.create('zip');
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

  const indexSource = path.join(root, 'build-ts/module/index.js');
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
  await copyTree(path.resolve(root, '../omega-web/build'), path.join(root, 'build'), fontFilter(path.resolve(root, '../omega-web/build')));
  await copyFile(path.resolve(root, '../omega-target/omega_target.min.js'), path.join(root, 'build/js/omega_target.min.js'));
  await copyFile(path.join(root, 'omega_target_chromium_extension.min.js'), path.join(root, 'build/js/omega_target_chromium_extension.min.js'));
  await copyFile(path.join(root, 'build-ts/js/omega_target_popup.js'), path.join(root, 'build/js/omega_target_popup.js'));
  await copyFile(path.join(root, 'build-ts/js/mv3_compat.js'), path.join(root, 'build/js/mv3_compat.js'));
  for (const script of ['background.js', 'background_preload.js', 'omega_debug.js']) {
    await copyFile(path.join(root, 'build-ts/js', script), path.join(root, 'build/js', script));
  }
  await copyFile(path.join(root, 'build-ts/js/service_worker.js'), path.join(root, 'build/service_worker.js'));
  await copyTree(path.join(root, 'overlay'), path.join(root, 'build'));
  await copyFile(path.resolve(root, '../COPYING'), path.join(root, 'build/COPYING'));
  await copyFile(path.resolve(root, '../AUTHORS'), path.join(root, 'build/AUTHORS'));

  const localeRoot = path.resolve(root, '../omega-locales');
  await writeLocale(path.join(root, 'build/_locales/en/messages.json'), path.join(localeRoot, 'en_US/LC_MESSAGES/omega-web.po'));
  await writeLocale(path.join(root, 'build/_locales/zh/messages.json'), path.join(localeRoot, 'zh_CN/LC_MESSAGES/omega-web.po'));
  await writeLocale(path.join(root, 'build/_locales/cs/messages.json'), path.join(localeRoot, 'cs/LC_MESSAGES/omega-web.po'));
  await writeLocale(path.join(root, 'build/_locales/fa/messages.json'), path.join(localeRoot, 'fa/LC_MESSAGES/omega-web.po'));
  await writeLocale(path.join(root, 'build/_locales/zh_CN/messages.json'), path.join(localeRoot, 'zh_CN/LC_MESSAGES/omega-web.po'));
  await writeLocale(path.join(root, 'build/_locales/zh_TW/messages.json'), path.join(localeRoot, 'zh_TW/LC_MESSAGES/omega-web.po'));

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
