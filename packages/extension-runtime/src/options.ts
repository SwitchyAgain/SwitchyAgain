/* @module @switchyagain/extension-runtime/options */
declare const options: Record<string, unknown> | null | undefined;

import {Buffer} from 'buffer';
import {patch as patchJson} from 'jsondiffpatch';
import OmegaPacImpl from '@switchyagain/proxy-engine';
import defaultOptions from './default_options';
import Log from './log';
import Promise from './promise';
import Storage from './storage';
import type {
  RuntimePromise,
  LogLike,
  OmegaPacModule,
  OptionsData,
  OptionsSyncLike,
  ProfileLike,
  ProxyImplLike,
  StopWatching,
  StorageChanges,
  StorageLike,
  StorageValue,
  StorageWatchCallback
} from './types';

class ProfileNotExistError extends Error {
  profileName: string;

  constructor(profileName: string) {
    super("Profile " + profileName + " does not exist!");
    this.name = 'ProfileNotExistError';
    this.profileName = profileName;
    Object.setPrototypeOf(this, ProfileNotExistError.prototype);
  }
}

class NoOptionsError extends Error {
  constructor() {
    super();
    this.name = 'NoOptionsError';
    Object.setPrototypeOf(this, NoOptionsError.prototype);
  }
}

const OmegaPac = OmegaPacImpl as OmegaPacModule;

const attachedRuleListPrefix = '__ruleListOf_';
const hasProp = Object.prototype.hasOwnProperty;
const optionNumber = (value: unknown) => Number(value);
const supportedUiLocales = new Set(['en', 'zh-Hans', 'zh-Hant', 'es', 'ru', 'cs', 'fa']);
const supportedUiThemes = new Set(['light', 'dark', 'system']);
const defaultEnabledOption = (value: unknown): boolean => value !== false;

type ProfileScopeSettings = {
  container: boolean;
  tab: boolean;
  window: boolean;
};

type ProfileScopeAssignments = {
  containers: Record<string, string>;
  normalDefaultProfileName?: string;
  privateDefaultProfileName?: string;
};

function isRecordValue(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function normalizeProfileScopes(value: unknown): ProfileScopeSettings {
  const scopes = isRecordValue(value) ? value : {};
  return {
    tab: scopes.tab === true,
    container: scopes.container === true,
    window: scopes.window === true
  };
}

function normalizeProfileScopeAssignments(value: unknown): ProfileScopeAssignments {
  const rawAssignments = isRecordValue(value) ? value : {};
  const rawContainers = isRecordValue(rawAssignments.containers) ? rawAssignments.containers : {};
  const containers: Record<string, string> = {};
  for (const [key, profileName] of Object.entries(rawContainers)) {
    if (typeof key === 'string' && key && typeof profileName === 'string' && profileName) {
      containers[key] = profileName;
    }
  }
  const assignments: ProfileScopeAssignments = {containers};
  if (typeof rawAssignments.normalDefaultProfileName === 'string' && rawAssignments.normalDefaultProfileName) {
    assignments.normalDefaultProfileName = rawAssignments.normalDefaultProfileName;
  }
  if (typeof rawAssignments.privateDefaultProfileName === 'string' && rawAssignments.privateDefaultProfileName) {
    assignments.privateDefaultProfileName = rawAssignments.privateDefaultProfileName;
  }
  return assignments;
}

function profileScopeSettingsEqual(left: ProfileScopeSettings, right: unknown) {
  if (!isRecordValue(right)) {
    return false;
  }
  const validKeys = new Set(['tab', 'container', 'window']);
  return left.tab === right.tab &&
    left.container === right.container &&
    left.window === right.window &&
    Object.keys(right).every((key) => validKeys.has(key));
}

function profileScopeAssignmentsEqual(left: ProfileScopeAssignments, right: unknown) {
  if (!isRecordValue(right)) {
    return false;
  }
  return JSON.stringify(left) === JSON.stringify(right);
}

function replaceProfileScopeAssignmentRef(assignments: ProfileScopeAssignments, fromName: string, toName: string) {
  let changed = false;
  const next: ProfileScopeAssignments = {
    ...assignments,
    containers: {
      ...assignments.containers
    }
  };
  if (next.normalDefaultProfileName === fromName) {
    next.normalDefaultProfileName = toName;
    changed = true;
  }
  if (next.privateDefaultProfileName === fromName) {
    next.privateDefaultProfileName = toName;
    changed = true;
  }
  for (const [cookieStoreId, profileName] of Object.entries(next.containers)) {
    if (profileName === fromName) {
      next.containers[cookieStoreId] = toName;
      changed = true;
    }
  }
  return changed ? next : null;
}

function normalizeExplainUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new Error('URL is required.');
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return trimmed;
  }
  return `http://${trimmed}`;
}

function attachedRuleListOwnerName(name?: string): string | undefined {
  if (!name || name.indexOf(attachedRuleListPrefix) !== 0) {
    return undefined;
  }
  return name.slice(attachedRuleListPrefix.length) || undefined;
}

type LoadOptionsArgs = {
  retry?: number;
};

type SetOptionsArgs = {
  checkRevision?: boolean;
  persist?: boolean;
};

type ApplyProfileOptions = {
  proxy?: boolean;
  reason?: unknown;
  system?: boolean;
  update?: boolean;
};

type ExternalProfileArgs = {
  internal?: boolean;
  noRevert?: boolean;
};

type SetOptionsSyncArgs = {
  force?: boolean;
};

type BypassConditionLike = {
  conditionType?: string;
  pattern?: string;
};

function migrateLocalBypassList(profile: ProfileLike): boolean {
  if (profile.profileType !== 'FixedProfile' || !Array.isArray(profile.bypassList)) {
    return false;
  }
  const bypassList = profile.bypassList as BypassConditionLike[];
  const bypassPatterns = new Set(bypassList.map((condition) => {
    if (condition.conditionType === 'BypassCondition') {
      return OmegaPac.Conditions.str(condition).replace(/^Bypass:\s*/, '');
    }
    return condition.pattern;
  }));
  if (!bypassPatterns.has('<local>')) {
    return false;
  }
  let changed = false;
  for (const pattern of OmegaPac.Conditions.localHosts) {
    if (bypassPatterns.has(pattern)) {
      continue;
    }
    bypassList.push({
      conditionType: 'BypassCondition',
      pattern
    });
    changed = true;
  }
  return changed;
}

type AvailableProfile = {
  builtin?: boolean;
  color?: unknown;
  defaultProfileName?: unknown;
  desc?: string | null;
  hiddenInPopup?: boolean;
  name?: unknown;
  profileType?: unknown;
  validResultProfiles?: Array<string | undefined>;
};

type TempRule = {
  condition: {
    conditionType?: string;
    pattern?: string;
    [key: string]: unknown;
  };
  isTempRule?: boolean;
  profileName?: string | null;
  [key: string]: unknown;
};

function ensureProfileRules(profile: ProfileLike): TempRule[] {
  if (!Array.isArray(profile.rules)) {
    profile.rules = [];
  }
  return profile.rules as TempRule[];
}

type ExplainRequestArgs = {
  includeTempRules?: boolean;
  profileName?: string;
  request?: Record<string, unknown>;
  url?: string;
};

type ExplainProfile = {
  attachedToProfileName?: string;
  builtin?: boolean;
  color?: unknown;
  name?: string;
  profileType?: unknown;
  role?: string;
};

type ExplainStep = {
  auth?: boolean;
  condition?: string;
  isTempRule?: boolean;
  kind: string;
  pacResult?: string;
  profile?: ExplainProfile;
  proxy?: unknown;
  scheme?: string;
  source?: string;
  targetProfile?: ExplainProfile;
};

type ExplainFinal = {
  auth?: boolean;
  delegated?: boolean;
  kind: string;
  limited?: boolean;
  pacResult?: string;
  profile?: ExplainProfile;
  proxy?: unknown;
};

