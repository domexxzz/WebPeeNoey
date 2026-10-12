import { Anuphan, Familjen_Grotesk } from "next/font/google";

/** หัวข้อหน้าบ้าน (ละติน) — grotesk หนา ตัวอักษรชิด */
export const displayFont = Familjen_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  variable: "--font-familjen",
});

/** อักษรไทยของหน้าบ้าน (ทั้งหัวข้อและเนื้อหา) — แบบไม่มีหัว รับกับ grotesk */
export const thaiFont = Anuphan({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-anuphan",
});
