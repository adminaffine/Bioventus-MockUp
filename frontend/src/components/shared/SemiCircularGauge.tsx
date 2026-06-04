type Props = {
  value: number;
  max?: number;
  color: string;
  trackColor?: string;
  size?: number;
  strokeWidth?: number;
  /** Centered inside the semicircle (e.g. "74%"). */
  centerLabel?: string;
};

/** Semi-circular gauge (180° arc) — reliable SVG, no ResponsiveContainer sizing issues. */
export default function SemiCircularGauge({
  value,
  max = 100,
  color,
  trackColor = "currentColor",
  size = 140,
  strokeWidth = 12,
  centerLabel,
}: Props) {
  const pct = max <= 0 ? 0 : Math.min(100, (value / max) * 100);
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2 + 8;
  const startAngle = Math.PI;
  const endAngle = 0;
  const sweep = startAngle - (pct / 100) * Math.PI;
  const svgHeight = size / 2 + strokeWidth + 12;
  const labelY = cy - radius * 0.38;
  const fontSize = Math.round(size * 0.19);

  const trackPath = describeArc(cx, cy, radius, startAngle, endAngle);
  const valuePath = pct > 0 ? describeArc(cx, cy, radius, startAngle, sweep) : "";

  return (
    <svg
      width={size}
      height={svgHeight}
      viewBox={`0 0 ${size} ${svgHeight}`}
      className="overflow-visible"
      aria-hidden={!centerLabel}
      role={centerLabel ? "img" : undefined}
      aria-label={centerLabel ? `${centerLabel} performance` : undefined}
    >
      <path
        d={trackPath}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        className="stroke-slate-200 dark:stroke-slate-600"
        stroke={trackColor !== "currentColor" ? trackColor : undefined}
      />
      {valuePath ? (
        <path
          d={valuePath}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      ) : null}
      {centerLabel ? (
        <text
          x={cx}
          y={labelY}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={color}
          fontSize={fontSize}
          fontWeight={700}
          className="tabular-nums"
        >
          {centerLabel}
        </text>
      ) : null}
    </svg>
  );
}

function polar(cx: number, cy: number, r: number, angle: number) {
  return {
    x: cx + r * Math.cos(angle),
    y: cy - r * Math.sin(angle),
  };
}

function describeArc(cx: number, cy: number, r: number, start: number, end: number) {
  const startPt = polar(cx, cy, r, start);
  const endPt = polar(cx, cy, r, end);
  const large = start - end > Math.PI ? 1 : 0;
  return `M ${startPt.x} ${startPt.y} A ${r} ${r} 0 ${large} 1 ${endPt.x} ${endPt.y}`;
}
