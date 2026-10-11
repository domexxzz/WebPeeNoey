import { defineConfig, loadEnv } from "vite";
import path from "path";

/**
 * Integration Test กับ PostgreSQL จริง (CLAUDE.md ข้อ 1) — รัน: npm run test:integration
 * ใช้ฐานข้อมูล DATABASE_URL_TEST เท่านั้น (global-setup ตรวจซ้ำว่าเป็น localhost และชื่อลงท้าย _test)
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    esbuild: { jsx: "automatic" },
    test: {
      environment: "node",
      globals: true,
      include: ["tests/integration/**/*.test.ts"],
      globalSetup: ["tests/integration/global-setup.ts"],
      // ทุกไฟล์ใช้ฐานข้อมูลเดียวกัน ต้องรันทีละไฟล์เพื่อไม่ให้ข้อมูลชนกัน
      fileParallelism: false,
      env: { DATABASE_URL: env.DATABASE_URL_TEST ?? "" },
    },
    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
    },
  };
});
