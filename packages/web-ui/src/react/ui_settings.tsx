import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {UI_LOCALES, message, uiLocaleForOptions} from './i18n_client';
import {openShortcutConfig as openDefaultShortcutConfig, shouldAutoMount} from './navigation_client';
import {loadOptions, patchOptions} from './options_api_client';
import type {Options} from './options_client_types';
import {getState} from './state_client';
import {useOutsidePointer} from './dom_event_hooks';
import {Profile, ProfileInline, ProfileSelect, allProfilesFromOptions, profileByName} from './profile_widgets';
import {DEFAULT_PROXY_DNS_CAPABILITIES, cloneOptions} from './options_logic';
import {UI_THEME_ICON, UI_THEMES, uiThemeForOptions} from './ui_theme';
import type {UiTheme} from './ui_theme';
import type {ProxyDnsCapabilities} from './profile_types';
import {
  moveQuickSwitchProfileName,
  notCycledProfileNames,
  quickSwitchProfileNames,
  reorderQuickSwitchProfileName,
  uiOptionPatch,
  uiOptionsDirty
} from './ui_settings_logic';

export type UiSettingsProps = {
  embedded?: boolean;
  options?: Options | null;
  onOptionsChange?: (options: Options) => void;
  onOpenShortcutConfig?: () => void;
  profileScopeCapabilities?: ProfileScopeCapabilities;
  proxyDnsCapabilities?: ProxyDnsCapabilities;
};

type ProfileScopeCapabilities = {
  container?: boolean;
  group?: boolean;
  tab?: boolean;
  window?: boolean;
};

type ProfileScopeKey = keyof ProfileScopeCapabilities;

type ContextMenuOptions = {
  containerProfile: boolean;
  groupProfile: boolean;
  linkProfileNewPrivateWindow: boolean;
  linkProfileNewTab: boolean;
  linkProfileNewWindow: boolean;
  switchProfile: boolean;
  tabProfile: boolean;
  windowProfile: boolean;
};

const DEFAULT_PROFILE_SCOPE_CAPABILITIES: ProfileScopeCapabilities = {
  container: false,
  group: false,
  tab: false,
  window: false
};
const UI_CAPABILITY_STATE_KEYS = ['profileScopeCapabilities', 'proxyDnsCapabilities'];

type UiCapabilityState = {
  profileScopeCapabilities: ProfileScopeCapabilities;
  proxyDnsCapabilities: ProxyDnsCapabilities;
};

function loadUiCapabilityState(): Promise<UiCapabilityState> {
  return getState<ProfileScopeCapabilities | ProxyDnsCapabilities>(UI_CAPABILITY_STATE_KEYS)
    .then(([profileScopeCapabilities, proxyDnsCapabilities]) => ({
      profileScopeCapabilities: (profileScopeCapabilities as ProfileScopeCapabilities | undefined) || DEFAULT_PROFILE_SCOPE_CAPABILITIES,
      proxyDnsCapabilities: (proxyDnsCapabilities as ProxyDnsCapabilities | undefined) || DEFAULT_PROXY_DNS_CAPABILITIES
    }))
    .catch(() => ({
      profileScopeCapabilities: DEFAULT_PROFILE_SCOPE_CAPABILITIES,
      proxyDnsCapabilities: DEFAULT_PROXY_DNS_CAPABILITIES
    }));
}

function displayProfileName(profile: Profile) {
  if (profile.builtin) {
    return message(`profile_${profile.name}`, profile.name);
  }
  return profile.name;
}

function profileScopesForOptions(options?: Options | null): Required<ProfileScopeCapabilities> {
  const raw = options?.['-profileScopes'];
  const scopes = raw && typeof raw === 'object' ? (raw as ProfileScopeCapabilities) : {};
  return {
    tab: scopes.tab === true,
    group: scopes.group === true,
    container: scopes.container === true,
    window: scopes.window === true
  };
}

