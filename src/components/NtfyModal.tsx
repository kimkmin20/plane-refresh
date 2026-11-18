import { useState } from "react";
import { Check, Copy, Download, RefreshCw, Send, X } from "lucide-react";
import type { WatchRoute } from "../types";

interface NtfyModalProps {
  isOpen: boolean;
  onClose: () => void;
  ntfyTopic: string;
  onChangeTopic: (topic: string) => void;
  routes: WatchRoute[];
  lastGithubSyncAt: string | null;
  onSyncFromGithubState: () => Promise<boolean>;
}

export function NtfyModal({
  isOpen,
  onClose,
  ntfyTopic,
  onChangeTopic,
  routes,
  lastGithubSyncAt,
  onSyncFromGithubState,
}: NtfyModalProps) {
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  if (!isOpen) return null;

  const cleanTopic = ntfyTopic.trim().replace(/^\/+/, "");

  const buildWatchConfigJson = () => {
    const payload = {
      ntfyServer: "https://ntfy.sh",
      ntfyTopic: cleanTopic,
      routes: routes.map((r) => ({
        id: r.id,
        originCode: r.originCode,
        originCity: r.originCity,
        destCode: r.destCode,
        destCity: r.destCity,
        periodMode: r.periodMode,
        startDate: r.startDate,
        endDate: r.endDate,
        stayNights: r.stayNights,
        stayNightsMax: r.stayNightsMax ?? r.stayNights,
        directOnly: r.directOnly,
        dropThresholdPercent: r.dropThresholdPercent,
        targetPrice: r.targetPrice,
        checkIntervalMinutes: r.checkIntervalMinutes || 15,
        isActive: r.isActive,
      })),
    };
    return JSON.stringify(payload, null, 2);
  };

  const handleSendTest = async () => {
    if (!cleanTopic) {
      setFeedback({ type: "err", text: "ntfy 토픽 이름을 입력하세요." });
      return;
    }

    setTesting(true);
    setFeedback(null);

    try {
      const apiRes = await fetch("/api/ntfy/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: cleanTopic }),
      });

      const contentType = apiRes.headers.get("content-type") || "";
      if (apiRes.ok && contentType.includes("application/json")) {
        setFeedback({ type: "ok", text: `발송 완료 (${cleanTopic})` });
        return;
      }

      if (apiRes.status !== 404 && !contentType.includes("text/html")) {
        const errData = (await apiRes.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(errData.error || "ntfy 발송 실패");
      }

      // Static hosting fallback (GitHub Pages): publish directly to ntfy.sh
      const directRes = await fetch("https://ntfy.sh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: cleanTopic,
          title: "FareWatch 알림 테스트",
          message:
            "연결 완료! GitHub Actions가 15분마다 특가 발견 시 이 채널로 푸시합니다.",
          priority: 4,
          tags: ["airplane", "white_check_mark"],
        }),
      });

      if (!directRes.ok) {
        throw new Error(`ntfy 응답 오류 (${directRes.status})`);
      }

      setFeedback({ type: "ok", text: `발송 완료 (${cleanTopic})` });
    } catch (err: unknown) {
      setFeedback({
        type: "err",
        text: err instanceof Error ? err.message : "테스트 발송 실패",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleCopyConfig = async () => {
    try {
      await navigator.clipboard.writeText(buildWatchConfigJson());
      setCopied(true);
      setFeedback({ type: "ok", text: "watch-config.json 복사됨" });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setFeedback({ type: "err", text: "클립보드 복사 실패" });
    }
  };

  const handleDownloadConfig = () => {
    const blob = new Blob([buildWatchConfigJson() + "\n"], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "watch-config.json";
    a.click();
    URL.revokeObjectURL(url);
    setFeedback({ type: "ok", text: "watch-config.json 다운로드됨" });
  };

  const handleSync = async () => {
    setSyncing(true);
    setFeedback(null);
    const ok = await onSyncFromGithubState();
    setSyncing(false);
    setFeedback(
      ok
        ? { type: "ok", text: "GitHub 감시 상태 동기화 완료" }
        : { type: "err", text: "아직 GitHub Actions 조회 이력이 없습니다." }
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-neutral-950/35 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white border border-neutral-200 rounded-lg shadow-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3.5 border-b border-neutral-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900">
            24시간 GitHub 감시 · ntfy
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-900 rounded cursor-pointer"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* ntfy Topic */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-neutral-700">
              ntfy 토픽 이름
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={ntfyTopic}
                onChange={(e) => onChangeTopic(e.target.value)}
                placeholder="farewatch-my-secret-key"
                className="flex-1 h-9 px-2.5 text-xs font-mono border border-neutral-200 rounded-md focus:outline-none focus:border-neutral-900"
              />
              <button
                type="button"
                disabled={testing}
                onClick={handleSendTest}
                className="h-9 px-3 flex items-center gap-1.5 text-xs font-medium bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{testing ? "전송 중" : "테스트"}</span>
              </button>
            </div>
            <div className="text-[11px] font-mono text-neutral-400 truncate">
              https://ntfy.sh/{cleanTopic || "..."}
            </div>
          </div>

          {/* Export watch-config.json */}
          <div className="pt-4 border-t border-neutral-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-700">
                감시 설정 (watch-config.json)
              </span>
              <span className="text-[11px] font-mono tabular-nums text-neutral-400">
                {routes.length}개 노선 · 15분 주기
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleCopyConfig}
                className="h-9 px-3 flex items-center justify-center gap-1.5 text-xs font-medium border border-neutral-200 text-neutral-800 hover:bg-neutral-50 rounded-md cursor-pointer"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>설정 복사</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadConfig}
                className="h-9 px-3 flex items-center justify-center gap-1.5 text-xs font-medium border border-neutral-200 text-neutral-800 hover:bg-neutral-50 rounded-md cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>파일 저장</span>
              </button>
            </div>
          </div>

          {/* Sync GitHub state */}
          <div className="pt-4 border-t border-neutral-200 flex items-center justify-between gap-3">
            <div className="text-[11px] font-mono tabular-nums text-neutral-500">
              {lastGithubSyncAt
                ? `최근 동기화 ${new Date(lastGithubSyncAt).toLocaleString("ko-KR")}`
                : "GitHub 상태 미동기화"}
            </div>
            <button
              type="button"
              disabled={syncing}
              onClick={handleSync}
              className="h-8 px-2.5 flex items-center gap-1.5 text-xs border border-neutral-200 text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`}
              />
              <span>불러오기</span>
            </button>
          </div>

          {feedback && (
            <div
              className={`text-xs font-medium ${
                feedback.type === "ok" ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {feedback.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
