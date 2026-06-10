import React, {useEffect, useMemo, useState} from 'react';
import {setUiLocale} from './options_client';
import {createRoot} from 'react-dom/client';
import {
  PageInfo,
  PopupCondition,
  PopupConditionType,
  PopupMode,
  PopupState,
  Profile,
  ProfileKey,
  ProfileMap,
  callbackPromise,
  closePopup,
  getPopupPageInfo,
  getPopupState,
  popupMessage,
  popupTarget,
  waitForPopupTarget
} from './popup_target';

const defaultConditionType: PopupConditionType = 'HostWildcardCondition';

const conditionTypes: readonly PopupConditionType[] = [
  'HostWildcardCondition',
  'HostRegexCondition',
  'UrlWildcardCondition',
  'UrlRegexCondition',
  'KeywordCondition'
];

function isPopupConditionType(value: string): value is PopupConditionType {
  return conditionTypes.includes(value as PopupConditionType);
}

const iconForProfileType: Record<string, string> = {
  AutoDetectProfile: 'glyphicon-file',
  DirectProfile: 'glyphicon-transfer',
  FixedProfile: 'glyphicon-globe',
  PacProfile: 'glyphicon-file',
  RuleListProfile: 'glyphicon-list',
  SwitchProfile: 'glyphicon-retweet',
  SystemProfile: 'glyphicon-off',
  VirtualProfile: 'glyphicon-question-sign'
};

const orderForType: Record<string, number> = {
  FixedProfile: -2000,
  PacProfile: -1000,
  VirtualProfile: 1000,
  SwitchProfile: 2000,
  RuleListProfile: 3000
};

function compareProfile(a: Profile, b: Profile) {
  const diff = (orderForType[a.profileType || ''] || 0) - (orderForType[b.profileType || ''] || 0);
  if (diff !== 0) {
    return diff;
  }
  return a.name === b.name ? 0 : a.name < b.name ? -1 : 1;
}

function popupErrorMessage(error: unknown) {
  const candidate = error as {message?: unknown} | null | undefined;
  return String(candidate?.message || error);
}

function modeFromHash(): PopupMode {
  if (location.hash === '#!requestInfo') {
    return 'requestInfo';
  }
  if (location.hash === '#!external') {
    return 'external';
  }
  if (location.hash === '#!addRule') {
    return 'condition';
  }
  return 'menu';
}

function displayProfileName(profile?: Profile, override?: string) {
  if (override) {
    return override;
  }
  if (!profile) {
    return '';
  }
  return popupMessage(`profile_${profile.name}`, profile.name);
}

function profileKey(profileName?: string): ProfileKey | undefined {
  return profileName ? `+${profileName}` as ProfileKey : undefined;
}

function profileFromMap(availableProfiles?: ProfileMap, profileName?: string) {
  const key = profileKey(profileName);
  return key ? availableProfiles?.[key] : undefined;
}

function profileTarget(profile?: Profile, availableProfiles?: ProfileMap) {
  if (profile?.profileType === 'VirtualProfile') {
    return profileFromMap(availableProfiles, profile.defaultProfileName) || profile;
  }
  return profile;
}

function visibleMenuProfiles(state?: PopupState) {
  return Object.values(state?.availableProfiles || {})
    .filter((profile): profile is Profile => !!profile && !profile.builtin && profile.name.charAt(0) !== '_')
    .sort(compareProfile);
}

function visibleResultProfiles(state?: PopupState) {
  return (state?.validResultProfiles || [])
    .filter((name) => name.charAt(0) !== '_' || name.charAt(1) !== '_')
    .map((name) => profileFromMap(state?.availableProfiles, name))
    .filter((profile): profile is Profile => !!profile)
    .sort(compareProfile);
}

function isVisibleResultProfileName(name: string) {
  return name.charAt(0) !== '_' || name.charAt(1) !== '_';
}

function requestDomains(info?: PageInfo) {
  return Object.keys(info?.summary || {})
    .map((domain) => ({
      domain,
      errorCount: info?.summary?.[domain]?.errorCount || 0
    }))
    .sort((a, b) => b.errorCount - a.errorCount);
}

