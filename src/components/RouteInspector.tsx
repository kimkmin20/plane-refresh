import { useState, useEffect } from "react";
import {
  ExternalLink,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  Zap,
} from "lucide-react";
import { isAnywhereCode } from "../data/airports";
import type { AnywhereDealItem, WatchRoute } from "../types";
import {
  calcDropPercent,
  formatKRW,
  formatRelativeTime,
  formatShortDate,
  formatStayLabel,
} from "../utils/format";
import { PriceCalendarStrip } from "./PriceCalendarStrip";
import { PriceChart } from "./PriceChart";

interface RouteInspectorProps {
  route: WatchRoute | null;
  isChecking: boolean;
  onCheckNow: (routeId: string) => void;
  onSimulateDrop: (routeId: string) => void;
  onToggleActive: (routeId: string) => void;
  onDelete: (routeId: string) => void;
  onPinAnywhereDeal: (parentRoute: WatchRoute, deal: AnywhereDealItem) => void;
  onUpdateSettings: (
    routeId: string,
    patch: {
      dropThresholdPercent?: number;
      targetPrice?: number | null;
      checkIntervalMinutes?: number;
    }
  ) => void;
}

export function RouteInspector({
  route,
  isChecking,
  onCheckNow,
  onSimulateDrop,
  onToggleActive,
  onDelete,
  onPinAnywhereDeal,
  onUpdateSettings,
}: RouteInspectorProps) {
  const [targetDraft, setTargetDraft] = useState("");

  useEffect(() => {
    setTargetDraft(route?.targetPrice ? String(route.targetPrice) : "");
  }, [route?.id, route?.targetPrice]);

  if (!route) {
    return (
      <div className="h-full min-h-[360px] flex items-center justify-center text-xs text-neutral-400">
        노선을 선택하세요
      </div>
    );
  }

  const isAnywhere = isAnywhereCode(route.destCode);
  const dropPct = calcDropPercent(route.baselinePrice, route.currentPrice);
  const diffAmount = route.baselinePrice - route.currentPrice;
  const baseline = route.baselineInfo;
  const hasCalendarBaseline = !baseline || baseline.source === "calendar";
  const calendar =
    baseline && baseline.source === "calendar"
      ? route.calendars?.[baseline.destCode] ?? null
      : null;
  const isDeal =
    (hasCalendarBaseline &&
      dropPct >= route.dropThresholdPercent &&
      route.currentPrice > 0) ||
    (route.targetPrice !== null &&
      route.currentPrice > 0 &&
      route.currentPrice <= route.targetPrice);

  const commitTargetDraft = () => {
    const cleaned = targetDraft.trim().replace(/[^\d]/g, "");
    if (!cleaned) {
      if (route.targetPrice !== null) {
        onUpdateSettings(route.id, { targetPrice: null });
      }
      return;
    }
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed) && parsed >= 10000) {
      onUpdateSettings(route.id, { targetPrice: parsed });
    } else {
      setTargetDraft(route.targetPrice ? String(route.targetPrice) : "");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-2 flex-wrap">
            <h2 className="text-lg font-semibold font-mono tracking-tight text-neutral-900">
              {route.originCode} → {isAnywhere ? "ANYWHERE" : route.destCode}
            </h2>
            <span className="text-xs text-neutral-500">
              {route.originCity} · {route.destCity}
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-500 font-mono tabular-nums">
            {route.periodMode === "flexible"
              ? `${formatShortDate(route.startDate)}–${formatShortDate(
                  route.endDate
                )} 중 ${formatStayLabel(route.stayNights, route.stayNightsMax)}`
              : `${formatShortDate(route.startDate, true)} – ${formatShortDate(
                  route.endDate,
                  true
                )}`}
            {" · "}
            {route.directOnly ? "직항" : "경유 포함"}
            {" · "}
            {route.isActive ? `${route.checkIntervalMinutes}분 주기` : "일시정지"}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onToggleActive(route.id)}
            className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors cursor-pointer"
            title={route.isActive ? "감시 일시정지" : "감시 재개"}
            aria-label={route.isActive ? "감시 일시정지" : "감시 재개"}
          >
            {route.isActive ? (
              <Pause className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => onDelete(route.id)}
            className="p-2 text-neutral-400 hover:text-red-600 hover:bg-neutral-100 rounded-md transition-colors cursor-pointer"
            title="노선 삭제"
            aria-label="노선 삭제"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Price Metrics */}
      <div className="grid grid-cols-3 gap-4 py-3.5 border-y border-neutral-200">
        <div>
          <div className="text-[11px] text-neutral-400">
            {isAnywhere ? "최저가 여행지" : "현재 최저가"}
          </div>
          <div
            className={`mt-0.5 text-base font-semibold font-mono tabular-nums ${
              isDeal ? "text-emerald-600" : "text-neutral-900"
            }`}
          >
            {route.currentPrice > 0 ? formatKRW(route.currentPrice) : "조회 중"}
          </div>
          {isAnywhere && route.discoveredDestCity && (
            <div className="text-[11px] text-neutral-500 truncate">
              {route.discoveredDestCity} ({route.discoveredDestCode})
            </div>
          )}
        </div>
        <div>
          <div className="text-[11px] text-neutral-400">평소 가격</div>
          <div className="mt-0.5 text-base font-mono tabular-nums text-neutral-600">
            {route.baselinePrice > 0 ? formatKRW(route.baselinePrice) : "—"}
          </div>
          {baseline && (
            <div className="text-[11px] text-neutral-400">
              {baseline.source === "calendar"
                ? `출발일 ${baseline.sampleDates}개 중간값`
                : "추정치 · 목표가 알림만"}
            </div>
          )}
        </div>
        <div>
          <div className="text-[11px] text-neutral-400">평소 대비</div>
          <div
            className={`mt-0.5 text-base font-medium font-mono tabular-nums ${
              dropPct > 0
                ? isDeal
                  ? "text-emerald-600"
                  : "text-neutral-900"
                : dropPct < 0
                ? "text-amber-600"
                : "text-neutral-500"
            }`}
          >
            {route.currentPrice > 0 && route.baselinePrice > 0
              ? dropPct > 0
                ? `-${dropPct}%`
                : dropPct < 0
                ? `+${Math.abs(dropPct)}%`
                : "0%"
              : "—"}
          </div>
          {route.currentPrice > 0 && diffAmount > 0 && (
            <div className="text-[11px] font-mono tabular-nums text-neutral-400">
              {formatKRW(diffAmount)} 절감
            </div>
          )}
        </div>
      </div>

      {/* Best Detected Date Combination */}
      {route.currentPrice > 0 && (
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="text-neutral-500 shrink-0">최저가 일정</div>
          <div className="font-mono tabular-nums text-neutral-900 text-right truncate">
            {isAnywhere && route.discoveredDestCity
              ? `${route.discoveredDestCity} · `
              : ""}
            {formatShortDate(route.bestDepDate, true)} –{" "}
            {formatShortDate(route.bestRetDate, true)}
            {route.airline ? ` · ${route.airline}` : ""}
          </div>
        </div>
      )}

      {/* 출발일별 최저가 달력 */}
      {calendar && baseline && (
        <div className="pt-1">
          <PriceCalendarStrip
            calendar={calendar}
            baseline={baseline}
            currentDepDate={route.bestDepDate}
            cityLabel={
              isAnywhere
                ? (route.discoveredDestCity || baseline.destCode).replace(/\s*\(어디든지\)/, "")
                : undefined
            }
          />
        </div>
      )}

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={isChecking}
          onClick={() => onCheckNow(route.id)}
          className="h-9 px-3 flex items-center justify-center gap-1.5 text-xs font-medium bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50 rounded-md transition-colors whitespace-nowrap cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? "animate-spin" : ""}`} />
          <span>{isChecking ? "조회 중" : "실시간 조회"}</span>
        </button>

        <button
          type="button"
          disabled={isChecking}
          onClick={() => onSimulateDrop(route.id)}
          className="h-9 px-3 flex items-center justify-center gap-1.5 text-xs font-medium border border-neutral-200 text-neutral-800 hover:bg-neutral-50 disabled:opacity-50 rounded-md transition-colors whitespace-nowrap cursor-pointer"
        >
          <Zap className="w-3.5 h-3.5 text-emerald-600" />
          <span>특가 테스트</span>
        </button>
      </div>

      {route.errorMessage && (
        <p className="text-xs text-red-600 break-words">{route.errorMessage}</p>
      )}

      {/* Anywhere Ranked Destinations List */}
      {isAnywhere && route.anywhereDeals && route.anywhereDeals.length > 0 && (
        <div className="pt-4 border-t border-neutral-200 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-700">
              어디든지 도시별 최저가
            </span>
            <span className="text-[11px] font-mono tabular-nums text-neutral-400">
              {route.anywhereDeals.length}개 도시
            </span>
          </div>

          <div className="divide-y divide-neutral-100 border-y border-neutral-200 max-h-64 overflow-y-auto">
            {route.anywhereDeals.map((deal) => (
              <div
                key={`${deal.destCode}-${deal.depDate}`}
                className="py-2.5 flex items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono font-semibold text-neutral-900">
                      {deal.destCode}
                    </span>
                    <span className="text-neutral-800 font-medium truncate">
                      {deal.destCity}
                    </span>
                    <span className="text-[11px] text-neutral-400 truncate">
                      {deal.destCountry}
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-400 font-mono tabular-nums truncate">
                    {formatShortDate(deal.depDate)}–{formatShortDate(deal.retDate)} ·{" "}
                    {deal.airline}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <a
                    href={deal.bookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono tabular-nums font-semibold text-neutral-900 hover:text-emerald-600 hover:underline"
                    title="예약 페이지 열기"
                  >
                    {formatKRW(deal.price)}
                  </a>
                  <button
                    type="button"
                    onClick={() => onPinAnywhereDeal(route, deal)}
                    className="h-6 px-1.5 flex items-center gap-0.5 text-[11px] text-neutral-500 hover:text-neutral-900 border border-neutral-200 rounded transition-colors cursor-pointer"
                    title="이 도시 전용 감시 추가"
                  >
                    <Plus className="w-3 h-3" />
                    <span>감시</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chart */}
      <div className={isAnywhere ? "pt-2" : ""}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-neutral-700">시세 추이</span>
          <span className="text-[11px] font-mono tabular-nums text-neutral-400">
            최근 조회 {formatRelativeTime(route.lastCheckedAt)}
          </span>
        </div>
        <PriceChart
          history={route.history}
          baselinePrice={route.baselinePrice}
          targetPrice={route.targetPrice}
          thresholdPercent={route.dropThresholdPercent}
        />
      </div>

      {/* Inline Alert Threshold Controls */}
      <div className="pt-4 border-t border-neutral-200 space-y-3">
        <div className="text-xs font-medium text-neutral-700">알림 조건</div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="block text-[11px] text-neutral-400 mb-1">
              평소 대비 하락률
            </label>
            <select
              value={route.dropThresholdPercent}
              onChange={(e) =>
                onUpdateSettings(route.id, {
                  dropThresholdPercent: Number(e.target.value),
                })
              }
              className="w-full h-9 px-2 text-xs font-mono tabular-nums border border-neutral-200 rounded-md bg-white text-neutral-900 focus:outline-none focus:border-neutral-900"
            >
              {[5, 10, 15, 20, 25, 30, 35].map((pct) => (
                <option key={pct} value={pct}>
                  -{pct}% 이하
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-neutral-400 mb-1">
              희망 상한가 (원)
            </label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="미지정"
              value={targetDraft}
              onChange={(e) => setTargetDraft(e.target.value.replace(/[^\d]/g, ""))}
              onBlur={commitTargetDraft}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                }
              }}
              className="w-full h-9 px-2.5 text-xs font-mono tabular-nums border border-neutral-200 rounded-md text-neutral-900 focus:outline-none focus:border-neutral-900"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] text-neutral-400 mb-1">조회 주기</label>
          <div className="grid grid-cols-4 gap-1.5">
            {[5, 15, 30, 60].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() =>
                  onUpdateSettings(route.id, { checkIntervalMinutes: m })
                }
                className={`h-8 text-xs font-mono tabular-nums rounded border transition-colors whitespace-nowrap cursor-pointer ${
                  route.checkIntervalMinutes === m
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-200 text-neutral-600 hover:border-neutral-400"
                }`}
              >
                {m === 60 ? "1시간" : `${m}분`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Booking / Comparison Links */}
      {route.sources.length > 0 && (
        <div className="pt-4 border-t border-neutral-200 space-y-2">
          <div className="text-xs font-medium text-neutral-700">항공권 확인</div>
          <div className="space-y-1.5">
            {route.sources.map((src, i) => (
              <a
                key={`${src.uri}-${i}`}
                href={src.uri}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between py-1.5 text-xs text-neutral-600 hover:text-neutral-900 transition-colors group"
              >
                <span className="truncate pr-3 group-hover:underline">
                  {src.title}
                </span>
                <ExternalLink className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-900 shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
