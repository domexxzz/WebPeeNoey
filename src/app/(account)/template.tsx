/** เล่นอนิเมชันเข้าเมื่อเปลี่ยนหน้าในโซนสมาชิก/ชำระเงิน (เบา ๆ เพื่อให้รู้ว่าเปลี่ยนหน้าแล้ว) */
export default function AccountTemplate({ children }: { children: React.ReactNode }) {
  return <div className="mx-page mx-scope">{children}</div>;
}
