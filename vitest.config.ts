import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  // tsconfig ใช้ jsx: "preserve" สำหรับ Next.js — ในเทสต์ต้องแปลง JSX เองด้วย React automatic runtime
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "node",
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
