import {
  assertExtensionBuild,
  defaultOptions,
  expectSelector,
  expectText,
  installBrowserErrorGuards,
  loadEnglishMessages,
  loadPlaywright,
  loadManifest,
  popupPageInfo,
  popupStateForPath,
  serveExtensionBuild
} from './smoke-lib.mjs';

assertExtensionBuild();

const messages = loadEnglishMessages();
const manifest = loadManifest();
const options = defaultOptions();
const browserName = process.argv[2] || 'chromium';
if (!['chromium', 'firefox'].includes(browserName)) {
  throw new Error(`Unsupported smoke UI browser ${JSON.stringify(browserName)}. Expected chromium or firefox.`);
}
const browserType = loadPlaywright()[browserName];
if (!browserType) {
  throw new Error(`Playwright browser type ${browserName} is unavailable.`);
}
const extensionServer = await serveExtensionBuild();

function messageForKey(key, substitutions) {
  let text = messages[key]?.message || '';
  const values = Array.isArray(substitutions)
    ? substitutions
    : substitutions == null
      ? []
      : [substitutions];
  for (let i = 0; i < values.length; i++) {
    text = text
      .replaceAll(`$${i}$`, String(values[i]))
      .replaceAll(`$${i + 1}$`, String(values[i]));
  }
  return text;
}

async function installExtensionApi(page, initialState = {}) {
  await page.addInitScript(({mockInitialState, mockManifest, mockOptions, mockPageInfo, mockPopupState}) => {
    const localState = new Map(Object.entries(mockInitialState || {}));
    function pageInfoForRequest(args) {
      const result = structuredClone(mockPageInfo);
      if (!args?.includeExplanations) {
        delete result.requestExplanations;
      }
      return result;
    }
    const runtime = {
      id: 'switchyagain-smoke',
      getManifest: () => mockManifest,
      getURL: (relativePath) => new URL(String(relativePath || '').replace(/^\/+/, ''), `${window.location.origin}/`).href,
      lastError: null,
      sendMessage(message, callback) {
        const method = message?.method;
        let result;
        if (method === 'getAll') {
          result = structuredClone(mockOptions);
        } else if (method === 'getState') {
          const keys = message.args?.[0] || [];
          result = {};
          for (const key of Array.isArray(keys) ? keys : [keys]) {
            result[key] =
              key === 'proxyNotControllable' && window.location.pathname.includes('proxy_not_controllable')
                ? 'app'
                : localState.has(key)
                  ? localState.get(key)
                  : mockPopupState[key];
          }
        } else if (method === 'setState') {
          const values = message.args?.[0] || {};
          for (const [key, value] of Object.entries(values)) {
            localState.set(key, value);
          }
          result = values;
        } else if (method === 'patch' || method === 'reset') {
          result = structuredClone(mockOptions);
        } else if (method === 'resetOptionsSync' || method === 'setOptionsSync') {
          result = undefined;
        } else if (method === 'updateProfile') {
          result = {};
        } else if (method === 'renameProfile' || method === 'replaceRef') {
          result = structuredClone(mockOptions);
        } else if (method === 'getPageInfo') {
          result = pageInfoForRequest(message.args?.[0]);
        } else {
          result = {};
        }
        window.setTimeout(() => callback?.({result}), 0);
      }
    };

    window.chrome = {
      i18n: {
        getMessage(key, substitutions) {
          const messages = window.__switchyAgainSmokeMessages || {};
          let text = messages[key]?.message || '';
          const values = Array.isArray(substitutions)
            ? substitutions
            : substitutions == null
              ? []
              : [substitutions];
          for (let i = 0; i < values.length; i++) {
            text = text
              .replaceAll(`$${i}$`, String(values[i]))
              .replaceAll(`$${i + 1}$`, String(values[i]));
          }
          return text;
        },
        getUILanguage: () => 'en-US'
      },
      runtime,
      tabs: {
        create(_props, callback) {
          callback?.();
        },
        query(queryInfo, callback) {
          if (queryInfo?.active) {
            callback([{id: 1, url: mockPageInfo.url}]);
            return;
          }
          callback([]);
        },
        update(_tabId, _props, callback) {
          callback?.();
        }
      }
    };
    window.browser = {
      proxy: {}
    };
    window.__switchyAgainSmokeMessages = {};
  }, {
    mockInitialState: initialState,
    mockManifest: manifest,
    mockOptions: options,
    mockPageInfo: popupPageInfo(),
    mockPopupState: popupStateForPath('')
  });
  await page.addInitScript((mockMessages) => {
    window.__switchyAgainSmokeMessages = mockMessages;
  }, messages);
}

