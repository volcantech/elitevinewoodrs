export default async (env) => {
  const { fileURLToPath } = await import('url');
  const path = await import('path');
  const react = (await import('@vitejs/plugin-react-swc')).default;
  
  const __dirname = path.dirname(fileURLToPath(import.meta.url));

  return {
    build: {
      outDir: 'dist/spa',
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './client'),
        '@shared': path.resolve(__dirname, './shared'),
      },
    },
  };
};
