import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entrypointsPath = 'apps/browser-extension/browser-entrypoints.json';
const check = process.argv.includes('--check');

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
}

function backgroundDocumentScripts(entrypoints) {
  return entrypoints.background.serviceWorkerScripts;
}

function renderServiceWorker(scripts) {
  return [
    `// Generated from ${entrypointsPath}. Do not edit directly.`,
    `importScripts(${scripts.map((script) => `'${script}'`).join(', ')});`,
    ''
  ].join('\n');
}

function renderBackgroundHtml(scripts) {
  return [
    '<!DOCTYPE html>',
    `<!-- Generated from ${entrypointsPath}. Do not edit directly. -->`,
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
  ].join('\n');
}

async function writeOrCheck(relativePath, content) {
  const filePath = path.join(root, relativePath);
  if (check) {
    const current = await readFile(filePath, 'utf8');
    if (current !== content) {
      throw new Error(`${relativePath} is out of date. Run npm run generate:entrypoints.`);
    }
    return;
  }
  await writeFile(filePath, content);
}

const entrypoints = await readJson(entrypointsPath);

await writeOrCheck('apps/browser-extension/src/js/service_worker.ts', renderServiceWorker(entrypoints.background.serviceWorkerScripts));
await writeOrCheck('apps/browser-extension/overlay/background.html', renderBackgroundHtml(backgroundDocumentScripts(entrypoints)));

console.log(check ? 'ok generated browser entrypoints' : 'generated browser entrypoints');
