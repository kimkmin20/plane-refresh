import { useState } from "react";
import type { PricePoint } from "../types";
import { formatClockTime, formatKRW, formatShortDate } from "../utils/format";

interface PriceChartProps {
  history: PricePoint[];
  baselinePrice: number;
  targetPrice: number | null;
  thresholdPercent: number;
}

export function PriceChart({
  history,
  baselinePrice,
  targetPrice,
  thresholdPercent,
}: PriceChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const width = 380;
  const height = 168;
  const padLeft = 8;
  const padRight = 8;
  const padTop = 18;
  const padBottom = 22;

  if (!history || history.length === 0) {
    return (
      <div className="h-[168px] flex items-center justify-center border border-neutral-200 rounded-md text-xs text-neutral-400">
        기록된 시세 없음
      </div>
    );
  }

  const thresholdPrice =
    baselinePrice > 0
      ? Math.round((baselinePrice * (1 - thresholdPercent / 100)) / 100) * 100
      : null;

  const prices = history.map((h) => h.price);
  const refPrices = [
    ...prices,
    ...(baselinePrice > 0 ? [baselinePrice] : []),
    ...(thresholdPrice && thresholdPrice > 0 ? [thresholdPrice] : []),
    ...(targetPrice && targetPrice > 0 ? [targetPrice] : []),
  ];

  const rawMin = Math.min(...refPrices);
  const rawMax = Math.max(...refPrices);
  const spread = Math.max(10000, rawMax - rawMin);
  const minVal = Math.max(0, rawMin - spread * 0.14);
  const maxVal = rawMax + spread * 0.14;
  const range = Math.max(1, maxVal - minVal);

  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const toX = (idx: number) =>
    history.length === 1
      ? padLeft + innerW / 2
      : padLeft + (idx / (history.length - 1)) * innerW;

  const toY = (val: number) =>
    padTop + innerH - ((val - minVal) / range) * innerH;

  const linePoints =
    history.length === 1
      ? `${padLeft},${toY(history[0].price)} ${width - padRight},${toY(
          history[0].price
        )}`
      : history.map((pt, i) => `${toX(i).toFixed(1)},${toY(pt.price).toFixed(1)}`).join(" ");

  const activePoint =
    hoverIdx !== null && history[hoverIdx]
      ? history[hoverIdx]
      : history[history.length - 1];

  const baselineY = baselinePrice > 0 ? toY(baselinePrice) : null;
  const dealLineValue =
    targetPrice && targetPrice > 0
      ? Math.max(thresholdPrice ?? 0, targetPrice)
      : thresholdPrice;
  const dealLineY = dealLineValue && dealLineValue > 0 ? toY(dealLineValue) : null;

  return (
    <div className="select-none">
      <div className="flex items-baseline justify-between mb-2 text-xs">
        <div className="font-mono tabular-nums text-neutral-900 font-medium truncate pr-2">
          {formatKRW(activePoint.price)}
          <span className="text-neutral-400 font-normal ml-2">
            {activePoint.destCity ? `${activePoint.destCity} · ` : ""}
            {formatShortDate(activePoint.depDate)}–{formatShortDate(activePoint.retDate)} ·{" "}
            {activePoint.airline}
          </span>
        </div>
        <div className="font-mono tabular-nums text-neutral-400 shrink-0">
          {formatClockTime(activePoint.timestamp)}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-[168px] border border-neutral-200 rounded-md bg-neutral-50/50"
        onMouseLeave={() => setHoverIdx(null)}
      >
        {baselineY !== null && (
          <g>
            <line
              x1={padLeft}
              y1={baselineY}
              x2={width - padRight}
              y2={baselineY}
              stroke="#9CA3AF"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <text
              x={width - padRight - 2}
              y={Math.max(11, baselineY - 4)}
              textAnchor="end"
              className="fill-neutral-400 text-[9px] font-mono"
            >
              평소 {formatKRW(baselinePrice)}
            </text>
          </g>
        )}

        {dealLineY !== null && dealLineValue && (
          <g>
            <line
              x1={padLeft}
              y1={dealLineY}
              x2={width - padRight}
              y2={dealLineY}
              stroke="#059669"
              strokeOpacity={0.45}
              strokeWidth={1}
              strokeDasharray="2 2"
            />
            <text
              x={padLeft + 2}
              y={Math.min(height - 6, dealLineY + 10)}
              textAnchor="start"
              className="fill-emerald-700/75 text-[9px] font-mono"
            >
              알림선 {formatKRW(dealLineValue)}
            </text>
          </g>
        )}

        <polyline
          fill="none"
          stroke="#111827"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          points={linePoints}
        />

        {history.map((pt, idx) => {
          const cx = toX(idx);
          const cy = toY(pt.price);
          const isBelowDeal =
            dealLineValue !== null && dealLineValue !== undefined && pt.price <= dealLineValue;
          const isHovered = hoverIdx === idx;

          return (
            <g key={`${pt.timestamp}-${idx}`}>
              <circle
                cx={cx}
                cy={cy}
                r={isHovered ? 4.5 : 2.8}
                fill={isBelowDeal ? "#059669" : "#111827"}
                stroke="#FFFFFF"
                strokeWidth={1.2}
              />
              <rect
                x={cx - Math.max(14, innerW / Math.max(2, history.length) / 2)}
                y={0}
                width={Math.max(28, innerW / Math.max(2, history.length))}
                height={height}
                fill="transparent"
                className="cursor-crosshair"
                onMouseEnter={() => setHoverIdx(idx)}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
