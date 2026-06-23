import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// No COOP/COEP headers: the single-thread ffmpeg core doesn't need cross-origin
// isolation (that's only for the SharedArrayBuffer multithread core), and
// requiring it would needlessly break embedding and some networks/proxies.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts',
  },
});
