import React, {useEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {
  downloadBlob,
  loadOptions,
  manifestVersion,
  message,
  Options,
  resetOptions,
  runtimeAvailable
} from './options_client';

const RESTORE_URL_STATE = 'omega.local.web.restoreOnlineUrl';

type Alert = {
  type: 'success' | 'error';
  i18n?: string;
  message?: string;
};

type BackupRestoreProps = {
  embedded?: boolean;
  onExportOptions?: () => Promise<any> | any;
  onOptionsReset?: (options: Options) => Promise<any> | any;
  onRestoreLocal?: (content: string) => Promise<any> | any;
  onRestoreOnline?: (url: string) => Promise<any> | any;
  onRestoreOnlineUrlChange?: (url: string) => void;
  options?: Options | null;
  restoreOnlineUrl?: string;
  showAlert?: (alert: Alert) => void;
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
  try {
    const storedUrl = window.localStorage.getItem(RESTORE_URL_STATE);
    return storedUrl ? JSON.parse(storedUrl) : '';
  } catch (err) {
    return '';
  }
}

function BackupRestore({
  embedded = false,
  onExportOptions,
  onOptionsReset,
  onRestoreLocal,
  onRestoreOnline,
  onRestoreOnlineUrlChange,
  options: initialOptions,
  restoreOnlineUrl,
  showAlert
}: BackupRestoreProps) {
  const [options, setOptions] = useState<Options | null>(() => embedded && initialOptions ? initialOptions : null);
  const [restoreUrl, setRestoreUrl] = useState(() => restoreOnlineUrl || storedRestoreUrl());
  const [status, setStatus] = useState<'loading' | 'ready' | 'exporting' | 'restoringLocal' | 'restoringOnline' | 'success' | 'error'>(() => embedded && initialOptions ? 'ready' : 'loading');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (embedded && restoreOnlineUrl != null) {
      setRestoreUrl(restoreOnlineUrl || '');
    }
  }, [embedded, restoreOnlineUrl]);

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
    if (embedded && showAlert) {
      showAlert({
        type: 'success',
        i18n: 'options_importSuccess',
        message: 'Options imported.'
      });
      setStatus('ready');
      return;
    }
    setError('');
    setStatus('success');
  }

  function showError(err: any, fallbackKey: string, fallback: string) {
    const messageText = errorMessage(err) || message(fallbackKey, fallback);
    if (embedded && showAlert) {
      showAlert({
        type: 'error',
        i18n: fallbackKey,
        message: messageText
      });
      setStatus('ready');
      return;
    }
    setError(messageText);
    setStatus('error');
  }

  function exportOptions() {
    if (!options) {
      return;
    }
    setStatus('exporting');
    if (onExportOptions) {
      Promise.resolve(onExportOptions()).then(() => {
        setStatus('ready');
      }).catch(() => {
        setStatus('ready');
      });
      return;
    }
    const plainOptions = JSON.parse(JSON.stringify(options));
    const blob = new Blob([JSON.stringify(plainOptions)], {
      type: 'text/plain;charset=utf-8'
    });
    downloadBlob(blob, 'OmegaOptions.bak');
    setStatus('ready');
  }

  function restoreFromContent(content: string, restoringStatus: 'restoringLocal' | 'restoringOnline') {
    setStatus(restoringStatus);
    if (onRestoreLocal && restoringStatus === 'restoringLocal') {
      Promise.resolve(onRestoreLocal(content)).then(() => {
        setStatus('ready');
      }).catch((err) => {
        showError(err, 'options_importFormatError', 'Invalid backup file!');
      });
      return;
    }
    resetOptions(content).then((loadedOptions) => {
      setOptions(loadedOptions);
      return Promise.resolve(onOptionsReset ? onOptionsReset(loadedOptions) : null);
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
    if (onRestoreOnline) {
      setStatus('restoringOnline');
      Promise.resolve(onRestoreOnline(url)).then(() => {
        setStatus('ready');
      }).catch((err) => {
        showError(err, 'options_importDownloadError', 'Error downloading backup file!');
      });
      return;
    }
    try {
      window.localStorage.setItem(RESTORE_URL_STATE, JSON.stringify(url));
    } catch (err) {}
    setStatus('restoringOnline');
    fetch(url, {
      cache: 'no-store'
    }).then((response) => {
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      return response.text();
    }).then((content) => {
      restoreFromContent(content, 'restoringOnline');
    }).catch((err) => {
      showError(err, 'options_importDownloadError', 'Error downloading backup file!');
    });
  }

  const busy = status === 'loading' || status === 'exporting' || status === 'restoringLocal' || status === 'restoringOnline';

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
              onRestoreOnlineUrlChange?.(url);
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

  if (embedded) {
    return settingsSection;
  }

  return (
    <main className="container-fluid react-options">
      <div className="page-header">
        <h2>{message('options_tab_importExport', 'Import/Export')}</h2>
        <p className="text-muted">
          React preview · {message('manifest_app_name', 'SwitchyAgain')} {manifestVersion()} · runtime {runtimeAvailable() ? 'available' : 'unavailable'}
        </p>
      </div>

      {settingsSection}

      <section className="settings-group">
        <h3>{message('options_group_importExportProfile', 'Profile')}</h3>
        <div className="help-block">
          <div className="text-info">
            <span className="glyphicon glyphicon-info-sign" /> {message('options_exportProfileHelp', 'To export a profile, use the top-right action bar on the profile page.')}
          </div>
        </div>
        <p
          className="help-block"
          dangerouslySetInnerHTML={htmlMessage(
            'options_exportLegacyRuleListHelp',
            'Enable this option only if you publish rule lists for users of those projects.'
          )}
        />
      </section>
    </main>
  );
}

function mount(element: Element, props: BackupRestoreProps = {}) {
  const root = createRoot(element);
  function render(nextProps: BackupRestoreProps = props) {
    props = nextProps;
    flushSync(() => {
      root.render(<BackupRestore {...props} />);
    });
  }
  render(props);
  return {
    render,
    unmount: () => root.unmount()
  };
}

const globalWindow = window as any;
globalWindow.OmegaReactBackupRestore = {
  mount
};

const rootElement = document.getElementById('react-root');

if (rootElement) {
  mount(rootElement);
}
