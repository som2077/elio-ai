import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: {
        youtube: resolve(__dirname, 'src/content/youtube.ts'),
        instagram: resolve(__dirname, 'src/content/instagram.ts'),
        service_worker: resolve(__dirname, 'src/background/service_worker.ts'),
        popup: resolve(__dirname, 'src/popup/popup.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'service_worker') {
            return 'background/service_worker.js';
          }
          if (chunkInfo.name === 'popup') {
            return 'src/popup/popup.js';
          }
          return 'content/[name].js';
        },
        format: 'iife',
        name: 'Clipper',
        inlineDynamicImports: false,
      },
    },
  },
});
