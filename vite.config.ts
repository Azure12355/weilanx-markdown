import { defineConfig } from "vite";

// webview 构建:产出到 out/webview,资源用相对路径(扩展端再换成 webview URI);动态 import 的 chunk 按模块 URL 相对加载
export default defineConfig({
  root: "webview",
  base: "./",
  build: {
    outDir: "../out/webview",
    emptyOutDir: true,
    chunkSizeWarningLimit: 4000,
  },
});
