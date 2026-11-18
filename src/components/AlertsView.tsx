import { CheckCheck, ExternalLink, Trash2 } from "lucide-react";
import type { DealAlert } from "../types";
import { formatKRW, formatRelativeTime, formatShortDate } from "../utils/format";

interface AlertsViewProps {
  alerts: DealAlert[];
  onSelectAlertRoute: (routeId: string, alertId: string) => void;
  onMarkAllRead: () => void;
  onClearAll: () => void;
}

export function AlertsView({
  alerts,
  onSelectAlertRoute,
  onMarkAllRead,
  onClearAll,
}: AlertsViewProps) {
  const unreadCount = alerts.filter((a) => !a.isRead).length;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
        <div className="text-xs text-neutral-500 font-mono tabular-nums">
          총 {alerts.length}건 · 미확인 {unreadCount}건
        </div>
        {alerts.length > 0 && (
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="flex items-center gap-1 text-xs text-neutral-600 hover:text-neutral-900 transition-colors whitespace-nowrap cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>모두 읽음</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClearAll}
              className="flex items-center gap-1 text-xs text-neutral-400 hover:text-red-600 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>비우기</span>
            </button>
          </div>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="py-20 text-center text-xs text-neutral-400">
          발생한 특가 알림이 없습니다
        </div>
      ) : (
        <div className="divide-y divide-neutral-200 border-b border-neutral-200">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              onClick={() => onSelectAlertRoute(alert.routeId, alert.id)}
              className={`py-4 px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition-colors hover:bg-neutral-50 ${
                !alert.isRead ? "bg-emerald-50/30" : ""
              }`}
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-baseline gap-2.5 flex-wrap">
                  <span
                    className={`text-sm font-mono tracking-tight ${
                      !alert.isRead
                        ? "font-semibold text-neutral-900"
                        : "font-medium text-neutral-700"
                    }`}
                  >
                    {alert.originCode} → {alert.destCode}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {alert.originCity} · {alert.destCity}
                  </span>
                  <span className="text-xs text-neutral-400 font-mono tabular-nums">
                    · {formatShortDate(alert.depDate, true)} –{" "}
                    {formatShortDate(alert.retDate, true)}
                  </span>
                  {alert.airline && (
                    <span className="text-xs text-neutral-500">
                      · {alert.airline}
                    </span>
                  )}
                  {alert.isSimulated && (
                    <span className="text-[11px] text-neutral-400">· 테스트</span>
                  )}
                </div>

                <div className="text-xs text-neutral-400 font-mono tabular-nums">
                  {formatRelativeTime(alert.createdAt)} · 평소{" "}
                  {formatKRW(alert.baselinePrice)} 대비{" "}
                  {formatKRW(alert.baselinePrice - alert.dealPrice)} 절감
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right font-mono tabular-nums">
                  <div className="text-sm font-semibold text-emerald-600">
                    {formatKRW(alert.dealPrice)}
                  </div>
                  <div className="text-xs text-emerald-600">
                    -{alert.dropPercent}%
                  </div>
                </div>

                <a
                  href={alert.bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="p-2 text-neutral-400 hover:text-neutral-900 border border-neutral-200 rounded-md transition-colors"
                  title="항공권 검색 열기"
                  aria-label="항공권 검색 열기"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
