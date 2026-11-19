import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  BellOff,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import { AddRouteModal, type NewRouteInput } from "./components/AddRouteModal";
import { AlertsView } from "./components/AlertsView";
import { NtfyModal } from "./components/NtfyModal";
import { OfflineIndicator } from "./components/OfflineIndicator";
import { PWAInstallButton } from "./components/PWAInstallButton";
import { RouteInspector } from "./components/RouteInspector";
import { Sparkline } from "./components/Sparkline";
import { isAnywhereCode } from "./data/airports";
import { createInitialSeedData } from "./data/seedRoutes";
import type {
  AnywhereDealItem,
  DealAlert,
  SourceLink,
  WatchRoute,
} from "./types";
import {
  addDaysISO,
  calcDropPercent,
  formatKRW,
  formatRelativeTime,
  formatShortDate,
  formatStayLabel,
  getBrowserNotificationState,
  getDaysBetween,
  playDealChime,
  requestBrowserNotificationPermission,
  sendBrowserDealNotification,
} from "./utils/format";
import {
  STORAGE_GITHUB_REPO_KEY,
  STORAGE_GITHUB_TOKEN_KEY,
  STORAGE_LAST_PUSHED_KEY,
  buildWatchConfig,
  detectRepo,
  pushWatchConfig,
} from "./utils/githubSync";

export type GithubSyncStatus =
  | { state: "off" }
  | { state: "pending" }
  | { state: "saving" }
  | { state: "saved"; at: string }
  | { state: "error"; message: string };

const STORAGE_ROUTES_KEY = "farewatch_routes_v1";
const STORAGE_ALERTS_KEY = "farewatch_alerts_v1";
const STORAGE_SOUND_KEY = "farewatch_sound_v1";
const STORAGE_NTFY_KEY = "farewatch_ntfy_topic_v1";

type ActiveTab = "watchlist" | "alerts";
type StatusFilter = "all" | "deals" | "active";

interface LiveCheckApiResponse {
  currentPrice: number;
  usualAveragePrice: number;
  bestDepDate: string;
  bestRetDate: string;
  airline: string;
  isDirect: boolean;
  duration: string;
  discoveredDestCode?: string;
  discoveredDestCity?: string;
  anywhereDeals?: AnywhereDealItem[];
  checkedAt: string;
  sources: SourceLink[];
  error?: string;
}

function buildFallbackSkyscannerUrl(
  origin: string,
  dest: string,
  dep: string,
  ret: string
): string {
  const o = origin.toLowerCase();
  if (isAnywhereCode(dest)) {
    return `https://www.skyscanner.co.kr/transport/flights-from/${o}/`;
  }
  const d1 = dep.replace(/-/g, "").slice(2);
  const d2 = ret.replace(/-/g, "").slice(2);
  if (d1 && d2) {
    return `https://www.skyscanner.co.kr/transport/flights/${o}/${dest.toLowerCase()}/${d1}/${d2}/`;
  }
  return `https://www.skyscanner.co.kr/transport/flights/${o}/${dest.toLowerCase()}/`;
}

function isRouteDeal(route: WatchRoute): boolean {
  if (route.currentPrice <= 0) return false;
  const dropPct = calcDropPercent(route.baselinePrice, route.currentPrice);
  const meetsDrop =
    route.baselineInfo?.source !== "estimate" &&
    route.baselinePrice > 0 &&
    dropPct >= route.dropThresholdPercent;
  const meetsTarget =
    route.targetPrice !== null && route.currentPrice <= route.targetPrice;
  return meetsDrop || meetsTarget;
}

