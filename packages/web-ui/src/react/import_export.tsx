import React, {useEffect, useRef, useState} from 'react';
import {
  clearWindowTimeout,
  confirmDialog,
  extensionBrowserMajorVersion,
  extensionBrowserName,
  extensionManifestVersion,
  reloadLocation,
  setWindowTimeout
} from './browser_env';
import {message} from './i18n_client';
import {downloadBlob} from './navigation_client';
import {
  getWebDavSyncConfig,
  loadOptions,
  resetOptions,
  resetOptionsSync,
  runWebDavSyncAction,
  patchOptions,
  setOptionsSync,
  setWebDavOptionsSync,
  setWebDavSyncConfig,
  testWebDavSync
} from './options_api_client';
import type {Options, WebDavSyncConfig, WebDavSyncManualAction, WebDavSyncStatus} from './options_client_types';
import {getLocalState, getState, setLocalState} from './state_client';
import {
  RESTORE_URL_STATE,
  backupFilename,
  backupFilenameOptions,
  backupFilenameValidation,
  backupOptionsText,
  importExportBusy,
  importExportErrorMessage,
  syncBusy
} from './import_export_logic';
import type {
  BackupFilenameOptions,
  BackupFilenameScheme,
  BackupFilenameValidation,
  ImportExportStatus,
  SyncStatus
} from './import_export_logic';
import {optionPatch} from './option_patch';
import {formatMediumDate} from './profile_content_logic';
import {richMessage} from './rich_message';

export type ImportExportProps = {
  embedded?: boolean;
  onApplyOptions?: () => Promise<unknown> | unknown;
  onImportSuccess?: () => Promise<unknown> | unknown;
  onOptionsChange?: (nextOptions: Options) => void;
  onOptionsReplace?: (nextOptions: Options, options?: {dirty?: boolean}) => void;
  options?: Options | null;
  optionsDirty?: boolean;
};

