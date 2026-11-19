import { useState } from "react";
import type { BaselineInfo, RoutePriceCalendar } from "../types";
import { formatKRW } from "../utils/format";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function dayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${WEEKDAYS[d.getUTCDay()]})`;
}

interface PriceCalendarStripProps {
  calendar: RoutePriceCalendar;
  baseline: BaselineInfo;
  currentDepDate: string;
  cityLabel?: string;
}

/** 출발일별 최저가 막대. 평소 가격(중간값) 선과 가장 싼 날을 함께 보여준다. */
export function PriceCalendarStrip({
  calendar,
  baseline,
  currentDepDate,
  cityLabel,
}: PriceCalendarStripProps) {
  const [hover, setHover] = useState<string | null>(null);
  const days = calendar.days;
  if (days.length === 0) return null;

  const prices = days.map((d) => d.price);
  const max = Math.max(...prices);
  const min = Math.min(...prices);
  const lo = Math.max(0, min - (max - min) * 0.25);
  const range = Math.max(1, max - lo);
  const heightOf = (p: number) => 12 + ((p - lo) / range) * 52;
  const medianH = heightOf(calendar.median);

  const sorted = [...days].sort((a, b) => a.price - b.price);
  const cheapest = sorted[0];
  const hovered = hover ? days.find((d) => d.date === hover) : null;
  const focus = hovered ?? cheapest;
  const focusDrop = Math.round(
    ((calendar.median - focus.price) / calendar.median) * 100
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-neutral-700">
          출발일별 최저가{cityLabel ? ` · ${cityLabel}` : ""}
        </span>
        <span className="text-[11px] font-mono tabular-nums text-neutral-400">
          {days.length}/{calendar.totalDates}일 · 평소 {formatKRW(calendar.median)}
        </span>
      </div>

      <div
        className="relative h-[68px] flex items-end gap-px"
        onMouseLeave={() => setHover(null)}
      >
        <div
          className="absolute left-0 right-0 border-t border-dashed border-neutral-300 pointer-events-none"
          style={{ bottom: medianH }}
        />
        {days.map((d) => {
          const isMin = d.date === cheapest.date;
          const isCurrent = d.date === currentDepDate;
          const below = d.price < calendar.median;
          return (
            <button
              type="button"
              key={d.date}
              onMouseEnter={() => setHover(d.date)}
              onFocus={() => setHover(d.date)}
              onClick={() => setHover(d.date)}
              className={`flex-1 min-w-[3px] rounded-t-sm cursor-pointer transition-opacity ${
                isMin
                  ? "bg-emerald-500"
                  : isCurrent
                  ? "bg-neutral-900"
                  : below
                  ? "bg-emerald-200"
                  : "bg-neutral-200"
              } ${hover && hover !== d.date ? "opacity-60" : ""}`}
              style={{ height: heightOf(d.price) }}
              aria-label={`${dayLabel(d.date)} 출발 ${formatKRW(d.price)}`}
            />
          );
        })}
      </div>

      <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-neutral-400">
        <span>{dayLabel(days[0].date)}</span>
        <span>{dayLabel(days[days.length - 1].date)}</span>
      </div>

      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-neutral-500">
          {hovered ? "" : "가장 싼 날 · "}
          {dayLabel(focus.date)}~{dayLabel(focus.retDate)}
        </span>
        <span className="font-mono tabular-nums">
          <span className={focusDrop > 0 ? "text-emerald-600 font-medium" : "text-neutral-900"}>
            {formatKRW(focus.price)}
          </span>
          <span className="text-neutral-400 ml-1.5">
            {focusDrop > 0 ? `평소보다 -${focusDrop}%` : focusDrop < 0 ? `평소보다 +${Math.abs(focusDrop)}%` : "평소 수준"}
          </span>
        </span>
      </div>

      {baseline.weekChangePercent !== null &&
        Math.abs(baseline.weekChangePercent) >= 5 && (
          <div className="text-[11px] text-neutral-500">
            이 기간 평소가가 1주 전보다{" "}
            {Math.abs(baseline.weekChangePercent)}%{" "}
            {baseline.weekChangePercent < 0 ? "내렸어요 (세일 가능성)" : "올랐어요"}
          </div>
        )}
    </div>
  );
}
