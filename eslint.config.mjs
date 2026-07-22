import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const generatedAndThirdParty = [
  '**/node_modules/**',
  'dist/**',
  'packages/proxy-engine/proxy_engine.min.js',
  'packages/**/build/**',
  'packages/**/build-ts/**',
  'packages/**/tmp/**',
  'apps/**/build/**',
  'apps/**/build-ts/**',
  'apps/**/tmp/**',
  'apps/**/release/**',
  '**/*.min.js',
  'packages/web-ui/vendor/**'
];

const extensionGlobals = {
  ProxyEngine: 'readonly',
  ExtensionRuntime: 'readonly'
};

const tsRecommended = tseslint.configs.recommended.map((config) => ({
  ...config,
  files: config.files ?? ['**/*.{ts,tsx,mts,cts}']
}));

export default tseslint.config(
  {
    ignores: generatedAndThirdParty
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: {
        ...globals.es2022,
        ...globals.node,
        ...globals.browser,
        ...globals.webextensions,
        ...extensionGlobals
      },
      sourceType: 'module'
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-empty': ['warn', {allowEmptyCatch: true}],
      'no-unused-expressions': 'off',
      'no-unused-vars': ['warn', {
        args: 'none',
        caughtErrors: 'none',
        varsIgnorePattern: '^_'
      }],
      'prefer-const': 'off',
      'prefer-rest-params': 'off'
    }
  },
  ...tsRecommended,
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: {
        ...globals.es2022,
        ...globals.browser,
        ...globals.webextensions,
        ...globals.node,
        ...extensionGlobals
      },
      sourceType: 'module'
    },
    rules: {
      'no-empty': ['warn', {allowEmptyCatch: true}],
      'no-undef': 'off',
      'no-unused-expressions': 'off',
      'prefer-const': 'off',
      'prefer-rest-params': 'off',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', {
        args: 'none',
        caughtErrors: 'none',
        varsIgnorePattern: '^_'
      }],
      '@typescript-eslint/no-unsafe-declaration-merging': 'warn'
    }
  },
  {
    files: ['**/*.d.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-misused-new': 'off',
      'no-var': 'off'
    }
  },
  {
    files: ['packages/web-ui/src/react/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks
    },
    rules: {
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/rules-of-hooks': 'error'
    }
  }
);
