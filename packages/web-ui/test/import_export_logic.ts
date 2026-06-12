import {
  RESTORE_URL_STATE,
  backupOptionsText,
  importExportBusy,
  importExportErrorMessage,
  legacyRuleListPatch,
  syncBusy
} from '../src/react/import_export_logic';
import type {Options} from '../src/react/options_client';

describe('import export logic', () => {
  it('uses a stable local state key for online restore URLs', () => {
    expect(RESTORE_URL_STATE).toBe('web.restoreOnlineUrl');
  });

  it('formats import/export errors from message, reason, or primitive values', () => {
    expect(importExportErrorMessage(new Error('boom'))).toBe('boom');
    expect(importExportErrorMessage({reason: 'invalid'})).toBe('invalid');
    expect(importExportErrorMessage('plain')).toBe('plain');
    expect(importExportErrorMessage(null)).toBe('null');
  });

  it('serializes options through a plain JSON backup shape', () => {
    const options: Options = {
      '+proxy': {
        name: 'proxy',
        profileType: 'FixedProfile'
      },
      '-exportLegacyRuleList': true,
      transient: undefined
    };

    expect(backupOptionsText(options)).toBe(JSON.stringify({
      '+proxy': {
        name: 'proxy',
        profileType: 'FixedProfile'
      },
      '-exportLegacyRuleList': true
    }));
  });

  it('detects busy import/export statuses', () => {
    expect(importExportBusy('loading')).toBe(true);
    expect(importExportBusy('exporting')).toBe(true);
    expect(importExportBusy('restoringLocal')).toBe(true);
    expect(importExportBusy('restoringOnline')).toBe(true);
    expect(importExportBusy('ready')).toBe(false);
    expect(importExportBusy('success')).toBe(false);
    expect(importExportBusy('error')).toBe(false);
  });

  it('detects busy sync statuses', () => {
    expect(syncBusy('ready')).toBe(false);
    expect(syncBusy('enabling')).toBe(true);
    expect(syncBusy('disabling')).toBe(true);
    expect(syncBusy('resetting')).toBe(true);
  });

  it('builds legacy rule-list option updates and patches', () => {
    const options: Options = {
      '+proxy': {
        name: 'proxy'
      },
      '-exportLegacyRuleList': false
    };

    expect(legacyRuleListPatch(options, true)).toEqual({
      nextOptions: {
        '+proxy': {
          name: 'proxy'
        },
        '-exportLegacyRuleList': true
      },
      patch: {
        '-exportLegacyRuleList': [false, true]
      }
    });
  });
});
