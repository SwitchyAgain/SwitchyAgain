import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vitest/config';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@switchyagain/extension-runtime': resolve(root, '../extension-runtime/src/index.ts'),
      '@switchyagain/proxy-engine': resolve(root, '../proxy-engine/src/index.ts')
    }
  },
  test: {
    allowOnly: false,
    environment: 'node',
    fileParallelism: false,
    globals: true,
    include: ['test/*.ts', 'test/*.tsx'],
    setupFiles: ['test/support/setup.ts']
  }
});
