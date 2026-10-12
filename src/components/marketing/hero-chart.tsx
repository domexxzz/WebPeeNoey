/**
 * ภาพประกอบหน้าจอกราฟ + เส้นอินดิเคเตอร์ (SVG วาดเอง) — ใช้อธิบายลักษณะเครื่องมือเท่านั้น
 * ห้ามใส่ตัวเลข ราคา กำไร หรือข้อความใด ๆ ที่สื่อถึงผลการเทรดจริง (CLAUDE.md ข้อ 3)
 * animated = แท่งงอกขึ้นทีละแท่ง → เส้นอินดิเคเตอร์วาดตัวเอง → จุดสังเกตเด้ง → เส้นสแกนวนตลอด (src/styles/motion-art.css)
 */
import { indexStyle } from "@/lib/motion";

const WIDTH = 640;
const HEIGHT = 400;
const CHART_TOP = 64;
const CHART_BOTTOM = 300;
const CANDLE_COUNT = 30;
const STEP = (WIDTH - 72) / CANDLE_COUNT;

/** ราคาสมมติแบบกำหนดตายตัว (ไม่สุ่ม) — แนวโน้มขึ้นเล็กน้อยพร้อมการแกว่ง */
const CLOSES = Array.from({ length: CANDLE_COUNT + 1 }, (_, index) => 0.25 + index * 0.017 + Math.sin(index * 0.9) * 0.07 + Math.sin(index * 2.3) * 0.035);

const toY = (value: number) => CHART_BOTTOM - value * (CHART_BOTTOM - CHART_TOP);

const CANDLES = CLOSES.slice(1).map((close, index) => {
  const open = CLOSES[index];
  const wick = 0.03 + Math.abs(Math.sin(index * 1.7)) * 0.04;
  return { x: 40 + index * STEP, open, close, high: Math.max(open, close) + wick, low: Math.min(open, close) - wick };
});

/** เส้นค่าเฉลี่ย 4 แท่ง — แทนเส้นอินดิเคเตอร์ */
const SMOOTHED = CANDLES.map((_, index) => {
  const window = CANDLES.slice(Math.max(0, index - 3), index + 1);
  return window.reduce((sum, candle) => sum + candle.close, 0) / window.length;
});
const linePath = SMOOTHED.map((value, index) => `${index === 0 ? "M" : "L"}${CANDLES[index].x + 5} ${toY(value).toFixed(1)}`).join(" ");
const bandPath = [
  ...SMOOTHED.map((value, index) => `${index === 0 ? "M" : "L"}${CANDLES[index].x + 5} ${toY(value + 0.09).toFixed(1)}`),
  ...SMOOTHED.slice()
    .reverse()
    .map((value, index) => `L${CANDLES[CANDLES.length - 1 - index].x + 5} ${toY(value - 0.09).toFixed(1)}`),
  "Z",
].join(" ");

/** จุดที่เส้นราคาตัดเส้นอินดิเคเตอร์ขึ้น — แสดงเป็นสัญลักษณ์ "จุดสังเกต" */
const MARKERS = CANDLES.filter((candle, index) => index > 3 && candle.close > SMOOTHED[index] && CANDLES[index - 1].close <= SMOOTHED[index - 1]);

const LAST = CANDLES.length - 1;

export function HeroChart({ className = "", animated = false }: { className?: string; animated?: boolean }) {
  const cls = (name: string) => (animated ? name : undefined);
  return (
    <svg aria-hidden="true" focusable="false" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className={`${animated ? "hc-anim " : ""}${className}`.trim()}>
      <rect x="0.5" y="0.5" width={WIDTH - 1} height={HEIGHT - 1} fill="#0C0E0D" stroke="rgba(255,255,255,0.6)" />
      {/* แถบหัวหน้าต่าง */}
      <line x1="0" x2={WIDTH} y1="40" y2="40" stroke="rgba(255,255,255,0.14)" />
      {[18, 32, 46].map((x) => (
        <rect key={x} x={x} y="15" width="9" height="9" fill="none" stroke="rgba(255,255,255,0.45)" />
      ))}
      <rect x="70" y="16" width="120" height="7" fill="rgba(255,255,255,0.12)" />
      <rect className={cls("hc-pill")} x={WIDTH - 110} y="14" width="88" height="12" fill="#6EEA6E" />

      {[0.2, 0.4, 0.6, 0.8].map((ratio) => (
        <line key={ratio} x1="24" x2={WIDTH - 24} y1={CHART_TOP + ratio * (CHART_BOTTOM - CHART_TOP)} y2={CHART_TOP + ratio * (CHART_BOTTOM - CHART_TOP)} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 6" />
      ))}

      <path className={cls("hc-band")} d={bandPath} fill="rgba(110,234,110,0.08)" />

      {CANDLES.map((candle, index) => {
        const rising = candle.close >= candle.open;
        const top = toY(Math.max(candle.open, candle.close));
        const height = Math.max(Math.abs(toY(candle.open) - toY(candle.close)), 2);
        return (
          <g key={candle.x} className={cls("hc-candle")} style={animated ? indexStyle(index) : undefined}>
            <g className={index === LAST ? cls("hc-breathe") : undefined}>
              <line x1={candle.x + 5} x2={candle.x + 5} y1={toY(candle.high)} y2={toY(candle.low)} stroke={rising ? "#6EEA6E" : "rgba(255,255,255,0.55)"} strokeWidth="1.5" />
              <rect x={candle.x} y={top} width="10" height={height} fill={rising ? "#6EEA6E" : "#0C0E0D"} stroke={rising ? "#6EEA6E" : "rgba(255,255,255,0.55)"} />
            </g>
          </g>
        );
      })}

      <path className={cls("hc-line")} d={linePath} pathLength={animated ? 1 : undefined} fill="none" stroke="#FFFFFF" strokeWidth="2" />

      {MARKERS.map((candle, index) => (
        <g key={candle.x} style={animated ? indexStyle(index) : undefined}>
          {animated && <circle className="hc-ping" cx={candle.x + 5} cy={toY(candle.low) + 18} r="9" fill="none" stroke="#6EEA6E" strokeWidth="1.5" />}
          <path className={cls("hc-marker")} d={`M${candle.x + 5} ${toY(candle.low) + 12} l7 12 h-14 z`} fill="#6EEA6E" />
        </g>
      ))}

      {animated && (
        <g className="hc-scan">
          <line x1="34" x2="34" y1="48" y2="384" stroke="#6EEA6E" strokeWidth="1.5" strokeDasharray="4 4" />
          <rect x="24" y="48" width="20" height="336" fill="rgba(110,234,110,0.07)" />
          <rect x="29" y="44" width="10" height="10" fill="#6EEA6E" />
        </g>
      )}

      {/* แท่งปริมาณ */}
      <line x1="24" x2={WIDTH - 24} y1="318" y2="318" stroke="rgba(255,255,255,0.14)" />
      {CANDLES.map((candle, index) => (
        <rect key={`v-${candle.x}`} className={cls("hc-vol")} style={animated ? indexStyle(index) : undefined} x={candle.x} y={378 - (14 + Math.abs(Math.sin(index * 1.3)) * 40)} width="10" height={14 + Math.abs(Math.sin(index * 1.3)) * 40} fill="rgba(255,255,255,0.16)" />
      ))}
    </svg>
  );
}
