import React, {useEffect, useMemo, useState} from 'react';
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

const GENERAL_KEYS = [
  '-monitorWebRequests',
  '-downloadInterval',
  '-showExternalProfile'
];

const DOWNLOAD_INTERVALS = [15, 60, 180, 360, 720, 1440, -1];

function htmlMessage(key: string, fallback: string, substitutions?: string | string[]) {
  return {__html: message(key, fallback, substitutions)};
}

function cloneOptions(options: Options) {
  return JSON.parse(JSON.stringify(options));
}

function GeneralSettings() {
  const [savedOptions, setSavedOptions] = useState<Options | null>(null);
  const [draftOptions, setDraftOptions] = useState<Options | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'saved' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    loadOptions().then((options) => {
      const cloned = cloneOptions(options);
      setSavedOptions(cloned);
      setDraftOptions(cloneOptions(cloned));
      setStatus('ready');
    }).catch((err) => {
      setError(err?.message || String(err));
      setStatus('error');
    });
  }, []);

  const dirty = useMemo(() => {
    if (!savedOptions || !draftOptions) {
      return false;
    }
    return GENERAL_KEYS.some((key) => savedOptions[key] !== draftOptions[key]);
  }, [savedOptions, draftOptions]);

  function updateOption(key: string, value: any) {
    setDraftOptions((current) => current ? {...current, [key]: value} : current);
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
    if (!savedOptions || !draftOptions || !dirty) {
      return;
    }
    const patch = optionPatch(savedOptions, draftOptions, GENERAL_KEYS);
    setStatus('saving');
    patchOptions(patch).then((options) => {
      const cloned = cloneOptions(options);
      setSavedOptions(cloned);
      setDraftOptions(cloneOptions(cloned));
      setStatus('saved');
    }).catch((err) => {
      setError(err?.message || String(err));
      setStatus('error');
    });
  }

  if (status === 'loading' || !draftOptions) {
    return (
      <main className="container-fluid react-options">
        <div className="page-header">
          <h2>{message('options_tab_general', 'General')}</h2>
        </div>
        <p className="text-muted">Loading options...</p>
      </main>
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
          <span className="react-conflict-badge">=</span>{' '}
          {message('options_conflicts_lowerPriority', 'A red badge indicates that another app has higher priority.')}
        </p>
        <p
          className="help-text text-info"
          dangerouslySetInnerHTML={htmlMessage(
            'options_conflicts_higherPriority',
            'If SwitchyAgain has higher priority, you can give control back to other apps or system settings by selecting system in the popup menu.',
            ['system']
          )}
        />
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
        <p
          className="help-block"
          dangerouslySetInnerHTML={htmlMessage(
            'options_showExternalProfileHelp',
            'When system is selected, you can import the effective proxy settings from other apps.',
            ['system', 'external profile']
          )}
        />
      </section>

      <div className="react-actions">
        <button type="button" className={`btn ${dirty ? 'btn-success' : 'btn-default'}`} disabled={!dirty || status === 'saving'} onClick={applyChanges}>
          <span className="glyphicon glyphicon-ok-circle" /> {status === 'saving' ? 'Saving...' : message('options_apply', 'Apply changes')}
        </button>
        <button type="button" className="btn btn-link text-danger" disabled={!dirty || status === 'saving'} onClick={discardChanges}>
          <span className="glyphicon glyphicon-remove-circle" /> {message('options_discard', 'Discard changes')}
        </button>
      </div>
    </main>
  );
}

const rootElement = document.getElementById('react-root');

if (!rootElement) {
  throw new Error('Missing React root element.');
}

createRoot(rootElement).render(<GeneralSettings />);
