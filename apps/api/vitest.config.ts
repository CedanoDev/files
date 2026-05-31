// ─────────────────────────────────────────────
// vitest.config.ts — apps/api
// ─────────────────────────────────────────────

import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/use-cases/**', 'src/domain/**'],
      exclude: ['src/infrastructure/**', 'src/interface/**'],
      thresholds: {
        lines:      80,
        functions:  80,
        branches:   75,
        statements: 80,
      },
    },
    // Alias igual que tsconfig para que los imports funcionen en tests
    alias: {
      '@domain':         path.resolve(__dirname, 'src/domain'),
      '@use-cases':      path.resolve(__dirname, 'src/use-cases'),
      '@infrastructure': path.resolve(__dirname, 'src/infrastructure'),
      '@shared':         path.resolve(__dirname, 'src/shared'),
    },
  },
})
