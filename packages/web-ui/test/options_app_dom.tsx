// @vitest-environment jsdom

import React from 'react';
import {cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {OptionsApp} from '../src/react/options_app';
import type {ExtensionChromeApi, ExtensionRuntimeApi} from '../src/react/browser_env';
import type {Options, ProfileScopeContainerInfo} from '../src/react/options_client_types';

type TestGlobal = typeof globalThis & {
  chrome?: ExtensionChromeApi;
};

type RuntimeSendMessage = NonNullable<ExtensionRuntimeApi['sendMessage']>;

function testGlobal() {
  return globalThis as TestGlobal;
}

function sourceProfileNames(ruleList: string) {
  return ruleList
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line[0] !== '[' && line[0] !== '@')
    .map((line) => (line.startsWith('default:') ? line.slice('default:'.length) : line.split(':')[0] || ''))
    .map((name) => name.trim())
    .filter(Boolean);
}

function switchSource(value: string) {
  return /^\s*\[SwitchyOmega Conditions\]/.test(value) || /(^|\n)@with\s+results?(\r|\n|$)/i.test(value)
    ? value
    : `[SwitchyOmega Conditions]\n@with result\n\n${value}`;
}

function parseSwitchSource(ruleList: string) {
  const rules: Array<{condition: {conditionType?: string; pattern?: string}; profileName: string}> = [];
  let defaultProfileName = 'direct';
  for (const rawLine of ruleList.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    if (line[0] === '[' || line[0] === '@') {
      continue;
    }
    if (line.startsWith('error:')) {
      throw new Error(line.slice('error:'.length).trim() || 'Invalid source');
    }
    if (line.startsWith('default:')) {
      defaultProfileName = line.slice('default:'.length).trim() || 'direct';
      continue;
    }
    const [profileName, conditionType, ...patternParts] = line.split(':');
    if (!profileName || !conditionType || patternParts.length === 0) {
      throw new Error(`Invalid source line: ${line}`);
    }
    rules.push({
      condition: {
        conditionType,
        pattern: patternParts.join(':')
      },
      profileName
    });
  }
  rules.push({
    condition: {
      conditionType: 'TrueCondition'
    },
    profileName: defaultProfileName
  });
  return rules;
}

function installProxyEngineMock() {
  (globalThis as any).ProxyEngine = {
    Conditions: {
      getWeekdayList() {
        return [];
      }
    },
    PacGenerator: {
      ascii(value: string) {
        return value;
      },
      script(options: Options, profileName: string, handlers?: {profileNotFound?: (name: string) => string}) {
        const profile = options[`+${profileName}`] as Record<string, unknown> | undefined;
        const referencedName = typeof profile?.defaultProfileName === 'string' ? profile.defaultProfileName : '';
        if (referencedName && referencedName !== 'direct' && referencedName !== 'system' && !options[`+${referencedName}`]) {
          handlers?.profileNotFound?.(referencedName);
        }
        return {
          print_to_string() {
            return `pac:${profileName}:${String(profile?.pacScript || '')}:default=${referencedName}`;
          }
        };
      }
    },
    Profiles: {
      byKey(key: string, options: Options) {
        if (key === '+direct') {
          return {
            builtin: true,
            name: 'direct',
            profileType: 'DirectProfile'
          };
        }
        if (key === '+system') {
          return {
            builtin: true,
            name: 'system',
            profileType: 'SystemProfile'
          };
        }
        return options[key];
      },
      create(spec: Record<string, unknown>) {
        return {...spec};
      },
      referencedBySet() {
        return {};
      },
      ruleListFormats: ['Switchy', 'AutoProxy'],
      updateRevision() {},
      validResultProfilesFor(_profile: unknown, options: Options) {
        return Object.keys(options)
          .filter((key) => key.charAt(0) === '+')
          .map((key) => options[key])
          .concat([
            {
              builtin: true,
              name: 'direct',
              profileType: 'DirectProfile'
            }
          ]);
      }
    },
    RuleList: {
      Switchy: {
        compose({
          defaultProfileName,
          rules
        }: {
          defaultProfileName: string;
          rules: Array<{condition?: {conditionType?: string; pattern?: string}; profileName?: string}>;
        }) {
          return [
            '[SwitchyOmega Conditions]',
            '@with result',
            '',
            `default:${defaultProfileName}`,
            ...(rules || []).map(
              (rule) => `${rule.profileName || ''}:${rule.condition?.conditionType || ''}:${rule.condition?.pattern || ''}`
            )
          ].join('\n');
        },
        directReferenceSet({ruleList}: {ruleList?: string}) {
          if (!/(^|\n)@with\s+results?(\r|\n|$)/i.test(ruleList || '')) {
            return undefined;
          }
          return Object.fromEntries(sourceProfileNames(ruleList || '').map((name) => [`+${name}`, name]));
        },
        parseOmega(ruleList: string) {
          return parseSwitchSource(ruleList);
        }
      }
    }
  };
}

function optionsFixture(): Options {
  return {
    '+proxy': {
      name: 'proxy',
      profileType: 'FixedProfile'
    },
    '+pac': {
      name: 'pac',
      pacScript: '',
      profileType: 'PacProfile'
    },
    '+rulelist': {
      defaultProfileName: 'direct',
      format: 'AutoProxy',
      matchProfileName: 'proxy',
      name: 'rulelist',
      profileType: 'RuleListProfile',
      sourceUrl: 'https://example.com/rules.txt'
    },
    '+auto': {
      defaultProfileName: 'direct',
      name: 'auto',
      profileType: 'SwitchProfile',
      rules: []
    },
    '+virtual': {
      defaultProfileName: 'proxy',
      name: 'virtual',
      profileType: 'VirtualProfile'
    },
    '-confirmDeletion': true,
    '-enableQuickSwitch': true,
    '-quickSwitchProfiles': ['direct', 'proxy'],
    '-uiLocale': 'en',
    '-uiTheme': 'light'
  };
}

function patchRequests(requests: unknown[]) {
  return requests.filter((request) => (request as {method?: string}).method === 'patch') as Array<{args?: unknown[]; method: string}>;
}

function getAllRequests(requests: unknown[]) {
  return requests.filter((request) => (request as {method?: string}).method === 'getAll');
}

function requestMethods(requests: unknown[]) {
  return requests.map((request) => (request as {method?: string}).method);
}

function firstPatch(requests: unknown[]) {
  return patchRequests(requests)[0]?.args?.[0] as Record<string, unknown> | undefined;
}

function profilePatchValue(patch: Record<string, unknown> | undefined, key: string) {
  return (patch?.[key] as unknown[] | undefined)?.[1] as Record<string, unknown> | undefined;
}

function addedPatchValue(patch: Record<string, unknown> | undefined, key: string) {
  return (patch?.[key] as unknown[] | undefined)?.[0] as Record<string, unknown> | undefined;
}

function deletedPatchValue(patch: Record<string, unknown> | undefined, key: string) {
  return (patch?.[key] as unknown[] | undefined)?.[0] as Record<string, unknown> | undefined;
}

function optionPatchValue<T>(patch: Record<string, unknown> | undefined, key: string) {
  return (patch?.[key] as unknown[] | undefined)?.[1] as T | undefined;
}

function patchedOptionValue<T>(patch: Record<string, unknown> | undefined, key: string) {
  const value = patch?.[key] as unknown[] | undefined;
  return (value?.length === 1 ? value[0] : value?.[1]) as T | undefined;
}

function applyOptionsPatch(options: Options, patch: Record<string, unknown>) {
  const nextOptions = JSON.parse(JSON.stringify(options)) as Options;
  for (const [key, rawValue] of Object.entries(patch)) {
    const value = rawValue as unknown[];
    if (value.length === 3 && value[1] === 0 && value[2] === 0) {
      delete nextOptions[key];
      continue;
    }
    nextOptions[key] = value.length === 1 ? value[0] : value[1];
  }
  return nextOptions;
}

function replaceOptionReferences(value: unknown, fromName: string, toName: string): unknown {
  if (value === fromName) {
    return toName;
  }
  if (Array.isArray(value)) {
    return value.map((item) => replaceOptionReferences(item, fromName, toName));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, replaceOptionReferences(item, fromName, toName)])
    );
  }
  return value;
}

function renameProfileInOptions(options: Options, fromName: string, toName: string) {
  const nextOptions = replaceOptionReferences(JSON.parse(JSON.stringify(options)), fromName, toName) as Options;
  const fromKey = `+${fromName}`;
  const toKey = `+${toName}`;
  const profile = nextOptions[fromKey];
  if (profile && typeof profile === 'object') {
    nextOptions[toKey] = {
      ...(profile as Record<string, unknown>),
      name: toName
    };
    delete nextOptions[fromKey];
  }
  return nextOptions;
}

function changeProfileSelect(label: string, name: string) {
  const group = screen.getByText(label).closest('.form-group') as HTMLElement;
  fireEvent.click(within(group).getByRole('listbox'));
  fireEvent.click(within(group).getByRole('option', {name}).querySelector('a') as HTMLAnchorElement);
}

function changeScopedProfileSelect(scope: HTMLElement, label: string, name: string) {
  const group = within(scope).getByText(label).closest('.form-group') as HTMLElement;
  fireEvent.click(within(group).getByRole('listbox'));
  fireEvent.click(within(group).getByRole('option', {name}).querySelector('a') as HTMLAnchorElement);
}

function changeTableProfileSelect(table: HTMLElement, rowText: string, name: string) {
  const row = within(table).getByText(rowText).closest('tr') as HTMLElement;
  fireEvent.click(within(row).getByRole('listbox'));
  fireEvent.click(within(row).getByRole('option', {name}).querySelector('a') as HTMLAnchorElement);
}

function createDataTransfer() {
  let data = '';
  return {
    getData: vi.fn(() => data),
    setData: vi.fn((_type: string, value: string) => {
      data = value;
    })
  } as unknown as DataTransfer;
}

function sourceEditor() {
  return document.querySelector('.rules-source textarea') as HTMLTextAreaElement;
}

function editSwitchSourceDraft(value: string) {
  fireEvent.click(screen.getByRole('button', {name: 'Edit Source'}));
  fireEvent.change(sourceEditor(), {
    target: {
      value: switchSource(value)
    }
  });
}

async function applySourceDraftDialog() {
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByRole('heading', {name: 'Apply Source Changes'})).toBeTruthy();
  fireEvent.click(within(dialog).getByRole('button', {name: 'Apply Source'}));
  return dialog;
}

async function sourceDraftDialog() {
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByRole('heading', {name: 'Apply Source Changes'})).toBeTruthy();
  return dialog;
}

function stubDownloads() {
  const anchorClicks: Array<{download: string; href: string}> = [];
  const createObjectURL = vi.fn((_blob: Blob) => 'blob:options-download');
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: createObjectURL
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn()
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    anchorClicks.push({
      download: this.download,
      href: this.href
    });
  });
  return {
    anchorClicks,
    createObjectURL
  };
}

function selectModalProfile(dialog: HTMLElement, label: string, name: string) {
  const group = within(dialog).getByText(label).closest('.profile-duplicate-source') as HTMLElement;
  fireEvent.click(within(group).getByRole('listbox'));
  fireEvent.click(within(group).getByRole('option', {name}).querySelector('a') as HTMLAnchorElement);
}

async function openNewProfileModal() {
  fireEvent.click(screen.getByRole('button', {name: 'New profile'}));
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByRole('heading', {name: 'New Profile'})).toBeTruthy();
  return dialog;
}

async function createFixedProfile(name: string) {
  const dialog = await openNewProfileModal();
  fireEvent.change(within(dialog).getByLabelText('Profile name'), {
    target: {
      value: name
    }
  });
  fireEvent.click(within(dialog).getByRole('button', {name: 'Create'}));
}

async function duplicateProfile(sourceName: string, targetName: string) {
  const dialog = await openNewProfileModal();
  fireEvent.change(within(dialog).getByLabelText('Profile name'), {
    target: {
      value: targetName
    }
  });
  fireEvent.click(within(dialog).getByRole('radio', {name: /Duplicate/}));
  selectModalProfile(dialog, 'Profile', sourceName);
  fireEvent.click(within(dialog).getByRole('button', {name: 'Create'}));
}

