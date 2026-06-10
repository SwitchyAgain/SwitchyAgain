import {
  assertExtensionBuild,
  defaultOptions,
  expectSelector,
  expectText,
  extensionFileUrl,
  installBrowserErrorGuards,
  loadEnglishMessages,
  loadPlaywright,
  loadManifest,
  popupPageInfo,
  popupStateForPath
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

async function installExtensionApi(page) {
  await page.addInitScript(({mockManifest, mockOptions}) => {
    const localState = new Map();
    const runtime = {
      id: 'switchyagain-smoke',
      getManifest: () => mockManifest,
      getURL: (relativePath) => new URL(relativePath, window.location.href).href,
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
            result[key] = localState.get(key);
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
          result = {
            domain: 'www.example.com',
            errorCount: 0,
            summary: {},
            url: 'https://www.example.com/'
          };
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
        query(_queryInfo, callback) {
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
    mockManifest: manifest,
    mockOptions: options
  });
  await page.addInitScript((mockMessages) => {
    window.__switchyAgainSmokeMessages = mockMessages;
  }, messages);
}

async function installPopupTarget(page) {
  await page.addInitScript(({mockMessages, mockPageInfo, mockPopupState}) => {
    function getMessage(key, substitutions) {
      const values = Array.isArray(substitutions)
        ? substitutions
        : substitutions == null
          ? []
          : [substitutions];
      let text = mockMessages[key]?.message || key;
      for (let i = 0; i < values.length; i++) {
        text = text
          .replaceAll(`$${i}$`, String(values[i]))
          .replaceAll(`$${i + 1}$`, String(values[i]));
      }
      return text;
    }
    window.OmegaTargetPopup = {
      addCondition(_condition, _profileName, _addToBottom, callback) {
        callback?.(null);
      },
      addTempRule(_domain, _profileName, callback) {
        callback?.(null);
      },
      applyProfile(_name, callback) {
        callback?.(null);
      },
      getActivePageInfo(callback) {
        callback?.(null, mockPageInfo);
      },
      getMessage,
      getState(_keys, callback) {
        callback?.(null, {
          ...mockPopupState,
          proxyNotControllable: window.location.pathname.includes('proxy_not_controllable')
            ? 'app'
            : mockPopupState.proxyNotControllable
        });
      },
      openManage(callback) {
        callback?.(null);
      },
      openOptions(_hash, callback) {
        callback?.(null);
      },
      setDefaultProfile(_profileName, _defaultProfileName, callback) {
        callback?.(null);
      },
      setState(_name, _value, callback) {
        callback?.(null);
      }
    };
  }, {
    mockMessages: messages,
    mockPageInfo: popupPageInfo(),
    mockPopupState: popupStateForPath('')
  });
}

async function runPage(page, target) {
  const guard = installBrowserErrorGuards(page, target.label);
  await installExtensionApi(page);
  if (target.popup) {
    await installPopupTarget(page);
    await page.route('**/js/omega_target_popup.js', (route) => {
      route.fulfill({
        body: '',
        contentType: 'application/javascript',
        status: 200
      });
    });
  }
  await page.goto(target.url, {waitUntil: 'domcontentloaded'});
  if (target.selector) {
    await expectSelector(page, target.selector, target.label);
  }
  if (target.text) {
    await expectText(page, target.text, target.label);
  }
  guard.assertNoErrors();
  console.log(`ok ${target.label}`);
}

const pages = [
  {
    label: 'options about route',
    url: extensionFileUrl('options.html', '#/about'),
    text: messageForKey('about_title') || 'About'
  },
  {
    label: 'options ui route',
    url: extensionFileUrl('options.html', '#/ui'),
    text: messageForKey('options_tab_ui') || 'Interface'
  },
  {
    label: 'options general route',
    url: extensionFileUrl('options.html', '#/general'),
    text: messageForKey('options_tab_general') || 'General'
  },
  {
    label: 'options import/export route',
    url: extensionFileUrl('options.html', '#/io'),
    text: messageForKey('options_tab_importExport') || 'Import/Export'
  },
  {
    label: 'standalone about page',
    url: extensionFileUrl('react/about.html'),
    text: messageForKey('about_title') || 'About'
  },
  {
    label: 'standalone ui page',
    url: extensionFileUrl('react/ui.html'),
    text: messageForKey('options_tab_ui') || 'Interface'
  },
  {
    label: 'standalone general page',
    url: extensionFileUrl('react/general.html'),
    text: messageForKey('options_tab_general') || 'General'
  },
  {
    label: 'standalone import/export page',
    url: extensionFileUrl('react/import_export.html'),
    text: messageForKey('options_tab_importExport') || 'Import/Export'
  },
  {
    label: 'popup menu page',
    popup: true,
    url: extensionFileUrl('popup/index.html'),
    selector: '#js-option'
  },
  {
    label: 'popup proxy-not-controllable page',
    popup: true,
    url: extensionFileUrl('popup/proxy_not_controllable.html'),
    selector: '#js-manage-ext'
  }
];

const browser = await browserType.launch();
try {
  for (const target of pages) {
    const page = await browser.newPage();
    try {
      await runPage(page, target);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}
