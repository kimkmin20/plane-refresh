import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  buildSkyscannerUrl,
  checkFlightRoute,
  sendNtfyNotification,
  type AnywhereDealItem,
  type SourceLink,
} from "../shared/flightChecker.ts";

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

interface StoredRoute extends ConfigRoute {
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

      const resolvedBaseline =
        prev && prev.baselinePrice > 0
          ? prev.baselinePrice
          : result.usualAveragePrice;
      const newPrice = result.currentPrice;
      const dropPct = calcDropPercent(resolvedBaseline, newPrice);

      const meetsThreshold =
        (resolvedBaseline > 0 && dropPct >= cfg.dropThresholdPercent) ||
        (cfg.targetPrice !== null && newPrice <= cfg.targetPrice);

      const prevLastAlerted = prev?.lastAlertedPrice ?? null;
      const shouldAlert =
        meetsThreshold &&
        (prevLastAlerted === null || newPrice < prevLastAlerted);

      // Reset alert lock if fare rebounds noticeably above previous alerted price
      const nextLastAlertedPrice = shouldAlert
        ? newPrice
        : !meetsThreshold &&
          prevLastAlerted !== null &&
          newPrice > prevLastAlerted * 1.05
        ? null
        : prevLastAlerted;

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
        `  -> 최저 ${formatKRW(newPrice)} (평균 ${formatKRW(resolvedBaseline)}, 변동 ${dropPct > 0 ? `-${dropPct}%` : `+${Math.abs(dropPct)}%`}) · ${result.airline}`
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
        };
        nextAlerts.unshift(alertItem);

        if (ntfyTopic) {
          const title = `[특가 ${dropPct > 0 ? `-${dropPct}%` : ""}] ${cfg.originCode} → ${effectiveDestCode} ${formatKRW(newPrice)}`;
          const message = `${effectiveDestCity}\n${result.bestDepDate} ~ ${result.bestRetDate} · ${result.airline}\n평소 ${formatKRW(resolvedBaseline)}`;

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
