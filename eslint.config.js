import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    ignores: ['dist/**', 'node_modules/**', '*.config.js'],
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Replies are shown as text nodes only (REQUIREMENTS RQ-9).
    files: ['src/widget/**/*.{ts,tsx}'],
    ignores: ['src/widget/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='innerHTML']",
          message: 'Render text nodes, never HTML.',
        },
        {
          selector:
            'AssignmentExpression > MemberExpression[property.name=/^(innerHTML|outerHTML)$/]',
          message: 'Render text nodes, never HTML.',
        },
        {
          selector: "CallExpression[callee.property.name='insertAdjacentHTML']",
          message: 'Render text nodes, never HTML.',
        },
      ],
    },
  },
  {
    // Build and check scripts run in Node and report to the terminal.
    files: ['scripts/**/*.mjs', 'e2e/**/*.mjs'],
    languageOptions: { globals: globals.node },
    rules: { 'no-console': 'off' },
  }
);