type RequestExplanation = {
  currentProfile?: ExplainProfile;
  errors: string[];
  final: ExplainFinal;
  finalProfile?: ExplainProfile;
  request: Record<string, unknown>;
  startProfile?: ExplainProfile;
  steps: ExplainStep[];
  tempRulesActive: boolean;
  warnings: string[];
};

class Options {
  static ProfileNotExistError = ProfileNotExistError;
  static NoOptionsError = NoOptionsError;

  _options: OptionsData = {};
  _storage: StorageLike;
  _state: StorageLike;
  _currentProfileName: string | null = null;
  _revertToProfileName: string | null = null;
  _watchingProfiles: Record<string, string> = {};
  _tempProfile: ProfileLike | null = null;
  _tempProfileActive = false;
  _tempProfileRules: Record<string, TempRule> = {};
  _tempProfileRulesByProfile: Record<string, TempRule[]> = {};
  _externalProfile: ProfileLike | null = null;
  _syncWatchStop: StopWatching | null = null;
  _watchStop: StopWatching | null = null;
  fallbackProfileName = 'system';
  _isSystem = false;
  debugStr = 'Options';
  log: LogLike = Log;
  sync: OptionsSyncLike | null = null;
  proxyImpl: ProxyImplLike | null = null;
  optionsLoaded: RuntimePromise<unknown> | null = null;
  ready: RuntimePromise<unknown> | null = null;

  /**
   * Transform options values (especially profiles) for syncing.
   * @param {{}} value The value to transform
   * @param {{}} key The key of the options
   * @returns {{}} The transformed value
   */
  static transformValueForSync(value: StorageValue, key: string): StorageValue {
    if (key[0] === '+') {
      const source = value as ProfileLike;
      if (OmegaPac.Profiles.updateUrl(source)) {
        const profile: ProfileLike = {};
        for (const k in source) {
          const v = source[k];
          if (k === 'lastUpdate' || k === 'ruleList' || k === 'pacScript') {
            continue;
          }
          profile[k] = v;
        }
        value = profile;
      }
    }
    return value;
  }

  /**
   * The entire set of options including profiles and other settings.
   * @typedef OmegaOptions
   * @type {object}
   */
  constructor(
    options?: OptionsData | null,
    _storage?: StorageLike | null,
    _state?: StorageLike | null,
    log?: LogLike | null,
    sync?: OptionsSyncLike | null,
    proxyImpl?: ProxyImplLike | null
  ) {
    this._storage = _storage ?? new Storage();
    this._state = _state ?? new Storage();
    this.log = log ?? Log;
    this.sync = sync ?? null;
    this.proxyImpl = proxyImpl ?? null;
    this._options = {};
    this._tempProfileRules = {};
    this._tempProfileRulesByProfile = {};
    if (options == null) {
      this.init();
    } else {
      this.ready = this._storage.remove()
        .then(() => this._storage.set(options))
        .then(() => this.init());
    }
  }
  /**
   * Attempt to load options from local and remote storage.
   * @param {?{}} args Extra arguments
   * @param {number=3} args.retry Number of retries before giving up.
   * @returns {Promise<OmegaOptions>} The loaded options
   */

  loadOptions(arg?: LoadOptionsArgs): RuntimePromise<unknown> {
    let loadRaw;
    let retry = (arg != null ? arg : {}).retry;
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
    if (typeof options !== "undefined" && options !== null) {
      loadRaw = Promise.resolve(options);
    } else if (!(this.sync != null && this.sync.enabled)) {
      if (this.sync == null) {
        this._state.set({
          'syncOptions': 'unsupported'
        });
      }
      loadRaw = this._storage.get(null);
    } else {
      const sync = this.sync;
      if (sync == null) {
        loadRaw = this._storage.get(null);
      } else {
      this._state.set({
        'syncOptions': 'sync'
      });
      this._syncWatchStop = sync.watchAndPull(this._storage);
      loadRaw = sync.copyTo(this._storage)
        .catch((error: unknown) => {
          if (!(error instanceof Storage.StorageUnavailableError)) {
            return Promise.reject(error);
          }
          console.error('Warning: Sync storage is not available in this ' + 'browser! Disabling options sync.');
          if (typeof this._syncWatchStop === "function") {
            this._syncWatchStop();
          }
          this._syncWatchStop = null;
          this.sync = null;
          return this._state.set({
            'syncOptions': 'unsupported'
          });
        })
        .then(() => this._storage.get(null));
      }
    }
    return this.optionsLoaded = loadRaw.then((loadedOptions: OptionsData) => {
      return this.upgrade(loadedOptions);
    }).then((arg1) => {
        const loadedOptions = arg1[0];
        const changes = arg1[1];
        return this._storage.apply({
          changes: changes
        }).then(() => loadedOptions);
    }).then((loadedOptions: OptionsData) => {
        this._options = loadedOptions;
        this._watchStop = this._watch();
        return this._state.get({
          'syncOptions': ''
        }).then((arg1) => {
          const syncOptions = arg1.syncOptions;
          if (syncOptions) {
            return;
          }
          const sync = this.sync;
          if (sync == null) {
            return loadedOptions;
          }
          this._state.set({
            'syncOptions': 'conflict'
          });
          return sync.storage.get('schemaVersion').then((arg2) => {
            const schemaVersion = arg2.schemaVersion;
            if (!schemaVersion) {
              return this._state.set({
                'syncOptions': 'pristine'
              });
            }
          });
        }).then(() => loadedOptions);
    }).catch((e: unknown) => {
        if (!(retry > 0)) {
          return Promise.reject(e);
        }
        const getFallbackOptions = Promise.resolve().then(() => {
          if (e instanceof NoOptionsError) {
            this._state.get({
              'firstRun': 'new',
              'web.switchGuide': 'showOnFirstUse'
            }).then((items) => {
              return this._state.set(items);
            });
            const sync = this.sync;
            if (sync == null) {
              return null;
            }
            return this._state.get({
              'syncOptions': ''
            }).then((arg1) => {
              const syncOptions = arg1.syncOptions;
              if (syncOptions === 'conflict') {
                return;
              }
              return sync.storage.get(null).then((options) => {
                if (!options['schemaVersion']) {
                  this._state.set({
                    'syncOptions': 'pristine'
                  });
                  return null;
                } else {
                  this._state.set({
                    'syncOptions': 'sync'
                  });
                  sync.enabled = true;
                  this.log.log('Options#loadOptions::fromSync', options);
                  return options;
                }
              }).catch((): null => {
                return null;
              });
            });
          } else {
            this.log.error(e instanceof Error ? e.stack : e);
            this._state.remove(['syncOptions']);
            return null;
          }
        });
        return getFallbackOptions.then((fallbackOptions) => {
          let prevEnabled: boolean | undefined;
          if (fallbackOptions == null) {
            fallbackOptions = this.parseOptions(this.getDefaultOptions());
          }
          if (this.sync != null) {
            prevEnabled = this.sync.enabled;
            this.sync.enabled = false;
          }
          return this._storage.remove().then(() => {
            return this._storage.set(fallbackOptions);
          }).then(() => {
            if (this.sync != null && prevEnabled != null) {
              this.sync.enabled = prevEnabled;
            }
            return this.loadOptions({
              retry: retry - 1
            });
          });
        });
    });
  }


  /**
   * Attempt to initialize (or reinitialize) options.
   * @returns {Promise<OmegaOptions>} A promise that is fulfilled on ready.
   */

