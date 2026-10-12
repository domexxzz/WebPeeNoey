/** เล่นอนิเมชันเข้าเมื่อเปลี่ยนหน้า (template สร้างใหม่ทุกครั้งที่นำทาง ต่างจาก layout ที่คงอยู่) */
export default function MarketingTemplate({ children }: { children: React.ReactNode }) {
  return <div className="mx-page">{children}</div>;
}
