import React, {useEffect, useMemo, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {
  Options,
  loadOptions,
  manifestVersion,
  message,
  optionPatch,
  patchOptions,
  runtimeAvailable
} from './options_client';

const UI_KEYS = [
  '-confirmDeletion',
  '-refreshOnProfileChange',
  '-showInspectMenu',
  '-addConditionsToBottom'
];

type UiSettingsProps = {
  embedded?: boolean;
  options?: Options | null;
  onOptionsChange?: (options: Options) => void;
  onOpenShortcutConfig?: () => void;
};

function cloneOptions(options: Options) {
  return JSON.parse(JSON.stringify(options));
}

function openShortcutConfig() {
  const tabs = (chrome as any)?.tabs;
  if (tabs?.create) {
    tabs.create({
      url: 'chrome://extensions/configureCommands'
    });
  }
}

function UiSettings({embedded = false, options, onOptionsChange, onOpenShortcutConfig}: UiSettingsProps) {
  const [savedOptions, setSavedOptions] = useState<Options | null>(() => embedded && options ? cloneOptions(options) : null);
  const [draftOptions, setDraftOptions] = useState<Options | null>(() => embedded && options ? cloneOptions(options) : null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'saved' | 'error'>(() => embedded && options ? 'ready' : 'loading');
  const [error, setError] = useState('');

  useEffect(() => {
    if (embedded && options) {
      const cloned = cloneOptions(options);
      setSavedOptions(cloned);
      setDraftOptions(cloneOptions(cloned));
      setStatus('ready');
      return;
    }

    loadOptions().then((loadedOptions) => {
      const cloned = cloneOptions(loadedOptions);
      setSavedOptions(cloned);
      setDraftOptions(cloneOptions(cloned));
      setStatus('ready');
    }).catch((err) => {
      setError(err?.message || String(err));
      setStatus('error');
    });
  }, [embedded, options]);

  const dirty = useMemo(() => {
    if (!savedOptions || !draftOptions) {
      return false;
    }
    return UI_KEYS.some((key) => savedOptions[key] !== draftOptions[key]);
  }, [savedOptions, draftOptions]);

  function updateOption(key: string, value: any) {
    setDraftOptions((current) => {
      if (!current) {
        return current;
      }
      const next = {...current, [key]: value};
      if (embedded && onOptionsChange) {
        onOptionsChange(next);
      }
      return next;
    });
    if (status === 'saved') {
      setStatus('ready');
    }
  }

  function discardChanges() {
    if (!savedOptions) {
      return;
    }
    setDraftOptions(cloneOptions(savedOptions));
    setStatus('ready');
  }

  function applyChanges() {
    if (!savedOptions || !draftOptions || !dirty || embedded) {
      return;
    }
    const patch = optionPatch(savedOptions, draftOptions, UI_KEYS);
    setStatus('saving');
    patchOptions(patch).then((loadedOptions) => {
      const cloned = cloneOptions(loadedOptions);
      setSavedOptions(cloned);
      setDraftOptions(cloneOptions(cloned));
      setStatus('saved');
    }).catch((err) => {
      setError(err?.message || String(err));
      setStatus('error');
    });
  }

  function handleShortcutClick() {
    if (onOpenShortcutConfig) {
      onOpenShortcutConfig();
      return;
    }
    openShortcutConfig();
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
        <p className="help-block">{message('options_menuShortcutMore', 'More shortcut settings are available in the browser extension settings.')}</p>
      </section>

      {!embedded && (
        <div className="react-actions">
          <button type="button" className={`btn ${dirty ? 'btn-success' : 'btn-default'}`} disabled={!dirty || status === 'saving'} onClick={applyChanges}>
            <span className="glyphicon glyphicon-ok-circle" /> {status === 'saving' ? 'Saving...' : message('options_apply', 'Apply changes')}
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
      <div className="page-header">
        <h2>{message('options_tab_ui', 'Interface')}</h2>
        <p className="text-muted">
          React preview · {message('manifest_app_name', 'SwitchyAgain')} {manifestVersion()} · runtime {runtimeAvailable() ? 'available' : 'unavailable'}
        </p>
      </div>

      {settings}
    </main>
  );
}

function mount(element: Element, props: UiSettingsProps = {}) {
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

const globalWindow = window as any;
globalWindow.OmegaReactUiSettings = {
  mount
};

const rootElement = document.getElementById('react-root');

if (rootElement) {
  mount(rootElement);
}