  init(): RuntimePromise<unknown> {
    this.ready = this.loadOptions().then(() => {
        if (this._options['-startupProfileName']) {
          return this.applyProfile(this._options['-startupProfileName'] as string);
        } else {
          return this._state.get({
            'currentProfileName': this.fallbackProfileName,
            'isSystemProfile': false
          }).then((st) => {
            if (st['isSystemProfile']) {
              return this.applyProfile('system');
            } else {
              return this.applyProfile((st['currentProfileName'] || this.fallbackProfileName) as string);
            }
          });
        }
    }).catch((err: unknown) => {
        if (!(err instanceof ProfileNotExistError)) {
          this.log.error(err);
        }
        return this.applyProfile(this.fallbackProfileName);
    }).catch((err: unknown) => {
        return this.log.error(err);
    }).then(() => {
        return this.getAll();
    });
    this.ready.then(() => {
        if (this.sync != null && this.sync.enabled) {
          this.sync.requestPush(this._options);
        }
        const firstRunTask = this._state.get({
          'firstRun': ''
        }).then((arg) => {
          const firstRun = arg.firstRun;
          if (firstRun) {
            return this.onFirstRun(firstRun);
          }
        });
        if (optionNumber(this._options['-downloadInterval']) > 0) {
          return Promise.all([firstRunTask, this.updateProfile()]);
        }
        return firstRunTask;
    }).catch((err: unknown) => {
        return this.log.error('Post-initialization task failed:', err);
    });
    return this.ready;
  }

  toString(): string {
    return "<Options>";
  }


  /**
   * Return a localized, human-readable description of the given profile.
   * In base class, this method is not implemented and will always return null.
   * @param {?{}} profile The profile to print
   * @returns {string} Description of the profile with details
   */

  printProfile(profile: ProfileLike | null | undefined): string | null {
    return null;
  }


  /**
   * Upgrade options from previous versions.
   * For now, this method supports schemaVersion 1, 2, and 3. It upgrades older
   * options to version 3 (the latest version). Otherwise it rejects.
   * It is recommended for the derived classes to call super() two times in the
   * beginning and in the end of the implementation to check the schemaVersion
   * and to apply future upgrades, respectively.
   * Example: super(options).catch -> super(doCustomUpgrades(options), changes)
   * @param {?OmegaOptions} options The legacy options to upgrade
   * @param {{}={}} changes Previous pending changes to be applied. Default to
   * an empty dictionary. Please provide this argument when calling super().
   * @returns {Promise<[OmegaOptions, {}]>} The new options and the changes.
   */

