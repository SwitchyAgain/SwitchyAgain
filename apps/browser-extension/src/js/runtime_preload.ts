type RuntimePreloadGlobal = typeof globalThis & {
  window?: unknown;
};

(function (global: RuntimePreloadGlobal) {
  'use strict';

  if (typeof global.window === 'undefined') {
    global.window = global as unknown as Window & typeof globalThis;
  }
})(globalThis as RuntimePreloadGlobal);
