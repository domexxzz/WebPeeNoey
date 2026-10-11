/**
 * ลวดลายกราฟแท่งเทียนแบบนามธรรม — ใช้ตกแต่งเท่านั้น (aria-hidden)
 * ห้ามเพิ่มตัวเลข ราคา หรือป้ายกำกับที่สื่อถึงผลการเทรดจริง (CLAUDE.md ข้อ 3)
 */
const CANDLES = [
  { open: 70, close: 58, high: 52, low: 76 },
  { open: 58, close: 64, high: 54, low: 68 },
  { open: 64, close: 50, high: 46, low: 66 },
  { open: 50, close: 54, high: 44, low: 58 },
  { open: 54, close: 42, high: 38, low: 57 },
  { open: 42, close: 47, high: 36, low: 50 },
  { open: 47, close: 36, high: 31, low: 49 },
  { open: 36, close: 40, high: 30, low: 44 },
  { open: 40, close: 28, high: 24, low: 42 },
  { open: 28, close: 33, high: 22, low: 36 },
  { open: 33, close: 22, high: 17, low: 35 },
  { open: 22, close: 26, high: 15, low: 29 },
];

const CANDLE_GAP = 26;
const CANDLE_WIDTH = 12;

export function ChartDecoration({ className = "" }: { className?: string }) {
  const width = CANDLES.length * CANDLE_GAP + 10;
  return (
    <svg aria-hidden="true" focusable="false" viewBox={`0 0 ${width} 90`} preserveAspectRatio="none" className={className}>
      {[20, 45, 70].map((y) => (
        <line key={y} x1="0" x2={width} y1={y} y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 5" />
      ))}
      {CANDLES.map((candle, index) => {
        const x = index * CANDLE_GAP + 10;
        const isUp = candle.close < candle.open;
        const color = isUp ? "#10B981" : "#F59E0B";
        const top = Math.min(candle.open, candle.close);
        const height = Math.max(Math.abs(candle.open - candle.close), 2);
        return (
          <g key={x} opacity={0.35 + (index / CANDLES.length) * 0.5}>
            <line x1={x + CANDLE_WIDTH / 2} x2={x + CANDLE_WIDTH / 2} y1={candle.high} y2={candle.low} stroke={color} strokeWidth="1.5" />
            <rect x={x} y={top} width={CANDLE_WIDTH} height={height} rx="2" fill={color} fillOpacity={isUp ? 0.85 : 0.25} stroke={color} />
          </g>
        );
      })}
    </svg>
  );
}