function suggestCondition(domain = ''): Record<PopupConditionType, string> {
  let currentDomain = domain;
  let currentDomainEscaped = currentDomain.replace(/\./g, '\\.');
  let domainLooksLikeIp = false;
  if (currentDomain.indexOf(':') >= 0) {
    domainLooksLikeIp = true;
    if (currentDomain[0] !== '[') {
      currentDomain = `[${currentDomain}]`;
      currentDomainEscaped = currentDomain.replace(/\./g, '\\.').replace(/\[/g, '\\[').replace(/\]/g, '\\]');
    }
  } else if (currentDomain[currentDomain.length - 1] >= '0' && currentDomain[currentDomain.length - 1] <= '9') {
    domainLooksLikeIp = true;
  }
  if (domainLooksLikeIp) {
    return {
      HostWildcardCondition: currentDomain,
      HostRegexCondition: `^${currentDomainEscaped}$`,
      UrlWildcardCondition: `*://${currentDomain}/*`,
      UrlRegexCondition: `://${currentDomainEscaped}(:\\d+)?/`,
      KeywordCondition: currentDomain
    };
  }
  return {
    HostWildcardCondition: `*.${currentDomain}`,
    HostRegexCondition: `(^|\\.)${currentDomainEscaped}$`,
    UrlWildcardCondition: `*://*.${currentDomain}/*`,
    UrlRegexCondition: `://([^/.]+\\.)*${currentDomainEscaped}(:\\d+)?/`,
    KeywordCondition: currentDomain
  };
}

function lastResultProfile(state?: PopupState, pageInfo?: PageInfo) {
  const profiles = visibleResultProfiles(state);
  const names = new Set(profiles.map((profile) => profile.name));
  if (pageInfo?.tempRuleProfileName && names.has(pageInfo.tempRuleProfileName)) {
    return pageInfo.tempRuleProfileName;
  }
  if (state?.lastProfileNameForCondition && names.has(state.lastProfileNameForCondition)) {
    return state.lastProfileNameForCondition;
  }
  return profiles[0]?.name || 'direct';
}

function profileTitle(profile?: Profile, availableProfiles?: ProfileMap) {
  let current = profile;
  let desc = '';
  while (current) {
    desc = current.desc || desc;
    const next = profileTarget(current, availableProfiles);
    if (!next || next === current) {
      break;
    }
    current = next;
  }
  return desc || profile?.name || '';
}

