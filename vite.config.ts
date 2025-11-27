import { fileURLToPath } from 'url';
import path from 'path';
import react from '@vitejs/plugin-react-swc';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  plugins: [react()],
  build: {
    outDir: 'dist/spa',
    sourcemap: false,
    minify: 'terser',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client'),
      '@shared': path.resolve(__dirname, './shared'),
    },
  },
};
