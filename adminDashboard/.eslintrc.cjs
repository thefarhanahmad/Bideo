module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: '18.2' } },
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    // This is a plain-JS codebase (no prop-types dependency); we rely on usage
    // and the backend API contract instead of runtime prop validation.
    'react/prop-types': 'off',
    // Marketing copy contains apostrophes/quotes; not worth HTML-escaping.
    'react/no-unescaped-entities': 'off',
  },
}
