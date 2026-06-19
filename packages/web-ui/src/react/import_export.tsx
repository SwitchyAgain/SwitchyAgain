import React, {useEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {reloadLocation} from './browser_env';
import {message} from './i18n_client';
import {downloadBlob, shouldAutoMount} from './navigation_client';
import {loadOptions, patchOptions, resetOptions, resetOptionsSync, setOptionsSync} from './options_api_client';
import type {Options} from './options_client_types';
import {getLocalState, setLocalState} from './state_client';
import {
  RESTORE_URL_STATE,
  backupOptionsText,
  importExportBusy,
  importExportErrorMessage,
  legacyRuleListPatch,
  syncBusy
} from './import_export_logic';
import type {ImportExportStatus, SyncStatus} from './import_export_logic';
import {richMessage} from './rich_message';

export type ImportExportProps = {
  embedded?: boolean;
  onApplyOptions?: () => Promise<unknown> | unknown;
  onImportSuccess?: () => Promise<unknown> | unknown;
  onOptionsReplace?: (nextOptions: Options, options?: {dirty?: boolean}) => void;
  options?: Options | null;
  optionsDirty?: boolean;
};

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

export function ImportExport({
  embedded = false,
  onApplyOptions,
  onImportSuccess,
  onOptionsReplace,
  options: initialOptions,
  optionsDirty = false
}: ImportExportProps) {
  const [options, setOptions] = useState<Options | null>(() => (embedded && initialOptions ? initialOptions : null));
  const [restoreUrl, setRestoreUrl] = useState(storedRestoreUrl);
  const [status, setStatus] = useState<ImportExportStatus>(() => (embedded && initialOptions ? 'ready' : 'loading'));
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('ready');
  const [syncOptions, setSyncOptions] = useState<'pristine' | 'disabled' | 'sync' | 'conflict' | 'unsupported' | string | undefined>(() =>
    getLocalState('syncOptions')
  );
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

    loadOptions()
      .then((loadedOptions) => {
        setOptions(loadedOptions);
        setStatus('ready');
      })
      .catch((err) => {
        setError(importExportErrorMessage(err));
        setStatus('error');
      });
  }, [embedded, initialOptions]);

  function showSuccess() {
    setError('');
    setStatus('success');
  }

  function showImportSuccess() {
    if (onImportSuccess) {
      setError('');
      setStatus('ready');
      Promise.resolve(onImportSuccess()).catch(() => {});
      return;
    }
    showSuccess();
  }

  function showError(err: unknown, fallbackKey: string, fallback: string) {
    const messageText = importExportErrorMessage(err) || message(fallbackKey, fallback);
    setError(messageText);
    setStatus('error');
  }

  function exportOptions() {
    if (!options) {
      return;
    }
    setStatus('exporting');
    confirmCurrentOptions()
      .then(() => {
        const blob = new Blob([backupOptionsText(options)], {
          type: 'text/plain;charset=utf-8'
        });
        downloadBlob(blob, 'OmegaOptions.bak');
      })
      .catch(() => {})
      .finally(() => {
        setStatus('ready');
      });
  }

  function restoreFromContent(content: string, restoringStatus: 'restoringLocal' | 'restoringOnline') {
    setStatus(restoringStatus);
    resetOptions(content)
      .then((loadedOptions) => {
        setOptions(loadedOptions);
        return Promise.resolve(onOptionsReplace?.(loadedOptions, {dirty: false}));
      })
      .then(() => {
        showImportSuccess();
      })
      .catch((err) => {
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
    readTextFile(file)
      .then((content) => {
        restoreFromContent(content, 'restoringLocal');
      })
      .catch((err) => {
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
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`${response.status} ${response.statusText}`);
        }
        return response.text();
      })
      .then((content) => {
        restoreFromContent(content, 'restoringOnline');
      })
      .catch((err) => {
        showError(err, 'options_importDownloadError', 'Error downloading backup file!');
      })
      .finally(() => {
        window.clearTimeout(timeout);
      });
  }

  const busy = importExportBusy(status);
  const syncActionBusy = syncBusy(syncStatus);

  function runSyncAction(nextStatus: typeof syncStatus, action?: () => Promise<unknown> | unknown) {
    if (!action) {
      return;
    }
    setSyncStatus(nextStatus);
    Promise.resolve(action())
      .then(() => {
        setSyncStatus('ready');
      })
      .catch(() => {
        setSyncStatus('ready');
      });
  }

  function reloadOptionsPage() {
    reloadLocation();
  }

  function confirmCurrentOptions() {
    if (!optionsDirty) {
      return Promise.resolve(true);
    }
    const confirmed = window.confirm(
      [
        message('options_applyOptionsRequired', 'Your changes to the options must be applied before you proceed.'),
        message('options_applyOptionsConfirm', 'Do you want to save and apply the options?')
      ].join('\n\n')
    );
    if (!confirmed) {
      return Promise.reject(new Error('cancelled'));
    }
    return Promise.resolve(onApplyOptions?.());
  }

  function enableOptionsSync(args?: {force?: boolean}) {
    const enable = () => setOptionsSync(true, args).finally(reloadOptionsPage);
    return args?.force ? enable() : confirmCurrentOptions().then(enable);
  }

  function disableOptionsSync() {
    return confirmCurrentOptions().then(() => setOptionsSync(false).then(reloadOptionsPage));
  }

  function resetSyncedOptions() {
    return confirmCurrentOptions().then(() => resetOptionsSync().then(reloadOptionsPage));
  }

  function saveExportLegacyRuleList(checked: boolean) {
    confirmCurrentOptions()
      .then(() => {
        const currentOptions = options || {};
        const {nextOptions, patch} = legacyRuleListPatch(currentOptions, checked);
        setOptions(nextOptions);
        return patchOptions(patch)
          .then((loadedOptions) => {
            setOptions(loadedOptions);
            onOptionsReplace?.(loadedOptions, {dirty: false});
          })
          .catch((err) => {
            setOptions(currentOptions);
            showError(err, 'options_saveError', 'Unable to save options.');
          });
      })
      .catch(() => {});
  }

  const profileSection = (
    <section className="settings-group">
      <h3>{message('options_group_importExportProfile', 'Profile')}</h3>
      <div className="help-block">
        <div className="text-info">
          <span className="glyphicon glyphicon-info-sign" />{' '}
          {message('options_exportProfileHelp', 'To export a profile, use the top-right action bar on the profile page.')}
        </div>
      </div>
      {!(Number(options?.['-showConditionTypes'] || 0) > 0) && (
        <div className="checkbox">
          <label>
            <input
              type="checkbox"
              checked={Boolean(options?.['-exportLegacyRuleList'])}
              onChange={(event) => saveExportLegacyRuleList(event.currentTarget.checked)}
            />{' '}
            <span>{message('options_exportLegacyRuleList', 'Export legacy rule lists')}</span>
          </label>
          <p className="help-block">
            {richMessage(
              'options_exportLegacyRuleListHelp',
              'Enable this option only if you publish rule lists for users of those projects.'
            )}
          </p>
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
        <span className="help-inline">
          {message('options_makeBackupHelp', 'Make a full backup of your options (including profiles and all other options).')}
        </span>
      </p>

      <p className="react-action-row">
        <input ref={fileInputRef} id="react-restore-local-file" type="file" style={{display: 'none'}} onChange={restoreLocal} />
        <button type="button" className="btn btn-default" disabled={busy} onClick={() => fileInputRef.current?.click()}>
          <span className="glyphicon glyphicon-folder-open" />{' '}
          {status === 'restoringLocal'
            ? message('options_restoreOnlineSubmit', 'Restore') + '...'
            : message('options_restoreLocal', 'Restore from file')}
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
              {status === 'restoringOnline'
                ? message('options_restoreOnlineSubmit', 'Restore') + '...'
                : message('options_restoreOnlineSubmit', 'Restore')}
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
          <p className="help-block">{richMessage('options_syncPristineHelp', 'Sync your options using browser storage.')}</p>
          <p>
            <button
              type="button"
              className="btn btn-default"
              disabled={syncActionBusy}
              onClick={() => runSyncAction('enabling', enableOptionsSync)}
            >
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
          <p className="help-block">{richMessage('options_syncSyncHelp', 'Your options are synchronized.')}</p>
          <p>
            <button
              type="button"
              className="btn btn-warning"
              disabled={syncActionBusy}
              onClick={() => runSyncAction('disabling', disableOptionsSync)}
            >
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
          <p className="help-block">{richMessage('options_syncConflictHelp', 'Choose which options should be used for syncing.')}</p>
          <p>
            <button
              type="button"
              className="btn btn-danger"
              disabled={syncActionBusy}
              onClick={() => runSyncAction('enabling', () => enableOptionsSync({force: true}))}
            >
              <span className="glyphicon glyphicon-cloud-download" /> {message('options_syncEnableForce', 'Use synced options')}
            </button>{' '}
            <button
              type="button"
              className="btn btn-link"
              disabled={syncActionBusy}
              onClick={() => runSyncAction('resetting', resetSyncedOptions)}
            >
              <span className="glyphicon glyphicon-erase" /> {message('options_syncReset', 'Reset sync')}
            </button>
          </p>
        </>
      )}
      {syncOptions === 'unsupported' && (
        <p className="help-block">{richMessage('options_syncUnsupportedHelp', 'Options sync is not supported in this browser.')}</p>
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
      </div>

      {profileSection}
      {settingsSection}
      {syncSection}
    </main>
  );
}

export function mount(element: Element, props: ImportExportProps = {}) {
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

const rootElement = document.getElementById('react-root');

if (rootElement && shouldAutoMount('import_export.js')) {
  mount(rootElement);
}
