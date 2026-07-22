// @vitest-environment jsdom

import '../src/js/log_error';

const MAX_PAGE_LOG_LENGTH = 64 * 1024;

describe('page error log', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('keeps only the latest 64 KiB of errors', () => {
    localStorage.setItem('log', 'x'.repeat(MAX_PAGE_LOG_LENGTH));

    window.onerror?.('latest error', 'https://example.test/options.js', 10, 20);

    const log = localStorage.getItem('log') || '';
    expect(log).toHaveLength(MAX_PAGE_LOG_LENGTH);
    expect(log).toContain('latest error');
    expect(log).toContain('https://example.test/options.js:10:20');
  });
});
