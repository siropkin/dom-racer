import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  const sourcemapEnabled = process.env.DOM_RACER_SOURCEMAP === 'true';

  return {
    build: {
      emptyOutDir: true,
      outDir: 'dist',
      sourcemap: sourcemapEnabled,
      cssCodeSplit: false,
      rollupOptions: {
        input: {
          content: resolve(__dirname, 'src/content/main.ts'),
        },
        output: {
          entryFileNames: 'content.js',
          chunkFileNames: 'chunks/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
    },
  };
});
