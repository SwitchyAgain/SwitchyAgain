import type {Options} from './options_client';

export const RESTORE_URL_STATE = 'web.restoreOnlineUrl';

export type ImportExportStatus = 'loading' | 'ready' | 'exporting' | 'restoringLocal' | 'restoringOnline' | 'success' | 'error';

export type SyncStatus = 'ready' | 'enabling' | 'disabling' | 'resetting';

export function importExportErrorMessage(error: unknown) {
  const candidate = error as {message?: unknown; reason?: unknown} | null | undefined;
  return String(candidate?.message || candidate?.reason || error);
}

export function backupOptionsText(options: Options) {
  const plainOptions = JSON.parse(JSON.stringify(options));
  return JSON.stringify(plainOptions);
}

export function importExportBusy(status: ImportExportStatus) {
  return status === 'loading' || status === 'exporting' || status === 'restoringLocal' || status === 'restoringOnline';
}

export function syncBusy(status: SyncStatus) {
  return status !== 'ready';
}

export function legacyRuleListPatch(options: Options, checked: boolean) {
  const nextOptions = {
    ...options,
    '-exportLegacyRuleList': checked
  };
  return {
    nextOptions,
    patch: {
      '-exportLegacyRuleList': [options['-exportLegacyRuleList'], checked]
    }
  };
}
