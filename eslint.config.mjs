import coreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

/**
 * Flat config. `eslint-config-next` ships native flat-config arrays from
 * v16, so no FlatCompat shim is needed.
 */
const eslintConfig = [
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'coverage/**', 'supabase/.temp/**'],
  },
  ...coreWebVitals,
  ...nextTypescript,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
]

export default eslintConfig
