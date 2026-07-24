import assert from 'node:assert/strict';
import {afterEach, describe, it, vi} from 'vitest';
import {chromeApiPromisify} from '../module/chrome_api';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function stubChrome(lastError?: ChromeLastError) {
  const runtime = {
    lastError
  };
  vi.stubGlobal('chrome', {runtime});
  return runtime;
}

describe('chromeApiPromisify', () => {
  it('forwards arguments and resolves a single callback value', async () => {
    stubChrome();
    const target = {
      value: 'bound target',
      read(key: string, callback: (value: string) => void) {
        assert.equal(this.value, 'bound target');
        assert.equal(key, 'profile');
        callback('loaded');
      }
    };

    const result = await chromeApiPromisify<string>(target, 'read')('profile');

    assert.equal(result, 'loaded');
  });

  it('resolves multiple callback values as an array', async () => {
    stubChrome();
    const target = {
      query(callback: (first: string, second: number) => void) {
        callback('first', 2);
      }
    };

    const result = await chromeApiPromisify<unknown>(target, 'query')();

    assert.deepEqual(result, ['first', 2]);
  });

  it('rejects with the Chrome runtime error and preserves lastError', async () => {
    const lastError = {message: 'Permission denied', code: 'permission'};
    stubChrome(lastError);
    const target = {
      remove(callback: () => void) {
        callback();
      }
    };

    await assert.rejects(chromeApiPromisify<void>(target, 'remove')(), (error: unknown) => {
      assert(error instanceof Error);
      assert.equal(error.message, 'Permission denied');
      assert.strictEqual((error as Error & {original?: ChromeLastError}).original, lastError);
      return true;
    });
  });

  it('rejects when the requested Chrome API method is missing', async () => {
    stubChrome();

    await assert.rejects(chromeApiPromisify<unknown>({}, 'missing')(), /Chrome API method not found: missing/);
  });
});
