namespace OmegaOptionsRuntime {
  var hasProp = {}.hasOwnProperty;

  type OptionsRuntimeDeps = {
    $filter: any;
    $location: any;
    $modal: any;
    $q: any;
    $rootScope: any;
    $state: any;
    $timeout: any;
    $window: any;
    dispNameFilter: any;
    downloadFile: any;
    getAttachedName: (name: string) => string;
    isProfileNameHidden: (name: string) => boolean;
    isProfileNameReserved: (name: string) => boolean;
    omegaTarget: any;
    profileColors: string[];
    profileIcons: any;
    reactModalTemplates: any;
  };

  function hasProxyScriptApi() {
    var proxy, registerKey, registerScriptKey;
    registerKey = 'reg';
    registerKey += 'ister';
    registerScriptKey = registerKey;
    registerScriptKey += 'ProxyScript';
    proxy = typeof browser !== "undefined" && browser !== null ? browser.proxy : void 0;
    return !!(proxy && (proxy[registerKey] || proxy[registerScriptKey]));
  }

  function createDiff() {
    return jsondiffpatch.create({
      objectHash: function(obj) {
        return JSON.stringify(obj);
      },
      textDiff: {
        minLength: 1 / 0
      }
    });
  }

  function createExternalProfile(tr: any) {
    return {
      color: '#49afcd',
      name: tr('popup_externalProfile'),
      profileType: 'FixedProfile',
      fallbackProxy: {
        host: "127.0.0.1",
        port: 42,
        scheme: "http"
      }
    };
  }

  function createProfileSelectTemplate(model: string) {
    return "<div omega-profile-select=\"options | profiles:profile\"\n  ng-model=\"" + model + "\" options=\"options\"\n  disp-name=\"dispNameFilter\" style=\"display: inline-block;\">\n</div>";
  }

  function createPacExport(options: any, profileName: string, profileNotFound: (name: string) => string) {
    var ast, fileName, pac;
    ast = OmegaPac.PacGenerator.script(options, profileName, {
      profileNotFound: profileNotFound
    });
    pac = ast.print_to_string({
      beautify: true,
      comments: true
    });
    pac = OmegaPac.PacGenerator.ascii(pac);
    fileName = profileName.replace(/\W+/g, '_');
    return {
      blob: new Blob([pac], {
        type: "text/plain;charset=utf-8"
      }),
      fileName: "OmegaProfile_" + fileName + ".pac"
    };
  }

  function profileDownloadErrorMessage(err: any, tr: any) {
    var ref, ref1, statusCode;
    statusCode = (ref = err.statusCode) != null ? ref : (ref1 = err.original) != null ? ref1.statusCode : void 0;
    return tr('options_profileDownloadError_' + err.name, [statusCode != null ? statusCode : '']);
  }

  function syncProfileIcons(profileIcons: any) {
    var type;
    for (type in OmegaPac.Profiles.formatByType) {
      if (!hasProp.call(OmegaPac.Profiles.formatByType, type)) continue;
      profileIcons[type] = profileIcons['RuleListProfile'];
    }
  }

  function firstFixedProfileName(options: any) {
    var profileName;
    profileName = null;
    OmegaPac.Profiles.each(options, function(key, profile) {
      if (!profileName && profile.profileType === 'FixedProfile') {
        return profileName = profile.name;
      }
    });
    return profileName;
  }

