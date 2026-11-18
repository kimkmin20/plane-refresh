import type { PricePoint } from "../types";

interface SparklineProps {
  history: PricePoint[];
  baselinePrice: number;
  isDeal: boolean;
}

export function Sparkline({ history, baselinePrice, isDeal }: SparklineProps) {
  const width = 88;
  const height = 28;
  const padY = 4;

  if (!history || history.length === 0) {
    return (
      <svg width={width} height={height} className="overflow-visible" aria-hidden="true">
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="#E5E7EB"
          strokeWidth={1}
          strokeDasharray="2 2"
        />
      </svg>
    );
  }

  const values = history.map((p) => p.price);
  const allValues = baselinePrice > 0 ? [...values, baselinePrice] : values;
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const range = Math.max(1, maxVal - minVal);

  const toY = (val: number) =>
    height - padY - ((val - minVal) / range) * (height - padY * 2);

  const points =
    history.length === 1
      ? `0,${toY(history[0].price)} ${width},${toY(history[0].price)}`
      : history
          .map((pt, idx) => {
            const x = (idx / (history.length - 1)) * width;
            const y = toY(pt.price);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          })
          .join(" ");

  const baselineY = baselinePrice > 0 ? toY(baselinePrice) : null;
  const lastY = toY(history[history.length - 1].price);
  const strokeColor = isDeal ? "#059669" : "#111827";

  return (
    <svg width={width} height={height} className="overflow-visible shrink-0" aria-hidden="true">
      {baselineY !== null && (
        <line
          x1={0}
          y1={baselineY}
          x2={width}
          y2={baselineY}
          stroke="#D1D5DB"
          strokeWidth={1}
          strokeDasharray="2 2"
        />
      )}
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      <circle
        cx={width}
        cy={lastY}
        r={2.2}
        fill={strokeColor}
      />
    </svg>
  );
}
