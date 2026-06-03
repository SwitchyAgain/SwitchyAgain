import React, {useEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {
  downloadBlob,
  getLocalState,
  loadOptions,
  manifestVersion,
  message,
  Options,
  resetOptions,
  resetOptionsSync,
  runtimeAvailable,
  setLocalState,
  setOptionsSync
} from './options_client';

const RESTORE_URL_STATE = 'web.restoreOnlineUrl';

type ImportExportProps = {
  embedded?: boolean;
  onApplyOptionsConfirm?: () => Promise<any> | any;
  onOptionsChange?: (nextOptions: Options, options?: {dirty?: boolean; replace?: boolean}) => void;
  options?: Options | null;
};

function htmlMessage(key: string, fallback: string) {
  return {__html: message(key, fallback)};
}

function errorMessage(error: any) {
  return error?.message || error?.reason || String(error);
}

function readTextFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('Unable to read file.'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsText(file);
  });
}

function storedRestoreUrl() {
  return getLocalState<string>(RESTORE_URL_STATE) || '';
}

function ImportExport({
  embedded = false,
  onApplyOptionsConfirm,
  onOptionsChange,
  options: initialOptions,
}: ImportExportProps) {
  const [options, setOptions] = useState<Options | null>(() => embedded && initialOptions ? initialOptions : null);
  const [restoreUrl, setRestoreUrl] = useState(storedRestoreUrl);
  const [status, setStatus] = useState<'loading' | 'ready' | 'exporting' | 'restoringLocal' | 'restoringOnline' | 'success' | 'error'>(() => embedded && initialOptions ? 'ready' : 'loading');
  const [syncStatus, setSyncStatus] = useState<'ready' | 'enabling' | 'disabling' | 'resetting'>('ready');
  const [syncOptions, setSyncOptions] = useState<'pristine' | 'disabled' | 'sync' | 'conflict' | 'unsupported' | string | undefined>(() => getLocalState('syncOptions'));
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSyncOptions(getLocalState('syncOptions'));
  }, []);

  useEffect(() => {
    if (embedded && initialOptions) {
      setOptions(initialOptions);
      setStatus('ready');
      return;
    }

    loadOptions().then((loadedOptions) => {
      setOptions(loadedOptions);
      setStatus('ready');
    }).catch((err) => {
      setError(errorMessage(err));
      setStatus('error');
    });
  }, [embedded, initialOptions]);

  function showSuccess() {
    setError('');
    setStatus('success');
  }

  function showError(err: any, fallbackKey: string, fallback: string) {
    const messageText = errorMessage(err) || message(fallbackKey, fallback);
    setError(messageText);
    setStatus('error');
  }

  function exportOptions() {
    if (!options) {
      return;
    }
    setStatus('exporting');
    Promise.resolve(onApplyOptionsConfirm?.()).then(() => {
      const plainOptions = JSON.parse(JSON.stringify(options));
      const blob = new Blob([JSON.stringify(plainOptions)], {
        type: 'text/plain;charset=utf-8'
      });
      downloadBlob(blob, 'OmegaOptions.bak');
    }).finally(() => {
      setStatus('ready');
    });
  }

  function restoreFromContent(content: string, restoringStatus: 'restoringLocal' | 'restoringOnline') {
    setStatus(restoringStatus);
    resetOptions(content).then((loadedOptions) => {
      setOptions(loadedOptions);
      return Promise.resolve(onOptionsChange?.(loadedOptions, {
        dirty: false,
        replace: true
      }));
    }).then(() => {
      showSuccess();
    }).catch((err) => {
      showError(err, 'options_importFormatError', 'Invalid backup file!');
    });
  }

  function restoreLocal(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) {
      return;
    }
    setStatus('restoringLocal');
    readTextFile(file).then((content) => {
      restoreFromContent(content, 'restoringLocal');
    }).catch((err) => {
      showError(err, 'options_importFormatError', 'Invalid backup file!');
    });
  }

  function restoreOnline() {
    const url = restoreUrl.trim();
    if (!url) {
      return;
    }
    setLocalState(RESTORE_URL_STATE, url);
    setStatus('restoringOnline');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    fetch(url, {
      cache: 'no-store',
      signal: controller.signal
    }).then((response) => {
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      return response.text();
    }).then((content) => {
      restoreFromContent(content, 'restoringOnline');
    }).catch((err) => {
      showError(err, 'options_importDownloadError', 'Error downloading backup file!');
    }).finally(() => {
      window.clearTimeout(timeout);
    });
  }

  const busy = status === 'loading' || status === 'exporting' || status === 'restoringLocal' || status === 'restoringOnline';
  const syncBusy = syncStatus !== 'ready';

  function runSyncAction(nextStatus: typeof syncStatus, action?: () => Promise<any> | any) {
    if (!action) {
      return;
    }
    setSyncStatus(nextStatus);
    Promise.resolve(action()).then(() => {
      setSyncStatus('ready');
    }).catch(() => {
      setSyncStatus('ready');
    });
  }

  function reloadOptionsPage() {
    window.location.reload();
  }

  function confirmCurrentOptions() {
    return Promise.resolve(onApplyOptionsConfirm?.());
  }

  function enableOptionsSync(args?: {force?: boolean}) {
    const enable = () => setOptionsSync(true, args).finally(reloadOptionsPage);
    return args?.force ? enable() : confirmCurrentOptions().then(enable);
  }

  function disableOptionsSync() {
    return setOptionsSync(false).then(() => confirmCurrentOptions().then(reloadOptionsPage));
  }

  function resetSyncedOptions() {
    return resetOptionsSync().then(() => confirmCurrentOptions().then(reloadOptionsPage));
  }

  const profileSection = (
    <section className="settings-group">
      <h3>{message('options_group_importExportProfile', 'Profile')}</h3>
      <div className="help-block">
        <div className="text-info">
          <span className="glyphicon glyphicon-info-sign" /> {message('options_exportProfileHelp', 'To export a profile, use the top-right action bar on the profile page.')}
        </div>
      </div>
      {!(Number(options?.['-showConditionTypes'] || 0) > 0) && (
        <div className="checkbox">
          <label>
            <input
              type="checkbox"
              checked={Boolean(options?.['-exportLegacyRuleList'])}
              onChange={(event) => {
                const nextOptions = {
                  ...(options || {}),
                  '-exportLegacyRuleList': event.currentTarget.checked
                };
                setOptions(nextOptions);
                onOptionsChange?.({
                  '-exportLegacyRuleList': event.currentTarget.checked
                });
              }}
            />{' '}
            <span>{message('options_exportLegacyRuleList', 'Export legacy rule lists')}</span>
          </label>
          <p
            className="help-block"
            dangerouslySetInnerHTML={htmlMessage(
              'options_exportLegacyRuleListHelp',
              'Enable this option only if you publish rule lists for users of those projects.'
            )}
          />
        </div>
      )}
    </section>
  );

  const settingsSection = (
    <section className="settings-group">
      {status === 'error' && (
        <div className="alert alert-danger" role="alert">
          <span className="glyphicon glyphicon-remove" /> {error || message('options_importFormatError', 'Invalid backup file!')}
        </div>
      )}
      {status === 'success' && (
        <div className="alert alert-success" role="alert">
          <span className="glyphicon glyphicon-ok" /> {message('options_importSuccess', 'Options imported.')}
        </div>
      )}

      <h3>{message('options_group_importExportSettings', 'Settings')}</h3>
      <p className="react-action-row">
        <button type="button" className="btn btn-default" disabled={!options || busy} onClick={exportOptions}>
          <span className="glyphicon glyphicon-floppy-save" /> {message('options_makeBackup', 'Make backup')}
        </button>{' '}
        <span className="help-inline">{message('options_makeBackupHelp', 'Make a full backup of your options (including profiles and all other options).')}</span>
      </p>

      <p className="react-action-row">
        <input
          ref={fileInputRef}
          id="react-restore-local-file"
          type="file"
          style={{display: 'none'}}
          onChange={restoreLocal}
        />
        <button type="button" className="btn btn-default" disabled={busy} onClick={() => fileInputRef.current?.click()}>
          <span className="glyphicon glyphicon-folder-open" /> {status === 'restoringLocal' ? message('options_restoreOnlineSubmit', 'Restore') + '...' : message('options_restoreLocal', 'Restore from file')}
        </button>{' '}
        <span className="help-inline">{message('options_restoreLocalHelp', 'Restore your SwitchyAgain options from a local file.')}</span>
      </p>

      <div className="form-group">
        <label htmlFor="react-restore-online-url">{message('options_restoreOnline', 'Restore from online')}</label>
        <div className="input-group width-limit">
          <input
            id="react-restore-online-url"
            className="form-control"
            type="url"
            value={restoreUrl}
            placeholder={message('options_restoreOnlinePlaceholder', "Options file URL (e.g. 'http://example.com/switchy.bak')")}
            onChange={(event) => {
              const url = event.currentTarget.value;
              setRestoreUrl(url);
              setLocalState(RESTORE_URL_STATE, url);
            }}
          />
          <span className="input-group-btn">
            <button type="button" className="btn btn-default" disabled={busy || !restoreUrl.trim()} onClick={restoreOnline}>
              {status === 'restoringOnline' ? message('options_restoreOnlineSubmit', 'Restore') + '...' : message('options_restoreOnlineSubmit', 'Restore')}
            </button>
          </span>
        </div>
      </div>
    </section>
  );

  const syncSection = (
    <section className="settings-group">
      <h3>{message('options_group_syncing', 'Syncing')}</h3>
      {(syncOptions === 'pristine' || syncOptions === 'disabled') && (
        <>
          <p className="help-block" dangerouslySetInnerHTML={htmlMessage('options_syncPristineHelp', 'Sync your options using browser storage.')} />
          <p>
            <button type="button" className="btn btn-default" disabled={syncBusy} onClick={() => runSyncAction('enabling', enableOptionsSync)}>
              <span className="glyphicon glyphicon-cloud-upload" /> {message('options_syncEnable', 'Enable sync')}
            </button>
          </p>
        </>
      )}
      {syncOptions === 'sync' && (
        <>
          <p className="alert alert-success width-limit">
            <span className="glyphicon glyphicon-ok" /> {message('options_syncSyncAlert', 'Options sync is enabled.')}
          </p>
          <p className="help-block" dangerouslySetInnerHTML={htmlMessage('options_syncSyncHelp', 'Your options are synchronized.')} />
          <p>
            <button type="button" className="btn btn-warning" disabled={syncBusy} onClick={() => runSyncAction('disabling', disableOptionsSync)}>
              <span className="glyphicon glyphicon-remove-sign" /> {message('options_syncDisable', 'Disable sync')}
            </button>
          </p>
        </>
      )}
      {syncOptions === 'conflict' && (
        <>
          <p className="alert alert-info width-limit">
            <span className="glyphicon glyphicon-info-sign" /> {message('options_syncConflictAlert', 'Options sync conflict detected.')}
          </p>
          <p className="help-block" dangerouslySetInnerHTML={htmlMessage('options_syncConflictHelp', 'Choose which options should be used for syncing.')} />
          <p>
            <button type="button" className="btn btn-danger" disabled={syncBusy} onClick={() => runSyncAction('enabling', () => enableOptionsSync({force: true}))}>
              <span className="glyphicon glyphicon-cloud-download" /> {message('options_syncEnableForce', 'Use synced options')}
            </button>{' '}
            <button type="button" className="btn btn-link" disabled={syncBusy} onClick={() => runSyncAction('resetting', resetSyncedOptions)}>
              <span className="glyphicon glyphicon-erase" /> {message('options_syncReset', 'Reset sync')}
            </button>
          </p>
        </>
      )}
      {syncOptions === 'unsupported' && (
        <p className="help-block" dangerouslySetInnerHTML={htmlMessage('options_syncUnsupportedHelp', 'Options sync is not supported in this browser.')} />
      )}
    </section>
  );

  if (embedded) {
    return (
      <>
        <div className="page-header">
          <h2>{message('options_tab_importExport', 'Import/Export')}</h2>
        </div>
        {profileSection}
        {settingsSection}
        {syncSection}
      </>
    );
  }

  return (
    <main className="container-fluid react-options">
      <div className="page-header">
        <h2>{message('options_tab_importExport', 'Import/Export')}</h2>
        <p className="text-muted">
          React preview · {message('manifest_app_name', 'SwitchyAgain')} {manifestVersion()} · runtime {runtimeAvailable() ? 'available' : 'unavailable'}
        </p>
      </div>

      {profileSection}
      {settingsSection}
      {syncSection}
    </main>
  );
}

function mount(element: Element, props: ImportExportProps = {}) {
  const root = createRoot(element);
  function render(nextProps: ImportExportProps = props) {
    props = nextProps;
    flushSync(() => {
      root.render(<ImportExport {...props} />);
    });
  }
  render(props);
  return {
    render,
    unmount: () => root.unmount()
  };
}

const globalWindow = window as any;
globalWindow.OmegaReactImportExport = {
  mount
};

const rootElement = document.getElementById('react-root');

if (rootElement) {
  mount(rootElement);
}
