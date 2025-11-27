import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  build: {
    outDir: 'dist/spa',
    rollupOptions: {
      external: (id) => {
        return id.startsWith('react') || id.startsWith('@') || /^[a-z]/.test(id);
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client'),
      '@shared': path.resolve(__dirname, './shared'),
    },
  },
};