function PopupApp() {
  const [mode, setMode] = useState(modeFromHash);
  const [state, setState] = useState<PopupState>();
  const [pageInfo, setPageInfo] = useState<PageInfo>();
  const [error, setError] = useState('');
  const [defaultMenuOpen, setDefaultMenuOpen] = useState('');
  const [tempMenuOpen, setTempMenuOpen] = useState(false);
  const [keyboardHelp, setKeyboardHelp] = useState(false);

  useEffect(() => {
    waitForPopupTarget().then(() => Promise.all([
      getPopupState([
        'availableProfiles',
        'currentProfileCanAddRule',
        'currentProfileName',
        'externalProfile',
        'isSystemProfile',
        'lastProfileNameForCondition',
        'proxyNotControllable',
        'refreshOnProfileChange',
        'showExternalProfile',
        'uiLocale',
        'validResultProfiles'
      ]),
      getPopupPageInfo()
    ])).then(([nextState, nextPageInfo]) => {
      if (nextState.proxyNotControllable) {
        location.href = 'proxy_not_controllable.html';
        return;
      }
      return setUiLocale(nextState.uiLocale).then(() => {
        setState(nextState);
        setPageInfo(nextPageInfo);
      });
    }).catch((err) => {
      setError(err?.message || String(err));
    });
  }, []);

  useEffect(() => {
    const updateMode = () => setMode(modeFromHash());
    window.addEventListener('hashchange', updateMode);
    return () => window.removeEventListener('hashchange', updateMode);
  }, []);

  const customProfiles = useMemo(() => visibleMenuProfiles(state), [state]);
  const resultProfiles = useMemo(() => visibleResultProfiles(state), [state]);
  const hasResultProfiles = resultProfiles.length > 0;
  const hasPageDomain = !!pageInfo?.domain;
  const showRequestInfo = !!(pageInfo && (pageInfo.errorCount || 0) > 0);
  const showExternal = !!(state?.showExternalProfile && state.externalProfile && !showRequestInfo);
  const showAddCondition = !!(state?.currentProfileCanAddRule && hasPageDomain && hasResultProfiles);
  const showTempRule = !!(hasPageDomain && hasResultProfiles);

  function showMode(nextMode: Exclude<PopupMode, 'menu'>) {
    location.hash = nextMode === 'condition' ? '#!addRule' : `#!${nextMode}`;
    setMode(nextMode);
    setDefaultMenuOpen('');
    setTempMenuOpen(false);
  }

  function closeToMenu() {
    location.hash = '';
    setMode('menu');
  }

  function applyProfile(profileName: string) {
    popupTarget().applyProfile?.(profileName, closePopup);
  }

  function setDefaultProfile(profileName: string, defaultProfileName: string) {
    popupTarget().setDefaultProfile?.(profileName, defaultProfileName, closePopup);
  }

  function addTempRule(domain: string, profileName: string) {
    popupTarget().addTempRule?.(domain, profileName, () => {
      popupTarget().setState?.('lastProfileNameForCondition', profileName);
      closePopup();
    });
  }

  function showOptions() {
    popupTarget().openOptions?.(null, closePopup);
  }

  useEffect(() => {
    function clickById(id: string) {
      document.getElementById(id)?.click();
    }

    function visibleLinks() {
      return Array.from(document.querySelectorAll<HTMLAnchorElement>('.om-nav a'))
        .filter((element) => !element.closest('.om-hidden'));
    }

    function move(delta: number) {
      const links = visibleLinks();
      if (!links.length) {
        return;
      }
      const active = document.activeElement as HTMLElement | null;
      const currentIndex = active ? links.indexOf(active as HTMLAnchorElement) : -1;
      const nextIndex = currentIndex < 0
        ? delta > 0 ? 0 : links.length - 1
        : (currentIndex + delta + links.length) % links.length;
      links[nextIndex]?.focus();
    }

    function closeDropdown() {
      if (defaultMenuOpen || tempMenuOpen) {
        setDefaultMenuOpen('');
        setTempMenuOpen(false);
      }
    }

    function openDropdown() {
      const active = document.activeElement as HTMLElement | null;
      const item = active?.closest<HTMLElement>('.om-nav-item');
      const profileName = item?.dataset.defaultProfileName;
      if (profileName) {
        setDefaultMenuOpen(profileName);
      } else if (item?.classList.contains('om-nav-temprule')) {
        setTempMenuOpen(true);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      const tagName = (event.target as HTMLElement | null)?.tagName;
      if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
        return;
      }
      if (mode !== 'menu') {
        if (event.key === 'Escape') {
          closeToMenu();
          event.preventDefault();
        }
        return;
      }
      switch (event.keyCode) {
        case 38:
        case 75:
          move(-1);
          event.preventDefault();
          return;
        case 40:
        case 74:
          move(1);
          event.preventDefault();
          return;
        case 37:
        case 72:
          closeDropdown();
          event.preventDefault();
          return;
        case 39:
        case 76:
          openDropdown();
          event.preventDefault();
          return;
        case 191:
        case 63:
          setKeyboardHelp(true);
          event.preventDefault();
          return;
        case 48:
          clickById('js-direct');
          event.preventDefault();
          return;
        case 83:
          clickById('js-system');
          event.preventDefault();
          return;
        case 69:
          clickById('js-external');
          event.preventDefault();
          return;
        case 65:
        case 187:
          clickById('js-addrule');
          event.preventDefault();
          return;
        case 84:
          clickById('js-temprule');
          event.preventDefault();
          return;
        case 79:
          clickById('js-option');
          event.preventDefault();
          return;
        case 82:
          clickById('js-reqinfo');
          event.preventDefault();
          return;
        default:
          if (event.keyCode >= 49 && event.keyCode <= 57) {
            clickById(`js-profile-${event.keyCode - 48}`);
            event.preventDefault();
          }
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [customProfiles, defaultMenuOpen, mode, tempMenuOpen]);

  useEffect(() => {
    if (mode !== 'menu') {
      return;
    }
    const activeLink = document.querySelector<HTMLAnchorElement>('.om-nav-item.om-active > a');
    activeLink?.focus();
  }, [mode, state]);

  if (error) {
    return <form className="condition-form om-popup-form"><fieldset><p className="om-alert">{error}</p></fieldset></form>;
  }

  if (!state) {
    return <form className="condition-form om-popup-form"><fieldset>{popupMessage('options_profileDownloadStatusDownloading', 'Loading...')}</fieldset></form>;
  }

  if (mode === 'condition') {
    return <ConditionForm pageInfo={pageInfo} state={state} onClose={closeToMenu} />;
  }
  if (mode === 'requestInfo') {
    return <RequestInfoForm pageInfo={pageInfo} state={state} onClose={closeToMenu} />;
  }
  if (mode === 'external') {
    return <ExternalProfileForm state={state} onClose={closeToMenu} />;
  }

  const directProfile = profileFromMap(state.availableProfiles, 'direct') || {
    builtin: true,
    color: '#aaa',
    name: 'direct',
    profileType: 'DirectProfile'
  };
  const systemProfile = profileFromMap(state.availableProfiles, 'system') || {
    builtin: true,
    color: '#000',
    name: 'system',
    profileType: 'SystemProfile'
  };
  const currentProfileClass = state.isSystemProfile ? 'om-effective' : 'om-active';
  const tempRuleProfiles = resultProfiles
    .filter((profile) => profile.name.indexOf('__') !== 0)
    .filter((profile) => (
      !!pageInfo?.tempRuleProfileName ||
      resultProfiles.length === 1 ||
      profile.name !== state.currentProfileName
    ));

  return (
    <ul className="om-nav">
      <MenuProfileItem
        id="js-direct"
        keyboardKey={keyboardHelp ? '0' : ''}
        active={!state.isSystemProfile && state.currentProfileName === 'direct'}
        effective={state.isSystemProfile && state.currentProfileName === 'direct'}
        profile={directProfile}
        state={state}
        onClick={() => applyProfile('direct')}
      />
      <MenuProfileItem
        id="js-system"
        keyboardKey={keyboardHelp ? 'S' : ''}
        active={!!state.isSystemProfile}
        profile={systemProfile}
        state={state}
        onClick={() => applyProfile('system')}
      />
      {showExternal && (
        <MenuProfileItem
          id="js-external"
          keyboardKey={keyboardHelp ? 'E' : ''}
          active={state.currentProfileName === ''}
          profile={state.externalProfile}
          state={state}
          label={popupMessage('popup_externalProfile', '(External Profile)')}
          onClick={() => showMode('external')}
        />
      )}
      {showRequestInfo && (
        <li className="om-nav-item om-reqinfo">
          <a href="#!requestInfo" id="js-reqinfo" role="button" onClick={(event) => {
            event.preventDefault();
            showMode('requestInfo');
          }}>
            <span className="glyphicon glyphicon-warning-sign" />
            {keyboardHelp && <span className="om-keyboard-help">R</span>}
            <span className="om-reqinfo-text">{popupMessage('popup_requestErrorCount', 'Request failures', [`${pageInfo?.errorCount || 0}`])}</span>
          </a>
        </li>
      )}
      <li className="om-divider" />
      {customProfiles.map((profile, index) => (
        <MenuProfileItem
          id={`js-profile-${index + 1}`}
          key={profile.name}
          keyboardKey={keyboardHelp && index < 9 ? `${index + 1}` : ''}
          active={!state.isSystemProfile && profile.name === state.currentProfileName}
          effective={state.isSystemProfile && profile.name === state.currentProfileName}
          profile={profile}
          state={state}
          currentProfileClass={currentProfileClass}
          defaultMenuOpen={defaultMenuOpen === profile.name}
          onClick={() => applyProfile(profile.name)}
          onDefaultMenuToggle={() => setDefaultMenuOpen(defaultMenuOpen === profile.name ? '' : profile.name)}
          onDefaultProfileChange={(defaultProfileName) => setDefaultProfile(profile.name, defaultProfileName)}
        />
      ))}
      <li className="om-divider" />
      {showAddCondition && (
        <li className="om-nav-item om-nav-addrule">
          <a href="#!addRule" id="js-addrule" role="button" onClick={(event) => {
            event.preventDefault();
            showMode('condition');
          }}>
            <span className="glyphicon glyphicon-plus" />{' '}
            {keyboardHelp && <span className="om-keyboard-help">A</span>}
            <span>{popupMessage('popup_addCondition', 'Add Condition')}</span>
          </a>
        </li>
      )}
      {showTempRule && (
        <li className={`om-nav-item om-nav-temprule om-has-dropdown ${tempMenuOpen ? 'om-open' : ''}`}>
          <a href="#" id="js-temprule" role="button" onClick={(event) => {
            event.preventDefault();
            setTempMenuOpen(!tempMenuOpen);
          }}>
            <span className="glyphicon glyphicon-filter" />{' '}
            {keyboardHelp && <span className="om-keyboard-help">T</span>}
            <span>
              <span className="om-page-domain">{pageInfo?.domain}</span>
              <span className="om-caret" />
            </span>
          </a>
          {tempMenuOpen && (
            <ul className="om-dropdown">
              {tempRuleProfiles.map((profile) => (
                <li className={`om-nav-item ${profile.name === pageInfo?.tempRuleProfileName ? 'om-active' : ''}`} key={profile.name}>
                  <a href="#" role="button" title={profileTitle(profile, state.availableProfiles)} onClick={(event) => {
                    event.preventDefault();
                    addTempRule(pageInfo?.domain || '', profile.name);
                  }}>
                    <ProfileInline legacySpacing profile={profile} availableProfiles={state.availableProfiles} />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </li>
      )}
      <li className="om-divider" />
      <li className="om-nav-item">
        <a href="../options.html" target="_blank" id="js-option" role="button" onClick={(event) => {
          event.preventDefault();
          showOptions();
        }}>
          <span className="glyphicon glyphicon-wrench" />{' '}
          {keyboardHelp && <span className="om-keyboard-help">O</span>}
          <span>{popupMessage('popup_showOptions', 'Options')}</span>
        </a>
      </li>
    </ul>
  );
}

function MenuProfileItem({
  active = false,
  currentProfileClass = 'om-active',
  defaultMenuOpen = false,
  effective = false,
  id,
  keyboardKey,
  label,
  onClick,
  onDefaultMenuToggle,
  onDefaultProfileChange,
  profile,
  state
}: {
  active?: boolean;
  currentProfileClass?: string;
  defaultMenuOpen?: boolean;
  effective?: boolean;
  id: string;
  keyboardKey?: string;
  label?: string;
  onClick: () => void;
  onDefaultMenuToggle?: () => void;
  onDefaultProfileChange?: (profileName: string) => void;
  profile?: Profile;
  state: PopupState;
}) {
  const hasDefaultMenu = !!(profile?.validResultProfiles?.length && onDefaultMenuToggle && onDefaultProfileChange);
  const resultProfiles = (profile?.validResultProfiles || [])
    .filter(isVisibleResultProfileName)
    .map((name) => profileFromMap(state.availableProfiles, name))
    .filter((item): item is Profile => !!item)
    .sort(compareProfile);
  const classes = [
    'om-nav-item',
    active ? currentProfileClass : '',
    effective ? 'om-effective' : '',
    hasDefaultMenu ? 'om-has-dropdown' : '',
    defaultMenuOpen ? 'om-open' : ''
  ].filter(Boolean).join(' ');
  const text = displayProfileName(profile, label) + (profile?.defaultProfileName ? ` [${profile.defaultProfileName}]` : '');
  return (
    <li className={classes} data-default-profile-name={hasDefaultMenu ? profile?.name : undefined}>
      <a
        className={hasDefaultMenu ? 'om-has-edit' : ''}
        href="#"
        id={id}
        role="button"
        title={profileTitle(profile, state.availableProfiles)}
        onClick={(event) => {
          event.preventDefault();
          onClick();
        }}
      >
        <ProfileInline legacySpacing profile={profile} availableProfiles={state.availableProfiles} label={text} />
        {keyboardKey && <span className="om-keyboard-help">{keyboardKey}</span>}
        {hasDefaultMenu && (
          <div className="om-edit-toggle" onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onDefaultMenuToggle?.();
          }}>
            <span className="glyphicon glyphicon-chevron-down" />
          </div>
        )}
      </a>
      {hasDefaultMenu && defaultMenuOpen && (
        <ul className="om-dropdown">
          {resultProfiles.map((resultProfile) => (
            <li className={`om-nav-item ${resultProfile.name === profile?.defaultProfileName ? 'om-active' : ''}`} key={resultProfile.name}>
              <a href="#" role="button" title={profileTitle(resultProfile, state.availableProfiles)} onClick={(event) => {
                event.preventDefault();
                onDefaultProfileChange?.(resultProfile.name);
              }}>
                <ProfileInline legacySpacing profile={resultProfile} availableProfiles={state.availableProfiles} />
              </a>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function ConditionForm({pageInfo, state, onClose}: {pageInfo?: PageInfo; state: PopupState; onClose: () => void}) {
  const profiles = useMemo(() => visibleResultProfiles(state), [state]);
  const selectedProfile = lastResultProfile(state, pageInfo);
  const [profile, setProfile] = useState(selectedProfile);
  const suggestions = useMemo(() => suggestCondition(pageInfo?.domain || ''), [pageInfo?.domain]);
  const [conditionType, setConditionType] = useState(defaultConditionType);
  const [pattern, setPattern] = useState(suggestions.HostWildcardCondition);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => setProfile(selectedProfile), [selectedProfile]);
  useEffect(() => setPattern(suggestions[conditionType] || ''), [conditionType, suggestions]);

  function openConditionHelp() {
    const currentProfileName = encodeURIComponent(state.currentProfileName || '');
    popupTarget().openOptions?.(`#!/profile/${currentProfileName}?help=condition`, closePopup);
  }

  async function submitCondition(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const condition: PopupCondition = {
        conditionType,
        pattern
      };
      await callbackPromise<void>((callback) => popupTarget().addCondition?.(condition, profile, true, callback));
      popupTarget().setState?.('lastProfileNameForCondition', profile);
      closePopup();
    } catch (err: unknown) {
      setError(popupErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <form className="condition-form om-popup-form" onSubmit={submitCondition}>
      <fieldset>
        <legend>
          {popupMessage('popup_addConditionTo', 'Add condition to')}
          <span className="profile-inline"><ProfileInline profile={profileFromMap(state.availableProfiles, state.currentProfileName)} availableProfiles={state.availableProfiles} /></span>
        </legend>
        {error && <p className="om-alert">{error}</p>}
        <div className="form-group">
          <label>
            {popupMessage('options_conditionType', 'Condition Type')}{' '}
            <button className="btn btn-link btn-sm clear-padding" type="button" onClick={openConditionHelp}>
              {popupMessage('options_showConditionTypeHelp', 'Show condition type help')}{' '}
              <span className="glyphicon glyphicon-new-window" />
            </button>
          </label>
          <select className="form-control" value={conditionType} onChange={(event) => {
            const nextConditionType = event.currentTarget.value;
            if (isPopupConditionType(nextConditionType)) {
              setConditionType(nextConditionType);
            }
          }}>
            {conditionTypes.map((type) => (
              <option key={type} value={type}>{popupMessage(`condition_${type}`, type)}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>{popupMessage('options_conditionDetails', 'Condition Details')}</label>
          <input className="form-control condition-details" autoFocus required spellCheck={false} value={pattern} onChange={(event) => setPattern(event.currentTarget.value)} />
        </div>
        <div className="form-group">
          <label>{popupMessage('options_resultProfile', 'Result Profile')}</label>
          <ProfileSelect profiles={profiles} state={state} value={profile} onChange={setProfile} />
        </div>
        <div className="condition-controls">
          <button className="btn btn-default" type="button" onClick={onClose}>{popupMessage('dialog_cancel', 'Cancel')}</button>
          <button className="btn btn-primary" type="submit" disabled={saving || !pattern || !profiles.length}>{popupMessage('popup_addCondition', 'Add Condition')}</button>
        </div>
      </fieldset>
    </form>
  );
}

function RequestInfoForm({pageInfo, state, onClose}: {pageInfo?: PageInfo; state: PopupState; onClose: () => void}) {
  const profiles = useMemo(() => visibleResultProfiles(state), [state]);
  const selectedProfile = lastResultProfile(state, pageInfo);
  const [profile, setProfile] = useState(selectedProfile);
  const domains = useMemo(() => requestDomains(pageInfo), [pageInfo]);
  const [checkedDomains, setCheckedDomains] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => setProfile(selectedProfile), [selectedProfile]);
  useEffect(() => {
    setCheckedDomains((prev) => {
      const next = {...prev};
      for (const domain of domains) {
        if (next[domain.domain] == null) {
          next[domain.domain] = true;
        }
      }
      return next;
    });
  }, [domains]);

  async function submitRequestInfo(event: React.FormEvent) {
    event.preventDefault();
    const conditions: PopupCondition[] = domains
      .filter((domain) => checkedDomains[domain.domain])
      .map((domain) => ({
        conditionType: 'HostWildcardCondition',
        pattern: domain.domain
      }));
    if (conditions.length === 0) {
      setError(popupMessage('popup_requestErrorCannotAddCondition', 'Select at least one domain.'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      await callbackPromise<void>((callback) => popupTarget().addCondition?.(conditions, profile, true, callback));
      popupTarget().setState?.('lastProfileNameForCondition', profile);
      closePopup();
    } catch (err: unknown) {
      setError(popupErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <form className="request-info-details om-popup-form" onSubmit={submitRequestInfo}>
      <fieldset>
        {state.currentProfileCanAddRule
          ? <legend>{popupMessage('popup_addConditionTo', 'Add condition to')}<span className="profile-inline"><ProfileInline profile={profileFromMap(state.availableProfiles, state.currentProfileName)} availableProfiles={state.availableProfiles} /></span></legend>
          : <legend>{popupMessage('popup_requestErrorHeading', 'Request failures')}</legend>}
        {error && <p className="om-alert">{error}</p>}
        <div className="text-warning">{popupMessage('popup_requestErrorWarning', 'Some requests have failed.')}</div>
        <p className="help-block">{popupMessage('popup_requestErrorWarningHelp', 'You can add conditions for failed domains.')}</p>
        {state.currentProfileCanAddRule
          ? <p className="help-block">{popupMessage('popup_requestErrorAddCondition', 'Add conditions for selected domains.')}</p>
          : <p className="help-block">{popupMessage('popup_requestErrorCannotAddCondition', 'The current profile cannot accept new conditions.')}</p>}
        <div className="om-domain-list">
          {domains.map((domain, index) => (
            <div className="checkbox" key={domain.domain}>
              <label>
                <input
                  autoFocus={index === 0}
                  type="checkbox"
                  checked={!!checkedDomains[domain.domain]}
                  onChange={(event) => setCheckedDomains((prev) => ({...prev, [domain.domain]: event.currentTarget.checked}))}
                />
                <span className="label label-warning">{domain.errorCount}</span>
                {' '}{domain.domain}
              </label>
            </div>
          ))}
        </div>
        {state.currentProfileCanAddRule && (
          <div className="form-group">
            <label>{popupMessage('options_resultProfileForSelectedDomains', 'Result Profile for Selected Domains')}</label>
            <ProfileSelect profiles={profiles} state={state} value={profile} onChange={setProfile} />
          </div>
        )}
        <div className="condition-controls">
          <button className="btn btn-default" type="button" onClick={onClose}>{popupMessage('dialog_cancel', 'Cancel')}</button>
          {state.currentProfileCanAddRule
            ? <button className="btn btn-primary" type="submit" disabled={saving || !profiles.length}>{popupMessage('popup_addCondition', 'Add Condition')}</button>
            : <button className="btn btn-default pull-right" type="button" onClick={() => popupTarget().openOptions?.('#!/general', closePopup)}>{popupMessage('popup_configureMonitorWebRequests', 'Configure monitor web requests')}</button>}
        </div>
      </fieldset>
    </form>
  );
}

function ExternalProfileForm({state, onClose}: {state: PopupState; onClose: () => void}) {
  const [externalName, setExternalName] = useState(state.externalProfile?.name || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const externalNameConflict = !!externalName && !!profileFromMap(state.availableProfiles, externalName);
  const externalNameHidden = externalName.charAt(0) === '_';

  async function submitExternal(event: React.FormEvent) {
    event.preventDefault();
    if (externalNameConflict || externalNameHidden) {
      return;
    }
    if (!state.externalProfile || !externalName) {
      onClose();
      return;
    }
    setSaving(true);
    setError('');
    try {
      await callbackPromise<void>((callback) => popupTarget().addProfile?.({
        ...state.externalProfile,
        name: externalName
      }, callback));
      popupTarget().applyProfile?.(externalName, closePopup);
    } catch (err: unknown) {
      setError(popupErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <form className="condition-form om-popup-form" onSubmit={submitExternal}>
      <fieldset>
        <legend>{popupMessage('popup_externalProfile', 'External Profile')}</legend>
        {error && <p className="om-alert">{error}</p>}
        <div className="form-group">
          <label>{popupMessage('popup_externalProfileName', 'Profile name')}</label>
          <input className="form-control" autoFocus value={externalName} onChange={(event) => setExternalName(event.currentTarget.value)} />
        </div>
        {externalNameConflict && <p className="om-alert">{popupMessage('options_profileNameConflict', 'A profile with this name already exists.')}</p>}
        {externalNameHidden && <p className="om-alert">{popupMessage('options_profileNameHidden', 'Profiles with names starting with underscore will be hidden on the popup menu.')}</p>}
        <div className="condition-controls">
          <button className="btn btn-default" type="button" onClick={onClose}>{popupMessage('dialog_cancel', 'Cancel')}</button>
          <button className="btn btn-primary" type="submit" disabled={saving || !externalName || externalNameConflict || externalNameHidden}>{popupMessage('dialog_save', 'Save')}</button>
        </div>
      </fieldset>
    </form>
  );
}

function ProfileSelect({
  profiles,
  state,
  value,
  onChange
}: {
  profiles: Profile[];
  state: PopupState;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = profiles.find((profile) => profile.name === value);
  const choose = (profileName: string) => {
    onChange(profileName);
    setOpen(false);
  };
  return (
    <div className="omega-profile-select-host">
      <div className={`btn-group omega-profile-select ${open ? 'open' : ''}`}>
        <button
          aria-expanded={open}
          aria-haspopup="true"
          className="btn btn-default dropdown-toggle"
          type="button"
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onClick={() => setOpen(!open)}
        >
          <ProfileInline legacySpacing profile={selected} availableProfiles={state.availableProfiles} /><span className="caret" />
        </button>
        {open && (
          <ul className="dropdown-menu" role="listbox">
            {profiles.map((profile) => (
              <li className={profile.name === value ? 'active' : ''} key={profile.name} role="option">
                <a href="#" onMouseDown={(event) => event.preventDefault()} onClick={(event) => {
                  event.preventDefault();
                  choose(profile.name);
                }}>
                  <ProfileInline legacySpacing profile={profile} availableProfiles={state.availableProfiles} />
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ProfileInline({
  availableProfiles,
  legacySpacing = false,
  label,
  profile
}: {
  availableProfiles?: ProfileMap;
  legacySpacing?: boolean;
  label?: string;
  profile?: Profile;
}) {
  const targetProfile = profileTarget(profile, availableProfiles);
  const iconClass = targetProfile?.profileType ? iconForProfileType[targetProfile.profileType] || 'glyphicon-question-sign' : 'glyphicon-question-sign';
  const virtual = !!(profile && targetProfile && profile !== targetProfile);
  const iconClasses = [
    'glyphicon',
    legacySpacing ? '' : 'om-profile-icon',
    iconClass,
    virtual ? 'om-virtual-profile-icon' : ''
  ].filter(Boolean).join(' ');
  const nameClass = legacySpacing ? 'om-profile-name om-profile-name-legacy' : 'om-profile-name';
  if (legacySpacing) {
    return (
      <>
        <span
          className={iconClasses}
          style={{color: targetProfile?.color || undefined}}
        />{' '}
        <span className={nameClass}>{label || displayProfileName(profile)}</span>
      </>
    );
  }
  return (
    <span>
      <span
        className={iconClasses}
        style={{color: targetProfile?.color || undefined}}
      />
      <span className={nameClass}>{label || displayProfileName(profile)}</span>
    </span>
  );
}

function mount(element: Element) {
  const root = createRoot(element);
  root.render(<PopupApp />);
  return {
    unmount: () => root.unmount()
  };
}

const rootElement = document.getElementById('react-popup-root');
if (rootElement) {
  mount(rootElement);
}
