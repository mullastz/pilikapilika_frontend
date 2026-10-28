import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Keep Angular's browser-environment tests within modest local/CI memory limits.
    maxWorkers: 1,
    fileParallelism: false,
  },
});
