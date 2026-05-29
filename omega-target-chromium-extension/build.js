const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const browserify = require('browserify');
const archiver = require('archiver');
const po2json = require('po2json');

const root = __dirname;
const isRelease = process.argv.includes('release');

async function ensureDir(filePath) {
  await fsp.mkdir(path.dirname(filePath), {recursive: true});
}

async function copyFile(src, dest) {
  await ensureDir(dest);
  await fsp.copyFile(src, dest);
}

async function copyTree(src, dest, filter = () => true) {
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

function bundle(options) {
  return new Promise((resolve, reject) => {
    const b = browserify(options.browserifyOptions || {});
    for (const entry of options.entries || []) {
      b.add(entry);
    }
    for (const excluded of options.exclude || []) {
      b.exclude(excluded);
    }
    for (const item of options.require || []) {
      b.require(item.file, {expose: item.expose});
    }
    if (isRelease && options.minify) {
      b.plugin('minifyify', {map: false});
    }
    b.bundle((error, output) => {
      if (error) {
        reject(error);
      } else {
        resolve(output);
      }
    });
  });
}

async function writeBundle(dest, options) {
  const output = await bundle(options);
  await ensureDir(dest);
  await fsp.writeFile(dest, output);
}

function convertPo(src) {
  const json = po2json.parseFileSync(src);
  const result = {};
  for (const key of Object.keys(json)) {
    if (!key) {
      continue;
    }
    let message = json[key][1];
    const refs = [];
    let matchCount = 0;
    message = message.replace(/\$(\d+:)?(\w+)\$/g, (_, order, ref) => {
      matchCount++;
      refs[order ? parseInt(order, 10) : matchCount] = ref;
      return '$' + ref + '$';
    });
    let placeholders;
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

async function writeLocale(dest, src) {
  await ensureDir(dest);
  await fsp.writeFile(dest, JSON.stringify(convertPo(src)));
}

async function writeReleaseManifest() {
  const manifestPath = path.join(root, 'overlay/manifest.json');
  const manifest = JSON.parse(await fsp.readFile(manifestPath, 'utf8'));
  manifest.permissions = manifest.permissions.filter((permission) => permission !== 'downloads');
  const dest = path.join(root, 'tmp/manifest.json');
  await ensureDir(dest);
  await fsp.writeFile(dest, JSON.stringify(manifest));
}

async function listFiles(dir, filter = () => true) {
  const files = [];
  async function visit(current) {
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

async function zipRelease() {
  const archivePath = path.join(root, 'release.zip');
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
  archive.file(path.join(root, 'tmp/manifest.json'), {name: 'manifest.json'});
  archive.finalize();
  await finished;
}

async function main() {
  await fsp.rm(path.join(root, 'build'), {recursive: true, force: true});
  await fsp.rm(path.join(root, 'tmp'), {recursive: true, force: true});

  const indexSource = path.join(root, 'index.source.js');
  await writeBundle(path.join(root, 'index.js'), {
    entries: [indexSource],
    exclude: ['bluebird', 'omega-pac', 'omega-target'],
    browserifyOptions: {
      builtins: [],
      standalone: 'OmegaTargetChromium',
      debug: true
    }
  });
  await writeBundle(path.join(root, 'omega_target_chromium_extension.min.js'), {
    entries: [indexSource],
    require: [{file: indexSource, expose: 'OmegaTargetChromium'}],
    browserifyOptions: {
      standalone: 'OmegaTargetChromium'
    },
    minify: true
  });
  await writeBundle(path.join(root, 'build/js/omega_webext_proxy_script.min.js'), {
    entries: [path.join(root, 'src/js/omega_webext_proxy_script.js')],
    require: [{
      file: path.resolve(root, '../omega-pac/omega_pac.min.js'),
      expose: 'omega-pac'
    }],
    browserifyOptions: {
      noParse: [path.resolve(root, '../omega-pac/omega_pac.min.js')]
    },
    minify: true
  });

  const fontFilter = (base) => (filePath) => {
    const rel = path.relative(base, filePath).replace(/\\/g, '/');
    return !/^lib\/bootstrap\/fonts\/[^/]+\.(eot|svg|ttf)$/.test(rel);
  };
  await copyTree(path.resolve(root, '../omega-web/build'), path.join(root, 'build'), fontFilter(path.resolve(root, '../omega-web/build')));
  await copyFile(path.resolve(root, '../omega-target/omega_target.min.js'), path.join(root, 'build/js/omega_target.min.js'));
  await copyFile(path.join(root, 'omega_target_chromium_extension.min.js'), path.join(root, 'build/js/omega_target_chromium_extension.min.js'));
  await copyFile(path.join(root, 'src/js/omega_target_popup.js'), path.join(root, 'build/js/omega_target_popup.js'));
  await copyFile(path.join(root, 'src/js/mv3_compat.js'), path.join(root, 'build/js/mv3_compat.js'));
  for (const script of ['background.js', 'background_preload.js', 'omega_debug.js', 'omega_target_web.js']) {
    await copyFile(path.join(root, 'src/js', script), path.join(root, 'build/js', script));
  }
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
    await writeReleaseManifest();
    await zipRelease();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
