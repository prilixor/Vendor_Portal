import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

/** Stop Chrome from keeping a stale /favicon.ico (old Lovable heart) on localhost. */
function blinksmedFavicon(): Plugin {
  return {
    name: "blinksmed-favicon",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = req.url?.split("?")[0];
        if (pathname === "/favicon.ico" || pathname === "/favicon.svg") {
          res.setHeader("Cache-Control", "no-store, no-cache, max-age=0");
        }
        next();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiProxyTarget = env.VITE_DEV_API_PROXY_TARGET || "https://localhost:51884";

  return {
    server: {
      host: "::",
      port: 5173,
      hmr: {
        overlay: false,
      },
      proxy: {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
        },
        "/uploads": {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    plugins: [react(), blinksmedFavicon()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
  };
});
