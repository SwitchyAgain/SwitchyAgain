// @ts-nocheck

/* @module omega-target/options */
var Log, OmegaPac, Options, Promise, Storage, jsondiffpatch,
  bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

Promise = require('bluebird');

Log = require('./log');

Storage = require('./storage');

OmegaPac = require('omega-pac');

jsondiffpatch = require('jsondiffpatch');

Options = (function() {

  /**
   * The entire set of options including profiles and other settings.
   * @typedef OmegaOptions
   * @type {object}
   */

  /**
   * All the options, in a map from key to value.
   * @type OmegaOptions
   */
  var NoOptionsError, ProfileNotExistError;

  Options.prototype._options = null;

  Options.prototype._storage = null;

  Options.prototype._state = null;

  Options.prototype._currentProfileName = null;

  Options.prototype._revertToProfileName = null;

  Options.prototype._watchingProfiles = {};

  Options.prototype._tempProfile = null;

  Options.prototype._tempProfileActive = false;

  Options.prototype.fallbackProfileName = 'system';

  Options.prototype._isSystem = false;

  Options.prototype.debugStr = 'Options';

  Options.prototype.ready = null;

  Options.ProfileNotExistError = ProfileNotExistError = (function(superClass) {
    extend(ProfileNotExistError, superClass);

    function ProfileNotExistError(profileName1) {
      this.profileName = profileName1;
      ProfileNotExistError.__super__.constructor.apply(this, arguments).constructor("Profile " + this.profileName + " does not exist!");
    }

    return ProfileNotExistError;

  })(Error);

  Options.NoOptionsError = NoOptionsError = (function(superClass) {
    extend(NoOptionsError, superClass);

    function NoOptionsError() {
      NoOptionsError.__super__.constructor.apply(this, arguments);
    }

    return NoOptionsError;

  })(Error);


  /**
   * Transform options values (especially profiles) for syncing.
   * @param {{}} value The value to transform
   * @param {{}} key The key of the options
   * @returns {{}} The transformed value
   */

  Options.transformValueForSync = function(value, key) {
    var k, profile, v;
    if (key[0] === '+') {
      if (OmegaPac.Profiles.updateUrl(value)) {
        profile = {};
        for (k in value) {
          v = value[k];
          if (k === 'lastUpdate' || k === 'ruleList' || k === 'pacScript') {
            continue;
          }
          profile[k] = v;
        }
        value = profile;
      }
    }
    return value;
  };

  function Options(options, _storage, _state, log, sync, proxyImpl) {
    this._storage = _storage;
    this._state = _state;
    this.log = log;
    this.sync = sync;
    this.proxyImpl = proxyImpl;
    this._setOptions = bind(this._setOptions, this);
    this._options = {};
    this._tempProfileRules = {};
    this._tempProfileRulesByProfile = {};
    if (this._storage == null) {
      this._storage = Storage();
    }
    if (this._state == null) {
      this._state = Storage();
    }
    if (this.log == null) {
      this.log = Log;
    }
    if (options == null) {
      this.init();
    } else {
      this.ready = this._storage.remove().then((function(_this) {
        return function() {
          return _this._storage.set(options);
        };
      })(this)).then((function(_this) {
        return function() {
          return _this.init();
        };
      })(this));
    }
  }


  /**
   * Attempt to load options from local and remote storage.
   * @param {?{}} args Extra arguments
   * @param {number=3} args.retry Number of retries before giving up.
   * @returns {Promise<OmegaOptions>} The loaded options
   */

  Options.prototype.loadOptions = function(arg) {
    var loadRaw, ref, retry;
    retry = (arg != null ? arg : {}).retry;
    if (retry == null) {
      retry = 3;
    }
    if (typeof this._syncWatchStop === "function") {
      this._syncWatchStop();
    }
    this._syncWatchStop = null;
    if (typeof this._watchStop === "function") {
      this._watchStop();
    }
    this._watchStop = null;
    loadRaw = typeof options !== "undefined" && options !== null ? Promise.resolve(options) : !((ref = this.sync) != null ? ref.enabled : void 0) ? (this.sync == null ? this._state.set({
      'syncOptions': 'unsupported'
    }) : void 0, this._storage.get(null)) : (this._state.set({
      'syncOptions': 'sync'
    }), this._syncWatchStop = this.sync.watchAndPull(this._storage), this.sync.copyTo(this._storage)["catch"](Storage.StorageUnavailableError, (function(_this) {
      return function() {
        console.error('Warning: Sync storage is not available in this ' + 'browser! Disabling options sync.');
        if (typeof _this._syncWatchStop === "function") {
          _this._syncWatchStop();
        }
        _this._syncWatchStop = null;
        _this.sync = null;
        return _this._state.set({
          'syncOptions': 'unsupported'
        });
      };
    })(this)).then((function(_this) {
      return function() {
        return _this._storage.get(null);
      };
    })(this)));
    return this.optionsLoaded = loadRaw.then((function(_this) {
      return function(options) {
        return _this.upgrade(options);
      };
    })(this)).then((function(_this) {
      return function(arg1) {
        var changes, options;
        options = arg1[0], changes = arg1[1];
        return _this._storage.apply({
          changes: changes
        })["return"](options);
      };
    })(this)).tap((function(_this) {
      return function(options) {
        _this._options = options;
        _this._watchStop = _this._watch();
        return _this._state.get({
          'syncOptions': ''
        }).then(function(arg1) {
          var syncOptions;
          syncOptions = arg1.syncOptions;
          if (syncOptions) {
            return;
          }
          _this._state.set({
            'syncOptions': 'conflict'
          });
          return _this.sync.storage.get('schemaVersion').then(function(arg2) {
            var schemaVersion;
            schemaVersion = arg2.schemaVersion;
            if (!schemaVersion) {
              return _this._state.set({
                'syncOptions': 'pristine'
              });
            }
          });
        });
      };
    })(this))["catch"]((function(_this) {
      return function(e) {
        var getFallbackOptions;
        if (!(retry > 0)) {
          return Promise.reject(e);
        }
        getFallbackOptions = Promise.resolve().then(function() {
          if (e instanceof NoOptionsError) {
            _this._state.get({
              'firstRun': 'new',
              'web.switchGuide': 'showOnFirstUse'
            }).then(function(items) {
              return _this._state.set(items);
            });
            if (_this.sync == null) {
              return null;
            }
            return _this._state.get({
              'syncOptions': ''
            }).then(function(arg1) {
              var syncOptions;
              syncOptions = arg1.syncOptions;
              if (syncOptions === 'conflict') {
                return;
              }
              return _this.sync.storage.get(null).then(function(options) {
                if (!options['schemaVersion']) {
                  _this._state.set({
                    'syncOptions': 'pristine'
                  });
                  return null;
                } else {
                  _this._state.set({
                    'syncOptions': 'sync'
                  });
                  _this.sync.enabled = true;
                  _this.log.log('Options#loadOptions::fromSync', options);
                  return options;
                }
              })["catch"](function() {
                return null;
              });
            });
          } else {
            _this.log.error(e.stack);
            _this._state.remove(['syncOptions']);
            return null;
          }
        });
        return getFallbackOptions.then(function(options) {
          var prevEnabled;
          if (options == null) {
            options = _this.parseOptions(_this.getDefaultOptions());
          }
          if (_this.sync != null) {
            prevEnabled = _this.sync.enabled;
            _this.sync.enabled = false;
          }
          return _this._storage.remove().then(function() {
            return _this._storage.set(options);
          }).then(function() {
            if (_this.sync != null) {
              _this.sync.enabled = prevEnabled;
            }
            return _this.loadOptions({
              retry: retry - 1
            });
          });
        });
      };
    })(this));
  };


  /**
   * Attempt to initialize (or reinitialize) options.
   * @returns {Promise<OmegaOptions>} A promise that is fulfilled on ready.
   */

  Options.prototype.init = function() {
    this.ready = this.loadOptions().then((function(_this) {
      return function() {
        if (_this._options['-startupProfileName']) {
          return _this.applyProfile(_this._options['-startupProfileName']);
        } else {
          return _this._state.get({
            'currentProfileName': _this.fallbackProfileName,
            'isSystemProfile': false
          }).then(function(st) {
            if (st['isSystemProfile']) {
              return _this.applyProfile('system');
            } else {
              return _this.applyProfile(st['currentProfileName'] || _this.fallbackProfileName);
            }
          });
        }
      };
    })(this))["catch"]((function(_this) {
      return function(err) {
        if (!(err instanceof ProfileNotExistError)) {
          _this.log.error(err);
        }
        return _this.applyProfile(_this.fallbackProfileName);
      };
    })(this))["catch"]((function(_this) {
      return function(err) {
        return _this.log.error(err);
      };
    })(this)).then((function(_this) {
      return function() {
        return _this.getAll();
      };
    })(this));
    this.ready.then((function(_this) {
      return function() {
        var ref;
        if ((ref = _this.sync) != null ? ref.enabled : void 0) {
          _this.sync.requestPush(_this._options);
        }
        _this._state.get({
          'firstRun': ''
        }).then(function(arg) {
          var firstRun;
          firstRun = arg.firstRun;
          if (firstRun) {
            return _this.onFirstRun(firstRun);
          }
        });
        if (_this._options['-downloadInterval'] > 0) {
          return _this.updateProfile();
        }
      };
    })(this));
    return this.ready;
  };

  Options.prototype.toString = function() {
    return "<Options>";
  };


  /**
   * Return a localized, human-readable description of the given profile.
   * In base class, this method is not implemented and will always return null.
   * @param {?{}} profile The profile to print
   * @returns {string} Description of the profile with details
   */

  Options.prototype.printProfile = function(profile) {
    return null;
  };


  /**
   * Upgrade options from previous versions.
   * For now, this method only supports schemaVersion 1 and 2. If so, it upgrades
   * the options to version 2 (the latest version). Otherwise it rejects.
   * It is recommended for the derived classes to call super() two times in the
   * beginning and in the end of the implementation to check the schemaVersion
   * and to apply future upgrades, respectively.
   * Example: super(options).catch -> super(doCustomUpgrades(options), changes)
   * @param {?OmegaOptions} options The legacy options to upgrade
   * @param {{}={}} changes Previous pending changes to be applied. Default to
   * an empty dictionary. Please provide this argument when calling super().
   * @returns {Promise<[OmegaOptions, {}]>} The new options and the changes.
   */

  Options.prototype.upgrade = function(options, changes) {
    var autoDetectUsed, version;
    if (changes == null) {
      changes = {};
    }
    version = options != null ? options['schemaVersion'] : void 0;
    if (version === 1) {
      autoDetectUsed = false;
      OmegaPac.Profiles.each(options, function(key, profile) {
        var refs;
        if (!autoDetectUsed) {
          refs = OmegaPac.Profiles.directReferenceSet(profile);
          if (refs['+auto_detect']) {
            return autoDetectUsed = true;
          }
        }
      });
      if (autoDetectUsed) {
        options['+auto_detect'] = OmegaPac.Profiles.create({
          name: 'auto_detect',
          profileType: 'PacProfile',
          pacUrl: 'http://wpad/wpad.dat',
          color: '#00cccc'
        });
      }
      version = changes['schemaVersion'] = options['schemaVersion'] = 2;
    }
    if (version === 2) {
      return Promise.resolve([options, changes]);
    } else {
      return Promise.reject(new Error("Invalid schemaVerion " + version + "!"));
    }
  };


  /**
   * Parse options in various formats (including JSON & base64).
   * @param {OmegaOptions|string} options The options to parse
   * @returns {Promise<OmegaOptions>} The parsed options.
   */

  Options.prototype.parseOptions = function(options) {
    var Buffer, _;
    if (typeof options === 'string') {
      if (options[0] !== '{') {
        try {
          Buffer = require('buffer').Buffer;
          options = new Buffer(options, 'base64').toString('utf8');
        } catch (error) {
          _ = error;
          options = null;
        }
      }
      options = (function() {
        try {
          return JSON.parse(options);
        } catch (error) {}
      })();
    }
    if (!options) {
      throw new Error('Invalid options!');
    }
    return options;
  };


  /**
   * Reset the options to the given options or initial options.
   * @param {?OmegaOptions} options The options to set. Defaults to initial.
   * @returns {Promise<OmegaOptions>} The options just applied
   */

  Options.prototype.reset = function(options) {
    var preserveProfileName;
    this.log.method('Options#reset', this, arguments);
    preserveProfileName = options != null ? this._currentProfileName : null;
    if (options == null) {
      options = this.getDefaultOptions();
    }
    return this.upgrade(this.parseOptions(options)).then((function(_this) {
      return function(arg) {
        var opt;
        opt = arg[0];
        if (_this.sync != null) {
          _this.sync.enabled = false;
        }
        _this._state.remove(['syncOptions']);
        return _this._storage.remove().then(function() {
          return _this._storage.set(opt);
        }).then(function() {
          if (preserveProfileName && !opt['-startupProfileName'] && OmegaPac.Profiles.byName(preserveProfileName, opt)) {
            _this._state.set({
              'currentProfileName': preserveProfileName,
              'isSystemProfile': preserveProfileName === 'system'
            });
          }
          return _this.init();
        });
      };
    })(this));
  };


  /**
   * Called on the first initialization of options.
   * @param {reason} reason The value of 'firstRun' in state.
   */

  Options.prototype.onFirstRun = function(reason) {
    return null;
  };


  /**
   * Return the default options used initially and on resets.
   * @returns {?OmegaOptions} The default options.
   */

  Options.prototype.getDefaultOptions = function() {
    return require('./default_options')();
  };


  /**
   * Return all options.
   * @returns {?OmegaOptions} The options.
   */

  Options.prototype.getAll = function() {
    return this._options;
  };


  /**
   * Get profile by name.
   * @returns {?{}} The profile, or undefined if no such profile.
   */

  Options.prototype.profile = function(name) {
    return OmegaPac.Profiles.byName(name, this._options);
  };


  /**
   * Apply the patch to the current options.
   * @param {jsondiffpatch} patch The patch to apply
   * @returns {Promise<OmegaOptions>} The updated options
   */

  Options.prototype.patch = function(patch) {
    var changes, delta, key;
    if (!patch) {
      return;
    }
    this.log.method('Options#patch', this, arguments);
    this._options = jsondiffpatch.patch(this._options, patch);
    changes = {};
    for (key in patch) {
      if (!hasProp.call(patch, key)) continue;
      delta = patch[key];
      if (delta.length === 3 && delta[1] === 0 && delta[2] === 0) {
        changes[key] = void 0;
      } else {
        changes[key] = this._options[key];
      }
    }
    return this._setOptions(changes);
  };

  Options.prototype._setOptions = function(changes, args) {
    var checkRev, currentProfileAffected, j, key, len, profilesChanged, ref, ref1, ref2, ref3, removed, result, value;
    removed = [];
    checkRev = (ref = args != null ? args.checkRevision : void 0) != null ? ref : false;
    profilesChanged = false;
    currentProfileAffected = false;
    for (key in changes) {
      if (!hasProp.call(changes, key)) continue;
      value = changes[key];
      if (typeof value === 'undefined') {
        delete this._options[key];
        removed.push(key);
        if (key[0] === '+') {
          profilesChanged = true;
          if (key === '+' + this._currentProfileName) {
            currentProfileAffected = 'removed';
          }
        }
      } else {
        if (key[0] === '+') {
          if (checkRev && this._options[key]) {
            result = OmegaPac.Revision.compare(this._options[key].revision, value.revision);
            if (result >= 0) {
              continue;
            }
          }
          profilesChanged = true;
        }
        this._options[key] = value;
      }
      if (!currentProfileAffected && this._watchingProfiles[key]) {
        currentProfileAffected = 'changed';
      }
    }
    switch (currentProfileAffected) {
      case 'removed':
        this.applyProfile(this.fallbackProfileName);
        break;
      case 'changed':
        this.applyProfile(this._currentProfileName, {
          update: false
        });
        break;
      default:
        if (profilesChanged) {
          this._setAvailableProfiles();
        }
    }
    if ((ref1 = args != null ? args.persist : void 0) != null ? ref1 : true) {
      if ((ref2 = this.sync) != null ? ref2.enabled : void 0) {
        if ((ref3 = this.sync) != null) {
          ref3.requestPush(changes);
        }
      }
      for (j = 0, len = removed.length; j < len; j++) {
        key = removed[j];
        delete changes[key];
      }
      return this._storage.set(changes).then((function(_this) {
        return function() {
          _this._storage.remove(removed);
          return _this._options;
        };
      })(this));
    }
  };

  Options.prototype._watch = function() {
    var handler;
    handler = (function(_this) {
      return function(changes) {
        var monitorWebRequests, quickSwitchProfiles, refresh, showExternal, showMenu;
        if (changes) {
          _this._setOptions(changes, {
            checkRevision: true,
            persist: false
          });
        } else {
          changes = _this._options;
        }
        refresh = changes['-refreshOnProfileChange'];
        if (refresh != null) {
          _this._state.set({
            'refreshOnProfileChange': refresh
          });
        }
        if (Object.prototype.hasOwnProperty.call(changes, '-showExternalProfile')) {
          showExternal = changes['-showExternalProfile'];
          if (showExternal == null) {
            showExternal = true;
            _this._setOptions({
              '-showExternalProfile': true
            }, {
              persist: true
            });
          }
          _this._state.set({
            'showExternalProfile': showExternal
          });
        }
        quickSwitchProfiles = changes['-quickSwitchProfiles'];
        quickSwitchProfiles = _this._cleanUpQuickSwitchProfiles(quickSwitchProfiles);
        if ((changes['-enableQuickSwitch'] != null) || (quickSwitchProfiles != null)) {
          _this.reloadQuickSwitch();
        }
        if (changes['-downloadInterval'] != null) {
          _this.schedule('updateProfile', _this._options['-downloadInterval'], function() {
            return _this.updateProfile();
          });
        }
        if ((changes['-showInspectMenu'] != null) || changes === _this._options) {
          showMenu = _this._options['-showInspectMenu'];
          if (showMenu == null) {
            showMenu = true;
            _this._setOptions({
              '-showInspectMenu': true
            }, {
              persist: true
            });
          }
          _this.setInspect({
            showMenu: showMenu
          });
        }
        if ((changes['-monitorWebRequests'] != null) || changes === _this._options) {
          monitorWebRequests = _this._options['-monitorWebRequests'];
          if (monitorWebRequests == null) {
            monitorWebRequests = true;
            _this._setOptions({
              '-monitorWebRequests': true
            }, {
              persist: true
            });
          }
          return _this.setMonitorWebRequests(monitorWebRequests);
        }
      };
    })(this);
    handler();
    return this._storage.watch(null, handler);
  };

  Options.prototype._cleanUpQuickSwitchProfiles = function(quickSwitchProfiles) {
    var seenQuickSwitchProfile, validQuickSwitchProfiles;
    if (quickSwitchProfiles == null) {
      return;
    }
    seenQuickSwitchProfile = {};
    validQuickSwitchProfiles = quickSwitchProfiles.filter((function(_this) {
      return function(name) {
        var key;
        if (!name) {
          return false;
        }
        key = OmegaPac.Profiles.nameAsKey(name);
        if (seenQuickSwitchProfile[key]) {
          return false;
        }
        if (!OmegaPac.Profiles.byName(name, _this._options)) {
          return false;
        }
        seenQuickSwitchProfile[key] = true;
        return true;
      };
    })(this));
    if (validQuickSwitchProfiles.length !== quickSwitchProfiles.length) {
      this._setOptions({
        '-quickSwitchProfiles': validQuickSwitchProfiles
      }, {
        persist: true
      });
    }
    return validQuickSwitchProfiles;
  };


  /**
   * Reload the quick switch according to settings.
   * @returns {Promise} A promise which is fulfilled when the quick switch is set
   */

  Options.prototype.reloadQuickSwitch = function() {
    var profiles;
    profiles = this._options['-quickSwitchProfiles'];
    if (profiles.length < 2) {
      profiles = null;
    }
    if (this._options['-enableQuickSwitch']) {
      return this.setQuickSwitch(profiles, !!profiles);
    } else {
      return this.setQuickSwitch(null, !!profiles);
    }
  };


  /**
   * Apply the settings related to element proxy inspection.
   * In base class, this method is not implemented and will not do anything.
   * @param {{}} settings
   * @param {boolean} settings.showMenu Whether to show the menu or not
   * @returns {Promise} A promise which is fulfilled when the settings apply
   */

  Options.prototype.setInspect = function() {
    return Promise.resolve();
  };


  /**
   * Apply the settings related to web request monitoring.
   * In base class, this method is not implemented and will not do anything.
   * @param {boolean} enabled Whether network shall be monitored or not
   * @returns {Promise} A promise which is fulfilled when the settings apply
   */

  Options.prototype.setMonitorWebRequests = function() {
    return Promise.resolve();
  };


  /**
   * @callback watchCallback
   * @param {Object.<string, {}>} changes A map from keys to values.
   */


  /**
   * Watch for any changes to the options
   * @param {watchCallback} callback Called everytime the value of a key changes
   * @returns {function} Calling the returned function will stop watching.
   */

  Options.prototype.watch = function(callback) {
    return this._storage.watch(null, callback);
  };

  Options.prototype._profileNotFound = function(name) {
    this.log.error("Profile " + name + " not found! Things may go very, very wrong.");
    return OmegaPac.Profiles.create({
      name: name,
      profileType: 'VirtualProfile',
      defaultProfileName: 'direct'
    });
  };


  /**
   * Get PAC script for profile.
   * @param {?string|Object} profile The name of the profile, or the profile.
   * @param {bool=false} compress Compress the script if true.
   * @returns {string} The compiled
   */

  Options.prototype.pacForProfile = function(profile, compress) {
    var ast;
    if (compress == null) {
      compress = false;
    }
    ast = OmegaPac.PacGenerator.script(this._options, profile, {
      profileNotFound: this._profileNotFound.bind(this)
    });
    if (compress) {
      ast = OmegaPac.PacGenerator.compress(ast);
    }
    return Promise.resolve(OmegaPac.PacGenerator.ascii(ast.print_to_string()));
  };

  Options.prototype._setAvailableProfiles = function() {
    var allReferenceSet, currentIncludable, profile, profiles, results;
    profile = this._currentProfileName ? this.currentProfile() : null;
    profiles = {};
    currentIncludable = profile && OmegaPac.Profiles.isIncludable(profile);
    allReferenceSet = null;
    if (!profile || !OmegaPac.Profiles.isInclusive(profile)) {
      results = [];
    }
    OmegaPac.Profiles.each(this._options, (function(_this) {
      return function(key, p) {
        profiles[key] = {
          name: p.name,
          profileType: p.profileType,
          color: p.color,
          desc: _this.printProfile(p),
          builtin: p.builtin ? true : void 0
        };
        if (p.profileType === 'VirtualProfile') {
          profiles[key].defaultProfileName = p.defaultProfileName;
          if (allReferenceSet == null) {
            allReferenceSet = profile ? OmegaPac.Profiles.allReferenceSet(profile, _this._options, {
              profileNotFound: _this._profileNotFound.bind(_this)
            }) : {};
          }
          if (allReferenceSet[key]) {
            profiles[key].validResultProfiles = OmegaPac.Profiles.validResultProfilesFor(p, _this._options).map(function(result) {
              return result.name;
            });
          }
        }
        if (currentIncludable && OmegaPac.Profiles.isIncludable(p)) {
          return results != null ? results.push(p.name) : void 0;
        }
      };
    })(this));
    if (profile && OmegaPac.Profiles.isInclusive(profile)) {
      results = OmegaPac.Profiles.validResultProfilesFor(profile, this._options);
      results = results.map(function(profile) {
        return profile.name;
      });
    }
    return this._state.set({
      'availableProfiles': profiles,
      'validResultProfiles': results
    });
  };


  /**
   * Apply the profile by name.
   * @param {?string} name The name of the profile, or null for default.
   * @param {?{}} options Some options
   * @param {bool=true} options.proxy Set proxy for the applied profile if true
   * @param {bool=true} options.update Try to update this profile and referenced
   * profiles after the proxy is set.
   * @param {bool=false} options.system Whether options is in system mode.
   * @param {{}=undefined} options.reason will be passed to currentProfileChanged
   * @returns {Promise} A promise which is fulfilled when the profile is applied.
   */

  Options.prototype.applyProfile = function(name, options) {
    var applyProxy, j, key, l, len, len1, list, profile, ref, removedKeys, rule;
    this.log.method('Options#applyProfile', this, arguments);
    profile = OmegaPac.Profiles.byName(name, this._options);
    if (!profile) {
      return Promise.reject(new ProfileNotExistError(name));
    }
    this._currentProfileName = profile.name;
    this._isSystem = (options != null ? options.system : void 0) || (profile.profileType === 'SystemProfile');
    this._watchingProfiles = OmegaPac.Profiles.allReferenceSet(profile, this._options, {
      profileNotFound: this._profileNotFound.bind(this)
    });
    this._state.set({
      'currentProfileName': this._currentProfileName,
      'isSystemProfile': this._isSystem,
      'currentProfileCanAddRule': (profile.rules != null) && profile.profileType !== 'VirtualProfile'
    });
    this._setAvailableProfiles();
    this.currentProfileChanged(options != null ? options.reason : void 0);
    if ((options != null) && options.proxy === false) {
      return Promise.resolve();
    }
    this._tempProfileActive = false;
    if ((this._tempProfile != null) && OmegaPac.Profiles.isIncludable(profile)) {
      this._tempProfileActive = true;
      if (this._tempProfile.defaultProfileName !== profile.name) {
        this._tempProfile.defaultProfileName = profile.name;
        this._tempProfile.color = profile.color;
        OmegaPac.Profiles.updateRevision(this._tempProfile);
      }
      removedKeys = [];
      ref = this._tempProfileRulesByProfile;
      for (key in ref) {
        if (!hasProp.call(ref, key)) continue;
        list = ref[key];
        if (!OmegaPac.Profiles.byKey(key, this._options)) {
          removedKeys.push(key);
          for (j = 0, len = list.length; j < len; j++) {
            rule = list[j];
            rule.profileName = null;
            this._tempProfile.rules.splice(this._tempProfile.rules.indexOf(rule), 1);
          }
        }
      }
      if (removedKeys.length > 0) {
        for (l = 0, len1 = removedKeys.length; l < len1; l++) {
          key = removedKeys[l];
          delete this._tempProfileRulesByProfile[key];
        }
        OmegaPac.Profiles.updateRevision(this._tempProfile);
      }
      this._watchingProfiles = OmegaPac.Profiles.allReferenceSet(this._tempProfile, this._options, {
        profileNotFound: this._profileNotFound.bind(this)
      });
      applyProxy = this.proxyImpl.applyProfile(this._tempProfile, profile, this._options);
    } else {
      applyProxy = this.proxyImpl.applyProfile(profile, profile, this._options);
    }
    if ((options != null) && options.update === false) {
      return applyProxy;
    }
    applyProxy.then((function(_this) {
      return function() {
        var ref1, updateProfiles;
        if (!(_this._options['-downloadInterval'] > 0)) {
          return;
        }
        if (_this._currentProfileName !== profile.name) {
          return;
        }
        updateProfiles = [];
        ref1 = _this._watchingProfiles;
        for (key in ref1) {
          name = ref1[key];
          updateProfiles.push(name);
        }
        if (updateProfiles.length > 0) {
          return _this.updateProfile(updateProfiles);
        }
      };
    })(this))["catch"]((function(_this) {
      return function(error) {
        return _this.log.error('Profile update after apply failed:', error);
      };
    })(this));
    return applyProxy;
  };


  /**
   * Get the current applied profile.
   * @returns {{}} The current profile
   */

  Options.prototype.currentProfile = function() {
    if (this._currentProfileName) {
      return OmegaPac.Profiles.byName(this._currentProfileName, this._options);
    } else {
      return this._externalProfile;
    }
  };


  /**
   * Return true if in system mode.
   * @returns {boolean} True if system mode is activated
   */

  Options.prototype.isSystem = function() {
    return this._isSystem;
  };


  /**
   * Called when current profile has changed.
   * In base class, this method is not implemented and will not do anything.
   */

  Options.prototype.currentProfileChanged = function() {
    return null;
  };


  /**
   * Set or disable the quick switch profiles.
   * In base class, this method is not implemented and will not do anything.
   * @param {string[]|null} quickSwitch The profile names, or null to disable
   * @param {boolean} canEnable Whether user can enable quick switch or not.
   * @returns {Promise} A promise which is fulfilled when the quick switch is set
   */

  Options.prototype.setQuickSwitch = function(quickSwitch, canEnable) {
    return Promise.resolve();
  };


  /**
   * Schedule a task that runs every periodInMinutes.
   * In base class, this method is not implemented and will not do anything.
   * @param {string} name The name of the schedule. If there is a previous
   * schedule with the same name, it will be replaced by the new one.
   * @param {number} periodInMinutes The interval of the schedule
   * @param {function} callback The callback to call when the task runs
   * @returns {Promise} A promise which is fulfilled when the schedule is set
   */

  Options.prototype.schedule = function(name, periodInMinutes, callback) {
    return Promise.resolve();
  };


  /**
   * Return true if the match result of current profile does not change with URLs
   * @returns {bool} Whether @match always return the same result for requests
   */

  Options.prototype.isCurrentProfileStatic = function() {
    var currentProfile;
    if (!this._currentProfileName) {
      return true;
    }
    if (this._tempProfileActive) {
      return false;
    }
    currentProfile = this.currentProfile();
    if (OmegaPac.Profiles.isInclusive(currentProfile)) {
      return false;
    }
    return true;
  };


  /**
   * Update the profile by name.
   * @param {(string|string[]|null)} name The name of the profiles,
   * or null for all.
   * @param {?bool} opt_bypass_cache Do not read from the cache if true
   * @returns {Promise<Object.<string,({}|Error)>>} A map from keys to updated
   * profiles or errors.
   * A value is an error if `value instanceof Error`. Otherwise the value is an
   * updated profile.
   */

  Options.prototype.updateProfile = function(name, opt_bypass_cache) {
    var results;
    this.log.method('Options#updateProfile', this, arguments);
    results = {};
    OmegaPac.Profiles.each(this._options, (function(_this) {
      return function(key, profile) {
        var fetchResult, type_hints, url;
        if (name != null) {
          if (Array.isArray(name)) {
            if (!(name.indexOf(profile.name) >= 0)) {
              return;
            }
          } else {
            if (profile.name !== name) {
              return;
            }
          }
        }
        url = OmegaPac.Profiles.updateUrl(profile);
        if (url) {
          type_hints = OmegaPac.Profiles.updateContentTypeHints(profile);
          fetchResult = _this.fetchUrl(url, opt_bypass_cache, type_hints);
          return results[key] = fetchResult.then(function(data) {
            var changes;
            if (!data) {
              return profile;
            }
            profile = OmegaPac.Profiles.byKey(key, _this._options);
            profile.lastUpdate = new Date().toISOString();
            if (OmegaPac.Profiles.update(profile, data)) {
              OmegaPac.Profiles.dropCache(profile);
              changes = {};
              changes[key] = profile;
              return _this._setOptions(changes)["return"](profile);
            } else {
              return profile;
            }
          })["catch"](function(reason) {
            if (reason instanceof Error) {
              return reason;
            } else {
              return new Error(reason);
            }
          });
        }
      };
    })(this));
    return Promise.props(results);
  };


  /**
   * Make an HTTP GET request to fetch the content of the url.
   * In base class, this method is not implemented and will always reject.
   * @param {string} url The name of the profiles,
   * @param {?bool} opt_bypass_cache Do not read from the cache if true
   * @param {?string} opt_type_hints MIME type hints for downloaded content.
   * @returns {Promise<String>} The text content fetched from the url
   */

  Options.prototype.fetchUrl = function(url, opt_bypass_cache, opt_type_hints) {
    return Promise.reject(new Error('not implemented'));
  };

  Options.prototype._replaceRefChanges = function(fromName, toName, changes) {
    var i, j, quickSwitch, ref;
    if (changes == null) {
      changes = {};
    }
    OmegaPac.Profiles.each(this._options, function(key, p) {
      if (p.name === fromName || p.name === toName) {
        return;
      }
      if (OmegaPac.Profiles.replaceRef(p, fromName, toName)) {
        OmegaPac.Profiles.updateRevision(p);
        return changes[OmegaPac.Profiles.nameAsKey(p)] = p;
      }
    });
    if (this._options['-startupProfileName'] === fromName) {
      changes['-startupProfileName'] = toName;
    }
    quickSwitch = this._options['-quickSwitchProfiles'];
    if (quickSwitch.indexOf(toName) < 0) {
      for (i = j = 0, ref = quickSwitch.length; 0 <= ref ? j < ref : j > ref; i = 0 <= ref ? ++j : --j) {
        if (quickSwitch[i] === fromName) {
          quickSwitch[i] = toName;
          changes['-quickSwitchProfiles'] = quickSwitch;
        }
      }
    }
    return changes;
  };


  /**
   * Replace all references of profile fromName to toName.
   * @param {String} fromName The original profile name
   * @param {String} toname The target profile name
   * @returns {Promise<OmegaOptions>} The updated options
   */

  Options.prototype.replaceRef = function(fromName, toName) {
    var changes, fromKey, key, profile, value;
    this.log.method('Options#replaceRef', this, arguments);
    profile = OmegaPac.Profiles.byName(fromName, this._options);
    if (!profile) {
      return Promise.reject(new ProfileNotExistError(fromName));
    }
    changes = this._replaceRefChanges(fromName, toName);
    for (key in changes) {
      if (!hasProp.call(changes, key)) continue;
      value = changes[key];
      this._options[key] = value;
    }
    fromKey = OmegaPac.Profiles.nameAsKey(fromName);
    if (this._watchingProfiles[fromKey]) {
      if (this._currentProfileName === fromName) {
        this._currentProfileName = toName;
      }
      this.applyProfile(this._currentProfileName);
    }
    return this._setOptions(changes);
  };


  /**
   * Rename a profile and update references and options
   * @param {String} fromName The original profile name
   * @param {String} toname The target profile name
   * @returns {Promise<OmegaOptions>} The updated options
   */

  Options.prototype.renameProfile = function(fromName, toName) {
    var changes, fromKey, key, profile, value;
    this.log.method('Options#renameProfile', this, arguments);
    if (OmegaPac.Profiles.byName(toName, this._options)) {
      return Promise.reject(new Error("Target name " + name + " already taken!"));
    }
    profile = OmegaPac.Profiles.byName(fromName, this._options);
    if (!profile) {
      return Promise.reject(new ProfileNotExistError(fromName));
    }
    profile.name = toName;
    changes = {};
    changes[OmegaPac.Profiles.nameAsKey(profile)] = profile;
    this._replaceRefChanges(fromName, toName, changes);
    for (key in changes) {
      if (!hasProp.call(changes, key)) continue;
      value = changes[key];
      this._options[key] = value;
    }
    fromKey = OmegaPac.Profiles.nameAsKey(fromName);
    changes[fromKey] = void 0;
    delete this._options[fromKey];
    if (this._watchingProfiles[fromKey]) {
      if (this._currentProfileName === fromName) {
        this._currentProfileName = toName;
      }
      this.applyProfile(this._currentProfileName);
    }
    return this._setOptions(changes);
  };


  /**
   * Add a temp rule.
   * @param {String} domain The domain for the temp rule.
   * @param {String} profileName The profile to apply for the domain.
   * @returns {Promise} A promise which is fulfilled when the rule is applied.
   */

  Options.prototype.addTempRule = function(domain, profileName) {
    var changed, currentProfile, key, list, profile, rule, rulesByProfile;
    this.log.method('Options#addTempRule', this, arguments);
    if (!this._currentProfileName) {
      return Promise.resolve();
    }
    profile = OmegaPac.Profiles.byName(profileName, this._options);
    if (!profile) {
      return Promise.reject(new ProfileNotExistError(profileName));
    }
    if (this._tempProfile == null) {
      this._tempProfile = OmegaPac.Profiles.create('', 'SwitchProfile');
      currentProfile = this.currentProfile();
      this._tempProfile.color = currentProfile.color;
      this._tempProfile.defaultProfileName = currentProfile.name;
    }
    changed = false;
    rule = this._tempProfileRules[domain];
    if (rule && rule.profileName) {
      if (rule.profileName !== profileName) {
        key = OmegaPac.Profiles.nameAsKey(rule.profileName);
        list = this._tempProfileRulesByProfile[key];
        list.splice(list.indexOf(rule), 1);
        rule.profileName = profileName;
        changed = true;
      }
    } else {
      rule = {
        condition: {
          conditionType: 'HostWildcardCondition',
          pattern: '*.' + domain
        },
        profileName: profileName,
        isTempRule: true
      };
      this._tempProfile.rules.push(rule);
      this._tempProfileRules[domain] = rule;
      changed = true;
    }
    key = OmegaPac.Profiles.nameAsKey(profileName);
    rulesByProfile = this._tempProfileRulesByProfile[key];
    if (rulesByProfile == null) {
      rulesByProfile = this._tempProfileRulesByProfile[key] = [];
    }
    rulesByProfile.push(rule);
    if (changed) {
      OmegaPac.Profiles.updateRevision(this._tempProfile);
      return this.applyProfile(this._currentProfileName);
    } else {
      return Promise.resolve();
    }
  };


  /**
   * Find a temp rule by domain.
   * @param {String} domain The domain of the temp rule.
   * @returns {Promise<?String>} The profile name for the domain, or null if such
   * rule does not exist.
   */

  Options.prototype.queryTempRule = function(domain) {
    var rule;
    rule = this._tempProfileRules[domain];
    if (rule) {
      if (rule.profileName) {
        return rule.profileName;
      } else {
        delete this._tempProfileRules[domain];
      }
    }
    return null;
  };


  /**
   * Add a condition to the current active switch profile.
   * @param {Object.<String,{}>} cond The condition to add
   * @param {string>} profileName The name of the result profile of the rule.
   * @returns {Promise} A promise which is fulfilled when the condition is saved.
   */

  Options.prototype.addCondition = function(condition, profileName, addToBottom) {
    var changes, cond, i, j, l, len, profile, ref, tag, target;
    this.log.method('Options#addCondition', this, arguments);
    if (!this._currentProfileName) {
      return Promise.resolve();
    }
    profile = OmegaPac.Profiles.byName(this._currentProfileName, this._options);
    if ((profile != null ? profile.rules : void 0) == null) {
      return Promise.reject(new Error("Cannot add condition to Profile " + (profile != null ? profile.name : this._currentProfileName) + " (" + (profile != null ? profile.profileType : 'UnknownProfile') + ")"));
    }
    target = OmegaPac.Profiles.byName(profileName, this._options);
    if (target == null) {
      return Promise.reject(new ProfileNotExistError(profileName));
    }
    if (!Array.isArray(condition)) {
      condition = [condition];
    }
    for (j = 0, len = condition.length; j < len; j++) {
      cond = condition[j];
      tag = OmegaPac.Conditions.tag(cond);
      for (i = l = 0, ref = profile.rules.length; 0 <= ref ? l < ref : l > ref; i = 0 <= ref ? ++l : --l) {
        if (OmegaPac.Conditions.tag(profile.rules[i].condition) === tag) {
          profile.rules.splice(i, 1);
          break;
        }
      }
      if (addToBottom || this._options['-addConditionsToBottom']) {
        profile.rules.push({
          condition: cond,
          profileName: profileName
        });
      } else {
        profile.rules.unshift({
          condition: cond,
          profileName: profileName
        });
      }
    }
    OmegaPac.Profiles.updateRevision(profile);
    changes = {};
    changes[OmegaPac.Profiles.nameAsKey(profile)] = profile;
    return this._setOptions(changes);
  };


  /**
   * Set the defaultProfileName of the profile.
   * @param {string>} profileName The name of the profile to modify.
   * @param {string>} defaultProfileName The defaultProfileName to set.
   * @returns {Promise} A promise which is fulfilled when the profile is saved.
   */

  Options.prototype.setDefaultProfile = function(profileName, defaultProfileName) {
    var changes, profile, target;
    this.log.method('Options#setDefaultProfile', this, arguments);
    profile = OmegaPac.Profiles.byName(profileName, this._options);
    if (profile == null) {
      return Promise.reject(new ProfileNotExistError(profileName));
    } else if (profile.defaultProfileName == null) {
      return Promise.reject(new Error(("Profile " + this.profile.name + " ") + "(@{profile.type}) does not have defaultProfileName!"));
    }
    target = OmegaPac.Profiles.byName(defaultProfileName, this._options);
    if (target == null) {
      return Promise.reject(new ProfileNotExistError(defaultProfileName));
    }
    profile.defaultProfileName = defaultProfileName;
    OmegaPac.Profiles.updateRevision(profile);
    changes = {};
    changes[OmegaPac.Profiles.nameAsKey(profile)] = profile;
    return this._setOptions(changes);
  };


  /**
   * Add a profile to the options
   * @param {{}} profile The profile to create
   * @returns {Promise<{}>} The saved profile
   */

  Options.prototype.addProfile = function(profile) {
    var changes;
    this.log.method('Options#addProfile', this, arguments);
    if (OmegaPac.Profiles.byName(profile.name, this._options)) {
      return Promise.reject(new Error("Target name " + profile.name + " already taken!"));
    } else {
      changes = {};
      changes[OmegaPac.Profiles.nameAsKey(profile)] = profile;
      return this._setOptions(changes);
    }
  };


  /**
   * Get the matching results of a request
   * @param {{}} request The request to test
   * @returns {Promise<{profile: {}, results: {}[]}>} The last matched profile
   * and the matching details
   */

  Options.prototype.matchProfile = function(request) {
    var lastProfile, next, profile, result, results;
    if (!this._currentProfileName) {
      return Promise.resolve({
        profile: this._externalProfile,
        results: []
      });
    }
    results = [];
    profile = this._tempProfileActive ? this._tempProfile : OmegaPac.Profiles.byName(this._currentProfileName, this._options);
    while (profile) {
      lastProfile = profile;
      result = OmegaPac.Profiles.match(profile, request);
      if (result == null) {
        break;
      }
      results.push(result);
      if (Array.isArray(result)) {
        next = result[0];
      } else if (result.profileName) {
        next = OmegaPac.Profiles.nameAsKey(result.profileName);
      } else {
        break;
      }
      profile = OmegaPac.Profiles.byKey(next, this._options);
    }
    return Promise.resolve({
      profile: lastProfile,
      results: results
    });
  };


  /**
   * Notify Options that the proxy settings are set externally.
   * @param {{}} profile The external profile
   * @param {?{}} args Extra arguments
   * @param {boolean=false} args.noRevert If true, do not revert changes.
   * @param {boolean=false} args.internal If true, treat the profile change as
   * caused by the options itself instead of external reasons.
   * @returns {Promise} A promise which is fulfilled when the profile is set
   */

  Options.prototype.setExternalProfile = function(profile, args) {
    var p;
    if (this._options['-revertProxyChanges'] && !this._isSystem) {
      if (profile.name !== this._currentProfileName && this._currentProfileName) {
        if (!(args != null ? args.noRevert : void 0)) {
          this.applyProfile(this._revertToProfileName);
          this._revertToProfileName = null;
          return;
        } else {
          if (this._revertToProfileName == null) {
            this._revertToProfileName = this._currentProfileName;
          }
        }
      }
    }
    p = OmegaPac.Profiles.byName(profile.name, this._options);
    if (p) {
      if (args != null ? args.internal : void 0) {
        return this.applyProfile(p.name, {
          proxy: false
        });
      } else {
        return this.applyProfile(p.name, {
          proxy: false,
          system: this._isSystem,
          reason: 'external'
        });
      }
    } else {
      this._currentProfileName = null;
      this._externalProfile = profile;
      if (profile.color == null) {
        profile.color = '#49afcd';
      }
      this._state.set({
        'currentProfileName': '',
        'externalProfile': profile,
        'validResultProfiles': [],
        'currentProfileCanAddRule': false
      });
      this.currentProfileChanged('external');
    }
  };


  /**
   * Switch options syncing on and off.
   * @param {boolean} enabled Whether to enable syncing
   * @param {?{}} args Extra arguments
   * @param {boolean=false} args.force If true, overwrite options when conflict
   * @returns {Promise} A promise which is fulfilled when the syncing is switched
   */

  Options.prototype.setOptionsSync = function(enabled, args) {
    this.log.method('Options#setOptionsSync', this, arguments);
    if (this.sync == null) {
      return Promise.reject(new Error('Options syncing is unsupported.'));
    }
    return this._state.get({
      'syncOptions': ''
    }).then((function(_this) {
      return function(arg) {
        var syncOptions;
        syncOptions = arg.syncOptions;
        if (!enabled) {
          if (syncOptions === 'sync') {
            _this._state.set({
              'syncOptions': 'conflict'
            });
          }
          _this.sync.enabled = false;
          if (typeof _this._syncWatchStop === "function") {
            _this._syncWatchStop();
          }
          _this._syncWatchStop = null;
          return;
        }
        if (syncOptions === 'conflict') {
          if (!(args != null ? args.force : void 0)) {
            return Promise.reject(new Error('Syncing not enabled due to conflict. Retry with force to overwrite local options and enable syncing.'));
          }
        }
        if (syncOptions === 'sync') {
          return;
        }
        return _this._state.set({
          'syncOptions': 'sync'
        }).then(function() {
          if (syncOptions === 'conflict') {
            _this.sync.enabled = false;
            return _this._storage.remove().then(function() {
              _this.sync.enabled = true;
              return _this.init();
            });
          } else {
            _this.sync.enabled = true;
            if (typeof _this._syncWatchStop === "function") {
              _this._syncWatchStop();
            }
            _this.sync.requestPush(_this._options);
            _this._syncWatchStop = _this.sync.watchAndPull(_this._storage);
          }
        });
      };
    })(this));
  };


  /**
   * Clear the sync storage, resetting syncing state to pristine.
   * @returns {Promise} A promise which is fulfilled when the syncing is reset.
   */

  Options.prototype.resetOptionsSync = function() {
    this.log.method('Options#resetOptionsSync', this, arguments);
    if (this.sync == null) {
      return Promise.reject(new Error('Options syncing is unsupported.'));
    }
    this.sync.enabled = false;
    if (typeof this._syncWatchStop === "function") {
      this._syncWatchStop();
    }
    this._syncWatchStop = null;
    this._state.set({
      'syncOptions': 'conflict'
    });
    return this.sync.storage.remove().then((function(_this) {
      return function() {
        return _this._state.set({
          'syncOptions': 'pristine'
        });
      };
    })(this));
  };

  return Options;

})();

module.exports = Options;

export {};
