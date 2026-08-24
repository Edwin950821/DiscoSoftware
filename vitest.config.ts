import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts', 'src/hooks/**/*.ts', 'src/components/ui/**/*.tsx'],
      thresholds: {
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    restoreMocks: true,
    clearMocks: true,
  },
})