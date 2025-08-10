import { defineConfig } from 'vite';
import path from 'node:path';

// https://vitejs.dev/config/
export default defineConfig({
  root: '.',
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    port: 8080,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE || 'http://localhost:3000',
        changeOrigin: true,
        // No rewrite: keep /api/* to match server routes
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});


