import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    // `tests/int/` only exercises `src/lib/*` through Payload's Local API —
    // no DOM anywhere. `jsdom` isn't just unnecessary here, it's actively
    // wrong: jsdom polyfills a *different* global `TextEncoder`/`Uint8Array`
    // than Node's, and `jose` (used by Payload's own JWT signing/verification,
    // and by the citizen auth strategy) does `new TextEncoder()` off the
    // global and checks `instanceof Uint8Array` on the result — a classic
    // cross-realm failure ("payload must be an instance of Uint8Array") the
    // moment any test touches real JWT signing.
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/int/**/*.int.spec.ts'],
  },
})
