import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  buildAnywhereCalendars,
  buildPriceCalendar,
  buildSkyscannerUrl,
  checkFlightRoute,
  sendNtfyNotification,
  type AnywhereDealItem,
  type PriceCalendar,
  type SourceLink,
} from "../shared/flightChecker.ts";

/** 날짜별 가격 달력(평소 가격 기준)을 다시 만드는 주기 */
const CALENDAR_TTL_MS = 6 * 60 * 60 * 1000;
/** 이미 알린 특가는 이만큼(5%) 더 싸져야 다시 알린다 */
const REALERT_EXTRA_DROP = 0.05;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const CONFIG_PATH = path.join(ROOT_DIR, "watch-config.json");
const STATE_PATH = path.join(ROOT_DIR, "public", "watch-state.json");

interface ConfigRoute {
  id: string;
  originCode: string;
  originCity: string;
  destCode: string;
  destCity: string;
  periodMode: "flexible" | "fixed";
  startDate: string;
  endDate: string;
  stayNights: number;
  stayNightsMax?: number;
  directOnly: boolean;
  dropThresholdPercent: number;
  targetPrice: number | null;
  checkIntervalMinutes: number;
  isActive: boolean;
}

interface WatchConfig {
  ntfyServer?: string;
  ntfyTopic?: string;
  routes: ConfigRoute[];
}

interface PricePoint {
  timestamp: string;
  price: number;
  depDate: string;
  retDate: string;
  airline: string;
  destCode?: string;
  destCity?: string;
}

interface StoredCalendar extends PriceCalendar {
  key: string;
}

interface BaselineInfo {
  /** calendar: 출발일별 달력 중앙값 / estimate: 달력을 못 만들어 검색 결과로 추정 */
  source: "calendar" | "estimate";
  destCode: string;
  median: number;
  sampleDates: number;
  totalDates: number;
  periodStart: string;
  periodEnd: string;
  min: number | null;
  minDate: string | null;
  minRetDate: string | null;
  builtAt: string | null;
  weekChangePercent: number | null;
}

interface StoredRoute extends ConfigRoute {
  baselineInfo?: BaselineInfo;
  calendars?: Record<string, StoredCalendar>;
  calendarTrend?: Record<string, { at: string; median: number }[]>;
  lastAlertedByDest?: Record<string, number>;
  baselinePrice: number;
  currentPrice: number;
  bestDepDate: string;
  bestRetDate: string;
  airline: string;
  duration: string;
  discoveredDestCode?: string;
  discoveredDestCity?: string;
  anywhereDeals?: AnywhereDealItem[];
  lastCheckedAt: string | null;
  lastAlertedPrice: number | null;
  sources: SourceLink[];
  history: PricePoint[];
  errorMessage?: string | null;
}

interface DealAlert {
  id: string;
  routeId: string;
  originCode: string;
  originCity: string;
  destCode: string;
  destCity: string;
  baselinePrice: number;
  dealPrice: number;
  dropPercent: number;
  depDate: string;
  retDate: string;
  airline: string;
  createdAt: string;
  isRead: boolean;
  isSimulated: boolean;
  bookingUrl: string;
  baselineSource?: "calendar" | "estimate";
  periodMinPrice?: number | null;
  periodMinDate?: string | null;
  reason?: "drop" | "target" | "both";
}

interface WatchState {
  updatedAt: string | null;
  routes: StoredRoute[];
  alerts: DealAlert[];
}

function formatKRW(amount: number): string {
  return `₩${Math.round(amount).toLocaleString("ko-KR")}`;
}

