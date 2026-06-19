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

function installOmegaPacMock() {
  (globalThis as any).OmegaPac = {
    Conditions: {
      getWeekdayList() {
        return [];
      }
    },
    Profiles: {
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
    '-showInspectMenu': true,
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
        }
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
      currentOptions = renamedOptions || currentOptions;
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
  window.location.hash = '';
  window.onbeforeunload = null;
  delete (globalThis as any).OmegaPac;
});

beforeEach(() => {
  installOmegaPacMock();
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

  it('enables profile scope settings through the top-level apply flow', async () => {
    const loadedOptions = optionsFixture();
    const {requests} = installBackground({
      options: loadedOptions,
      profileScopeCapabilities: {
        container: true,
        tab: true,
        window: true
      }
    });
    window.location.hash = '#/ui';

    render(<OptionsApp />);

    await screen.findByRole('heading', {name: 'Interface'});
    fireEvent.click(screen.getByLabelText('Tab profiles'));
    fireEvent.click(screen.getByLabelText('Container profiles'));
    fireEvent.click(screen.getByLabelText('Normal/private defaults'));
    await waitFor(() => expect(window.onbeforeunload?.({} as BeforeUnloadEvent)).toBe('Options are not saved.'));

    fireEvent.click(screen.getByRole('button', {name: 'Apply changes'}));

    await waitFor(() => expect(window.onbeforeunload).toBeNull());
    expect(patchedOptionValue<Record<string, boolean>>(firstPatch(requests), '-profileScopes')).toEqual({
      container: true,
      tab: true,
      window: true
    });
    expect(getAllRequests(requests)).toHaveLength(1);
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
    (globalThis as any).OmegaPac.Profiles.referencedBySet = () => ({
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
