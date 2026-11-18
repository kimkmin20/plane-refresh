const WEEKDAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];

export function formatKRW(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "—";
  return `₩${Math.round(amount).toLocaleString("ko-KR")}`;
}

export function calcDropPercent(baseline: number, current: number): number {
  if (!baseline || baseline <= 0 || !current || current <= 0) return 0;
  return Math.round(((baseline - current) / baseline) * 100);
}

export function formatShortDate(dateStr: string, includeWeekday = false): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr || "—";
  const [, mm, dd] = dateStr.split("-");
  if (!includeWeekday) return `${mm}.${dd}`;
  const d = new Date(`${dateStr}T00:00:00`);
  const day = WEEKDAYS_KO[d.getDay()] ?? "";
  return `${mm}.${dd}(${day})`;
}

export function formatStayLabel(minNights: number, maxNights?: number): string {
  const min = Math.max(1, minNights || 1);
  const max = Math.max(min, maxNights ?? min);
  if (min === max) return `${min}박`;
  return `${min}~${max}박`;
}

export function formatRelativeTime(iso: string | null): string {
  if (!iso) return "미조회";
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 45) return "방금";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}시간 전`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}일 전`;
}

export function formatClockTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function getDaysBetween(start: string, end: string): number {
  const s = new Date(`${start}T00:00:00Z`).getTime();
  const e = new Date(`${end}T00:00:00Z`).getTime();
  if (Number.isNaN(s) || Number.isNaN(e)) return 0;
  return Math.max(0, Math.round((e - s) / 86_400_000));
}

export function addDaysISO(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateStr;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function todayISO(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function playDealChime(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const notes = [587.33, 880]; // D5 -> A5 crisp minimal chime
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.11);

      gain.gain.setValueAtTime(0.0001, now + idx * 0.11);
      gain.gain.exponentialRampToValueAtTime(0.08, now + idx * 0.11 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.11 + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.11);
      osc.stop(now + idx * 0.11 + 0.3);
    });
  } catch {
    // Ignore audio restrictions silently
  }
}

export function getBrowserNotificationState():
  | "unsupported"
  | "default"
  | "granted"
  | "denied" {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<
  "unsupported" | "default" | "granted" | "denied"
> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return Notification.permission;
  }
}

export async function sendBrowserDealNotification(
  title: string,
  body: string,
  onClick?: () => void
): Promise<boolean> {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  ) {
    return false;
  }

  // Android Chrome / Installed PWAs require ServiceWorkerRegistration.showNotification
  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification(title, {
          body,
          icon: "/pwa-192x192.png",
          badge: "/pwa-192x192.png",
          tag: `farewatch-${Date.now()}`,
        });
        return true;
      }
    } catch {
      // Fall through to window.Notification
    }
  }

  try {
    const n = new Notification(title, {
      body,
      icon: "/pwa-192x192.png",
      silent: false,
    });
    if (onClick) {
      n.onclick = () => {
        window.focus();
        onClick();
        n.close();
      };
    }
    return true;
  } catch {
    return false;
  }
}
