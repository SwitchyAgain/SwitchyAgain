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
  runtimeAvailable,
  shouldAutoMount
} from './options_client';

const GENERAL_KEYS = [
  '-monitorWebRequests',
  '-downloadInterval',
  '-showExternalProfile'
];

const DOWNLOAD_INTERVALS = [15, 60, 180, 360, 720, 1440, -1];

export type GeneralSettingsProps = {
  embedded?: boolean;
  options?: Options | null;
  onOptionsChange?: (options: Options) => void;
};

function htmlMessage(key: string, fallback: string, substitutions?: string | string[]) {
  return {__html: message(key, fallback, substitutions)};
}

function cloneOptions(options: Options) {
  return JSON.parse(JSON.stringify(options));
}

function ProfileBadge({label, icon, color}: {label: string; icon: string; color: string}) {
  return (
    <span className="profile-inline react-profile-inline">
      <span className={`glyphicon ${icon}`} style={{color}} />{' '}
      {label}
    </span>
  );
}

function messageWithBadges(
  key: string,
  fallback: string,
  substitutions: string[],
  badges: Record<string, React.ReactNode>
) {
  const text = message(key, fallback, substitutions);
  const tokens = Object.keys(badges);
  if (!tokens.length) {
    return text;
  }
  const pattern = new RegExp(`(${tokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
  return text.split(pattern).map((part, index) => badges[part] ? (
    <React.Fragment key={`${part}-${index}`}>{badges[part]}</React.Fragment>
  ) : part);
}

export function GeneralSettings({embedded = false, options, onOptionsChange}: GeneralSettingsProps) {
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
    return GENERAL_KEYS.some((key) => savedOptions[key] !== draftOptions[key]);
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

  function applyChanges(event?: React.MouseEvent<HTMLButtonElement>) {
    event?.currentTarget.blur();
    if (!savedOptions || !draftOptions || !dirty || embedded) {
      return;
    }
    const patch = optionPatch(savedOptions, draftOptions, GENERAL_KEYS);
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

  const pageHeader = (
    <div className="page-header">
      <h2>{message('options_tab_general', 'General')}</h2>
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
        <h3>{message('options_group_networkRequests', 'Network Requests')}</h3>
        <div className="checkbox">
          <label>
            <input
              id="react-monitor-web-requests"
              type="checkbox"
              checked={Boolean(draftOptions['-monitorWebRequests'])}
              onChange={(event) => updateOption('-monitorWebRequests', event.currentTarget.checked)}
            />
            <span> {message('options_monitorWebRequests', 'Show count of failed web requests for resources in the current tab.')}</span>
          </label>
          <p
            className="help-block"
            dangerouslySetInnerHTML={htmlMessage(
              'options_monitorWebRequestsHelp',
              'A yellow badge will be displayed on the icon if some resources fail to load.'
            )}
          />
        </div>
      </section>

      <section className="settings-group width-limit">
        <h3>{message('options_downloadOptions', 'Download Options')}</h3>
        <p className="help-block">{message('options_downloadOptionsHelp', 'Configure the update frequency of online rule lists and PAC scripts.')}</p>
        <div className="form-group">
          <label htmlFor="react-download-interval">{message('options_downloadInterval', 'Download Interval')}</label>
          <select
            id="react-download-interval"
            className="form-control inline-form-control"
            value={draftOptions['-downloadInterval']}
            onChange={(event) => updateOption('-downloadInterval', Number(event.currentTarget.value))}
          >
            {DOWNLOAD_INTERVALS.map((interval) => (
              <option key={interval} value={interval}>
                {message(`options_downloadInterval_${interval < 0 ? 'never' : interval}`, interval < 0 ? 'Never' : `${interval} Minutes`)}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="settings-group width-limit">
        <h3>{message('options_group_conflicts', 'Conflicts')}</h3>
        <p>{message('options_conflicts_introduction', 'Other apps may also try to control proxy settings, resulting in conflicts.')}</p>
        <p className="help-text text-danger">
          <span style={{padding: '1px 4px', background: '#da4f49', color: '#fff', boxShadow: '#ccc 1px 1px 1px 1px'}}>=</span>{' '}
          {message('options_conflicts_lowerPriority', 'A red badge indicates that another app has higher priority.')}
        </p>
        <p className="help-text text-info">
          <span className="glyphicon glyphicon-info-sign" />{' '}
          <span>
            {messageWithBadges(
              'options_conflicts_higherPriority',
              'If SwitchyAgain has higher priority, you can give control back to other apps or system settings by selecting __SYSTEM_PROFILE__ in the popup menu.',
              ['__SYSTEM_PROFILE__'],
              {
                __SYSTEM_PROFILE__: <ProfileBadge label={message('profile_system', '[System Proxy]')} icon="glyphicon-off" color="#000" />
              }
            )}
          </span>
        </p>
        <div className="checkbox">
          <label>
            <input
              id="react-show-external-profile"
              type="checkbox"
              checked={Boolean(draftOptions['-showExternalProfile'])}
              onChange={(event) => updateOption('-showExternalProfile', event.currentTarget.checked)}
            />
            <span> {message('options_showExternalProfile', 'Show popup menu item to import proxy settings from other apps.')}</span>
          </label>
        </div>
        <p className="help-block">
          {messageWithBadges(
            'options_showExternalProfileHelp',
            'When __SYSTEM_PROFILE__ is selected, you can import the effective proxy settings from other apps by selecting __EXTERNAL_PROFILE__ on the popup menu.',
            ['__SYSTEM_PROFILE__', '__EXTERNAL_PROFILE__'],
            {
              __SYSTEM_PROFILE__: <ProfileBadge label={message('profile_system', '[System Proxy]')} icon="glyphicon-off" color="#000" />,
              __EXTERNAL_PROFILE__: <ProfileBadge label={message('popup_externalProfile', '(External Profile)')} icon="glyphicon-globe" color="#49afcd" />
            }
          )}
        </p>
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
        <h2>{message('options_tab_general', 'General')}</h2>
        <p className="text-muted">
          React preview · {message('manifest_app_name', 'SwitchyAgain')} {manifestVersion()} · runtime {runtimeAvailable() ? 'available' : 'unavailable'}
        </p>
      </div>

      {settings}
    </main>
  );
}

export function mount(element: Element, props: GeneralSettingsProps = {}) {
  const root = createRoot(element);
  flushSync(() => {
    root.render(<GeneralSettings {...props} />);
  });
  return {
    render(nextProps: GeneralSettingsProps = {}) {
      root.render(<GeneralSettings {...nextProps} />);
    },
    unmount() {
      root.unmount();
    }
  };
}

const globalWindow = window as any;
globalWindow.OmegaReactGeneralSettings = {
  mount
};

const rootElement = document.getElementById('react-root');

if (rootElement && shouldAutoMount('general.js')) {
  mount(rootElement);
}
