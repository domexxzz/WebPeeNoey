import { indexStyle } from "@/lib/motion";
import { ChartDecoration } from "./chart-decoration";

/**
 * ภาพประกอบนามธรรมของแต่ละฟีเจอร์ (SVG วาดเอง ไม่ใช่ภาพหน้าจอจริง) — ตกแต่งเท่านั้น
 * ห้ามมีตัวอักษร ตัวเลข หรือรายชื่อบุคคล (กันการสื่อว่าเป็นรีวิว/ผลงานจริง)
 * อนิเมชัน: ชิ้น .fa-pop เด้งทีละชิ้นเมื่อแถวเลื่อนมาถึง ([data-reveal] ของแถว) — ดู src/styles/motion-art.css
 */
function ChatArt() {
  const bubbles = [
    { x: 24, y: 28, w: 190, accent: false },
    { x: 24, y: 78, w: 140, accent: false },
    { x: 136, y: 128, w: 160, accent: true },
  ];
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 320 240" className="w-full h-auto">
      {bubbles.map((bubble, index) => (
        <g key={bubble.y} className="fa-pop" style={indexStyle(index)}>
          <rect x={bubble.x} y={bubble.y} width={bubble.w} height="36" rx="12" fill={bubble.accent ? "#6EEA6E" : "rgba(255,255,255,0.08)"} stroke={bubble.accent ? "none" : "rgba(255,255,255,0.35)"} />
          <rect x={bubble.x + 12} y={bubble.y + 11} width={bubble.w * 0.55} height="6" rx="3" fill={bubble.accent ? "rgba(17,19,18,0.55)" : "rgba(255,255,255,0.35)"} />
          <rect x={bubble.x + 12} y={bubble.y + 21} width={bubble.w * 0.35} height="5" rx="2.5" fill={bubble.accent ? "rgba(17,19,18,0.35)" : "rgba(255,255,255,0.18)"} />
        </g>
      ))}
      {/* กล่อง "กำลังพิมพ์" — จุดสามจุดเด้งวนตลอด */}
      <g className="fa-pop" style={indexStyle(bubbles.length)}>
        <rect x="24" y="178" width="76" height="36" rx="12" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.35)" />
        {[0, 1, 2].map((dot) => (
          <circle key={dot} className="fa-dot" style={indexStyle(dot)} cx={44 + dot * 18} cy="196" r="4" fill="#6EEA6E" />
        ))}
      </g>
    </svg>
  );
}

function CommunityArt() {
  const members = [0, 1, 2, 3, 4, 5, 6, 7];
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 320 240" className="w-full h-auto">
      <rect x="20" y="20" width="76" height="200" rx="14" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.3)" />
      {[44, 70, 96, 122].map((y, index) => (
        <rect key={y} className="fa-pop" style={indexStyle(index)} x="32" y={y} width={index === 1 ? 52 : 40} height="7" rx="3.5" fill={index === 1 ? "#6EEA6E" : "rgba(255,255,255,0.25)"} />
      ))}
      {members.map((member) => {
        const column = member % 4;
        const row = Math.floor(member / 4);
        const cx = 140 + column * 46;
        const cy = 80 + row * 72;
        const highlighted = member === 2;
        return (
          <g key={member} className="fa-pop fa-center" style={indexStyle(member)}>
            {highlighted && <circle className="fa-ping" cx={cx} cy={cy} r="17" fill="none" stroke="#6EEA6E" strokeWidth="2" />}
            <circle cx={cx} cy={cy} r="17" fill={highlighted ? "#6EEA6E" : "rgba(255,255,255,0.1)"} stroke="rgba(255,255,255,0.45)" />
            <rect x={cx - 15} y={cy + 25} width="30" height="5" rx="2.5" fill="rgba(255,255,255,0.2)" />
          </g>
        );
      })}
    </svg>
  );
}

export function FeatureArt({ featureId }: { featureId: string }) {
  if (featureId === "telegram") return <ChatArt />;
  if (featureId === "discord") return <CommunityArt />;
  return (
    <div className="p-5">
      <ChartDecoration animated className="w-full h-40" />
    </div>
  );
}
