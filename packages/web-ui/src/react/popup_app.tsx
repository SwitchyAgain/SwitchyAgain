import React, {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {setUiLocale} from './i18n_client';
import type {RequestExplanation} from './options_client_types';
import {createRoot} from 'react-dom/client';
import {useWindowEvent} from './dom_event_hooks';
import {
  PageInfo,
  PopupCondition,
  PopupMode,
  PopupState,
  Profile,
  ProfileMap,
  callbackPromise,
  closePopup,
  getPopupPageInfo,
  getPopupState,
  popupMessage,
  popupBridge,
  waitForPopupBridge
} from './popup_bridge_client';
import {
  aggregateRouteInfo,
  compareProfile,
  conditionTypes,
  defaultConditionType,
  hiddenMenuProfiles,
  iconForProfileType,
  isPopupConditionType,
  isVisibleResultProfileName,
  lastResultProfile,
  modeFromHash,
  popupErrorMessage,
  popupProfileFromExplanation,
  profileFromMap,
  profileTarget,
  profileTitle,
  requestDomains,
  suggestCondition,
  visibleMenuProfiles,
  visibleResultProfiles,
  visibleScopeAssignableProfiles
} from './popup_logic';
import type {RouteInfoGroup} from './popup_logic';
import {applyUiTheme} from './ui_theme';

function displayProfileName(profile?: Profile, override?: string) {
  if (override) {
    return override;
  }
  if (!profile) {
    return '';
  }
  if (profile.role === 'attachedRuleList') {
    return popupMessage('options_switchAttachedProfileInCondition', 'Rule list rules');
  }
  return popupMessage(`profile_${profile.name}`, profile.name);
}

function finalLabel(explanation: RequestExplanation, state: PopupState, {showPacResult = true}: {showPacResult?: boolean} = {}) {
  const final = explanation.final || {kind: 'profile'};
  const profile = popupProfileFromExplanation(state, final.profile || explanation.finalProfile);
  if (final.kind === 'system') {
    return (
      <>
        {profile && <ProfileInline profile={profile} availableProfiles={state.availableProfiles} />}
        <span className="sa-popup-route-info-muted">{popupMessage('popup_routeInfoSystem', 'System proxy')}</span>
      </>
    );
  }
  if (final.kind === 'pac') {
    return (
      <>
        {profile && <ProfileInline profile={profile} availableProfiles={state.availableProfiles} />}
        <span className="sa-popup-route-info-muted">{popupMessage('popup_routeInfoPac', 'PAC script')}</span>
      </>
    );
  }
  if (profile) {
    return (
      <>
        <ProfileInline profile={profile} availableProfiles={state.availableProfiles} />
        {showPacResult && final.pacResult && <span className="sa-popup-route-info-pac">{final.pacResult}</span>}
      </>
    );
  }
  if (final.pacResult) {
    return <span>{final.pacResult}</span>;
  }
  return <span>{popupMessage('popup_routeInfoUnknown', 'Unknown')}</span>;
}

function requestCountText(count: number) {
  return count === 1 ? popupMessage('popup_routeInfoRequest', 'request') : popupMessage('popup_routeInfoRequests', 'requests');
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

function useFloatingDropdown<TAnchor extends HTMLElement>(open: boolean) {
  const anchorRef = useRef<TAnchor | null>(null);
  const dropdownRef = useRef<HTMLUListElement | null>(null);
  const [style, setStyle] = useState<React.CSSProperties>({visibility: 'hidden'});

  function updatePosition() {
    const anchor = anchorRef.current;
    const dropdown = dropdownRef.current;
    if (!anchor || !dropdown) {
      setStyle({visibility: 'hidden'});
      return;
    }

    const viewportGap = 6;
    const dropdownOffset = 2;
    const horizontalInset = 5;
    const anchorRect = anchor.getBoundingClientRect();
    const maxAvailableWidth = Math.max(120, window.innerWidth - viewportGap * 2);
    const width = Math.min(maxAvailableWidth, Math.max(160, anchorRect.width - horizontalInset * 2));
    const left = clamp(anchorRect.left + horizontalInset, viewportGap, window.innerWidth - viewportGap - width);
    const belowTop = anchorRect.bottom + dropdownOffset;
    const belowSpace = window.innerHeight - viewportGap - belowTop;
    const aboveBottom = anchorRect.top - dropdownOffset;
    const aboveSpace = aboveBottom - viewportGap;
    const openAbove = belowSpace < dropdown.scrollHeight && aboveSpace > belowSpace;
    const availableHeight = Math.max(64, openAbove ? aboveSpace : belowSpace);
    const height = Math.min(dropdown.scrollHeight, availableHeight);

    setStyle({
      left,
      maxHeight: availableHeight,
      top: openAbove ? Math.max(viewportGap, aboveBottom - height) : belowTop,
      visibility: 'visible',
      width
    });
  }

  useLayoutEffect(() => {
    if (!open) {
      setStyle({visibility: 'hidden'});
      return;
    }
    updatePosition();
  }, [open]);
  useWindowEvent('resize', updatePosition, undefined, open);
  useWindowEvent('scroll', updatePosition, true, open);

  return {anchorRef, dropdownRef, dropdownStyle: style};
}

function RouteInfoGroupResult({group, loading, state}: {group: RouteInfoGroup; loading: boolean; state: PopupState}) {
  const resultKeys = Object.keys(group.results);
  if (resultKeys.length === 0) {
    return (
      <span className="sa-popup-route-info-pending">
        {loading
          ? popupMessage('options_profileDownloadStatusDownloading', 'Loading...')
          : popupMessage('popup_routeInfoUnknown', 'Unknown')}
      </span>
    );
  }
  if (resultKeys.length === 1) {
    return <>{finalLabel(group.results[resultKeys[0]], state, {showPacResult: false})}</>;
  }
  return (
    <>
      <span className="label label-default sa-popup-route-info-mixed">{popupMessage('popup_routeInfoMixed', 'Mixed')}</span>
      <span className="sa-popup-route-info-muted">
        {resultKeys.length} {popupMessage('popup_routeInfoResults', 'results')}
      </span>
    </>
  );
}

function RouteInfoList({loading = false, pageInfo, state}: {loading?: boolean; pageInfo?: PageInfo; state: PopupState}) {
  const explanations = pageInfo?.requestExplanations || [];
  const requests = pageInfo?.requests || [];
  if (explanations.length === 0 && requests.length === 0) {
    return (
      <p className="help-block">
        {loading
          ? popupMessage('options_profileDownloadStatusDownloading', 'Loading...')
          : popupMessage('popup_routeInfoNoRequests', 'No captured page requests are available.')}
      </p>
    );
  }
  const groups = aggregateRouteInfo(explanations, requests, popupMessage('popup_routeInfoUnknownHost', 'Unknown host'));
  return (
    <div className="sa-popup-route-info-list">
      {groups.map((group) => {
        return (
          <div className="sa-popup-route-info" key={group.hostname}>
            <div className="sa-popup-route-info-line">
              <span
                className="label label-info sa-popup-route-info-request-count"
                title={`${group.requestCount} ${requestCountText(group.requestCount)}`}
              >
                {group.requestCount}
              </span>
              {group.errorCount > 0 && (
                <span
                  className="label label-warning sa-popup-route-info-error-count"
                  title={`${group.errorCount} ${popupMessage('popup_routeInfoErrors', 'errors')}`}
                >
                  {group.errorCount}
                </span>
              )}
              <span className="sa-popup-route-info-host">
                <strong className="sa-popup-route-info-host-text" title={group.hostname}>
                  {group.hostname}
                </strong>
              </span>
              <span className="sa-popup-route-info-result">
                <RouteInfoGroupResult group={group} loading={loading} state={state} />
              </span>
            </div>
            {group.errors.map((item) => (
              <div className="sa-popup-route-info-error" key={item}>
                {item}
              </div>
            ))}
            {group.pacLimited && (
              <div className="sa-popup-route-info-warning">
                {popupMessage('popup_routeInfoPacLimited', 'PAC scripts are delegated to the browser and cannot be fully expanded here.')}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PopupApp() {
  const [mode, setMode] = useState(modeFromHash);
  const [state, setState] = useState<PopupState>();
  const [pageInfo, setPageInfo] = useState<PageInfo>();
  const [error, setError] = useState('');
  const [defaultMenuOpen, setDefaultMenuOpen] = useState('');
  const [hiddenMenuOpen, setHiddenMenuOpen] = useState(false);
  const [profileScopeMenuOpen, setProfileScopeMenuOpen] = useState('');
  const [tempMenuOpen, setTempMenuOpen] = useState(false);
  const [keyboardHelp, setKeyboardHelp] = useState(false);
  const hiddenDropdown = useFloatingDropdown<HTMLLIElement>(hiddenMenuOpen);
  const tempDropdown = useFloatingDropdown<HTMLLIElement>(tempMenuOpen);

  useEffect(() => {
    waitForPopupBridge()
      .then(() =>
        Promise.all([
          getPopupState([
            'availableProfiles',
            'currentProfileCanAddRule',
            'currentProfileName',
            'externalProfile',
            'isSystemProfile',
            'lastProfileNameForCondition',
            'proxyNotControllable',
            'refreshOnProfileChange',
            'scopeAssignableProfiles',
            'showExternalProfile',
            'showPopupAddCondition',
            'showPopupAddTempRule',
            'uiLocale',
            'uiTheme',
            'validResultProfiles'
          ]),
          getPopupPageInfo()
        ])
      )
      .then(([nextState, nextPageInfo]) => {
        if (nextState.proxyNotControllable) {
          location.href = 'proxy_not_controllable.html';
          return;
        }
        return setUiLocale(nextState.uiLocale).then(() => {
          document.title = popupMessage('popup_title', 'SwitchyAgain Popup');
          applyUiTheme(nextState.uiTheme);
          setState(nextState);
          setPageInfo(nextPageInfo);
        });
      })
      .catch((err) => {
        setError(err?.message || String(err));
      });
  }, []);

  useWindowEvent('hashchange', () => setMode(modeFromHash()));

  const customProfiles = useMemo(() => visibleMenuProfiles(state), [state]);
  const hiddenProfiles = useMemo(() => hiddenMenuProfiles(state), [state]);
  const resultProfiles = useMemo(() => visibleResultProfiles(state), [state]);
  const scopeAssignableProfiles = useMemo(() => visibleScopeAssignableProfiles(state), [state]);
  const hasResultProfiles = resultProfiles.length > 0;
  const hasScopeAssignableProfiles = scopeAssignableProfiles.length > 0;
  const hasPageDomain = !!pageInfo?.domain;
  const showRouteInfo = !!(
    pageInfo &&
    ((pageInfo.errorCount || 0) > 0 || (pageInfo.requestExplanations?.length || pageInfo.requests?.length || 0) > 0)
  );
  const showExternal = !!(state?.showExternalProfile && state.externalProfile);
  const showAddCondition = !!(
    state?.showPopupAddCondition !== false &&
    state?.currentProfileCanAddRule &&
    hasPageDomain &&
    hasResultProfiles
  );
  const showTempRule = !!(state?.showPopupAddTempRule !== false && hasPageDomain && hasResultProfiles);

  function showMode(nextMode: Exclude<PopupMode, 'menu'>) {
    location.hash = nextMode === 'condition' ? '#!addRule' : `#!${nextMode}`;
    setMode(nextMode);
    setDefaultMenuOpen('');
    setHiddenMenuOpen(false);
    setProfileScopeMenuOpen('');
    setTempMenuOpen(false);
  }

  function closeToMenu() {
    location.hash = '';
    setMode('menu');
  }

  function applyProfile(profileName: string) {
    popupBridge().applyProfile?.(profileName, closePopup);
  }

  function setDefaultProfile(profileName: string, defaultProfileName: string) {
    popupBridge().setDefaultProfile?.(profileName, defaultProfileName, closePopup);
  }

  function addTempRule(domain: string, profileName: string) {
    popupBridge().addTempRule?.(domain, profileName, () => {
      popupBridge().setState?.('lastProfileNameForCondition', profileName);
      closePopup();
    });
  }

  function setProfileScope(scope: 'container' | 'group' | 'normal' | 'private' | 'tab', profileName?: string) {
    const info = pageInfo?.profileScope;
    popupBridge().setProfileScope?.(
      {
        cookieStoreId: info?.cookieStoreId,
        groupId: info?.groupId,
        incognito: info?.incognito,
        profileName,
        scope,
        tabId: info?.tabId,
        windowId: info?.windowId
      },
      closePopup
    );
  }

  function showOptions() {
    popupBridge().openOptions?.(null, closePopup);
  }

  function clickById(id: string) {
    document.getElementById(id)?.click();
  }

  function visibleLinks() {
    return Array.from(document.querySelectorAll<HTMLAnchorElement>('.sa-popup-nav a')).filter((element) => !element.closest('.sa-popup-hidden'));
  }

  function move(delta: number) {
    const links = visibleLinks();
    if (!links.length) {
      return;
    }
    const active = document.activeElement as HTMLElement | null;
    const currentIndex = active ? links.indexOf(active as HTMLAnchorElement) : -1;
    const nextIndex = currentIndex < 0 ? (delta > 0 ? 0 : links.length - 1) : (currentIndex + delta + links.length) % links.length;
    links[nextIndex]?.focus();
  }

  function closeDropdown() {
    if (defaultMenuOpen || hiddenMenuOpen || profileScopeMenuOpen || tempMenuOpen) {
      setDefaultMenuOpen('');
      setHiddenMenuOpen(false);
      setProfileScopeMenuOpen('');
      setTempMenuOpen(false);
    }
  }

  function openDropdown() {
    const active = document.activeElement as HTMLElement | null;
    const item = active?.closest<HTMLElement>('.sa-popup-nav-item');
    const profileName = item?.dataset.defaultProfileName;
    if (profileName) {
      setDefaultMenuOpen(profileName);
    } else if (item?.classList.contains('sa-popup-nav-hidden-profiles')) {
      setHiddenMenuOpen(true);
    } else if (item?.dataset.profileScope) {
      setProfileScopeMenuOpen(item.dataset.profileScope);
    } else if (item?.classList.contains('sa-popup-nav-temp-rule')) {
      setTempMenuOpen(true);
    }
  }

  useWindowEvent('keydown', (event) => {
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
        clickById('js-routeinfo');
        event.preventDefault();
        return;
      default:
        if (event.keyCode >= 49 && event.keyCode <= 57) {
          clickById(`js-profile-${event.keyCode - 48}`);
          event.preventDefault();
        }
    }
  });

  useEffect(() => {
    if (mode !== 'menu') {
      return;
    }
    const activeLink = document.querySelector<HTMLAnchorElement>('.sa-popup-nav-item.sa-popup-active > a');
    activeLink?.focus();
  }, [mode, state]);

  if (error) {
    return (
      <form className="condition-form sa-popup-form">
        <fieldset>
          <p className="sa-popup-alert">{error}</p>
        </fieldset>
      </form>
    );
  }

  if (!state) {
    return (
      <ul className="sa-popup-nav sa-popup-nav-loading">
        <li className="sa-popup-nav-item">
          <span className="sa-popup-nav-loading-text" role="status">
            {popupMessage('options_profileDownloadStatusDownloading', 'Loading...')}
          </span>
        </li>
      </ul>
    );
  }

  if (mode === 'condition') {
    return <ConditionForm pageInfo={pageInfo} state={state} onClose={closeToMenu} />;
  }
  if (mode === 'routeInfo') {
    return <RouteInfoForm pageInfo={pageInfo} state={state} onClose={closeToMenu} />;
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
  const currentProfileClass = state.isSystemProfile ? 'sa-popup-effective' : 'sa-popup-active';
  const tempRuleProfiles = resultProfiles
    .filter((profile) => profile.name.indexOf('__') !== 0)
    .filter((profile) => !!pageInfo?.tempRuleProfileName || resultProfiles.length === 1 || profile.name !== state.currentProfileName);
  const profileScope = pageInfo?.profileScope;
  const showTabScope = !!(profileScope?.enabled?.tab && profileScope.tabId != null && hasScopeAssignableProfiles);
  const showGroupScope = !!(profileScope?.enabled?.group && profileScope.groupId != null && hasScopeAssignableProfiles);
  const showContainerScope = !!(profileScope?.enabled?.container && profileScope.isContainer && hasScopeAssignableProfiles);
  const windowScope = profileScope?.incognito ? 'private' : 'normal';
  const showWindowScope = !!(profileScope?.enabled?.window && hasScopeAssignableProfiles);
  const showProfileScopes = showTabScope || showGroupScope || showContainerScope || showWindowScope;

  return (
    <ul className="sa-popup-nav">
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
      <li className="sa-popup-divider" />
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
      {hiddenProfiles.length > 0 && (
        <li
          ref={hiddenDropdown.anchorRef}
          className={`sa-popup-nav-item sa-popup-nav-hidden-profiles sa-popup-has-dropdown ${hiddenMenuOpen ? 'sa-popup-open' : ''}`}
        >
          <a
            aria-expanded={hiddenMenuOpen}
            href="#"
            id="js-hidden-profiles"
            role="button"
            onClick={(event) => {
              event.preventDefault();
              setHiddenMenuOpen(!hiddenMenuOpen);
            }}
          >
            <span className="glyphicon glyphicon-eye-close" />
            <span>
              <span>{popupMessage('popup_hiddenProfilesMenu', 'Hidden')}</span>
              <span className="sa-popup-caret" />
            </span>
          </a>
          {hiddenMenuOpen && (
            <ul ref={hiddenDropdown.dropdownRef} className="sa-popup-dropdown sa-popup-floating-dropdown" style={hiddenDropdown.dropdownStyle}>
              {hiddenProfiles.map((profile, index) => (
                <MenuProfileItem
                  id={`js-hidden-profile-${index + 1}`}
                  key={profile.name}
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
            </ul>
          )}
        </li>
      )}
      {showProfileScopes && (
        <>
          <li className="sa-popup-divider" />
          {showTabScope && (
            <ProfileScopeMenuItem
              scope="tab"
              icon="glyphicon-pushpin"
              label={popupMessage('popup_profileScopeTab', 'This Tab')}
              activeProfileName={profileScope?.tabProfileName}
              open={profileScopeMenuOpen === 'tab'}
              profiles={scopeAssignableProfiles}
              state={state}
              onToggle={() => setProfileScopeMenuOpen(profileScopeMenuOpen === 'tab' ? '' : 'tab')}
              onProfileChange={(profileName) => setProfileScope('tab', profileName)}
            />
          )}
          {showGroupScope && (
            <ProfileScopeMenuItem
              scope="group"
              icon="glyphicon-th-large"
              label={popupMessage('popup_profileScopeGroup', 'Tab Group')}
              activeProfileName={profileScope?.groupProfileName}
              open={profileScopeMenuOpen === 'group'}
              profiles={scopeAssignableProfiles}
              state={state}
              onToggle={() => setProfileScopeMenuOpen(profileScopeMenuOpen === 'group' ? '' : 'group')}
              onProfileChange={(profileName) => setProfileScope('group', profileName)}
            />
          )}
          {showContainerScope && (
            <ProfileScopeMenuItem
              scope="container"
              icon="glyphicon-tags"
              label={popupMessage('popup_profileScopeContainer', 'Container')}
              activeProfileName={profileScope?.containerProfileName}
              open={profileScopeMenuOpen === 'container'}
              profiles={scopeAssignableProfiles}
              state={state}
              onToggle={() => setProfileScopeMenuOpen(profileScopeMenuOpen === 'container' ? '' : 'container')}
              onProfileChange={(profileName) => setProfileScope('container', profileName)}
            />
          )}
          {showWindowScope && (
            <ProfileScopeMenuItem
              scope={windowScope}
              icon={windowScope === 'private' ? 'glyphicon-lock' : 'glyphicon-new-window'}
              label={
                windowScope === 'private'
                  ? popupMessage('popup_profileScopePrivate', 'Private')
                  : popupMessage('popup_profileScopeNormal', 'Normal')
              }
              activeProfileName={profileScope?.windowProfileName}
              open={profileScopeMenuOpen === windowScope}
              profiles={scopeAssignableProfiles}
              state={state}
              onToggle={() => setProfileScopeMenuOpen(profileScopeMenuOpen === windowScope ? '' : windowScope)}
              onProfileChange={(profileName) => setProfileScope(windowScope, profileName)}
            />
          )}
        </>
      )}
      <li className="sa-popup-divider" />
      {showAddCondition && (
        <li className="sa-popup-nav-item sa-popup-nav-add-rule">
          <a
            href="#!addRule"
            id="js-addrule"
            role="button"
            onClick={(event) => {
              event.preventDefault();
              showMode('condition');
            }}
          >
            <span className="glyphicon glyphicon-plus" /> {keyboardHelp && <span className="sa-popup-keyboard-help">A</span>}
            <span>{popupMessage('popup_addCondition', 'Add Condition')}</span>
          </a>
        </li>
      )}
      {showTempRule && (
        <li ref={tempDropdown.anchorRef} className={`sa-popup-nav-item sa-popup-nav-temp-rule sa-popup-has-dropdown ${tempMenuOpen ? 'sa-popup-open' : ''}`}>
          <a
            href="#"
            id="js-temprule"
            role="button"
            onClick={(event) => {
              event.preventDefault();
              setTempMenuOpen(!tempMenuOpen);
            }}
          >
            <span className="glyphicon glyphicon-filter" /> {keyboardHelp && <span className="sa-popup-keyboard-help">T</span>}
            <span>
              <span className="sa-popup-page-domain">{pageInfo?.domain}</span>
              <span className="sa-popup-caret" />
            </span>
          </a>
          {tempMenuOpen && (
            <ul ref={tempDropdown.dropdownRef} className="sa-popup-dropdown sa-popup-floating-dropdown" style={tempDropdown.dropdownStyle}>
              {tempRuleProfiles.map((profile) => (
                <li className={`sa-popup-nav-item ${profile.name === pageInfo?.tempRuleProfileName ? 'sa-popup-active' : ''}`} key={profile.name}>
                  <a
                    href="#"
                    role="button"
                    title={profileTitle(profile, state.availableProfiles)}
                    onClick={(event) => {
                      event.preventDefault();
                      addTempRule(pageInfo?.domain || '', profile.name);
                    }}
                  >
                    <ProfileInline legacySpacing profile={profile} availableProfiles={state.availableProfiles} />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </li>
      )}
      {showRouteInfo && (
        <li className="sa-popup-nav-item">
          <a
            href="#!routeInfo"
            id="js-routeinfo"
            role="button"
            onClick={(event) => {
              event.preventDefault();
              showMode('routeInfo');
            }}
          >
            <span className="glyphicon glyphicon-road" /> {keyboardHelp && <span className="sa-popup-keyboard-help">R</span>}
            <span className="sa-popup-route-info-text">{popupMessage('popup_routeInfoMenu', 'Route Info')}</span>
            {(pageInfo?.errorCount || 0) > 0 && <span className="label label-warning sa-popup-route-info-count">{pageInfo?.errorCount}</span>}
          </a>
        </li>
      )}
      <li className="sa-popup-divider" />
      <li className="sa-popup-nav-item">
        <a
          href="../options.html"
          target="_blank"
          id="js-option"
          role="button"
          onClick={(event) => {
            event.preventDefault();
            showOptions();
          }}
        >
          <span className="glyphicon glyphicon-wrench" /> {keyboardHelp && <span className="sa-popup-keyboard-help">O</span>}
          <span>{popupMessage('popup_showOptions', 'Options')}</span>
        </a>
      </li>
    </ul>
  );
}

function MenuProfileItem({
  active = false,
  currentProfileClass = 'sa-popup-active',
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
  const dropdown = useFloatingDropdown<HTMLLIElement>(defaultMenuOpen);
  const hasDefaultMenu = !!(profile?.validResultProfiles?.length && onDefaultMenuToggle && onDefaultProfileChange);
  const resultProfiles = (profile?.validResultProfiles || [])
    .filter(isVisibleResultProfileName)
    .map((name) => profileFromMap(state.availableProfiles, name))
    .filter((item): item is Profile => !!item)
    .sort(compareProfile);
  const classes = [
    'sa-popup-nav-item',
    active ? currentProfileClass : '',
    effective ? 'sa-popup-effective' : '',
    hasDefaultMenu ? 'sa-popup-has-dropdown' : '',
    defaultMenuOpen ? 'sa-popup-open' : ''
  ]
    .filter(Boolean)
    .join(' ');
  const text = displayProfileName(profile, label) + (profile?.defaultProfileName ? ` [${profile.defaultProfileName}]` : '');
  return (
    <li ref={dropdown.anchorRef} className={classes} data-default-profile-name={hasDefaultMenu ? profile?.name : undefined}>
      <a
        className={hasDefaultMenu ? 'sa-popup-has-edit' : ''}
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
        {keyboardKey && <span className="sa-popup-keyboard-help">{keyboardKey}</span>}
        {hasDefaultMenu && (
          <div
            className="sa-popup-edit-toggle"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onDefaultMenuToggle?.();
            }}
          >
            <span className="glyphicon glyphicon-chevron-down" />
          </div>
        )}
      </a>
      {hasDefaultMenu && defaultMenuOpen && (
        <ul ref={dropdown.dropdownRef} className="sa-popup-dropdown sa-popup-floating-dropdown" style={dropdown.dropdownStyle}>
          {resultProfiles.map((resultProfile) => (
            <li className={`sa-popup-nav-item ${resultProfile.name === profile?.defaultProfileName ? 'sa-popup-active' : ''}`} key={resultProfile.name}>
              <a
                href="#"
                role="button"
                title={profileTitle(resultProfile, state.availableProfiles)}
                onClick={(event) => {
                  event.preventDefault();
                  onDefaultProfileChange?.(resultProfile.name);
                }}
              >
                <ProfileInline legacySpacing profile={resultProfile} availableProfiles={state.availableProfiles} />
              </a>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function ProfileScopeMenuItem({
  activeProfileName,
  icon,
  label,
  onProfileChange,
  onToggle,
  open,
  profiles,
  scope,
  state
}: {
  activeProfileName?: string;
  icon: string;
  label: string;
  onProfileChange: (profileName?: string) => void;
  onToggle: () => void;
  open: boolean;
  profiles: Profile[];
  scope: string;
  state: PopupState;
}) {
  const dropdown = useFloatingDropdown<HTMLLIElement>(open);
  const activeProfile = profileFromMap(state.availableProfiles, activeProfileName);
  const text = activeProfile ? `${label}: ${displayProfileName(activeProfile)}` : label;
  return (
    <li
      ref={dropdown.anchorRef}
      className={`sa-popup-nav-item sa-popup-nav-profile-scope sa-popup-has-dropdown ${activeProfile ? 'sa-popup-active' : ''} ${open ? 'sa-popup-open' : ''}`}
      data-profile-scope={scope}
    >
      <a
        aria-expanded={open}
        href="#"
        role="button"
        onClick={(event) => {
          event.preventDefault();
          onToggle();
        }}
      >
        <span className={`glyphicon ${icon}`} />
        <span>
          <span>{text}</span>
          <span className="sa-popup-caret" />
        </span>
      </a>
      {open && (
        <ul ref={dropdown.dropdownRef} className="sa-popup-dropdown sa-popup-floating-dropdown" style={dropdown.dropdownStyle}>
          <li className={`sa-popup-nav-item ${activeProfileName ? '' : 'sa-popup-active'}`}>
            <a
              href="#"
              role="button"
              onClick={(event) => {
                event.preventDefault();
                onProfileChange();
              }}
            >
              <span className="glyphicon glyphicon-share-alt" /> {popupMessage('popup_profileScopeUseDefault', 'Use Default')}
            </a>
          </li>
          {profiles.map((profile) => (
            <li className={`sa-popup-nav-item ${profile.name === activeProfileName ? 'sa-popup-active' : ''}`} key={profile.name}>
              <a
                href="#"
                role="button"
                title={profileTitle(profile, state.availableProfiles)}
                onClick={(event) => {
                  event.preventDefault();
                  onProfileChange(profile.name);
                }}
              >
                <ProfileInline legacySpacing profile={profile} availableProfiles={state.availableProfiles} />
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
    popupBridge().openOptions?.(`#!/profile/${currentProfileName}?help=condition`, closePopup);
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
      await callbackPromise<void>((callback) => popupBridge().addCondition?.(condition, profile, true, callback));
      popupBridge().setState?.('lastProfileNameForCondition', profile);
      closePopup();
    } catch (err: unknown) {
      setError(popupErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <form className="condition-form sa-popup-form" onSubmit={submitCondition}>
      <fieldset>
        <legend>
          {popupMessage('popup_addConditionTo', 'Add condition to')}
          <span className="profile-inline">
            <ProfileInline
              profile={profileFromMap(state.availableProfiles, state.currentProfileName)}
              availableProfiles={state.availableProfiles}
            />
          </span>
        </legend>
        {error && <p className="sa-popup-alert">{error}</p>}
        <div className="form-group">
          <label>
            {popupMessage('options_conditionType', 'Condition Type')}{' '}
            <button className="btn btn-link btn-sm clear-padding" type="button" onClick={openConditionHelp}>
              {popupMessage('options_showConditionTypeHelp', 'Show condition type help')}{' '}
              <span className="glyphicon glyphicon-new-window" />
            </button>
          </label>
          <select
            className="form-control"
            value={conditionType}
            onChange={(event) => {
              const nextConditionType = event.currentTarget.value;
              if (isPopupConditionType(nextConditionType)) {
                setConditionType(nextConditionType);
              }
            }}
          >
            {conditionTypes.map((type) => (
              <option key={type} value={type}>
                {popupMessage(`condition_${type}`, type)}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>{popupMessage('options_conditionDetails', 'Condition Details')}</label>
          <input
            className="form-control condition-details"
            autoFocus
            required
            spellCheck={false}
            value={pattern}
            onChange={(event) => setPattern(event.currentTarget.value)}
          />
        </div>
        <div className="form-group">
          <label>{popupMessage('options_resultProfile', 'Result Profile')}</label>
          <ProfileSelect profiles={profiles} state={state} value={profile} onChange={setProfile} />
        </div>
        <div className="condition-controls">
          <button className="btn btn-default" type="button" onClick={onClose}>
            {popupMessage('dialog_cancel', 'Cancel')}
          </button>
          <button className="btn btn-primary" type="submit" disabled={saving || !pattern || !profiles.length}>
            {popupMessage('popup_addCondition', 'Add Condition')}
          </button>
        </div>
      </fieldset>
    </form>
  );
}

function RouteInfoForm({pageInfo, state, onClose}: {pageInfo?: PageInfo; state: PopupState; onClose: () => void}) {
  const profiles = useMemo(() => visibleResultProfiles(state), [state]);
  const selectedProfile = lastResultProfile(state, pageInfo);
  const [profile, setProfile] = useState(selectedProfile);
  const [detailPageInfo, setDetailPageInfo] = useState<PageInfo | undefined>(pageInfo);
  const [loadingExplanations, setLoadingExplanations] = useState(false);
  const [explanationsRequested, setExplanationsRequested] = useState(false);
  const domains = useMemo(() => requestDomains(detailPageInfo), [detailPageInfo]);
  const hasRequestFailures = (detailPageInfo?.errorCount || 0) > 0 && domains.length > 0;
  const needsExplanations = !!((detailPageInfo?.requests?.length || 0) > 0 && !detailPageInfo?.requestExplanations);
  const tempRulesActive = !!detailPageInfo?.requestExplanations?.some((explanation) => explanation.tempRulesActive);
  const [checkedDomains, setCheckedDomains] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => setProfile(selectedProfile), [selectedProfile]);
  useEffect(() => {
    setDetailPageInfo(pageInfo);
    setExplanationsRequested(false);
  }, [pageInfo]);
  useEffect(() => {
    if (!needsExplanations || loadingExplanations || explanationsRequested) {
      return;
    }
    setExplanationsRequested(true);
    setLoadingExplanations(true);
    getPopupPageInfo({includeExplanations: true})
      .then((nextPageInfo) => {
        setDetailPageInfo(nextPageInfo || pageInfo);
        setLoadingExplanations(false);
      })
      .catch((err: unknown) => {
        setError(popupErrorMessage(err));
        setLoadingExplanations(false);
      });
  }, [explanationsRequested, loadingExplanations, needsExplanations, pageInfo]);
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

  async function submitRouteInfo(event: React.FormEvent) {
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
      await callbackPromise<void>((callback) => popupBridge().addCondition?.(conditions, profile, true, callback));
      popupBridge().setState?.('lastProfileNameForCondition', profile);
      closePopup();
    } catch (err: unknown) {
      setError(popupErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <form className="route-info-details sa-popup-form" onSubmit={submitRouteInfo}>
      <fieldset>
        <legend>{popupMessage('popup_routeInfoHeading', 'Route Info')}</legend>
        {error && <p className="sa-popup-alert">{error}</p>}
        {tempRulesActive && (
          <p className="help-block text-warning">
            {popupMessage(
              'popup_routeInfoTempRulesActive',
              'Temporary rules are active; requests are checked against temporary rules before the current profile.'
            )}
          </p>
        )}
        {detailPageInfo?.requestLimitExceeded && (
          <p className="help-block">{popupMessage('popup_routeInfoLimitExceeded', 'Only the first captured requests are shown.')}</p>
        )}
        <RouteInfoList loading={loadingExplanations || needsExplanations} pageInfo={detailPageInfo} state={state} />

        {hasRequestFailures && (
          <div className="sa-popup-route-info-add-condition">
            <div className="text-warning">{popupMessage('popup_requestErrorWarning', 'Some resources failed to load.')}</div>
            {state.currentProfileCanAddRule ? (
              <p className="help-block">{popupMessage('popup_requestErrorAddCondition', 'Review the domains below and add proxy rules if needed.')}</p>
            ) : (
              <p className="help-block">
                {popupMessage(
                  'popup_requestErrorCannotAddCondition',
                  'You can add switch conditions for them only when using a Switch Profile.'
                )}
              </p>
            )}
            <div className="sa-popup-domain-list">
              {domains.map((domain, index) => (
                <div className="checkbox" key={domain.domain}>
                  <label>
                    <input
                      autoFocus={index === 0}
                      type="checkbox"
                      checked={!!checkedDomains[domain.domain]}
                      onChange={(event) => setCheckedDomains((prev) => ({...prev, [domain.domain]: event.currentTarget.checked}))}
                    />
                    <span className="label label-warning">{domain.errorCount}</span> {domain.domain}
                  </label>
                </div>
              ))}
            </div>
            {state.currentProfileCanAddRule && (
              <div className="form-group">
                <label>{popupMessage('options_resultProfileForSelectedDomains', 'Result Profile for Selected Domains')}</label>
                <ProfileSelect expandDropdownInFlow profiles={profiles} state={state} value={profile} onChange={setProfile} />
              </div>
            )}
          </div>
        )}
        <div className="condition-controls">
          <button className="btn btn-default" type="button" onClick={onClose}>
            {popupMessage('dialog_cancel', 'Cancel')}
          </button>
          {hasRequestFailures &&
            (state.currentProfileCanAddRule ? (
              <button className="btn btn-primary" type="submit" disabled={saving || !profiles.length}>
                {popupMessage('popup_addCondition', 'Add Condition')}
              </button>
            ) : (
              <button
                className="btn btn-default pull-right"
                type="button"
                onClick={() => popupBridge().openOptions?.('#!/general', closePopup)}
              >
                {popupMessage('popup_configureMonitorWebRequests', 'Configure monitor web requests')}
              </button>
            ))}
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
      await callbackPromise<void>((callback) =>
        popupBridge().addProfile?.(
          {
            ...state.externalProfile,
            name: externalName
          },
          callback
        )
      );
      popupBridge().applyProfile?.(externalName, closePopup);
    } catch (err: unknown) {
      setError(popupErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <form className="condition-form sa-popup-form" onSubmit={submitExternal}>
      <fieldset>
        <legend>{popupMessage('popup_externalProfile', 'External Profile')}</legend>
        {error && <p className="sa-popup-alert">{error}</p>}
        <div className="form-group">
          <label>{popupMessage('popup_externalProfileName', 'Profile name')}</label>
          <input className="form-control" autoFocus value={externalName} onChange={(event) => setExternalName(event.currentTarget.value)} />
        </div>
        {externalNameConflict && (
          <p className="sa-popup-alert">{popupMessage('options_profileNameConflict', 'A profile with this name already exists.')}</p>
        )}
        {externalNameHidden && (
          <p className="sa-popup-alert">
            {popupMessage('options_profileNameHidden', 'Profiles with names starting with underscore will be hidden on the popup menu.')}
          </p>
        )}
        <div className="condition-controls">
          <button className="btn btn-default" type="button" onClick={onClose}>
            {popupMessage('dialog_cancel', 'Cancel')}
          </button>
          <button
            className="btn btn-primary"
            type="submit"
            disabled={saving || !externalName || externalNameConflict || externalNameHidden}
          >
            {popupMessage('dialog_save', 'Save')}
          </button>
        </div>
      </fieldset>
    </form>
  );
}

function ProfileSelect({
  expandDropdownInFlow = false,
  profiles,
  state,
  value,
  onChange
}: {
  expandDropdownInFlow?: boolean;
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
  const selectClasses = [
    'btn-group',
    'profile-select',
    expandDropdownInFlow ? 'profile-select-in-flow' : '',
    open ? 'open' : ''
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className="profile-select-host">
      <div className={selectClasses}>
        <button
          aria-expanded={open}
          aria-haspopup="true"
          className="btn btn-default dropdown-toggle"
          type="button"
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onClick={() => setOpen(!open)}
        >
          <ProfileInline legacySpacing profile={selected} availableProfiles={state.availableProfiles} />
          <span className="caret" />
        </button>
        {open && (
          <ul className="dropdown-menu" role="listbox">
            {profiles.map((profile) => (
              <li className={profile.name === value ? 'active' : ''} key={profile.name} role="option">
                <a
                  href="#"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={(event) => {
                    event.preventDefault();
                    choose(profile.name);
                  }}
                >
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
  const iconClass = targetProfile?.profileType
    ? iconForProfileType[targetProfile.profileType] || 'glyphicon-question-sign'
    : 'glyphicon-question-sign';
  const virtual = !!(profile && targetProfile && profile !== targetProfile);
  const iconClasses = ['glyphicon', legacySpacing ? '' : 'sa-popup-profile-icon', iconClass, virtual ? 'sa-popup-virtual-profile-icon' : '']
    .filter(Boolean)
    .join(' ');
  const nameClass = legacySpacing ? 'sa-popup-profile-name sa-popup-profile-name-legacy' : 'sa-popup-profile-name';
  if (legacySpacing) {
    return (
      <>
        <span className={iconClasses} style={{color: targetProfile?.color || undefined}} />{' '}
        <span className={nameClass}>{label || displayProfileName(profile)}</span>
      </>
    );
  }
  return (
    <span>
      <span className={iconClasses} style={{color: targetProfile?.color || undefined}} />
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
