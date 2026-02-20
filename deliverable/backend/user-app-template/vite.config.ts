import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    watch: {
      // Use polling instead of native file system events (more reliable for some environments)
      usePolling: false,
      // Wait 500ms before triggering a rebuild (gives time for all files to be flushed)
      interval: 500,
      // Additional delay between file change detection and reload
      binaryInterval: 500,
    },
  },
});