  upgrade(options: OptionsData | null | undefined, changes?: StorageChanges): RuntimePromise<[OptionsData, StorageChanges]> {
    if (changes == null) {
      changes = {};
    }
    if (options == null) {
      return Promise.reject(new NoOptionsError());
    }
    let version = options != null ? options['schemaVersion'] : void 0;
    if (version === 1) {
      let autoDetectUsed = false;
      OmegaPac.Profiles.each(options, (_key, profile) => {
        if (!autoDetectUsed) {
          const refs = OmegaPac.Profiles.directReferenceSet(profile);
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
      OmegaPac.Profiles.each(options, (key, profile) => {
        if (migrateLocalBypassList(profile)) {
          OmegaPac.Profiles.updateRevision(profile);
          changes[key] = profile;
        }
      });
      version = changes['schemaVersion'] = options['schemaVersion'] = 3;
    }
    if (version === 3) {
      const uiLocale = this.normalizeUiLocale(options['-uiLocale']);
      if (options['-uiLocale'] !== uiLocale) {
        changes['-uiLocale'] = uiLocale;
        options['-uiLocale'] = uiLocale;
      }
      const uiTheme = this.normalizeUiTheme(options['-uiTheme']);
      if (options['-uiTheme'] !== uiTheme) {
        changes['-uiTheme'] = uiTheme;
        options['-uiTheme'] = uiTheme;
      }
      const profileScopes = normalizeProfileScopes(options['-profileScopes']);
      if (!profileScopeSettingsEqual(normalizeProfileScopes(options['-profileScopes']), options['-profileScopes'] as ProfileScopeSettings)) {
        changes['-profileScopes'] = profileScopes;
        options['-profileScopes'] = profileScopes;
      }
      const profileScopeAssignments = normalizeProfileScopeAssignments(options['-profileScopeAssignments']);
      if (!profileScopeAssignmentsEqual(profileScopeAssignments, options['-profileScopeAssignments'] as ProfileScopeAssignments)) {
        changes['-profileScopeAssignments'] = profileScopeAssignments;
        options['-profileScopeAssignments'] = profileScopeAssignments;
      }
      return Promise.resolve([options, changes]);
    } else {
      return Promise.reject(new Error("Invalid schemaVersion " + version + "!"));
    }
  }


  /**
   * Parse options in various formats (including JSON & base64).
   * @param {OmegaOptions|string} options The options to parse
   * @returns {Promise<OmegaOptions>} The parsed options.
   */

  parseOptions(options: OptionsData | string | null | undefined): OptionsData {
    if (typeof options === 'string') {
      if (options[0] !== '{') {
        try {
          options = Buffer.from(options, 'base64').toString('utf8');
        } catch (error) {
          options = null;
        }
      }
      try {
        options = JSON.parse(options as string) as OptionsData;
      } catch (error) {
        options = undefined;
      }
    }
    if (!options) {
      throw new Error('Invalid options!');
    }
    return options as OptionsData;
  }


  /**
   * Reset the options to the given options or initial options.
   * @param {?OmegaOptions} options The options to set. Defaults to initial.
   * @returns {Promise<OmegaOptions>} The options just applied
   */

  reset(options?: OptionsData | string | null): RuntimePromise<unknown> {
    this.log.method('Options#reset', this, arguments);
    const preserveProfileName = options != null ? this._currentProfileName : null;
    if (options == null) {
      options = this.getDefaultOptions();
    }
    return this.upgrade(this.parseOptions(options)).then((arg) => {
        const opt = arg[0];
        if (this.sync != null) {
          this.sync.enabled = false;
        }
        this._state.remove(['syncOptions']);
        return this._storage.remove().then(() => {
          return this._storage.set(opt);
        }).then(() => {
          if (preserveProfileName && !opt['-startupProfileName'] && OmegaPac.Profiles.byName(preserveProfileName, opt)) {
            this._state.set({
              'currentProfileName': preserveProfileName,
              'isSystemProfile': preserveProfileName === 'system'
            });
          }
          return this.init();
        });
    });
  }


  /**
   * Called on the first initialization of options.
   * @param {reason} reason The value of 'firstRun' in state.
   */

  onFirstRun(reason: unknown): unknown {
    return null;
  }


  /**
   * Return the default options used initially and on resets.
   * @returns {?OmegaOptions} The default options.
   */

  getDefaultOptions(): OptionsData {
    return {
      ...defaultOptions(),
      '-uiLocale': this.defaultUiLocale()
    };
  }

  defaultUiLocale(): string {
    return 'en';
  }

  normalizeUiLocale(value: unknown): string {
    if (typeof value === 'string') {
      const normalized = value.replace(/_/g, '-');
      if (supportedUiLocales.has(normalized)) {
        return normalized;
      }
      const lower = normalized.toLowerCase();
      if (lower === 'zh' || lower === 'zh-cn' || lower === 'zh-sg' || lower === 'zh-hans') {
        return 'zh-Hans';
      }
      if (lower === 'zh-tw' || lower === 'zh-hk' || lower === 'zh-mo' || lower === 'zh-hant') {
        return 'zh-Hant';
      }
    }
    return this.defaultUiLocale();
  }

  defaultUiTheme(): string {
    return 'light';
  }

  normalizeUiTheme(value: unknown): string {
    return typeof value === 'string' && supportedUiThemes.has(value) ? value : this.defaultUiTheme();
  }


  /**
   * Return all options.
   * @returns {?OmegaOptions} The options.
   */

  getAll(): OptionsData | null {
    return this._options;
  }


  /**
   * Get profile by name.
   * @returns {?{}} The profile, or undefined if no such profile.
   */

  profile(name: string | ProfileLike): ProfileLike | undefined {
    return OmegaPac.Profiles.byName(name, this._options);
  }


  /**
   * Apply the patch to the current options.
   * @param {jsondiffpatch} patch The patch to apply
   * @returns {Promise<OmegaOptions>} The updated options
   */

  patch(patch: Record<string, any> | null | undefined): RuntimePromise<unknown> | void {
    if (!patch) {
      return;
    }
    this.log.method('Options#patch', this, arguments);
    this._options = patchJson(this._options, patch) as OptionsData;
    const changes: StorageChanges = {};
    for (const key in patch) {
      if (!hasProp.call(patch, key)) continue;
      const delta = patch[key];
      if (delta.length === 3 && delta[1] === 0 && delta[2] === 0) {
        changes[key] = void 0;
      } else {
        changes[key] = this._options[key];
      }
    }
    return this._setOptions(changes);
  }

  _setOptions = (changes: StorageChanges, args?: SetOptionsArgs): RuntimePromise<unknown> => {
    const removed: string[] = [];
    const checkRev = (args != null && args.checkRevision != null) ? args.checkRevision : false;
    let profilesChanged = false;
    let currentProfileAffected: false | 'removed' | 'changed' = false;
    for (const key in changes) {
      if (!hasProp.call(changes, key)) continue;
      const value = changes[key];
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
            const result = OmegaPac.Revision.compare((this._options[key] as ProfileLike).revision, (value as ProfileLike).revision);
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
      if (!currentProfileAffected && (key === '-profileScopes' || key === '-profileScopeAssignments')) {
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
    if ((args != null && args.persist != null) ? args.persist : true) {
      if (this.sync != null && this.sync.enabled) {
        this.sync.requestPush(changes);
      }
      for (const key of removed) {
        delete changes[key];
      }
      return this._storage.set(changes).then(() => {
        this._storage.remove(removed);
        return this._options;
      });
    }
    return Promise.resolve(this._options);
  };

  _watch(): StopWatching {
    const handler = (changes?: StorageChanges): unknown => {
        if (changes) {
          this._setOptions(changes, {
            checkRevision: true,
            persist: false
          });
        } else {
          changes = this._options;
        }
        const refresh = changes['-refreshOnProfileChange'];
        if (refresh != null) {
          this._state.set({
            'refreshOnProfileChange': refresh
          });
        }
        if ((changes['-uiLocale'] != null) || changes === this._options) {
          this._state.set({
            'uiLocale': this._options['-uiLocale']
          });
        }
        if ((changes['-uiTheme'] != null) || changes === this._options) {
          this._state.set({
            'uiTheme': this._options['-uiTheme']
          });
        }
        if (hasProp.call(changes, '-showPopupAddCondition') || changes === this._options) {
          this._state.set({
            'showPopupAddCondition': defaultEnabledOption(this._options['-showPopupAddCondition'])
          });
        }
        if (hasProp.call(changes, '-showPopupAddTempRule') || changes === this._options) {
          this._state.set({
            'showPopupAddTempRule': defaultEnabledOption(this._options['-showPopupAddTempRule'])
          });
        }
        if (Object.prototype.hasOwnProperty.call(changes, '-showExternalProfile')) {
          let showExternal = changes['-showExternalProfile'];
          if (showExternal == null) {
            showExternal = true;
            this._setOptions({
              '-showExternalProfile': true
            }, {
              persist: true
            });
          }
          this._state.set({
            'showExternalProfile': showExternal
          });
        }
        let quickSwitchProfiles = changes['-quickSwitchProfiles'] as string[] | undefined;
        quickSwitchProfiles = this._cleanUpQuickSwitchProfiles(quickSwitchProfiles);
        if ((changes['-enableQuickSwitch'] != null) || (quickSwitchProfiles != null)) {
          this.reloadQuickSwitch();
        }
        if (changes['-downloadInterval'] != null) {
          this.schedule('updateProfile', this._options['-downloadInterval'], () => {
            return this.updateProfile();
          });
        }
        if ((changes['-monitorWebRequests'] != null) || changes === this._options) {
          let monitorWebRequests = this._options['-monitorWebRequests'];
          if (monitorWebRequests == null) {
            monitorWebRequests = true;
            this._setOptions({
              '-monitorWebRequests': true
            }, {
              persist: true
            });
          }
          return this.setMonitorWebRequests(monitorWebRequests);
        }
    };
    handler();
    return this._storage.watch(null, handler);
  }

  _cleanUpQuickSwitchProfiles(quickSwitchProfiles?: string[] | null): string[] | undefined {
    if (quickSwitchProfiles == null) {
      return;
    }
    const seenQuickSwitchProfile: Record<string, boolean> = {};
    const validQuickSwitchProfiles = quickSwitchProfiles.filter((name: string) => {
        if (!name) {
          return false;
        }
        const key = OmegaPac.Profiles.nameAsKey(name);
        if (seenQuickSwitchProfile[key]) {
          return false;
        }
        if (!OmegaPac.Profiles.byName(name, this._options)) {
          return false;
        }
        seenQuickSwitchProfile[key] = true;
        return true;
    });
    if (validQuickSwitchProfiles.length !== quickSwitchProfiles.length) {
      this._setOptions({
        '-quickSwitchProfiles': validQuickSwitchProfiles
      }, {
        persist: true
      });
    }
    return validQuickSwitchProfiles;
  }


  /**
   * Reload the quick switch according to settings.
   * @returns {Promise} A promise which is fulfilled when the quick switch is set
   */

  reloadQuickSwitch() {
    const profiles = Array.isArray(this._options['-quickSwitchProfiles'])
      ? this._options['-quickSwitchProfiles'] as string[]
      : [];
    const quickSwitchProfiles = profiles.length >= 2 ? profiles : null;
    if (this._options['-enableQuickSwitch']) {
      return this.setQuickSwitch(quickSwitchProfiles, !!quickSwitchProfiles);
    } else {
      return this.setQuickSwitch(null, !!quickSwitchProfiles);
    }
  }

  /**
   * Apply the settings related to web request monitoring.
   * In base class, this method is not implemented and will not do anything.
   * @param {boolean} enabled Whether network shall be monitored or not
   * @returns {Promise} A promise which is fulfilled when the settings apply
   */

  setMonitorWebRequests(enabled?: unknown): RuntimePromise<void> {
    return Promise.resolve();
  }


  /**
   * @callback watchCallback
   * @param {Object.<string, {}>} changes A map from keys to values.
   */


  /**
   * Watch for any changes to the options
   * @param {watchCallback} callback Called everytime the value of a key changes
   * @returns {function} Calling the returned function will stop watching.
   */

  watch(callback: StorageWatchCallback): StopWatching {
    return this._storage.watch(null, callback);
  }

  _profileNotFound(name: string): ProfileLike {
    this.log.error("Profile " + name + " not found! Things may go very, very wrong.");
    return OmegaPac.Profiles.create({
      name: name,
      profileType: 'VirtualProfile',
      defaultProfileName: 'direct'
    });
  }


  /**
   * Get PAC script for profile.
   * @param {?string|Object} profile The name of the profile, or the profile.
   * @param {bool=false} compress Compress the script if true.
   * @returns {string} The compiled
  */

  pacForProfile(profile: string | ProfileLike, compress?: boolean): RuntimePromise<string> {
    if (compress == null) {
      compress = false;
    }
    let ast = OmegaPac.PacGenerator.script(this._options, profile, {
      profileNotFound: this._profileNotFound.bind(this)
    });
    if (compress) {
      ast = OmegaPac.PacGenerator.compress(ast);
    }
    return Promise.resolve(OmegaPac.PacGenerator.ascii(ast.print_to_string()));
  }

  _setAvailableProfiles(): RuntimePromise<unknown> {
    const profile = this._currentProfileName ? this.currentProfile() : null;
    const profiles: Record<string, AvailableProfile> = {};
    const currentIncludable = profile && OmegaPac.Profiles.isIncludable(profile);
    let allReferenceSet: Record<string, string> | null = null;
    let results: string[] | null = null;
    if (!profile || !OmegaPac.Profiles.isInclusive(profile)) {
      results = [];
    }
    OmegaPac.Profiles.each(this._options, (key, p) => {
        profiles[key] = {
          name: p.name,
          profileType: p.profileType,
          color: p.color,
          desc: this.printProfile(p),
          hiddenInPopup: p.hiddenInPopup ? true : void 0,
          builtin: p.builtin ? true : void 0
        };
        if (p.profileType === 'VirtualProfile') {
          profiles[key].defaultProfileName = p.defaultProfileName;
          if (allReferenceSet == null) {
            allReferenceSet = profile ? OmegaPac.Profiles.allReferenceSet(profile, this._options, {
              profileNotFound: this._profileNotFound.bind(this)
            }) : {};
          }
          if (allReferenceSet[key]) {
            profiles[key].validResultProfiles = OmegaPac.Profiles.validResultProfilesFor(p, this._options).map((result) => {
              return result.name;
            });
          }
        }
        if (currentIncludable && OmegaPac.Profiles.isIncludable(p)) {
          return results != null && p.name ? results.push(p.name) : void 0;
        }
    });
    if (profile && OmegaPac.Profiles.isInclusive(profile)) {
      const resultProfiles = OmegaPac.Profiles.validResultProfilesFor(profile, this._options);
      results = resultProfiles
        .map((profile) => profile.name)
        .filter((name): name is string => typeof name === 'string');
    }
    return this._state.set({
      'availableProfiles': profiles,
      'validResultProfiles': results
    });
  }


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

  applyProfile(name: string | null | undefined, options?: ApplyProfileOptions): RuntimePromise<unknown> {
    this.log.method('Options#applyProfile', this, arguments);
    const profileName = name || this.fallbackProfileName;
    const profile = OmegaPac.Profiles.byName(profileName, this._options);
    if (!profile) {
      return Promise.reject(new ProfileNotExistError(profileName));
    }
    this._currentProfileName = profile.name || profileName;
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
    const proxyImpl = this.proxyImpl;
    if (proxyImpl == null) {
      return Promise.resolve();
    }
    this._tempProfileActive = false;
    let applyProxy: RuntimePromise<unknown>;
    if ((this._tempProfile != null) && OmegaPac.Profiles.isIncludable(profile)) {
      const tempProfile = this._tempProfile;
      this._tempProfileActive = true;
      if (tempProfile.defaultProfileName !== profile.name) {
        tempProfile.defaultProfileName = profile.name;
        tempProfile.color = profile.color;
        OmegaPac.Profiles.updateRevision(tempProfile);
      }
      const tempProfileRules = ensureProfileRules(tempProfile);
      const removedKeys: string[] = [];
      const ref = this._tempProfileRulesByProfile;
      for (const key in ref) {
        if (!hasProp.call(ref, key)) continue;
        const list = ref[key];
        if (!OmegaPac.Profiles.byKey(key, this._options)) {
          removedKeys.push(key);
          for (const rule of list) {
            rule.profileName = null;
            tempProfileRules.splice(tempProfileRules.indexOf(rule), 1);
          }
        }
      }
      if (removedKeys.length > 0) {
        for (const key of removedKeys) {
          delete this._tempProfileRulesByProfile[key];
        }
        OmegaPac.Profiles.updateRevision(tempProfile);
      }
      this._watchingProfiles = OmegaPac.Profiles.allReferenceSet(tempProfile, this._options, {
        profileNotFound: this._profileNotFound.bind(this)
      });
      applyProxy = proxyImpl.applyProfile(tempProfile, profile, this._options);
    } else {
      applyProxy = proxyImpl.applyProfile(profile, profile, this._options);
    }
    if ((options != null) && options.update === false) {
      return applyProxy;
    }
    applyProxy.then(() => {
        if (!(optionNumber(this._options['-downloadInterval']) > 0)) {
          return;
        }
        if (this._currentProfileName !== profile.name) {
          return;
        }
        const updateProfiles = [];
        for (const key in this._watchingProfiles) {
          const name = this._watchingProfiles[key];
          updateProfiles.push(name);
        }
        if (updateProfiles.length > 0) {
          return this.updateProfile(updateProfiles);
        }
    }).catch((error: unknown) => {
        return this.log.error('Profile update after apply failed:', error);
    });
    return applyProxy;
  }


  /**
   * Get the current applied profile.
   * @returns {{}} The current profile
   */

  currentProfile(): ProfileLike | null | undefined {
    if (this._currentProfileName) {
      return OmegaPac.Profiles.byName(this._currentProfileName, this._options);
    } else {
      return this._externalProfile;
    }
  }


  /**
   * Return true if in system mode.
   * @returns {boolean} True if system mode is activated
   */

  isSystem(): boolean {
    return this._isSystem;
  }


  /**
   * Called when current profile has changed.
   * In base class, this method is not implemented and will not do anything.
   */

  currentProfileChanged(reason?: unknown): unknown {
    return null;
  }


  /**
   * Set or disable the quick switch profiles.
   * In base class, this method is not implemented and will not do anything.
   * @param {string[]|null} quickSwitch The profile names, or null to disable
   * @param {boolean} canEnable Whether user can enable quick switch or not.
   * @returns {Promise} A promise which is fulfilled when the quick switch is set
   */

  setQuickSwitch(quickSwitch: string[] | null, canEnable: boolean): RuntimePromise<void> {
    return Promise.resolve();
  }


  /**
   * Schedule a task that runs every periodInMinutes.
   * In base class, this method is not implemented and will not do anything.
   * @param {string} name The name of the schedule. If there is a previous
   * schedule with the same name, it will be replaced by the new one.
   * @param {number} periodInMinutes The interval of the schedule
   * @param {function} callback The callback to call when the task runs
   * @returns {Promise} A promise which is fulfilled when the schedule is set
   */

  schedule(name: string, periodInMinutes: unknown, callback: () => unknown): RuntimePromise<void> {
    return Promise.resolve();
  }


  /**
   * Return true if the match result of current profile does not change with URLs
   * @returns {bool} Whether @match always return the same result for requests
  */

  isCurrentProfileStatic(): boolean {
    if (!this._currentProfileName) {
      return true;
    }
    if (this._tempProfileActive) {
      return false;
    }
    const currentProfile = this.currentProfile();
    if (!currentProfile) {
      return true;
    }
    if (OmegaPac.Profiles.isInclusive(currentProfile)) {
      return false;
    }
    return true;
  }


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

  updateProfile(name?: string | string[] | null, opt_bypass_cache?: boolean): RuntimePromise<Record<string, unknown>> {
    this.log.method('Options#updateProfile', this, arguments);
    const results: Record<string, RuntimePromise<unknown>> = {};
    OmegaPac.Profiles.each(this._options, (key, profile) => {
        if (name != null) {
          if (Array.isArray(name)) {
            if (!profile.name || !(name.indexOf(profile.name) >= 0)) {
              return;
            }
          } else {
            if (profile.name !== name) {
              return;
            }
          }
        }
        const url = OmegaPac.Profiles.updateUrl(profile);
        if (url) {
          const type_hints = OmegaPac.Profiles.updateContentTypeHints(profile);
          const fetchResult = this.fetchUrl(url, opt_bypass_cache, type_hints);
          return results[key] = fetchResult.then((data) => {
            if (!data) {
              return profile;
            }
            const updatedProfile = OmegaPac.Profiles.byKey(key, this._options);
            if (!updatedProfile) {
              return profile;
            }
            updatedProfile.lastUpdate = new Date().toISOString();
            if (OmegaPac.Profiles.update(updatedProfile, data)) {
              OmegaPac.Profiles.dropCache(updatedProfile);
              const changes: StorageChanges = {};
              changes[key] = updatedProfile;
              return this._setOptions(changes).then(() => updatedProfile);
            } else {
              return updatedProfile;
            }
          }).catch((reason: unknown) => {
            if (reason instanceof Error) {
              return reason;
            } else {
              return new Error(String(reason));
            }
          });
        }
    });
    const keys = Object.keys(results);
    return Promise.all(keys.map((key) => results[key])).then((values) => {
      const resolved: Record<string, unknown> = {};
      for (let i = 0; i < keys.length; i++) {
        resolved[keys[i]] = values[i];
      }
      return resolved;
    });
  }


  /**
   * Make an HTTP GET request to fetch the content of the url.
   * In base class, this method is not implemented and will always reject.
   * @param {string} url The name of the profiles,
   * @param {?bool} opt_bypass_cache Do not read from the cache if true
   * @param {?string} opt_type_hints MIME type hints for downloaded content.
   * @returns {Promise<String>} The text content fetched from the url
   */

  fetchUrl(url: string, opt_bypass_cache?: boolean, opt_type_hints?: string[]): RuntimePromise<string> {
    return Promise.reject(new Error('not implemented'));
  }

  _replaceRefChanges(fromName: string, toName: string, changes?: StorageChanges): StorageChanges {
    if (changes == null) {
      changes = {};
    }
    OmegaPac.Profiles.each(this._options, (_key, p) => {
      if (p.name === fromName || p.name === toName) {
        return;
      }
      if (OmegaPac.Profiles.replaceRef(p, fromName, toName)) {
        OmegaPac.Profiles.updateRevision(p);
        changes[OmegaPac.Profiles.nameAsKey(p)] = p;
      }
    });
    if (this._options['-startupProfileName'] === fromName) {
      changes['-startupProfileName'] = toName;
    }
    const nextProfileScopeAssignments = replaceProfileScopeAssignmentRef(
      normalizeProfileScopeAssignments(this._options['-profileScopeAssignments']),
      fromName,
      toName
    );
    if (nextProfileScopeAssignments) {
      changes['-profileScopeAssignments'] = nextProfileScopeAssignments;
    }
    const quickSwitch = Array.isArray(this._options['-quickSwitchProfiles'])
      ? this._options['-quickSwitchProfiles'] as string[]
      : [];
    if (quickSwitch.length > 0 && quickSwitch.indexOf(toName) < 0) {
      for (let i = 0; i < quickSwitch.length; i++) {
        if (quickSwitch[i] === fromName) {
          quickSwitch[i] = toName;
          changes['-quickSwitchProfiles'] = quickSwitch;
        }
      }
    }
    return changes;
  }


  /**
   * Replace all references of profile fromName to toName.
   * @param {String} fromName The original profile name
   * @param {String} toname The target profile name
   * @returns {Promise<OmegaOptions>} The updated options
  */

  replaceRef(fromName: string, toName: string): RuntimePromise<unknown> {
    this.log.method('Options#replaceRef', this, arguments);
    const profile = OmegaPac.Profiles.byName(fromName, this._options);
    if (!profile) {
      return Promise.reject(new ProfileNotExistError(fromName));
    }
    const changes = this._replaceRefChanges(fromName, toName);
    for (const key in changes) {
      if (!hasProp.call(changes, key)) continue;
      const value = changes[key];
      this._options[key] = value;
    }
    const fromKey = OmegaPac.Profiles.nameAsKey(fromName);
    if (this._watchingProfiles[fromKey]) {
      if (this._currentProfileName === fromName) {
        this._currentProfileName = toName;
      }
      this.applyProfile(this._currentProfileName);
    }
    return this._setOptions(changes);
  }


  /**
   * Rename a profile and update references and options
   * @param {String} fromName The original profile name
   * @param {String} toname The target profile name
   * @returns {Promise<OmegaOptions>} The updated options
  */

  renameProfile(fromName: string, toName: string): RuntimePromise<unknown> {
    this.log.method('Options#renameProfile', this, arguments);
    if (OmegaPac.Profiles.byName(toName, this._options)) {
      return Promise.reject(new Error("Target name " + name + " already taken!"));
    }
    const profile = OmegaPac.Profiles.byName(fromName, this._options);
    if (!profile) {
      return Promise.reject(new ProfileNotExistError(fromName));
    }
    profile.name = toName;
    const changes: StorageChanges = {};
    changes[OmegaPac.Profiles.nameAsKey(profile)] = profile;
    this._replaceRefChanges(fromName, toName, changes);
    for (const key in changes) {
      if (!hasProp.call(changes, key)) continue;
      const value = changes[key];
      this._options[key] = value;
    }
    const fromKey = OmegaPac.Profiles.nameAsKey(fromName);
    changes[fromKey] = void 0;
    delete this._options[fromKey];
    if (this._watchingProfiles[fromKey]) {
      if (this._currentProfileName === fromName) {
        this._currentProfileName = toName;
      }
      this.applyProfile(this._currentProfileName);
    }
    return this._setOptions(changes);
  }


  /**
   * Add a temp rule.
   * @param {String} domain The domain for the temp rule.
   * @param {String} profileName The profile to apply for the domain.
   * @returns {Promise} A promise which is fulfilled when the rule is applied.
  */

  addTempRule(domain: string, profileName: string): RuntimePromise<unknown> {
    this.log.method('Options#addTempRule', this, arguments);
    if (!this._currentProfileName) {
      return Promise.resolve();
    }
    const profile = OmegaPac.Profiles.byName(profileName, this._options);
    if (!profile) {
      return Promise.reject(new ProfileNotExistError(profileName));
    }
    if (this._tempProfile == null) {
      this._tempProfile = OmegaPac.Profiles.create('', 'SwitchProfile');
      const currentProfile = this.currentProfile();
      if (!currentProfile) {
        return Promise.reject(new ProfileNotExistError(this._currentProfileName));
      }
      this._tempProfile.color = currentProfile.color;
      this._tempProfile.defaultProfileName = currentProfile.name;
    }
    const tempProfile = this._tempProfile;
    const tempProfileRules = ensureProfileRules(tempProfile);
    let changed = false;
    let rule = this._tempProfileRules[domain];
    if (rule && rule.profileName) {
      if (rule.profileName !== profileName) {
        const key = OmegaPac.Profiles.nameAsKey(rule.profileName);
        const list = this._tempProfileRulesByProfile[key];
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
      tempProfileRules.push(rule);
      this._tempProfileRules[domain] = rule;
      changed = true;
    }
    const key = OmegaPac.Profiles.nameAsKey(profileName);
    let rulesByProfile = this._tempProfileRulesByProfile[key];
    if (rulesByProfile == null) {
      rulesByProfile = this._tempProfileRulesByProfile[key] = [];
    }
    rulesByProfile.push(rule);
    if (changed) {
      OmegaPac.Profiles.updateRevision(tempProfile);
      return this.applyProfile(this._currentProfileName);
    } else {
      return Promise.resolve();
    }
  }


  /**
   * Find a temp rule by domain.
   * @param {String} domain The domain of the temp rule.
   * @returns {Promise<?String>} The profile name for the domain, or null if such
   * rule does not exist.
  */

  queryTempRule(domain: string): string | null {
    const rule = this._tempProfileRules[domain];
    if (rule) {
      if (rule.profileName) {
        return rule.profileName;
      } else {
        delete this._tempProfileRules[domain];
      }
    }
    return null;
  }


  /**
   * Add a condition to the current active switch profile.
   * @param {Object.<String,{}>} cond The condition to add
   * @param {string>} profileName The name of the result profile of the rule.
   * @returns {Promise} A promise which is fulfilled when the condition is saved.
  */

  addCondition(condition: Record<string, unknown> | Array<Record<string, unknown>>, profileName: string, addToBottom?: boolean): RuntimePromise<unknown> {
    this.log.method('Options#addCondition', this, arguments);
    if (!this._currentProfileName) {
      return Promise.resolve();
    }
    const profile = OmegaPac.Profiles.byName(this._currentProfileName, this._options);
    if (!profile || profile.rules == null) {
      return Promise.reject(new Error("Cannot add condition to Profile " + (profile != null ? profile.name : this._currentProfileName) + " (" + (profile != null ? profile.profileType : 'UnknownProfile') + ")"));
    }
    const rules = ensureProfileRules(profile);
    const target = OmegaPac.Profiles.byName(profileName, this._options);
    if (target == null) {
      return Promise.reject(new ProfileNotExistError(profileName));
    }
    if (!Array.isArray(condition)) {
      condition = [condition];
    }
    for (const cond of condition) {
      const tag = OmegaPac.Conditions.tag(cond);
      for (let i = 0; i < rules.length; i++) {
        const existingCondition = rules[i].condition as Record<string, unknown>;
        if (OmegaPac.Conditions.tag(existingCondition) === tag) {
          rules.splice(i, 1);
          break;
        }
      }
      if (addToBottom || this._options['-addConditionsToBottom']) {
        rules.push({
          condition: cond,
          profileName: profileName
        });
      } else {
        rules.unshift({
          condition: cond,
          profileName: profileName
        });
      }
    }
    OmegaPac.Profiles.updateRevision(profile);
    const changes: StorageChanges = {};
    changes[OmegaPac.Profiles.nameAsKey(profile)] = profile;
    return this._setOptions(changes);
  }


  /**
   * Set the defaultProfileName of the profile.
   * @param {string>} profileName The name of the profile to modify.
   * @param {string>} defaultProfileName The defaultProfileName to set.
   * @returns {Promise} A promise which is fulfilled when the profile is saved.
  */

  setDefaultProfile(profileName: string, defaultProfileName: string): RuntimePromise<unknown> {
    this.log.method('Options#setDefaultProfile', this, arguments);
    const profile = OmegaPac.Profiles.byName(profileName, this._options);
    if (profile == null) {
      return Promise.reject(new ProfileNotExistError(profileName));
    } else if (profile.defaultProfileName == null) {
      return Promise.reject(new Error(("Profile " + this.profile.name + " ") + "(@{profile.type}) does not have defaultProfileName!"));
    }
    const target = OmegaPac.Profiles.byName(defaultProfileName, this._options);
    if (target == null) {
      return Promise.reject(new ProfileNotExistError(defaultProfileName));
    }
    profile.defaultProfileName = defaultProfileName;
    OmegaPac.Profiles.updateRevision(profile);
    const changes: StorageChanges = {};
    changes[OmegaPac.Profiles.nameAsKey(profile)] = profile;
    return this._setOptions(changes);
  }


  /**
   * Add a profile to the options
   * @param {{}} profile The profile to create
   * @returns {Promise<{}>} The saved profile
  */

  addProfile(profile: ProfileLike): RuntimePromise<unknown> {
    this.log.method('Options#addProfile', this, arguments);
    if (!profile.name) {
      return Promise.reject(new Error('Profile name is required!'));
    }
    if (OmegaPac.Profiles.byName(profile.name, this._options)) {
      return Promise.reject(new Error("Target name " + profile.name + " already taken!"));
    } else {
      const changes: StorageChanges = {};
      changes[OmegaPac.Profiles.nameAsKey(profile)] = profile;
      return this._setOptions(changes);
    }
  }

  _profileForExplanation(profile?: ProfileLike | null, fallbackName?: string): ExplainProfile | undefined {
    if (!profile) {
      return undefined;
    }
    const name = typeof profile.name === 'string' && profile.name ? profile.name : fallbackName;
    const profileInfo: ExplainProfile = {
      builtin: profile.builtin,
      color: profile.color,
      name,
      profileType: profile.profileType
    };
    const attachedToProfileName = attachedRuleListOwnerName(name);
    if (attachedToProfileName && profile.profileType === 'RuleListProfile') {
      profileInfo.attachedToProfileName = attachedToProfileName;
      profileInfo.role = 'attachedRuleList';
    }
    return profileInfo;
  }

  _conditionForExplanation(source: unknown): string | undefined {
    if (source == null) {
      return undefined;
    }
    const condition = isRecordValue(source) && isRecordValue(source.condition)
      ? source.condition
      : source;
    if (isRecordValue(condition)) {
      try {
        return OmegaPac.Conditions.str(condition);
      } catch (_error) {
        if (condition.pattern != null) {
          return String(condition.pattern);
        }
      }
    }
    if (typeof condition === 'string') {
      return condition;
    }
    return String(condition);
  }

  _requestForExplanation(input?: string | ExplainRequestArgs): Record<string, unknown> {
    const requestInput = typeof input === 'string' ? {url: input} : input || {};
    const request = requestInput.request ? {...requestInput.request} : {};
    const url = request.url != null
      ? normalizeExplainUrl(String(request.url))
      : requestInput.url != null
        ? normalizeExplainUrl(String(requestInput.url))
        : '';
    if (!url) {
      throw new Error('URL is required.');
    }
    const normalizedRequest = OmegaPac.Conditions.requestFromUrl(url);
    return {
      ...normalizedRequest,
      ...request,
      url
    };
  }

  _finalForProfile(profile?: ProfileLike | null): ExplainFinal {
    const profileInfo = this._profileForExplanation(profile);
    switch (profile?.profileType) {
      case 'SystemProfile':
        return {
          kind: 'system',
          profile: profileInfo,
          delegated: true
        };
      case 'DirectProfile':
        return {
          kind: 'direct',
          profile: profileInfo,
          pacResult: OmegaPac.Profiles.pacResult()
        };
      case 'PacProfile':
      case 'AutoDetectProfile':
        return {
          kind: 'pac',
          profile: profileInfo,
          delegated: true,
          limited: true
        };
      default:
        return {
          kind: 'profile',
          profile: profileInfo
        };
    }
  }

  _explainFromProfile(
    startProfile: ProfileLike | null | undefined,
    request: Record<string, unknown>,
    tempRulesActive: boolean,
    currentProfile?: ProfileLike | null
  ): RequestExplanation {
    const steps: ExplainStep[] = [];
    const warnings: string[] = [];
    let profile = startProfile;
    let lastProfile = startProfile;
    let final: ExplainFinal | null = null;
    let guard = 0;

    while (profile) {
      if (guard++ > 30) {
        warnings.push('tooManyProfileHops');
        break;
      }
      lastProfile = profile;
      const result = OmegaPac.Profiles.match(profile, request);
      if (result == null) {
        break;
      }

      if (Array.isArray(result)) {
        const resultValue = result[0];
        if (typeof resultValue === 'string' && resultValue.charAt(0) === '+') {
          const targetProfile = OmegaPac.Profiles.byKey(resultValue, this._options);
          steps.push({
            kind: result[1] == null ? 'default' : 'profile',
            profile: this._profileForExplanation(profile, tempRulesActive && profile === this._tempProfile ? '__temporary' : undefined),
            targetProfile: this._profileForExplanation(targetProfile, resultValue.slice(1)),
            condition: this._conditionForExplanation(result[1])
          });
          if (!targetProfile) {
            warnings.push('targetProfileNotFound');
            final = {
              kind: 'missingProfile',
              profile: {
                name: resultValue.slice(1)
              }
            };
            break;
          }
          profile = targetProfile;
          continue;
        }

        const source = result[1];
        const proxy = result[2];
        const pacResult = String(resultValue);
        const proxyScheme = isRecordValue(proxy) ? proxy.scheme : undefined;
        const sourceIsCondition = isRecordValue(source);
        const scheme = typeof source === 'string' ? source : undefined;
        const kind = pacResult === 'DIRECT' || proxyScheme === 'direct'
          ? sourceIsCondition ? 'bypass' : 'direct'
          : 'proxy';
        const step = {
          kind,
          profile: this._profileForExplanation(profile),
          condition: sourceIsCondition ? this._conditionForExplanation(source) : undefined,
          scheme,
          pacResult,
          proxy,
          auth: !!result[3]
        };
        steps.push(step);
        final = {
          auth: step.auth,
          kind: pacResult === 'DIRECT' ? 'direct' : 'proxy',
          pacResult,
          profile: step.profile,
          proxy
        };
        break;
      }

      const rule = result as Record<string, unknown>;
      const profileName = typeof rule.profileName === 'string' ? rule.profileName : '';
      if (!profileName) {
        break;
      }
      const targetProfile = OmegaPac.Profiles.byName(profileName, this._options);
      steps.push({
        kind: rule.isTempRule ? 'temporaryRule' : 'rule',
        profile: this._profileForExplanation(profile, tempRulesActive && profile === this._tempProfile ? '__temporary' : undefined),
        targetProfile: this._profileForExplanation(targetProfile, profileName),
        condition: this._conditionForExplanation(rule.condition),
        source: rule.source != null ? String(rule.source) : undefined,
        isTempRule: !!rule.isTempRule
      });
      if (!targetProfile) {
        warnings.push('targetProfileNotFound');
        final = {
          kind: 'missingProfile',
          profile: {
            name: profileName
          }
        };
        break;
      }
      profile = targetProfile;
    }

    if (!final) {
      final = this._finalForProfile(lastProfile);
    }
    if (final.kind === 'pac') {
      warnings.push('pacProfileLimited');
    }

    return {
      currentProfile: this._profileForExplanation(currentProfile),
      errors: [],
      final,
      finalProfile: final.profile,
      request,
      startProfile: this._profileForExplanation(startProfile, tempRulesActive && startProfile === this._tempProfile ? '__temporary' : undefined),
      steps,
      tempRulesActive,
      warnings
    };
  }

  /**
   * Explain how a request is resolved from the current or selected profile.
   * This is a dry-run view over the same matching functions used by proxy
   * application; it does not mutate profile state.
  */

  explainRequest(input?: string | ExplainRequestArgs): RuntimePromise<RequestExplanation> {
    const args = typeof input === 'string' ? {url: input} : input || {};
    const request = this._requestForExplanation(input);
    const explicitProfileName = args.profileName;
    const includeTempRules = args.includeTempRules !== false;
    let currentProfile = this.currentProfile();
    let startProfile: ProfileLike | null | undefined;
    let tempRulesActive = false;

    if (explicitProfileName) {
      startProfile = OmegaPac.Profiles.byName(explicitProfileName, this._options);
      if (!startProfile) {
        return Promise.reject(new ProfileNotExistError(explicitProfileName));
      }
    } else if (includeTempRules && this._tempProfileActive && this._tempProfile) {
      startProfile = this._tempProfile;
      tempRulesActive = true;
    } else if (this._currentProfileName) {
      startProfile = OmegaPac.Profiles.byName(this._currentProfileName, this._options);
    } else {
      startProfile = this._externalProfile;
    }

    if (!currentProfile && this._currentProfileName) {
      currentProfile = OmegaPac.Profiles.byName(this._currentProfileName, this._options);
    }

    return Promise.resolve(this._explainFromProfile(startProfile, request, tempRulesActive, currentProfile));
  }


  /**
   * Get the matching results of a request
   * @param {{}} request The request to test
   * @returns {Promise<{profile: {}, results: {}[]}>} The last matched profile
   * and the matching details
  */

  matchProfile(request: Record<string, unknown>): RuntimePromise<Record<string, unknown>> {
    if (!this._currentProfileName) {
      return Promise.resolve({
        profile: this._externalProfile,
        results: []
      });
    }
    const results: unknown[] = [];
    let profile = this._tempProfileActive ? this._tempProfile : OmegaPac.Profiles.byName(this._currentProfileName, this._options);
    let lastProfile;
    while (profile) {
      lastProfile = profile;
      const result = OmegaPac.Profiles.match(profile, request);
      if (result == null) {
        break;
      }
      results.push(result);
      let next;
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
  }


  /**
   * Notify Options that the proxy settings are set externally.
   * @param {{}} profile The external profile
   * @param {?{}} args Extra arguments
   * @param {boolean=false} args.noRevert If true, do not revert changes.
   * @param {boolean=false} args.internal If true, treat the profile change as
   * caused by the options itself instead of external reasons.
   * @returns {Promise} A promise which is fulfilled when the profile is set
  */

  setExternalProfile(profile: ProfileLike, args?: ExternalProfileArgs): RuntimePromise<unknown> | void {
    if (this._options['-revertProxyChanges'] && !this._isSystem) {
      if (profile.name !== this._currentProfileName && this._currentProfileName) {
        if (!(args != null ? args.noRevert : void 0)) {
          const revertToProfileName = this._revertToProfileName || this._currentProfileName;
          this._revertToProfileName = null;
          if (revertToProfileName && OmegaPac.Profiles.byName(revertToProfileName, this._options)) {
            return this.applyProfile(revertToProfileName);
          }
        } else {
          if (this._revertToProfileName == null) {
            this._revertToProfileName = this._currentProfileName;
          }
        }
      }
    }
    const profileName = typeof profile.name === 'string' ? profile.name : '';
    const p = profileName ? OmegaPac.Profiles.byName(profileName, this._options) : null;
    if (p) {
      const existingProfileName = p.name || profileName;
      if (args != null ? args.internal : void 0) {
        return this.applyProfile(existingProfileName, {
          proxy: false
        });
      } else {
        return this.applyProfile(existingProfileName, {
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
  }


  /**
   * Switch options syncing on and off.
   * @param {boolean} enabled Whether to enable syncing
   * @param {?{}} args Extra arguments
   * @param {boolean=false} args.force If true, overwrite options when conflict
   * @returns {Promise} A promise which is fulfilled when the syncing is switched
   */

  setOptionsSync(enabled: boolean, args?: SetOptionsSyncArgs): RuntimePromise<unknown> {
    this.log.method('Options#setOptionsSync', this, arguments);
    if (this.sync == null) {
      return Promise.reject(new Error('Options syncing is unsupported.'));
    }
    const sync = this.sync;
    return this._state.get({
      'syncOptions': ''
    }).then((arg) => {
        const syncOptions = arg.syncOptions;
        if (!enabled) {
          if (syncOptions === 'sync') {
            this._state.set({
              'syncOptions': 'conflict'
            });
          }
          sync.enabled = false;
          if (typeof this._syncWatchStop === "function") {
            this._syncWatchStop();
          }
          this._syncWatchStop = null;
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
        return this._state.set({
          'syncOptions': 'sync'
        }).then(() => {
          if (syncOptions === 'conflict') {
            sync.enabled = false;
            return this._storage.remove().then(() => {
              sync.enabled = true;
              return this.init();
            });
          } else {
            sync.enabled = true;
            if (typeof this._syncWatchStop === "function") {
              this._syncWatchStop();
            }
            sync.requestPush(this._options);
            this._syncWatchStop = sync.watchAndPull(this._storage);
          }
        });
    });
  }


  /**
   * Clear the sync storage, resetting syncing state to pristine.
   * @returns {Promise} A promise which is fulfilled when the syncing is reset.
   */

  resetOptionsSync() {
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
    return this.sync.storage.remove().then(() => {
        return this._state.set({
          'syncOptions': 'pristine'
        });
    });
  }

}

export default Options;
