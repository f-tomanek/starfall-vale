import { defineConfig } from 'vitest/config';

// Separate from vite.config.ts so tests do not start the IWSDK dev plugin.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
