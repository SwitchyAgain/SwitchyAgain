import React, {useEffect, useMemo, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {About} from './about';
import {GeneralSettings} from './general_settings';
import {ImportExport} from './import_export';
import {
  Options,
  downloadBlob,
  lastUrl,
  loadOptions,
  message,
  openShortcutConfig,
  patchOptions,
  replaceRef as replaceRefFromBackground,
  updateProfile as updateProfileFromBackground
} from './options_client';
import {OptionsAlert, OptionsShell} from './options_shell';
import {ConfirmModal} from './confirm_modals';
import {NewProfileModal, ProxyAuthModal} from './profile_modals';
import {
  FixedProfileContent,
  PacProfile,
  ProfileShell,
  RuleListProfile,
  SwitchProfileStatefulContent,
  UnsupportedProfile,
  VirtualProfile
} from './profile_content';
import {profileByName} from './profile_widgets';
import {
  addRule,
  applyParsedSource,
  attachNew,
  attachedIdentity,
  cloneRule,
  createAttachedName,
  createAttachedOptions,
  detectAdvancedConditionTypes,
  moveRule,
  parseSource,
  profileKey,
  removeAttached,
  removeRule,
  resetRuleProfiles,
  setAttachedEnabled,
  setDefaultProfile,
  updateConditionField,
  updateConditionType,
  updateIpCondition,
  updateRuleNote,
  updateRuleProfile,
  updateRuleWeekday
} from './switch_profile_runtime';
import {UiSettings} from './ui_settings';

type RouteName = 'about' | 'general' | 'io' | 'profile' | 'ui';

type Route = {
  name: RouteName;
  profileName?: string;
};

type AlertState = {
  i18n?: string;
  message?: string;
  type?: string;
} | null;

type ModalState =
  | {
    kind: 'cannotDeleteProfile';
    profile: any;
    refs: any[];
  }
  | {
    kind: 'deleteProfile';
    profile: any;
  }
  | {
    kind: 'newProfile';
  }
  | {
    auth: any;
    authKey: string;
    authSupported: boolean;
    kind: 'proxyAuth';
    profileName: string;
    protocolDisp: string;
  }
  | {
    fromName: string;
    kind: 'replaceProfile';
    toName: string;
  }
  | null;

const PROFILE_COLORS = ['#9ce', '#9d9', '#fa8', '#fe9', '#d497ee', '#47b', '#5b5', '#d63', '#ca0'];
const CHAR_CODE_UNDERSCORE = '_'.charCodeAt(0);
const FIXED_PROXY_AUTH_KEYS: Record<string, string> = {
  '': 'fallbackProxy',
  http: 'proxyForHttp',
  https: 'proxyForHttps'
};

function cloneOptions(options: Options) {
  return JSON.parse(JSON.stringify(options));
}

function sameValue(a: any, b: any) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function optionsPatch(before: Options, after: Options) {
  const patch: Options = {};
  const keys = new Set(Object.keys(before || {}).concat(Object.keys(after || {})));
  keys.forEach((key) => {
    const oldValue = before?.[key];
    const nextValue = after?.[key];
    if (sameValue(oldValue, nextValue)) {
      return;
    }
    if (typeof nextValue === 'undefined') {
      patch[key] = [oldValue, 0, 0];
      return;
    }
    if (typeof oldValue === 'undefined') {
      patch[key] = [nextValue];
      return;
    }
    patch[key] = [oldValue, nextValue];
  });
  return patch;
}

function isPatchEmpty(patch: Options) {
  return Object.keys(patch).length === 0;
}

function isErrorResult(result: any) {
  return result instanceof Error || Boolean(result?.name && result?.message);
}

function updateProfileError(results: Record<string, any> | undefined, name: string) {
  const primaryResult = results?.[profileKey(name)];
  if (isErrorResult(primaryResult)) {
    return primaryResult;
  }
  return Object.values(results || {}).find(isErrorResult);
}

function profileDownloadErrorMessage(err: any) {
  const statusCode = err?.statusCode ?? err?.original?.statusCode ?? '';
  return message(`options_profileDownloadError_${err?.name || ''}`, '', String(statusCode))
    || message('options_profileDownloadError', 'Profile download failed.');
}

function createPacExport(options: Options, profileName: string) {
  let missingProfile = '';
  const ast = OmegaPac.PacGenerator.script(options, profileName, {
    profileNotFound(name: string) {
      missingProfile = name;
      return 'dumb';
    }
  });
  let pac = ast.print_to_string({
    beautify: true,
    comments: true
  });
  pac = OmegaPac.PacGenerator.ascii(pac);
  const fileName = profileName.replace(/\W+/g, '_');
  return {
    blob: new Blob([pac], {
      type: 'text/plain;charset=utf-8'
    }),
    fileName: `OmegaProfile_${fileName}.pac`,
    missingProfile
  };
}

function isProfileNameHidden(name: string) {
  return name.charCodeAt(0) === CHAR_CODE_UNDERSCORE;
}

function isProfileNameReserved(name: string) {
  return name.charCodeAt(0) === CHAR_CODE_UNDERSCORE && name.charCodeAt(1) === CHAR_CODE_UNDERSCORE;
}

function getParentName(name: string) {
  const prefix = '__ruleListOf_';
  if (name.indexOf(prefix) === 0) {
    return name.substr(prefix.length);
  }
  return undefined;
}

function referencedProfiles(profileName: string, options: Options) {
  if (typeof OmegaPac === 'undefined' || !OmegaPac?.Profiles?.referencedBySet) {
    return [];
  }
  const refs = OmegaPac.Profiles.referencedBySet(profileName, options);
  const refSet: Record<string, string> = {};
  for (const key of Object.keys(refs || {})) {
    let refName = refs[key];
    const parentName = getParentName(refName);
    let refKey = key;
    if (parentName) {
      refName = parentName;
      refKey = profileKey(parentName);
    }
    refSet[refKey] = refName;
  }
  return Object.keys(refSet)
    .map((key) => OmegaPac.Profiles.byKey?.(key, options) || profileByName(options, refSet[key]))
    .filter(Boolean);
}

function proxyAuthSupported(protocol?: string) {
  if (protocol === 'http' || protocol === 'https') {
    return true;
  }
  if (protocol === 'socks5') {
    return Boolean((window as any).browser?.proxy?.register);
  }
  return false;
}

function cloneAuth(auth: any) {
  return auth ? cloneOptions(auth) : undefined;
}

function ModalFrame({
  children,
  onDismiss
}: {
  children: React.ReactNode;
  onDismiss: () => void;
}) {
  return (
    <>
      <div className="modal-backdrop fade in" />
      <div
        className="modal fade in"
        role="dialog"
        style={{display: 'block'}}
        tabIndex={-1}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            onDismiss();
          }
        }}
      >
        <div className="modal-dialog">
          <div className="modal-content">{children}</div>
        </div>
      </div>
    </>
  );
}

