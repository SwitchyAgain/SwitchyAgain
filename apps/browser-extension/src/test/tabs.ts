import assert from 'node:assert/strict';
import {describe, it, vi} from 'vitest';
import ChromeTabs, {tabUrl} from '../module/tabs';

describe('tabUrl', () => {
  it('prefers a pending URL and falls back to the current URL', () => {
    assert.equal(tabUrl({pendingUrl: 'https://pending.example/', url: 'https://current.example/'}), 'https://pending.example/');
    assert.equal(tabUrl({url: 'https://current.example/'}), 'https://current.example/');
    assert.equal(tabUrl(null), undefined);
  });
});

describe('ChromeTabs.onUpdated', () => {
  it('ignores status-only updates after loading', () => {
    const actionForUrl = vi.fn(async (_tab: ChromeTab, _url: string): Promise<null> => null);
    const tabs = new ChromeTabs(actionForUrl);

    const result = tabs.onUpdated(7, {status: 'complete'}, {id: 7, url: 'https://example.com/'});

    assert.equal(result, undefined);
    assert.equal(actionForUrl.mock.calls.length, 0);
  });

  it('processes loading updates with the pending URL', async () => {
    const actionForUrl = vi.fn(async (_tab: ChromeTab, _url: string): Promise<null> => null);
    const tabs = new ChromeTabs(actionForUrl);
    const tab = {
      id: 7,
      pendingUrl: 'https://pending.example/',
      url: 'https://current.example/'
    };

    await tabs.onUpdated(7, {status: 'loading'}, tab);

    assert.equal(actionForUrl.mock.calls.length, 1);
    assert.strictEqual(actionForUrl.mock.calls[0][0], tab);
    assert.equal(actionForUrl.mock.calls[0][1], 'https://pending.example/');
  });
});