function installBackground({
  getAllError,
  options = optionsFixture(),
  patchedOptions,
  profileScopeCapabilities,
  profileScopeContainers,
  proxyDnsCapabilities,
  renamedOptions,
  replacedOptions,
  refreshedProfileScopeContainers,
  resetOptions = options,
  stateOverrides = {},
  updateProfileOptions,
  updateProfileResults = {}
}: {
  getAllError?: unknown;
  options?: Options;
  patchedOptions?: Options;
  profileScopeCapabilities?: Record<string, boolean>;
  profileScopeContainers?: ProfileScopeContainerInfo[];
  proxyDnsCapabilities?: Record<string, boolean>;
  renamedOptions?: Options;
  replacedOptions?: Options;
  refreshedProfileScopeContainers?: ProfileScopeContainerInfo[];
  resetOptions?: Options;
  stateOverrides?: Record<string, unknown>;
  updateProfileOptions?: Options;
  updateProfileResults?: Record<string, unknown>;
} = {}) {
  const requests: unknown[] = [];
  let currentOptions = options;
  const sendMessage: RuntimeSendMessage = vi.fn((request, callback) => {
    const typedRequest = request as {args?: unknown[]; method?: string};
    requests.push(request);
    if (typedRequest.method === 'getAll') {
      callback(getAllError ? {error: getAllError} : {result: currentOptions});
      return;
    }
    if (typedRequest.method === 'getState') {
      const key = typedRequest.args?.[0];
      const state: Record<string, unknown> = {
        currentProfileName: 'proxy',
        firstRun: '',
        isSystemProfile: false,
        profileScopeCapabilities: profileScopeCapabilities || {
          container: false,
          group: false,
          tab: false,
          window: false
        },
        profileScopeContainers: profileScopeContainers || [],
        proxyAuthCapabilities: {
          http: true,
          https: true,
          socks4: false,
          socks5: false
        },
        proxyDnsCapabilities: proxyDnsCapabilities || {
          socks5: false
        },
        proxyFeatures: ['fullUrlHttp'],
        ...stateOverrides
      };
      callback({
        result: Array.isArray(key)
          ? Object.fromEntries(key.map((stateKey) => [stateKey, state[stateKey]]))
          : typeof key === 'string'
            ? {[key]: state[key]}
            : {}
      });
      return;
    }
    if (typedRequest.method === 'patch') {
      currentOptions =
        patchedOptions || applyOptionsPatch(currentOptions, (typedRequest.args?.[0] as Record<string, unknown> | undefined) || {});
      callback({result: currentOptions});
      return;
    }
    if (typedRequest.method === 'renameProfile') {
      currentOptions =
        renamedOptions ||
        renameProfileInOptions(currentOptions, String(typedRequest.args?.[0] || ''), String(typedRequest.args?.[1] || ''));
      callback({result: currentOptions});
      return;
    }
    if (typedRequest.method === 'replaceRef') {
      currentOptions = replacedOptions || currentOptions;
      callback({result: currentOptions});
      return;
    }
    if (typedRequest.method === 'reset') {
      currentOptions = resetOptions;
      callback({result: currentOptions});
      return;
    }
    if (typedRequest.method === 'setOptionsSync') {
      callback({result: undefined});
      return;
    }
    if (typedRequest.method === 'resetOptionsSync') {
      callback({result: undefined});
      return;
    }
    if (typedRequest.method === 'refreshProfileScopeContainerNames') {
      callback({result: refreshedProfileScopeContainers || profileScopeContainers || []});
      return;
    }
    if (typedRequest.method === 'updateProfile') {
      currentOptions = updateProfileOptions || currentOptions;
      callback({result: updateProfileResults});
      return;
    }
    if (typedRequest.method === 'setState') {
      callback({result: typedRequest.args?.[0] || {}});
      return;
    }
    callback({result: undefined});
  });
  testGlobal().chrome = {
    i18n: {
      getMessage: () => '',
      getUILanguage: () => 'en'
    },
    runtime: {
      getManifest: () => ({
        manifest_version: 3,
        version: '0.0.0'
      }),
      getURL: (path) => path,
      sendMessage
    }
  };
  return {
    requests,
    sendMessage
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
  window.location.hash = '';
  window.onbeforeunload = null;
  delete (globalThis as any).ProxyEngine;
});

beforeEach(() => {
  installProxyEngineMock();
});

