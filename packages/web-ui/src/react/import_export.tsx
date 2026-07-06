import React, {useEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {clearWindowTimeout, confirmDialog, reloadLocation, setWindowTimeout} from './browser_env';
import {message} from './i18n_client';
import {downloadBlob, shouldAutoMount} from './navigation_client';
import {
  getWebDavSyncConfig,
  loadOptions,
  patchOptions,
  resetOptions,
  resetOptionsSync,
  setOptionsSync,
  setWebDavOptionsSync,
  testWebDavSync
} from './options_api_client';
import type {Options, WebDavSyncConfig} from './options_client_types';
import {getLocalState, getState, setLocalState} from './state_client';
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
  const [syncProvider, setSyncProvider] = useState<string>(() => getLocalState('syncProvider') || '');
  const [syncOptions, setSyncOptions] = useState<'pristine' | 'disabled' | 'sync' | 'conflict' | 'unsupported' | string | undefined>(() =>
    getLocalState('syncOptions')
  );
  const [webDavConfig, setWebDavConfig] = useState<WebDavSyncConfig>({
    intervalMinutes: 5,
    remotePath: 'SwitchyAgain/options-sync.json',
    serverUrl: ''
  });
  const [webDavStatus, setWebDavStatus] = useState<
    'ready' | 'testing' | 'saving' | 'enabling' | 'downloading' | 'disabling' | 'success' | 'error'
  >('ready');
  const [webDavMessage, setWebDavMessage] = useState('');
  const [webDavRemoteExists, setWebDavRemoteExists] = useState<boolean | null>(null);
  const [webDavSetupOpen, setWebDavSetupOpen] = useState(false);
  const [syncProviderChoice, setSyncProviderChoice] = useState<'' | 'browser' | 'webdav'>(() => {
    const initialSyncOptions = getLocalState('syncOptions');
    const initialSyncProvider = getLocalState('syncProvider') || '';
    if (initialSyncOptions === 'sync') {
      return initialSyncProvider === 'webdav' ? 'webdav' : 'browser';
    }
    if (initialSyncOptions === 'conflict' && initialSyncProvider !== 'webdav') {
      return 'browser';
    }
    return '';
  });
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSyncOptions(getLocalState('syncOptions'));
    setSyncProvider(getLocalState('syncProvider') || '');
    getState<string>('syncOptions')
      .then((options) => {
        setSyncOptions(options || getLocalState('syncOptions'));
      })
      .catch(() => {});
    getState<string>('syncProvider')
      .then((provider) => {
        setSyncProvider(provider || '');
      })
      .catch(() => {});
    getWebDavSyncConfig()
      .then((config) => {
        if (config) {
          setWebDavConfig({
            intervalMinutes: config.intervalMinutes ?? 5,
            remotePath: config.remotePath || 'SwitchyAgain/options-sync.json',
            serverUrl: config.serverUrl || '',
            username: config.username || '',
            hasPassword: config.hasPassword
          });
        }
      })
      .catch(() => {});
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
      .then((currentOptions) => {
        const exportOptions = currentOptions || options;
        const blob = new Blob([backupOptionsText(exportOptions)], {
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
    const timeout = setWindowTimeout(() => controller.abort(), 10000);
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
        clearWindowTimeout(timeout);
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
      return Promise.resolve(options);
    }
    const confirmed = confirmDialog(
      [
        message('options_applyOptionsRequired', 'Your changes to the options must be applied before you proceed.'),
        message('options_applyOptionsConfirm', 'Do you want to save and apply the options?')
      ].join('\n\n')
    );
    if (!confirmed) {
      return Promise.reject(new Error('cancelled'));
    }
    return Promise.resolve(onApplyOptions?.()).then((appliedOptions) =>
      appliedOptions && typeof appliedOptions === 'object' ? (appliedOptions as Options) : options
    );
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

  const browserSyncActive = syncOptions === 'sync' && syncProvider !== 'webdav';
  const webDavSyncActive = syncOptions === 'sync' && syncProvider === 'webdav';
  const browserSyncBlocked = webDavSyncActive;
  const webDavSyncBlocked = browserSyncActive;
  const browserSyncSelected =
    browserSyncActive ||
    (syncOptions === 'conflict' && syncProvider !== 'webdav') ||
    (!browserSyncBlocked && syncProviderChoice === 'browser');
  const webDavSyncSelected = webDavSyncActive || (!webDavSyncBlocked && syncProviderChoice === 'webdav');
  const showWebDavSetup = webDavSyncActive || (webDavSetupOpen && webDavSyncSelected && !webDavSyncBlocked);
  const webDavActionBusy =
    webDavStatus === 'testing' ||
    webDavStatus === 'saving' ||
    webDavStatus === 'enabling' ||
    webDavStatus === 'downloading' ||
    webDavStatus === 'disabling';
  const webDavConfigured = Boolean(webDavConfig.serverUrl?.trim());
  const webDavConnectionTested = webDavRemoteExists !== null;

  useEffect(() => {
    if (browserSyncActive || (syncOptions === 'conflict' && syncProvider !== 'webdav')) {
      setSyncProviderChoice('browser');
      setWebDavSetupOpen(false);
    } else if (webDavSyncActive) {
      setSyncProviderChoice('webdav');
    }
  }, [browserSyncActive, syncOptions, syncProvider, webDavSyncActive]);

  function chooseSyncProvider(provider: 'browser' | 'webdav') {
    setSyncProviderChoice(provider);
    if (provider !== 'webdav') {
      setWebDavSetupOpen(false);
    }
  }

  function updateWebDavConfig(patch: Partial<WebDavSyncConfig>) {
    setWebDavConfig((current) => ({
      ...current,
      ...patch
    }));
    setWebDavRemoteExists(null);
    setWebDavMessage('');
    setWebDavStatus('ready');
  }

  function testWebDavConnection() {
    setWebDavStatus('testing');
    setWebDavMessage('');
    testWebDavSync(webDavConfig)
      .then((result) => {
        setWebDavRemoteExists(result.exists);
        setWebDavStatus('success');
        setWebDavMessage(
          result.exists
            ? message('options_webDavSyncTestExists', 'Connection successful. A remote sync file was found.')
            : message('options_webDavSyncTestMissing', 'Connection successful. No remote sync file was found yet.')
        );
      })
      .catch((err) => {
        setWebDavRemoteExists(null);
        setWebDavStatus('error');
        setWebDavMessage(importExportErrorMessage(err));
      });
  }

  function enableWebDavSync(mode: 'upload' | 'download') {
    const nextStatus = mode === 'download' ? 'downloading' : 'enabling';
    setWebDavStatus(nextStatus);
    confirmCurrentOptions()
      .then(() =>
        setWebDavOptionsSync(true, {
          config: webDavConfig,
          mode
        })
      )
      .then(() => {
        reloadOptionsPage();
      })
      .catch((err) => {
        setWebDavStatus('error');
        setWebDavMessage(importExportErrorMessage(err));
      });
  }

  function disableWebDavSync() {
    setWebDavStatus('disabling');
    confirmCurrentOptions()
      .then(() => setWebDavOptionsSync(false))
      .then(() => {
        reloadOptionsPage();
      })
      .catch((err) => {
        setWebDavStatus('error');
        setWebDavMessage(importExportErrorMessage(err));
      });
  }

  function saveExportLegacyRuleList(checked: boolean) {
    confirmCurrentOptions()
      .then((appliedOptions) => {
        const currentOptions = appliedOptions || options || {};
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
      <h3>{message('options_group_sync', 'Sync')}</h3>
      <div className="help-block">
        <div className="text-info">
          <span className="glyphicon glyphicon-info-sign" />{' '}
          {message('options_syncProviderHelp', 'Choose Browser Sync or WebDAV Sync. Only one sync method can be enabled at a time.')}
        </div>
      </div>

      <div className={`sync-provider${browserSyncSelected ? ' sync-provider-selected' : ''}`}>
        <div className="sync-provider-heading">
          <label className="sync-provider-title">
            <input
              type="radio"
              name="react-sync-provider"
              checked={browserSyncSelected}
              disabled={browserSyncBlocked || syncOptions === 'unsupported'}
              onChange={() => chooseSyncProvider('browser')}
            />{' '}
            <span>{message('options_group_browserSync', 'Browser Sync')}</span>
          </label>
        </div>
        <div className="sync-provider-body">
          {(syncOptions === 'pristine' || syncOptions === 'disabled' || (syncOptions === 'sync' && syncProvider === 'webdav')) && (
            <>
              <p className="help-block">
                {richMessage(
                  'options_syncPristineHelp',
                  'You can automatically synchronize your settings and profiles across supported desktop browsers signed in to the same browser account.'
                )}
              </p>
              {browserSyncBlocked && (
                <p className="alert alert-info width-limit">
                  <span className="glyphicon glyphicon-info-sign" />{' '}
                  {message(
                    'options_browserSyncBlockedByWebDav',
                    'WebDAV sync is enabled. Disable WebDAV sync before enabling Browser Sync.'
                  )}
                </p>
              )}
              <p>
                <button
                  type="button"
                  className="btn btn-default"
                  disabled={syncActionBusy || browserSyncBlocked || !browserSyncSelected}
                  onClick={() => runSyncAction('enabling', enableOptionsSync)}
                >
                  <span className="glyphicon glyphicon-cloud-upload" /> {message('options_browserSyncEnable', 'Enable Browser Sync')}
                </button>
              </p>
            </>
          )}
          {browserSyncActive && (
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
                  <span className="glyphicon glyphicon-remove-sign" /> {message('options_syncDisable', 'Disable Browser Sync')}
                </button>
              </p>
            </>
          )}
          {syncOptions === 'conflict' && syncProvider !== 'webdav' && (
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
        </div>
      </div>

      <div className={`sync-provider${webDavSyncSelected ? ' sync-provider-selected' : ''}`}>
        <div className="sync-provider-heading">
          <label className="sync-provider-title">
            <input
              type="radio"
              name="react-sync-provider"
              checked={webDavSyncSelected}
              disabled={webDavSyncBlocked}
              onChange={() => chooseSyncProvider('webdav')}
            />{' '}
            <span>{message('options_group_webDavSync', 'WebDAV Sync')}</span>
          </label>
        </div>
        <div className="sync-provider-body">
          <p className="help-block">
            {richMessage(
              'options_webDavSyncHelp',
              'Synchronize settings and profiles through a WebDAV server you control. Use an app password or token when your provider supports one.'
            )}
          </p>
          {webDavSyncBlocked && (
            <p className="alert alert-info width-limit">
              <span className="glyphicon glyphicon-info-sign" />{' '}
              {message('options_webDavSyncBlockedByBrowser', 'Browser Sync is enabled. Disable Browser Sync before enabling WebDAV sync.')}
            </p>
          )}
          {!showWebDavSetup && (
            <p>
              <button
                type="button"
                className="btn btn-default"
                disabled={webDavActionBusy || webDavSyncBlocked || !webDavSyncSelected}
                onClick={() => setWebDavSetupOpen(true)}
              >
                <span className="glyphicon glyphicon-cloud-upload" /> {message('options_webDavSyncEnable', 'Enable WebDAV Sync')}
              </button>
            </p>
          )}
          {showWebDavSetup && (
            <>
              {webDavSyncActive && (
                <p className="alert alert-success width-limit">
                  <span className="glyphicon glyphicon-ok" /> {message('options_webDavSyncEnabled', 'WebDAV sync is enabled.')}
                </p>
              )}
              {webDavStatus === 'error' && webDavMessage && (
                <p className="alert alert-danger width-limit">
                  <span className="glyphicon glyphicon-remove" /> {webDavMessage}
                </p>
              )}
              {webDavStatus === 'success' && webDavMessage && (
                <p className="alert alert-success width-limit">
                  <span className="glyphicon glyphicon-ok" /> {webDavMessage}
                </p>
              )}
              <div className="sync-provider-form">
                <div className="form-group">
                  <label htmlFor="react-webdav-server-url">{message('options_webDavServerUrl', 'Server URL')}</label>
                  <input
                    id="react-webdav-server-url"
                    className="form-control width-limit"
                    type="url"
                    value={webDavConfig.serverUrl || ''}
                    placeholder={message('options_webDavServerUrlPlaceholder', 'https://example.com/remote.php/dav/files/user/')}
                    disabled={webDavSyncBlocked}
                    onChange={(event) => updateWebDavConfig({serverUrl: event.currentTarget.value})}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="react-webdav-remote-path">{message('options_webDavRemotePath', 'Remote path')}</label>
                  <input
                    id="react-webdav-remote-path"
                    className="form-control width-limit"
                    type="text"
                    value={webDavConfig.remotePath || ''}
                    placeholder="SwitchyAgain/options-sync.json"
                    disabled={webDavSyncBlocked}
                    onChange={(event) => updateWebDavConfig({remotePath: event.currentTarget.value})}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="react-webdav-username">{message('options_webDavUsername', 'Username')}</label>
                  <input
                    id="react-webdav-username"
                    className="form-control width-limit"
                    type="text"
                    value={webDavConfig.username || ''}
                    disabled={webDavSyncBlocked}
                    onChange={(event) => updateWebDavConfig({username: event.currentTarget.value})}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="react-webdav-password">{message('options_webDavPassword', 'Password or app token')}</label>
                  <input
                    id="react-webdav-password"
                    className="form-control width-limit"
                    type="password"
                    value={webDavConfig.password || ''}
                    placeholder={webDavConfig.hasPassword ? message('options_webDavPasswordSaved', 'Saved password will be reused') : ''}
                    disabled={webDavSyncBlocked}
                    onChange={(event) => updateWebDavConfig({password: event.currentTarget.value})}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="react-webdav-interval">{message('options_webDavInterval', 'Sync interval')}</label>
                  <select
                    id="react-webdav-interval"
                    className="form-control width-limit"
                    value={String(webDavConfig.intervalMinutes ?? 5)}
                    disabled={webDavSyncBlocked}
                    onChange={(event) => updateWebDavConfig({intervalMinutes: Number(event.currentTarget.value)})}
                  >
                    <option value="1">{message('options_webDavInterval1', '1 minute')}</option>
                    <option value="5">{message('options_webDavInterval5', '5 minutes')}</option>
                    <option value="15">{message('options_webDavInterval15', '15 minutes')}</option>
                    <option value="30">{message('options_webDavInterval30', '30 minutes')}</option>
                    <option value="60">{message('options_webDavInterval60', '60 minutes')}</option>
                    <option value="0">{message('options_webDavIntervalManual', 'Manual only')}</option>
                  </select>
                </div>
                <p>
                  <button
                    type="button"
                    className="btn btn-default"
                    disabled={!webDavConfigured || webDavActionBusy || webDavSyncBlocked}
                    onClick={testWebDavConnection}
                  >
                    <span className="glyphicon glyphicon-transfer" /> {message('options_webDavTest', 'Test')}
                  </button>{' '}
                  {!webDavSyncActive && (
                    <>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={!webDavConfigured || !webDavConnectionTested || webDavActionBusy || webDavSyncBlocked}
                        onClick={() => enableWebDavSync('upload')}
                      >
                        <span className="glyphicon glyphicon-cloud-upload" /> {message('options_webDavUploadEnable', 'Upload')}
                      </button>{' '}
                      <button
                        type="button"
                        className="btn btn-danger"
                        disabled={!webDavConfigured || webDavActionBusy || webDavRemoteExists !== true || webDavSyncBlocked}
                        onClick={() => enableWebDavSync('download')}
                      >
                        <span className="glyphicon glyphicon-cloud-download" /> {message('options_webDavDownloadEnable', 'Download')}
                      </button>{' '}
                    </>
                  )}
                  {webDavSyncActive && (
                    <button type="button" className="btn btn-warning" disabled={webDavActionBusy} onClick={disableWebDavSync}>
                      <span className="glyphicon glyphicon-remove-sign" /> {message('options_webDavDisable', 'Disable WebDAV Sync')}
                    </button>
                  )}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
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
