import {
  moveQuickSwitchProfileName,
  notCycledProfileNames,
  quickSwitchProfileNames,
  reorderQuickSwitchProfileName,
  sameOptionValue,
  uiOptionPatch,
  uiOptionsDirty
} from '../src/react/ui_settings_logic';
import type {Options} from '../src/react/options_client_types';

describe('ui settings logic', () => {
  it('compares scalar and array option values', () => {
    expect(sameOptionValue('en', 'en')).toBe(true);
    expect(sameOptionValue('en', 'ru')).toBe(false);
    expect(sameOptionValue(['direct', 'proxy'], ['direct', 'proxy'])).toBe(true);
    expect(sameOptionValue(undefined, [])).toBe(true);
    expect(sameOptionValue(['direct'], [])).toBe(false);
  });

  it('builds UI option patches only for UI keys', () => {
    const before: Options = {
      '-quickSwitchProfiles': ['direct'],
      '-uiLocale': 'en',
      '-uiTheme': 'light',
      '+proxy': {
        name: 'proxy'
      }
    };
    const after: Options = {
      '-quickSwitchProfiles': ['direct', 'proxy'],
      '-showCurrentProfileInGeneral': true,
      '-showHttpProxyOverrideRows': false,
      '-showProfileOptions': true,
      '-showSocks5LocalDnsOption': true,
      '-showWebSocketProxyOverrideRows': true,
      '-uiLocale': 'en',
      '-uiTheme': 'dark',
      '+proxy': {
        color: '#ffffff',
        name: 'proxy'
      }
    };

    expect(uiOptionsDirty(before, after)).toBe(true);
    expect(uiOptionPatch(before, after)).toEqual({
      '-quickSwitchProfiles': [['direct'], ['direct', 'proxy']],
      '-showCurrentProfileInGeneral': [undefined, true],
      '-showHttpProxyOverrideRows': [undefined, false],
      '-showProfileOptions': [undefined, true],
      '-showSocks5LocalDnsOption': [undefined, true],
      '-showWebSocketProxyOverrideRows': [undefined, true],
      '-uiTheme': ['light', 'dark']
    });
    expect(uiOptionsDirty(before, before)).toBe(false);
  });

  it('normalizes quick switch profile values', () => {
    const profiles = ['direct', 'proxy'];

    expect(quickSwitchProfileNames(profiles)).toBe(profiles);
    expect(quickSwitchProfileNames(undefined)).toEqual([]);
  });

  it('derives profiles outside the quick switch cycle', () => {
    expect(
      notCycledProfileNames(
        [
          {
            name: 'direct'
          },
          {
            name: 'proxy'
          },
          {
            name: ''
          },
          {}
        ],
        ['direct']
      )
    ).toEqual(['proxy']);
  });

  it('moves profiles in and out of the quick switch cycle', () => {
    const profiles = ['direct', 'proxy'];

    expect(moveQuickSwitchProfileName(profiles, 'system', true)).toEqual(['direct', 'proxy', 'system']);
    expect(moveQuickSwitchProfileName(profiles, 'proxy', false)).toEqual(['direct']);
    expect(moveQuickSwitchProfileName(profiles, 'proxy', true)).toBe(profiles);
    expect(moveQuickSwitchProfileName(profiles, 'missing', false)).toBe(profiles);
  });

  it('reorders enabled quick switch profiles', () => {
    const profiles = ['direct', 'proxy', 'system'];

    expect(reorderQuickSwitchProfileName(profiles, 'system', 'direct', true)).toEqual(['system', 'direct', 'proxy']);
    expect(reorderQuickSwitchProfileName(profiles, 'system', 'direct', false)).toBe(profiles);
    expect(reorderQuickSwitchProfileName(profiles, 'missing', 'direct', true)).toBe(profiles);
    expect(reorderQuickSwitchProfileName(profiles, 'direct', 'direct', true)).toBe(profiles);
  });
});