function contextMenuOptionsForOptions(options?: Options | null): ContextMenuOptions {
  const raw = options?.['-contextMenuOptions'];
  const contextMenuOptions = raw && typeof raw === 'object' ? (raw as Partial<ContextMenuOptions>) : {};
  return {
    switchProfile: contextMenuOptions.switchProfile !== false,
    tabProfile: contextMenuOptions.tabProfile === true,
    groupProfile: contextMenuOptions.groupProfile === true,
    containerProfile: contextMenuOptions.containerProfile === true,
    windowProfile: contextMenuOptions.windowProfile === true,
    linkProfileNewTab: contextMenuOptions.linkProfileNewTab === true,
    linkProfileNewWindow: contextMenuOptions.linkProfileNewWindow === true,
    linkProfileNewPrivateWindow: contextMenuOptions.linkProfileNewPrivateWindow === true
  };
}

function contextMenuCapabilitiesForProfileScope(profileScopeCapabilities: ProfileScopeCapabilities): ContextMenuOptions {
  const tabSupported = profileScopeCapabilities.tab === true;
  return {
    switchProfile: true,
    tabProfile: tabSupported,
    groupProfile: profileScopeCapabilities.group === true,
    containerProfile: profileScopeCapabilities.container === true,
    windowProfile: profileScopeCapabilities.window === true,
    linkProfileNewTab: tabSupported,
    linkProfileNewWindow: tabSupported,
    linkProfileNewPrivateWindow: tabSupported
  };
}

function contextMenuOptionVisible(optionKey: keyof ContextMenuOptions, profileScopeCapabilities: ProfileScopeCapabilities) {
  switch (optionKey) {
    case 'switchProfile':
    case 'windowProfile':
      return true;
    case 'tabProfile':
    case 'linkProfileNewTab':
    case 'linkProfileNewWindow':
    case 'linkProfileNewPrivateWindow':
      return profileScopeCapabilities.tab === true;
    case 'groupProfile':
      return profileScopeCapabilities.group === true;
    case 'containerProfile':
      return profileScopeCapabilities.container === true;
  }
}

