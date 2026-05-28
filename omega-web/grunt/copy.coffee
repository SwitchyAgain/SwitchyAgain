module.exports =
  pac:
    files:
      'build/js/omega_pac.min.js': '../omega-pac/omega_pac.min.js'
  angular:
    expand: true
    cwd: 'node_modules/angular'
    src: ['angular.min.js']
    dest: 'build/lib/angular/'
  angular_animate:
    expand: true
    cwd: 'node_modules/angular-animate'
    src: ['angular-animate.min.js']
    dest: 'build/lib/angular-animate/'
  angular_bootstrap:
    expand: true
    cwd: 'node_modules/angular-ui-bootstrap'
    src: ['ui-bootstrap-tpls.min.js']
    dest: 'build/lib/angular-bootstrap/'
  angular_i18n:
    expand: true
    cwd: 'node_modules/angular-i18n'
    src: [
      'angular-locale_en-us.js'
      'angular-locale_zh-cn.js'
      'angular-locale_zh-hk.js'
      'angular-locale_zh-tw.js'
    ]
    dest: 'build/lib/angular-i18n/'
  angular_ladda:
    expand: true
    cwd: 'node_modules/angular-ladda/dist'
    src: ['angular-ladda.min.js']
    dest: 'build/lib/angular-ladda/'
  angular_loader:
    expand: true
    cwd: 'node_modules/angular-loader'
    src: ['angular-loader.min.js']
    dest: 'build/lib/angular-loader/'
  angular_sanitize:
    expand: true
    cwd: 'node_modules/angular-sanitize'
    src: ['angular-sanitize.min.js']
    dest: 'build/lib/angular-sanitize/'
  angular_spectrum_colorpicker:
    expand: true
    cwd: 'node_modules/angular-spectrum-colorpicker/dist'
    src: ['angular-spectrum-colorpicker.min.js']
    dest: 'build/lib/angular-spectrum-colorpicker/'
  angular_ui_router:
    expand: true
    cwd: 'node_modules/angular-ui-router/release'
    src: ['angular-ui-router.min.js']
    dest: 'build/lib/angular-ui-router/'
  angular_ui_sortable:
    expand: true
    cwd: 'node_modules/angular-ui-sortable/dist'
    src: ['sortable.min.js']
    dest: 'build/lib/angular-ui-sortable/'
  angular_ui_utils:
    files: [
      src: 'node_modules/angular-ui-utils/modules/validate/validate.js'
      dest: 'build/lib/angular-ui-utils/validate.min.js'
    ]
  blob:
    expand: true
    cwd: 'node_modules/blob-polyfill'
    src: ['Blob.js']
    dest: 'build/lib/blob/'
  bootstrap_css:
    expand: true
    cwd: 'node_modules/bootstrap/dist/css'
    src: ['bootstrap.min.css']
    dest: 'build/lib/bootstrap/css/'
  bootstrap_js:
    expand: true
    cwd: 'node_modules/bootstrap/js'
    src: ['dropdown.js']
    dest: 'build/lib/bootstrap/js/'
  bootstrap_fonts:
    expand: true
    cwd: 'node_modules/bootstrap/fonts'
    src: [
      'glyphicons-halflings-regular.woff'
      'glyphicons-halflings-regular.woff2'
    ]
    dest: 'build/lib/bootstrap/fonts/'
  filesaver:
    expand: true
    cwd: 'node_modules/file-saver/dist'
    src: ['FileSaver.min.js']
    dest: 'build/lib/FileSaver/'
  jquery:
    expand: true
    cwd: 'node_modules/jquery/dist'
    src: ['jquery.min.js']
    dest: 'build/lib/jquery/'
  jquery_ui:
    files: [
      src: 'node_modules/jquery-ui-dist/jquery-ui.min.js'
      dest: 'build/lib/jquery-ui-1.13.3.min.js'
    ]
  jqueryui_touch_punch:
    expand: true
    cwd: 'node_modules/jquery-ui-touch-punch'
    src: ['jquery.ui.touch-punch.min.js']
    dest: 'build/lib/jqueryui-touch-punch/'
  jsondiffpatch:
    expand: true
    cwd: 'node_modules/jsondiffpatch/public/build'
    src: ['jsondiffpatch.min.js']
    dest: 'build/lib/jsondiffpatch/'
  ladda:
    expand: true
    cwd: 'node_modules/ladda/dist'
    src: ['ladda-themeless.min.css', 'ladda.min.js']
    dest: 'build/lib/ladda/'
  ngprogress:
    files: [
      src: 'node_modules/ngprogress/build/ngprogress.min.js'
      dest: 'build/lib/ngprogress/ngProgress.min.js'
    ]
  scriptjs:
    expand: true
    cwd: 'node_modules/scriptjs/dist'
    src: ['script.min.js']
    dest: 'build/lib/script.js/'
  shepherd_js:
    files: [
      src: 'node_modules/shepherd.js/dist/cjs/shepherd.cjs'
      dest: 'build/lib/shepherd.js/shepherd.min.js'
    ,
      src: 'node_modules/shepherd.js/dist/css/shepherd.css'
      dest: 'build/lib/shepherd.js/shepherd-theme-arrows.css'
    ]
  spectrum:
    expand: true
    cwd: 'node_modules/spectrum-colorpicker'
    src: ['spectrum.css', 'spectrum.js']
    dest: 'build/lib/spectrum/'
  spin_js:
    expand: true
    cwd: 'node_modules/spin.js'
    src: ['spin.js']
    dest: 'build/lib/spin.js/'
  img:
    expand: true
    cwd: 'img'
    src: ['**/*']
    dest: 'build/img/'
  popup:
    expand: true
    cwd: 'src/popup'
    src: ['**/*']
    dest: 'build/popup/'
