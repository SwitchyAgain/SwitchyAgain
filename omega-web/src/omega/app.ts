(function() {
  var attachedPrefix, charCodeUnderscore, colors, profileColorPalette, profileColors;

  angular.module('omega').constant('builtinProfiles', OmegaPac.Profiles.builtinProfiles);

  profileColors = ['#9ce', '#9d9', '#fa8', '#fe9', '#d497ee', '#47b', '#5b5', '#d63', '#ca0'];

  colors = [].concat(profileColors);

  profileColorPalette = ((function() {
    var results;
    results = [];
    while (colors.length) {
      results.push(colors.splice(0, 3));
    }
    return results;
  })());

  angular.module('omega').constant('profileColors', profileColors);

  angular.module('omega').constant('profileColorPalette', profileColorPalette);

  attachedPrefix = '__ruleListOf_';

  angular.module('omega').constant('getAttachedName', function(name) {
    return attachedPrefix + name;
  });

  angular.module('omega').constant('getParentName', function(name) {
    if (name.indexOf(attachedPrefix) === 0) {
      return name.substr(attachedPrefix.length);
    } else {
      return void 0;
    }
  });

  charCodeUnderscore = '_'.charCodeAt(0);

  angular.module('omega').constant('charCodeUnderscore', charCodeUnderscore);

  angular.module('omega').constant('reactModalTemplates', {
    applyOptionsConfirm: '<div omega-react-confirm-modal modal-kind="apply"></div>',
    cannotDeleteProfile: '<div omega-react-confirm-modal modal-kind="cannotDeleteProfile"></div>',
    deleteAttached: '<div omega-react-confirm-modal modal-kind="deleteAttached"></div>',
    deleteProfile: '<div omega-react-confirm-modal modal-kind="deleteProfile"></div>',
    newProfile: '<div omega-react-new-profile></div>',
    optionsWelcome: '<div omega-react-options-welcome></div>',
    proxyAuth: '<div omega-react-proxy-auth></div>',
    renameProfile: '<div omega-react-rename-profile></div>',
    replaceProfile: '<div omega-react-confirm-modal modal-kind="replaceProfile"></div>',
    resetOptionsConfirm: '<div omega-react-confirm-modal modal-kind="reset"></div>',
    ruleRemoveConfirm: '<div omega-react-confirm-modal modal-kind="ruleRemove"></div>',
    ruleResetConfirm: '<div omega-react-confirm-modal modal-kind="ruleReset"></div>'
  });

  angular.module('omega').constant('isProfileNameHidden', function(name) {
    return name.charCodeAt(0) === charCodeUnderscore;
  });

  angular.module('omega').constant('isProfileNameReserved', function(name) {
    return name.charCodeAt(0) === charCodeUnderscore && name.charCodeAt(1) === charCodeUnderscore;
  });

  angular.module('omega').config(function($stateProvider, $urlRouterProvider, $httpProvider, $animateProvider, $compileProvider) {
    $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|mailto|chrome-extension|moz-extension):/);
    $compileProvider.imgSrcSanitizationWhitelist(/^\s*(https?|local|data|chrome-extension|moz-extension):/);
    $animateProvider.classNameFilter(/angular-animate/);
    $urlRouterProvider.otherwise('/about');
    $urlRouterProvider.otherwise(function($injector, $location) {
      if ($location.path() === '') {
        return $injector.get('omegaTarget').lastUrl() || '/about';
      } else {
        return '/about';
      }
    });
    return $stateProvider.state('ui', {
      url: '/ui',
      template: '<div class="react-settings-host-ui" omega-react-ui-settings></div>'
    }).state('general', {
      url: '/general',
      template: '<div class="react-settings-host-general" omega-react-general-settings></div>'
    }).state('io', {
      url: '/io',
      template: '<div class="react-settings-host-import-export" omega-react-import-export></div>'
    }).state('profile', {
      url: '/profile/*name',
      template: '<div class="react-profile-shell-host" omega-react-profile-shell></div><div omega-profile-content-host></div>',
      controller: 'ProfileCtrl'
    }).state('about', {
      url: '/about',
      template: '<div omega-react-about></div>'
    });
  });

  angular.module('omega').factory('$exceptionHandler', function($log) {
    return function(exception, cause) {
      if (exception.message === 'transition aborted') {
        return;
      }
      if (exception.message === 'transition superseded') {
        return;
      }
      if (exception.message === 'transition prevented') {
        return;
      }
      if (exception.message === 'transition failed') {
        return;
      }
      return $log.error(exception, cause);
    };
  });

  angular.module('omega').factory('omegaDebug', function($window, $rootScope, $injector) {
    var omegaDebug, ref;
    omegaDebug = (ref = $window.OmegaDebug) != null ? ref : {};
    if (omegaDebug.downloadLog == null) {
      omegaDebug.downloadLog = function() {
        var blob, downloadFile, ref1;
        downloadFile = (ref1 = $injector.get('downloadFile')) != null ? ref1 : saveAs;
        blob = new Blob([localStorage['log']], {
          type: "text/plain;charset=utf-8"
        });
        return downloadFile(blob, "OmegaLog_" + (Date.now()) + ".txt");
      };
    }
    if (omegaDebug.reportIssue == null) {
      omegaDebug.reportIssue = function() {
        $window.open('https://github.com/FelisCatus/SwitchyOmega/issues/new?title=&body=');
      };
    }
    if (omegaDebug.resetOptions == null) {
      omegaDebug.resetOptions = function() {
        return $rootScope.resetOptions();
      };
    }
    return omegaDebug;
  });

  angular.module('omega').factory('downloadFile', function() {
    var ref;
    if ((typeof browser !== "undefined" && browser !== null ? (ref = browser.downloads) != null ? ref.download : void 0 : void 0) != null) {
      return function(blob, filename) {
        var url;
        url = URL.createObjectURL(blob);
        if (filename) {
          return browser.downloads.download({
            url: url,
            filename: filename
          });
        } else {
          return browser.downloads.download({
            url: url
          });
        }
      };
    } else {
      return function(blob, filename) {
        return saveAs(blob, filename, {
          autoBom: false
        });
      };
    }
  });

}).call(this);
