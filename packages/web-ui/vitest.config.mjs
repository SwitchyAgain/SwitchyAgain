import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    allowOnly: false,
    environment: 'node',
    fileParallelism: false,
    globals: true,
    include: ['test/*.ts', 'test/*.tsx']
  }
});
