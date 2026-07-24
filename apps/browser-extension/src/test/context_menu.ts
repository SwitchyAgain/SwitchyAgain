import assert from 'node:assert/strict';
import {afterEach, describe, it, vi} from 'vitest';

type PendingRemoval = {
  callback?: () => void;
  id: string;
};

function createEvent() {
  return {
    addListener: vi.fn(),
    removeListener: vi.fn()
  };
}

function createChrome() {
  const runtime = {
    id: 'test-extension',
    lastError: undefined as ChromeLastError | undefined,
    onConnect: createEvent(),
    onMessage: createEvent(),
    getManifest: () => ({version: '0.0.1'}),
    getURL: (path: string) => `chrome-extension://test/${path}`,
    reload: vi.fn(),
    sendMessage: vi.fn()
  };
  const contextMenus = {
    create: vi.fn(),
    onClicked: createEvent(),
    onShown: createEvent(),
    refresh: vi.fn(),
    remove: vi.fn(),
    removeAll: vi.fn(),
    update: vi.fn()
  };
  return {
    action: {
      onClicked: createEvent(),
      setBadgeBackgroundColor: vi.fn(),
      setBadgeText: vi.fn(),
      setTitle: vi.fn()
    },
    contextMenus,
    i18n: {
      getMessage: vi.fn((key: string) => key),
      getUILanguage: vi.fn(() => 'en')
    },
    runtime,
    tabs: {
      onActivated: createEvent(),
      onCreated: createEvent(),
      onRemoved: createEvent(),
      onUpdated: createEvent(),
      query: vi.fn(),
      get: vi.fn()
    }
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('context menu initialization', () => {
  it('waits for removal before creating the baseline item and shares initialization', async () => {
    vi.resetModules();
    const chromeApi = createChrome();
    const removeAllCallbacks: Array<() => void> = [];
    chromeApi.contextMenus.removeAll.mockImplementation((callback?: () => void) => {
      if (callback) {
        removeAllCallbacks.push(callback);
      }
    });
    chromeApi.contextMenus.create.mockImplementation((_properties: Record<string, unknown>, callback?: () => void) => {
      callback?.();
    });
    vi.stubGlobal('chrome', chromeApi);

    const {initializeBackgroundContextMenu} = await import('../module/context_menu');
    const first = initializeBackgroundContextMenu();
    const second = initializeBackgroundContextMenu();

    assert.strictEqual(first, second);
    assert.equal(chromeApi.contextMenus.removeAll.mock.calls.length, 1);
    assert.equal(chromeApi.contextMenus.create.mock.calls.length, 0);
    assert.equal(removeAllCallbacks.length, 1);

    removeAllCallbacks[0]();
    await first;

    assert.equal(chromeApi.contextMenus.create.mock.calls.length, 1);
    assert.equal(chromeApi.contextMenus.create.mock.calls[0][0].id, 'enableQuickSwitch');
  });
});

describe('context menu refresh queue', () => {
  it('serializes refreshes and runs only the newest pending task', async () => {
    vi.resetModules();
    const {ContextMenuRefreshQueue} = await import('../module/context_menu');
    const queue = new ContextMenuRefreshQueue();
    const events: string[] = [];
    let releaseFirst!: () => void;

    const first = queue.request(
      () =>
        new Promise<void>((resolve) => {
          events.push('first:start');
          releaseFirst = () => {
            events.push('first:end');
            resolve();
          };
        })
    );
    const secondTask = vi.fn(() => {
      events.push('second');
    });
    const thirdTask = vi.fn(() => {
      events.push('third');
    });
    const second = queue.request(secondTask);
    const third = queue.request(thirdTask);

    assert.strictEqual(first, second);
    assert.strictEqual(second, third);
    assert.deepEqual(events, ['first:start']);

    releaseFirst();
    await first;

    assert.deepEqual(events, ['first:start', 'first:end', 'third']);
    assert.equal(secondTask.mock.calls.length, 0);
    assert.equal(thirdTask.mock.calls.length, 1);
  });
});

describe('profile switch context menu refreshes', () => {
  it('does not create duplicate IDs when refreshes overlap', async () => {
    vi.resetModules();
    const chromeApi = createChrome();
    const activeIds = new Set(['switchProfile']);
    const pendingRemovals: PendingRemoval[] = [];
    const createIds: string[] = [];
    const duplicateIds: string[] = [];

    chromeApi.contextMenus.create.mockImplementation((properties: Record<string, unknown>, callback?: () => void) => {
      const id = String(properties.id);
      createIds.push(id);
      if (activeIds.has(id)) {
        duplicateIds.push(id);
        chromeApi.runtime.lastError = {message: `duplicate id ${id}`};
      } else {
        activeIds.add(id);
        chromeApi.runtime.lastError = undefined;
      }
      callback?.();
      chromeApi.runtime.lastError = undefined;
    });
    chromeApi.contextMenus.remove.mockImplementation((id: string, callback?: () => void) => {
      pendingRemovals.push({callback, id});
    });
    vi.stubGlobal('chrome', chromeApi);

    const [{default: ChromeOptions}, {ContextMenuRefreshQueue}] = await Promise.all([
      import('../module/options'),
      import('../module/context_menu')
    ]);
    const options = Object.create(ChromeOptions.prototype) as Record<string, any>;
    options._currentProfileName = 'proxy';
    options._linkProfileContextMenuClickReady = true;
    options._options = {
      '-contextMenuOptions': {switchProfile: true},
      '-profileGroups': [],
      '-profileGroupsEnabled': false,
      '+proxy': {
        color: '#99ccee',
        name: 'proxy',
        profileType: 'FixedProfile'
      }
    };
    options._switchProfileContextMenuIds = ['switchProfile'];
    options._switchProfileContextMenuProfiles = {};
    options._switchProfileContextMenuRefreshQueue = new ContextMenuRefreshQueue();
    options._switchProfileContextMenuRefreshToken = 0;
    options.log = {
      error: vi.fn(),
      log: vi.fn()
    };
    options.proxyImpl = {features: []};

    const first = options.updateSwitchProfileContextMenu();
    const second = options.updateSwitchProfileContextMenu();

    assert.equal(pendingRemovals.length, 1);
    assert.equal(createIds.length, 0);

    const removal = pendingRemovals[0];
    activeIds.delete(removal.id);
    removal.callback?.();
    await Promise.all([first, second]);

    assert.deepEqual(duplicateIds, []);
    assert.equal(createIds.filter((id) => id === 'switchProfile').length, 1);
    assert.equal(new Set(createIds).size, createIds.length);
  });
});
