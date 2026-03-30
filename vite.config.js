import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** file:// 下带 crossorigin 的 script/link 会按 CORS 加载，模块/CSS 失败 → 白屏 */
function electronNoCrossorigin() {
  return {
    name: "electron-no-crossorigin",
    transformIndexHtml(html) {
      return html.replace(/\s+crossorigin(?:="[^"]*")?/g, "");
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), mode === "electron" && electronNoCrossorigin()].filter(Boolean),
  publicDir: "public",
  /* GitHub Pages 用 VITE_BASE；Electron 打包用相对路径以支持 file:// */
  base: process.env.VITE_BASE || (mode === "electron" ? "./" : "/"),
}));
