import React, { useState } from "react";
import { ArrowLeftRight, X } from "lucide-react";
import {
  AIRPORTS,
  ANYWHERE_OPTIONS,
  DOMESTIC_AIRPORTS,
  findAirportLabel,
  isAnywhereCode,
} from "../data/airports";
import type { PeriodMode } from "../types";
import { getDaysBetween, todayISO } from "../utils/format";

export interface NewRouteInput {
  originCode: string;
  originCity: string;
  destCode: string;
  destCity: string;
  periodMode: PeriodMode;
  startDate: string;
  endDate: string;
  stayNights: number;
  stayNightsMax: number;
  directOnly: boolean;
  dropThresholdPercent: number;
  targetPrice: number | null;
  checkIntervalMinutes: number;
}

interface AddRouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (input: NewRouteInput) => void;
}

export function AddRouteModal({ isOpen, onClose, onAdd }: AddRouteModalProps) {
  const [originCode, setOriginCode] = useState("ICN");
  const [destCode, setDestCode] = useState("ANYWHERE");
  const [customOrigin, setCustomOrigin] = useState("");
  const [customDest, setCustomDest] = useState("");
  const [periodMode, setPeriodMode] = useState<PeriodMode>("flexible");
  const [startDate, setStartDate] = useState(() => todayISO(14));
  const [endDate, setEndDate] = useState(() => todayISO(44));
  const [stayNightsMin, setStayNightsMin] = useState(2);
  const [stayNightsMax, setStayNightsMax] = useState(4);
  const [directOnly, setDirectOnly] = useState(true);
  const [dropThresholdPercent, setDropThresholdPercent] = useState(15);
  const [targetPriceInput, setTargetPriceInput] = useState("");
  const [checkIntervalMinutes, setCheckIntervalMinutes] = useState(15);
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen) return null;

  const resolvedOriginCode =
    originCode === "CUSTOM" ? customOrigin.trim().toUpperCase() : originCode;
  const resolvedDestCode =
    destCode === "CUSTOM" ? customDest.trim().toUpperCase() : destCode;

  const destIsAnywhere = isAnywhereCode(resolvedDestCode);

  const handleSwap = () => {
    if (destIsAnywhere) return;
    const prevOrigin = originCode === "CUSTOM" ? customOrigin.trim().toUpperCase() : originCode;
    const prevDest = destCode === "CUSTOM" ? customDest.trim().toUpperCase() : destCode;

    const isPrevDestDomestic = DOMESTIC_AIRPORTS.some((a) => a.code === prevDest);
    if (isPrevDestDomestic) {
      setOriginCode(prevDest);
      setCustomOrigin("");
    } else {
      setOriginCode("CUSTOM");
      setCustomOrigin(prevDest);
    }

    const isPrevOriginInAirports = AIRPORTS.some((a) => a.code === prevOrigin);
    if (isPrevOriginInAirports) {
      setDestCode(prevOrigin);
      setCustomDest("");
    } else {
      setDestCode("CUSTOM");
      setCustomDest(prevOrigin);
    }
    setValidationError(null);
  };

  const handleModeChange = (nextMode: PeriodMode) => {
    setPeriodMode(nextMode);
    setValidationError(null);
    if (nextMode === "fixed") {
      const span = getDaysBetween(startDate, endDate);
      if (span > 14 || span < 1) {
        const d = new Date(`${startDate}T00:00:00`);
        d.setDate(d.getDate() + stayNightsMin);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        setEndDate(`${yyyy}-${mm}-${dd}`);
      }
    }
  };

  const adjustMinNights = (delta: number) => {
    setStayNightsMin((prev) => {
      const next = Math.max(1, Math.min(30, prev + delta));
      if (next > stayNightsMax) {
        setStayNightsMax(next);
      }
      return next;
    });
  };

  const adjustMaxNights = (delta: number) => {
    setStayNightsMax((prev) => {
      const next = Math.max(stayNightsMin, Math.min(30, prev + delta));
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[A-Z]{3}$/.test(resolvedOriginCode)) {
      setValidationError("출발 공항 코드는 영문 3자리(예: ICN)로 입력해 주세요.");
      return;
    }
    if (!destIsAnywhere && !/^[A-Z]{3}$/.test(resolvedDestCode)) {
      setValidationError("도착 공항 코드는 영문 3자리(예: NRT)로 입력해 주세요.");
      return;
    }
    if (resolvedOriginCode === resolvedDestCode) {
      setValidationError("출발지와 도착지가 같습니다.");
      return;
    }
    if (!startDate || !endDate || endDate < startDate) {
      setValidationError("종료일은 시작일 이후여야 합니다.");
      return;
    }

    const totalDays = getDaysBetween(startDate, endDate);
    if (periodMode === "fixed" && totalDays < 1) {
      setValidationError("귀국일은 출발일 다음 날 이후로 지정해 주세요.");
      return;
    }

    const originMeta = findAirportLabel(resolvedOriginCode);
    const destMeta = findAirportLabel(resolvedDestCode);
    const parsedTarget = targetPriceInput.trim()
      ? Number(targetPriceInput.replace(/,/g, ""))
      : null;

    if (parsedTarget !== null && (!Number.isFinite(parsedTarget) || parsedTarget < 10000)) {
      setValidationError("희망 상한가는 10,000원 이상 숫자로 입력해 주세요.");
      return;
    }

    const fixedNights = Math.max(1, totalDays);
    onAdd({
      originCode: originMeta.code,
      originCity: originMeta.city,
      destCode: destMeta.code,
      destCity: destMeta.city,
      periodMode,
      startDate,
      endDate,
      stayNights: periodMode === "fixed" ? fixedNights : stayNightsMin,
      stayNightsMax: periodMode === "fixed" ? fixedNights : stayNightsMax,
      directOnly,
      dropThresholdPercent,
      targetPrice: parsedTarget,
      checkIntervalMinutes,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white border border-neutral-200 rounded-lg p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-neutral-900">감시 노선 추가</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-900 rounded-md transition-colors cursor-pointer"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Origin & Destination */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <div>
              <label className="block text-xs text-neutral-500 mb-1.5">출발</label>
              <select
                value={originCode}
                onChange={(e) => {
                  setOriginCode(e.target.value);
                  setValidationError(null);
                }}
                className="w-full h-10 px-2.5 text-sm border border-neutral-200 rounded-md bg-white text-neutral-900 focus:outline-none focus:border-neutral-900"
              >
                <optgroup label="국내 공항">
                  {DOMESTIC_AIRPORTS.map((a) => (
                    <option key={a.code} value={a.code}>
                      {a.code} · {a.city}
                    </option>
                  ))}
                </optgroup>
                <option value="CUSTOM">해외·기타 직접 입력</option>
              </select>
              {originCode === "CUSTOM" && (
                <input
                  type="text"
                  maxLength={3}
                  placeholder="IATA (예: KIX)"
                  value={customOrigin}
                  onChange={(e) => setCustomOrigin(e.target.value.toUpperCase())}
                  className="mt-1.5 w-full h-9 px-2.5 text-sm font-mono uppercase border border-neutral-200 rounded-md focus:outline-none focus:border-neutral-900"
                />
              )}
            </div>

            <button
              type="button"
              disabled={destIsAnywhere}
              onClick={handleSwap}
              className="h-10 w-9 flex items-center justify-center border border-neutral-200 rounded-md text-neutral-500 hover:text-neutral-900 hover:border-neutral-400 disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
              aria-label="출발지와 도착지 바꿈"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </button>

            <div>
              <label className="block text-xs text-neutral-500 mb-1.5">도착</label>
              <select
                value={destCode}
                onChange={(e) => {
                  setDestCode(e.target.value);
                  setValidationError(null);
                }}
                className="w-full h-10 px-2.5 text-sm border border-neutral-200 rounded-md bg-white text-neutral-900 focus:outline-none focus:border-neutral-900"
              >
                <optgroup label="어디든지 탐색 (Anywhere)">
                  {ANYWHERE_OPTIONS.map((a) => (
                    <option key={a.code} value={a.code}>
                      {a.city}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="도시 · 공항 지정">
                  {AIRPORTS.map((a) => (
                    <option key={a.code} value={a.code}>
                      {a.code} · {a.city}
                    </option>
                  ))}
                  <option value="CUSTOM">직접 입력 (IATA)</option>
                </optgroup>
              </select>
              {destCode === "CUSTOM" && (
                <input
                  type="text"
                  maxLength={3}
                  placeholder="IATA (예: VIE)"
                  value={customDest}
                  onChange={(e) => setCustomDest(e.target.value.toUpperCase())}
                  className="mt-1.5 w-full h-9 px-2.5 text-sm font-mono uppercase border border-neutral-200 rounded-md focus:outline-none focus:border-neutral-900"
                />
              )}
            </div>
          </div>

          {/* Period Mode */}
          <div>
            <label className="block text-xs text-neutral-500 mb-1.5">기간 방식</label>
            <div className="grid grid-cols-2 p-1 bg-neutral-100 rounded-md">
              <button
                type="button"
                onClick={() => handleModeChange("flexible")}
                className={`h-8 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                  periodMode === "flexible"
                    ? "bg-white text-neutral-900 shadow-xs"
                    : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                유연한 기간 + 체류 범위
              </button>
              <button
                type="button"
                onClick={() => handleModeChange("fixed")}
                className={`h-8 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                  periodMode === "fixed"
                    ? "bg-white text-neutral-900 shadow-xs"
                    : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                고정 날짜
              </button>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs text-neutral-500 mb-1.5">
                {periodMode === "flexible" ? "출발 가능 시작일" : "가는 날"}
              </label>
              <input
                type="date"
                value={startDate}
                min={todayISO(0)}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setValidationError(null);
                }}
                className="w-full h-10 px-2.5 text-xs font-mono tabular-nums border border-neutral-200 rounded-md focus:outline-none focus:border-neutral-900"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1.5">
                {periodMode === "flexible" ? "출발 가능 종료일" : "오는 날"}
              </label>
              <input
                type="date"
                value={endDate}
                min={startDate || todayISO(0)}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setValidationError(null);
                }}
                className="w-full h-10 px-2.5 text-xs font-mono tabular-nums border border-neutral-200 rounded-md focus:outline-none focus:border-neutral-900"
              />
            </div>
          </div>

          {/* Stay Range + Direct */}
          <div className="grid grid-cols-2 gap-2.5">
            {periodMode === "flexible" ? (
              <div>
                <label className="block text-xs text-neutral-500 mb-1.5">
                  체류 일정 (최소~최대)
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="flex items-center h-10 border border-neutral-200 rounded-md overflow-hidden">
                    <button
                      type="button"
                      onClick={() => adjustMinNights(-1)}
                      className="w-7 h-full text-sm text-neutral-600 hover:bg-neutral-50 cursor-pointer"
                      aria-label="최소 박수 감소"
                    >
                      −
                    </button>
                    <div className="flex-1 text-center text-xs font-mono tabular-nums text-neutral-900">
                      {stayNightsMin}박
                    </div>
                    <button
                      type="button"
                      onClick={() => adjustMinNights(1)}
                      className="w-7 h-full text-sm text-neutral-600 hover:bg-neutral-50 cursor-pointer"
                      aria-label="최소 박수 증가"
                    >
                      +
                    </button>
                  </div>

                  <div className="flex items-center h-10 border border-neutral-200 rounded-md overflow-hidden">
                    <button
                      type="button"
                      onClick={() => adjustMaxNights(-1)}
                      className="w-7 h-full text-sm text-neutral-600 hover:bg-neutral-50 cursor-pointer"
                      aria-label="최대 박수 감소"
                    >
                      −
                    </button>
                    <div className="flex-1 text-center text-xs font-mono tabular-nums text-neutral-900">
                      {stayNightsMax}박
                    </div>
                    <button
                      type="button"
                      onClick={() => adjustMaxNights(1)}
                      className="w-7 h-full text-sm text-neutral-600 hover:bg-neutral-50 cursor-pointer"
                      aria-label="최대 박수 증가"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs text-neutral-500 mb-1.5">총 일정</label>
                <div className="h-10 px-3 flex items-center text-xs font-mono tabular-nums text-neutral-600 bg-neutral-50 border border-neutral-200 rounded-md">
                  {Math.max(1, getDaysBetween(startDate, endDate))}박{" "}
                  {Math.max(1, getDaysBetween(startDate, endDate)) + 1}일
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs text-neutral-500 mb-1.5">경유 여부</label>
              <div className="grid grid-cols-2 p-1 h-10 bg-neutral-100 rounded-md">
                <button
                  type="button"
                  onClick={() => setDirectOnly(true)}
                  className={`text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                    directOnly ? "bg-white text-neutral-900 shadow-xs" : "text-neutral-600"
                  }`}
                >
                  직항만
                </button>
                <button
                  type="button"
                  onClick={() => setDirectOnly(false)}
                  className={`text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                    !directOnly ? "bg-white text-neutral-900 shadow-xs" : "text-neutral-600"
                  }`}
                >
                  경유 포함
                </button>
              </div>
            </div>
          </div>

          {/* Threshold & Target Price */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs text-neutral-500 mb-1.5">
                평균 대비 알림 기준
              </label>
              <select
                value={dropThresholdPercent}
                onChange={(e) => setDropThresholdPercent(Number(e.target.value))}
                className="w-full h-10 px-2.5 text-xs font-mono tabular-nums border border-neutral-200 rounded-md bg-white text-neutral-900 focus:outline-none focus:border-neutral-900"
              >
                <option value={10}>-10% 이하 시 알림</option>
                <option value={15}>-15% 이하 시 알림</option>
                <option value={20}>-20% 이하 시 알림</option>
                <option value={25}>-25% 이하 시 알림</option>
                <option value={30}>-30% 이하 시 알림</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-neutral-500 mb-1.5">
                희망 상한가 (선택)
              </label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="미지정 (원)"
                value={targetPriceInput}
                onChange={(e) =>
                  setTargetPriceInput(e.target.value.replace(/[^\d]/g, ""))
                }
                className="w-full h-10 px-2.5 text-xs font-mono tabular-nums border border-neutral-200 rounded-md focus:outline-none focus:border-neutral-900"
              />
            </div>
          </div>

          {/* Check Interval */}
          <div>
            <label className="block text-xs text-neutral-500 mb-1.5">자동 조회 주기</label>
            <div className="grid grid-cols-4 gap-1.5">
              {[5, 15, 30, 60].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setCheckIntervalMinutes(mins)}
                  className={`h-9 text-xs font-mono tabular-nums rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
                    checkIntervalMinutes === mins
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-200 text-neutral-600 hover:border-neutral-400"
                  }`}
                >
                  {mins === 60 ? "1시간" : `${mins}분`}
                </button>
              ))}
            </div>
          </div>

          {validationError && (
            <p className="text-xs text-red-600">{validationError}</p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 rounded-md transition-colors whitespace-nowrap cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-md transition-colors whitespace-nowrap cursor-pointer"
            >
              감시 시작
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
