import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
          800: "#92400e",
          900: "#78350f",
          950: "#451a03",
        },
        surface: {
          DEFAULT: "#111827",
          subtle: "#161F30",
          card: "rgba(17, 24, 39, 0.7)",
          border: "rgba(255, 255, 255, 0.08)",
          hover: "rgba(255, 255, 255, 0.04)",
        },
        accent: {
          green: "#10B981",
          gold: "#F59E0B",
          goldLight: "#FDE047",
          blue: "#3B82F6",
          red: "#EF4444",
        },
        // หน้าบ้าน (สไตล์ Bold): พื้นดำอมเขียว + เขียวสัญญาณ + เส้นกรอบสีขาว
        ink: {
          DEFAULT: "#111312",
          raised: "#171A18",
          deep: "#0C0E0D",
        },
        signal: {
          DEFAULT: "#6EEA6E",
          hover: "#93F293",
          muted: "rgba(110, 234, 110, 0.14)",
        },
        // เส้นขอบแบบนุ่ม (เดิมขาว 60% แข็งเกินไป) — strong ใช้ตอนชี้/เน้น
        line: {
          DEFAULT: "rgba(255, 255, 255, 0.16)",
          soft: "rgba(255, 255, 255, 0.09)",
          strong: "rgba(255, 255, 255, 0.32)",
        },
      },
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        heading: ["var(--font-prompt)", "var(--font-body)", "sans-serif"],
        // หัวข้อหน้าบ้าน: อักษรละตินใช้ Familjen Grotesk ส่วนอักษรไทยตกไปที่ Anuphan (ไม่มีหัว เข้ากับ grotesk)
        display: ["var(--font-familjen)", "var(--font-anuphan)", "sans-serif"],
        thai: ["var(--font-anuphan)", "var(--font-body)", "sans-serif"],
      },
      keyframes: {
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
      },
      animation: {
        marquee: "marquee 45s linear infinite",
      },
      boxShadow: {
        glow: "0 0 25px -5px rgba(245, 158, 11, 0.25)",
        "glow-green": "0 0 25px -5px rgba(16, 185, 129, 0.25)",
      },
    },
  },
  plugins: [],
};
export default config;