export default function App() {
  const initialData = useMemo(() => {
    const seed = createInitialSeedData();
    try {
      const savedRoutesRaw = localStorage.getItem(STORAGE_ROUTES_KEY);
      const savedAlertsRaw = localStorage.getItem(STORAGE_ALERTS_KEY);
      if (savedRoutesRaw) {
        let parsedRoutes: WatchRoute[] = (
          JSON.parse(savedRoutesRaw) as WatchRoute[]
        ).map((r) => ({
            ...r,
            // Clear any stale legacy API error strings
            errorMessage:
              r.errorMessage &&
              (r.errorMessage.includes("RESOURCE_EXHAUSTED") ||
                r.errorMessage.includes("aistudio") ||
                r.errorMessage.includes("429"))
                ? null
                : r.errorMessage,
          })
        );

        const hasAnywhere = parsedRoutes.some((r) => isAnywhereCode(r.destCode));
        const onlySeedRoutes = parsedRoutes.every((r) => r.id.startsWith("seed-"));
        if (!hasAnywhere && onlySeedRoutes && seed.routes[0]) {
          parsedRoutes = [seed.routes[0], ...parsedRoutes];
        }

        return {
          routes: parsedRoutes,
          alerts: savedAlertsRaw
            ? (JSON.parse(savedAlertsRaw) as DealAlert[])
            : seed.alerts,
        };
      }
    } catch {
      // Fallback to seed
    }
    return seed;
  }, []);

  const [routes, setRoutes] = useState<WatchRoute[]>(initialData.routes);
  const [alerts, setAlerts] = useState<DealAlert[]>(initialData.alerts);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(
    initialData.routes[0]?.id ?? null
  );
  const [activeTab, setActiveTab] = useState<ActiveTab>("watchlist");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isNtfyModalOpen, setIsNtfyModalOpen] = useState(false);
  const [ntfyTopic, setNtfyTopic] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_NTFY_KEY) || "";
    } catch {
      return "";
    }
  });
  const [githubToken, setGithubToken] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_GITHUB_TOKEN_KEY) || "";
    } catch {
      return "";
    }
  });
  const [githubRepo, setGithubRepo] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_GITHUB_REPO_KEY) || detectRepo();
    } catch {
      return detectRepo();
    }
  });
  const [githubSyncStatus, setGithubSyncStatus] = useState<GithubSyncStatus>(
    { state: "off" }
  );
  const [lastGithubSyncAt, setLastGithubSyncAt] = useState<string | null>(null);
  const [checkingIds, setCheckingIds] = useState<Record<string, boolean>>({});
  const [notifPermission, setNotifPermission] = useState(() =>
    getBrowserNotificationState()
  );
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_SOUND_KEY);
      return raw === null ? true : raw === "true";
    } catch {
      return true;
    }
  });
  const [toastAlert, setToastAlert] = useState<DealAlert | null>(null);
  const [, setTick] = useState(0);

  const routesRef = useRef(routes);
  routesRef.current = routes;
  const checkingRef = useRef(checkingIds);
  checkingRef.current = checkingIds;
  const soundRef = useRef(soundEnabled);
  soundRef.current = soundEnabled;

  // Persist state
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_ROUTES_KEY, JSON.stringify(routes));
    } catch {
      // Ignore quota errors
    }
  }, [routes]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_ALERTS_KEY, JSON.stringify(alerts));
    } catch {
      // Ignore quota errors
    }
  }, [alerts]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SOUND_KEY, String(soundEnabled));
    } catch {
      // Ignore
    }
  }, [soundEnabled]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_NTFY_KEY, ntfyTopic);
    } catch {
      // Ignore
    }
  }, [ntfyTopic]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_GITHUB_TOKEN_KEY, githubToken.trim());
      localStorage.setItem(STORAGE_GITHUB_REPO_KEY, githubRepo.trim());
    } catch {
      // Ignore
    }
  }, [githubToken, githubRepo]);

  // 브라우저에서 바꾼 감시 노선 → GitHub watch-config.json 자동 반영
  const watchConfigJson = useMemo(() => buildWatchConfig(routes), [routes]);
  const watchConfigRef = useRef(watchConfigJson);
  watchConfigRef.current = watchConfigJson;
  // 앱을 연 순간의 설정은 '이미 반영됨'으로 본다.
  // (다른 기기에서 열기만 해도 저장소 설정을 덮어쓰지 않도록)
  const lastPushedRef = useRef<string>(
    (() => {
      try {
        return localStorage.getItem(STORAGE_LAST_PUSHED_KEY) ?? watchConfigJson;
      } catch {
        return watchConfigJson;
      }
    })()
  );

  const pushConfigNow = useCallback(async (): Promise<boolean> => {
    const token = githubToken.trim();
    const repo = githubRepo.trim();
    if (!token || !repo) {
      setGithubSyncStatus({ state: "off" });
      return false;
    }
    const content = watchConfigRef.current;
    setGithubSyncStatus({ state: "saving" });
    try {
      await pushWatchConfig(token, repo, content);
      lastPushedRef.current = content;
      try {
        localStorage.setItem(STORAGE_LAST_PUSHED_KEY, content);
      } catch {
        // Ignore
      }
      setGithubSyncStatus({ state: "saved", at: new Date().toISOString() });
      return true;
    } catch (err: unknown) {
      setGithubSyncStatus({
        state: "error",
        message: err instanceof Error ? err.message : "GitHub 반영 실패",
      });
      return false;
    }
  }, [githubToken, githubRepo]);

  useEffect(() => {
    if (!githubToken.trim() || !githubRepo.trim()) {
      setGithubSyncStatus({ state: "off" });
      return;
    }
    if (watchConfigJson === lastPushedRef.current) return;
    setGithubSyncStatus({ state: "pending" });
    const timer = window.setTimeout(() => {
      void pushConfigNow();
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [watchConfigJson, githubToken, githubRepo, pushConfigNow]);

  const syncFromGithubState = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(`./watch-state.json?t=${Date.now()}`, {
        cache: "no-store",
      });
      if (!res.ok) return false;
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) return false;

      const snapshot = (await res.json()) as {
        updatedAt?: string | null;
        routes?: WatchRoute[];
        alerts?: DealAlert[];
      };

      if (!snapshot.routes || snapshot.routes.length === 0) {
        return false;
      }

      if (snapshot.updatedAt) {
        setLastGithubSyncAt(snapshot.updatedAt);
      }

      setRoutes((prev) => {
        const snapshotMap = new Map(snapshot.routes!.map((r) => [r.id, r]));
        const hasOnlySeed = prev.every((r) => r.id.startsWith("seed-"));
        const merged: WatchRoute[] = hasOnlySeed
          ? [...snapshot.routes!]
          : prev.map((existing) => {
              const incoming = snapshotMap.get(existing.id);
              if (!incoming) return existing;
              const existingMs = existing.lastCheckedAt
                ? new Date(existing.lastCheckedAt).getTime()
                : 0;
              const incomingMs = incoming.lastCheckedAt
                ? new Date(incoming.lastCheckedAt).getTime()
                : 0;
              if (incomingMs <= existingMs) return existing;
              // 감시 결과만 받아오고, 노선 설정은 이 브라우저 것을 유지
              // (방금 바꾼 설정이 아직 감시에 반영되기 전이어도 되돌리지 않도록)
              return {
                ...incoming,
                originCode: existing.originCode,
                originCity: existing.originCity,
                destCode: existing.destCode,
                destCity: existing.destCity,
                periodMode: existing.periodMode,
                startDate: existing.startDate,
                endDate: existing.endDate,
                stayNights: existing.stayNights,
                stayNightsMax: existing.stayNightsMax,
                directOnly: existing.directOnly,
                dropThresholdPercent: existing.dropThresholdPercent,
                targetPrice: existing.targetPrice,
                checkIntervalMinutes: existing.checkIntervalMinutes,
                isActive: existing.isActive,
              };
            });

        // 이 브라우저에서 지운 노선은 감시 결과에 남아 있어도 다시 넣지 않는다.
        // (노선 목록은 브라우저가 기준. 처음 여는 브라우저만 감시 결과로 채움)
        return merged;
      });

      if (snapshot.alerts && snapshot.alerts.length > 0) {
        setAlerts((prev) => {
          const existingIds = new Set(prev.map((a) => a.id));
          const fresh = snapshot.alerts!.filter((a) => !existingIds.has(a.id));
          return fresh.length > 0 ? [...fresh, ...prev].slice(0, 100) : prev;
        });
      }

      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    void syncFromGithubState();
  }, [syncFromGithubState]);

  // Auto-hide toast
  useEffect(() => {
    if (!toastAlert) return;
    const t = window.setTimeout(() => setToastAlert(null), 6000);
    return () => window.clearTimeout(t);
  }, [toastAlert]);

  const dispatchDealAlert = useCallback(
    (
      route: WatchRoute,
      newPrice: number,
      baselinePrice: number,
      depDate: string,
      retDate: string,
      airline: string,
      bookingUrl: string,
      isSimulated: boolean,
      overrideDest?: { code: string; city: string }
    ) => {
      const dropPercent = Math.max(1, calcDropPercent(baselinePrice, newPrice));
      const effectiveDestCode = overrideDest?.code || route.destCode;
      const effectiveDestCity = isAnywhereCode(route.destCode)
        ? overrideDest?.city
          ? `${overrideDest.city} (어디든지)`
          : route.destCity
        : route.destCity;

      const newAlert: DealAlert = {
        id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        routeId: route.id,
        originCode: route.originCode,
        originCity: route.originCity,
        destCode: effectiveDestCode,
        destCity: effectiveDestCity,
        baselinePrice,
        dealPrice: newPrice,
        dropPercent,
        depDate,
        retDate,
        airline,
        createdAt: new Date().toISOString(),
        isRead: false,
        isSimulated,
        bookingUrl,
      };

      setAlerts((prev) => [newAlert, ...prev].slice(0, 100));
      setToastAlert(newAlert);

      if (soundRef.current) {
        playDealChime();
      }

      void sendBrowserDealNotification(
        `${route.originCode} → ${effectiveDestCode} ${formatKRW(newPrice)} (-${dropPercent}%)`,
        `${effectiveDestCity} · ${formatShortDate(depDate)}–${formatShortDate(
          retDate
        )} · ${airline}`,
        () => {
          setSelectedRouteId(route.id);
          setActiveTab("watchlist");
        }
      );
    },
    []
  );

  const checkRouteLive = useCallback(
    async (routeId: string) => {
      if (checkingRef.current[routeId]) return;
      const target = routesRef.current.find((r) => r.id === routeId);
      if (!target) return;

      setCheckingIds((prev) => ({ ...prev, [routeId]: true }));

      try {
        const res = await fetch("/api/flights/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            originCode: target.originCode,
            originCity: target.originCity,
            destCode: target.destCode,
            destCity: target.destCity,
            periodMode: target.periodMode,
            startDate: target.startDate,
            endDate: target.endDate,
            stayNights: target.stayNights,
            stayNightsMax: target.stayNightsMax ?? target.stayNights,
            directOnly: target.directOnly,
            baselinePrice: target.baselinePrice,
          }),
        });

        const contentType = res.headers.get("content-type") || "";
        if (res.status === 404 || !contentType.includes("application/json")) {
          throw new Error(
            "정적 호스팅(GitHub Pages)에서는 GitHub Actions가 15분마다 시세를 자동 갱신합니다."
          );
        }

        const data = (await res.json()) as LiveCheckApiResponse;
        if (!res.ok || data.error) {
          throw new Error(data.error || "시세 조회 실패");
        }

        const checkedAt = data.checkedAt || new Date().toISOString();
        const resolvedBaseline =
          target.baselinePrice > 0
            ? target.baselinePrice
            : data.usualAveragePrice;
        const newPrice = data.currentPrice;
        const dropPct = calcDropPercent(resolvedBaseline, newPrice);

        const meetsThreshold =
          (resolvedBaseline > 0 && dropPct >= target.dropThresholdPercent) ||
          (target.targetPrice !== null && newPrice <= target.targetPrice);

        const shouldAlert =
          meetsThreshold &&
          (target.lastAlertedPrice === null || newPrice < target.lastAlertedPrice);

        const mergedSources =
          data.sources && data.sources.length > 0
            ? data.sources
            : [
                {
                  title: "Skyscanner 검색",
                  uri: buildFallbackSkyscannerUrl(
                    target.originCode,
                    data.discoveredDestCode || target.destCode,
                    data.bestDepDate,
                    data.bestRetDate
                  ),
                },
              ];

        setRoutes((prev) =>
          prev.map((r) => {
            if (r.id !== routeId) return r;
            const nextHistory = [
              ...r.history,
              {
                timestamp: checkedAt,
                price: newPrice,
                depDate: data.bestDepDate,
                retDate: data.bestRetDate,
                airline: data.airline,
                destCode: data.discoveredDestCode,
                destCity: data.discoveredDestCity,
              },
            ].slice(-24);

            return {
              ...r,
              baselinePrice: resolvedBaseline,
              currentPrice: newPrice,
              bestDepDate: data.bestDepDate,
              bestRetDate: data.bestRetDate,
              airline: data.airline,
              duration: data.duration || r.duration,
              discoveredDestCode:
                data.discoveredDestCode ?? r.discoveredDestCode,
              discoveredDestCity:
                data.discoveredDestCity ?? r.discoveredDestCity,
              anywhereDeals: data.anywhereDeals ?? r.anywhereDeals,
              lastCheckedAt: checkedAt,
              lastAlertedPrice: shouldAlert ? newPrice : r.lastAlertedPrice,
              sources: mergedSources,
              history: nextHistory,
              errorMessage: null,
            };
          })
        );

        if (shouldAlert) {
          dispatchDealAlert(
            target,
            newPrice,
            resolvedBaseline,
            data.bestDepDate,
            data.bestRetDate,
            data.airline,
            mergedSources[0]?.uri ||
              buildFallbackSkyscannerUrl(
                target.originCode,
                data.discoveredDestCode || target.destCode,
                data.bestDepDate,
                data.bestRetDate
              ),
            false,
            data.discoveredDestCode && data.discoveredDestCity
              ? { code: data.discoveredDestCode, city: data.discoveredDestCity }
              : undefined
          );
        }
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "시세 조회 중 오류가 발생했습니다.";
        setRoutes((prev) =>
          prev.map((r) => (r.id === routeId ? { ...r, errorMessage: msg } : r))
        );
      } finally {
        setCheckingIds((prev) => {
          const next = { ...prev };
          delete next[routeId];
          return next;
        });
      }
    },
    [dispatchDealAlert]
  );

  // Simulate sudden promo price drop to verify notifications immediately
  const handleSimulateDrop = useCallback(
    (routeId: string) => {
      const target = routesRef.current.find((r) => r.id === routeId);
      if (!target) return;

      const baseline =
        target.baselinePrice > 0
          ? target.baselinePrice
          : target.currentPrice > 0
          ? Math.round((target.currentPrice * 1.15) / 1000) * 1000
          : 260000;

      const minRequiredDrop = Math.max(target.dropThresholdPercent + 6, 24);
      const randomExtra = Math.floor(Math.random() * 8);
      const totalDropPct = Math.min(42, minRequiredDrop + randomExtra);

      let simulatedPrice =
        Math.round((baseline * (1 - totalDropPct / 100)) / 1000) * 1000;
      if (target.targetPrice !== null && simulatedPrice > target.targetPrice) {
        simulatedPrice = Math.max(
          29000,
          Math.round((target.targetPrice * 0.94) / 1000) * 1000
        );
      }

      let bestDep = target.bestDepDate || target.startDate;
      let bestRet = target.bestRetDate || target.endDate;

      if (target.periodMode === "flexible") {
        const minN = Math.max(1, target.stayNights);
        const maxN = Math.max(minN, target.stayNightsMax ?? minN);
        const pickedNights =
          minN + Math.floor(Math.random() * (maxN - minN + 1));
        const windowSpan = Math.max(
          0,
          getDaysBetween(target.startDate, target.endDate) - pickedNights
        );
        const randomOffset =
          windowSpan > 0 ? Math.floor(Math.random() * (windowSpan + 1)) : 0;
        bestDep = addDaysISO(target.startDate, randomOffset);
        bestRet = addDaysISO(bestDep, pickedNights);
      }

      const promoCities = [
        { code: "FUK", city: "후쿠오카", country: "일본", airline: "제주항공" },
        { code: "KIX", city: "오사카", country: "일본", airline: "피치항공" },
        { code: "TPE", city: "타이베이", country: "대만", airline: "타이거에어 타이완" },
        { code: "DAD", city: "다낭", country: "베트남", airline: "비엣젯항공" },
      ];
      const pickedPromo =
        promoCities[Math.floor(Math.random() * promoCities.length)];

      const isAny = isAnywhereCode(target.destCode);
      const simDestCode = isAny
        ? target.discoveredDestCode || pickedPromo.code
        : target.destCode;
      const simDestCity = isAny
        ? target.discoveredDestCity || pickedPromo.city
        : target.destCity;

      const promoAirlines = ["제주항공", "진에어", "티웨이항공", "이스타항공", "에어프레미아"];
      const airline =
        target.airline && target.airline !== "조회 대기"
          ? target.airline
          : isAny
          ? pickedPromo.airline
          : promoAirlines[Math.floor(Math.random() * promoAirlines.length)];

      const nowIso = new Date().toISOString();
      const bookingUrl =
        target.sources[0]?.uri ||
        buildFallbackSkyscannerUrl(
          target.originCode,
          simDestCode,
          bestDep,
          bestRet
        );

      setRoutes((prev) =>
        prev.map((r) => {
          if (r.id !== routeId) return r;
          return {
            ...r,
            baselinePrice: baseline,
            currentPrice: simulatedPrice,
            bestDepDate: bestDep,
            bestRetDate: bestRet,
            airline,
            discoveredDestCode: isAny ? simDestCode : r.discoveredDestCode,
            discoveredDestCity: isAny ? simDestCity : r.discoveredDestCity,
            lastCheckedAt: nowIso,
            lastAlertedPrice: simulatedPrice,
            errorMessage: null,
            sources:
              r.sources.length > 0
                ? r.sources
                : [{ title: "Skyscanner 검색", uri: bookingUrl }],
            history: [
              ...r.history,
              {
                timestamp: nowIso,
                price: simulatedPrice,
                depDate: bestDep,
                retDate: bestRet,
                airline,
                destCode: isAny ? simDestCode : undefined,
                destCity: isAny ? simDestCity : undefined,
                isSimulated: true,
              },
            ].slice(-24),
          };
        })
      );

      dispatchDealAlert(
        target,
        simulatedPrice,
        baseline,
        bestDep,
        bestRet,
        airline,
        bookingUrl,
        true,
        isAny ? { code: simDestCode, city: simDestCity } : undefined
      );
    },
    [dispatchDealAlert]
  );

  // Periodic background scheduler + relative time refresh
  useEffect(() => {
    const isStaticHosting = /\.github\.io$/i.test(window.location.hostname);
    let lastStateSync = Date.now();
    const timer = window.setInterval(() => {
      setTick((t) => t + 1);
      const now = Date.now();
      if (isStaticHosting) {
        // GitHub Pages에는 조회 서버가 없다 → GitHub Actions 결과를 5분마다 다시 읽는다
        if (now - lastStateSync >= 5 * 60_000) {
          lastStateSync = now;
          void syncFromGithubState();
        }
        return;
      }
      for (const route of routesRef.current) {
        if (!route.isActive || checkingRef.current[route.id]) continue;
        const lastMs = route.lastCheckedAt
          ? new Date(route.lastCheckedAt).getTime()
          : 0;
        const intervalMs = route.checkIntervalMinutes * 60_000;
        if (now - lastMs >= intervalMs) {
          void checkRouteLive(route.id);
          break;
        }
      }
    }, 20_000);

    return () => window.clearInterval(timer);
  }, [checkRouteLive, syncFromGithubState]);

  const handleAddRoute = (input: NewRouteInput) => {
    const id = `route-${Date.now()}`;
    const defaultRet =
      input.periodMode === "fixed"
        ? input.endDate
        : addDaysISO(input.startDate, input.stayNights);

    const newRoute: WatchRoute = {
      id,
      originCode: input.originCode,
      originCity: input.originCity,
      destCode: input.destCode,
      destCity: input.destCity,
      periodMode: input.periodMode,
      startDate: input.startDate,
      endDate: input.endDate,
      stayNights: input.stayNights,
      stayNightsMax: input.stayNightsMax,
      directOnly: input.directOnly,
      baselinePrice: 0,
      currentPrice: 0,
      bestDepDate: input.startDate,
      bestRetDate: defaultRet,
      airline: "조회 대기",
      duration: "",
      dropThresholdPercent: input.dropThresholdPercent,
      targetPrice: input.targetPrice,
      checkIntervalMinutes: input.checkIntervalMinutes,
      isActive: true,
      lastCheckedAt: null,
      lastAlertedPrice: null,
      sources: [
        {
          title: isAnywhereCode(input.destCode)
            ? "Skyscanner 어디든지 검색"
            : "Skyscanner 노선 비교",
          uri: buildFallbackSkyscannerUrl(
            input.originCode,
            input.destCode,
            input.startDate,
            defaultRet
          ),
        },
      ],
      history: [],
      errorMessage: null,
    };

    setRoutes((prev) => {
      const updated = [newRoute, ...prev];
      routesRef.current = updated;
      return updated;
    });
    setSelectedRouteId(id);
    setActiveTab("watchlist");

    window.setTimeout(() => {
      void checkRouteLive(id);
    }, 40);
  };

  const handlePinAnywhereDeal = (
    parentRoute: WatchRoute,
    deal: AnywhereDealItem
  ) => {
    const existing = routes.find(
      (r) =>
        r.originCode === parentRoute.originCode &&
        r.destCode === deal.destCode &&
        r.startDate === parentRoute.startDate &&
        r.endDate === parentRoute.endDate
    );
    if (existing) {
      setSelectedRouteId(existing.id);
      return;
    }

    const id = `route-${Date.now()}`;
    const nowIso = new Date().toISOString();
    const pinnedRoute: WatchRoute = {
      id,
      originCode: parentRoute.originCode,
      originCity: parentRoute.originCity,
      destCode: deal.destCode,
      destCity: deal.destCity,
      periodMode: parentRoute.periodMode,
      startDate: parentRoute.startDate,
      endDate: parentRoute.endDate,
      stayNights: parentRoute.stayNights,
      stayNightsMax: parentRoute.stayNightsMax ?? parentRoute.stayNights,
      directOnly: parentRoute.directOnly,
      baselinePrice: Math.round((deal.price * 1.15) / 100) * 100,
      currentPrice: deal.price,
      bestDepDate: deal.depDate,
      bestRetDate: deal.retDate,
      airline: deal.airline,
      duration: deal.duration,
      dropThresholdPercent: parentRoute.dropThresholdPercent,
      targetPrice: null,
      checkIntervalMinutes: parentRoute.checkIntervalMinutes,
      isActive: true,
      lastCheckedAt: nowIso,
      lastAlertedPrice: null,
      sources: [
        {
          title: `${deal.destCity} 최저가 예약`,
          uri: deal.bookingUrl,
        },
        {
          title: "Skyscanner 노선 비교",
          uri: buildFallbackSkyscannerUrl(
            parentRoute.originCode,
            deal.destCode,
            deal.depDate,
            deal.retDate
          ),
        },
      ],
      history: [
        {
          timestamp: nowIso,
          price: deal.price,
          depDate: deal.depDate,
          retDate: deal.retDate,
          airline: deal.airline,
        },
      ],
      errorMessage: null,
    };

    setRoutes((prev) => {
      const updated = [pinnedRoute, ...prev];
      routesRef.current = updated;
      return updated;
    });
    setSelectedRouteId(id);
    window.setTimeout(() => {
      void checkRouteLive(id);
    }, 40);
  };

  const handleToggleActive = (routeId: string) => {
    setRoutes((prev) =>
      prev.map((r) => (r.id === routeId ? { ...r, isActive: !r.isActive } : r))
    );
  };

  const handleDeleteRoute = (routeId: string) => {
    setRoutes((prev) => {
      const remaining = prev.filter((r) => r.id !== routeId);
      if (selectedRouteId === routeId) {
        setSelectedRouteId(remaining[0]?.id ?? null);
      }
      return remaining;
    });
  };

  const handleUpdateSettings = (
    routeId: string,
    patch: {
      dropThresholdPercent?: number;
      targetPrice?: number | null;
      checkIntervalMinutes?: number;
    }
  ) => {
    setRoutes((prev) =>
      prev.map((r) => (r.id === routeId ? { ...r, ...patch } : r))
    );
  };

  const handleCheckAll = async () => {
    const activeList = routes.filter((r) => r.isActive);
    for (const r of activeList) {
      await checkRouteLive(r.id);
    }
  };

  const handleRequestPushPermission = async () => {
    const nextState = await requestBrowserNotificationPermission();
    setNotifPermission(nextState);
  };

  const filteredRoutes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return routes.filter((r) => {
      if (statusFilter === "deals" && !isRouteDeal(r)) return false;
      if (statusFilter === "active" && !r.isActive) return false;
      if (!q) return true;
      return (
        r.originCode.toLowerCase().includes(q) ||
        r.destCode.toLowerCase().includes(q) ||
        r.originCity.toLowerCase().includes(q) ||
        r.destCity.toLowerCase().includes(q) ||
        (r.discoveredDestCity || "").toLowerCase().includes(q) ||
        (r.discoveredDestCode || "").toLowerCase().includes(q) ||
        r.airline.toLowerCase().includes(q)
      );
    });
  }, [routes, statusFilter, searchQuery]);

  const selectedRoute = useMemo(
    () =>
      routes.find((r) => r.id === selectedRouteId) ??
      filteredRoutes[0] ??
      null,
    [routes, selectedRouteId, filteredRoutes]
  );

  const unreadAlertsCount = useMemo(
    () => alerts.filter((a) => !a.isRead).length,
    [alerts]
  );

  const anyChecking = Object.keys(checkingIds).length > 0;

  return (
    <div className="min-h-screen bg-white text-neutral-900 flex flex-col">
      {/* 3-Zone Top Bar Contract */}
      <header className="h-14 px-6 border-b border-neutral-200 flex items-center justify-between gap-8">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab("watchlist");
          }}
          className="text-base font-semibold tracking-tight text-neutral-900 whitespace-nowrap shrink-0"
        >
          FareWatch
        </a>

        <nav className="flex items-center gap-6 text-sm">
          <button
            type="button"
            onClick={() => setActiveTab("watchlist")}
            className={`py-4 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === "watchlist"
                ? "border-neutral-900 text-neutral-900 font-medium"
                : "border-transparent text-neutral-500 hover:text-neutral-900"
            }`}
          >
            감시 노선 · {routes.length}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("alerts")}
            className={`py-4 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === "alerts"
                ? "border-neutral-900 text-neutral-900 font-medium"
                : "border-transparent text-neutral-500 hover:text-neutral-900"
            }`}
          >
            알림 내역{unreadAlertsCount > 0 ? ` · ${unreadAlertsCount}` : ""}
          </button>
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="h-9 px-3.5 flex items-center gap-1.5 text-xs font-medium bg-neutral-900 text-white hover:bg-neutral-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>노선 추가</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-6">
        {activeTab === "watchlist" ? (
          <div className="space-y-5">
            {/* Minimal Workspace Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Status Segmented Filter */}
                <div className="flex items-center p-0.5 bg-neutral-100 rounded-md">
                  {(
                    [
                      { key: "all", label: "전체" },
                      { key: "deals", label: "특가" },
                      { key: "active", label: "감시 중" },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setStatusFilter(item.key)}
                      className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        statusFilter === item.key
                          ? "bg-white text-neutral-900 shadow-xs"
                          : "text-neutral-500 hover:text-neutral-900"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {/* Search Input */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="공항 · 도시 검색"
                    className="h-8 w-44 pl-8 pr-2.5 text-xs border border-neutral-200 rounded-md focus:outline-none focus:border-neutral-900"
                  />
                </div>
              </div>

              {/* Right Utility Controls */}
              <div className="flex items-center gap-2 flex-wrap">
                <PWAInstallButton />

                <button
                  type="button"
                  onClick={() => setIsNtfyModalOpen(true)}
                  className={`h-8 px-2.5 flex items-center gap-1.5 text-xs border rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    ntfyTopic.trim()
                      ? "border-neutral-200 text-emerald-700 hover:border-neutral-900"
                      : "border-neutral-200 text-neutral-600 hover:text-neutral-900"
                  }`}
                  title="GitHub 15분 감시 · ntfy 푸시 설정"
                >
                  <Radio
                    className={`w-3.5 h-3.5 ${
                      ntfyTopic.trim() ? "text-emerald-600" : ""
                    }`}
                  />
                  <span>ntfy</span>
                  {githubSyncStatus.state === "error" && (
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-red-500"
                      aria-label="GitHub 반영 실패"
                    />
                  )}
                  {(githubSyncStatus.state === "pending" ||
                    githubSyncStatus.state === "saving") && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setSoundEnabled((s) => !s)}
                  className="h-8 px-2.5 flex items-center gap-1.5 text-xs text-neutral-600 hover:text-neutral-900 border border-neutral-200 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  title={soundEnabled ? "알림음 켜짐" : "알림음 꺼짐"}
                >
                  {soundEnabled ? (
                    <Volume2 className="w-3.5 h-3.5" />
                  ) : (
                    <VolumeX className="w-3.5 h-3.5 text-neutral-400" />
                  )}
                  <span>알림음</span>
                </button>

                {notifPermission !== "unsupported" && (
                  <button
                    type="button"
                    onClick={handleRequestPushPermission}
                    disabled={notifPermission === "granted"}
                    className={`h-8 px-2.5 flex items-center gap-1.5 text-xs border rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      notifPermission === "granted"
                        ? "border-neutral-200 text-emerald-700 cursor-default"
                        : notifPermission === "denied"
                        ? "border-neutral-200 text-neutral-400 cursor-not-allowed"
                        : "border-neutral-200 text-neutral-700 hover:border-neutral-900 cursor-pointer"
                    }`}
                  >
                    {notifPermission === "granted" ? (
                      <>
                        <Bell className="w-3.5 h-3.5 text-emerald-600" />
                        <span>푸시 켜짐</span>
                      </>
                    ) : notifPermission === "denied" ? (
                      <>
                        <BellOff className="w-3.5 h-3.5" />
                        <span>푸시 차단됨</span>
                      </>
                    ) : (
                      <>
                        <Bell className="w-3.5 h-3.5" />
                        <span>푸시 권한 허용</span>
                      </>
                    )}
                  </button>
                )}

                {routes.length > 0 && (
                  <button
                    type="button"
                    disabled={anyChecking}
                    onClick={handleCheckAll}
                    className="h-8 px-3 flex items-center gap-1.5 text-xs font-medium border border-neutral-200 text-neutral-800 hover:bg-neutral-50 disabled:opacity-50 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${anyChecking ? "animate-spin" : ""}`}
                    />
                    <span>전체 조회</span>
                  </button>
                )}
              </div>
            </div>

            {/* Split Workspace: Left Watchlist Table + Right Inspector */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Watchlist Table (8 cols) */}
              <div className="lg:col-span-8">
                {filteredRoutes.length === 0 ? (
                  <div className="py-20 border border-neutral-200 rounded-md text-center space-y-3">
                    <div className="text-xs text-neutral-400">
                      {routes.length === 0
                        ? "등록된 감시 노선이 없습니다"
                        : "조건에 맞는 노선이 없습니다"}
                    </div>
                    {routes.length === 0 && (
                      <button
                        type="button"
                        onClick={() => setIsAddModalOpen(true)}
                        className="px-4 py-2 text-xs font-medium bg-neutral-900 text-white rounded-md hover:bg-neutral-800 transition-colors cursor-pointer"
                      >
                        + 첫 노선 추가
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="border-t border-neutral-200">
                    {/* Table Header */}
                    <div className="hidden sm:grid sm:grid-cols-[1.6fr_0.9fr_0.9fr_0.75fr_96px_112px] items-center gap-3 py-2.5 px-3 text-[11px] text-neutral-400 border-b border-neutral-200">
                      <div>노선 · 기간</div>
                      <div className="text-right">평소 시세</div>
                      <div className="text-right">현재 최저가</div>
                      <div className="text-right">변동</div>
                      <div className="text-center">추이</div>
                      <div className="text-right">실행</div>
                    </div>

                    {/* Rows */}
                    <div className="divide-y divide-neutral-200 border-b border-neutral-200">
                      {filteredRoutes.map((route) => {
                        const isSelected = selectedRoute?.id === route.id;
                        const isRowChecking = Boolean(checkingIds[route.id]);
                        const isAny = isAnywhereCode(route.destCode);
                        const dropPct = calcDropPercent(
                          route.baselinePrice,
                          route.currentPrice
                        );
                        const dealActive = isRouteDeal(route);

                        return (
                          <div
                            key={route.id}
                            onClick={() => setSelectedRouteId(route.id)}
                            className={`grid grid-cols-1 sm:grid-cols-[1.6fr_0.9fr_0.9fr_0.75fr_96px_112px] items-center gap-3 py-3.5 px-3 cursor-pointer transition-colors ${
                              isSelected ? "bg-neutral-50" : "hover:bg-neutral-50/60"
                            } ${!route.isActive ? "opacity-55" : ""}`}
                          >
                            {/* Route & Period */}
                            <div className="min-w-0">
                              <div className="flex items-baseline gap-2">
                                <span className="text-sm font-semibold font-mono tracking-tight text-neutral-900 whitespace-nowrap">
                                  {route.originCode} →{" "}
                                  {isAny ? "ANYWHERE" : route.destCode}
                                </span>
                                <span className="text-xs text-neutral-500 truncate">
                                  {isAny && route.discoveredDestCity
                                    ? `${route.destCity} · 최저 ${route.discoveredDestCity}`
                                    : route.destCity}
                                </span>
                              </div>
                              <div className="mt-0.5 text-[11px] text-neutral-400 font-mono tabular-nums truncate">
                                {route.periodMode === "flexible"
                                  ? `${formatShortDate(route.startDate)}–${formatShortDate(
                                      route.endDate
                                    )} · ${formatStayLabel(
                                      route.stayNights,
                                      route.stayNightsMax
                                    )}`
                                  : `${formatShortDate(route.startDate)}–${formatShortDate(
                                      route.endDate
                                    )} · 고정`}
                                {" · "}
                                {route.directOnly ? "직항" : "경유포함"}
                                {" · "}
                                {formatRelativeTime(route.lastCheckedAt)}
                              </div>
                            </div>

                            {/* Baseline */}
                            <div className="hidden sm:block text-right text-xs font-mono tabular-nums text-neutral-500">
                              {route.baselinePrice > 0
                                ? formatKRW(route.baselinePrice)
                                : "—"}
                            </div>

                            {/* Current Price */}
                            <div className="flex sm:block items-baseline justify-between text-right">
                              <span className="sm:hidden text-xs text-neutral-400">
                                최저가
                              </span>
                              <span
                                className={`text-sm font-semibold font-mono tabular-nums ${
                                  dealActive ? "text-emerald-600" : "text-neutral-900"
                                }`}
                              >
                                {isRowChecking && route.currentPrice === 0
                                  ? "조회 중"
                                  : formatKRW(route.currentPrice)}
                              </span>
                            </div>

                            {/* Delta % */}
                            <div className="hidden sm:block text-right text-xs font-mono tabular-nums">
                              {route.currentPrice > 0 && route.baselinePrice > 0 ? (
                                <span
                                  className={
                                    dropPct > 0
                                      ? dealActive
                                        ? "text-emerald-600 font-medium"
                                        : "text-neutral-700"
                                      : dropPct < 0
                                      ? "text-amber-600"
                                      : "text-neutral-400"
                                  }
                                >
                                  {dropPct > 0
                                    ? `-${dropPct}%`
                                    : dropPct < 0
                                    ? `+${Math.abs(dropPct)}%`
                                    : "0%"}
                                </span>
                              ) : (
                                <span className="text-neutral-300">—</span>
                              )}
                            </div>

                            {/* Sparkline */}
                            <div className="hidden sm:flex justify-center">
                              <Sparkline
                                history={route.history}
                                baselinePrice={route.baselinePrice}
                                isDeal={dealActive}
                              />
                            </div>

                            {/* Row Quick Actions */}
                            <div
                              className="flex items-center justify-end gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                disabled={isRowChecking}
                                onClick={() => void checkRouteLive(route.id)}
                                className="h-7 px-2 text-[11px] font-medium border border-neutral-200 rounded hover:border-neutral-400 text-neutral-700 disabled:opacity-40 transition-colors whitespace-nowrap cursor-pointer"
                                title="실시간 운임 조회"
                              >
                                {isRowChecking ? "···" : "조회"}
                              </button>
                              <button
                                type="button"
                                disabled={isRowChecking}
                                onClick={() => handleSimulateDrop(route.id)}
                                className="h-7 px-2 flex items-center gap-0.5 text-[11px] font-medium border border-neutral-200 rounded hover:border-emerald-600 hover:text-emerald-700 text-neutral-600 disabled:opacity-40 transition-colors whitespace-nowrap cursor-pointer"
                                title="특가 발생 알림 테스트"
                              >
                                <Zap className="w-3 h-3 text-emerald-600" />
                                <span>테스트</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Inspector Panel (4 cols) */}
              <aside className="lg:col-span-4 lg:border-l lg:border-neutral-200 lg:pl-7">
                <RouteInspector
                  route={selectedRoute}
                  isChecking={
                    selectedRoute ? Boolean(checkingIds[selectedRoute.id]) : false
                  }
                  onCheckNow={(id) => void checkRouteLive(id)}
                  onSimulateDrop={handleSimulateDrop}
                  onToggleActive={handleToggleActive}
                  onDelete={handleDeleteRoute}
                  onPinAnywhereDeal={handlePinAnywhereDeal}
                  onUpdateSettings={handleUpdateSettings}
                />
              </aside>
            </div>
          </div>
        ) : (
          <AlertsView
            alerts={alerts}
            onSelectAlertRoute={(routeId, alertId) => {
              setAlerts((prev) =>
                prev.map((a) => (a.id === alertId ? { ...a, isRead: true } : a))
              );
              const exists = routes.some((r) => r.id === routeId);
              if (exists) {
                setSelectedRouteId(routeId);
                setActiveTab("watchlist");
              }
            }}
            onMarkAllRead={() =>
              setAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })))
            }
            onClearAll={() => setAlerts([])}
          />
        )}
      </main>

      {/* Add Route Modal */}
      <AddRouteModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddRoute}
      />

      {/* GitHub Actions + ntfy Config Modal */}
      <NtfyModal
        isOpen={isNtfyModalOpen}
        onClose={() => setIsNtfyModalOpen(false)}
        ntfyTopic={ntfyTopic}
        onChangeTopic={setNtfyTopic}
        routes={routes}
        lastGithubSyncAt={lastGithubSyncAt}
        onSyncFromGithubState={syncFromGithubState}
        githubToken={githubToken}
        onChangeGithubToken={setGithubToken}
        githubRepo={githubRepo}
        onChangeGithubRepo={setGithubRepo}
        githubSyncStatus={githubSyncStatus}
        onPushConfigNow={pushConfigNow}
      />

      {/* Minimal Live Deal Toast */}
      {toastAlert && (
        <div
          onClick={() => {
            setAlerts((prev) =>
              prev.map((a) =>
                a.id === toastAlert.id ? { ...a, isRead: true } : a
              )
            );
            setSelectedRouteId(toastAlert.routeId);
            setActiveTab("watchlist");
            setToastAlert(null);
          }}
          className="fixed bottom-5 right-5 z-50 w-80 bg-neutral-900 text-white rounded-lg p-4 shadow-lg cursor-pointer"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 min-w-0">
              <div className="text-xs text-emerald-400 font-mono tabular-nums font-medium">
                특가 감지 · 평소 대비 -{toastAlert.dropPercent}%
              </div>
              <div className="text-sm font-semibold font-mono tabular-nums">
                {toastAlert.originCode} → {toastAlert.destCode}{" "}
                {formatKRW(toastAlert.dealPrice)}
              </div>
              <div className="text-xs text-neutral-400 font-mono tabular-nums truncate">
                {toastAlert.destCity} · {formatShortDate(toastAlert.depDate)}–
                {formatShortDate(toastAlert.retDate)} · {toastAlert.airline}
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setToastAlert(null);
              }}
              className="p-1 text-neutral-400 hover:text-white cursor-pointer"
              aria-label="알림 닫기"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
      {/* Offline Indicator */}
      <OfflineIndicator />
    </div>
  );
}