function backupFilenameValidationMessage(error: NonNullable<BackupFilenameValidation['error']>) {
  switch (error.code) {
    case 'invalidCharacters':
      return message('options_backupFilenameInvalidCharacters', 'The filename contains invalid characters: $1', error.characters || '');
    case 'jsonExtension':
      return message('options_backupFilenameJsonExtension', 'Do not include the .json extension.');
    case 'required':
      return message('options_backupFilenameRequired', 'A filename is required.');
    case 'tooLong':
      return message('options_backupFilenameTooLong', 'The filename is too long: $1/$2 bytes.', [
        String(error.byteLength || 0),
        String(error.maxByteLength || 0)
      ]);
    default:
      return message('options_backupFilenameTrailingCharacter', 'The filename cannot end with a space or period.');
  }
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

type WebDavConfirmModalProps = {
  action: WebDavSyncManualAction;
  onConfirm: (action: WebDavSyncManualAction) => void;
  onDismiss: () => void;
};

function webDavConfirmModalSpec(action: WebDavSyncManualAction) {
  switch (action) {
    case 'uploadNow':
      return {
        body: message('options_webDavUploadNowConfirm', 'Upload local options to WebDAV now? This will overwrite the remote sync config.'),
        buttonClassName: 'btn-primary',
        confirmLabel: message('options_webDavUploadNow', 'Upload Now'),
        title: message('options_webDavUploadNowTitle', 'Upload Now')
      };
    case 'downloadNow':
      return {
        body: message('options_webDavDownloadNowConfirm', 'Download remote WebDAV options now? This will overwrite your local options.'),
        buttonClassName: 'btn-danger',
        confirmLabel: message('options_webDavDownloadNow', 'Download Now'),
        title: message('options_webDavDownloadNowTitle', 'Download Now')
      };
    default:
      return {
        body: '',
        buttonClassName: 'btn-primary',
        confirmLabel: '',
        title: ''
      };
  }
}

function comparableWebDavConfig(config: WebDavSyncConfig | null | undefined) {
  return {
    hasPassword: Boolean(config?.hasPassword || config?.password),
    intervalMinutes: Number(config?.intervalMinutes ?? 5),
    password: String(config?.password || ''),
    remotePath: String(config?.remotePath || 'SwitchyAgain/options-sync.json'),
    serverUrl: String(config?.serverUrl || ''),
    username: String(config?.username || '')
  };
}

function comparableWebDavConnectionConfig(config: WebDavSyncConfig | null | undefined) {
  const comparable = comparableWebDavConfig(config);
  return {
    hasPassword: comparable.hasPassword,
    password: comparable.password,
    remotePath: comparable.remotePath,
    serverUrl: comparable.serverUrl,
    username: comparable.username
  };
}

function sameWebDavConnectionConfig(left: WebDavSyncConfig | null | undefined, right: WebDavSyncConfig | null | undefined) {
  return JSON.stringify(comparableWebDavConnectionConfig(left)) === JSON.stringify(comparableWebDavConnectionConfig(right));
}

function comparableWebDavTargetConfig(config: WebDavSyncConfig | null | undefined) {
  const comparable = comparableWebDavConfig(config);
  return {
    remotePath: comparable.remotePath,
    serverUrl: comparable.serverUrl
  };
}

function sameWebDavTargetConfig(left: WebDavSyncConfig | null | undefined, right: WebDavSyncConfig | null | undefined) {
  return JSON.stringify(comparableWebDavTargetConfig(left)) === JSON.stringify(comparableWebDavTargetConfig(right));
}

function normalizeWebDavPublicConfig(config: WebDavSyncConfig) {
  return {
    intervalMinutes: config.intervalMinutes ?? 5,
    remotePath: config.remotePath || 'SwitchyAgain/options-sync.json',
    serverUrl: config.serverUrl || '',
    username: config.username || '',
    hasPassword: config.hasPassword
  };
}

function WebDavConfirmModal({action, onConfirm, onDismiss}: WebDavConfirmModalProps) {
  const spec = webDavConfirmModalSpec(action);
  return (
    <>
      <div className="modal-backdrop fade in" />
      <div
        className="modal fade in options-modal"
        role="dialog"
        style={{display: 'flex'}}
        tabIndex={-1}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            onDismiss();
          }
        }}
      >
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <button type="button" className="close" onClick={onDismiss}>
                <span aria-hidden="true">{'\u00d7'}</span>
                <span className="sr-only">{message('dialog_close', 'Close')}</span>
              </button>
              <h4 className="modal-title">{spec.title}</h4>
            </div>
            <div className="modal-body">
              <p>{spec.body}</p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-default" onClick={onDismiss}>
                {message('dialog_cancel', 'Cancel')}
              </button>
              <button type="button" className={`btn ${spec.buttonClassName}`} onClick={() => onConfirm(action)}>
                {spec.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function ImportExport({
  embedded = false,
  onApplyOptions,
  onImportSuccess,
  onOptionsChange,
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
  const [savedWebDavConfig, setSavedWebDavConfig] = useState<WebDavSyncConfig | null>(null);
  const [webDavStatus, setWebDavStatus] = useState<
    'ready' | 'testing' | 'saving' | 'enabling' | 'uploading' | 'downloading' | 'disabling' | 'success' | 'error'
  >('ready');
  const [webDavMessage, setWebDavMessage] = useState('');
  const [webDavRemoteExists, setWebDavRemoteExists] = useState<boolean | null>(null);
  const [webDavSetupOpen, setWebDavSetupOpen] = useState(false);
  const [webDavConfirmAction, setWebDavConfirmAction] = useState<WebDavSyncManualAction | null>(null);
  const [webDavSyncStatus, setWebDavSyncStatus] = useState<WebDavSyncStatus | null>(
    () => getLocalState<WebDavSyncStatus>('webDavSyncStatus') || null
  );
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

  const filenameOptions = backupFilenameOptions(options?.['-backupFilename']);
  const filenameContext = {
    browser: extensionBrowserName(),
    browserVersion: extensionBrowserMajorVersion(),
    date: new Date(),
    extensionVersion: extensionManifestVersion()
  };
  const filenamePreview = backupFilename(filenameOptions, filenameContext);
  const filenameValidation = backupFilenameValidation(filenameOptions, filenameContext);

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
    getState<WebDavSyncStatus>('webDavSyncStatus')
      .then((status) => {
        setWebDavSyncStatus(status || null);
      })
      .catch(() => {});
    getWebDavSyncConfig()
      .then((config) => {
        if (config) {
          const nextConfig = normalizeWebDavPublicConfig(config);
          setWebDavConfig(nextConfig);
          setSavedWebDavConfig(nextConfig);
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
    if (!options || filenameValidation?.error) {
      return;
    }
    setStatus('exporting');
    confirmCurrentOptions()
      .then((currentOptions) => {
        const exportOptions = currentOptions || options;
        const blob = new Blob(
          [
            backupOptionsText(exportOptions, {
              browser: extensionBrowserName(),
              exportedAt: new Date().toISOString(),
              extensionVersion: extensionManifestVersion()
            })
          ],
          {
            type: 'text/plain;charset=utf-8'
          }
        );
        downloadBlob(
          blob,
          backupFilename(backupFilenameOptions(exportOptions['-backupFilename']), {
            browser: extensionBrowserName(),
            browserVersion: extensionBrowserMajorVersion(),
            date: new Date(),
            extensionVersion: extensionManifestVersion()
          })
        );
      })
      .catch(() => {})
      .finally(() => {
        setStatus('ready');
      });
  }

  function updateBackupFilename(nextFilenameOptions: BackupFilenameOptions) {
    if (!options) {
      return;
    }
    const nextOptions = {
      ...options,
      '-backupFilename': nextFilenameOptions
    };
    setOptions(nextOptions);
    if (embedded) {
      onOptionsChange?.(nextOptions);
      return;
    }
    patchOptions(optionPatch(options, nextOptions, ['-backupFilename']))
      .then(setOptions)
      .catch(() => {});
  }

  function updateBackupFilenameScheme(scheme: BackupFilenameScheme) {
    updateBackupFilename({...filenameOptions, scheme});
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
    webDavStatus === 'uploading' ||
    webDavStatus === 'downloading' ||
    webDavStatus === 'disabling';
  const webDavConfigured = Boolean(webDavConfig.serverUrl?.trim());
  const webDavConnectionConfigDirty = !sameWebDavConnectionConfig(savedWebDavConfig, webDavConfig);
  const webDavConnectionChangesPending = savedWebDavConfig !== null && webDavConnectionConfigDirty;
  const webDavConnectionTested = webDavRemoteExists !== null && !webDavConnectionConfigDirty;

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

  function updateWebDavConnectionConfig(patch: Partial<WebDavSyncConfig>) {
    setWebDavConfig((current) => ({
      ...current,
      ...patch
    }));
    setWebDavRemoteExists(null);
    setWebDavMessage('');
    setWebDavStatus('ready');
  }

  function applySavedWebDavConfig(config: WebDavSyncConfig) {
    const nextConfig = normalizeWebDavPublicConfig(config);
    setWebDavConfig(nextConfig);
    setSavedWebDavConfig(nextConfig);
    return nextConfig;
  }

  function updateWebDavInterval(intervalMinutes: number) {
    const nextConfig = {
      ...webDavConfig,
      intervalMinutes
    };
    setWebDavConfig(nextConfig);
    setWebDavMessage('');
    if (!webDavSyncActive || !savedWebDavConfig || !sameWebDavConnectionConfig(savedWebDavConfig, nextConfig)) {
      setWebDavStatus('ready');
      return;
    }
    setWebDavStatus('saving');
    setWebDavSyncConfig(nextConfig)
      .then((config) => {
        applySavedWebDavConfig(config);
        setWebDavStatus('success');
        setWebDavMessage(message('options_webDavConfigSaved', 'WebDAV Sync settings saved.'));
      })
      .catch((err) => {
        setWebDavStatus('error');
        setWebDavMessage(importExportErrorMessage(err));
      });
  }

  function webDavTestAndSaveSuccessMessage(remoteExists: boolean, targetChanged: boolean) {
    if (!webDavSyncActive) {
      return remoteExists
        ? message(
            'options_webDavSyncTestEnableExists',
            'Connection successful. A remote sync file was found. Choose Upload & Enable or Download & Enable to enable WebDAV Sync.'
          )
        : message(
            'options_webDavSyncTestEnableMissing',
            'Connection successful. No remote sync file was found. Upload & Enable to enable WebDAV Sync.'
          );
    }
    if (targetChanged) {
      return remoteExists
        ? message(
            'options_webDavSyncTestRebindExists',
            'Connection successful. A remote sync file was found. Choose Upload Now or Download Now to apply WebDAV Sync to this location.'
          )
        : message(
            'options_webDavSyncTestRebindMissing',
            'Connection successful. No remote sync file was found. Upload Now to apply WebDAV Sync to this location.'
          );
    }
    return [
      message('options_webDavSyncTestSuccess', 'Connection successful.'),
      message('options_webDavConfigSaved', 'WebDAV Sync settings saved.')
    ].join(' ');
  }

  function testAndSaveWebDavConnection() {
    const targetChanged = webDavSyncActive && !sameWebDavTargetConfig(savedWebDavConfig, webDavConfig);
    setWebDavStatus('testing');
    setWebDavMessage('');
    testWebDavSync(webDavConfig)
      .then((result) => {
        return setWebDavSyncConfig(webDavConfig).then((config) => ({
          config,
          result
        }));
      })
      .then(({config, result}) => {
        applySavedWebDavConfig(config);
        setWebDavRemoteExists(result.exists);
        return refreshWebDavSyncStatus().then(() => {
          setWebDavStatus('success');
          setWebDavMessage(webDavTestAndSaveSuccessMessage(result.exists, targetChanged));
        });
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

  function handleWebDavActionError(err: unknown) {
    if (err instanceof Error && err.message === 'cancelled') {
      setWebDavStatus('ready');
      return;
    }
    setWebDavStatus('error');
    setWebDavMessage(importExportErrorMessage(err));
  }

  function disableWebDavSync() {
    setWebDavStatus('disabling');
    confirmCurrentOptions()
      .then(() => setWebDavOptionsSync(false))
      .then(() => {
        reloadOptionsPage();
      })
      .catch(handleWebDavActionError);
  }

  function refreshWebDavSyncStatus() {
    return getState<WebDavSyncStatus>('webDavSyncStatus')
      .then((statusData) => {
        setWebDavSyncStatus(statusData || getLocalState<WebDavSyncStatus>('webDavSyncStatus') || null);
      })
      .catch(() => {});
  }

  function uploadWebDavNow() {
    setWebDavStatus('uploading');
    setWebDavMessage('');
    confirmCurrentOptions()
      .then(() => runWebDavSyncAction('uploadNow'))
      .then(() => refreshWebDavSyncStatus())
      .then(() => {
        setWebDavStatus('success');
        setWebDavMessage(message('options_webDavUploadNowSuccess', 'Upload complete.'));
      })
      .catch(handleWebDavActionError);
  }

  function downloadWebDavNow() {
    setWebDavStatus('downloading');
    setWebDavMessage('');
    runWebDavSyncAction('downloadNow')
      .then(() => {
        reloadOptionsPage();
      })
      .catch(handleWebDavActionError);
  }

  function runConfirmedWebDavAction(action: WebDavSyncManualAction) {
    setWebDavConfirmAction(null);
    switch (action) {
      case 'uploadNow':
        uploadWebDavNow();
        break;
      case 'downloadNow':
        downloadWebDavNow();
        break;
    }
  }

  function webDavSyncStatusTime(statusData: WebDavSyncStatus) {
    return formatMediumDate(statusData.lastSuccessAt || statusData.lastErrorAt || statusData.lastAttemptAt);
  }

  function webDavPendingUploadText(statusData: WebDavSyncStatus) {
    return statusData.pendingUpload ? ` ${message('options_webDavSyncPendingUpload', 'Local changes are waiting to sync.')}` : '';
  }

  function webDavSyncStatusBanner(statusData: WebDavSyncStatus | null) {
    if (!statusData) {
      return (
        <p className="alert alert-success width-limit">
          <span className="glyphicon glyphicon-ok" /> {message('options_webDavSyncEnabled', 'WebDAV Sync is enabled.')}
        </p>
      );
    }
    const formattedTime = webDavSyncStatusTime(statusData);
    if (statusData.needsDirection) {
      return (
        <p className="alert alert-info width-limit">
          <span className="glyphicon glyphicon-info-sign" />{' '}
          {message(
            'options_webDavSyncNeedsDirection',
            'WebDAV Sync is waiting. Choose Upload Now or Download Now to apply the saved WebDAV location.'
          )}
          {webDavPendingUploadText(statusData)}
        </p>
      );
    }
    if (statusData.state === 'success') {
      return (
        <p className="alert alert-success width-limit">
          <span className="glyphicon glyphicon-ok" />{' '}
          {formattedTime
            ? `${message('options_webDavSyncStatusSuccess', 'WebDAV Sync is enabled. Last synced:')} ${formattedTime}`
            : message('options_webDavSyncEnabled', 'WebDAV Sync is enabled.')}
          {webDavPendingUploadText(statusData)}
        </p>
      );
    }
    if (statusData.state === 'retrying') {
      return (
        <p className="alert alert-info width-limit">
          <span className="glyphicon glyphicon-info-sign" />{' '}
          {formattedTime
            ? `${message('options_webDavSyncStatusRetrying', 'WebDAV sync is retrying. Last attempt:')} ${formattedTime}`
            : message('options_webDavSyncStatusRetryingNoTime', 'WebDAV sync is retrying.')}
          {webDavPendingUploadText(statusData)}
        </p>
      );
    }
    const nextRetryTime = statusData.nextRetryAt ? formatMediumDate(statusData.nextRetryAt) : '';
    return (
      <p className="alert alert-danger width-limit">
        <span className="glyphicon glyphicon-remove" />{' '}
        {formattedTime
          ? `${message('options_webDavSyncStatusFailed', 'WebDAV sync failed. Last failed:')} ${formattedTime}`
          : message('options_webDavSyncStatusFailedNoTime', 'WebDAV sync failed.')}
        {statusData.message ? ` ${statusData.message}` : ''}
        {nextRetryTime ? ` ${message('options_webDavSyncNextRetry', 'Next automatic retry:')} ${nextRetryTime}` : ''}
        {webDavPendingUploadText(statusData)}
      </p>
    );
  }

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

      <h3>{message('options_group_importExportBackup', 'Backup')}</h3>
      <div className="form-group">
        <label>{message('options_localBackupRestore', 'Local backup and restore')}</label>
        <div className="backup-filename-settings">
          <div className="checkbox">
            <label>
              <input
                type="checkbox"
                checked={filenameOptions.enabled}
                disabled={!options || busy}
                onChange={(event) => updateBackupFilename({...filenameOptions, enabled: event.currentTarget.checked})}
              />{' '}
              {message('options_backupFilenameCustom', 'Use a custom backup filename')}
            </label>
          </div>
          {filenameOptions.enabled && (
            <div className="backup-filename-options">
              <div className="radio">
                <label>
                  <input
                    type="radio"
                    name="backup-filename-scheme"
                    checked={filenameOptions.scheme === 'date'}
                    onChange={() => updateBackupFilenameScheme('date')}
                  />{' '}
                  {message('options_backupFilenameDate', 'Date')}
                </label>
              </div>
              <div className="radio">
                <label>
                  <input
                    type="radio"
                    name="backup-filename-scheme"
                    checked={filenameOptions.scheme === 'dateTime'}
                    onChange={() => updateBackupFilenameScheme('dateTime')}
                  />{' '}
                  {message('options_backupFilenameDateTime', 'Date and time')}
                </label>
              </div>
              <div className="radio">
                <label>
                  <input
                    type="radio"
                    name="backup-filename-scheme"
                    checked={filenameOptions.scheme === 'dateVersion'}
                    onChange={() => updateBackupFilenameScheme('dateVersion')}
                  />{' '}
                  {message('options_backupFilenameDateVersion', 'Date and version')}
                </label>
              </div>
              <div className="radio">
                <label>
                  <input
                    type="radio"
                    name="backup-filename-scheme"
                    checked={filenameOptions.scheme === 'custom'}
                    onChange={() => updateBackupFilenameScheme('custom')}
                  />{' '}
                  {message('options_backupFilenameTemplate', 'Custom template')}
                </label>
              </div>
              {filenameOptions.scheme === 'custom' && (
                <div className="backup-filename-template">
                  <div className={filenameValidation?.error ? 'has-error' : ''}>
                    <label htmlFor="backup-filename-template">{message('options_backupFilenameTemplateLabel', 'Template')}</label>
                    <input
                      id="backup-filename-template"
                      type="text"
                      className="form-control width-limit"
                      value={filenameOptions.template}
                      disabled={busy}
                      onChange={(event) => updateBackupFilename({...filenameOptions, template: event.currentTarget.value})}
                    />
                    {filenameValidation?.error && <p className="help-block">{backupFilenameValidationMessage(filenameValidation.error)}</p>}
                  </div>
                  <p className="help-block">
                    {message(
                      'options_backupFilenameFields',
                      'Available fields: {date}, {time}, {year}, {month}, {monthName}, {monthShort}, {day}, {hour24}, {hour12}, {minute}, {second}, {ampm}, {version}, {browser}, {browserVersion}. The .json extension is added automatically.'
                    )}
                  </p>
                  <p className="help-block">
                    {message('options_backupFilenameEscaping', 'Use \\{ and \\} to include literal braces in the filename.')}
                  </p>
                </div>
              )}
              {!filenameValidation?.error && (
                <p className="help-block backup-filename-preview">
                  <strong>{message('options_backupFilenamePreview', 'Preview:')}</strong> <code>{filenamePreview}</code>
                </p>
              )}
            </div>
          )}
        </div>
        <p className="react-action-row">
          <button
            type="button"
            className="btn btn-default"
            disabled={!options || busy || Boolean(filenameValidation?.error)}
            onClick={exportOptions}
          >
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
      </div>

      <div className="form-group">
        <label htmlFor="react-restore-online-url">{message('options_restoreOnline', 'Restore from online')}</label>
        <div className="input-group width-limit">
          <input
            id="react-restore-online-url"
            className="form-control"
            type="url"
            value={restoreUrl}
            placeholder="https://example.com/backup.json"
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
      <h3>{message('options_group_importExportSync', 'Sync')}</h3>
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
                    'WebDAV Sync is enabled. Disable WebDAV Sync before enabling Browser Sync.'
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
                <span className="glyphicon glyphicon-ok" />{' '}
                {message('options_syncSyncAlert', 'Your options are automatically synchronized with your other devices.')}
              </p>
              <p className="help-block">
                {richMessage(
                  'options_syncSyncHelp',
                  'Please note that you must sign in to the same browser account on each device (including this one) for syncing to work. <br> You may check this section on other devices to ensure that it is working.'
                )}
              </p>
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
                <span className="glyphicon glyphicon-info-sign" />{' '}
                {message('options_syncConflictAlert', 'You have uploaded a copy of your options on another device via syncing.')}
              </p>
              <p className="help-block">
                {richMessage(
                  'options_syncConflictHelp',
                  'You may download the remote copy to your device if you like. <br>However, doing so would <b>overwrite your existing settings and profiles</b> on this device.'
                )}
              </p>
              <p>
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={syncActionBusy}
                  onClick={() => runSyncAction('enabling', () => enableOptionsSync({force: true}))}
                >
                  <span className="glyphicon glyphicon-cloud-download" /> {message('options_syncEnableForce', 'Download from Syncing')}
                </button>{' '}
                <button
                  type="button"
                  className="btn btn-link"
                  disabled={syncActionBusy}
                  onClick={() => runSyncAction('resetting', resetSyncedOptions)}
                >
                  <span className="glyphicon glyphicon-erase" /> {message('options_syncReset', 'Clear remote copy')}
                </button>
              </p>
            </>
          )}
          {syncOptions === 'unsupported' && (
            <p className="help-block">
              {richMessage('options_syncUnsupportedHelp', 'Options syncing is not supported on your platform or browser.')}
            </p>
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
              {message('options_webDavSyncBlockedByBrowser', 'Browser Sync is enabled. Disable Browser Sync before enabling WebDAV Sync.')}
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
              {webDavSyncActive && webDavSyncStatusBanner(webDavSyncStatus)}
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
                    placeholder="https://example.com/remote.php/dav/files/user/"
                    spellCheck={false}
                    disabled={webDavSyncBlocked}
                    onChange={(event) => updateWebDavConnectionConfig({serverUrl: event.currentTarget.value})}
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
                    spellCheck={false}
                    disabled={webDavSyncBlocked}
                    onChange={(event) => updateWebDavConnectionConfig({remotePath: event.currentTarget.value})}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="react-webdav-username">{message('options_webDavUsername', 'Username')}</label>
                  <input
                    id="react-webdav-username"
                    className="form-control width-limit"
                    type="text"
                    value={webDavConfig.username || ''}
                    spellCheck={false}
                    disabled={webDavSyncBlocked}
                    onChange={(event) => updateWebDavConnectionConfig({username: event.currentTarget.value})}
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
                    spellCheck={false}
                    disabled={webDavSyncBlocked}
                    onChange={(event) => updateWebDavConnectionConfig({password: event.currentTarget.value})}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="react-webdav-interval">{message('options_webDavInterval', 'Sync interval')}</label>
                  <select
                    id="react-webdav-interval"
                    className="form-control width-limit"
                    value={String(webDavConfig.intervalMinutes ?? 5)}
                    disabled={webDavSyncBlocked}
                    onChange={(event) => updateWebDavInterval(Number(event.currentTarget.value))}
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
                    onClick={testAndSaveWebDavConnection}
                  >
                    <span className="glyphicon glyphicon-transfer" /> {message('options_webDavTestSave', 'Test & Save')}
                  </button>{' '}
                  {!webDavSyncActive && (
                    <>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={!webDavConfigured || !webDavConnectionTested || webDavActionBusy || webDavSyncBlocked}
                        onClick={() => enableWebDavSync('upload')}
                      >
                        <span className="glyphicon glyphicon-cloud-upload" /> {message('options_webDavUploadEnable', 'Upload & Enable')}
                      </button>{' '}
                      <button
                        type="button"
                        className="btn btn-danger"
                        disabled={
                          !webDavConfigured ||
                          !webDavConnectionTested ||
                          webDavActionBusy ||
                          webDavRemoteExists !== true ||
                          webDavSyncBlocked
                        }
                        onClick={() => enableWebDavSync('download')}
                      >
                        <span className="glyphicon glyphicon-cloud-download" />{' '}
                        {message('options_webDavDownloadEnable', 'Download & Enable')}
                      </button>{' '}
                    </>
                  )}
                  {webDavSyncActive && (
                    <>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={webDavActionBusy || webDavConnectionChangesPending}
                        onClick={() => setWebDavConfirmAction('uploadNow')}
                      >
                        <span className="glyphicon glyphicon-cloud-upload" /> {message('options_webDavUploadNow', 'Upload Now')}
                      </button>{' '}
                      <button
                        type="button"
                        className="btn btn-danger"
                        disabled={webDavActionBusy || webDavConnectionChangesPending}
                        onClick={() => setWebDavConfirmAction('downloadNow')}
                      >
                        <span className="glyphicon glyphicon-cloud-download" /> {message('options_webDavDownloadNow', 'Download Now')}
                      </button>{' '}
                      <button type="button" className="btn btn-warning" disabled={webDavActionBusy} onClick={disableWebDavSync}>
                        <span className="glyphicon glyphicon-remove-sign" /> {message('options_webDavDisable', 'Disable WebDAV Sync')}
                      </button>
                    </>
                  )}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );

  const webDavConfirmModal = webDavConfirmAction && (
    <WebDavConfirmModal action={webDavConfirmAction} onConfirm={runConfirmedWebDavAction} onDismiss={() => setWebDavConfirmAction(null)} />
  );

  if (embedded) {
    return (
      <>
        <div className="page-header">
          <h2>{message('options_tab_importExport', 'Import/Export')}</h2>
        </div>
        {settingsSection}
        {syncSection}
        {webDavConfirmModal}
      </>
    );
  }

  return (
    <main className="container-fluid react-options">
      <div className="page-header">
        <h2>{message('options_tab_importExport', 'Import/Export')}</h2>
      </div>

      {settingsSection}
      {syncSection}
      {webDavConfirmModal}
    </main>
  );
}
