export function Sparkline({
  data,
  up,
  width = 96,
  height = 32,
  className,
}: {
  data: number[];
  up: boolean;
  width?: number;
  height?: number;
  className?: string;
}) {
  if (!data || data.length < 2) return <div style={{ width, height }} className={className} />;
  const step = Math.max(1, Math.floor(data.length / 60));
  const pts = data.filter((_, i) => i % step === 0);
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const d = pts
    .map((v, i) => {
      const x = (i / (pts.length - 1)) * width;
      const y = height - ((v - min) / span) * (height - 2) - 1;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
  const stroke = up ? "var(--color-up, #16c784)" : "var(--color-down, #ea3943)";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label="7 day price trend"
    >
      <path d={d} fill="none" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
