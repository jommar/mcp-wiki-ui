import js from '@eslint/js';
import globals from 'globals';
import pluginVue from 'eslint-plugin-vue';
import scopedCss from 'eslint-plugin-vue-scoped-css';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
let autoImportGlobals = {};
try {
  autoImportGlobals = require('./.eslintrc-auto-import.json').globals;
} catch {}

export default [
  // Global ignores
  {
    ignores: ['node_modules/', 'dist/', '.env', 'package-lock.json'],
  },

  js.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  ...scopedCss.configs['flat/recommended'],

  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...autoImportGlobals,
      },
    },

    rules: {
      // ─── Errors ────────────────────────────────────────────────────────
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-undef': 'error',

      // ─── Best Practices ────────────────────────────────────────────────
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-return-await': 'error',
      'no-throw-literal': 'error',
      'require-await': 'error',

      // ─── Style ─────────────────────────────────────────────────────────
      'no-trailing-spaces': 'error',
      'no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0 }],
      'eol-last': ['error', 'always'],

      // ─── Vue ───────────────────────────────────────────────────────────
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'off',
      'vue/html-self-closing': ['error', { html: { void: 'always' } }],
      'vue/component-definition-name-casing': ['error', 'PascalCase'],
      'vue/component-name-in-template-casing': ['error', 'PascalCase'],
      'vue/no-unused-components': 'warn',
      'vue/no-unused-refs': 'warn',
      'vue/require-default-prop': 'off',
      'vue/require-prop-types': 'off',
      'vue/max-attributes-per-line': 'off',

      // ─── Disable formatting rules (Prettier handles these) ─────────────
      'vue/html-indent': 'off',
      'vue/html-closing-bracket-spacing': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/first-attribute-linebreak': 'off',
      'vue/max-len': 'off',
      'vue/no-spaces-around-equal-signs-in-attribute': 'off',
    },
  },
];
