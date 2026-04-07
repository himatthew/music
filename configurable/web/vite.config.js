import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@app": path.resolve(__dirname, "../../src"),
      // @app 下文件在 web 目录外，需显式指向本包 node_modules，否则生产构建无法解析 tone 等
      tone: path.resolve(__dirname, "node_modules/tone"),
    },
  },
  publicDir: path.resolve(__dirname, "../../public"),
  server: {
    port: 5174,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
      },
    },
  },
});