function routeHref(route: RouteName, params?: Record<string, string>) {
  if (route === 'profile') {
    return `#/profile/${encodeURIComponent(params?.name || '')}`;
  }
  return `#/${route}`;
}

function parseRoute(hash = window.location.hash): Route {
  const value = hash.replace(/^#\/?/, '');
  const parts = value.split('/');
  switch (parts[0]) {
    case 'ui':
      return {name: 'ui'};
    case 'general':
      return {name: 'general'};
    case 'io':
      return {name: 'io'};
    case 'profile':
      return {
        name: 'profile',
        profileName: decodeURIComponent(parts.slice(1).join('/') || '')
      };
    case 'about':
    default:
      return {name: 'about'};
  }
}

function useHashRoute() {
  const [route, setRoute] = useState(parseRoute);
  useEffect(() => {
    function syncRoute() {
      const nextRoute = parseRoute();
      setRoute(nextRoute);
      lastUrl(routeHref(nextRoute.name, nextRoute.profileName ? {name: nextRoute.profileName} : undefined).replace(/^#/, ''));
    }
    window.addEventListener('hashchange', syncRoute);
    if (!window.location.hash) {
      const storedUrl = lastUrl();
      window.location.hash = storedUrl || routeHref('about');
    }
    syncRoute();
    return () => window.removeEventListener('hashchange', syncRoute);
  }, []);
  return route;
}

function SwitchProfilePreview({
  onDownload,
  options,
  profile,
  showPending,
  updatingProfiles,
  updateOptionsDraft,
  updateProfile
}: {
  onDownload: (name: string) => void;
  options: Options;
  profile: any;
  showPending: () => void;
  updatingProfiles: Record<string, boolean>;
  updateOptionsDraft: (updater: (options: Options) => void) => void;
  updateProfile: (profileName: string, updater: (profile: any) => void) => void;
}) {
  const identity = attachedIdentity(profile.name || '');
  const attached = options[identity.attachedKey] || null;
  const attachedOptions = createAttachedOptions(profile, attached);
  const showConditionTypes = options['-showConditionTypes'] ?? detectAdvancedConditionTypes(profile);

  function mutateProfile(updater: (nextProfile: any) => void) {
    updateProfile(profile.name || '', updater);
  }

  function mutateAttached(updater: (nextAttached: any) => void) {
    updateOptionsDraft((nextOptions) => {
      const nextAttached = {
        ...(nextOptions[identity.attachedKey] || {})
      };
      updater(nextAttached);
      if (typeof OmegaPac !== 'undefined' && OmegaPac?.Profiles?.updateRevision) {
        OmegaPac.Profiles.updateRevision(nextAttached);
      }
      nextOptions[identity.attachedKey] = nextAttached;
    });
  }

  function applySource(source: {code?: string; error?: {message?: string}; touched?: boolean}) {
    const nextSource = {
      ...source
    };
    const result = parseSource(nextSource.code || '', options);
    if (result.error) {
      nextSource.error = result.error;
    }
    if (nextSource.error) {
      return {
        ok: false,
        source: {
          ...nextSource,
          error: {
            message: nextSource.error?.message || String(nextSource.error)
          }
        }
      };
    }
    updateOptionsDraft((nextOptions) => {
      const nextProfile = nextOptions[profileKey(profile.name || '')];
      const nextAttached = nextOptions[identity.attachedKey] || null;
      applyParsedSource(nextProfile, nextAttached, attachedOptions, identity.attachedName, result.rules || []);
    });
    return {
      ok: true
    };
  }

  return (
    <SwitchProfileStatefulContent
      attached={attached}
      attachedOptions={attachedOptions}
      confirmDeletion={!!options['-confirmDeletion']}
      loadRules
      onApplySource={applySource}
      onAddRule={() => mutateProfile((nextProfile) => addRule(nextProfile, attachedOptions.defaultProfileName))}
      onAttachNew={() => updateOptionsDraft((nextOptions) => {
        const nextProfile = nextOptions[profileKey(profile.name || '')];
        attachNew(nextOptions, identity.attachedKey, nextProfile, identity.attachedName, attachedOptions);
        OmegaPac.Profiles.updateRevision(nextProfile);
      })}
      onAttachedChange={(field, value) => mutateAttached((nextAttached) => {
        nextAttached[field] = value;
      })}
      onAttachedEnabledChange={(enabled) => mutateProfile((nextProfile) => {
        setAttachedEnabled(nextProfile, attached, identity.attachedName, attachedOptions, enabled, attachedOptions.enabled);
      })}
      onAttachedMatchProfileChange={(name) => mutateAttached((nextAttached) => {
        nextAttached.matchProfileName = name;
      })}
      onCloneRule={(index) => mutateProfile((nextProfile) => cloneRule(nextProfile, index))}
      onConditionFieldChange={(index, field, value) => mutateProfile((nextProfile) => {
        updateConditionField(nextProfile.rules?.[index], field, value);
      })}
      onConditionTypeChange={(index, type) => mutateProfile((nextProfile) => {
        updateConditionType(nextProfile.rules?.[index], type);
      })}
      onDefaultProfileChange={(name) => updateOptionsDraft((nextOptions) => {
        const nextProfile = nextOptions[profileKey(profile.name || '')];
        const nextAttached = nextOptions[identity.attachedKey] || null;
        setDefaultProfile(nextProfile, nextAttached, attachedOptions, name);
        if (nextAttached) {
          OmegaPac.Profiles.updateRevision(nextAttached);
        }
        OmegaPac.Profiles.updateRevision(nextProfile);
      })}
      onDownload={onDownload}
      onIpConditionInputChange={(index, value) => mutateProfile((nextProfile) => {
        updateIpCondition(nextProfile.rules?.[index], value);
      })}
      onMoveRule={(fromIndex, toIndex) => mutateProfile((nextProfile) => {
        moveRule(nextProfile.rules || [], fromIndex, toIndex);
      })}
      onNoteChange={(index, note) => mutateProfile((nextProfile) => {
        updateRuleNote(nextProfile.rules?.[index], note);
      })}
      onProfileChange={(index, name) => mutateProfile((nextProfile) => {
        updateRuleProfile(nextProfile.rules?.[index], name);
      })}
      onRemoveAttached={() => updateOptionsDraft((nextOptions) => {
        const nextProfile = nextOptions[profileKey(profile.name || '')];
        const nextAttached = nextOptions[identity.attachedKey];
        if (nextAttached) {
          removeAttached(nextOptions, identity.attachedKey, nextProfile, nextAttached);
          OmegaPac.Profiles.updateRevision(nextProfile);
        }
      })}
      onRemoveRule={(index) => mutateProfile((nextProfile) => removeRule(nextProfile, index))}
      onResetRules={() => mutateProfile((nextProfile) => resetRuleProfiles(nextProfile, attachedOptions.defaultProfileName))}
      onWeekdayChange={(index, dayIndex, selected) => mutateProfile((nextProfile) => {
        updateRuleWeekday(nextProfile.rules?.[index], dayIndex, selected);
      })}
      options={options}
      profile={profile}
      rules={profile.rules || []}
      showConditionTypes={showConditionTypes}
      updating={!!updatingProfiles[profileKey(attached?.name || '')]}
    />
  );
}

export function OptionsApp() {
  const route = useHashRoute();
  const [savedOptions, setSavedOptions] = useState<Options | null>(null);
  const [options, setOptions] = useState<Options | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'error'>('loading');
  const [updatingProfiles, setUpdatingProfiles] = useState<Record<string, boolean>>({});
  const [modal, setModal] = useState<ModalState>(null);
  const [alert, setAlert] = useState<AlertState>(null);
  const [alertShown, setAlertShown] = useState(false);

  useEffect(() => {
    loadOptions().then((loadedOptions) => {
      const cloned = cloneOptions(loadedOptions);
      setSavedOptions(cloned);
      setOptions(cloneOptions(cloned));
      setStatus('ready');
    }).catch((err) => {
      setAlert({
        type: 'error',
        message: err?.message || String(err)
      });
      setAlertShown(true);
      setStatus('error');
    });
  }, []);

  const dirty = useMemo(() => {
    if (!savedOptions || !options) {
      return false;
    }
    return !sameValue(savedOptions, options);
  }, [options, savedOptions]);

  function showAlert(nextAlert: AlertState) {
    setAlert(nextAlert);
    setAlertShown(Boolean(nextAlert));
    if (nextAlert) {
      window.setTimeout(() => setAlertShown(false), 3000);
    }
  }

  function replaceOptions(nextOptions: Options, opts?: {dirty?: boolean}) {
    const cloned = cloneOptions(nextOptions);
    setOptions(cloneOptions(cloned));
    if (!opts?.dirty) {
      setSavedOptions(cloned);
    }
  }

  function updateOptions(nextOptions: Options) {
    setOptions(cloneOptions(nextOptions));
  }

  function updateOptionsDraft(updater: (nextOptions: Options) => void) {
    setOptions((current) => {
      if (!current) {
        return current;
      }
      const nextOptions = cloneOptions(current);
      updater(nextOptions);
      return nextOptions;
    });
  }

  function updateProfile(profileName: string, updater: (profile: any) => void) {
    setOptions((current) => {
      if (!current) {
        return current;
      }
      const nextOptions = cloneOptions(current);
      const key = profileKey(profileName);
      const profile = {
        ...(nextOptions[key] || {})
      };
      updater(profile);
      if (typeof OmegaPac !== 'undefined' && OmegaPac?.Profiles?.updateRevision) {
        OmegaPac.Profiles.updateRevision(profile);
      }
      nextOptions[key] = profile;
      return nextOptions;
    });
  }

  function applyOptions(opts?: {silent?: boolean}) {
    if (!savedOptions || !options) {
      return Promise.resolve();
    }
    const patch = optionsPatch(savedOptions, options);
    if (isPatchEmpty(patch)) {
      setSavedOptions(cloneOptions(options));
      if (!opts?.silent) {
        showAlert({type: 'success', i18n: 'options_saveSuccess'});
      }
      return Promise.resolve();
    }
    setStatus('saving');
    return patchOptions(patch).then((loadedOptions) => {
      replaceOptions(loadedOptions);
      setStatus('ready');
      if (!opts?.silent) {
        showAlert({type: 'success', i18n: 'options_saveSuccess'});
      }
    }).catch((err) => {
      setStatus('ready');
      showAlert({
        type: 'error',
        message: err?.message || String(err)
      });
      return Promise.reject(err);
    });
  }

  function discardOptions() {
    if (!savedOptions) {
      return;
    }
    setOptions(cloneOptions(savedOptions));
    showAlert(null);
  }

  function setProfileUpdating(profileName: string, updating: boolean) {
    const key = profileKey(profileName);
    setUpdatingProfiles((current) => {
      const next = {...current};
      if (updating) {
        next[key] = true;
      } else {
        delete next[key];
      }
      return next;
    });
  }

  function downloadProfile(profileName: string) {
    if (!profileName) {
      return Promise.resolve();
    }
    setProfileUpdating(profileName, true);
    return Promise.resolve()
      .then(() => dirty ? applyOptions({silent: true}) : undefined)
      .then(() => updateProfileFromBackground(profileName, 'bypass_cache'))
      .then(({options: loadedOptions, results}) => {
        replaceOptions(loadedOptions);
        const error = updateProfileError(results, profileName);
        if (error) {
          throw error;
        }
        showAlert({type: 'success', i18n: 'options_profileDownloadSuccess'});
      })
      .catch((err) => {
        showAlert({
          type: 'error',
          message: profileDownloadErrorMessage(err)
        });
      })
      .finally(() => setProfileUpdating(profileName, false));
  }

  function createProfile(profileSpec: {name: string; profileType: string}) {
    updateOptionsDraft((nextOptions) => {
      const profile = OmegaPac.Profiles.create(profileSpec);
      const choice = Math.floor(Math.random() * PROFILE_COLORS.length);
      if (profile.color == null) {
        profile.color = PROFILE_COLORS[choice];
      }
      OmegaPac.Profiles.updateRevision(profile);
      nextOptions[profileKey(profile)] = profile;
    });
    setModal(null);
    navigate('profile', {
      name: profileSpec.name
    });
  }

  function requestDeleteProfile(profile: any) {
    if (!options || !profile?.name) {
      return;
    }
    const refs = referencedProfiles(profile.name, options);
    if (refs.length > 0) {
      setModal({
        kind: 'cannotDeleteProfile',
        profile,
        refs
      });
      return;
    }
    setModal({
      kind: 'deleteProfile',
      profile
    });
  }

  function deleteProfile(profile: any) {
    const profileName = profile?.name || '';
    if (!profileName) {
      setModal(null);
      return;
    }
    updateOptionsDraft((nextOptions) => {
      delete nextOptions[profileKey(createAttachedName(profileName))];
      delete nextOptions[profileKey(profileName)];
      if (nextOptions['-startupProfileName'] === profileName) {
        nextOptions['-startupProfileName'] = '';
      }
      const quickSwitch = nextOptions['-quickSwitchProfiles'];
      if (Array.isArray(quickSwitch)) {
        const index = quickSwitch.indexOf(profileName);
        if (index >= 0) {
          quickSwitch.splice(index, 1);
        }
      }
    });
    setModal(null);
    navigate('ui');
  }

  function exportScript(profileName: string) {
    if (!options || !profileName) {
      return;
    }
    const profile = profileByName(options, profileName);
    if (!profile || profile.profileType === 'DirectProfile' || profile.profileType === 'SystemProfile') {
      return;
    }
    const exported = createPacExport(options, profileName);
    downloadBlob(exported.blob, exported.fileName);
    if (exported.missingProfile) {
      showAlert({
        type: 'error',
        message: message('options_profileNotFound', 'Profile not found: $1', exported.missingProfile)
      });
    }
  }

  function requestPacProxyAuth(profile: any) {
    const profileName = profile?.name || '';
    if (!profileName) {
      return;
    }
    setModal({
      auth: cloneAuth(profile.auth?.all),
      authKey: 'all',
      authSupported: true,
      kind: 'proxyAuth',
      profileName,
      protocolDisp: ''
    });
  }

  function requestFixedProxyAuth(profile: any, scheme: string) {
    const authKey = FIXED_PROXY_AUTH_KEYS[scheme];
    const proxy = authKey ? profile?.[authKey] : null;
    const profileName = profile?.name || '';
    if (!profileName || !proxy?.scheme) {
      return;
    }
    setModal({
      auth: cloneAuth(profile.auth?.[authKey]),
      authKey,
      authSupported: proxyAuthSupported(proxy.scheme),
      kind: 'proxyAuth',
      profileName,
      protocolDisp: proxy.scheme
    });
  }

  function saveProxyAuth(auth: {password?: string; username?: string}, authModal: Extract<ModalState, {kind: 'proxyAuth'}>) {
    updateProfile(authModal.profileName, (nextProfile) => {
      if (!auth?.username) {
        if (nextProfile.auth) {
          delete nextProfile.auth[authModal.authKey];
        }
        return;
      }
      if (!nextProfile.auth) {
        nextProfile.auth = {};
      }
      nextProfile.auth[authModal.authKey] = auth;
    });
    setModal(null);
  }

  function requestReplaceProfile(fromName: string, toName: string) {
    if (!fromName || !toName) {
      return;
    }
    setModal({
      fromName,
      kind: 'replaceProfile',
      toName
    });
  }

  function replaceProfileRefs(fromName: string, toName: string) {
    setModal(null);
    return Promise.resolve()
      .then(() => dirty ? applyOptions({silent: true}) : undefined)
      .then(() => replaceRefFromBackground(fromName, toName))
      .then((loadedOptions) => {
        replaceOptions(loadedOptions);
        showAlert({
          type: 'success',
          i18n: 'options_replaceProfileSuccess'
        });
      })
      .catch((err) => {
        showAlert({
          type: 'error',
          message: err?.message || String(err)
        });
      });
  }

  function navigate(name: string, params?: Record<string, string>) {
    window.location.hash = routeHref(name as RouteName, params);
  }

  function renderContent() {
    if (status === 'loading' || !options) {
      return (
        <div className="react-options">
          <div className="page-header">
            <h2>{message('options_loading', 'Loading...')}</h2>
          </div>
        </div>
      );
    }
    if (route.name === 'ui') {
      return (
        <div className="react-settings-host-ui">
          <UiSettings
            embedded
            options={options}
            onOpenShortcutConfig={openShortcutConfig}
            onOptionsChange={updateOptions}
          />
        </div>
      );
    }
    if (route.name === 'general') {
      return (
        <div className="react-settings-host-general">
          <GeneralSettings embedded options={options} onOptionsChange={updateOptions} />
        </div>
      );
    }
    if (route.name === 'io') {
      return (
        <div className="react-settings-host-import-export">
          <ImportExport
            embedded
            options={options}
            optionsDirty={dirty}
            onApplyOptions={applyOptions}
            onImportSuccess={() => showAlert({type: 'success', i18n: 'options_importSuccess'})}
            onOptionsReplace={replaceOptions}
          />
        </div>
      );
    }
    if (route.name === 'profile') {
      const profile = route.profileName ? profileByName(options, route.profileName) : null;
      if (!profile) {
        return (
          <div className="react-options">
            <div className="page-header">
              <h2>{message('options_profileNotFound', 'Profile not found')}</h2>
            </div>
          </div>
        );
      }
      const showPending = () => showAlert({
        type: 'warning',
        message: message('options_profileEditorReactPending', 'This action is not wired in the React preview yet.')
      });
      const referenced = () => {
        if (typeof OmegaPac === 'undefined' || !OmegaPac?.Profiles?.referencedBySet) {
          return false;
        }
        return Object.keys(OmegaPac.Profiles.referencedBySet(profile, options)).length > 0;
      };
      const content = (() => {
        switch (profile.profileType) {
          case 'FixedProfile':
            return (
              <FixedProfileContent
                profile={profile}
                onBypassListChange={(value) => updateProfile(profile.name || '', (nextProfile) => {
                  nextProfile.bypassList = value;
                })}
                onEditProxyAuth={(scheme) => requestFixedProxyAuth(profile, scheme)}
                onProxyChange={(field, value, changeOptions) => updateProfile(profile.name || '', (nextProfile) => {
                  if (changeOptions?.clearAuth && nextProfile.auth) {
                    nextProfile.auth[field] = void 0;
                  }
                  if (typeof value === 'undefined') {
                    delete nextProfile[field];
                    return;
                  }
                  nextProfile[field] = value;
                })}
              />
            );
          case 'PacProfile':
            return (
              <PacProfile
                profile={profile}
                referenced={referenced()}
                onDownload={downloadProfile}
                onEditProxyAuth={() => requestPacProxyAuth(profile)}
                onProfileChange={(field, value) => updateProfile(profile.name || '', (nextProfile) => {
                  nextProfile[field] = value;
                })}
                updating={!!updatingProfiles[profileKey(profile.name || '')]}
              />
            );
          case 'RuleListProfile':
            return (
              <RuleListProfile
                options={options}
                profile={profile}
                onDownload={downloadProfile}
                onProfileChange={(field, value) => updateProfile(profile.name || '', (nextProfile) => {
                  nextProfile[field] = value;
                })}
                updating={!!updatingProfiles[profileKey(profile.name || '')]}
              />
            );
          case 'VirtualProfile':
            return (
              <VirtualProfile
                options={options}
                profile={profile}
                onReplaceProfile={requestReplaceProfile}
                onTargetChange={(name) => updateProfile(profile.name || '', (nextProfile) => {
                  nextProfile.defaultProfileName = name;
                })}
              />
            );
          case 'SwitchProfile':
            return (
              <SwitchProfilePreview
                onDownload={downloadProfile}
                options={options}
                profile={profile}
                showPending={showPending}
                updatingProfiles={updatingProfiles}
                updateOptionsDraft={updateOptionsDraft}
                updateProfile={updateProfile}
              />
            );
          default:
            return <UnsupportedProfile profile={profile} />;
        }
      })();
      return (
        <div>
          <ProfileShell
            profile={profile}
            profileColor={profile.color}
            scriptable={profile.profileType !== 'DirectProfile' && profile.profileType !== 'SystemProfile'}
            onColorChange={(color) => updateProfile(profile.name || '', (nextProfile) => {
              nextProfile.color = color;
            })}
            onDelete={() => requestDeleteProfile(profile)}
            onExportScript={() => exportScript(profile.name || '')}
            onRename={showPending}
          />
          {content}
        </div>
      );
    }
    return (
      <About
        embedded
        onResetOptions={() => navigate('io')}
      />
    );
  }

  return (
    <>
      <div className="container-fluid">
        <header className="col-lg-2 col-sm-3 side-nav">
          <OptionsShell
            currentProfileName={route.profileName || ''}
            currentState={route.name}
            generalHref={routeHref('general')}
            importExportHref={routeHref('io')}
            onApply={applyOptions}
            onDiscard={discardOptions}
            onNavigate={navigate}
            onNewProfile={() => setModal({kind: 'newProfile'})}
            options={options}
            optionsDirty={dirty || status === 'saving'}
            profileHref={(profile) => routeHref('profile', {name: profile.name || ''})}
            uiHref={routeHref('ui')}
          />
        </header>
        <main className="col-lg-10 col-sm-9 col-lg-offset-2 col-sm-offset-3 angular-animate">
          {renderContent()}
        </main>
      </div>
      <OptionsAlert alert={alert} shown={alertShown} onClose={() => setAlertShown(false)} />
      {modal?.kind === 'newProfile' && options && (
        <ModalFrame onDismiss={() => setModal(null)}>
          <NewProfileModal
            isProfileNameHidden={isProfileNameHidden}
            isProfileNameReserved={isProfileNameReserved}
            onClose={createProfile}
            onDismiss={() => setModal(null)}
            profileByName={(name) => profileByName(options, name)}
          />
        </ModalFrame>
      )}
      {modal?.kind === 'cannotDeleteProfile' && options && (
        <ModalFrame onDismiss={() => setModal(null)}>
          <ConfirmModal
            kind="cannotDeleteProfile"
            onDismiss={() => setModal(null)}
            options={options}
            profile={modal.profile}
            refs={modal.refs}
          />
        </ModalFrame>
      )}
      {modal?.kind === 'deleteProfile' && options && (
        <ModalFrame onDismiss={() => setModal(null)}>
          <ConfirmModal
            kind="deleteProfile"
            onClose={() => deleteProfile(modal.profile)}
            onDismiss={() => setModal(null)}
            options={options}
            profile={modal.profile}
          />
        </ModalFrame>
      )}
      {modal?.kind === 'proxyAuth' && (
        <ModalFrame onDismiss={() => setModal(null)}>
          <ProxyAuthModal
            auth={modal.auth}
            authSupported={modal.authSupported}
            onClose={(auth) => saveProxyAuth(auth, modal)}
            onDismiss={() => setModal(null)}
            protocolDisp={modal.protocolDisp}
          />
        </ModalFrame>
      )}
      {modal?.kind === 'replaceProfile' && options && (
        <ModalFrame onDismiss={() => setModal(null)}>
          <ConfirmModal
            fromName={modal.fromName}
            kind="replaceProfile"
            onClose={(value) => replaceProfileRefs(value?.fromName || modal.fromName, value?.toName || modal.toName)}
            onDismiss={() => setModal(null)}
            options={options}
            toName={modal.toName}
          />
        </ModalFrame>
      )}
    </>
  );
}

export function mountOptionsApp(element: Element) {
  const root = createRoot(element);
  root.render(<OptionsApp />);
  return {
    render() {
      root.render(<OptionsApp />);
    },
    unmount() {
      root.unmount();
    }
  };
}

const globalWindow = window as any;
globalWindow.OmegaReactOptionsApp = {
  mountOptionsApp
};