function UiLocaleSelect({value, onChange}: {value: string; onChange: (value: string) => void}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedLocale = UI_LOCALES.find((locale) => locale.value === value) || UI_LOCALES[0];

  useOutsidePointer(rootRef, () => setOpen(false), open);

  return (
    <div ref={rootRef} className={`btn-group omega-profile-select ui-locale-select ${open ? 'open' : ''}`}>
      <button
        id="react-ui-locale"
        type="button"
        className="btn btn-default dropdown-toggle"
        aria-expanded={open ? 'true' : 'false'}
        aria-haspopup="true"
        role="listbox"
        onClick={() => setOpen(!open)}
      >
        <span className="glyphicon glyphicon-globe" /> <span>{selectedLocale.label}</span> <span className="caret" />
      </button>
      {open && (
        <ul className="dropdown-menu" role="listbox">
          {UI_LOCALES.map((locale) => (
            <li key={locale.value} role="option" className={value === locale.value ? 'active' : ''}>
              <a
                onClick={() => {
                  onChange(locale.value);
                  setOpen(false);
                }}
              >
                <span>{locale.label}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function UiThemeSelect({value, onChange}: {value: UiTheme; onChange: (value: UiTheme) => void}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedTheme = UI_THEMES.find((theme) => theme.value === value) || UI_THEMES[0];

  useOutsidePointer(rootRef, () => setOpen(false), open);

  return (
    <div ref={rootRef} className={`btn-group omega-profile-select ui-theme-select ${open ? 'open' : ''}`}>
      <button
        id="react-ui-theme"
        type="button"
        className="btn btn-default dropdown-toggle"
        aria-expanded={open ? 'true' : 'false'}
        aria-haspopup="true"
        role="listbox"
        onClick={() => setOpen(!open)}
      >
        <span className={`glyphicon ${UI_THEME_ICON}`} /> <span>{message(selectedTheme.messageKey, selectedTheme.fallback)}</span>{' '}
        <span className="caret" />
      </button>
      {open && (
        <ul className="dropdown-menu" role="listbox">
          {UI_THEMES.map((theme) => (
            <li key={theme.value} role="option" className={value === theme.value ? 'active' : ''}>
              <a
                onClick={() => {
                  onChange(theme.value);
                  setOpen(false);
                }}
              >
                <span>{message(theme.messageKey, theme.fallback)}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function UiSettings({
  embedded = false,
  options,
  onOptionsChange,
  onOpenShortcutConfig,
  profileScopeCapabilities: initialProfileScopeCapabilities,
  proxyDnsCapabilities: initialProxyDnsCapabilities
}: UiSettingsProps) {
  const [savedOptions, setSavedOptions] = useState<Options | null>(() => (embedded && options ? cloneOptions(options) : null));
  const [draftOptions, setDraftOptions] = useState<Options | null>(() => (embedded && options ? cloneOptions(options) : null));
  const draftOptionsRef = useRef<Options | null>(draftOptions);
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'saved' | 'error'>(() =>
    embedded && options ? 'ready' : 'loading'
  );
  const [error, setError] = useState('');
  const [profileScopeCapabilities, setProfileScopeCapabilities] = useState<ProfileScopeCapabilities>(
    initialProfileScopeCapabilities || DEFAULT_PROFILE_SCOPE_CAPABILITIES
  );
  const [proxyDnsCapabilities, setProxyDnsCapabilities] = useState<ProxyDnsCapabilities>(
    initialProxyDnsCapabilities || DEFAULT_PROXY_DNS_CAPABILITIES
  );
  const capabilityStatePromiseRef = useRef<Promise<UiCapabilityState> | null>(null);
  const providedCapabilityState = useMemo(
    () =>
      initialProfileScopeCapabilities && initialProxyDnsCapabilities
        ? {
            profileScopeCapabilities: initialProfileScopeCapabilities,
            proxyDnsCapabilities: initialProxyDnsCapabilities
          }
        : null,
    [initialProfileScopeCapabilities, initialProxyDnsCapabilities]
  );

  const loadCapabilityStateOnce = useCallback(() => {
    if (providedCapabilityState) {
      return Promise.resolve(providedCapabilityState);
    }
    if (!capabilityStatePromiseRef.current) {
      capabilityStatePromiseRef.current = loadUiCapabilityState();
    }
    return capabilityStatePromiseRef.current;
  }, [providedCapabilityState]);

  useEffect(() => {
    if (!providedCapabilityState) {
      return;
    }
    setProfileScopeCapabilities(providedCapabilityState.profileScopeCapabilities);
    setProxyDnsCapabilities(providedCapabilityState.proxyDnsCapabilities);
  }, [providedCapabilityState]);

  useEffect(() => {
    let mounted = true;
    loadCapabilityStateOnce().then((capabilities) => {
      if (mounted) {
        setProfileScopeCapabilities(capabilities.profileScopeCapabilities);
        setProxyDnsCapabilities(capabilities.proxyDnsCapabilities);
      }
    });
    return () => {
      mounted = false;
    };
  }, [loadCapabilityStateOnce]);

  useEffect(() => {
    if (embedded && options) {
      const cloned = cloneOptions(options);
      setSavedOptions(cloned);
      const draft = cloneOptions(cloned);
      draftOptionsRef.current = draft;
      setDraftOptions(draft);
      setStatus('ready');
      return;
    }

    Promise.all([loadOptions(), loadCapabilityStateOnce()])
      .then(([loadedOptions, capabilities]) => {
        const cloned = cloneOptions(loadedOptions);
        setSavedOptions(cloned);
        const draft = cloneOptions(cloned);
        draftOptionsRef.current = draft;
        setDraftOptions(draft);
        setProfileScopeCapabilities(capabilities.profileScopeCapabilities);
        setProxyDnsCapabilities(capabilities.proxyDnsCapabilities);
        setStatus('ready');
      })
      .catch((err) => {
        setError(err?.message || String(err));
        setStatus('error');
      });
  }, [embedded, loadCapabilityStateOnce, options]);

  const dirty = useMemo(() => {
    if (!savedOptions || !draftOptions) {
      return false;
    }
    return uiOptionsDirty(savedOptions, draftOptions);
  }, [savedOptions, draftOptions]);

  function updateOptions(updater: (current: Options) => Options) {
    const current = draftOptionsRef.current || draftOptions;
    if (!current) {
      return;
    }
    const nextOptions = updater(current);
    draftOptionsRef.current = nextOptions;
    setDraftOptions(nextOptions);
    if (embedded && onOptionsChange) {
      onOptionsChange(nextOptions);
    }
    if (status === 'saved') {
      setStatus('ready');
    }
  }

  function updateOption(key: string, value: unknown) {
    updateOptions((current) => ({...current, [key]: value}));
  }

  function updateProfileScope(scope: ProfileScopeKey, enabled: boolean) {
    updateOptions((current) => ({
      ...current,
      '-profileScopes': {
        ...profileScopesForOptions(current),
        [scope]: enabled
      }
    }));
  }

  function updateContextMenuOption(key: keyof ContextMenuOptions, enabled: boolean) {
    updateOptions((current) => ({
      ...current,
      '-contextMenuOptions': {
        ...contextMenuOptionsForOptions(current),
        [key]: enabled
      }
    }));
  }

  function updateQuickSwitchProfiles(profiles: string[]) {
    updateOption('-quickSwitchProfiles', profiles);
  }

  function moveQuickSwitchProfile(name: string, enabled: boolean) {
    const quickSwitchProfiles = quickSwitchProfileNames(draftOptions?.['-quickSwitchProfiles']);
    const next = moveQuickSwitchProfileName(quickSwitchProfiles, name, enabled);
    if (next === quickSwitchProfiles) {
      return;
    }
    updateQuickSwitchProfiles(next);
  }

  function reorderQuickSwitchProfile(name: string, targetName: string, enabled: boolean) {
    const quickSwitchProfiles = quickSwitchProfileNames(draftOptions?.['-quickSwitchProfiles']);
    const next = reorderQuickSwitchProfileName(quickSwitchProfiles, name, targetName, enabled);
    if (next === quickSwitchProfiles) {
      return;
    }
    updateQuickSwitchProfiles(next);
  }

  function quickSwitchDragData(event: React.DragEvent) {
    try {
      return JSON.parse(event.dataTransfer.getData('text/plain') || '{}') as {name?: string; enabled?: boolean};
    } catch (_error) {
      return {};
    }
  }

  function dropOnQuickSwitchList(event: React.DragEvent, enabled: boolean) {
    event.preventDefault();
    const data = quickSwitchDragData(event);
    if (!data.name || data.enabled === enabled) {
      return;
    }
    moveQuickSwitchProfile(data.name, enabled);
  }

  function discardChanges() {
    if (!savedOptions) {
      return;
    }
    const draft = cloneOptions(savedOptions);
    draftOptionsRef.current = draft;
    setDraftOptions(draft);
    setStatus('ready');
  }

  function applyChanges(event?: React.MouseEvent<HTMLButtonElement>) {
    event?.currentTarget.blur();
    if (!savedOptions || !draftOptions || !dirty || embedded) {
      return;
    }
    const patch = uiOptionPatch(savedOptions, draftOptions);
    setStatus('saving');
    patchOptions(patch)
      .then((loadedOptions) => {
        const cloned = cloneOptions(loadedOptions);
        setSavedOptions(cloned);
        const draft = cloneOptions(cloned);
        draftOptionsRef.current = draft;
        setDraftOptions(draft);
        setStatus('saved');
      })
      .catch((err) => {
        setError(err?.message || String(err));
        setStatus('error');
      });
  }

  function handleShortcutClick() {
    if (onOpenShortcutConfig) {
      onOpenShortcutConfig();
      return;
    }
    openDefaultShortcutConfig();
  }

  const pageHeader = (
    <div className="page-header">
      <h2>{message('options_tab_ui', 'Interface')}</h2>
    </div>
  );

  if (status === 'error' && !draftOptions) {
    const errorContent = (
      <>
        {pageHeader}
        <div className="alert alert-danger" role="alert">
          <span className="glyphicon glyphicon-remove" /> {error}
        </div>
      </>
    );
    if (embedded) {
      return errorContent;
    }
    return <main className="container-fluid react-options">{errorContent}</main>;
  }

  if (status === 'loading' || !draftOptions) {
    if (embedded) {
      return (
        <>
          {pageHeader}
          <p className="text-muted">Loading options...</p>
        </>
      );
    }
    return (
      <main className="container-fluid react-options">
        {pageHeader}
        <p className="text-muted">Loading options...</p>
      </main>
    );
  }

  const allProfiles = allProfilesFromOptions(draftOptions);
  const quickSwitchProfiles = quickSwitchProfileNames(draftOptions['-quickSwitchProfiles']);
  const notCycledProfiles = notCycledProfileNames(allProfiles, quickSwitchProfiles);
  const profileScopes = profileScopesForOptions(draftOptions);
  const contextMenuOptions = contextMenuOptionsForOptions(draftOptions);
  const contextMenuCapabilities = contextMenuCapabilitiesForProfileScope(profileScopeCapabilities);
  const socks5LocalDnsSupported = proxyDnsCapabilities.socks5 === true;

  function QuickSwitchList({enabled, names}: {enabled: boolean; names: string[]}) {
    return (
      <ul
        className={`cycle-profile-container ${enabled ? 'cycle-enabled' : ''}`}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => dropOnQuickSwitchList(event, enabled)}
      >
        {names.map((name) => (
          <li
            key={name}
            className={enabled ? '' : 'bg-success'}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData('text/plain', JSON.stringify({name, enabled}));
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              event.stopPropagation();
              const data = quickSwitchDragData(event);
              if (!data.name) {
                return;
              }
              if (data.enabled === enabled) {
                reorderQuickSwitchProfile(data.name, name, enabled);
              } else {
                moveQuickSwitchProfile(data.name, enabled);
              }
            }}
          >
            <ProfileInline profile={profileByName(draftOptions, name)} dispName={displayProfileName} />
          </li>
        ))}
        {!names.length && (
          <li className="text-muted" aria-hidden="true">
            &nbsp;
          </li>
        )}
      </ul>
    );
  }

  function ProfileScopeCheckbox({
    fallback,
    helpFallback,
    helpKey,
    messageKey,
    scope
  }: {
    fallback: string;
    helpFallback: string;
    helpKey: string;
    messageKey: string;
    scope: ProfileScopeKey;
  }) {
    const supported = profileScopeCapabilities[scope] === true;
    return (
      <div className={`checkbox ${supported ? '' : 'disabled'}`}>
        <label>
          <input
            type="checkbox"
            checked={supported && profileScopes[scope] === true}
            disabled={!supported}
            onChange={(event) => updateProfileScope(scope, event.currentTarget.checked)}
          />
          <span> {message(messageKey, fallback)}</span>
        </label>
        <p className="help-block">{message(helpKey, helpFallback)}</p>
      </div>
    );
  }

  function ContextMenuCheckbox({fallback, messageKey, optionKey}: {fallback: string; messageKey: string; optionKey: keyof ContextMenuOptions}) {
    if (!contextMenuOptionVisible(optionKey, profileScopeCapabilities)) {
      return null;
    }
    const supported = contextMenuCapabilities[optionKey] === true;
    return (
      <div className={`checkbox ${supported ? '' : 'disabled'}`}>
        <label>
          <input
            type="checkbox"
            checked={supported && contextMenuOptions[optionKey] === true}
            disabled={!supported}
            onChange={(event) => updateContextMenuOption(optionKey, event.currentTarget.checked)}
          />
          <span> {message(messageKey, fallback)}</span>
        </label>
      </div>
    );
  }

  const settings = (
    <>
      {status === 'error' && (
        <div className="alert alert-danger" role="alert">
          <span className="glyphicon glyphicon-remove" /> {error}
        </div>
      )}
      {status === 'saved' && (
        <div className="alert alert-success" role="alert">
          <span className="glyphicon glyphicon-ok" /> {message('options_saveSuccess', 'Options saved.')}
        </div>
      )}

      <section className="settings-group">
        <h3>{message('options_group_language', 'Language')}</h3>
        <div className="form-group">
          <label>{message('options_interfaceLanguage', 'Interface language')}</label>{' '}
          <UiLocaleSelect
            value={String(draftOptions['-uiLocale'] || uiLocaleForOptions(draftOptions))}
            onChange={(value) => updateOption('-uiLocale', value)}
          />
        </div>
      </section>

      <section className="settings-group">
        <h3>{message('options_group_theme', 'Theme')}</h3>
        <div className="form-group">
          <label>{message('options_interfaceTheme', 'Interface theme')}</label>{' '}
          <UiThemeSelect value={uiThemeForOptions(draftOptions)} onChange={(value) => updateOption('-uiTheme', value)} />
        </div>
      </section>

      <section className="settings-group">
        <h3>{message('options_group_profileScope', 'Profile Scope')}</h3>
        <ProfileScopeCheckbox
          scope="tab"
          messageKey="options_profileScopeTab"
          fallback="Tab profiles"
          helpKey="options_profileScopeTabHelp"
          helpFallback="Allow assigning a profile to the current tab from the popup or page context menu. Firefox only."
        />
        <ProfileScopeCheckbox
          scope="group"
          messageKey="options_profileScopeGroup"
          fallback="Tab group profiles"
          helpKey="options_profileScopeGroupHelp"
          helpFallback="Allow assigning a profile to the current tab group from the popup or page context menu. Firefox only."
        />
        <ProfileScopeCheckbox
          scope="container"
          messageKey="options_profileScopeContainer"
          fallback="Container profiles"
          helpKey="options_profileScopeContainerHelp"
          helpFallback="Allow assigning profiles to Firefox containers from the popup or page context menu. Firefox only."
        />
        <ProfileScopeCheckbox
          scope="window"
          messageKey="options_profileScopeWindow"
          fallback="Normal/private defaults"
          helpKey="options_profileScopeWindowHelp"
          helpFallback="Allow separate default profiles for normal and private windows from the popup or page context menu."
        />
      </section>

      <section className="settings-group">
        <h3>{message('options_group_miscOptions', 'Misc Options')}</h3>
        <div className="checkbox">
          <label>
            <input
              type="checkbox"
              checked={Boolean(draftOptions['-confirmDeletion'])}
              onChange={(event) => updateOption('-confirmDeletion', event.currentTarget.checked)}
            />
            <span> {message('options_confirmDeletion', 'Confirm before deleting profiles and rules.')}</span>
          </label>
        </div>
        <div className="checkbox">
          <label>
            <input
              id="react-refresh-on-profile-change"
              type="checkbox"
              checked={Boolean(draftOptions['-refreshOnProfileChange'])}
              onChange={(event) => updateOption('-refreshOnProfileChange', event.currentTarget.checked)}
            />
            <span> {message('options_refreshOnProfileChange', 'Refresh the current tab when profile changes.')}</span>
          </label>
        </div>
        <div className="checkbox">
          <label>
            <input
              type="checkbox"
              checked={Boolean(draftOptions['-showCurrentProfileInGeneral'])}
              onChange={(event) => updateOption('-showCurrentProfileInGeneral', event.currentTarget.checked)}
            />
            <span> {message('options_showCurrentProfileInGeneral', 'Show Current Profile on the General settings page.')}</span>
          </label>
        </div>
        <div className="checkbox">
          <label>
            <input
              type="checkbox"
              checked={Boolean(draftOptions['-addConditionsToBottom'])}
              onChange={(event) => updateOption('-addConditionsToBottom', event.currentTarget.checked)}
            />
            <span>
              {' '}
              {message('options_addConditionsToBottom', 'Put new conditions added using the popup menu to the bottom of the list.')}
            </span>
          </label>
        </div>
        <div className="checkbox">
          <label>
            <input
              type="checkbox"
              checked={Boolean(draftOptions['-showProfileOptions'])}
              onChange={(event) => updateOption('-showProfileOptions', event.currentTarget.checked)}
            />
            <span>
              {' '}
              {message(
                'options_showProfileOptions',
                'Show Profile Options on profile pages for hiding profiles from the popup and context menus.'
              )}
            </span>
          </label>
        </div>
        <div className="checkbox">
          <label>
            <input
              type="checkbox"
              checked={draftOptions['-showPopupAddCondition'] !== false}
              onChange={(event) => updateOption('-showPopupAddCondition', event.currentTarget.checked)}
            />
            <span> {message('options_showPopupAddCondition', 'Show Add Condition in the popup menu.')}</span>
          </label>
        </div>
        <div className="checkbox">
          <label>
            <input
              type="checkbox"
              checked={draftOptions['-showPopupAddTempRule'] !== false}
              onChange={(event) => updateOption('-showPopupAddTempRule', event.currentTarget.checked)}
            />
            <span> {message('options_showPopupAddTempRule', 'Show Add Temporary Rule in the popup menu.')}</span>
          </label>
        </div>
        <div className={`checkbox ${socks5LocalDnsSupported ? '' : 'disabled'}`}>
          <label>
            <input
              type="checkbox"
              checked={socks5LocalDnsSupported && Boolean(draftOptions['-showSocks5LocalDnsOption'])}
              disabled={!socks5LocalDnsSupported}
              onChange={(event) => updateOption('-showSocks5LocalDnsOption', event.currentTarget.checked)}
            />
            <span> {message('options_showSocks5LocalDnsOption', 'Show SOCKS5 local DNS option. Firefox only.')}</span>
          </label>
        </div>
        <div className="checkbox">
          <label>
            <input
              type="checkbox"
              checked={draftOptions['-showHttpProxyOverrideRows'] !== false}
              onChange={(event) => updateOption('-showHttpProxyOverrideRows', event.currentTarget.checked)}
            />
            <span>
              {' '}
              {message('options_showHttpProxyOverrideRows', 'Show HTTP/HTTPS proxy overrides in proxy profiles.')}
            </span>
          </label>
        </div>
        <div className="checkbox">
          <label>
            <input
              type="checkbox"
              checked={Boolean(draftOptions['-showWebSocketProxyOverrideRows'])}
              onChange={(event) => updateOption('-showWebSocketProxyOverrideRows', event.currentTarget.checked)}
            />
            <span>
              {' '}
              {message('options_showWebSocketProxyOverrideRows', 'Show WebSocket (ws/wss) proxy overrides in proxy profiles.')}
            </span>
          </label>
        </div>
        <div className="checkbox">
          <label>
            <input
              type="checkbox"
              checked={Boolean(draftOptions['-showBypassListGroups'])}
              onChange={(event) => updateOption('-showBypassListGroups', event.currentTarget.checked)}
            />
            <span> {message('options_showBypassListGroups', 'Show bypass list groups in proxy profiles.')}</span>
          </label>
        </div>
      </section>

      <section className="settings-group">
        <h3>{message('options_group_contextMenuOptions', 'Context Menu')}</h3>
        <ContextMenuCheckbox
          optionKey="switchProfile"
          messageKey="options_contextMenuSwitchProfile"
          fallback="Show Switch Profile"
        />
        <ContextMenuCheckbox
          optionKey="tabProfile"
          messageKey="options_contextMenuTabProfile"
          fallback="Show tab profile switching"
        />
        <ContextMenuCheckbox
          optionKey="groupProfile"
          messageKey="options_contextMenuGroupProfile"
          fallback="Show tab group profile switching"
        />
        <ContextMenuCheckbox
          optionKey="containerProfile"
          messageKey="options_contextMenuContainerProfile"
          fallback="Show container profile switching"
        />
        <ContextMenuCheckbox
          optionKey="windowProfile"
          messageKey="options_contextMenuWindowProfile"
          fallback="Show normal/private default switching"
        />
        <ContextMenuCheckbox
          optionKey="linkProfileNewTab"
          messageKey="options_contextMenuOpenLinkInNewTabWithProfile"
          fallback="Show Open Link in New Tab with Profile"
        />
        <ContextMenuCheckbox
          optionKey="linkProfileNewWindow"
          messageKey="options_contextMenuOpenLinkInNewWindowWithProfile"
          fallback="Show Open Link in New Window with Profile"
        />
        <ContextMenuCheckbox
          optionKey="linkProfileNewPrivateWindow"
          messageKey="options_contextMenuOpenLinkInNewPrivateWindowWithProfile"
          fallback="Show Open Link in New Private Window with Profile"
        />
      </section>

      <section className="settings-group">
        <h3>{message('options_group_keyboardShortcut', 'Keyboard Shortcut')}</h3>
        <p>
          <button type="button" role="button" className="btn btn-default" onClick={handleShortcutClick}>
            <span className="glyphicon glyphicon-share-alt" /> {message('options_menuShortcutConfigure', 'Configure shortcut')}
          </button>{' '}
          {message('options_menuShortcutHelp', 'Configure keyboard shortcuts in the extension settings.')}
        </p>
        <p className="help-block">
          {message('options_menuShortcutMore', 'More shortcut settings are available in the browser extension settings.')}
        </p>
      </section>

      <section className="settings-group">
        <h3>{message('options_group_switchOptions', 'Switch Options')}</h3>
        <div className="form-group">
          <label htmlFor="react-startup-profile">{message('options_startupProfile', 'Startup Profile')}</label>{' '}
          <ProfileSelect
            defaultText={message('options_startupProfile_none', '(Current Profile)')}
            dispName={displayProfileName}
            inline
            name={String(draftOptions['-startupProfileName'] || '')}
            onChange={(name) => updateOption('-startupProfileName', name)}
            profiles={allProfiles}
          />
        </div>
        <div className="checkbox">
          <label>
            <input
              type="checkbox"
              checked={Boolean(draftOptions['-showConditionTypes'])}
              onChange={(event) => updateOption('-showConditionTypes', event.currentTarget.checked ? 1 : 0)}
            />
            <span> {message('options_showConditionTypesAdvanced', 'Show advanced condition types')}</span>
          </label>
          <p className="help-block">{message('options_showConditionTypesAdvancedHelp', 'Unlock advanced condition types.')}</p>
        </div>
        <div className="checkbox">
          <label>
            <input
              type="checkbox"
              checked={Boolean(draftOptions['-enableQuickSwitch'])}
              onChange={(event) => updateOption('-enableQuickSwitch', event.currentTarget.checked)}
            />
            <span> {message('options_quickSwitch', 'Quick Switch')}</span>
          </label>
        </div>
        {Boolean(draftOptions['-enableQuickSwitch']) && (
          <div id="quick-switch-settings" className="settings-group">
            <h4>{message('options_cycledProfiles', 'Cycled Profiles')}</h4>
            <p className="help-block">{message('options_cycledProfilesHelp', 'Cycle through these profiles when using Quick Switch.')}</p>
            {quickSwitchProfiles.length < 2 && (
              <div className="has-error">
                <p className="help-block">{message('options_cycledProfilesTooFew', 'At least 2 profiles are required for cycling.')}</p>
              </div>
            )}
            <QuickSwitchList enabled names={quickSwitchProfiles} />
            <h4>{message('options_notCycledProfiles', 'Not Cycled Profiles')}</h4>
            <QuickSwitchList enabled={false} names={notCycledProfiles} />
          </div>
        )}
      </section>

      {!embedded && (
        <div className="react-actions">
          <button
            type="button"
            className={`btn ${dirty ? 'btn-success' : 'btn-default'}`}
            disabled={!dirty || status === 'saving'}
            onClick={applyChanges}
          >
            <span className="glyphicon glyphicon-ok-circle" />{' '}
            {status === 'saving' ? 'Saving...' : message('options_apply', 'Apply changes')}
          </button>
          <button type="button" className="btn btn-link text-danger" disabled={!dirty || status === 'saving'} onClick={discardChanges}>
            <span className="glyphicon glyphicon-remove-circle" /> {message('options_discard', 'Discard changes')}
          </button>
        </div>
      )}
    </>
  );

  if (embedded) {
    return (
      <>
        {pageHeader}
        {settings}
      </>
    );
  }

  return (
    <main className="container-fluid react-options">
      {pageHeader}
      {settings}
    </main>
  );
}

export function mount(element: Element, props: UiSettingsProps = {}) {
  const root = createRoot(element);
  flushSync(() => {
    root.render(<UiSettings {...props} />);
  });
  return {
    render(nextProps: UiSettingsProps = {}) {
      root.render(<UiSettings {...nextProps} />);
    },
    unmount() {
      root.unmount();
    }
  };
}

const rootElement = document.getElementById('react-root');

if (rootElement && shouldAutoMount('ui.js')) {
  mount(rootElement);
}