describe('options app', () => {
  it('loads options and navigates between shell routes', async () => {
    const {requests} = installBackground();
    window.location.hash = '#/about';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: 'About'});
    expect(screen.getByRole('link', {name: /proxy/})).toBeTruthy();
    expect(requests).toContainEqual({
      args: [
        [
          'currentProfileName',
          'isSystemProfile',
          'profileScopeCapabilities',
          'proxyAuthCapabilities',
          'proxyDnsCapabilities',
          'proxyFeatures',
          'profileScopeContainers',
          'firstRun'
        ]
      ],
      method: 'getState'
    });

    fireEvent.click(screen.getByRole('link', {name: 'General'}));

    await screen.findByRole('heading', {name: 'General'});
    expect(window.location.hash).toBe('#/general');
    expect(requests).toContainEqual({
      args: [
        {
          'web.last_url': '/general'
        }
      ],
      method: 'setState'
    });
  });

  it('restores the last options route before falling back to about', async () => {
    const {requests} = installBackground({
      stateOverrides: {
        'web.last_url': '/profile/proxy'
      }
    });
    window.location.hash = '';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: proxy/});
    expect(window.location.hash).toBe('#/profile/proxy');
    expect(localStorage.getItem('omega.local.web.last_url')).toBe(JSON.stringify('/profile/proxy'));
    expect(requests).not.toContainEqual({
      args: [
        {
          'web.last_url': '/about'
        }
      ],
      method: 'setState'
    });
  });

  it('shows a top-level alert when initial options loading fails', async () => {
    installBackground({
      getAllError: {
        _error: 'error',
        message: 'Options failed to load',
        name: 'OptionsError'
      }
    });
    window.location.hash = '#/about';

    render(<OptionsApp />);

    await waitFor(() => expect(screen.getByText('Options failed to load')).toBeTruthy());
  });

  it('tracks dirty embedded page updates and applies option patches', async () => {
    const loadedOptions = optionsFixture();
    const patchedOptions = {
      ...loadedOptions,
      '-confirmDeletion': false
    };
    const {requests} = installBackground({
      options: loadedOptions,
      patchedOptions
    });
    window.location.hash = '#/ui';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: 'Interface'});
    expect(requests.filter((request) => (request as {method?: string}).method === 'getState')).toHaveLength(1);

    fireEvent.click(screen.getByLabelText('Confirm before deleting profiles and rules.'));
    expect(window.onbeforeunload?.({} as BeforeUnloadEvent)).toBe('Options are not saved.');

    fireEvent.click(screen.getByRole('button', {name: 'Apply changes'}));

    await waitFor(() => expect(window.onbeforeunload).toBeNull());
    expect(requests).toContainEqual({
      args: [
        {
          '-confirmDeletion': [true, false]
        }
      ],
      method: 'patch'
    });
  });

  it('saves startup profile and quick switch edits through the top-level apply flow', async () => {
    const loadedOptions = optionsFixture();
    const {requests} = installBackground({
      options: loadedOptions
    });
    window.location.hash = '#/ui';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: 'Interface'});
    changeProfileSelect('Startup Profile', 'pac');

    const enabledList = document.querySelector('.cycle-profile-container.cycle-enabled') as HTMLUListElement;
    const disabledList = document.querySelector('.cycle-profile-container:not(.cycle-enabled)') as HTMLUListElement;
    const proxyItem = Array.from(enabledList.querySelectorAll('li')).find((item) => item.textContent?.includes('proxy')) as HTMLLIElement;
    const dataTransfer = createDataTransfer();
    fireEvent.dragStart(proxyItem, {dataTransfer});
    fireEvent.drop(disabledList, {dataTransfer});
    await waitFor(() => expect(window.onbeforeunload?.({} as BeforeUnloadEvent)).toBe('Options are not saved.'));

    fireEvent.click(screen.getByRole('button', {name: 'Apply changes'}));

    await waitFor(() => expect(window.onbeforeunload).toBeNull());
    expect(patchedOptionValue<string>(firstPatch(requests), '-startupProfileName')).toBe('pac');
    expect(patchedOptionValue<string[]>(firstPatch(requests), '-quickSwitchProfiles')).toEqual(['direct']);
    expect(getAllRequests(requests)).toHaveLength(1);
  });

  it('hides route trace after saving the interface option and blocks direct route access', async () => {
    const loadedOptions = optionsFixture();
    const {requests} = installBackground({
      options: loadedOptions
    });
    window.location.hash = '#/ui';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: 'Interface'});
    expect(screen.getByRole('link', {name: 'Route Lens'})).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Show Route Lens in the settings sidebar.'));
    fireEvent.click(screen.getByRole('button', {name: 'Apply changes'}));

    await waitFor(() => expect(screen.queryByRole('link', {name: 'Route Lens'})).toBeNull());
    expect(patchedOptionValue<boolean>(firstPatch(requests), '-showRouteLens')).toBe(false);

    window.location.hash = '#/routeLens';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    await waitFor(() => expect(screen.getByRole('heading', {name: 'Interface'})).toBeTruthy());
    expect(window.location.hash).toBe('#/ui');
  });

  it('moves options-sidebar hidden profiles only after applying changes', async () => {
    const loadedOptions = {
      ...optionsFixture(),
      '-showProfileOptions': true
    };
    const {requests} = installBackground({
      options: loadedOptions
    });
    window.location.hash = '#/profile/proxy';

    const {container} = render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: proxy/});
    const normalProfiles = () => container.querySelector('.options-shell-profile-list') as HTMLElement;
    expect(within(normalProfiles()).getByRole('link', {name: /proxy/})).toBeTruthy();
    expect(screen.queryByRole('button', {name: 'Hidden'})).toBeNull();

    fireEvent.click(screen.getByRole('switch', {name: 'Hide from options sidebar'}));
    expect(within(normalProfiles()).getByRole('link', {name: /proxy/})).toBeTruthy();
    expect(screen.queryByRole('button', {name: 'Hidden'})).toBeNull();

    fireEvent.click(screen.getByRole('button', {name: 'Apply changes'}));

    const hiddenProfiles = await screen.findByRole('button', {name: 'Hidden'});
    expect(patchedOptionValue<Record<string, unknown>>(firstPatch(requests), '+proxy')).toMatchObject({
      hiddenInOptions: true
    });
    expect(within(normalProfiles()).queryByRole('link', {name: /proxy/})).toBeNull();
    expect(hiddenProfiles.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('link', {name: /proxy/})).toBeNull();

    fireEvent.click(hiddenProfiles);
    expect(screen.getByRole('link', {name: /proxy/})).toBeTruthy();

    fireEvent.click(screen.getByRole('switch', {name: 'Hide from options sidebar'}));
    expect(screen.getByRole('button', {name: 'Hidden'})).toBeTruthy();

    fireEvent.click(screen.getByRole('button', {name: 'Apply changes'}));

    await waitFor(() => expect(screen.queryByRole('button', {name: 'Hidden'})).toBeNull());
    expect(within(normalProfiles()).getByRole('link', {name: /proxy/})).toBeTruthy();
  });

  it('enables profile scope settings through the top-level apply flow', async () => {
    const loadedOptions = optionsFixture();
    const {requests} = installBackground({
      options: loadedOptions,
      profileScopeCapabilities: {
        container: true,
        group: true,
        tab: true,
        window: true
      }
    });
    window.location.hash = '#/ui';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: 'Interface'});
    fireEvent.click(screen.getByLabelText('Tab profiles'));
    fireEvent.click(screen.getByLabelText('Tab group profiles'));
    fireEvent.click(screen.getByLabelText('Container profiles'));
    fireEvent.click(screen.getByLabelText('Normal/private defaults'));
    await waitFor(() => expect(window.onbeforeunload?.({} as BeforeUnloadEvent)).toBe('Options are not saved.'));

    fireEvent.click(screen.getByRole('button', {name: 'Apply changes'}));

    await waitFor(() => expect(window.onbeforeunload).toBeNull());
    expect(patchedOptionValue<Record<string, boolean>>(firstPatch(requests), '-profileScopes')).toEqual({
      container: true,
      group: true,
      tab: true,
      window: true
    });
    expect(getAllRequests(requests)).toHaveLength(1);
  });

  it('shows profile scope settings for tab group profiles without tab profiles', async () => {
    const loadedOptions: Options = {
      ...optionsFixture(),
      '-profileScopes': {
        group: true
      }
    };
    installBackground({
      options: loadedOptions,
      profileScopeCapabilities: {
        container: false,
        group: true,
        tab: true,
        window: false
      }
    });
    window.location.hash = '#/profileScope';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: 'Profile Scope'});
    expect(screen.getByRole('heading', {name: 'Tabs / Tab Groups'})).toBeTruthy();
    expect(
      screen.getByText('Tab and tab group profile assignments are temporary and stay with the tab or tab group where they were set.')
    ).toBeTruthy();
  });

  it('saves profile scope assignments through the top-level apply flow', async () => {
    const loadedOptions: Options = {
      ...optionsFixture(),
      '-profileScopeAssignments': {
        containers: {
          'firefox-container-2': 'proxy'
        },
        normalDefaultProfileName: 'direct'
      },
      '-profileScopes': {
        container: true,
        tab: true,
        window: true
      }
    };
    const profileScopeContainers: ProfileScopeContainerInfo[] = [
      {
        cookieStoreId: 'firefox-container-1',
        name: 'Work'
      },
      {
        cookieStoreId: 'firefox-container-2',
        name: 'Personal'
      }
    ];
    const {requests} = installBackground({
      options: loadedOptions,
      profileScopeCapabilities: {
        container: true,
        tab: true,
        window: true
      },
      profileScopeContainers
    });
    window.location.hash = '#/profileScope';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: 'Profile Scope'});
    changeScopedProfileSelect(
      screen.getByRole('heading', {name: 'Normal / Private'}).closest('section') as HTMLElement,
      'Normal windows',
      'pac'
    );
    changeScopedProfileSelect(
      screen.getByRole('heading', {name: 'Normal / Private'}).closest('section') as HTMLElement,
      'Private windows',
      'virtual'
    );
    fireEvent.click(screen.getByLabelText('Show containers using default profile'));
    changeTableProfileSelect(screen.getByRole('table'), 'Work', 'auto');
    changeTableProfileSelect(screen.getByRole('table'), 'Personal', 'Use Default');
    await waitFor(() => expect(window.onbeforeunload?.({} as BeforeUnloadEvent)).toBe('Options are not saved.'));

    fireEvent.click(screen.getByRole('button', {name: 'Apply changes'}));

    await waitFor(() => expect(window.onbeforeunload).toBeNull());
    expect(optionPatchValue<Record<string, unknown>>(firstPatch(requests), '-profileScopeAssignments')).toEqual({
      containers: {
        'firefox-container-1': 'auto'
      },
      normalDefaultProfileName: 'pac',
      privateDefaultProfileName: 'virtual'
    });
    expect(getAllRequests(requests)).toHaveLength(1);
  });

  it('applies dirty profile scope edits before opening profile actions', async () => {
    const loadedOptions: Options = {
      ...optionsFixture(),
      '-profileScopeAssignments': {
        containers: {},
        normalDefaultProfileName: 'direct'
      },
      '-profileScopes': {
        container: false,
        tab: false,
        window: true
      }
    };
    const {requests} = installBackground({
      options: loadedOptions,
      profileScopeCapabilities: {
        container: false,
        tab: false,
        window: true
      }
    });
    window.location.hash = '#/profileScope';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: 'Profile Scope'});
    changeScopedProfileSelect(
      screen.getByRole('heading', {name: 'Normal / Private'}).closest('section') as HTMLElement,
      'Normal windows',
      'pac'
    );
    await waitFor(() => expect(window.onbeforeunload?.({} as BeforeUnloadEvent)).toBe('Options are not saved.'));

    fireEvent.click(screen.getByRole('button', {name: 'New profile'}));

    let dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', {name: 'Apply Options'})).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', {name: 'Apply changes'}));

    dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', {name: 'New Profile'})).toBeTruthy();
    expect(optionPatchValue<Record<string, unknown>>(firstPatch(requests), '-profileScopeAssignments')).toEqual({
      containers: {},
      normalDefaultProfileName: 'pac'
    });
  });

  it('saves fixed profile proxy edits through the top-level apply flow', async () => {
    const loadedOptions = optionsFixture();
    const patchedOptions: Options = {
      ...loadedOptions,
      '+proxy': {
        ...(loadedOptions['+proxy'] as Record<string, unknown>),
        fallbackProxy: {
          host: 'proxy.example.com',
          port: 8080,
          scheme: 'http'
        }
      }
    };
    const {requests} = installBackground({
      options: loadedOptions,
      patchedOptions
    });
    window.location.hash = '#/profile/proxy';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: proxy/});
    const proxyServers = screen.getByRole('heading', {name: 'Proxy Servers'}).closest('section') as HTMLElement;

    fireEvent.change(within(proxyServers).getAllByRole('combobox')[0], {
      target: {
        value: 'http'
      }
    });
    fireEvent.change(within(proxyServers).getByDisplayValue('example.com'), {
      target: {
        value: 'proxy.example.com'
      }
    });
    fireEvent.change(within(proxyServers).getByDisplayValue('80'), {
      target: {
        value: '8080'
      }
    });
    expect(window.onbeforeunload?.({} as BeforeUnloadEvent)).toBe('Options are not saved.');

    fireEvent.click(screen.getByRole('button', {name: 'Apply changes'}));

    await waitFor(() => expect(window.onbeforeunload).toBeNull());
    expect(profilePatchValue(firstPatch(requests), '+proxy')).toMatchObject({
      fallbackProxy: {
        host: 'proxy.example.com',
        port: 8080,
        scheme: 'http'
      }
    });
  });

  it('commits focused fixed profile bypass list edits before top-level apply', async () => {
    const loadedOptions = optionsFixture();
    const bypassList = [
      {
        conditionType: 'BypassCondition',
        pattern: 'localhost'
      },
      {
        conditionType: 'BypassCondition',
        pattern: '*.internal.example'
      }
    ];
    const {requests} = installBackground({
      options: loadedOptions
    });
    window.location.hash = '#/profile/proxy';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: proxy/});
    const bypassSection = screen.getByRole('heading', {name: 'Bypass List'}).closest('section') as HTMLElement;
    const bypassEditor = within(bypassSection).getByRole('textbox');
    fireEvent.focus(bypassEditor);
    fireEvent.change(bypassEditor, {
      target: {
        value: 'localhost\n*.internal.example'
      }
    });
    fireEvent.click(screen.getByRole('button', {name: 'Apply changes'}));

    await waitFor(() => expect(window.onbeforeunload).toBeNull());
    expect(profilePatchValue(firstPatch(requests), '+proxy')).toMatchObject({
      bypassList
    });
  });

  it('commits focused fixed profile bypass list edits before switching profiles', async () => {
    const loadedOptions = optionsFixture();
    const bypassList = [
      {
        conditionType: 'BypassCondition',
        pattern: 'localhost'
      }
    ];
    const {requests} = installBackground({
      options: loadedOptions
    });
    window.location.hash = '#/profile/proxy';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: proxy/});
    const bypassSection = screen.getByRole('heading', {name: 'Bypass List'}).closest('section') as HTMLElement;
    const bypassEditor = within(bypassSection).getByRole('textbox');
    fireEvent.focus(bypassEditor);
    fireEvent.change(bypassEditor, {
      target: {
        value: 'localhost'
      }
    });
    fireEvent.click(screen.getByRole('link', {name: /pac/}));

    await screen.findByRole('heading', {name: /Profile :: pac/});
    fireEvent.click(screen.getByRole('button', {name: 'Apply changes'}));

    await waitFor(() => expect(window.onbeforeunload).toBeNull());
    expect(profilePatchValue(firstPatch(requests), '+proxy')).toMatchObject({
      bypassList
    });
  });

  it('saves PAC profile script edits through the top-level apply flow', async () => {
    const loadedOptions = optionsFixture();
    const pacScript = 'function FindProxyForURL() { return "DIRECT"; }';
    const patchedOptions: Options = {
      ...loadedOptions,
      '+pac': {
        ...(loadedOptions['+pac'] as Record<string, unknown>),
        pacScript
      }
    };
    const {requests} = installBackground({
      options: loadedOptions,
      patchedOptions
    });
    window.location.hash = '#/profile/pac';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: pac/});
    fireEvent.change(document.querySelector('textarea') as HTMLTextAreaElement, {
      target: {
        value: pacScript
      }
    });

    fireEvent.click(screen.getByRole('button', {name: 'Apply changes'}));

    await waitFor(() => expect(window.onbeforeunload).toBeNull());
    expect(profilePatchValue(firstPatch(requests), '+pac')).toMatchObject({
      pacScript
    });
  });

  it('saves rule list source edits through the top-level apply flow', async () => {
    const loadedOptions = optionsFixture();
    const nextSourceUrl = 'https://cdn.example.com/rules.txt';
    const patchedOptions: Options = {
      ...loadedOptions,
      '+rulelist': {
        ...(loadedOptions['+rulelist'] as Record<string, unknown>),
        sourceUrl: nextSourceUrl
      }
    };
    const {requests} = installBackground({
      options: loadedOptions,
      patchedOptions
    });
    window.location.hash = '#/profile/rulelist';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: rulelist/});
    fireEvent.change(screen.getByDisplayValue('https://example.com/rules.txt'), {
      target: {
        value: nextSourceUrl
      }
    });

    fireEvent.click(screen.getByRole('button', {name: 'Apply changes'}));

    await waitFor(() => expect(window.onbeforeunload).toBeNull());
    expect(profilePatchValue(firstPatch(requests), '+rulelist')).toMatchObject({
      sourceUrl: nextSourceUrl
    });
  });

  it('saves virtual profile target edits through the top-level apply flow', async () => {
    const loadedOptions = optionsFixture();
    const patchedOptions: Options = {
      ...loadedOptions,
      '+virtual': {
        ...(loadedOptions['+virtual'] as Record<string, unknown>),
        defaultProfileName: 'direct'
      }
    };
    const {requests} = installBackground({
      options: loadedOptions,
      patchedOptions
    });
    window.location.hash = '#/profile/virtual';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: virtual/});
    changeProfileSelect('Target', 'direct');

    fireEvent.click(screen.getByRole('button', {name: 'Apply changes'}));

    await waitFor(() => expect(window.onbeforeunload).toBeNull());
    expect(profilePatchValue(firstPatch(requests), '+virtual')).toMatchObject({
      defaultProfileName: 'direct'
    });
  });

  it('applies dirty profile edits before opening profile rename actions', async () => {
    const loadedOptions = optionsFixture();
    const pacScript = 'function FindProxyForURL() { return "PROXY 127.0.0.1:8080"; }';
    const patchedOptions: Options = {
      ...loadedOptions,
      '+pac': {
        ...(loadedOptions['+pac'] as Record<string, unknown>),
        pacScript
      }
    };
    const renamedOptions: Options = {
      ...patchedOptions,
      '+pac2': {
        ...(patchedOptions['+pac'] as Record<string, unknown>),
        name: 'pac2'
      }
    };
    delete (renamedOptions as Record<string, unknown>)['+pac'];
    const {requests} = installBackground({
      options: loadedOptions,
      patchedOptions,
      renamedOptions
    });
    window.location.hash = '#/profile/pac';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: pac/});
    fireEvent.change(document.querySelector('textarea') as HTMLTextAreaElement, {
      target: {
        value: pacScript
      }
    });
    fireEvent.click(screen.getByRole('button', {name: 'Rename'}));

    let dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', {name: 'Apply Options'})).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', {name: 'Apply changes'}));

    dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', {name: 'Rename Profile'})).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText('New profile name'), {
      target: {
        value: 'pac2'
      }
    });
    fireEvent.click(within(dialog).getByRole('button', {name: 'Rename'}));

    await screen.findByRole('heading', {name: /Profile :: pac2/});
    const methods = requestMethods(requests);
    expect(methods.indexOf('patch')).toBeGreaterThan(-1);
    expect(methods.indexOf('renameProfile')).toBeGreaterThan(methods.indexOf('patch'));
    expect(profilePatchValue(firstPatch(requests), '+pac')).toMatchObject({
      pacScript
    });
    expect(requests).toContainEqual({
      args: ['pac', 'pac2'],
      method: 'renameProfile'
    });
  });

  it('creates new profiles through the top-level apply flow without reloading all options', async () => {
    const {requests} = installBackground();
    window.location.hash = '#/ui';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: 'Interface'});
    await createFixedProfile('newproxy');

    await screen.findByRole('heading', {name: /Profile :: newproxy/});
    expect(window.onbeforeunload?.({} as BeforeUnloadEvent)).toBe('Options are not saved.');

    fireEvent.click(screen.getByRole('button', {name: 'Apply changes'}));

    await waitFor(() => expect(window.onbeforeunload).toBeNull());
    expect(addedPatchValue(firstPatch(requests), '+newproxy')).toMatchObject({
      name: 'newproxy',
      profileType: 'FixedProfile'
    });
    expect(getAllRequests(requests)).toHaveLength(1);
  });

  it('duplicates switch profiles with attached rule lists through the top-level apply flow', async () => {
    const loadedOptions: Options = {
      ...optionsFixture(),
      '+auto': {
        defaultProfileName: '__ruleListOf_auto',
        name: 'auto',
        profileType: 'SwitchProfile',
        rules: [
          {
            condition: {
              conditionType: 'HostWildcardCondition',
              pattern: '*.example.com'
            },
            profileName: 'proxy'
          }
        ]
      },
      '+__ruleListOf_auto': {
        defaultProfileName: 'direct',
        format: 'AutoProxy',
        name: '__ruleListOf_auto',
        profileType: 'RuleListProfile',
        ruleList: '||example.com'
      }
    };
    const {requests} = installBackground({
      options: loadedOptions
    });
    window.location.hash = '#/profile/auto';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: auto/});
    await duplicateProfile('auto', 'autocopy');

    await screen.findByRole('heading', {name: /Profile :: autocopy/});
    fireEvent.click(screen.getByRole('button', {name: 'Apply changes'}));

    await waitFor(() => expect(window.onbeforeunload).toBeNull());
    expect(addedPatchValue(firstPatch(requests), '+autocopy')).toMatchObject({
      defaultProfileName: '__ruleListOf_autocopy',
      name: 'autocopy',
      profileType: 'SwitchProfile',
      rules: [
        {
          condition: {
            conditionType: 'HostWildcardCondition',
            pattern: '*.example.com'
          },
          profileName: 'proxy'
        }
      ]
    });
    expect(addedPatchValue(firstPatch(requests), '+__ruleListOf_autocopy')).toMatchObject({
      defaultProfileName: 'direct',
      name: '__ruleListOf_autocopy',
      profileType: 'RuleListProfile',
      ruleList: '||example.com'
    });
    expect(getAllRequests(requests)).toHaveLength(1);
  });

  it('renames dirty switch profiles with newly attached rule lists after applying edits', async () => {
    const loadedOptions: Options = {
      ...optionsFixture(),
      '+auto': {
        defaultProfileName: 'direct',
        name: 'auto',
        profileType: 'SwitchProfile',
        rules: []
      }
    };
    const {requests} = installBackground({
      options: loadedOptions
    });
    window.location.hash = '#/profile/auto';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: auto/});
    fireEvent.click(screen.getByRole('button', {name: 'Attach Profile'}));
    fireEvent.click(screen.getByRole('button', {name: 'Rename'}));

    let dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', {name: 'Apply Options'})).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', {name: 'Apply changes'}));

    dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', {name: 'Rename Profile'})).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText('New profile name'), {
      target: {
        value: 'autorenamed'
      }
    });
    fireEvent.click(within(dialog).getByRole('button', {name: 'Rename'}));

    await screen.findByRole('heading', {name: /Profile :: autorenamed/});
    const methods = requestMethods(requests);
    expect(methods.indexOf('patch')).toBeGreaterThan(-1);
    expect(methods.indexOf('renameProfile')).toBeGreaterThan(methods.indexOf('patch'));
    expect(requests).toContainEqual({
      args: ['auto', 'autorenamed'],
      method: 'renameProfile'
    });
    expect(requests).toContainEqual({
      args: ['__ruleListOf_auto', '__ruleListOf_autorenamed'],
      method: 'renameProfile'
    });
    expect(getAllRequests(requests)).toHaveLength(1);
  });

  it('renames switch profile attached rule lists after applying open source drafts', async () => {
    const loadedOptions: Options = {
      ...optionsFixture(),
      '+auto': {
        defaultProfileName: 'direct',
        name: 'auto',
        profileType: 'SwitchProfile',
        rules: []
      }
    };
    const {requests} = installBackground({
      options: loadedOptions
    });
    window.location.hash = '#/profile/auto';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: auto/});
    editSwitchSourceDraft('proxy:HostWildcardCondition:*.example.com\ndefault:virtual');
    fireEvent.click(screen.getByRole('button', {name: 'Rename'}));

    await applySourceDraftDialog();
    let dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', {name: 'Apply Options'})).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', {name: 'Apply changes'}));

    dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', {name: 'Rename Profile'})).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText('New profile name'), {
      target: {
        value: 'autorenamed'
      }
    });
    fireEvent.click(within(dialog).getByRole('button', {name: 'Rename'}));

    await screen.findByRole('heading', {name: /Profile :: autorenamed/});
    expect(profilePatchValue(firstPatch(requests), '+auto')).toMatchObject({
      defaultProfileName: 'virtual',
      rules: [
        {
          condition: {
            conditionType: 'HostWildcardCondition',
            pattern: '*.example.com'
          },
          profileName: 'proxy'
        }
      ]
    });
    expect(requests).toContainEqual({
      args: ['auto', 'autorenamed'],
      method: 'renameProfile'
    });
    expect(requests).not.toContainEqual({
      args: ['__ruleListOf_auto', '__ruleListOf_autorenamed'],
      method: 'renameProfile'
    });
    expect(getAllRequests(requests)).toHaveLength(1);
  });

  it('renames attached rule lists enabled by open switch source drafts', async () => {
    const loadedOptions: Options = {
      ...optionsFixture(),
      '+auto': {
        defaultProfileName: 'direct',
        name: 'auto',
        profileType: 'SwitchProfile',
        rules: []
      },
      '+__ruleListOf_auto': {
        defaultProfileName: 'proxy',
        format: 'AutoProxy',
        name: '__ruleListOf_auto',
        profileType: 'RuleListProfile',
        ruleList: '||source.example'
      }
    };
    const {requests} = installBackground({
      options: loadedOptions
    });
    window.location.hash = '#/profile/auto';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: auto/});
    editSwitchSourceDraft('default:__ruleListOf_auto');
    fireEvent.click(screen.getByRole('button', {name: 'Rename'}));

    await applySourceDraftDialog();
    let dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', {name: 'Apply Options'})).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', {name: 'Apply changes'}));

    dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', {name: 'Rename Profile'})).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText('New profile name'), {
      target: {
        value: 'autorenamed'
      }
    });
    fireEvent.click(within(dialog).getByRole('button', {name: 'Rename'}));

    await screen.findByRole('heading', {name: /Profile :: autorenamed/});
    expect(profilePatchValue(firstPatch(requests), '+auto')).toMatchObject({
      defaultProfileName: '__ruleListOf_auto'
    });
    expect(requests).toContainEqual({
      args: ['auto', 'autorenamed'],
      method: 'renameProfile'
    });
    expect(requests).toContainEqual({
      args: ['__ruleListOf_auto', '__ruleListOf_autorenamed'],
      method: 'renameProfile'
    });

    fireEvent.click(screen.getByRole('button', {name: 'Edit Source'}));
    expect(sourceEditor().value).toBe(switchSource('default:proxy'));
  });

  it('renames switch profile attached rule lists over existing target attached profiles', async () => {
    const loadedOptions: Options = {
      ...optionsFixture(),
      '+auto': {
        defaultProfileName: '__ruleListOf_auto',
        name: 'auto',
        profileType: 'SwitchProfile',
        rules: []
      },
      '+__ruleListOf_auto': {
        defaultProfileName: 'direct',
        format: 'AutoProxy',
        name: '__ruleListOf_auto',
        profileType: 'RuleListProfile',
        ruleList: '||source.example'
      },
      '+__ruleListOf_autocopy': {
        defaultProfileName: 'proxy',
        format: 'AutoProxy',
        name: '__ruleListOf_autocopy',
        profileType: 'RuleListProfile',
        ruleList: '||target.example'
      }
    };
    const {requests} = installBackground({
      options: loadedOptions
    });
    window.location.hash = '#/profile/auto';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: auto/});
    fireEvent.click(screen.getByRole('button', {name: 'Rename'}));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', {name: 'Rename Profile'})).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText('New profile name'), {
      target: {
        value: 'autocopy'
      }
    });
    fireEvent.click(within(dialog).getByRole('button', {name: 'Rename'}));

    await screen.findByRole('heading', {name: /Profile :: autocopy/});
    expect(requests).toContainEqual({
      args: ['auto', 'autocopy'],
      method: 'renameProfile'
    });
    expect(requests).toContainEqual({
      args: ['__ruleListOf_auto', '__ruleListOf_autocopy'],
      method: 'renameProfile'
    });
    const patches = patchRequests(requests);
    expect(deletedPatchValue(patches[0]?.args?.[0] as Record<string, unknown> | undefined, '+__ruleListOf_autocopy')).toMatchObject({
      name: '__ruleListOf_autocopy',
      ruleList: '||target.example'
    });
    expect(profilePatchValue(patches[1]?.args?.[0] as Record<string, unknown> | undefined, '+autocopy')).toMatchObject({
      defaultProfileName: '__ruleListOf_autocopy'
    });
    expect(getAllRequests(requests)).toHaveLength(1);
  });

  it('saves switch attached rule list source edits through the top-level apply flow', async () => {
    const loadedOptions: Options = {
      ...optionsFixture(),
      '+auto': {
        defaultProfileName: '__ruleListOf_auto',
        name: 'auto',
        profileType: 'SwitchProfile',
        rules: []
      },
      '+__ruleListOf_auto': {
        defaultProfileName: 'direct',
        format: 'AutoProxy',
        name: '__ruleListOf_auto',
        profileType: 'RuleListProfile',
        sourceUrl: 'https://example.com/attached.txt'
      }
    };
    const nextSourceUrl = 'https://cdn.example.com/attached.txt';
    const {requests} = installBackground({
      options: loadedOptions
    });
    window.location.hash = '#/profile/auto';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: auto/});
    fireEvent.change(screen.getByDisplayValue('https://example.com/attached.txt'), {
      target: {
        value: nextSourceUrl
      }
    });
    fireEvent.click(screen.getByRole('button', {name: 'Apply changes'}));

    await waitFor(() => expect(window.onbeforeunload).toBeNull());
    expect(profilePatchValue(firstPatch(requests), '+__ruleListOf_auto')).toMatchObject({
      sourceUrl: nextSourceUrl
    });
    expect(getAllRequests(requests)).toHaveLength(1);
  });

  it('saves enabled switch attached default profile edits on the attached rule list', async () => {
    const loadedOptions: Options = {
      ...optionsFixture(),
      '+auto': {
        defaultProfileName: '__ruleListOf_auto',
        name: 'auto',
        profileType: 'SwitchProfile',
        rules: []
      },
      '+__ruleListOf_auto': {
        defaultProfileName: 'direct',
        format: 'AutoProxy',
        name: '__ruleListOf_auto',
        profileType: 'RuleListProfile',
        ruleList: '||example.com'
      }
    };
    const {requests} = installBackground({
      options: loadedOptions
    });
    window.location.hash = '#/profile/auto';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: auto/});
    changeTableProfileSelect(screen.getByRole('table'), 'Default Profile', 'proxy');
    fireEvent.click(screen.getByRole('button', {name: 'Apply changes'}));

    await waitFor(() => expect(window.onbeforeunload).toBeNull());
    expect(profilePatchValue(firstPatch(requests), '+__ruleListOf_auto')).toMatchObject({
      defaultProfileName: 'proxy'
    });
    expect(getAllRequests(requests)).toHaveLength(1);
  });

  it('removes switch attached rule lists and restores the switch default profile', async () => {
    const loadedOptions: Options = {
      ...optionsFixture(),
      '+auto': {
        defaultProfileName: '__ruleListOf_auto',
        name: 'auto',
        profileType: 'SwitchProfile',
        rules: []
      },
      '+__ruleListOf_auto': {
        defaultProfileName: 'proxy',
        format: 'AutoProxy',
        name: '__ruleListOf_auto',
        profileType: 'RuleListProfile',
        ruleList: '||example.com'
      }
    };
    const {requests} = installBackground({
      options: loadedOptions
    });
    window.location.hash = '#/profile/auto';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: auto/});
    fireEvent.click(screen.getByTitle('Delete attached profile'));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', {name: 'Remove Rule List'})).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', {name: 'Remove rule list'}));
    fireEvent.click(screen.getByRole('button', {name: 'Apply changes'}));

    await waitFor(() => expect(window.onbeforeunload).toBeNull());
    const patch = firstPatch(requests);
    expect(profilePatchValue(patch, '+auto')).toMatchObject({
      defaultProfileName: 'proxy'
    });
    expect(deletedPatchValue(patch, '+__ruleListOf_auto')).toMatchObject({
      name: '__ruleListOf_auto',
      ruleList: '||example.com'
    });
    expect(getAllRequests(requests)).toHaveLength(1);
  });

  it('applies switch source edits to rules and the switch default profile', async () => {
    const loadedOptions: Options = {
      ...optionsFixture(),
      '+auto': {
        defaultProfileName: 'direct',
        name: 'auto',
        profileType: 'SwitchProfile',
        rules: []
      }
    };
    const {requests} = installBackground({
      options: loadedOptions
    });
    window.location.hash = '#/profile/auto';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: auto/});
    fireEvent.click(screen.getByRole('button', {name: 'Edit Source'}));
    fireEvent.change(sourceEditor(), {
      target: {
        value: switchSource('proxy:HostWildcardCondition:*.example.com\ndefault:virtual')
      }
    });
    fireEvent.click(screen.getByRole('button', {name: 'Apply Source'}));
    fireEvent.click(screen.getByRole('button', {name: 'Apply changes'}));

    await waitFor(() => expect(window.onbeforeunload).toBeNull());
    expect(profilePatchValue(firstPatch(requests), '+auto')).toMatchObject({
      defaultProfileName: 'virtual',
      rules: [
        {
          condition: {
            conditionType: 'HostWildcardCondition',
            pattern: '*.example.com'
          },
          profileName: 'proxy'
        }
      ]
    });
    expect(getAllRequests(requests)).toHaveLength(1);
  });

  it('applies open switch source editor drafts through the top-level apply flow', async () => {
    const loadedOptions: Options = {
      ...optionsFixture(),
      '+auto': {
        defaultProfileName: 'direct',
        name: 'auto',
        profileType: 'SwitchProfile',
        rules: []
      }
    };
    const {requests} = installBackground({
      options: loadedOptions
    });
    window.location.hash = '#/profile/auto';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: auto/});
    fireEvent.click(screen.getByRole('button', {name: 'Edit Source'}));
    fireEvent.change(sourceEditor(), {
      target: {
        value: switchSource('proxy:HostWildcardCondition:*.example.com\ndefault:virtual')
      }
    });
    fireEvent.click(screen.getByRole('button', {name: 'Apply changes'}));

    await applySourceDraftDialog();

    await waitFor(() => expect(window.onbeforeunload).toBeNull());
    expect(profilePatchValue(firstPatch(requests), '+auto')).toMatchObject({
      defaultProfileName: 'virtual',
      rules: [
        {
          condition: {
            conditionType: 'HostWildcardCondition',
            pattern: '*.example.com'
          },
          profileName: 'proxy'
        }
      ]
    });
    expect(getAllRequests(requests)).toHaveLength(1);
  });

  it('discards open switch source editor drafts without saving patches', async () => {
    const loadedOptions: Options = {
      ...optionsFixture(),
      '+auto': {
        defaultProfileName: 'direct',
        name: 'auto',
        profileType: 'SwitchProfile',
        rules: []
      }
    };
    const {requests} = installBackground({
      options: loadedOptions
    });
    window.location.hash = '#/profile/auto';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: auto/});
    fireEvent.click(screen.getByRole('button', {name: 'Edit Source'}));
    fireEvent.change(sourceEditor(), {
      target: {
        value: switchSource('proxy:HostWildcardCondition:*.example.com\ndefault:virtual')
      }
    });
    expect(window.onbeforeunload?.({} as BeforeUnloadEvent)).toBe('Options are not saved.');

    fireEvent.click(screen.getByRole('button', {name: 'Discard changes'}));
    await waitFor(() => expect(window.onbeforeunload).toBeNull());

    fireEvent.click(screen.getByRole('link', {name: /auto/}));
    await screen.findByRole('heading', {name: /Profile :: auto/});
    fireEvent.click(screen.getByRole('button', {name: 'Edit Source'}));

    expect(sourceEditor().value).toBe(switchSource('default:direct'));
    expect(patchRequests(requests)).toHaveLength(0);
    expect(getAllRequests(requests)).toHaveLength(1);
  });

  it('discards switch source editor drafts back to the visual rules list', async () => {
    const loadedOptions: Options = {
      ...optionsFixture(),
      '+auto': {
        defaultProfileName: 'direct',
        name: 'auto',
        profileType: 'SwitchProfile',
        rules: []
      }
    };
    const {requests} = installBackground({
      options: loadedOptions
    });
    window.location.hash = '#/profile/auto';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: auto/});
    editSwitchSourceDraft('proxy:HostWildcardCondition:*.example.com\ndefault:virtual');
    fireEvent.click(screen.getByRole('button', {name: 'Discard Source'}));

    expect(document.querySelector('.rules-source textarea')).toBeNull();
    expect(screen.getByRole('button', {name: 'Edit Source'})).toBeTruthy();
    expect(window.onbeforeunload).toBeNull();
    expect(patchRequests(requests)).toHaveLength(0);
  });

  it('keeps open switch source editor drafts unsaved when top-level apply hits parse errors', async () => {
    const loadedOptions: Options = {
      ...optionsFixture(),
      '+auto': {
        defaultProfileName: 'direct',
        name: 'auto',
        profileType: 'SwitchProfile',
        rules: []
      }
    };
    const {requests} = installBackground({
      options: loadedOptions
    });
    window.location.hash = '#/profile/auto';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: auto/});
    fireEvent.click(screen.getByRole('button', {name: 'Edit Source'}));
    fireEvent.change(sourceEditor(), {
      target: {
        value: '[SwitchyOmega Conditions]\n@with result\n\ndefault:missing'
      }
    });
    fireEvent.click(screen.getByRole('button', {name: 'Apply changes'}));

    await applySourceDraftDialog();

    expect(await screen.findByText('Unknown profile: missing')).toBeTruthy();
    expect(sourceEditor()).toBeTruthy();
    expect(window.onbeforeunload?.({} as BeforeUnloadEvent)).toBe('Options are not saved.');
    expect(patchRequests(requests)).toHaveLength(0);
  });

  it('applies open switch source drafts after correcting parse errors', async () => {
    const loadedOptions: Options = {
      ...optionsFixture(),
      '+auto': {
        defaultProfileName: 'direct',
        name: 'auto',
        profileType: 'SwitchProfile',
        rules: []
      }
    };
    const {requests} = installBackground({
      options: loadedOptions
    });
    window.location.hash = '#/profile/auto';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: auto/});
    fireEvent.click(screen.getByRole('button', {name: 'Edit Source'}));
    fireEvent.change(sourceEditor(), {
      target: {
        value: '[SwitchyOmega Conditions]\n@with result\n\ndefault:missing'
      }
    });
    fireEvent.click(screen.getByRole('button', {name: 'Apply changes'}));

    await applySourceDraftDialog();

    expect(await screen.findByText('Unknown profile: missing')).toBeTruthy();
    expect(patchRequests(requests)).toHaveLength(0);

    fireEvent.change(sourceEditor(), {
      target: {
        value: '[SwitchyOmega Conditions]\n@with result\n\nproxy:HostWildcardCondition:*.example.com\ndefault:virtual'
      }
    });
    expect(screen.queryByText('Unknown profile: missing')).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: 'Apply changes'}));

    await applySourceDraftDialog();

    await waitFor(() => expect(window.onbeforeunload).toBeNull());
    expect(profilePatchValue(firstPatch(requests), '+auto')).toMatchObject({
      defaultProfileName: 'virtual',
      rules: [
        {
          condition: {
            conditionType: 'HostWildcardCondition',
            pattern: '*.example.com'
          },
          profileName: 'proxy'
        }
      ]
    });
    expect(getAllRequests(requests)).toHaveLength(1);
  });

  it('applies enabled switch source default edits to the attached rule list', async () => {
    const loadedOptions: Options = {
      ...optionsFixture(),
      '+auto': {
        defaultProfileName: '__ruleListOf_auto',
        name: 'auto',
        profileType: 'SwitchProfile',
        rules: []
      },
      '+__ruleListOf_auto': {
        defaultProfileName: 'direct',
        format: 'AutoProxy',
        name: '__ruleListOf_auto',
        profileType: 'RuleListProfile',
        ruleList: '||example.com'
      }
    };
    const {requests} = installBackground({
      options: loadedOptions
    });
    window.location.hash = '#/profile/auto';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: auto/});
    fireEvent.click(screen.getByRole('button', {name: 'Edit Source'}));
    fireEvent.change(sourceEditor(), {
      target: {
        value: switchSource('default:proxy')
      }
    });
    fireEvent.click(screen.getByRole('button', {name: 'Apply Source'}));
    fireEvent.click(screen.getByRole('button', {name: 'Apply changes'}));

    await waitFor(() => expect(window.onbeforeunload).toBeNull());
    expect(profilePatchValue(firstPatch(requests), '+__ruleListOf_auto')).toMatchObject({
      defaultProfileName: 'proxy'
    });
    expect(profilePatchValue(firstPatch(requests), '+auto')).toBeUndefined();
    expect(getAllRequests(requests)).toHaveLength(1);
  });

  it('keeps switch source editor open and leaves options unchanged on parse errors', async () => {
    const loadedOptions: Options = {
      ...optionsFixture(),
      '+auto': {
        defaultProfileName: 'direct',
        name: 'auto',
        profileType: 'SwitchProfile',
        rules: []
      }
    };
    const {requests} = installBackground({
      options: loadedOptions
    });
    window.location.hash = '#/profile/auto';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: auto/});
    fireEvent.click(screen.getByRole('button', {name: 'Edit Source'}));
    fireEvent.change(sourceEditor(), {
      target: {
        value: switchSource('default:missing')
      }
    });
    fireEvent.click(screen.getByRole('button', {name: 'Apply Source'}));

    expect(await screen.findByText('Unknown profile: missing')).toBeTruthy();
    expect(sourceEditor()).toBeTruthy();
    expect(window.onbeforeunload?.({} as BeforeUnloadEvent)).toBe('Options are not saved.');
    expect(patchRequests(requests)).toHaveLength(0);
  });

  it('deletes profiles and cleans linked options through the top-level apply flow', async () => {
    const loadedOptions: Options = {
      ...optionsFixture(),
      '+auto': {
        defaultProfileName: '__ruleListOf_auto',
        name: 'auto',
        profileType: 'SwitchProfile',
        rules: []
      },
      '+__ruleListOf_auto': {
        defaultProfileName: 'direct',
        format: 'AutoProxy',
        name: '__ruleListOf_auto',
        profileType: 'RuleListProfile',
        ruleList: '||example.com'
      },
      '-profileScopeAssignments': {
        containers: {
          'firefox-container-1': 'auto',
          'firefox-container-2': 'proxy'
        },
        normalDefaultProfileName: 'auto',
        privateDefaultProfileName: 'proxy'
      },
      '-quickSwitchProfiles': ['direct', 'auto', 'proxy'],
      '-startupProfileName': 'auto'
    };
    const {requests} = installBackground({
      options: loadedOptions
    });
    window.location.hash = '#/profile/auto';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: auto/});
    fireEvent.click(screen.getByRole('button', {name: 'Delete Profile'}));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', {name: 'Delete Profile'})).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', {name: 'Delete Profile'}));

    await screen.findByRole('heading', {name: 'Interface'});
    expect(window.onbeforeunload?.({} as BeforeUnloadEvent)).toBe('Options are not saved.');

    fireEvent.click(screen.getByRole('button', {name: 'Apply changes'}));

    await waitFor(() => expect(window.onbeforeunload).toBeNull());
    const patch = firstPatch(requests);
    expect(deletedPatchValue(patch, '+auto')).toMatchObject({
      name: 'auto',
      profileType: 'SwitchProfile'
    });
    expect(deletedPatchValue(patch, '+__ruleListOf_auto')).toMatchObject({
      name: '__ruleListOf_auto',
      profileType: 'RuleListProfile'
    });
    expect(optionPatchValue<string>(patch, '-startupProfileName')).toBe('');
    expect(optionPatchValue<string[]>(patch, '-quickSwitchProfiles')).toEqual(['direct', 'proxy']);
    expect(optionPatchValue<Record<string, unknown>>(patch, '-profileScopeAssignments')).toEqual({
      containers: {
        'firefox-container-2': 'proxy'
      },
      privateDefaultProfileName: 'proxy'
    });
    expect(getAllRequests(requests)).toHaveLength(1);
  });

  it('shows referring profiles instead of deleting referenced profiles', async () => {
    (globalThis as any).ProxyEngine.Profiles.referencedBySet = () => ({
      '+auto': 'auto'
    });
    const {requests} = installBackground();
    window.location.hash = '#/profile/proxy';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: proxy/});
    fireEvent.click(screen.getByRole('button', {name: 'Delete Profile'}));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', {name: 'Unable to Delete Profile'})).toBeTruthy();
    expect(within(dialog).getByText('auto')).toBeTruthy();
    expect(within(dialog).queryByRole('button', {name: 'Delete Profile'})).toBeNull();
    expect(patchRequests(requests)).toHaveLength(0);
  });

  it('checks profile delete references against applied options after dirty edits', async () => {
    (globalThis as any).ProxyEngine.Profiles.referencedBySet = (profileName: string, sourceOptions: Options) => {
      const auto = sourceOptions['+auto'] as Record<string, unknown> | undefined;
      return profileName === 'proxy' && auto?.defaultProfileName === 'proxy'
        ? {
            '+auto': 'auto'
          }
        : {};
    };
    const baseOptions = optionsFixture();
    const loadedOptions: Options = {
      ...baseOptions,
      '+auto': {
        ...(baseOptions['+auto'] as Record<string, unknown>),
        defaultProfileName: 'direct'
      }
    };
    const patchedOptions: Options = {
      ...loadedOptions,
      '+auto': {
        ...(loadedOptions['+auto'] as Record<string, unknown>),
        defaultProfileName: 'proxy'
      },
      '+proxy': {
        ...(loadedOptions['+proxy'] as Record<string, unknown>),
        color: '#99dd99'
      }
    };
    const {requests} = installBackground({
      options: loadedOptions,
      patchedOptions
    });
    window.location.hash = '#/profile/proxy';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: proxy/});
    fireEvent.change(document.querySelector('input[type="color"]') as HTMLInputElement, {
      target: {
        value: '#99dd99'
      }
    });
    fireEvent.click(screen.getByRole('button', {name: 'Delete Profile'}));

    let dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', {name: 'Apply Options'})).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', {name: 'Apply changes'}));

    await waitFor(() => {
      dialog = screen.getByRole('dialog');
      expect(within(dialog).getByRole('heading', {name: 'Unable to Delete Profile'})).toBeTruthy();
    });
    expect(within(dialog).getByText('auto')).toBeTruthy();
    expect(within(dialog).queryByRole('button', {name: 'Delete Profile'})).toBeNull();
    expect(profilePatchValue(firstPatch(requests), '+proxy')).toMatchObject({
      color: '#99dd99'
    });
  });

  it('checks profile delete references after applying open switch source drafts', async () => {
    (globalThis as any).ProxyEngine.Profiles.referencedBySet = (profileName: string, sourceOptions: Options) => {
      const auto = sourceOptions['+auto'] as Record<string, unknown> | undefined;
      return profileName === 'proxy' && auto?.defaultProfileName === 'proxy'
        ? {
            '+auto': 'auto'
          }
        : {};
    };
    const loadedOptions: Options = {
      ...optionsFixture(),
      '+auto': {
        defaultProfileName: 'direct',
        name: 'auto',
        profileType: 'SwitchProfile',
        rules: []
      }
    };
    const {requests} = installBackground({
      options: loadedOptions
    });
    window.location.hash = '#/profile/auto';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: auto/});
    editSwitchSourceDraft('default:proxy');
    fireEvent.click(screen.getByRole('link', {name: /proxy/}));
    await applySourceDraftDialog();
    await screen.findByRole('heading', {name: /Profile :: proxy/});
    fireEvent.click(screen.getByRole('button', {name: 'Delete Profile'}));

    let dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', {name: 'Apply Options'})).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', {name: 'Apply changes'}));

    await waitFor(() => {
      dialog = screen.getByRole('dialog');
      expect(within(dialog).getByRole('heading', {name: 'Unable to Delete Profile'})).toBeTruthy();
    });
    expect(within(dialog).getByText('auto')).toBeTruthy();
    expect(within(dialog).queryByRole('button', {name: 'Delete Profile'})).toBeNull();
    expect(profilePatchValue(firstPatch(requests), '+auto')).toMatchObject({
      defaultProfileName: 'proxy'
    });
  });

  it('keeps switch source parse errors from opening profile delete actions', async () => {
    const loadedOptions: Options = {
      ...optionsFixture(),
      '+auto': {
        defaultProfileName: 'direct',
        name: 'auto',
        profileType: 'SwitchProfile',
        rules: []
      }
    };
    const {requests} = installBackground({
      options: loadedOptions
    });
    window.location.hash = '#/profile/auto';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: auto/});
    editSwitchSourceDraft('default:missing');
    fireEvent.click(screen.getByRole('button', {name: 'Delete Profile'}));

    await applySourceDraftDialog();

    expect(await screen.findByText('Unknown profile: missing')).toBeTruthy();
    expect(sourceEditor()).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(patchRequests(requests)).toHaveLength(0);
  });

  it('cancels profile actions from pending switch source drafts', async () => {
    const loadedOptions: Options = {
      ...optionsFixture(),
      '+auto': {
        defaultProfileName: 'direct',
        name: 'auto',
        profileType: 'SwitchProfile',
        rules: []
      }
    };
    const {requests} = installBackground({
      options: loadedOptions
    });
    window.location.hash = '#/profile/auto';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: auto/});
    editSwitchSourceDraft('default:proxy');
    fireEvent.click(screen.getByRole('button', {name: 'Delete Profile'}));

    const dialog = await sourceDraftDialog();
    fireEvent.click(within(dialog).getByRole('button', {name: 'Cancel'}));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(sourceEditor()).toBeTruthy();
    expect(patchRequests(requests)).toHaveLength(0);
  });

  it('discards pending switch source drafts before continuing profile actions', async () => {
    const loadedOptions: Options = {
      ...optionsFixture(),
      '+auto': {
        defaultProfileName: 'direct',
        name: 'auto',
        profileType: 'SwitchProfile',
        rules: []
      }
    };
    const {requests} = installBackground({
      options: loadedOptions
    });
    window.location.hash = '#/profile/auto';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: auto/});
    editSwitchSourceDraft('default:proxy');
    fireEvent.click(screen.getByRole('button', {name: 'Delete Profile'}));

    let dialog = await sourceDraftDialog();
    fireEvent.click(within(dialog).getByRole('button', {name: 'Discard Source'}));

    dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', {name: 'Delete Profile'})).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', {name: 'Delete Profile'}));

    await screen.findByRole('heading', {name: 'Interface'});
    fireEvent.click(screen.getByRole('button', {name: 'Apply changes'}));

    await waitFor(() => expect(window.onbeforeunload).toBeNull());
    expect(deletedPatchValue(firstPatch(requests), '+auto')).toMatchObject({
      defaultProfileName: 'direct',
      name: 'auto',
      profileType: 'SwitchProfile',
      rules: []
    });
  });

  it('applies dirty option edits before opening new and duplicate profile actions', async () => {
    const loadedOptions = optionsFixture();
    const {requests} = installBackground({
      options: loadedOptions
    });
    window.location.hash = '#/ui';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: 'Interface'});
    fireEvent.click(screen.getByLabelText('Confirm before deleting profiles and rules.'));
    fireEvent.click(screen.getByRole('button', {name: 'New profile'}));

    let dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', {name: 'Apply Options'})).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', {name: 'Apply changes'}));

    dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', {name: 'New Profile'})).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText('Profile name'), {
      target: {
        value: 'proxycopy'
      }
    });
    fireEvent.click(within(dialog).getByRole('radio', {name: /Duplicate/}));
    selectModalProfile(dialog, 'Profile', 'proxy');
    fireEvent.click(within(dialog).getByRole('button', {name: 'Create'}));

    await screen.findByRole('heading', {name: /Profile :: proxycopy/});
    expect(firstPatch(requests)).toEqual({
      '-confirmDeletion': [true, false]
    });
  });

  it('applies open switch source drafts before duplicating profiles from applied options', async () => {
    const loadedOptions: Options = {
      ...optionsFixture(),
      '+auto': {
        defaultProfileName: 'direct',
        name: 'auto',
        profileType: 'SwitchProfile',
        rules: []
      }
    };
    const {requests} = installBackground({
      options: loadedOptions
    });
    window.location.hash = '#/profile/auto';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: auto/});
    editSwitchSourceDraft('proxy:HostWildcardCondition:*.example.com\ndefault:virtual');
    fireEvent.click(screen.getByRole('button', {name: 'New profile'}));

    await applySourceDraftDialog();
    let dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', {name: 'Apply Options'})).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', {name: 'Apply changes'}));

    dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', {name: 'New Profile'})).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText('Profile name'), {
      target: {
        value: 'autocopy'
      }
    });
    fireEvent.click(within(dialog).getByRole('radio', {name: /Duplicate/}));
    selectModalProfile(dialog, 'Profile', 'auto');
    fireEvent.click(within(dialog).getByRole('button', {name: 'Create'}));

    await screen.findByRole('heading', {name: /Profile :: autocopy/});
    fireEvent.click(screen.getByRole('button', {name: 'Apply changes'}));

    await waitFor(() => expect(window.onbeforeunload).toBeNull());
    const patches = patchRequests(requests);
    expect(profilePatchValue(patches[0]?.args?.[0] as Record<string, unknown> | undefined, '+auto')).toMatchObject({
      defaultProfileName: 'virtual',
      rules: [
        {
          condition: {
            conditionType: 'HostWildcardCondition',
            pattern: '*.example.com'
          },
          profileName: 'proxy'
        }
      ]
    });
    expect(addedPatchValue(patches[1]?.args?.[0] as Record<string, unknown> | undefined, '+autocopy')).toMatchObject({
      defaultProfileName: 'virtual',
      name: 'autocopy',
      profileType: 'SwitchProfile',
      rules: [
        {
          condition: {
            conditionType: 'HostWildcardCondition',
            pattern: '*.example.com'
          },
          profileName: 'proxy'
        }
      ]
    });
  });

  it('applies dirty profile edits before opening profile delete actions', async () => {
    const loadedOptions = optionsFixture();
    const pacScript = 'function FindProxyForURL() { return "PROXY 127.0.0.1:8080"; }';
    const {requests} = installBackground({
      options: loadedOptions
    });
    window.location.hash = '#/profile/pac';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: pac/});
    fireEvent.change(document.querySelector('textarea') as HTMLTextAreaElement, {
      target: {
        value: pacScript
      }
    });
    fireEvent.click(screen.getByRole('button', {name: 'Delete Profile'}));

    let dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', {name: 'Apply Options'})).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', {name: 'Apply changes'}));

    dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', {name: 'Delete Profile'})).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', {name: 'Delete Profile'}));

    await screen.findByRole('heading', {name: 'Interface'});
    fireEvent.click(screen.getByRole('button', {name: 'Apply changes'}));

    await waitFor(() => expect(window.onbeforeunload).toBeNull());
    const patches = patchRequests(requests);
    expect(profilePatchValue(patches[0]?.args?.[0] as Record<string, unknown> | undefined, '+pac')).toMatchObject({
      pacScript
    });
    expect(deletedPatchValue(patches[1]?.args?.[0] as Record<string, unknown> | undefined, '+pac')).toMatchObject({
      name: 'pac',
      pacScript,
      profileType: 'PacProfile'
    });
  });

  it('resets all options from the about maintenance flow', async () => {
    const loadedOptions = optionsFixture();
    const resetOptions = {
      ...optionsFixture(),
      '-confirmDeletion': false
    };
    const {requests} = installBackground({
      options: loadedOptions,
      resetOptions
    });
    window.location.hash = '#/about';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: 'About'});

    fireEvent.click(screen.getByRole('button', {name: 'Reset'}));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', {name: 'Reset Options'})).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', {name: 'Reset'}));

    await waitFor(() =>
      expect(requests).toContainEqual({
        args: [undefined],
        method: 'reset'
      })
    );
    await waitFor(() => expect(screen.getByText('options_resetSuccess')).toBeTruthy());
    expect(window.location.hash).toBe('#/about');
  });

  it('replaces dirty options from the about reset flow without reloading all options', async () => {
    const loadedOptions = optionsFixture();
    const resetOptions = {
      ...optionsFixture(),
      '+reset': {
        name: 'reset',
        profileType: 'FixedProfile'
      },
      '-confirmDeletion': true
    };
    delete (resetOptions as Record<string, unknown>)['+proxy'];
    const {requests} = installBackground({
      options: loadedOptions,
      resetOptions
    });
    window.location.hash = '#/ui';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: 'Interface'});
    fireEvent.click(screen.getByLabelText('Confirm before deleting profiles and rules.'));
    expect(window.onbeforeunload?.({} as BeforeUnloadEvent)).toBe('Options are not saved.');

    fireEvent.click(screen.getByRole('link', {name: 'SwitchyAgain'}));
    await screen.findByRole('heading', {name: 'About'});
    fireEvent.click(screen.getByRole('button', {name: 'Reset'}));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', {name: 'Reset'}));

    await waitFor(() =>
      expect(requests).toContainEqual({
        args: [undefined],
        method: 'reset'
      })
    );
    await waitFor(() => expect(window.onbeforeunload).toBeNull());
    expect(screen.queryByRole('link', {name: /proxy/})).toBeNull();
    expect(screen.getByRole('link', {name: /reset/})).toBeTruthy();
    expect(getAllRequests(requests)).toHaveLength(1);
    expect(patchRequests(requests)).toHaveLength(0);
  });

  it('restores online backups through the embedded import export page without reloading all options', async () => {
    const loadedOptions = optionsFixture();
    const resetOptions = {
      ...optionsFixture(),
      '+restored': {
        name: 'restored',
        profileType: 'FixedProfile'
      },
      '-confirmDeletion': true
    };
    delete (resetOptions as Record<string, unknown>)['+proxy'];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('backup-content')
    });
    vi.stubGlobal('fetch', fetchMock);
    const {requests} = installBackground({
      options: loadedOptions,
      resetOptions
    });
    window.location.hash = '#/ui';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: 'Interface'});
    fireEvent.click(screen.getByLabelText('Confirm before deleting profiles and rules.'));
    expect(window.onbeforeunload?.({} as BeforeUnloadEvent)).toBe('Options are not saved.');

    fireEvent.click(screen.getByRole('link', {name: 'Import/Export'}));
    await screen.findByRole('heading', {name: 'Import/Export'});
    fireEvent.change(screen.getByLabelText('Restore from online'), {
      target: {
        value: 'https://example.com/options.bak'
      }
    });
    fireEvent.click(screen.getByRole('button', {name: 'Restore'}));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('https://example.com/options.bak', expect.any(Object)));
    await waitFor(() =>
      expect(requests).toContainEqual({
        args: ['backup-content'],
        method: 'reset'
      })
    );
    await waitFor(() => expect(window.onbeforeunload).toBeNull());
    expect(screen.queryByRole('link', {name: /proxy/})).toBeNull();
    expect(screen.getByRole('link', {name: /restored/})).toBeTruthy();
    expect(screen.getByText('options_importSuccess')).toBeTruthy();
    expect(getAllRequests(requests)).toHaveLength(1);
    expect(patchRequests(requests)).toHaveLength(0);
  });

  it('applies dirty embedded options before exporting a full backup', async () => {
    const loadedOptions = optionsFixture();
    const {anchorClicks, createObjectURL} = stubDownloads();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const {requests} = installBackground({
      options: loadedOptions
    });
    window.location.hash = '#/ui';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: 'Interface'});
    fireEvent.click(screen.getByLabelText('Confirm before deleting profiles and rules.'));
    fireEvent.click(screen.getByRole('link', {name: 'Import/Export'}));
    await screen.findByRole('heading', {name: 'Import/Export'});

    fireEvent.click(screen.getByRole('button', {name: /Make backup/}));

    await waitFor(() => expect(anchorClicks).toHaveLength(1));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Your changes to the options must be applied before you proceed.'));
    expect(patchRequests(requests)).toHaveLength(1);
    expect(firstPatch(requests)).toEqual({
      '-confirmDeletion': [true, false]
    });
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(anchorClicks[0]).toMatchObject({
      download: 'OmegaOptions.bak'
    });
    await waitFor(() => expect(window.onbeforeunload).toBeNull());
    expect(getAllRequests(requests)).toHaveLength(1);
  });

  it('applies open switch source drafts before exporting full backups from applied options', async () => {
    const loadedOptions: Options = {
      ...optionsFixture(),
      '+auto': {
        defaultProfileName: 'direct',
        name: 'auto',
        profileType: 'SwitchProfile',
        rules: []
      }
    };
    const patchedOptions: Options = {
      ...loadedOptions,
      '+auto': {
        ...(loadedOptions['+auto'] as Record<string, unknown>),
        defaultProfileName: 'virtual',
        rules: [
          {
            condition: {
              conditionType: 'HostWildcardCondition',
              pattern: '*.example.com'
            },
            profileName: 'proxy'
          }
        ]
      }
    };
    const {anchorClicks, createObjectURL} = stubDownloads();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const {requests} = installBackground({
      options: loadedOptions,
      patchedOptions
    });
    window.location.hash = '#/profile/auto';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: auto/});
    fireEvent.click(screen.getByRole('button', {name: 'Edit Source'}));
    fireEvent.change(sourceEditor(), {
      target: {
        value: switchSource('proxy:HostWildcardCondition:*.example.com\ndefault:virtual')
      }
    });
    fireEvent.click(screen.getByRole('link', {name: 'Import/Export'}));
    await applySourceDraftDialog();
    await screen.findByRole('heading', {name: 'Import/Export'});

    fireEvent.click(screen.getByRole('button', {name: /Make backup/}));

    await waitFor(() => expect(anchorClicks).toHaveLength(1));
    const backup = JSON.parse(await (createObjectURL.mock.calls[0]?.[0] as Blob).text()) as Options;
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Your changes to the options must be applied before you proceed.'));
    expect(profilePatchValue(firstPatch(requests), '+auto')).toMatchObject({
      defaultProfileName: 'virtual',
      rules: [
        {
          condition: {
            conditionType: 'HostWildcardCondition',
            pattern: '*.example.com'
          },
          profileName: 'proxy'
        }
      ]
    });
    expect(backup['+auto']).toMatchObject({
      defaultProfileName: 'virtual',
      rules: [
        {
          condition: {
            conditionType: 'HostWildcardCondition',
            pattern: '*.example.com'
          },
          profileName: 'proxy'
        }
      ]
    });
    expect(anchorClicks[0]).toMatchObject({
      download: 'OmegaOptions.bak'
    });
    await waitFor(() => expect(window.onbeforeunload).toBeNull());
    expect(getAllRequests(requests)).toHaveLength(1);
  });

  it('applies dirty embedded options before saving legacy rule list export preference', async () => {
    const loadedOptions = optionsFixture();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const {requests} = installBackground({
      options: loadedOptions
    });
    window.location.hash = '#/ui';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: 'Interface'});
    fireEvent.click(screen.getByLabelText('Confirm before deleting profiles and rules.'));
    fireEvent.click(screen.getByRole('link', {name: 'Import/Export'}));
    await screen.findByRole('heading', {name: 'Import/Export'});

    fireEvent.click(screen.getByLabelText('Export legacy rule lists'));

    await waitFor(() => expect(patchRequests(requests)).toHaveLength(2));
    const patches = patchRequests(requests);
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Your changes to the options must be applied before you proceed.'));
    expect(patches[0]?.args?.[0]).toEqual({
      '-confirmDeletion': [true, false]
    });
    expect(patches[1]?.args?.[0]).toEqual({
      '-exportLegacyRuleList': [undefined, true]
    });
    await waitFor(() => expect(window.onbeforeunload).toBeNull());
    expect(getAllRequests(requests)).toHaveLength(1);
  });

  it('applies dirty embedded options before resetting synced options', async () => {
    localStorage.setItem('omega.local.syncOptions', JSON.stringify('conflict'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const loadedOptions = optionsFixture();
    const {requests} = installBackground({
      options: loadedOptions
    });
    window.location.hash = '#/ui';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: 'Interface'});
    fireEvent.click(screen.getByLabelText('Confirm before deleting profiles and rules.'));
    fireEvent.click(screen.getByRole('link', {name: 'Import/Export'}));
    await screen.findByRole('heading', {name: 'Import/Export'});

    fireEvent.click(screen.getByRole('button', {name: 'Reset sync'}));

    await waitFor(() =>
      expect(requests).toContainEqual({
        args: [],
        method: 'resetOptionsSync'
      })
    );
    await waitFor(() => expect(patchRequests(requests)).toHaveLength(1));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Your changes to the options must be applied before you proceed.'));
    expect(firstPatch(requests)).toEqual({
      '-confirmDeletion': [true, false]
    });
    await waitFor(() => expect(window.onbeforeunload).toBeNull());
    const methods = requestMethods(requests);
    expect(methods.indexOf('patch')).toBeLessThan(methods.indexOf('resetOptionsSync'));
    expect(getAllRequests(requests)).toHaveLength(1);
  });

  it('applies dirty PAC profile edits before exporting PAC from applied options', async () => {
    const baseOptions = optionsFixture();
    const loadedOptions: Options = {
      ...baseOptions,
      '+pac': {
        ...(baseOptions['+pac'] as Record<string, unknown>),
        pacScript: 'saved-pac-script'
      }
    };
    const draftPacScript = 'draft-pac-script';
    const appliedPacScript = 'applied-pac-script';
    const patchedOptions: Options = {
      ...loadedOptions,
      '+pac': {
        ...(loadedOptions['+pac'] as Record<string, unknown>),
        pacScript: appliedPacScript
      }
    };
    const {anchorClicks, createObjectURL} = stubDownloads();
    const {requests} = installBackground({
      options: loadedOptions,
      patchedOptions
    });
    window.location.hash = '#/profile/pac';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: pac/});
    fireEvent.change(document.querySelector('textarea') as HTMLTextAreaElement, {
      target: {
        value: draftPacScript
      }
    });
    fireEvent.click(screen.getByRole('button', {name: 'Export PAC'}));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', {name: 'Apply Options'})).toBeTruthy();
    expect(anchorClicks).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole('button', {name: 'Apply changes'}));

    await waitFor(() => expect(anchorClicks).toHaveLength(1));
    const text = await (createObjectURL.mock.calls[0]?.[0] as Blob).text();
    expect(text).toContain(appliedPacScript);
    expect(text).not.toContain(draftPacScript);
    expect(anchorClicks[0]).toMatchObject({
      download: 'OmegaProfile_pac.pac'
    });
    expect(profilePatchValue(firstPatch(requests), '+pac')).toMatchObject({
      pacScript: draftPacScript
    });
    await waitFor(() => expect(window.onbeforeunload).toBeNull());
    expect(getAllRequests(requests)).toHaveLength(1);
  });

  it('applies dirty switch profile edits before exporting Omega rule lists from applied options', async () => {
    const loadedOptions: Options = {
      ...optionsFixture(),
      '+auto': {
        defaultProfileName: 'direct',
        name: 'auto',
        profileType: 'SwitchProfile',
        rules: [
          {
            condition: {
              conditionType: 'HostWildcardCondition',
              pattern: '*.example.com'
            },
            profileName: 'proxy'
          }
        ]
      }
    };
    const patchedOptions: Options = {
      ...loadedOptions,
      '+auto': {
        ...(loadedOptions['+auto'] as Record<string, unknown>),
        defaultProfileName: 'virtual'
      }
    };
    const {anchorClicks, createObjectURL} = stubDownloads();
    const {requests} = installBackground({
      options: loadedOptions,
      patchedOptions
    });
    window.location.hash = '#/profile/auto';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: auto/});
    changeTableProfileSelect(screen.getByRole('table'), 'Default Profile', 'proxy');
    fireEvent.click(screen.getByRole('button', {name: 'Export Rule List'}));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', {name: 'Apply Options'})).toBeTruthy();
    expect(anchorClicks).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole('button', {name: 'Apply changes'}));

    await waitFor(() => expect(anchorClicks).toHaveLength(1));
    const text = await (createObjectURL.mock.calls[0]?.[0] as Blob).text();
    expect(text).toContain('default:virtual');
    expect(text).not.toContain('default:proxy');
    expect(anchorClicks[0]).toMatchObject({
      download: 'OmegaRules_auto.sorl'
    });
    expect(profilePatchValue(firstPatch(requests), '+auto')).toMatchObject({
      defaultProfileName: 'proxy'
    });
    await waitFor(() => expect(window.onbeforeunload).toBeNull());
    expect(getAllRequests(requests)).toHaveLength(1);
  });

  it('applies open switch source drafts before exporting Omega rule lists from applied options', async () => {
    const loadedOptions: Options = {
      ...optionsFixture(),
      '+auto': {
        defaultProfileName: 'direct',
        name: 'auto',
        profileType: 'SwitchProfile',
        rules: []
      }
    };
    const patchedOptions: Options = {
      ...loadedOptions,
      '+auto': {
        ...(loadedOptions['+auto'] as Record<string, unknown>),
        defaultProfileName: 'virtual',
        rules: [
          {
            condition: {
              conditionType: 'HostWildcardCondition',
              pattern: '*.example.com'
            },
            profileName: 'proxy'
          }
        ]
      }
    };
    const {anchorClicks, createObjectURL} = stubDownloads();
    const {requests} = installBackground({
      options: loadedOptions,
      patchedOptions
    });
    window.location.hash = '#/profile/auto';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: auto/});
    fireEvent.click(screen.getByRole('button', {name: 'Edit Source'}));
    fireEvent.change(sourceEditor(), {
      target: {
        value: switchSource('proxy:HostWildcardCondition:*.example.com\ndefault:virtual')
      }
    });
    fireEvent.click(screen.getByRole('button', {name: 'Export Rule List'}));

    await applySourceDraftDialog();
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', {name: 'Apply Options'})).toBeTruthy();
    expect(anchorClicks).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole('button', {name: 'Apply changes'}));

    await waitFor(() => expect(anchorClicks).toHaveLength(1));
    const text = await (createObjectURL.mock.calls[0]?.[0] as Blob).text();
    expect(text).toContain('proxy:HostWildcardCondition:*.example.com');
    expect(text).toContain('default:virtual');
    expect(anchorClicks[0]).toMatchObject({
      download: 'OmegaRules_auto.sorl'
    });
    expect(profilePatchValue(firstPatch(requests), '+auto')).toMatchObject({
      defaultProfileName: 'virtual',
      rules: [
        {
          condition: {
            conditionType: 'HostWildcardCondition',
            pattern: '*.example.com'
          },
          profileName: 'proxy'
        }
      ]
    });
    await waitFor(() => expect(window.onbeforeunload).toBeNull());
    expect(getAllRequests(requests)).toHaveLength(1);
  });

  it('applies dirty switch profile edits before exporting legacy rule lists from applied options', async () => {
    const loadedOptions: Options = {
      ...optionsFixture(),
      '+auto': {
        defaultProfileName: 'direct',
        name: 'auto',
        profileType: 'SwitchProfile',
        rules: [
          {
            condition: {
              conditionType: 'HostWildcardCondition',
              pattern: '*.example.com'
            },
            profileName: 'virtual'
          }
        ]
      },
      '-exportLegacyRuleList': true
    };
    const patchedOptions: Options = {
      ...loadedOptions,
      '+auto': {
        ...(loadedOptions['+auto'] as Record<string, unknown>),
        defaultProfileName: 'virtual'
      }
    };
    const {anchorClicks, createObjectURL} = stubDownloads();
    const {requests} = installBackground({
      options: loadedOptions,
      patchedOptions
    });
    window.location.hash = '#/profile/auto';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: auto/});
    changeTableProfileSelect(screen.getByRole('table'), 'Default Profile', 'proxy');
    fireEvent.click(screen.getByRole('button', {name: 'Export Rule List'}));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', {name: 'Apply Options'})).toBeTruthy();
    expect(anchorClicks).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole('button', {name: 'Apply changes'}));

    await waitFor(() => expect(anchorClicks).toHaveLength(1));
    const text = await (createObjectURL.mock.calls[0]?.[0] as Blob).text();
    expect(text).toContain('!@*://*.example.com/*');
    expect(text).not.toContain('\n@*://*.example.com/*');
    expect(anchorClicks[0]).toMatchObject({
      download: 'SwitchyRules_auto.ssrl'
    });
    expect(profilePatchValue(firstPatch(requests), '+auto')).toMatchObject({
      defaultProfileName: 'proxy'
    });
    await waitFor(() => expect(window.onbeforeunload).toBeNull());
    expect(getAllRequests(requests)).toHaveLength(1);
  });

  it('shows missing profile errors when exported PAC generation references a missing profile', async () => {
    const baseOptions = optionsFixture();
    const loadedOptions: Options = {
      ...baseOptions,
      '+pac': {
        ...(baseOptions['+pac'] as Record<string, unknown>),
        defaultProfileName: 'missing-profile',
        pacScript: 'saved-pac-script'
      }
    };
    const {anchorClicks} = stubDownloads();
    installBackground({
      options: loadedOptions
    });
    window.location.hash = '#/profile/pac';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: pac/});
    fireEvent.click(screen.getByRole('button', {name: 'Export PAC'}));

    await waitFor(() => expect(anchorClicks).toHaveLength(1));
    expect(await screen.findByText(/Profile not found/)).toBeTruthy();
  });

  it('shows an error instead of exporting when a switch profile attached rule list is missing', async () => {
    const loadedOptions: Options = {
      ...optionsFixture(),
      '+auto': {
        defaultProfileName: '__ruleListOf_auto',
        name: 'auto',
        profileType: 'SwitchProfile',
        rules: []
      }
    };
    const {anchorClicks} = stubDownloads();
    const {requests} = installBackground({
      options: loadedOptions
    });
    window.location.hash = '#/profile/auto';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: auto/});
    fireEvent.click(screen.getByRole('button', {name: 'Export Rule List'}));

    expect(await screen.findByText(/Profile not found/)).toBeTruthy();
    expect(anchorClicks).toHaveLength(0);
    expect(patchRequests(requests)).toHaveLength(0);
  });

  it('renames profiles using the returned options without reloading all options', async () => {
    const loadedOptions = optionsFixture();
    const renamedOptions: Options = {
      ...loadedOptions,
      '+renamed': {
        ...(loadedOptions['+proxy'] as Record<string, unknown>),
        name: 'renamed'
      },
      '-quickSwitchProfiles': ['direct', 'renamed']
    };
    delete (renamedOptions as Record<string, unknown>)['+proxy'];
    const {requests} = installBackground({
      options: loadedOptions,
      renamedOptions
    });
    window.location.hash = '#/profile/proxy';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: proxy/});
    fireEvent.click(screen.getByRole('button', {name: 'Rename'}));

    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('New profile name'), {
      target: {
        value: 'renamed'
      }
    });
    fireEvent.click(within(dialog).getByRole('button', {name: 'Rename'}));

    await screen.findByRole('heading', {name: /Profile :: renamed/});
    expect(window.location.hash).toBe('#/profile/renamed');
    expect(requests).toContainEqual({
      args: ['proxy', 'renamed'],
      method: 'renameProfile'
    });
    expect(requests.filter((request) => (request as {method?: string}).method === 'getAll')).toHaveLength(1);
  });

  it('replaces profile references using the returned options without reloading all options', async () => {
    const loadedOptions = optionsFixture();
    const replacedOptions: Options = {
      ...loadedOptions,
      '+auto': {
        ...(loadedOptions['+auto'] as Record<string, unknown>),
        defaultProfileName: 'virtual'
      },
      '-quickSwitchProfiles': ['direct', 'virtual']
    };
    const {requests} = installBackground({
      options: loadedOptions,
      replacedOptions
    });
    window.location.hash = '#/profile/virtual';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: virtual/});
    fireEvent.click(screen.getByRole('button', {name: 'Replace target profile'}));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', {name: 'Replace Profile'})).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', {name: 'Replace Profile'}));

    await waitFor(() =>
      expect(requests).toContainEqual({
        args: ['proxy', 'virtual'],
        method: 'replaceRef'
      })
    );
    expect(requests.filter((request) => (request as {method?: string}).method === 'getAll')).toHaveLength(1);
  });

  it('applies open switch source drafts before opening replace profile actions', async () => {
    const loadedOptions: Options = {
      ...optionsFixture(),
      '+auto': {
        defaultProfileName: 'direct',
        name: 'auto',
        profileType: 'SwitchProfile',
        rules: []
      }
    };
    const {requests} = installBackground({
      options: loadedOptions
    });
    window.location.hash = '#/profile/auto';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: auto/});
    editSwitchSourceDraft('proxy:HostWildcardCondition:*.example.com\ndefault:virtual');
    fireEvent.click(screen.getByRole('link', {name: /virtual/}));
    await applySourceDraftDialog();
    await screen.findByRole('heading', {name: /Profile :: virtual/});
    fireEvent.click(screen.getByRole('button', {name: 'Replace target profile'}));

    let dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', {name: 'Apply Options'})).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', {name: 'Apply changes'}));

    dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', {name: 'Replace Profile'})).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', {name: 'Replace Profile'}));

    await waitFor(() =>
      expect(requests).toContainEqual({
        args: ['proxy', 'virtual'],
        method: 'replaceRef'
      })
    );
    const methods = requestMethods(requests);
    expect(methods.indexOf('replaceRef')).toBeGreaterThan(methods.indexOf('patch'));
    expect(profilePatchValue(firstPatch(requests), '+auto')).toMatchObject({
      defaultProfileName: 'virtual',
      rules: [
        {
          condition: {
            conditionType: 'HostWildcardCondition',
            pattern: '*.example.com'
          },
          profileName: 'proxy'
        }
      ]
    });
  });

  it('discards proxy authentication modal edits without dirtying options', async () => {
    const baseOptions = optionsFixture();
    const loadedOptions: Options = {
      ...baseOptions,
      '+pac': {
        ...(baseOptions['+pac'] as Record<string, unknown>),
        auth: {
          all: {
            password: 'saved-pass',
            username: 'saved-user'
          }
        }
      }
    };
    const {requests} = installBackground({
      options: loadedOptions
    });
    window.location.hash = '#/profile/pac';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: pac/});
    fireEvent.click(screen.getByTitle('Proxy Authentication'));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', {name: 'Proxy Authentication'})).toBeTruthy();
    fireEvent.change(within(dialog).getByPlaceholderText('Username'), {
      target: {
        value: 'next-user'
      }
    });
    fireEvent.change(within(dialog).getByPlaceholderText('Password'), {
      target: {
        value: 'next-pass'
      }
    });
    fireEvent.click(within(dialog).getByRole('button', {name: 'Cancel'}));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(window.onbeforeunload).toBeNull();
    expect(patchRequests(requests)).toHaveLength(0);
    expect(getAllRequests(requests)).toHaveLength(1);
  });

  it('saves proxy authentication edits through the top-level apply flow', async () => {
    const loadedOptions = optionsFixture();
    const patchedOptions: Options = {
      ...loadedOptions,
      '+pac': {
        ...(loadedOptions['+pac'] as Record<string, unknown>),
        auth: {
          all: {
            password: 'next-pass',
            username: 'next-user'
          }
        }
      }
    };
    const {requests} = installBackground({
      options: loadedOptions,
      patchedOptions
    });
    window.location.hash = '#/profile/pac';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: pac/});
    fireEvent.click(screen.getByTitle('Proxy Authentication'));

    let dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', {name: 'Proxy Authentication'})).toBeTruthy();
    fireEvent.change(within(dialog).getByPlaceholderText('Username'), {
      target: {
        value: 'next-user'
      }
    });
    fireEvent.change(within(dialog).getByPlaceholderText('Password'), {
      target: {
        value: 'next-pass'
      }
    });
    fireEvent.click(within(dialog).getByRole('button', {name: 'Save'}));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(window.onbeforeunload?.({} as BeforeUnloadEvent)).toBe('Options are not saved.'));

    fireEvent.click(screen.getByRole('button', {name: 'Apply changes'}));

    await waitFor(() => expect(window.onbeforeunload).toBeNull());
    expect(profilePatchValue(firstPatch(requests), '+pac')).toMatchObject({
      auth: {
        all: {
          password: 'next-pass',
          username: 'next-user'
        }
      }
    });
    expect(getAllRequests(requests)).toHaveLength(1);
  });

  it('downloads profile updates with only the required options reload', async () => {
    const loadedOptions = optionsFixture();
    const updatedOptions: Options = {
      ...loadedOptions,
      '+rulelist': {
        ...(loadedOptions['+rulelist'] as Record<string, unknown>),
        lastUpdate: '2026-06-19T00:00:00.000Z',
        ruleList: '||example.com'
      }
    };
    const {requests} = installBackground({
      options: loadedOptions,
      updateProfileOptions: updatedOptions,
      updateProfileResults: {
        '+rulelist': updatedOptions['+rulelist']
      }
    });
    window.location.hash = '#/profile/rulelist';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: /Profile :: rulelist/});
    fireEvent.click(screen.getByRole('button', {name: 'Download Profile Now'}));

    await waitFor(() =>
      expect(requests).toContainEqual({
        args: ['rulelist', 'bypass_cache'],
        method: 'updateProfile'
      })
    );
    await waitFor(() => expect(screen.getByText('options_profileDownloadSuccess')).toBeTruthy());
    expect(requests.filter((request) => (request as {method?: string}).method === 'getAll')).toHaveLength(2);
  });
});