function calcDropPercent(baseline: number, current: number): number {
  if (!baseline || !current || baseline <= 0) return 0;
  return Math.round(((baseline - current) / baseline) * 100);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function isAnywhere(code: string): boolean {
  return code === "ANYWHERE" || code === "ANYWHERE_ALL";
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
function shortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${WEEKDAYS[d.getUTCDay()]})`;
}

function calendarKey(cfg: ConfigRoute): string {
  return [
    cfg.originCode,
    cfg.destCode,
    cfg.startDate,
    cfg.endDate,
    cfg.stayNights,
    cfg.stayNightsMax ?? cfg.stayNights,
    cfg.directOnly ? "direct" : "any",
  ].join("|");
}

function weekChange(
  trend: { at: string; median: number }[] | undefined,
  currentMedian: number
): number | null {
  if (!trend || trend.length === 0 || currentMedian <= 0) return null;
  const target = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const old = trend.filter((t) => new Date(t.at).getTime() <= target + 12 * 60 * 60 * 1000);
  if (old.length === 0) return null;
  const ref = old[old.length - 1].median;
  if (ref <= 0) return null;
  return Math.round(((currentMedian - ref) / ref) * 100);
}

function readJson<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const testNtfyOnly = args.has("--test-ntfy") || process.env.TEST_NTFY === "true";

  const config = readJson<WatchConfig>(CONFIG_PATH, { routes: [] });
  const prevState = readJson<WatchState>(STATE_PATH, {
    updatedAt: null,
    routes: [],
    alerts: [],
  });

  const ntfyServer =
    (process.env.NTFY_SERVER || config.ntfyServer || "https://ntfy.sh").trim();
  const ntfyTopic = (process.env.NTFY_TOPIC || config.ntfyTopic || "").trim();

  if (testNtfyOnly) {
    if (!ntfyTopic) {
      console.error("NTFY_TOPIC 시크릿 또는 watch-config.json의 ntfyTopic이 비어 있습니다.");
      process.exit(1);
    }
    await sendNtfyNotification({
      server: ntfyServer,
      topic: ntfyTopic,
      title: "FareWatch GitHub Actions 테스트",
      message: "15분 주기 감시 봇이 정상적으로 연결되었습니다.",
      priority: 4,
      tags: ["airplane", "white_check_mark"],
    });
    console.log(`[ntfy] 테스트 푸시 발송 완료 -> ${ntfyServer}/${ntfyTopic}`);
    return;
  }

  const prevRouteMap = new Map<string, StoredRoute>();
  for (const r of prevState.routes || []) {
    prevRouteMap.set(r.id, r);
  }

  const nextRoutes: StoredRoute[] = [];
  const nextAlerts: DealAlert[] = [...(prevState.alerts || [])];
  const today = todayISO();

  for (const cfg of config.routes || []) {
    const prev = prevRouteMap.get(cfg.id);

    if (!cfg.isActive) {
      if (prev) {
        nextRoutes.push({ ...prev, ...cfg, isActive: false });
      }
      continue;
    }

    if (cfg.endDate < today) {
      console.log(`[skip] ${cfg.originCode}->${cfg.destCode}: 종료일(${cfg.endDate})이 지나 건너뜁니다.`);
      if (prev) nextRoutes.push({ ...prev, ...cfg });
      continue;
    }

    const effectiveStart = cfg.startDate < today ? today : cfg.startDate;

    console.log(
      `[check] ${cfg.originCode} -> ${cfg.destCode} (${effectiveStart}~${cfg.endDate}, ${cfg.stayNights}~${cfg.stayNightsMax ?? cfg.stayNights}박)`
    );

    try {
      const result = await checkFlightRoute({
        originCode: cfg.originCode,
        originCity: cfg.originCity,
        destCode: cfg.destCode,
        destCity: cfg.destCity,
        periodMode: cfg.periodMode,
        startDate: effectiveStart,
        endDate: cfg.endDate,
        stayNights: cfg.stayNights,
        stayNightsMax: cfg.stayNightsMax ?? cfg.stayNights,
        directOnly: cfg.directOnly,
        baselinePrice: prev?.baselinePrice,
      });

      const newPrice = result.currentPrice;
      const destKey = result.discoveredDestCode || cfg.destCode;

      // --- 평소 가격 기준: 출발일별 최저가 달력의 중앙값 ---
      const calendars: Record<string, StoredCalendar> = {};
      const nowMs = Date.now();
      for (const [k, c] of Object.entries(prev?.calendars || {})) {
        // 하루 넘게 안 쓴 달력(다른 도시 등)은 정리
        if (nowMs - new Date(c.builtAt).getTime() < 24 * 60 * 60 * 1000) {
          calendars[k] = c;
        }
      }
      const calendarTrend = { ...(prev?.calendarTrend || {}) };
      const key = calendarKey(cfg);
      const isFresh = (c: StoredCalendar | undefined) =>
        !!c && c.key === key && nowMs - new Date(c.builtAt).getTime() <= CALENDAR_TTL_MS;
      const recordTrend = (c: PriceCalendar) => {
        calendarTrend[c.destCode] = [
          ...(calendarTrend[c.destCode] || []),
          { at: c.builtAt, median: c.median },
        ].slice(-40);
      };

      if (cfg.periodMode === "flexible") {
        try {
          if (isAnywhere(cfg.destCode)) {
            // 어디든지: 같은 검색 방식으로 모든 도시 달력을 한꺼번에 (6시간마다)
            const anyFresh = Object.values(calendars).some(isFresh);
            if (!anyFresh) {
              const built = await buildAnywhereCalendars({
                originCode: cfg.originCode,
                destCode: cfg.destCode as "ANYWHERE" | "ANYWHERE_ALL",
                startDate: effectiveStart,
                endDate: cfg.endDate,
                stayNightsMin: cfg.stayNights,
                stayNightsMax: cfg.stayNightsMax ?? cfg.stayNights,
                directOnly: cfg.directOnly,
              });
              for (const k of Object.keys(calendars)) delete calendars[k];
              for (const c of Object.values(built)) {
                calendars[c.destCode] = { ...c, key };
                recordTrend(c);
              }
              console.log(
                `  [달력] 도시 ${Object.keys(built).length}곳: ${Object.values(built)
                  .sort((a, b) => a.median - b.median)
                  .slice(0, 6)
                  .map((c) => `${c.destCode} 평소 ${formatKRW(c.median)}`)
                  .join(", ")}`
              );
            }
          } else if (!isFresh(calendars[destKey])) {
            const built = await buildPriceCalendar({
              originCode: cfg.originCode,
              destCode: destKey,
              startDate: effectiveStart,
              endDate: cfg.endDate,
              stayNightsMin: cfg.stayNights,
              stayNightsMax: cfg.stayNightsMax ?? cfg.stayNights,
              directOnly: cfg.directOnly,
            });
            if (built) {
              calendars[destKey] = { ...built, key };
              recordTrend(built);
              console.log(
                `  [달력] ${destKey} 출발일 ${built.days.length}/${built.totalDates}개 · 평소(중앙값) ${formatKRW(built.median)} · 최저 ${formatKRW(built.min)} (${built.minDate})`
              );
            }
          }
        } catch (calErr) {
          console.error(`  [달력] 생성 실패:`, calErr);
        }
      }
      const cand = calendars[destKey];
      // 설정이 바뀐 옛 달력은 쓰지 않는다 (만든 지 조금 지난 것은 허용)
      const calendar: StoredCalendar | null = cand && cand.key === key ? cand : null;

      const baselineSource: "calendar" | "estimate" = calendar ? "calendar" : "estimate";
      const resolvedBaseline = calendar ? calendar.median : result.usualAveragePrice;
      const dropPct = calcDropPercent(resolvedBaseline, newPrice);
      const baselineInfo: BaselineInfo = {
        source: baselineSource,
        destCode: destKey,
        median: resolvedBaseline,
        sampleDates: calendar?.days.length ?? 0,
        totalDates: calendar?.totalDates ?? 0,
        periodStart: effectiveStart,
        periodEnd: cfg.endDate,
        min: calendar?.min ?? null,
        minDate: calendar?.minDate ?? null,
        minRetDate: calendar?.minRetDate ?? null,
        builtAt: calendar?.builtAt ?? null,
        weekChangePercent: calendar
          ? weekChange(calendarTrend[destKey], calendar.median)
          : null,
      };

      // 달력 기준이 없으면 '평소보다 몇 % 싸다'는 판단을 하지 않는다 (목표가만 사용).
      const meetsDrop =
        baselineSource === "calendar" &&
        resolvedBaseline > 0 &&
        dropPct >= cfg.dropThresholdPercent;
      const meetsTarget = cfg.targetPrice !== null && newPrice <= cfg.targetPrice;
      const meetsThreshold = meetsDrop || meetsTarget;

      // 같은 특가로 반복 알림 방지: 도착지별로 마지막 알림 가격을 기억
      const lastAlertedByDest = { ...(prev?.lastAlertedByDest || {}) };
      if (
        prev &&
        !prev.lastAlertedByDest &&
        prev.lastAlertedPrice !== null &&
        !isAnywhere(cfg.destCode)
      ) {
        lastAlertedByDest[destKey] = prev.lastAlertedPrice; // 예전 형식 이어받기
      }
      const prevLastAlerted = lastAlertedByDest[destKey] ?? null;
      const shouldAlert =
        meetsThreshold &&
        (prevLastAlerted === null ||
          newPrice <= prevLastAlerted * (1 - REALERT_EXTRA_DROP));

      if (shouldAlert) {
        lastAlertedByDest[destKey] = newPrice;
      } else if (!meetsThreshold) {
        // 특가가 끝나면 잠금 해제 → 다음에 다시 싸지면 새 특가로 알림
        delete lastAlertedByDest[destKey];
      }
      const nextLastAlertedPrice = lastAlertedByDest[destKey] ?? null;

      const checkedAt = result.checkedAt || new Date().toISOString();
      const history = [
        ...(prev?.history || []),
        {
          timestamp: checkedAt,
          price: newPrice,
          depDate: result.bestDepDate,
          retDate: result.bestRetDate,
          airline: result.airline,
          destCode: result.discoveredDestCode,
          destCity: result.discoveredDestCity,
        },
      ].slice(-24);

      const effectiveDestCode = result.discoveredDestCode || cfg.destCode;
      const effectiveDestCity = isAnywhere(cfg.destCode)
        ? result.discoveredDestCity
          ? `${result.discoveredDestCity} (어디든지)`
          : cfg.destCity
        : cfg.destCity;

      const bookingUrl =
        result.sources[0]?.uri ||
        buildSkyscannerUrl(
          cfg.originCode,
          effectiveDestCode,
          result.bestDepDate,
          result.bestRetDate
        );

      console.log(
        `  -> 최저 ${formatKRW(newPrice)} ${destKey} (평소 ${formatKRW(resolvedBaseline)} [${baselineSource === "calendar" ? "달력" : "추정"}], ${dropPct > 0 ? `-${dropPct}%` : `+${Math.abs(dropPct)}%`}) · ${result.airline}${shouldAlert ? " → 알림" : meetsThreshold ? " (이미 알린 특가)" : ""}`
      );

      if (shouldAlert) {
        const alertItem: DealAlert = {
          id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          routeId: cfg.id,
          originCode: cfg.originCode,
          originCity: cfg.originCity,
          destCode: effectiveDestCode,
          destCity: effectiveDestCity,
          baselinePrice: resolvedBaseline,
          dealPrice: newPrice,
          dropPercent: Math.max(1, dropPct),
          depDate: result.bestDepDate,
          retDate: result.bestRetDate,
          airline: result.airline,
          createdAt: checkedAt,
          isRead: false,
          isSimulated: false,
          bookingUrl,
          baselineSource,
          periodMinPrice: baselineInfo.min,
          periodMinDate: baselineInfo.minDate,
          reason: meetsDrop && meetsTarget ? "both" : meetsDrop ? "drop" : "target",
        };
        nextAlerts.unshift(alertItem);

        if (ntfyTopic) {
          const tag = meetsDrop ? `특가 -${dropPct}%` : "목표가 이하";
          const title = `[${tag}] ${cfg.originCode} → ${effectiveDestCode} ${formatKRW(newPrice)}`;
          const lines = [
            `${effectiveDestCity} · ${shortDate(result.bestDepDate)}~${shortDate(result.bestRetDate)} · ${result.airline}`,
          ];
          if (baselineSource === "calendar") {
            lines.push(
              `평소 ${formatKRW(resolvedBaseline)} · ${shortDate(effectiveStart)}~${shortDate(cfg.endDate)} 출발일 ${baselineInfo.sampleDates}개의 중간값`
            );
            if (calendar && baselineInfo.min !== null) {
              if (newPrice <= baselineInfo.min) {
                const others = calendar.days
                  .filter((d) => d.date !== result.bestDepDate)
                  .sort((a, b) => a.price - b.price);
                const next = others[0];
                lines.push(
                  next
                    ? `이 기간 가장 싼 날 · 다음으로 싼 날 ${formatKRW(next.price)} (${shortDate(next.date)} 출발)`
                    : `이 기간 가장 싼 날`
                );
              } else {
                lines.push(
                  `이 기간 가장 싼 날 ${formatKRW(baselineInfo.min)} (${shortDate(baselineInfo.minDate)} 출발)`
                );
              }
            }
            if (baselineInfo.weekChangePercent !== null && Math.abs(baselineInfo.weekChangePercent) >= 5) {
              lines.push(
                `이 기간 평소가가 1주 전보다 ${Math.abs(baselineInfo.weekChangePercent)}% ${baselineInfo.weekChangePercent < 0 ? "내림 (세일 가능성)" : "오름"}`
              );
            }
          } else {
            lines.push(`목표가 ${formatKRW(cfg.targetPrice ?? 0)} 이하 (평소 가격 기준은 아직 없음)`);
          }
          if (cfg.targetPrice !== null && meetsDrop && !meetsTarget) {
            lines.push(`목표가 ${formatKRW(cfg.targetPrice)}보다는 비쌈`);
          }
          const message = lines.join("\n");

          try {
            await sendNtfyNotification({
              server: ntfyServer,
              topic: ntfyTopic,
              title,
              message,
              clickUrl: bookingUrl,
              priority: 5,
              tags: ["airplane", "money_with_wings"],
            });
            console.log(`  [ntfy] 푸시 발송 성공 -> ${title}`);
          } catch (notifyErr) {
            console.error(`  [ntfy] 발송 오류:`, notifyErr);
          }
        } else {
          console.log(`  [ntfy] 토픽이 설정되지 않아 푸시 발송을 건너뛰었습니다.`);
        }
      }

      nextRoutes.push({
        ...cfg,
        baselinePrice: resolvedBaseline,
        currentPrice: newPrice,
        bestDepDate: result.bestDepDate,
        bestRetDate: result.bestRetDate,
        airline: result.airline,
        duration: result.duration,
        discoveredDestCode: result.discoveredDestCode,
        discoveredDestCity: result.discoveredDestCity,
        anywhereDeals: result.anywhereDeals,
        lastCheckedAt: checkedAt,
        lastAlertedPrice: nextLastAlertedPrice,
        lastAlertedByDest,
        baselineInfo,
        calendars,
        calendarTrend,
        sources: result.sources,
        history,
        errorMessage: null,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "조회 오류";
      console.error(`  [error] ${cfg.originCode}->${cfg.destCode}: ${msg}`);
      if (prev) {
        nextRoutes.push({
          ...prev,
          ...cfg,
          errorMessage: msg,
        });
      }
    }
  }

  const finalState: WatchState = {
    updatedAt: new Date().toISOString(),
    routes: nextRoutes,
    alerts: nextAlerts.slice(0, 100),
  };

  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(finalState, null, 2) + "\n", "utf-8");
  console.log(`[done] ${STATE_PATH} 저장 완료 (${nextRoutes.length}개 노선)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