  export function initialize(scope: any, deps: OptionsRuntimeDeps) {
    var $filter, $location, $modal, $q, $rootScope, $scope, $state, $timeout, $window;
    var diff, downloadFile, getAttachedName, isProfileNameHidden, isProfileNameReserved, omegaTarget;
    var profileColors, profileIcons, reactModalTemplates;
    var checkFormValid, onOptionChange, showFirstRun, showFirstRunOnce, tr;
    var dispNameFilter;
    $scope = scope;
    $rootScope = deps.$rootScope;
    $window = deps.$window;
    $q = deps.$q;
    $modal = deps.$modal;
    $state = deps.$state;
    profileColors = deps.profileColors;
    profileIcons = deps.profileIcons;
    omegaTarget = deps.omegaTarget;
    $timeout = deps.$timeout;
    $location = deps.$location;
    $filter = deps.$filter;
    getAttachedName = deps.getAttachedName;
    isProfileNameReserved = deps.isProfileNameReserved;
    isProfileNameHidden = deps.isProfileNameHidden;
    dispNameFilter = deps.dispNameFilter;
    downloadFile = deps.downloadFile;
    reactModalTemplates = deps.reactModalTemplates;

    if (hasProxyScriptApi()) {
      $scope.isExperimental = true;
      $scope.pacProfilesUnsupported = true;
    }
    tr = $filter('tr');
    $rootScope.options = null;
    omegaTarget.addOptionsChangeCallback(function(newOptions) {
      $rootScope.options = angular.copy(newOptions);
      $rootScope.optionsOld = angular.copy(newOptions);
      return $timeout(function() {
        $rootScope.optionsDirty = false;
        return showFirstRun();
      });
    });
    $rootScope.revertOptions = function() {
      return $window.location.reload();
    };
    $rootScope.exportScript = function(name) {
      var getProfileName;
      getProfileName = name ? $q.when(name) : omegaTarget.state('currentProfileName');
      return getProfileName.then(function(profileName) {
        var exported, missingProfile, profile, profileNotFound, ref;
        if (!profileName) {
          return;
        }
        profile = $rootScope.profileByName(profileName);
        if ((ref = profile.profileType) === 'DirectProfile' || ref === 'SystemProfile') {
          return;
        }
        missingProfile = null;
        profileNotFound = function(name) {
          missingProfile = name;
          return 'dumb';
        };
        exported = createPacExport($rootScope.options, profileName, profileNotFound);
        downloadFile(exported.blob, exported.fileName);
        if (missingProfile) {
          return $timeout(function() {
            return $rootScope.showAlert({
              type: 'error',
              message: tr('options_profileNotFound', [missingProfile])
            });
          });
        }
      });
    };
    diff = createDiff();
    $rootScope.showAlert = function(alert) {
      return $timeout(function() {
        $scope.alert = alert;
        $scope.alertShown = true;
        $scope.alertShownAt = Date.now();
        $timeout($rootScope.hideAlert, 3000);
      });
    };
    $rootScope.hideAlert = function() {
      return $timeout(function() {
        if (Date.now() - $scope.alertShownAt >= 1000) {
          return $scope.alertShown = false;
        }
      });
    };
    checkFormValid = function() {
      var fields;
      fields = angular.element('.ng-invalid');
      if (fields.length > 0) {
        fields[0].focus();
        $rootScope.showAlert({
          type: 'error',
          i18n: 'options_formInvalid'
        });
        return false;
      }
      return true;
    };
    $rootScope.applyOptions = function() {
      var patch, plainOptions;
      if (!checkFormValid()) {
        return;
      }
      if ($rootScope.$broadcast('omegaApplyOptions').defaultPrevented) {
        return;
      }
      plainOptions = angular.fromJson(angular.toJson($rootScope.options));
      patch = diff.diff($rootScope.optionsOld, plainOptions);
      return omegaTarget.optionsPatch(patch).then(function() {
        return $rootScope.showAlert({
          type: 'success',
          i18n: 'options_saveSuccess'
        });
      });
    };
    $rootScope.resetOptions = function(options) {
      return omegaTarget.resetOptions(options).then(function() {
        return $rootScope.showAlert({
          type: 'success',
          i18n: 'options_resetSuccess'
        });
      })["catch"](function(err) {
        $rootScope.showAlert({
          type: 'error',
          message: err
        });
        return $q.reject(err);
      });
    };
    $rootScope.profileByName = function(name) {
      return OmegaPac.Profiles.byName(name, $rootScope.options);
    };
    $rootScope.systemProfile = $rootScope.profileByName('system');
    $rootScope.externalProfile = createExternalProfile(tr);
    $rootScope.applyOptionsConfirm = function() {
      if (!checkFormValid()) {
        return $q.reject('form_invalid');
      }
      if (!$rootScope.optionsDirty) {
        return $q.when(true);
      }
      return $modal.open({
        template: reactModalTemplates.applyOptionsConfirm
      }).result.then(function() {
        return $rootScope.applyOptions();
      });
    };
    $rootScope.newProfile = function() {
      var scope;
      scope = $rootScope.$new('isolate');
      scope.options = $rootScope.options;
      scope.isProfileNameReserved = isProfileNameReserved;
      scope.isProfileNameHidden = isProfileNameHidden;
      scope.profileByName = $rootScope.profileByName;
      scope.validateProfileName = {
        conflict: '!$value || !profileByName($value)',
        reserved: '!$value || !isProfileNameReserved($value)'
      };
      scope.profileIcons = profileIcons;
      scope.dispNameFilter = dispNameFilter;
      scope.options = $scope.options;
      scope.pacProfilesUnsupported = $scope.pacProfilesUnsupported;
      return $modal.open({
        template: reactModalTemplates.newProfile,
        scope: scope
      }).result.then(function(profile) {
        var choice;
        profile = OmegaPac.Profiles.create(profile);
        choice = Math.floor(Math.random() * profileColors.length);
        if (profile.color == null) {
          profile.color = profileColors[choice];
        }
        OmegaPac.Profiles.updateRevision(profile);
        $rootScope.options[OmegaPac.Profiles.nameAsKey(profile)] = profile;
        return $state.go('profile', {
          name: profile.name
        });
      });
    };
    $rootScope.replaceProfile = function(fromName, toName) {
      return $rootScope.applyOptionsConfirm().then(function() {
        var scope;
        scope = $rootScope.$new('isolate');
        scope.options = $rootScope.options;
        scope.fromName = fromName;
        scope.toName = toName;
        scope.profileByName = $rootScope.profileByName;
        scope.dispNameFilter = dispNameFilter;
        scope.options = $scope.options;
        scope.profileSelect = function(model) {
          return createProfileSelectTemplate(model);
        };
        return $modal.open({
          template: reactModalTemplates.replaceProfile,
          scope: scope
        }).result.then(function(arg) {
          var fromName, toName;
          fromName = arg.fromName, toName = arg.toName;
          return omegaTarget.replaceRef(fromName, toName).then(function() {
            return $rootScope.showAlert({
              type: 'success',
              i18n: 'options_replaceProfileSuccess'
            });
          })["catch"](function(err) {
            return $rootScope.showAlert({
              type: 'error',
              message: err
            });
          });
        });
      });
    };
    $rootScope.renameProfile = function(fromName) {
      return $rootScope.applyOptionsConfirm().then(function() {
        var profile, scope;
        profile = $rootScope.profileByName(fromName);
        scope = $rootScope.$new('isolate');
        scope.options = $rootScope.options;
        scope.fromName = fromName;
        scope.isProfileNameReserved = isProfileNameReserved;
        scope.isProfileNameHidden = isProfileNameHidden;
        scope.profileByName = $rootScope.profileByName;
        scope.validateProfileName = {
          conflict: '!$value || $value == fromName || !profileByName($value)',
          reserved: '!$value || !isProfileNameReserved($value)'
        };
        scope.dispNameFilter = $scope.dispNameFilter;
        scope.options = $scope.options;
        return $modal.open({
          template: reactModalTemplates.renameProfile,
          scope: scope
        }).result.then(function(toName) {
          var attachedName, defaultProfileName, rename, toAttachedName;
          if (toName !== fromName) {
            rename = omegaTarget.renameProfile(fromName, toName);
            attachedName = getAttachedName(fromName);
            if ($rootScope.profileByName(attachedName)) {
              toAttachedName = getAttachedName(toName);
              defaultProfileName = void 0;
              if ($rootScope.profileByName(toAttachedName)) {
                defaultProfileName = profile.defaultProfileName;
                rename = rename.then(function() {
                  var toAttachedKey;
                  toAttachedKey = OmegaPac.Profiles.nameAsKey(toAttachedName);
                  profile = $rootScope.profileByName(toName);
                  profile.defaultProfileName = 'direct';
                  OmegaPac.Profiles.updateRevision(profile);
                  delete $rootScope.options[toAttachedKey];
                  return $rootScope.applyOptions();
                });
              }
              rename = rename.then(function() {
                return omegaTarget.renameProfile(attachedName, toAttachedName);
              });
              if (defaultProfileName) {
                rename = rename.then(function() {
                  profile = $rootScope.profileByName(toName);
                  profile.defaultProfileName = defaultProfileName;
                  return $rootScope.applyOptions();
                });
              }
            }
            return rename.then(function() {
              return $state.go('profile', {
                name: toName
              });
            })["catch"](function(err) {
              return $rootScope.showAlert({
                type: 'error',
                message: err
              });
            });
          }
        });
      });
    };
    $scope.updatingProfile = {};
    $rootScope.updateProfile = function(name) {
      return $rootScope.applyOptionsConfirm().then(function() {
        if (name != null) {
          $scope.updatingProfile[name] = true;
        } else {
          OmegaPac.Profiles.each($scope.options, function(key, profile) {
            if (!profile.builtin) {
              return $scope.updatingProfile[profile.name] = true;
            }
          });
        }
        return omegaTarget.updateProfile(name, 'bypass_cache').then(function(results) {
          var error, profileName, result, singleErr, success;
          success = 0;
          error = 0;
          for (profileName in results) {
            if (!hasProp.call(results, profileName)) continue;
            result = results[profileName];
            if (result instanceof Error) {
              error++;
            } else {
              success++;
            }
          }
          if (error === 0) {
            return $rootScope.showAlert({
              type: 'success',
              i18n: 'options_profileDownloadSuccess'
            });
          } else {
            if (error === 1) {
              singleErr = results[OmegaPac.Profiles.nameAsKey(name)];
              if (singleErr) {
                return $q.reject(singleErr);
              }
            }
            return $q.reject(results);
          }
        })["catch"](function(err) {
          var message;
          message = profileDownloadErrorMessage(err, tr);
          if (message) {
            return $rootScope.showAlert({
              type: 'error',
              message: message
            });
          } else {
            return $rootScope.showAlert({
              type: 'error',
              i18n: 'options_profileDownloadError'
            });
          }
        })["finally"](function() {
          if (name != null) {
            return $scope.updatingProfile[name] = false;
          } else {
            return $scope.updatingProfile = {};
          }
        });
      });
    };
    onOptionChange = function(options, oldOptions) {
      if (options === oldOptions || (oldOptions == null)) {
        return;
      }
      if ($rootScope.suppressOptionsDirty) {
        return;
      }
      return $rootScope.optionsDirty = true;
    };
    $rootScope.$watch('options', onOptionChange, true);
    $rootScope.$on('$stateChangeStart', function(event, _, __, fromState) {
      if (!checkFormValid()) {
        return event.preventDefault();
      }
    });
    $rootScope.$on('$stateChangeSuccess', function() {
      return omegaTarget.lastUrl($location.url());
    });
    $window.onbeforeunload = function() {
      if ($rootScope.optionsDirty) {
        return tr('options_optionsNotSaved');
      } else {
        return null;
      }
    };
    document.addEventListener('click', (function() {
      return $rootScope.hideAlert();
    }), false);
    $scope.profileIcons = profileIcons;
    $scope.dispNameFilter = dispNameFilter;
    syncProfileIcons($scope.profileIcons);
    $scope.downloadIntervals = [15, 60, 180, 360, 720, 1440, -1];
    $scope.downloadIntervalI18n = function(interval) {
      return "options_downloadInterval_" + (interval < 0 ? "never" : interval);
    };
    $scope.openShortcutConfig = omegaTarget.openShortcutConfig.bind(omegaTarget);
    showFirstRunOnce = true;
    showFirstRun = function() {
      if (!showFirstRunOnce) {
        return;
      }
      showFirstRunOnce = false;
      return omegaTarget.state('firstRun').then(function(firstRun) {
        var profileName, scope;
        if (!firstRun) {
          return;
        }
        omegaTarget.state('firstRun', '');
        profileName = firstFixedProfileName($rootScope.options);
        if (!profileName) {
          return;
        }
        scope = $rootScope.$new('isolate');
        scope.upgrade = firstRun === 'upgrade';
        return $modal.open({
          template: reactModalTemplates.optionsWelcome,
          keyboard: false,
          scope: scope,
          backdrop: 'static',
          backdropClass: 'opacity-half'
        }).result.then(function(r) {
          switch (r) {
            case 'later':
              break;
            case 'show':
              return $state.go('profile', {
                name: profileName
              }).then(function() {
                return $script('js/options_guide.js');
              });
          }
        });
      });
    };
    return omegaTarget.refresh();
  }
}