async function pageSnapshot(page) {
  return page.evaluate(() => ({
    bodyClass: document.body.className,
    fixedServers: document.querySelectorAll('.fixed-servers').length,
    fixedServerTargets: document.querySelectorAll('.fixed-servers.options-guide-target').length,
    guidePopovers: document.querySelectorAll('.options-guide-popover').length,
    guideStep: document.body.getAttribute('data-options-guide-step') || '',
    mainHtmlLength: document.querySelector('main')?.innerHTML?.length || 0,
    mainText: document.querySelector('main')?.textContent?.slice(0, 240) || '',
    modalCount: document.querySelectorAll('.modal').length,
    profileHeaders: document.querySelectorAll('.react-profile-shell-host').length,
    reactRootHtmlLength: document.querySelector('#react-root')?.innerHTML?.length || 0,
    url: window.location.href
  }));
}

async function expectSelectorWithSnapshot(page, selector, label) {
  try {
    await expectSelector(page, selector, label);
  } catch (error) {
    const snapshot = await pageSnapshot(page).catch((snapshotError) => ({
      snapshotError: snapshotError?.message || String(snapshotError)
    }));
    throw new Error(`${error.message}\n${JSON.stringify(snapshot, null, 2)}`);
  }
}

async function runPage(page, target) {
  const guard = installBrowserErrorGuards(page, target.label);
  await installExtensionApi(page, target.state);
  await page.goto(target.url, {waitUntil: 'domcontentloaded'});
  if (target.popup) {
    const popupBridgeType = await page.evaluate(() => typeof window.PopupBridge);
    if (popupBridgeType !== 'undefined') {
      throw new Error(`Legacy popup global PopupBridge is still exposed as ${popupBridgeType}.`);
    }
  }
  if (target.selector) {
    await expectSelector(page, target.selector, target.label);
  }
  if (target.text) {
    await expectText(page, target.text, target.label);
  }
  if (target.click) {
    await page.locator(target.click).first().click();
    await page.waitForTimeout(100);
    guard.assertNoErrors();
  }
  if (target.afterClickSelector) {
    await expectSelectorWithSnapshot(page, target.afterClickSelector, target.label);
  }
  if (target.afterClickText) {
    await expectText(page, target.afterClickText, target.label);
  }
  if (target.followUpClick) {
    await page.locator(target.followUpClick).first().click();
    await page.waitForTimeout(100);
    guard.assertNoErrors();
  }
  if (target.afterFollowUpSelector) {
    await expectSelectorWithSnapshot(page, target.afterFollowUpSelector, target.label);
  }
  if (target.afterFollowUpText) {
    await expectText(page, target.afterFollowUpText, target.label);
  }
  guard.assertNoErrors();
  console.log(`ok ${target.label}`);
}

const pages = [
  {
    label: 'options about route',
    url: extensionServer.url('options.html', '#/about'),
    text: messageForKey('about_title') || 'About'
  },
  {
    label: 'options first-run guide',
    url: extensionServer.url('options.html', '#/about'),
    state: {
      firstRun: 'install'
    },
    text: messageForKey('options_modalHeader_welcome') || 'Welcome to SwitchyAgain',
    click: '.modal-footer .btn-primary',
    afterClickSelector: '.nav-profile[data-profile-type="FixedProfile"].options-guide-target',
    afterClickText: 'contains settings like server ip',
    followUpClick: '.options-guide-popover .options-guide-button:not(.options-guide-button-secondary)',
    afterFollowUpSelector: '.fixed-servers.options-guide-target',
    afterFollowUpText: 'does not come with any proxy servers'
  },
  {
    label: 'options ui route',
    url: extensionServer.url('options.html', '#/ui'),
    text: messageForKey('options_tab_ui') || 'Interface'
  },
  {
    label: 'options general route',
    url: extensionServer.url('options.html', '#/general'),
    text: messageForKey('options_tab_general') || 'General'
  },
  {
    label: 'options request lens route',
    url: extensionServer.url('options.html', '#/requestLens'),
    text: messageForKey('options_tab_requestLens') || 'Request Lens'
  },
  {
    label: 'options import/export route',
    url: extensionServer.url('options.html', '#/io'),
    text: messageForKey('options_tab_importExport') || 'Import/Export'
  },
  {
    label: 'popup menu page',
    popup: true,
    url: extensionServer.url('popup/index.html'),
    selector: '#js-option'
  },
  {
    label: 'popup route info page',
    popup: true,
    url: extensionServer.url('popup/index.html'),
    selector: '#js-routeinfo',
    click: '#js-routeinfo',
    afterClickSelector: '.sa-popup-route-info'
  },
  {
    label: 'popup proxy-not-controllable page',
    popup: true,
    url: extensionServer.url('popup/proxy_not_controllable.html'),
    selector: '#js-manage-ext'
  }
];

let browser;
try {
  browser = await browserType.launch();
  for (const target of pages) {
    const page = await browser.newPage();
    try {
      await runPage(page, target);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser?.close();
  await extensionServer.close();
}
