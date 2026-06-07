const fs = require('fs/promises');
const path = require('path');
const less = require('less');
const esbuild = require('esbuild');
const postcss = require('postcss');
const autoprefixer = require('autoprefixer-core');
const root = path.resolve(__dirname, '..');
const workspaceRoot = path.join(root, '..');

type LessRenderOutput = string | {
  css: string;
};

async function ensureDir(filePath) {
  await fs.mkdir(path.dirname(filePath), {recursive: true});
}

async function copyFile(src, dest) {
  await ensureDir(dest);
  await fs.copyFile(resolveSource(src), path.join(root, dest));
}

async function copyTree(src, dest) {
  await fs.cp(resolveSource(src), path.join(root, dest), {
    recursive: true
  });
}

function resolveSource(src) {
  if (src.startsWith('node_modules/')) {
    return path.join(workspaceRoot, src);
  }
  return path.join(root, src);
}

async function writeReactHtml(dest, title, script, extraScripts = []) {
  const html = [
    '<!doctype html>',
    '<html>',
    '<head>',
    '  <meta charset="utf-8">',
    '  <link rel="stylesheet" href="../lib/bootstrap/css/bootstrap.min.css">',
    '  <link rel="stylesheet" href="../css/options.css">',
    '  <link rel="stylesheet" href="react_options.css">',
    `  <title>${title}</title>`,
    '</head>',
    '<body>',
    '  <div id="react-root"></div>',
    ...extraScripts.map((src) => `  <script src="${src}"></script>`),
    `  <script src="${script}"></script>`,
    '</body>',
    '</html>',
    ''
  ].join('\n');
  await ensureDir(path.join(root, dest));
  await fs.writeFile(path.join(root, dest), html);
}

async function writeRootReactHtml(dest, title, script, extraScripts = []) {
  const html = [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="utf-8">',
    `  <title>${title}</title>`,
    '  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">',
    '  <link rel="stylesheet" href="lib/bootstrap/css/bootstrap.min.css">',
    '  <link rel="stylesheet" href="css/options.css">',
    '  <link rel="stylesheet" href="react/react_options.css">',
    '</head>',
    '<body>',
    '  <div id="react-root"></div>',
    ...extraScripts.map((src) => `  <script src="${src}"></script>`),
    `  <script src="${script}"></script>`,
    '</body>',
    '</html>',
    ''
  ].join('\n');
  await ensureDir(path.join(root, dest));
  await fs.writeFile(path.join(root, dest), html);
}

async function bundleReact(entry, dest) {
  await ensureDir(path.join(root, dest));
  await esbuild.build({
    bundle: true,
    entryPoints: [path.join(root, entry)],
    format: 'iife',
    minify: true,
    outfile: path.join(root, dest),
    platform: 'browser',
    target: 'es2020'
  });
}

async function renderLess(src, tmpDest, buildDest) {
  const input = await fs.readFile(path.join(root, src), 'utf8');
  const rendered = await new Promise<LessRenderOutput>((resolve, reject) => {
    less.render(input, {filename: path.join(root, src)}, (error, output) => {
      if (error) {
        reject(error);
      } else {
        resolve(output);
      }
    });
  });
  const css = typeof rendered === 'string' ? rendered : rendered.css;
  const prefixed = postcss([autoprefixer({cascade: true})]).process(css, {
    map: false,
    from: path.join(root, tmpDest),
    to: path.join(root, buildDest)
  });
  await ensureDir(path.join(root, tmpDest));
  await fs.writeFile(path.join(root, tmpDest), css);
  await ensureDir(path.join(root, buildDest));
  await fs.writeFile(path.join(root, buildDest), prefixed.css);
}

async function clean() {
  await fs.rm(path.join(root, 'build'), {recursive: true, force: true});
  await fs.rm(path.join(root, 'tmp'), {recursive: true, force: true});
}

async function main() {
  await clean();

  const staticCopies = [
    ['../omega-pac/omega_pac.min.js', 'build/js/omega_pac.min.js'],
    ['build-ts/js/log_error.js', 'build/js/log_error.js'],
    ['build-ts/js/omega_pac_preload.js', 'build/js/omega_pac_preload.js'],
    ['node_modules/bootstrap/dist/css/bootstrap.min.css', 'build/lib/bootstrap/css/bootstrap.min.css'],
    ['node_modules/bootstrap/fonts/glyphicons-halflings-regular.woff', 'build/lib/bootstrap/fonts/glyphicons-halflings-regular.woff'],
    ['node_modules/bootstrap/fonts/glyphicons-halflings-regular.woff2', 'build/lib/bootstrap/fonts/glyphicons-halflings-regular.woff2'],
    ['node_modules/file-saver/dist/FileSaver.min.js', 'build/lib/FileSaver/FileSaver.min.js'],
    ['node_modules/jquery/dist/jquery.min.js', 'build/lib/jquery/jquery.min.js'],
    ['node_modules/jquery-ui-dist/jquery-ui.min.js', 'build/lib/jquery-ui-1.13.3.min.js'],
    ['node_modules/jquery-ui-touch-punch/jquery.ui.touch-punch.min.js', 'build/lib/jqueryui-touch-punch/jquery.ui.touch-punch.min.js'],
    ['img', 'build/img'],
    ['src/popup', 'build/popup'],
    ['src/react/react_options.css', 'build/react/react_options.css']
  ];

  for (const [src, dest] of staticCopies) {
    if (src.endsWith('/')) {
      await copyTree(src, dest);
    } else if (src === 'img' || src === 'src/popup') {
      await copyTree(src, dest);
    } else {
      await copyFile(src, dest);
    }
  }
  await copyFile('build-ts/js/draw_omega.js', 'build/img/icons/draw_omega.js');

  await writeRootReactHtml('build/options.html', 'SwitchyAgain Options', 'react/options_app.js', [
    'js/omega_debug.js',
    'js/log_error.js',
    'lib/jquery/jquery.min.js',
    'lib/jquery-ui-1.13.3.min.js',
    'lib/jqueryui-touch-punch/jquery.ui.touch-punch.min.js',
    'js/omega_pac_preload.js',
    'js/omega_pac.min.js'
  ]);
  await bundleReact('src/react/options_entry.tsx', 'build/react/options_app.js');
  await writeReactHtml('build/react/general.html', 'SwitchyAgain General', 'general.js');
  await bundleReact('src/react/general_settings.tsx', 'build/react/general.js');
  await writeReactHtml('build/react/ui.html', 'SwitchyAgain Interface', 'ui.js');
  await bundleReact('src/react/ui_settings.tsx', 'build/react/ui.js');
  await writeReactHtml('build/react/about.html', 'SwitchyAgain About', 'about.js');
  await bundleReact('src/react/about.tsx', 'build/react/about.js');
  await bundleReact('src/react/popup_app.tsx', 'build/react/popup_app.js');
  await bundleReact('src/react/proxy_not_controllable.tsx', 'build/react/proxy_not_controllable.js');
  await writeReactHtml('build/react/import_export.html', 'SwitchyAgain Import / Export', 'import_export.js');
  await bundleReact('src/react/import_export.tsx', 'build/react/import_export.js');

  await renderLess('src/less/options.less', 'tmp/css/options.css', 'build/css/options.css');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
