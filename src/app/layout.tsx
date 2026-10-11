import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai, Prompt } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { siteConfig } from "@/config/site";

// หัวข้อใช้ Prompt (มีบุคลิก), เนื้อหาใช้ IBM Plex Sans Thai (อ่านง่ายที่ขนาดเล็ก)
const headingFont = Prompt({
  subsets: ["thai", "latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  variable: "--font-prompt",
});

const bodyFont = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: {
    default: `${siteConfig.name} — อินดิเคเตอร์ TradingView พร้อมกลุ่มแจ้งเตือนและคอมมูนิตี้`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  metadataBase: new URL(siteConfig.url),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`dark ${headingFont.variable} ${bodyFont.variable}`}>
      <body className="min-h-screen bg-[#0B0F17] text-gray-100 antialiased selection:bg-amber-500 selection:text-black">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
