import { useState } from "react";
import { Download, ExternalLink, X } from "lucide-react";
import { usePWAInstall } from "../hooks/usePWAInstall";

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
      return;
    }
    setShowGuide(true);
  };

  const currentOrigin =
    typeof window !== "undefined" ? window.location.origin : "";

  return (
    <>
      <button
        type="button"
        onClick={() => void handleClick()}
        className="h-8 px-2.5 flex items-center gap-1.5 text-xs font-medium border border-neutral-200 text-neutral-700 hover:border-neutral-900 hover:text-neutral-900 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Download className="w-3.5 h-3.5" />
        <span>앱 설치</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="w-full max-w-sm bg-white border border-neutral-200 rounded-lg p-5 shadow-lg space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900">
                {isIOS ? "iOS 홈 화면에 추가" : "Android 앱 설치 및 APK 변환"}
              </h3>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="p-1 text-neutral-400 hover:text-neutral-900 cursor-pointer"
                aria-label="닫기"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <ol className="text-xs text-neutral-600 space-y-2 list-decimal pl-4">
                <li>Safari 하단 공유 아이콘을 누릅니다.</li>
                <li>
                  <span className="font-medium text-neutral-900">
                    홈 화면에 추가
                  </span>
                  를 선택합니다.
                </li>
              </ol>
            ) : (
              <div className="space-y-3 text-xs text-neutral-600">
                <div className="space-y-1">
                  <div className="font-medium text-neutral-900">
                    1. Android Chrome에서 바로 설치
                  </div>
                  <p>
                    새 탭에서 앱 주소를 연 뒤 크롬 메뉴(⋮) →{" "}
                    <span className="font-medium text-neutral-900">앱 설치</span>{" "}
                    또는{" "}
                    <span className="font-medium text-neutral-900">
                      홈 화면에 추가
                    </span>
                    를 누릅니다.
                  </p>
                </div>

                <div className="pt-3 border-t border-neutral-200 space-y-1.5">
                  <div className="font-medium text-neutral-900">
                    2. APK 파일로 직접 추출 (PWABuilder)
                  </div>
                  <p>
                    아래 주소를 PWABuilder에 입력하면 Android APK 파일을 바로
                    다운로드할 수 있습니다.
                  </p>
                  <div className="flex items-center justify-between gap-2 p-2 bg-neutral-50 border border-neutral-200 rounded font-mono text-[11px] text-neutral-800">
                    <span className="truncate">{currentOrigin}</span>
                    <a
                      href={`https://www.pwabuilder.com/?url=${encodeURIComponent(
                        currentOrigin
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-neutral-900 font-sans font-medium hover:underline shrink-0"
                    >
                      <span>PWABuilder</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full h-9 text-xs font-medium bg-neutral-900 text-white hover:bg-neutral-800 rounded-md transition-colors cursor-pointer"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </>
  );
}
