import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Playwright owns tests/e2e/** — vitest's default glob would otherwise pick
// those specs up too and crash trying to run test.describe() outside its runner.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
});
