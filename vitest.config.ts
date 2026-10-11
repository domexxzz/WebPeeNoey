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
    // Integration Test ต้องใช้ PostgreSQL จริง แยกไปรันด้วย npm run test:integration
    exclude: ["tests/integration/**", "node_modules/**"],
    // Unit test ห้ามแตะฐานข้อมูล: ตั้งค่าว่างไว้ก่อน (Prisma จะไม่โหลดทับจาก .env) เพื่อให้ rate limiter ใช้ memory store
    env: { DATABASE_URL: "" },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
