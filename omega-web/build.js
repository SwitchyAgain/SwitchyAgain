const fs = require('fs/promises');
const path = require('path');
const jade = require('jade');
const less = require('less');
const esbuild = require('esbuild');
const postcss = require('postcss');
const autoprefixer = require('autoprefixer-core');
const root = __dirname;
const workspaceRoot = path.join(root, '..');

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

async function renderJade(src, dest) {
  const html = jade.renderFile(path.join(root, src), {pretty: true});
  await ensureDir(path.join(root, dest));
  await fs.writeFile(path.join(root, dest), html);
}

async function writeReactHtml(dest, title, script) {
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
  const rendered = await new Promise((resolve, reject) => {
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

async function concat(files, dest) {
  const content = [];
  for (const file of files) {
    content.push(await fs.readFile(path.join(root, file), 'utf8'));
  }
  await ensureDir(path.join(root, dest));
  await fs.writeFile(path.join(root, dest), content.join('\n'));
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
    ['build-ts/js/omega_decoration.js', 'build/js/omega_decoration.js'],
    ['build-ts/js/options.js', 'build/js/options.js'],
    ['build-ts/js/options_guide.js', 'build/js/options_guide.js'],
    ['src/js/popup.js', 'build/js/popup.js'],
    ['build-ts/js/switch_profile_guide.js', 'build/js/switch_profile_guide.js'],
    ['node_modules/angular/angular.min.js', 'build/lib/angular/angular.min.js'],
    ['node_modules/angular-animate/angular-animate.min.js', 'build/lib/angular-animate/angular-animate.min.js'],
    ['node_modules/angular-ui-bootstrap/ui-bootstrap-tpls.min.js', 'build/lib/angular-bootstrap/ui-bootstrap-tpls.min.js'],
    ['node_modules/angular-i18n/angular-locale_en-us.js', 'build/lib/angular-i18n/angular-locale_en-us.js'],
    ['node_modules/angular-i18n/angular-locale_zh-cn.js', 'build/lib/angular-i18n/angular-locale_zh-cn.js'],
    ['node_modules/angular-i18n/angular-locale_zh-hk.js', 'build/lib/angular-i18n/angular-locale_zh-hk.js'],
    ['node_modules/angular-i18n/angular-locale_zh-tw.js', 'build/lib/angular-i18n/angular-locale_zh-tw.js'],
    ['node_modules/angular-ladda/dist/angular-ladda.min.js', 'build/lib/angular-ladda/angular-ladda.min.js'],
    ['node_modules/angular-loader/angular-loader.min.js', 'build/lib/angular-loader/angular-loader.min.js'],
    ['node_modules/angular-sanitize/angular-sanitize.min.js', 'build/lib/angular-sanitize/angular-sanitize.min.js'],
    ['node_modules/angular-spectrum-colorpicker/dist/angular-spectrum-colorpicker.min.js', 'build/lib/angular-spectrum-colorpicker/angular-spectrum-colorpicker.min.js'],
    ['node_modules/angular-ui-router/release/angular-ui-router.min.js', 'build/lib/angular-ui-router/angular-ui-router.min.js'],
    ['node_modules/angular-ui-sortable/dist/sortable.min.js', 'build/lib/angular-ui-sortable/sortable.min.js'],
    ['node_modules/angular-ui-utils/modules/validate/validate.js', 'build/lib/angular-ui-utils/validate.min.js'],
    ['node_modules/blob-polyfill/Blob.js', 'build/lib/blob/Blob.js'],
    ['node_modules/bootstrap/dist/css/bootstrap.min.css', 'build/lib/bootstrap/css/bootstrap.min.css'],
    ['node_modules/bootstrap/js/dropdown.js', 'build/lib/bootstrap/js/dropdown.js'],
    ['node_modules/bootstrap/fonts/glyphicons-halflings-regular.woff', 'build/lib/bootstrap/fonts/glyphicons-halflings-regular.woff'],
    ['node_modules/bootstrap/fonts/glyphicons-halflings-regular.woff2', 'build/lib/bootstrap/fonts/glyphicons-halflings-regular.woff2'],
    ['node_modules/file-saver/dist/FileSaver.min.js', 'build/lib/FileSaver/FileSaver.min.js'],
    ['node_modules/jquery/dist/jquery.min.js', 'build/lib/jquery/jquery.min.js'],
    ['node_modules/jquery-ui-dist/jquery-ui.min.js', 'build/lib/jquery-ui-1.13.3.min.js'],
    ['node_modules/jquery-ui-touch-punch/jquery.ui.touch-punch.min.js', 'build/lib/jqueryui-touch-punch/jquery.ui.touch-punch.min.js'],
    ['node_modules/jsondiffpatch/public/build/jsondiffpatch.min.js', 'build/lib/jsondiffpatch/jsondiffpatch.min.js'],
    ['node_modules/ladda/dist/ladda-themeless.min.css', 'build/lib/ladda/ladda-themeless.min.css'],
    ['node_modules/ladda/dist/ladda.min.js', 'build/lib/ladda/ladda.min.js'],
    ['node_modules/ngprogress/build/ngprogress.min.js', 'build/lib/ngprogress/ngProgress.min.js'],
    ['node_modules/scriptjs/dist/script.min.js', 'build/lib/script.js/script.min.js'],
    ['node_modules/shepherd.js/dist/cjs/shepherd.cjs', 'build/lib/shepherd.js/shepherd.min.js'],
    ['node_modules/shepherd.js/dist/css/shepherd.css', 'build/lib/shepherd.js/shepherd-theme-arrows.css'],
    ['node_modules/spectrum-colorpicker/spectrum.css', 'build/lib/spectrum/spectrum.css'],
    ['node_modules/spectrum-colorpicker/spectrum.js', 'build/lib/spectrum/spectrum.js'],
    ['node_modules/spin.js/spin.js', 'build/lib/spin.js/spin.js'],
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

  await renderJade('src/options.jade', 'build/options.html');
  await renderJade('src/popup.jade', 'build/popup.html');
  await writeReactHtml('build/react/options_experiment.html', 'SwitchyAgain', 'options_experiment.js');
  await bundleReact('src/react/options_experiment.tsx', 'build/react/options_experiment.js');
  await writeReactHtml('build/react/general.html', 'SwitchyAgain General', 'general.js');
  await bundleReact('src/react/general_settings.tsx', 'build/react/general.js');

  const partials = [
    'about',
    'apply_options_confirm',
    'cannot_delete_profile',
    'delete_attached',
    'delete_profile',
    'fixed_auth_edit',
    'general',
    'input_group_clear',
    'io',
    'new_profile',
    'omega_profile_select',
    'options_welcome',
    'profile',
    'profile_fixed',
    'profile_pac',
    'profile_rule_list',
    'profile_switch',
    'profile_unsupported',
    'profile_virtual',
    'rename_profile',
    'replace_profile',
    'reset_options_confirm',
    'rule_remove_confirm',
    'rule_reset_confirm',
    'ui'
  ];
  for (const name of partials) {
    await renderJade(`src/partials/${name}.jade`, `build/partials/${name}.html`);
  }

  await renderLess('src/less/options.less', 'tmp/css/options.css', 'build/css/options.css');
  await renderLess('src/less/popup.less', 'tmp/css/popup.css', 'build/css/popup.css');

  await concat([
    'build-ts/omega/app.js',
    'build-ts/omega/filters.js',
    'build-ts/omega/directives.js',
    'build-ts/omega/controllers/about.js',
    'build-ts/omega/controllers/fixed_profile.js',
    'build-ts/omega/controllers/io.js',
    'build-ts/omega/controllers/master.js',
    'build-ts/omega/controllers/pac_profile.js',
    'build-ts/omega/controllers/profile.js',
    'build-ts/omega/controllers/quick_switch.js',
    'build-ts/omega/controllers/rule_list_profile.js',
    'build-ts/omega/controllers/switch_profile.js'
  ], 'build/js/omega.js');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
