import tseslint from 'typescript-eslint';
import eslint from '@eslint/js';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'examples/**', 'eslint.config.*', 'mcp/**', 'tests/**', 'summit-demo/**'] },
  // JS base rules for JS files (none currently, but safe)
  { files: ['**/*.{js,cjs,mjs}'], ...eslint.configs.recommended },
  // TS recommended (no type-checking) applied to TS files
  ...tseslint.configs.recommended.map(cfg => ({
    ...cfg,
    files: ['src/**/*.ts']
  })),
  // TS type-checked rules applied to TS files with project settings
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: process.cwd()
      }
    },
    rules: {
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off'
    }
  }
];
