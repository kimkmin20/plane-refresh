import type { DealAlert, WatchRoute } from "../types";

function offsetDate(daysFromToday: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function offsetIsoMinutes(minutesAgo: number): string {
  return new Date(Date.now() - minutesAgo * 60_000).toISOString();
}

function skyscannerLink(
  origin: string,
  dest: string,
  dep: string,
  ret: string
): string {
  if (dest === "ANYWHERE" || dest === "ANYWHERE_ALL") {
    return `https://www.skyscanner.co.kr/transport/flights-from/${origin.toLowerCase()}/`;
  }
  const d1 = dep.replace(/-/g, "").slice(2);
  const d2 = ret.replace(/-/g, "").slice(2);
  return `https://www.skyscanner.co.kr/transport/flights/${origin.toLowerCase()}/${dest.toLowerCase()}/${d1}/${d2}/`;
}

export function createInitialSeedData(): {
  routes: WatchRoute[];
  alerts: DealAlert[];
} {
  const anyStart = offsetDate(14);
  const anyEnd = offsetDate(35);
  const anyDep = offsetDate(20);
  const anyRet = offsetDate(23);

  const fukStart = offsetDate(18);
  const fukEnd = offsetDate(45);
  const fukBestDep = offsetDate(26);
  const fukBestRet = offsetDate(29);

  const nrtDep = offsetDate(32);
  const nrtRet = offsetDate(36);

  const routes: WatchRoute[] = [
    {
      id: "seed-icn-anywhere",
      originCode: "ICN",
      originCity: "서울/인천",
      destCode: "ANYWHERE",
      destCity: "해외 어디든지",
      periodMode: "flexible",
      startDate: anyStart,
      endDate: anyEnd,
      stayNights: 3,
      directOnly: true,
      baselinePrice: 225000,
      currentPrice: 158900,
      bestDepDate: anyDep,
      bestRetDate: anyRet,
      airline: "피치항공",
      duration: "1시간 50분",
      discoveredDestCode: "KIX",
      discoveredDestCity: "오사카",
      anywhereDeals: [
        {
          destCode: "KIX",
          destCity: "오사카",
          destCountry: "일본",
          price: 158900,
          depDate: anyDep,
          retDate: anyRet,
          airline: "피치항공",
          isDirect: true,
          duration: "1시간 50분",
          bookingUrl: skyscannerLink("ICN", "KIX", anyDep, anyRet),
        },
        {
          destCode: "TAO",
          destCity: "칭다오",
          destCountry: "중국",
          price: 164000,
          depDate: offsetDate(19),
          retDate: offsetDate(22),
          airline: "티웨이항공",
          isDirect: true,
          duration: "1시간 35분",
          bookingUrl: skyscannerLink("ICN", "TAO", offsetDate(19), offsetDate(22)),
        },
        {
          destCode: "FUK",
          destCity: "후쿠오카",
          destCountry: "일본",
          price: 189000,
          depDate: offsetDate(21),
          retDate: offsetDate(24),
          airline: "제주항공",
          isDirect: true,
          duration: "1시간 25분",
          bookingUrl: skyscannerLink("ICN", "FUK", offsetDate(21), offsetDate(24)),
        },
        {
          destCode: "TPE",
          destCity: "타이베이",
          destCountry: "대만",
          price: 224000,
          depDate: offsetDate(24),
          retDate: offsetDate(27),
          airline: "타이거에어 타이완",
          isDirect: true,
          duration: "2시간 45분",
          bookingUrl: skyscannerLink("ICN", "TPE", offsetDate(24), offsetDate(27)),
        },
      ],
      dropThresholdPercent: 15,
      targetPrice: 180000,
      checkIntervalMinutes: 15,
      isActive: true,
      lastCheckedAt: offsetIsoMinutes(4),
      lastAlertedPrice: 158900,
      sources: [
        {
          title: "Skyscanner 어디든지 검색",
          uri: skyscannerLink("ICN", "ANYWHERE", anyDep, anyRet),
        },
      ],
      history: [
        {
          timestamp: offsetIsoMinutes(240),
          price: 198000,
          depDate: offsetDate(18),
          retDate: offsetDate(21),
          airline: "진에어",
          destCode: "FUK",
          destCity: "후쿠오카",
        },
        {
          timestamp: offsetIsoMinutes(120),
          price: 176000,
          depDate: offsetDate(19),
          retDate: offsetDate(22),
          airline: "이스타항공",
          destCode: "TAO",
          destCity: "칭다오",
        },
        {
          timestamp: offsetIsoMinutes(4),
          price: 158900,
          depDate: anyDep,
          retDate: anyRet,
          airline: "피치항공",
          destCode: "KIX",
          destCity: "오사카",
        },
      ],
    },
    {
      id: "seed-icn-fuk",
      originCode: "ICN",
      originCity: "서울/인천",
      destCode: "FUK",
      destCity: "후쿠오카",
      periodMode: "flexible",
      startDate: fukStart,
      endDate: fukEnd,
      stayNights: 3,
      directOnly: true,
      baselinePrice: 265000,
      currentPrice: 194000,
      bestDepDate: fukBestDep,
      bestRetDate: fukBestRet,
      airline: "제주항공",
      duration: "1시간 25분",
      dropThresholdPercent: 15,
      targetPrice: null,
      checkIntervalMinutes: 15,
      isActive: true,
      lastCheckedAt: offsetIsoMinutes(9),
      lastAlertedPrice: 194000,
      sources: [
        {
          title: "Skyscanner 노선 비교",
          uri: skyscannerLink("ICN", "FUK", fukBestDep, fukBestRet),
        },
      ],
      history: [
        {
          timestamp: offsetIsoMinutes(360),
          price: 268000,
          depDate: offsetDate(22),
          retDate: offsetDate(25),
          airline: "티웨이항공",
        },
        {
          timestamp: offsetIsoMinutes(180),
          price: 244000,
          depDate: fukBestDep,
          retDate: fukBestRet,
          airline: "진에어",
        },
        {
          timestamp: offsetIsoMinutes(9),
          price: 194000,
          depDate: fukBestDep,
          retDate: fukBestRet,
          airline: "제주항공",
        },
      ],
    },
    {
      id: "seed-icn-nrt",
      originCode: "ICN",
      originCity: "서울/인천",
      destCode: "NRT",
      destCity: "도쿄/나리타",
      periodMode: "fixed",
      startDate: nrtDep,
      endDate: nrtRet,
      stayNights: 4,
      directOnly: true,
      baselinePrice: 345000,
      currentPrice: 332000,
      bestDepDate: nrtDep,
      bestRetDate: nrtRet,
      airline: "에어프레미아",
      duration: "2시간 25분",
      dropThresholdPercent: 15,
      targetPrice: 290000,
      checkIntervalMinutes: 15,
      isActive: true,
      lastCheckedAt: offsetIsoMinutes(14),
      lastAlertedPrice: null,
      sources: [
        {
          title: "Skyscanner 노선 비교",
          uri: skyscannerLink("ICN", "NRT", nrtDep, nrtRet),
        },
      ],
      history: [
        {
          timestamp: offsetIsoMinutes(300),
          price: 352000,
          depDate: nrtDep,
          retDate: nrtRet,
          airline: "아시아나항공",
        },
        {
          timestamp: offsetIsoMinutes(14),
          price: 332000,
          depDate: nrtDep,
          retDate: nrtRet,
          airline: "에어프레미아",
        },
      ],
    },
  ];

  const alerts: DealAlert[] = [
    {
      id: "seed-alert-anywhere",
      routeId: "seed-icn-anywhere",
      originCode: "ICN",
      originCity: "서울/인천",
      destCode: "KIX",
      destCity: "오사카 (어디든지 탐색)",
      baselinePrice: 225000,
      dealPrice: 158900,
      dropPercent: 29,
      depDate: anyDep,
      retDate: anyRet,
      airline: "피치항공",
      createdAt: offsetIsoMinutes(4),
      isRead: false,
      isSimulated: false,
      bookingUrl: skyscannerLink("ICN", "KIX", anyDep, anyRet),
    },
  ];

  return { routes, alerts };
}
