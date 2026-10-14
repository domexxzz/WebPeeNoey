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
        accent: {
          green: "#10B981",
          gold: "#F59E0B",
          goldLight: "#FDE047",
          blue: "#3B82F6",
          red: "#EF4444",
        },
        // ธีมครีม-ทอง (Gold Hybridshot): ตั้งชื่อตามหน้าที่ — ค่าความต่างสี (WCAG) วัดบนพื้น page
        page: "#FAF6EE", // พื้นหลังหน้า (ครีม)
        surface: {
          DEFAULT: "#FFFFFF", // การ์ด/กล่อง
          sunken: "#F3EDE0", // แผงยุบลง (กรอบกราฟ ภาพประกอบ)
        },
        fg: {
          DEFAULT: "#1F1A12", // ตัวหนังสือหลัก 16:1
          muted: "#5C5344", // ตัวหนังสือรอง 7.1:1
          subtle: "#6B604E", // คำอธิบาย/ป้ายเล็ก 5.6:1 (บนแผงยุบ 5.2:1)
        },
        gold: {
          DEFAULT: "#D4A537", // พื้นปุ่ม/แถบเน้น (ตัวหนังสือบนทองใช้ fg — 7.7:1)
          hover: "#C3952A",
          muted: "rgba(212, 165, 55, 0.16)",
          ink: "#8A5F00", // ทองสำหรับตัวหนังสือ/ลิงก์/โฟกัส 5.2:1
        },
        // เส้นขอบโทนเข้มโปร่ง — strong ใช้ตอนชี้/เน้น
        line: {
          DEFAULT: "rgba(31, 26, 18, 0.12)",
          soft: "rgba(31, 26, 18, 0.07)",
          strong: "rgba(31, 26, 18, 0.24)",
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
