import { copyFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dryRun = process.argv.includes('--dry-run');

const manifestPath = path.join(root, 'omega-target-chromium-extension', 'overlay', 'manifest.json');
const releaseDir = path.join(root, 'omega-target-chromium-extension', 'release');
const distDir = path.join(root, 'dist');

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const version = manifest.version;

if (typeof version !== 'string' || version.length === 0) {
  throw new Error(`Could not read version from ${manifestPath}`);
}

const packages = [
  ['chromium-release.zip', `switchyagain-v${version}-chromium-release.zip`],
  ['firefox-unsigned.xpi', `switchyagain-v${version}-firefox-unsigned.xpi`],
];

if (!dryRun) {
  await mkdir(distDir, { recursive: true });
}

for (const [sourceName, targetName] of packages) {
  const source = path.join(releaseDir, sourceName);
  const target = path.join(distDir, targetName);

  if (dryRun) {
    console.log(`${source} -> ${target}`);
    continue;
  }

  await copyFile(source, target);
  console.log(`Copied ${targetName}`);
}
