import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  const plugins = [react()];
  
  // Only add express plugin in dev mode (not during build)
  if (command === 'serve') {
    plugins.push(expressPlugin());
  }

  return {
    server: {
      host: "0.0.0.0",
      port: 5000,
      strictPort: true,
      allowedHosts: true,
      hmr: false,
      fs: {
        allow: [".", "./client", "./shared"],
        deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "server/**"],
      },
    },
    build: {
      outDir: "dist/spa",
    },
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./client"),
        "@shared": path.resolve(__dirname, "./shared"),
      },
    },
  };
});

function expressPlugin(): Plugin {
  return {
    name: "express-plugin",
    apply: "serve",
    configureServer(server) {
      // Lazy-require the server module only at runtime in dev
      return () => {
        server.middlewares.use(async (req, res, next) => {
          try {
            // Dynamic import deferred until first request
            const mod = await import("./server/index.ts");
            const { createServer } = mod;
            const app = createServer();
            app(req, res, next);
          } catch (err) {
            next(err);
          }
        });
      };
    },
  };
}
