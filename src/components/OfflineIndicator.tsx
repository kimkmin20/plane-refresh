import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-5 left-5 z-50 flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-900 px-3 py-2 text-xs font-medium text-white shadow-lg">
      <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
      <span>오프라인 · 저장된 시세 표시 중</span>
    </div>
  );
}
