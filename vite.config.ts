import { fileURLToPath } from 'url';
import path from 'path';
import react from '@vitejs/plugin-react-swc';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  plugins: [react()],
  build: {
    outDir: 'dist/spa',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'radix-ui': ['@radix-ui/react-dialog', '@radix-ui/react-select', '@radix-ui/react-tabs'],
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'query-lib': ['@tanstack/react-query'],
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client'),
      '@shared': path.resolve(__dirname, './shared'),
    },
  },
};
