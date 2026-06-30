import {beforeEach} from 'vitest';

type TestGlobal = typeof globalThis & {
  browser?: unknown;
  chrome?: unknown;
};

export function installDefaultChromeMock() {
  const testGlobal = globalThis as TestGlobal;
  delete testGlobal.browser;
  testGlobal.chrome = {
    i18n: {
      getMessage: () => '',
      getUILanguage: () => 'en'
    },
    runtime: {
      getManifest: () => ({
        manifest_version: 3,
        version: '0.0.0'
      }),
      getURL: (path: string) => path,
      sendMessage() {}
    }
  };
}

beforeEach(() => {
  installDefaultChromeMock();
});
