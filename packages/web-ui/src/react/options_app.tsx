import React, {useEffect, useMemo, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {About} from './about';
import {clearWindowTimeout, locationHash, setLocationHash, setWindowTimeout} from './browser_env';
import {GeneralSettings} from './general_settings';
import {ImportExport} from './import_export';
import {callBackground} from './background_client';
import {message} from './i18n_client';
import {downloadBlob, openShortcutConfig} from './navigation_client';
import {
  loadOptions,
  patchOptions,
  renameProfile as renameProfileFromBackground,
  replaceRef as replaceRefFromBackground,
  resetOptions,
  updateProfile as updateProfileFromBackground
} from './options_api_client';
import type {Options} from './options_client_types';
import {getState, lastUrl, setState} from './state_client';
import {OptionsAlert, OptionsShell} from './options_shell';
import {
  attachedProfileDraft,
  attachedProfileOption,
  cloneOptions,
  cloneAuth,
  composeLegacyRuleList,
  composeOmegaRuleList,
  createPacExport,
  DEFAULT_PROXY_AUTH_CAPABILITIES,
  DEFAULT_PROXY_DNS_CAPABILITIES,
  deleteAttachedProfileOption,
  deleteProfileOption,
  deleteProfileScopeAssignments,
  duplicatableProfilesFromOptions,
  duplicateProfileOption,
  exportRuleListOptions,
  firstFixedProfileName,
  hasProxyScriptApi,
  isPatchEmpty,
  isProfileNameHidden,
  isProfileNameReserved,
  isSwitchProfile,
  numberOption,
  optionsPatch,
  profileDraft,
  profileDownloadErrorMessage,
  profileOption,
  profileUpdating,
  referencedProfiles,
  safeProfileFileName,
  setProfileOption,
  sameValue,
  updateProfileError,
  updateProfileRevision
} from './options_logic';
import {parseRoute, routeHref} from './options_routes';
import {ConfirmModal} from './confirm_modals';
import {useBeforeUnload, useWindowEvent} from './dom_event_hooks';
import {OPTIONS_GUIDE_STEPS, OptionsGuide, SWITCH_PROFILE_GUIDE_STEPS, type OptionsGuideState} from './options_guide';
import {WelcomeModal} from './options_modals';
import {NewProfileModal, ProxyAuthModal, RenameProfileModal, type NewProfileSpec} from './profile_modals';
import {
  FixedProfileContent,
  PacProfile,
  ProfileShell,
  RuleListProfile,
  SwitchProfileStatefulContent,
  UnsupportedProfile,
  VirtualProfile
} from './profile_content';
import {RouteTrace} from './route_trace';
import {
  Profile,
  isBuiltinProfile,
  isFixedProfile,
  isPacProfile,
  isRuleListProfile,
  isVirtualProfile,
  profileByName
} from './profile_widgets';
import {
  DEFAULT_PROFILE_SCOPE_CAPABILITIES,
  ProfileScopeSettingsPage,
  hasVisibleProfileScopes,
  visibleProfileScopes,
  type ProfileScopeCapabilities,
  type ProfileScopeContainerInfo
} from './profile_scope_settings';
import {
  NamedSwitchProfileModel,
  SwitchProfileModel,
  SwitchRuleSourceState,
  addRule,
  applyParsedSource,
  attachNew,
  attachedIdentity,
  cloneRule,
  createAttachedOptions,
  detectAdvancedConditionTypes,
  moveRule,
  parseSource,
  parsedSourceChangesProfile,
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
import type {
  FixedProfileModel,
  FixedProfileBypassCondition,
  FixedProfileProxyChangeOptions,
  FixedProfileProxyField,
  FixedProfileScheme,
  NamedFixedProfileModel,
  NamedPacProfileModel,
  PacProfileModel,
  Profile as ProfileModel,
  ProfileAuth,
  ProfileAuthMap,
  ProfileAuthKey,
  ProxyAuthCapabilities,
  ProxyDnsCapabilities,
  ProfileType,
  PacProfileField,
  RuleListProfileAttachedField,
  RuleListProfileField,
  RuleListProfileModel,
  VirtualProfileModel
} from './profile_types';
import type {RouteName} from './options_routes';

type AlertState = {
  i18n?: string;
  message?: string;
  type?: string;
} | null;

type ModalState =
  | {
      kind: 'applyOptions';
    }
  | {
      kind: 'cannotDeleteProfile';
      profile: Profile;
      refs: Profile[];
    }
  | {
      kind: 'deleteProfile';
      profile: Profile;
    }
  | {
      kind: 'newProfile';
    }
  | {
      fromName: string;
      kind: 'renameProfile';
    }
  | {
      kind: 'resetOptions';
    }
  | {
      kind: 'sourceDraft';
    }
  | {
      auth?: ProfileAuth;
      authKey: ProfileAuthKey;
      kind: 'proxyAuth';
      profileName: string;
    }
  | {
      fromName: string;
      kind: 'replaceProfile';
      toName: string;
    }
  | {
      kind: 'welcome';
      profileName: string;
      upgrade: boolean;
    }
  | null;

type AppliedOptionsAction = (appliedOptions: Options) => void | Promise<void>;
type PendingDraftAction = (nextOptions?: Options) => unknown | Promise<unknown>;

type PendingSourceEditorState = {
  editSource: boolean;
  profileName: string;
  source?: SwitchRuleSourceState | null;
} | null;

function applySourceToOptions(sourceOptions: Options, profileName: string, source: SwitchRuleSourceState) {
  const nextSource = {
    ...source,
    code: source.code || ''
  };
  const profile = profileOption<NamedSwitchProfileModel>(sourceOptions, profileName, isSwitchProfile);
  if (!profile) {
    nextSource.error = {
      message: message('options_profileNotFound', `Profile not found: ${profileName}`, profileName)
    };
    return {
      ok: false,
      source: nextSource
    };
  }
  const identity = attachedIdentity(profile.name);
  const attached = attachedProfileOption(sourceOptions, identity) || null;
  const attachedOptions = createAttachedOptions(profile, attached);
  const result = parseSource(nextSource.code, sourceOptions);
  if (result.error) {
    nextSource.error = result.error;
  } else {
    nextSource.error = undefined;
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
  const parsedRules = result.rules || [];
  if (!parsedSourceChangesProfile(profile, attached, identity.attachedName, parsedRules)) {
    return {
      ok: true,
      source: null
    };
  }
  if (!applyParsedSource(profile, attached, attachedOptions, identity.attachedName, parsedRules)) {
    return {
      ok: true,
      source: null
    };
  }
  return {
    ok: true,
    source: null
  };
}

const PROFILE_COLORS = ['#9ce', '#9d9', '#fa8', '#fe9', '#d497ee', '#47b', '#5b5', '#d63', '#ca0'];
const FIXED_PROXY_AUTH_KEYS: Record<FixedProfileScheme, FixedProfileProxyField> = {
  '': 'fallbackProxy',
  http: 'proxyForHttp',
  https: 'proxyForHttps'
};
const OPTIONS_APP_STATE_KEYS = [
  'currentProfileName',
  'isSystemProfile',
  'profileScopeCapabilities',
  'proxyAuthCapabilities',
  'proxyDnsCapabilities',
  'profileScopeContainers',
  'firstRun'
];

type OptionsAppInitialState = {
  activeProfileName: string;
  firstRun: string;
  profileScopeCapabilities: ProfileScopeCapabilities;
  profileScopeContainers: ProfileScopeContainerInfo[];
  proxyAuthCapabilities: ProxyAuthCapabilities;
  proxyDnsCapabilities: ProxyDnsCapabilities;
};

function defaultOptionsAppInitialState(): OptionsAppInitialState {
  return {
    activeProfileName: 'direct',
    firstRun: '',
    profileScopeCapabilities: DEFAULT_PROFILE_SCOPE_CAPABILITIES,
    profileScopeContainers: [],
    proxyAuthCapabilities: DEFAULT_PROXY_AUTH_CAPABILITIES,
    proxyDnsCapabilities: DEFAULT_PROXY_DNS_CAPABILITIES
  };
}

function activeProfileNameFromState(name: unknown, isSystem: unknown) {
  return isSystem === true ? 'system' : typeof name === 'string' && name ? name : 'direct';
}

function loadOptionsAppInitialState(): Promise<OptionsAppInitialState> {
  return getState<ProfileScopeCapabilities | ProxyAuthCapabilities | ProxyDnsCapabilities | ProfileScopeContainerInfo[] | string | boolean>(
    OPTIONS_APP_STATE_KEYS
  )
    .then(([currentProfileName, isSystemProfile, capabilities, authCapabilities, dnsCapabilities, containers, firstRun]) => ({
      activeProfileName: activeProfileNameFromState(currentProfileName, isSystemProfile),
      firstRun: typeof firstRun === 'string' ? firstRun : '',
      profileScopeCapabilities: (capabilities as ProfileScopeCapabilities | undefined) || DEFAULT_PROFILE_SCOPE_CAPABILITIES,
      profileScopeContainers: Array.isArray(containers) ? (containers as ProfileScopeContainerInfo[]) : [],
      proxyAuthCapabilities: (authCapabilities as ProxyAuthCapabilities | undefined) || DEFAULT_PROXY_AUTH_CAPABILITIES,
      proxyDnsCapabilities: (dnsCapabilities as ProxyDnsCapabilities | undefined) || DEFAULT_PROXY_DNS_CAPABILITIES
    }))
    .catch(() => defaultOptionsAppInitialState());
}

function guideStepCount(guide: OptionsGuideState) {
  return guide.kind === 'switch' ? SWITCH_PROFILE_GUIDE_STEPS.length : OPTIONS_GUIDE_STEPS.length;
}

function ModalFrame({children, onDismiss}: {children: React.ReactNode; onDismiss: () => void}) {
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

function useHashRoute() {
  const [route, setRoute] = useState(() => parseRoute(locationHash()));
  function updateRoute(nextRoute = parseRoute(locationHash())) {
    setRoute(nextRoute);
    lastUrl(routeHref(nextRoute.name, nextRoute.profileName ? {name: nextRoute.profileName} : undefined).replace(/^#/, ''));
  }
  function syncRoute() {
    updateRoute();
  }
  function navigateRoute(name: RouteName, params?: Record<string, string>) {
    const href = routeHref(name, params);
    setLocationHash(href);
    updateRoute(parseRoute(href));
  }
  useWindowEvent('hashchange', syncRoute);

  useEffect(() => {
    if (!locationHash()) {
      const storedUrl = lastUrl();
      setLocationHash(storedUrl || routeHref('about'));
    }
    syncRoute();
  }, []);
  return {navigateRoute, route};
}

function SwitchProfilePreview({
  onDownload,
  onOptionsReplaceDraft,
  onSourceEditorStateChange,
  options,
  profile,
  sourceEditor,
  showConditionHelp = false,
  updatingProfiles,
  updateOptionsDraft,
  updateProfile
}: {
  onDownload: (name: string) => void;
  onOptionsReplaceDraft?: (nextOptions: Options) => void;
  onSourceEditorStateChange?: (state: {editSource: boolean; source?: SwitchRuleSourceState | null}) => void;
  options: Options;
  profile: NamedSwitchProfileModel;
  sourceEditor?: {editSource: boolean; source?: SwitchRuleSourceState | null} | null;
  showConditionHelp?: boolean;
  updatingProfiles: Record<string, boolean>;
  updateOptionsDraft: (updater: (options: Options) => void | false) => void;
  updateProfile: <TProfile extends ProfileModel = ProfileModel>(profileName: string, updater: (profile: TProfile) => void) => void;
}) {
  const identity = attachedIdentity(profile.name);
  const attached = attachedProfileOption(options, identity) || null;
  const attachedOptions = createAttachedOptions(profile, attached);
  const showConditionTypes = numberOption(options['-showConditionTypes'], detectAdvancedConditionTypes(profile));

  function mutateProfile(updater: (nextProfile: SwitchProfileModel) => void) {
    updateProfile<SwitchProfileModel>(profile.name, updater);
  }

  function mutateAttached(updater: (nextAttached: RuleListProfileModel) => void) {
    updateOptionsDraft((nextOptions) => {
      const nextAttached = attachedProfileDraft(nextOptions, identity);
      updater(nextAttached);
      updateProfileRevision(nextAttached);
      nextOptions[identity.attachedKey] = nextAttached;
    });
  }

  function updateAttachedField<TField extends RuleListProfileAttachedField>(field: TField, value: RuleListProfileModel[TField]) {
    mutateAttached((nextAttached) => {
      nextAttached[field] = value;
    });
  }

  function applySource(source: SwitchRuleSourceState) {
    const nextOptions = cloneOptions(options);
    const result = applySourceToOptions(nextOptions, profile.name, source);
    if (result.ok === false) {
      return result;
    }
    onSourceEditorStateChange?.({
      editSource: false,
      source: null
    });
    onOptionsReplaceDraft?.(nextOptions);
    return {
      ok: true
    };
  }

  return (
    <SwitchProfileStatefulContent
      attached={attached}
      attachedOptions={attachedOptions}
      confirmDeletion={!!options['-confirmDeletion']}
      editSource={!!sourceEditor?.editSource}
      loadRules
      onApplySource={applySource}
      onAddRule={() => mutateProfile((nextProfile) => addRule(nextProfile, attachedOptions.defaultProfileName))}
      onAttachNew={() =>
        updateOptionsDraft((nextOptions) => {
          const nextProfile = profileOption<SwitchProfileModel>(nextOptions, profile.name);
          if (!nextProfile) {
            return;
          }
          attachNew(nextOptions, identity.attachedKey, nextProfile, identity.attachedName, attachedOptions);
          updateProfileRevision(nextProfile);
        })
      }
      onAttachedChange={updateAttachedField}
      onAttachedEnabledChange={(enabled) =>
        mutateProfile((nextProfile) => {
          setAttachedEnabled(nextProfile, attached, identity.attachedName, attachedOptions, enabled, attachedOptions.enabled);
        })
      }
      onAttachedMatchProfileChange={(name) =>
        mutateAttached((nextAttached) => {
          nextAttached.matchProfileName = name;
        })
      }
      onCloneRule={(index) => mutateProfile((nextProfile) => cloneRule(nextProfile, index))}
      onConditionFieldChange={(index, field, value) =>
        mutateProfile((nextProfile) => {
          updateConditionField(nextProfile.rules?.[index], field, value);
        })
      }
      onConditionTypeChange={(index, type) =>
        mutateProfile((nextProfile) => {
          updateConditionType(nextProfile.rules?.[index], type);
        })
      }
      onDefaultProfileChange={(name) =>
        updateOptionsDraft((nextOptions) => {
          const nextProfile = profileOption<SwitchProfileModel>(nextOptions, profile.name);
          if (!nextProfile) {
            return;
          }
          const nextAttached = attachedProfileOption(nextOptions, identity) || null;
          setDefaultProfile(nextProfile, nextAttached, attachedOptions, name);
          if (nextAttached) {
            updateProfileRevision(nextAttached);
          }
          updateProfileRevision(nextProfile);
        })
      }
      onDownload={onDownload}
      onEditorStateChange={onSourceEditorStateChange}
      onIpConditionInputChange={(index, value) =>
        mutateProfile((nextProfile) => {
          updateIpCondition(nextProfile.rules?.[index], value);
        })
      }
      onMoveRule={(fromIndex, toIndex) =>
        mutateProfile((nextProfile) => {
          moveRule(nextProfile.rules || [], fromIndex, toIndex);
        })
      }
      onNoteChange={(index, note) =>
        mutateProfile((nextProfile) => {
          updateRuleNote(nextProfile.rules?.[index], note);
        })
      }
      onProfileChange={(index, name) =>
        mutateProfile((nextProfile) => {
          updateRuleProfile(nextProfile.rules?.[index], name);
        })
      }
      onRemoveAttached={() =>
        updateOptionsDraft((nextOptions) => {
          const nextProfile = profileOption<SwitchProfileModel>(nextOptions, profile.name);
          const nextAttached = attachedProfileOption(nextOptions, identity);
          if (nextProfile && nextAttached) {
            removeAttached(nextOptions, identity.attachedKey, nextProfile, nextAttached);
            updateProfileRevision(nextProfile);
          }
        })
      }
      onRemoveRule={(index) => mutateProfile((nextProfile) => removeRule(nextProfile, index))}
      onResetRules={() => mutateProfile((nextProfile) => resetRuleProfiles(nextProfile, attachedOptions.defaultProfileName))}
      onWeekdayChange={(index, dayIndex, selected) =>
        mutateProfile((nextProfile) => {
          updateRuleWeekday(nextProfile.rules?.[index], dayIndex, selected);
        })
      }
      options={options}
      profile={profile}
      rules={profile.rules || []}
      show={showConditionHelp}
      showConditionTypes={showConditionTypes}
      source={sourceEditor?.source || null}
      updating={attached ? profileUpdating(updatingProfiles, attached.name) : false}
    />
  );
}

export function OptionsApp() {
  const {navigateRoute, route} = useHashRoute();
  const [savedOptions, setSavedOptions] = useState<Options | null>(null);
  const [options, setOptions] = useState<Options | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'error'>('loading');
  const [updatingProfiles, setUpdatingProfiles] = useState<Record<string, boolean>>({});
  const [modal, setModal] = useState<ModalState>(null);
  const [guide, setGuide] = useState<OptionsGuideState | null>(null);
  const [pendingOptionsGuideProfileName, setPendingOptionsGuideProfileName] = useState('');
  const [pendingApplyAction, setPendingApplyAction] = useState<AppliedOptionsAction | null>(null);
  const [pendingSourceDraftAction, setPendingSourceDraftAction] = useState<PendingDraftAction | null>(null);
  const [pendingSourceEditor, setPendingSourceEditor] = useState<PendingSourceEditorState>(null);
  const [alert, setAlert] = useState<AlertState>(null);
  const [alertShown, setAlertShown] = useState(false);
  const [profileScopeCapabilities, setProfileScopeCapabilities] = useState<ProfileScopeCapabilities>(DEFAULT_PROFILE_SCOPE_CAPABILITIES);
  const [proxyAuthCapabilities, setProxyAuthCapabilities] = useState<ProxyAuthCapabilities>(DEFAULT_PROXY_AUTH_CAPABILITIES);
  const [proxyDnsCapabilities, setProxyDnsCapabilities] = useState<ProxyDnsCapabilities>(DEFAULT_PROXY_DNS_CAPABILITIES);
  const [profileScopeContainers, setProfileScopeContainers] = useState<ProfileScopeContainerInfo[]>([]);
  const [activeProfileName, setActiveProfileName] = useState('direct');
  const isExperimental = useMemo(hasProxyScriptApi, []);
  const pacProfilesUnsupported = isExperimental;

  useEffect(() => {
    Promise.all([loadOptions(), loadOptionsAppInitialState()])
      .then(([loadedOptions, initialState]) => {
        const cloned = cloneOptions(loadedOptions);
        setSavedOptions(cloned);
        setOptions(cloneOptions(cloned));
        setProfileScopeCapabilities(initialState.profileScopeCapabilities);
        setProxyAuthCapabilities(initialState.proxyAuthCapabilities);
        setProxyDnsCapabilities(initialState.proxyDnsCapabilities);
        setProfileScopeContainers(initialState.profileScopeContainers);
        setActiveProfileName(initialState.activeProfileName);
        setStatus('ready');
        showFirstRun(cloned, initialState.firstRun);
      })
      .catch((err) => {
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
  const pendingSourceDraftDirty = Boolean(pendingSourceEditor?.editSource && pendingSourceEditor.source?.touched);
  const showProfileScope = useMemo(
    () => hasVisibleProfileScopes(savedOptions, profileScopeCapabilities),
    [savedOptions, profileScopeCapabilities]
  );
  const appliedVisibleProfileScopes = useMemo(
    () => visibleProfileScopes(savedOptions, profileScopeCapabilities),
    [savedOptions, profileScopeCapabilities]
  );

  useEffect(() => {
    if (status !== 'ready' || route.name !== 'profileScope' || showProfileScope) {
      return;
    }
    navigate('ui');
  }, [route.name, showProfileScope, status]);

  useEffect(() => {
    if (status !== 'ready' || !appliedVisibleProfileScopes.container) {
      return;
    }
    loadProfileScopeContainerNames();
  }, [appliedVisibleProfileScopes.container, status]);

  useEffect(() => {
    if (
      status !== 'ready' ||
      !pendingOptionsGuideProfileName ||
      route.name !== 'profile' ||
      route.profileName !== pendingOptionsGuideProfileName ||
      modal
    ) {
      return;
    }

    let cancelled = false;
    let timeout: ReturnType<typeof setWindowTimeout> | undefined;

    function startWhenReady(attempt = 0) {
      const target = document.querySelector('.fixed-servers');
      if (!target && attempt < 30) {
        timeout = setWindowTimeout(() => startWhenReady(attempt + 1), 100);
        return;
      }
      if (cancelled) {
        return;
      }
      setPendingOptionsGuideProfileName('');
      if (target) {
        setGuide({
          kind: 'options',
          stepIndex: 0
        });
      }
    }

    timeout = setWindowTimeout(startWhenReady, 0);
    return () => {
      cancelled = true;
      clearWindowTimeout(timeout);
    };
  }, [modal, pendingOptionsGuideProfileName, route.name, route.profileName, status]);

  useBeforeUnload(
    dirty || pendingSourceDraftDirty ? () => message('options_optionsNotSaved', 'Options are not saved.') : null
  );

  function showFirstRun(loadedOptions: Options, firstRun: string) {
    if (!firstRun) {
      return;
    }
    setState('firstRun', '');
    const profileName = firstFixedProfileName(loadedOptions);
    if (!profileName) {
      return;
    }
    setModal({
      kind: 'welcome',
      profileName,
      upgrade: firstRun === 'upgrade'
    });
  }

  function showAlert(nextAlert: AlertState) {
    setAlert(nextAlert);
    setAlertShown(Boolean(nextAlert));
    if (nextAlert) {
      setWindowTimeout(() => setAlertShown(false), 3000);
    }
  }

  function showProfileNotFound(profileName: string) {
    showAlert({
      type: 'error',
      message: message('options_profileNotFound', `Profile not found: ${profileName}`, profileName)
    });
  }

  function replaceOptions(nextOptions: Options, opts?: {dirty?: boolean}) {
    const cloned = cloneOptions(nextOptions);
    setOptions(cloneOptions(cloned));
    setPendingSourceEditor(null);
    if (!opts?.dirty) {
      setSavedOptions(cloned);
    }
  }

  function updateOptions(nextOptions: Options) {
    setOptions(cloneOptions(nextOptions));
  }

  function loadProfileScopeContainerNames() {
    callBackground('refreshProfileScopeContainerNames')
      .then((containers) => {
        if (Array.isArray(containers)) {
          setProfileScopeContainers(containers);
        }
      })
      .catch(() => {});
  }

  function updateOptionsDraft(updater: (nextOptions: Options) => void | false) {
    setOptions((current) => {
      if (!current) {
        return current;
      }
      const nextOptions = cloneOptions(current);
      if (updater(nextOptions) === false) {
        return current;
      }
      return nextOptions;
    });
  }

  function flushPendingSourceEditor(sourceOptions: Options) {
    const pending = pendingSourceEditor;
    if (!pending?.editSource || !pending.source?.touched) {
      return {
        ok: true,
        options: sourceOptions
      };
    }
    const nextOptions = cloneOptions(sourceOptions);
    const result = applySourceToOptions(nextOptions, pending.profileName, pending.source);
    if (result.ok === false) {
      setPendingSourceEditor({
        editSource: true,
        profileName: pending.profileName,
        source: result.source || pending.source
      });
      return {
        ok: false,
        options: sourceOptions
      };
    }
    setPendingSourceEditor(null);
    return {
      ok: true,
      options: nextOptions
    };
  }

  function updateProfile<TProfile extends ProfileModel = ProfileModel>(
    profileName: string,
    updater: (profile: TProfile) => void,
    defaults?: Partial<TProfile>
  ) {
    setOptions((current) => {
      if (!current) {
        return current;
      }
      const nextOptions = cloneOptions(current);
      const profile = profileDraft<TProfile>(nextOptions, profileName, defaults);
      updater(profile);
      updateProfileRevision(profile);
      setProfileOption(nextOptions, profileName, profile);
      return nextOptions;
    });
  }

  function updateProfileField<TProfile extends ProfileModel, TField extends keyof TProfile>(
    profileName: string,
    field: TField,
    value: TProfile[TField]
  ) {
    updateProfile<TProfile>(profileName, (nextProfile) => {
      nextProfile[field] = value;
    });
  }

  function updateFixedProfileBypassList(profileName: string, value: FixedProfileBypassCondition[]) {
    updateProfileField<FixedProfileModel, 'bypassList'>(profileName, 'bypassList', value);
  }

  function updatePacProfileField(profileName: string, field: PacProfileField, value: string) {
    updateProfileField<PacProfileModel, PacProfileField>(profileName, field, value);
  }

  function updateRuleListProfileField(profileName: string, field: RuleListProfileField, value: RuleListProfileModel[RuleListProfileField]) {
    updateProfileField<RuleListProfileModel, RuleListProfileField>(profileName, field, value);
  }

  function updateVirtualProfileTarget(profileName: string, name: string) {
    updateProfileField<VirtualProfileModel, 'defaultProfileName'>(profileName, 'defaultProfileName', name);
  }

  function updateFixedProfileProxy(
    profileName: string,
    field: FixedProfileProxyField,
    value?: FixedProfileModel[FixedProfileProxyField],
    changeOptions?: FixedProfileProxyChangeOptions
  ) {
    updateProfile<FixedProfileModel>(profileName, (nextProfile) => {
      if (changeOptions?.clearAuth && nextProfile.auth) {
        nextProfile.auth[field] = void 0;
      }
      if (typeof value === 'undefined') {
        delete nextProfile[field];
        return;
      }
      nextProfile[field] = value;
    });
  }

  function updateProfileAuth(profileName: string, authKey: ProfileAuthKey, auth: ProfileAuth) {
    updateProfile<ProfileModel & {auth?: ProfileAuthMap}>(profileName, (nextProfile) => {
      if (!auth?.username) {
        if (nextProfile.auth) {
          delete nextProfile.auth[authKey];
        }
        return;
      }
      if (!nextProfile.auth) {
        nextProfile.auth = {};
      }
      nextProfile.auth[authKey] = auth;
    });
  }

  function applyOptions(opts?: {silent?: boolean}) {
    if (!savedOptions || !options) {
      return Promise.resolve();
    }
    const flushed = flushPendingSourceEditor(options);
    if (!flushed.ok) {
      return Promise.reject(new Error('source parse error'));
    }
    const nextOptions = flushed.options;
    if (nextOptions !== options) {
      setOptions(cloneOptions(nextOptions));
    }
    const patch = optionsPatch(savedOptions, nextOptions);
    if (isPatchEmpty(patch)) {
      setSavedOptions(cloneOptions(nextOptions));
      if (!opts?.silent) {
        showAlert({type: 'success', i18n: 'options_saveSuccess'});
      }
      return Promise.resolve(nextOptions);
    }
    setStatus('saving');
    return patchOptions(patch)
      .then((loadedOptions) => {
        replaceOptions(loadedOptions);
        setStatus('ready');
        if (!opts?.silent) {
          showAlert({type: 'success', i18n: 'options_saveSuccess'});
        }
        return loadedOptions;
      })
      .catch((err) => {
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
    const nextOptions = cloneOptions(savedOptions);
    setOptions(nextOptions);
    setPendingSourceEditor(null);
    showAlert(null);
    if (route.name === 'profile' && route.profileName && !profileByName(nextOptions, route.profileName)) {
      navigate('ui');
    }
  }

  function requireAppliedOptions(action: AppliedOptionsAction) {
    if (!options) {
      return Promise.resolve();
    }
    if (pendingSourceDraftDirty) {
      setPendingSourceDraftAction(() => (nextOptions?: Options) => requireAppliedOptionsForOptions(action, nextOptions || options));
      setModal({
        kind: 'sourceDraft'
      });
      return Promise.resolve();
    }
    return requireAppliedOptionsForOptions(action, options);
  }

  function requireAppliedOptionsForOptions(action: AppliedOptionsAction, sourceOptions: Options) {
    if (savedOptions && sameValue(savedOptions, sourceOptions)) {
      return Promise.resolve(action(sourceOptions));
    }
    setPendingApplyAction(() => action);
    setModal({
      kind: 'applyOptions'
    });
    return Promise.resolve();
  }

  function requireCleanSourceDraft(action: PendingDraftAction) {
    if (!pendingSourceDraftDirty || !options) {
      return Promise.resolve(action(options || undefined));
    }
    setPendingSourceDraftAction(() => action);
    setModal({
      kind: 'sourceDraft'
    });
    return Promise.resolve();
  }

  function confirmApplyOptions() {
    const action = pendingApplyAction;
    setModal(null);
    setPendingApplyAction(null);
    return applyOptions({silent: true})
      .then((loadedOptions) => {
        const appliedOptions = loadedOptions || options;
        if (!appliedOptions || !action) {
          return;
        }
        return Promise.resolve(action(appliedOptions));
      })
      .catch(() => undefined);
  }

  function applyPendingSourceDraft() {
    if (!options) {
      return null;
    }
    const flushed = flushPendingSourceEditor(options);
    if (!flushed.ok) {
      return null;
    }
    if (flushed.options !== options) {
      setOptions(cloneOptions(flushed.options));
    }
    return flushed.options;
  }

  function confirmSourceDraft(actionType: 'applySource' | 'discardSource') {
    const action = pendingSourceDraftAction;
    setPendingSourceDraftAction(null);
    let nextOptions = options || undefined;
    if (actionType === 'applySource') {
      const flushedOptions = applyPendingSourceDraft();
      if (!flushedOptions) {
        setModal(null);
        return Promise.resolve();
      }
      nextOptions = flushedOptions;
    }
    if (actionType === 'discardSource') {
      setPendingSourceEditor(null);
    }
    setModal(null);
    return Promise.resolve(action?.(nextOptions)).catch(() => undefined);
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
    return requireAppliedOptions(() => downloadProfileNow(profileName));
  }

  function downloadProfileNow(profileName: string) {
    if (!profileName) {
      return Promise.resolve();
    }
    setProfileUpdating(profileName, true);
    return Promise.resolve()
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

  function requestNewProfile() {
    return requireAppliedOptions(() => {
      setModal({kind: 'newProfile'});
    });
  }

  function createProfile(profileSpec: NewProfileSpec) {
    if ('duplicateProfileName' in profileSpec) {
      updateOptionsDraft((nextOptions) => {
        duplicateProfileOption(nextOptions, profileSpec.duplicateProfileName, profileSpec.name);
      });
      setModal(null);
      navigate('profile', {
        name: profileSpec.name
      });
      return;
    }

    updateOptionsDraft((nextOptions) => {
      const profile = OmegaPac.Profiles.create(profileSpec);
      const choice = Math.floor(Math.random() * PROFILE_COLORS.length);
      if (profile.color == null) {
        profile.color = PROFILE_COLORS[choice];
      }
      updateProfileRevision(profile);
      setProfileOption(nextOptions, profileSpec.name, profile);
    });
    setModal(null);
    navigate('profile', {
      name: profileSpec.name
    });
  }

  function requestRenameProfile(profile: Profile | null | undefined) {
    if (!profile) {
      return;
    }
    const fromName = profile.name;
    return requireAppliedOptions(() =>
      setModal({
        fromName,
        kind: 'renameProfile'
      })
    );
  }

  function renameProfile(fromName: string, toName: string) {
    setModal(null);
    if (!fromName || !toName || fromName === toName) {
      return Promise.resolve();
    }
    const sourceOptions = options ? cloneOptions(options) : {};
    const identity = attachedIdentity(fromName);
    const targetIdentity = attachedIdentity(toName);
    const attachedName = identity.attachedName;
    const toAttachedName = targetIdentity.attachedName;
    const hadAttached = Boolean(attachedProfileOption(sourceOptions, identity));
    const targetAttachedExists = Boolean(attachedProfileOption(sourceOptions, targetIdentity));
    const originalDefaultProfileName = targetAttachedExists
      ? profileOption<NamedSwitchProfileModel>(sourceOptions, fromName, isSwitchProfile)?.defaultProfileName
      : undefined;
    const restoredDefaultProfileName = originalDefaultProfileName === attachedName ? toAttachedName : originalDefaultProfileName;

    return Promise.resolve()
      .then(() => renameProfileFromBackground(fromName, toName))
      .then((loadedOptions) => {
        if (!hadAttached) {
          return loadedOptions;
        }
        let chain = Promise.resolve(loadedOptions);
        if (targetAttachedExists) {
          chain = chain.then((currentOptions) => {
            const nextOptions = cloneOptions(currentOptions);
            const nextProfile = profileOption<SwitchProfileModel>(nextOptions, toName);
            if (nextProfile) {
              nextProfile.defaultProfileName = 'direct';
              updateProfileRevision(nextProfile);
            }
            deleteProfileOption(nextOptions, toAttachedName);
            const patch = optionsPatch(currentOptions, nextOptions);
            return isPatchEmpty(patch) ? currentOptions : patchOptions(patch);
          });
        }
        chain = chain.then(() => renameProfileFromBackground(attachedName, toAttachedName));
        if (restoredDefaultProfileName) {
          chain = chain.then((currentOptions) => {
            const nextOptions = cloneOptions(currentOptions);
            const nextProfile = profileOption<SwitchProfileModel>(nextOptions, toName);
            if (nextProfile) {
              nextProfile.defaultProfileName = restoredDefaultProfileName;
              updateProfileRevision(nextProfile);
            }
            const patch = optionsPatch(currentOptions, nextOptions);
            return isPatchEmpty(patch) ? currentOptions : patchOptions(patch);
          });
        }
        return chain;
      })
      .then((loadedOptions) => {
        replaceOptions(loadedOptions);
        navigate('profile', {
          name: toName
        });
      })
      .catch((err) => {
        showAlert({
          type: 'error',
          message: err?.message || String(err)
        });
      });
  }

  function requestDeleteProfile(profile: Profile | null | undefined) {
    if (!profile) {
      return;
    }
    const profileName = profile.name;
    return requireAppliedOptions((appliedOptions) => showDeleteProfile(appliedOptions, profileName));
  }

  function showDeleteProfile(sourceOptions: Options, profileName: string) {
    const profile = profileByName(sourceOptions, profileName);
    if (!profile) {
      showProfileNotFound(profileName);
      return;
    }
    const refs = referencedProfiles(profile.name, sourceOptions);
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

  function deleteProfile(profile: Profile | null | undefined) {
    if (!profile) {
      setModal(null);
      return;
    }
    const profileName = profile.name;
    updateOptionsDraft((nextOptions) => {
      deleteAttachedProfileOption(nextOptions, profileName);
      deleteProfileOption(nextOptions, profileName);
      deleteProfileScopeAssignments(nextOptions, profileName);
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

  function exportRuleList(profileName: string) {
    if (!profileName) {
      return Promise.resolve();
    }
    return requireAppliedOptions((appliedOptions) => exportRuleListNow(appliedOptions, profileName));
  }

  function exportRuleListNow(sourceOptions: Options, profileName: string) {
    const profile = profileByName(sourceOptions, profileName);
    if (!isSwitchProfile(profile)) {
      showProfileNotFound(profileName);
      return;
    }
    const identity = attachedIdentity(profile.name);
    const attached = attachedProfileOption(sourceOptions, identity) || null;
    if (profile.defaultProfileName === identity.attachedName && !attached) {
      showProfileNotFound(identity.attachedName);
      return;
    }
    const attachedOptions = createAttachedOptions(profile, attached);
    const defaultProfileName = attachedOptions.defaultProfileName || 'direct';
    if (!profileByName(sourceOptions, defaultProfileName)) {
      showProfileNotFound(defaultProfileName);
      return;
    }
    const showConditionTypes = numberOption(sourceOptions['-showConditionTypes'], detectAdvancedConditionTypes(profile));
    const {legacy} = exportRuleListOptions(sourceOptions, showConditionTypes);
    const text = legacy
      ? composeLegacyRuleList(profile.rules || [], defaultProfileName)
      : composeOmegaRuleList(profile.rules || [], defaultProfileName);
    const fileName = safeProfileFileName(profile.name);
    downloadBlob(
      new Blob([text], {type: 'text/plain;charset=utf-8'}),
      legacy ? `SwitchyRules_${fileName}.ssrl` : `OmegaRules_${fileName}.sorl`
    );
  }

  function exportScript(profileName: string) {
    if (!profileName) {
      return Promise.resolve();
    }
    return requireAppliedOptions((appliedOptions) => exportScriptNow(appliedOptions, profileName));
  }

  function exportScriptNow(sourceOptions: Options, profileName: string) {
    const profile = profileByName(sourceOptions, profileName);
    if (!profile) {
      showProfileNotFound(profileName);
      return;
    }
    if (isBuiltinProfile(profile)) {
      return;
    }
    const exported = createPacExport(sourceOptions, profileName);
    downloadBlob(exported.blob, exported.fileName);
    if (exported.missingProfile) {
      showProfileNotFound(exported.missingProfile);
    }
  }

  function requestPacProxyAuth(profile: NamedPacProfileModel | null | undefined) {
    if (!profile) {
      return;
    }
    const profileName = profile.name;
    setModal({
      auth: cloneAuth(profile.auth?.all),
      authKey: 'all',
      kind: 'proxyAuth',
      profileName
    });
  }

  function requestFixedProxyAuth(profile: NamedFixedProfileModel | null | undefined, scheme: FixedProfileScheme) {
    if (!profile) {
      return;
    }
    const authKey = FIXED_PROXY_AUTH_KEYS[scheme];
    const proxy = profile[authKey];
    if (!proxy?.scheme) {
      return;
    }
    const profileName = profile.name;
    setModal({
      auth: cloneAuth(profile.auth?.[authKey]),
      authKey,
      kind: 'proxyAuth',
      profileName
    });
  }

  function saveProxyAuth(auth: ProfileAuth, authModal: Extract<ModalState, {kind: 'proxyAuth'}>) {
    updateProfileAuth(authModal.profileName, authModal.authKey, auth);
    setModal(null);
  }

  function requestReplaceProfile(fromName: string, toName: string) {
    if (!fromName || !toName) {
      return;
    }
    return requireAppliedOptions(() =>
      setModal({
        fromName,
        kind: 'replaceProfile',
        toName
      })
    );
  }

  function replaceProfileRefs(fromName: string, toName: string) {
    setModal(null);
    return Promise.resolve()
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

  function resetAllOptions() {
    setModal(null);
    return resetOptions()
      .then((loadedOptions) => {
        replaceOptions(loadedOptions);
        navigate('about');
        showAlert({
          type: 'success',
          i18n: 'options_resetSuccess'
        });
      })
      .catch((err) => {
        showAlert({
          type: 'error',
          message: err?.message || String(err)
        });
      });
  }

  function downloadLog() {
    const blob = new Blob([window.localStorage.getItem('log') || ''], {
      type: 'text/plain;charset=utf-8'
    });
    downloadBlob(blob, `OmegaLog_${Date.now()}.txt`);
  }

  function closeWelcome(result: string, profileName: string) {
    setModal(null);
    if (result === 'show') {
      setPendingOptionsGuideProfileName(profileName);
      navigate('profile', {
        name: profileName
      });
    }
  }

  function skipGuide() {
    setGuide(null);
  }

  function nextGuide() {
    setGuide((current) => {
      if (!current) {
        return null;
      }
      if (current.stepIndex >= guideStepCount(current) - 1) {
        return null;
      }
      return {
        ...current,
        stepIndex: current.stepIndex + 1
      };
    });
  }

  function navigate(name: string, params?: Record<string, string>) {
    navigateRoute(name as RouteName, params);
  }

  function requestNavigate(name: string, params?: Record<string, string>) {
    return requireCleanSourceDraft(() => navigate(name, params));
  }

  function requestApplyOptions() {
    return requireCleanSourceDraft((sourceOptions) => {
      if (sourceOptions && sourceOptions !== options) {
        const patch = savedOptions ? optionsPatch(savedOptions, sourceOptions) : {};
        if (savedOptions && isPatchEmpty(patch)) {
          setSavedOptions(cloneOptions(sourceOptions));
          showAlert({type: 'success', i18n: 'options_saveSuccess'});
          return Promise.resolve(sourceOptions);
        }
        if (savedOptions) {
          setStatus('saving');
          return patchOptions(patch)
            .then((loadedOptions) => {
              replaceOptions(loadedOptions);
              setStatus('ready');
              showAlert({type: 'success', i18n: 'options_saveSuccess'});
              return loadedOptions;
            })
            .catch((err) => {
              setStatus('ready');
              showAlert({
                type: 'error',
                message: err?.message || String(err)
              });
              return Promise.reject(err);
            });
        }
      }
      return applyOptions();
    });
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
            profileScopeCapabilities={profileScopeCapabilities}
            proxyDnsCapabilities={proxyDnsCapabilities}
            onOpenShortcutConfig={openShortcutConfig}
            onOptionsChange={updateOptions}
          />
        </div>
      );
    }
    if (route.name === 'general') {
      return (
        <div className="react-settings-host-general">
          <GeneralSettings
            activeProfileName={activeProfileName}
            embedded
            options={options}
            onActiveProfileNameChange={setActiveProfileName}
            onOptionsChange={updateOptions}
          />
        </div>
      );
    }
    if (route.name === 'io') {
      return (
        <div className="react-settings-host-import-export">
          <ImportExport
            embedded
            options={options}
            optionsDirty={dirty || pendingSourceDraftDirty}
            onApplyOptions={applyOptions}
            onImportSuccess={() => showAlert({type: 'success', i18n: 'options_importSuccess'})}
            onOptionsReplace={replaceOptions}
          />
        </div>
      );
    }
    if (route.name === 'routeTrace') {
      return (
        <div className="react-settings-host-route-trace">
          <RouteTrace currentProfileName={activeProfileName} embedded options={options} />
        </div>
      );
    }
    if (route.name === 'profileScope') {
      const visibleScopes = appliedVisibleProfileScopes;
      if (!visibleScopes.tab && !visibleScopes.group && !visibleScopes.container && !visibleScopes.window) {
        return (
          <div className="react-settings-host-profile-scope">
            <div className="page-header">
              <h2>{message('options_tab_profileScope', 'Profile Scope')}</h2>
            </div>
          </div>
        );
      }
      return (
        <div className="react-settings-host-profile-scope">
          <ProfileScopeSettingsPage
            appliedOptions={savedOptions}
            capabilities={profileScopeCapabilities}
            containers={profileScopeContainers}
            onOptionsChange={updateOptions}
            onRefreshContainers={loadProfileScopeContainerNames}
            options={options}
            visibleScopes={visibleScopes}
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
      const referenced = () => {
        if (typeof OmegaPac === 'undefined' || !OmegaPac?.Profiles?.referencedBySet) {
          return false;
        }
        return Object.keys(OmegaPac.Profiles.referencedBySet(profile.name, options)).length > 0;
      };
      const content = (() => {
        if (isFixedProfile(profile)) {
          return (
            <FixedProfileContent
              profile={profile}
              proxyAuthCapabilities={proxyAuthCapabilities}
              showSocks5LocalDnsOption={proxyDnsCapabilities.socks5 === true && options['-showSocks5LocalDnsOption'] === true}
              onBypassListChange={(value) => updateFixedProfileBypassList(profile.name, value)}
              onEditProxyAuth={(scheme) => requestFixedProxyAuth(profile, scheme)}
              onProxyChange={(field, value, changeOptions) => updateFixedProfileProxy(profile.name, field, value, changeOptions)}
            />
          );
        }
        if (isPacProfile(profile)) {
          return (
            <PacProfile
              profile={profile}
              referenced={referenced()}
              onDownload={downloadProfile}
              onEditProxyAuth={() => requestPacProxyAuth(profile)}
              onProfileChange={(field, value) => updatePacProfileField(profile.name, field, value)}
              pacProfilesUnsupported={pacProfilesUnsupported}
              updating={profileUpdating(updatingProfiles, profile.name)}
            />
          );
        }
        if (isRuleListProfile(profile)) {
          return (
            <RuleListProfile
              options={options}
              profile={profile}
              onDownload={downloadProfile}
              onProfileChange={(field, value) => updateRuleListProfileField(profile.name, field, value)}
              updating={profileUpdating(updatingProfiles, profile.name)}
            />
          );
        }
        if (isVirtualProfile(profile)) {
          return (
            <VirtualProfile
              options={options}
              profile={profile}
              onReplaceProfile={requestReplaceProfile}
              onTargetChange={(name) => updateVirtualProfileTarget(profile.name, name)}
            />
          );
        }
        if (isSwitchProfile(profile)) {
          const sourceEditor = pendingSourceEditor?.profileName === profile.name ? pendingSourceEditor : null;
          return (
            <SwitchProfilePreview
              onDownload={downloadProfile}
              onOptionsReplaceDraft={(nextOptions) => setOptions(cloneOptions(nextOptions))}
              onSourceEditorStateChange={(state) =>
                setPendingSourceEditor(
                  state.editSource || state.source
                    ? {
                        editSource: state.editSource,
                        profileName: profile.name,
                        source: state.source || null
                      }
                    : null
                )
              }
              options={options}
              profile={profile}
              sourceEditor={sourceEditor}
              updatingProfiles={updatingProfiles}
              updateOptionsDraft={updateOptionsDraft}
              updateProfile={updateProfile}
              showConditionHelp={route.params?.help === 'condition'}
            />
          );
        }
        return <UnsupportedProfile profile={profile} />;
      })();
      const switchProfile = isSwitchProfile(profile) ? profile : null;
      const showConditionTypes = switchProfile
        ? numberOption(options['-showConditionTypes'], detectAdvancedConditionTypes(switchProfile))
        : 0;
      const ruleListOptions = switchProfile ? exportRuleListOptions(options, showConditionTypes) : {legacy: false, warning: false};
      return (
        <>
          <div className="react-profile-shell-host">
            <ProfileShell
              exportRuleListAvailable={!!switchProfile}
              exportRuleListWarning={ruleListOptions.warning}
              profile={profile}
              profileColor={profile.color}
              scriptable={!isBuiltinProfile(profile)}
              showProfileOptions={options['-showProfileOptions'] === true}
              onColorChange={(color) =>
                updateProfile(profile.name, (nextProfile) => {
                  nextProfile.color = color;
                })
              }
              onDelete={() => requestDeleteProfile(profile)}
              onExportRuleList={() => switchProfile && exportRuleList(switchProfile.name)}
              onExportScript={() => exportScript(profile.name)}
              onPopupHiddenChange={(hidden) =>
                updateProfile(profile.name, (nextProfile) => {
                  if (hidden) {
                    nextProfile.hiddenInPopup = true;
                  } else {
                    delete nextProfile.hiddenInPopup;
                  }
                })
              }
              onRename={() => requestRenameProfile(profile)}
            />
          </div>
          {content}
        </>
      );
    }
    return (
      <About embedded isExperimental={isExperimental} onDownloadLog={downloadLog} onResetOptions={() => setModal({kind: 'resetOptions'})} />
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
            onApply={requestApplyOptions}
            onDiscard={discardOptions}
            onNavigate={requestNavigate}
            onNewProfile={requestNewProfile}
            options={options}
            optionsDirty={dirty || pendingSourceDraftDirty || status === 'saving'}
            profileHref={(profile) => routeHref('profile', {name: profile.name})}
            profileScopeHref={routeHref('profileScope')}
            routeTraceHref={routeHref('routeTrace')}
            showProfileScope={showProfileScope}
            isExperimental={isExperimental}
            uiHref={routeHref('ui')}
          />
        </header>
        <main className="col-lg-10 col-sm-9 col-lg-offset-2 col-sm-offset-3">{renderContent()}</main>
      </div>
      <OptionsAlert alert={alert} shown={alertShown} onClose={() => setAlertShown(false)} />
      {modal?.kind === 'applyOptions' && options && (
        <ModalFrame
          onDismiss={() => {
            setPendingApplyAction(null);
            setModal(null);
          }}
        >
          <ConfirmModal
            kind="apply"
            onClose={confirmApplyOptions}
            onDismiss={() => {
              setPendingApplyAction(null);
              setModal(null);
            }}
            options={options}
          />
        </ModalFrame>
      )}
      {modal?.kind === 'sourceDraft' && options && (
        <ModalFrame
          onDismiss={() => {
            setPendingSourceDraftAction(null);
            setModal(null);
          }}
        >
          <ConfirmModal
            kind="sourceDraft"
            onClose={(value) => {
              if (value === 'discardSource') {
                confirmSourceDraft('discardSource');
                return;
              }
              confirmSourceDraft('applySource');
            }}
            onDismiss={() => {
              setPendingSourceDraftAction(null);
              setModal(null);
            }}
            options={options}
          />
        </ModalFrame>
      )}
      {modal?.kind === 'newProfile' && options && (
        <ModalFrame onDismiss={() => setModal(null)}>
          <NewProfileModal
            duplicatableProfiles={duplicatableProfilesFromOptions(options)}
            isProfileNameHidden={isProfileNameHidden}
            isProfileNameReserved={isProfileNameReserved}
            onClose={createProfile}
            onDismiss={() => setModal(null)}
            pacProfilesUnsupported={pacProfilesUnsupported}
            profileByName={(name) => profileByName(options, name)}
          />
        </ModalFrame>
      )}
      {modal?.kind === 'renameProfile' && options && (
        <ModalFrame onDismiss={() => setModal(null)}>
          <RenameProfileModal
            fromName={modal.fromName}
            isProfileNameHidden={isProfileNameHidden}
            isProfileNameReserved={isProfileNameReserved}
            onClose={(toName) => renameProfile(modal.fromName, toName)}
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
      {modal?.kind === 'resetOptions' && options && (
        <ModalFrame onDismiss={() => setModal(null)}>
          <ConfirmModal kind="reset" onClose={resetAllOptions} onDismiss={() => setModal(null)} options={options} />
        </ModalFrame>
      )}
      {modal?.kind === 'proxyAuth' && (
        <ModalFrame onDismiss={() => setModal(null)}>
          <ProxyAuthModal auth={modal.auth} onClose={(auth) => saveProxyAuth(auth, modal)} onDismiss={() => setModal(null)} />
        </ModalFrame>
      )}
      {modal?.kind === 'replaceProfile' && options && (
        <ModalFrame onDismiss={() => setModal(null)}>
          <ConfirmModal
            fromName={modal.fromName}
            kind="replaceProfile"
            onClose={(value) =>
              replaceProfileRefs(
                typeof value === 'object' ? value.fromName : modal.fromName,
                typeof value === 'object' ? value.toName : modal.toName
              )
            }
            onDismiss={() => setModal(null)}
            options={options}
            toName={modal.toName}
          />
        </ModalFrame>
      )}
      {modal?.kind === 'welcome' && (
        <ModalFrame onDismiss={() => setModal(null)}>
          <WelcomeModal
            onClose={(result) => closeWelcome(result, modal.profileName)}
            onDismiss={() => setModal(null)}
            upgrade={modal.upgrade}
          />
        </ModalFrame>
      )}
      {guide && <OptionsGuide guide={guide} onDone={skipGuide} onNext={nextGuide} onSkip={skipGuide} />}
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
