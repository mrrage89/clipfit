import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// `--mode extension` builds the browser-extension variant: relative asset paths
// (for chrome-extension://) and a separate output dir. `.env.extension` sets
// VITE_EXT=1 so the engine loads the bundled core. No COOP/COEP — the single-thread
// core needs no cross-origin isolation.
export default defineConfig(({ mode }) => {
  const ext = mode === 'extension';
  return {
    base: ext ? './' : '/',
    build: { outDir: ext ? 'dist-ext' : 'dist' },
    plugins: [react()],
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test-setup.ts',
    },
  };
});
