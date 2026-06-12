import React, {useEffect, useMemo, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {
  Options,
  loadOptions,
  message,
  openShortcutConfig as openDefaultShortcutConfig,
  patchOptions,
  shouldAutoMount,
  UI_LOCALES,
  uiLocaleForOptions
} from './options_client';
import {Profile, ProfileInline, ProfileSelect, allProfilesFromOptions, profileByName} from './profile_widgets';
import {cloneOptions} from './options_logic';
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
};

function displayProfileName(profile: Profile) {
  if (profile.builtin) {
    return message(`profile_${profile.name}`, profile.name);
  }
  return profile.name;
}

function UiLocaleSelect({value, onChange}: {value: string; onChange: (value: string) => void}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedLocale = UI_LOCALES.find((locale) => locale.value === value) || UI_LOCALES[0];

  useEffect(() => {
    if (!open) {
      return;
    }
    function closeOnOutsidePointer(event: MouseEvent | TouchEvent) {
      if (rootRef.current?.contains(event.target as Node)) {
        return;
      }
      setOpen(false);
    }
    document.addEventListener('mousedown', closeOnOutsidePointer);
    document.addEventListener('touchstart', closeOnOutsidePointer);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsidePointer);
      document.removeEventListener('touchstart', closeOnOutsidePointer);
    };
  }, [open]);

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

export function UiSettings({embedded = false, options, onOptionsChange, onOpenShortcutConfig}: UiSettingsProps) {
  const [savedOptions, setSavedOptions] = useState<Options | null>(() => (embedded && options ? cloneOptions(options) : null));
  const [draftOptions, setDraftOptions] = useState<Options | null>(() => (embedded && options ? cloneOptions(options) : null));
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'saved' | 'error'>(() =>
    embedded && options ? 'ready' : 'loading'
  );
  const [error, setError] = useState('');

  useEffect(() => {
    if (embedded && options) {
      const cloned = cloneOptions(options);
      setSavedOptions(cloned);
      setDraftOptions(cloneOptions(cloned));
      setStatus('ready');
      return;
    }

    loadOptions()
      .then((loadedOptions) => {
        const cloned = cloneOptions(loadedOptions);
        setSavedOptions(cloned);
        setDraftOptions(cloneOptions(cloned));
        setStatus('ready');
      })
      .catch((err) => {
        setError(err?.message || String(err));
        setStatus('error');
      });
  }, [embedded, options]);

  const dirty = useMemo(() => {
    if (!savedOptions || !draftOptions) {
      return false;
    }
    return uiOptionsDirty(savedOptions, draftOptions);
  }, [savedOptions, draftOptions]);

  function updateOptions(updater: (current: Options) => Options) {
    setDraftOptions((current) => {
      if (!current) {
        return current;
      }
      const next = updater(current);
      if (embedded && onOptionsChange) {
        onOptionsChange(next);
      }
      return next;
    });
    if (status === 'saved') {
      setStatus('ready');
    }
  }

  function updateOption(key: string, value: unknown) {
    updateOptions((current) => ({...current, [key]: value}));
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
    setDraftOptions(cloneOptions(savedOptions));
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
        setDraftOptions(cloneOptions(cloned));
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
              checked={Boolean(draftOptions['-showInspectMenu'])}
              onChange={(event) => updateOption('-showInspectMenu', event.currentTarget.checked)}
            />
            <span> {message('options_showInspectMenu', 'Show inspect menu.')}</span>
          </label>
        </div>
        <div className="checkbox">
          <label>
            <input
              type="checkbox"
              checked={Boolean(draftOptions['-addConditionsToBottom'])}
              onChange={(event) => updateOption('-addConditionsToBottom', event.currentTarget.checked)}
            />
            <span> {message('options_addConditionsToBottom', 'Add new conditions to the bottom.')}</span>
          </label>
        </div>
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
