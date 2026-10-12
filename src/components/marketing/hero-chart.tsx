/**
 * ภาพประกอบหน้าจอกราฟ + เส้นอินดิเคเตอร์ (SVG วาดเอง) — ใช้อธิบายลักษณะเครื่องมือเท่านั้น
 * ห้ามใส่ตัวเลข ราคา กำไร หรือข้อความใด ๆ ที่สื่อถึงผลการเทรดจริง (CLAUDE.md ข้อ 3)
 */
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

export function HeroChart({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className={className}>
      <rect x="0.5" y="0.5" width={WIDTH - 1} height={HEIGHT - 1} fill="#0C0E0D" stroke="rgba(255,255,255,0.6)" />
      {/* แถบหัวหน้าต่าง */}
      <line x1="0" x2={WIDTH} y1="40" y2="40" stroke="rgba(255,255,255,0.14)" />
      {[18, 32, 46].map((x) => (
        <rect key={x} x={x} y="15" width="9" height="9" fill="none" stroke="rgba(255,255,255,0.45)" />
      ))}
      <rect x="70" y="16" width="120" height="7" fill="rgba(255,255,255,0.12)" />
      <rect x={WIDTH - 110} y="14" width="88" height="12" fill="#6EEA6E" />

      {[0.2, 0.4, 0.6, 0.8].map((ratio) => (
        <line key={ratio} x1="24" x2={WIDTH - 24} y1={CHART_TOP + ratio * (CHART_BOTTOM - CHART_TOP)} y2={CHART_TOP + ratio * (CHART_BOTTOM - CHART_TOP)} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 6" />
      ))}

      <path d={bandPath} fill="rgba(110,234,110,0.08)" />

      {CANDLES.map((candle) => {
        const rising = candle.close >= candle.open;
        const top = toY(Math.max(candle.open, candle.close));
        const height = Math.max(Math.abs(toY(candle.open) - toY(candle.close)), 2);
        return (
          <g key={candle.x}>
            <line x1={candle.x + 5} x2={candle.x + 5} y1={toY(candle.high)} y2={toY(candle.low)} stroke={rising ? "#6EEA6E" : "rgba(255,255,255,0.55)"} strokeWidth="1.5" />
            <rect x={candle.x} y={top} width="10" height={height} fill={rising ? "#6EEA6E" : "#0C0E0D"} stroke={rising ? "#6EEA6E" : "rgba(255,255,255,0.55)"} />
          </g>
        );
      })}

      <path d={linePath} fill="none" stroke="#FFFFFF" strokeWidth="2" />

      {MARKERS.map((candle) => (
        <path key={candle.x} d={`M${candle.x + 5} ${toY(candle.low) + 12} l7 12 h-14 z`} fill="#6EEA6E" />
      ))}

      {/* แท่งปริมาณ */}
      <line x1="24" x2={WIDTH - 24} y1="318" y2="318" stroke="rgba(255,255,255,0.14)" />
      {CANDLES.map((candle, index) => (
        <rect key={`v-${candle.x}`} x={candle.x} y={378 - (14 + Math.abs(Math.sin(index * 1.3)) * 40)} width="10" height={14 + Math.abs(Math.sin(index * 1.3)) * 40} fill="rgba(255,255,255,0.16)" />
      ))}
    </svg>
  );
}
