import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3001,
    host: '0.0.0.0',
    strictPort: false,
    open: false,
    proxy: {
      '/api/git': {
        target: 'http://localhost:3003',
        changeOrigin: true,
      },
      '/api/claude': {
        target: 'http://localhost:3003',
        changeOrigin: true,
      },
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  appType: 'spa',
  preview: {
    port: 3001,
  },
});