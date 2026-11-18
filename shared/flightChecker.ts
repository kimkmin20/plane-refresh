export const KIWI_GRAPHQL_URL =
  "https://api.skypicker.com/umbrella/v2/graphql?featureName=SearchReturnItinerariesQuery";

export const AIRLINE_KO_MAP: Record<string, string> = {
  "Korean Air": "대한항공",
  "Asiana Airlines": "아시아나항공",
  "Jeju Air": "제주항공",
  "Jin Air": "진에어",
  "Tway Airlines": "티웨이항공",
  "T'way Air": "티웨이항공",
  "Eastar Jet": "이스타항공",
  "Air Busan": "에어부산",
  "Air Seoul": "에어서울",
  "Air Premia": "에어프레미아",
  "Aero K": "에어로케이",
  "Peach Aviation": "피치항공",
  "Zipair": "집에어",
  "ZIPAIR Tokyo": "집에어",
  "All Nippon Airways": "전일본공수(ANA)",
  "Japan Airlines": "일본항공(JAL)",
  "VietJet Air": "비엣젯항공",
  "Vietnam Airlines": "베트남항공",
  "Bamboo Airways": "밤부항공",
  "Cebu Pacific": "세부퍼시픽",
  "Philippines AirAsia": "필리핀에어아시아",
  "Philippine Airlines": "필리핀항공",
  "Thai AirAsia X": "타이에어아시아엑스",
  "Thai Airways": "타이항공",
  "Scoot": "스쿠트",
  "Singapore Airlines": "싱가포르항공",
  "Tigerair Taiwan": "타이거에어 타이완",
  "EVA Air": "에바항공",
  "China Airlines": "중화항공",
  "Cathay Pacific": "캐세이퍼시픽",
  "HK Express": "홍콩익스프레스",
  "Hong Kong Express": "홍콩익스프레스",
  "Spring Airlines": "춘추항공",
  "China Eastern Airlines": "중국동방항공",
  "China Southern Airlines": "중국남방항공",
  "Air China": "중국국제항공",
  "Shandong Airlines": "산둥항공",
  "Qingdao Airlines": "칭다오항공",
  "AirAsia X": "에어아시아엑스",
  "Batik Air Malaysia": "바틱에어",
  "Malaysia Airlines": "말레이시아항공",
  "Garuda Indonesia": "가루다인도네시아",
  "Turkish Airlines": "터키항공",
  "Lufthansa": "루프트한자",
  "Air France": "에어프랑스",
  "United Airlines": "유나이티드항공",
  "Delta Air Lines": "델타항공",
  "Hawaiian Airlines": "하와이안항공",
};

export const KR_AIRPORTS = new Set([
  "ICN",
  "GMP",
  "PUS",
  "CJU",
  "CJJ",
  "TAE",
  "MWX",
  "YNY",
  "RSU",
  "USN",
  "KWJ",
  "HIN",
  "KPO",
  "KUV",
  "WJU",
]);

export const INTL_REGION_GROUPS: string[][] = [
  ["Country:JP", "Country:TW", "Country:HK", "Country:MO", "Country:CN", "Country:MN"],
  [
    "Country:VN",
    "Country:TH",
    "Country:PH",
    "Country:MY",
    "Country:SG",
    "Country:ID",
    "Country:GU",
    "Country:MP",
    "Country:LA",
    "Country:KH",
  ],
  [
    "Country:US",
    "Country:CA",
    "Country:AU",
    "Country:NZ",
    "Country:FR",
    "Country:GB",
    "Country:IT",
    "Country:ES",
    "Country:DE",
    "Country:CZ",
    "Country:TR",
  ],
];

const SEARCH_RETURN_QUERY = `
  query SearchReturnItinerariesQuery(
    $search: SearchReturnInput
    $filter: ItinerariesFilterInput
    $options: ItinerariesOptionsInput
  ) {
    returnItineraries(search: $search, filter: $filter, options: $options) {
      __typename
      ... on AppError {
        code
        message
      }
      ... on Itineraries {
        metadata {
          itinerariesCount
        }
        itineraries {
          __typename
          ... on ItineraryReturn {
            id
            price {
              amount
            }
            duration
            bookingOptions {
              edges {
                node {
                  bookingUrl
                  price {
                    amount
                  }
                }
              }
            }
            outbound {
              duration
              sectorSegments {
                segment {
                  source {
                    localTime
                    station {
                      code
                      name
                      city {
                        name
                      }
                      country {
                        code
                        name
                      }
                    }
                  }
                  destination {
                    localTime
                    station {
                      code
                      name
                      city {
                        name
                      }
                      country {
                        code
                        name
                      }
                    }
                  }
                  carrier {
                    name
                    code
                  }
                }
              }
            }
            inbound {
              duration
              sectorSegments {
                segment {
                  source {
                    localTime
                    station {
                      code
                      city {
                        name
                      }
                    }
                  }
                  destination {
                    localTime
                    station {
                      code
                      city {
                        name
                      }
                    }
                  }
                  carrier {
                    name
                    code
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

export interface FlightCheckRequest {
  originCode: string;
  originCity?: string;
  destCode: string;
  destCity?: string;
  periodMode: "flexible" | "fixed";
  startDate: string;
  endDate: string;
  stayNights: number;
  stayNightsMax?: number;
  directOnly: boolean;
  baselinePrice?: number;
}

export interface AnywhereDealItem {
  destCode: string;
  destCity: string;
  destCountry: string;
  price: number;
  depDate: string;
  retDate: string;
  airline: string;
  isDirect: boolean;
  duration: string;
  bookingUrl: string;
}

export interface SourceLink {
  title: string;
  uri: string;
}

export interface FlightCheckResult {
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
}

interface ParsedItinerary {
  price: number;
  originCode: string;
  destCode: string;
  destCity: string;
  destCountry: string;
  destCountryCode: string;
  depDate: string;
  retDate: string;
  airline: string;
  isDirect: boolean;
  durationText: string;
  kiwiBookingUrl: string;
}

interface RawSegmentNode {
  segment?: {
    source?: {
      localTime?: string;
      station?: {
        code?: string;
        city?: { name?: string };
        country?: { code?: string; name?: string };
      };
    };
    destination?: {
      localTime?: string;
      station?: {
        code?: string;
        city?: { name?: string };
        country?: { code?: string; name?: string };
      };
    };
    carrier?: { name?: string; code?: string };
  };
}

interface RawItineraryNode {
  price?: { amount?: string };
  bookingOptions?: {
    edges?: Array<{
      node?: { bookingUrl?: string; price?: { amount?: string } };
    }>;
  };
  outbound?: {
    duration?: number;
    sectorSegments?: RawSegmentNode[];
  };
  inbound?: {
    duration?: number;
    sectorSegments?: RawSegmentNode[];
  };
}

export class FlightNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FlightNotFoundError";
  }
}

export function localizeAirline(name: string): string {
  const trimmed = (name || "").trim();
  if (!trimmed) return "항공사";
  return AIRLINE_KO_MAP[trimmed] || trimmed;
}

export function formatSecondsDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const totalMins = Math.round(seconds / 60);
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs <= 0) return `${mins}분`;
  if (mins === 0) return `${hrs}시간`;
  return `${hrs}시간 ${mins}분`;
}

function toSkyscannerDate(isoDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return "";
  return isoDate.replace(/-/g, "").slice(2);
}

export function buildSkyscannerUrl(
  originCode: string,
  destCode: string,
  depDate: string,
  retDate: string
): string {
  const orig = originCode.toLowerCase();
  if (destCode === "ANYWHERE" || destCode === "ANYWHERE_ALL") {
    return `https://www.skyscanner.co.kr/transport/flights-from/${orig}/`;
  }
  const d1 = toSkyscannerDate(depDate);
  const d2 = toSkyscannerDate(retDate);
  if (d1 && d2) {
    return `https://www.skyscanner.co.kr/transport/flights/${orig}/${destCode.toLowerCase()}/${d1}/${d2}/`;
  }
  return `https://www.skyscanner.co.kr/transport/flights/${orig}/${destCode.toLowerCase()}/`;
}

export function buildGoogleFlightsUrl(
  originCode: string,
  destCode: string,
  depDate: string,
  retDate: string
): string {
  const query = encodeURIComponent(
    `Flights from ${originCode} to ${destCode} on ${depDate} through ${retDate}`
  );
  return `https://www.google.com/travel/flights?hl=ko&curr=KRW&q=${query}`;
}

async function queryKiwiItineraries(params: {
  originIds: string[];
  destinationIds?: string[];
  periodMode: "flexible" | "fixed";
  startDate: string;
  endDate: string;
  stayNightsMin: number;
  stayNightsMax: number;
  maxStopsCount: number;
  sortBy: "PRICE" | "QUALITY";
  limit: number;
}): Promise<ParsedItinerary[]> {
  const itineraryInput: Record<string, unknown> = {
    source: { ids: params.originIds },
  };

  if (params.destinationIds && params.destinationIds.length > 0) {
    itineraryInput.destination = { ids: params.destinationIds };
  }

  if (params.periodMode === "fixed") {
    itineraryInput.outboundDepartureDate = {
      start: `${params.startDate}T00:00:00`,
      end: `${params.startDate}T23:59:59`,
    };
    itineraryInput.inboundDepartureDate = {
      start: `${params.endDate}T00:00:00`,
      end: `${params.endDate}T23:59:59`,
    };
  } else {
    itineraryInput.outboundDepartureDate = {
      start: `${params.startDate}T00:00:00`,
      end: `${params.endDate}T23:59:59`,
    };
    itineraryInput.nightsCount = {
      start: params.stayNightsMin,
      end: params.stayNightsMax,
    };
  }

  const variables = {
    search: {
      itinerary: itineraryInput,
      passengers: { adults: 1, children: 0, infants: 0 },
    },
    filter: {
      limit: params.limit,
      maxStopsCount: params.maxStopsCount,
      allowReturnToDifferentCity: false,
    },
    options: {
      partner: "skypicker",
      currency: "KRW",
      locale: "ko",
      sortBy: params.sortBy,
    },
  };

  const response = await fetch(KIWI_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      query: SEARCH_RETURN_QUERY,
      variables,
    }),
  });

  if (!response.ok) {
    throw new Error(`운임 서버 응답 오류 (${response.status})`);
  }

  const payload = (await response.json()) as {
    data?: {
      returnItineraries?: {
        __typename?: string;
        message?: string;
        itineraries?: RawItineraryNode[];
      };
    };
    errors?: Array<{ message?: string }>;
  };

  if (payload.errors && payload.errors.length > 0 && !payload.data?.returnItineraries) {
    throw new Error(payload.errors[0]?.message || "운임 쿼리 오류");
  }

  const block = payload.data?.returnItineraries;
  if (!block || block.__typename === "AppError") {
    throw new Error(block?.message || "항공권 조회 결과를 가져오지 못했습니다.");
  }

  const rawList = block.itineraries ?? [];
  const parsed: ParsedItinerary[] = [];

  for (const item of rawList) {
    const rawPrice = Number(item.price?.amount);
    if (!Number.isFinite(rawPrice) || rawPrice < 10000) continue;

    const outSegs = item.outbound?.sectorSegments ?? [];
    const inSegs = item.inbound?.sectorSegments ?? [];
    if (outSegs.length === 0 || inSegs.length === 0) continue;

    const firstOut = outSegs[0]?.segment;
    const lastOut = outSegs[outSegs.length - 1]?.segment;
    const firstIn = inSegs[0]?.segment;

    const depDate = (firstOut?.source?.localTime || "").slice(0, 10);
    const retDate = (firstIn?.source?.localTime || "").slice(0, 10);
    const destCode = lastOut?.destination?.station?.code || "";
    const destCity = lastOut?.destination?.station?.city?.name || destCode;
    const destCountry = lastOut?.destination?.station?.country?.name || "";
    const destCountryCode = lastOut?.destination?.station?.country?.code || "";
    const originStationCode = firstOut?.source?.station?.code || "";

    const outCarrier = localizeAirline(firstOut?.carrier?.name || "");
    const inCarrier = localizeAirline(firstIn?.carrier?.name || "");
    const airline =
      outCarrier === inCarrier || !inCarrier
        ? outCarrier
        : `${outCarrier} · ${inCarrier}`;

    const isDirect = outSegs.length === 1 && inSegs.length === 1;
    const durationText = formatSecondsDuration(item.outbound?.duration || 0);

    const rawBookingPath = item.bookingOptions?.edges?.[0]?.node?.bookingUrl || "";
    const kiwiBookingUrl = rawBookingPath.startsWith("http")
      ? rawBookingPath
      : rawBookingPath
      ? `https://www.kiwi.com${rawBookingPath}`
      : "";

    parsed.push({
      price: Math.round(rawPrice / 100) * 100,
      originCode: originStationCode,
      destCode,
      destCity,
      destCountry,
      destCountryCode,
      depDate,
      retDate,
      airline,
      isDirect,
      durationText,
      kiwiBookingUrl,
    });
  }

  return parsed;
}

function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 200) * 100
    : sorted[mid];
}

export async function checkFlightRoute(
  body: FlightCheckRequest
): Promise<FlightCheckResult> {
  const originCode = (body.originCode || "").trim().toUpperCase();
  const destCode = (body.destCode || "").trim().toUpperCase();
  const periodMode = body.periodMode === "fixed" ? "fixed" : "flexible";
  const startDate = (body.startDate || "").trim();
  const endDate = (body.endDate || "").trim();
  const stayNightsMin = Math.max(1, Math.min(60, Number(body.stayNights) || 3));
  const stayNightsMax = Math.max(
    stayNightsMin,
    Math.min(60, Number(body.stayNightsMax) || stayNightsMin)
  );
  const directOnly = Boolean(body.directOnly);

  if (!originCode || !destCode || !startDate || !endDate) {
    throw new Error("출발지, 도착지, 날짜 정보가 필요합니다.");
  }

  const originIds = [`Station:airport:${originCode}`];
  const maxStops = directOnly ? 0 : 1;
  const isAnywhereIntl = destCode === "ANYWHERE";
  const isAnywhereAll = destCode === "ANYWHERE_ALL";

  if (isAnywhereIntl || isAnywhereAll) {
    let allResults: ParsedItinerary[] = [];

    if (isAnywhereIntl && KR_AIRPORTS.has(originCode)) {
      const regionalLists = await Promise.all(
        INTL_REGION_GROUPS.map((group) =>
          queryKiwiItineraries({
            originIds,
            destinationIds: group,
            periodMode,
            startDate,
            endDate,
            stayNightsMin,
            stayNightsMax,
            maxStopsCount: maxStops,
            sortBy: "PRICE",
            limit: 45,
          }).catch(() => [] as ParsedItinerary[])
        )
      );
      allResults = regionalLists
        .flat()
        .filter((it) => it.destCountryCode !== "KR");
    } else {
      allResults = await queryKiwiItineraries({
        originIds,
        destinationIds: undefined,
        periodMode,
        startDate,
        endDate,
        stayNightsMin,
        stayNightsMax,
        maxStopsCount: maxStops,
        sortBy: "PRICE",
        limit: 60,
      });
      if (isAnywhereIntl) {
        allResults = allResults.filter(
          (it) => it.destCode !== originCode && it.destCountryCode !== "KR"
        );
      }
    }

    if (allResults.length === 0 && directOnly) {
      allResults = await queryKiwiItineraries({
        originIds,
        destinationIds:
          isAnywhereIntl && KR_AIRPORTS.has(originCode)
            ? INTL_REGION_GROUPS.flat()
            : undefined,
        periodMode,
        startDate,
        endDate,
        stayNightsMin,
        stayNightsMax,
        maxStopsCount: 1,
        sortBy: "PRICE",
        limit: 50,
      });
    }

    if (allResults.length === 0) {
      throw new FlightNotFoundError(
        "해당 기간에 조건을 만족하는 항공편을 찾지 못했습니다."
      );
    }

    allResults.sort((a, b) => a.price - b.price);

    const cityMap = new Map<string, AnywhereDealItem>();
    for (const it of allResults) {
      const key = it.destCity || it.destCode;
      if (!cityMap.has(key)) {
        const skyUrl = buildSkyscannerUrl(
          originCode,
          it.destCode,
          it.depDate,
          it.retDate
        );
        cityMap.set(key, {
          destCode: it.destCode,
          destCity: it.destCity,
          destCountry: it.destCountry,
          price: it.price,
          depDate: it.depDate,
          retDate: it.retDate,
          airline: it.airline,
          isDirect: it.isDirect,
          duration: it.durationText,
          bookingUrl: it.kiwiBookingUrl || skyUrl,
        });
      }
      if (cityMap.size >= 12) break;
    }

    const anywhereDeals = [...cityMap.values()].sort(
      (a, b) => a.price - b.price
    );
    const topDeal = anywhereDeals[0];
    const cityPrices = anywhereDeals.map((d) => d.price);
    const computedMedian = computeMedian(cityPrices);
    const usualAveragePrice =
      body.baselinePrice && body.baselinePrice > 0
        ? body.baselinePrice
        : Math.max(
            computedMedian,
            Math.round((topDeal.price * 1.18) / 100) * 100
          );

    const sources: SourceLink[] = [];
    if (topDeal.bookingUrl) {
      sources.push({
        title: `${topDeal.destCity} 최저가 예약 (실시간)`,
        uri: topDeal.bookingUrl,
      });
    }
    sources.push({
      title: "Skyscanner 어디든지 검색",
      uri: buildSkyscannerUrl(
        originCode,
        "ANYWHERE",
        topDeal.depDate,
        topDeal.retDate
      ),
    });
    sources.push({
      title: `Google 항공편 (${originCode} → ${topDeal.destCode})`,
      uri: buildGoogleFlightsUrl(
        originCode,
        topDeal.destCode,
        topDeal.depDate,
        topDeal.retDate
      ),
    });

    return {
      currentPrice: topDeal.price,
      usualAveragePrice,
      bestDepDate: topDeal.depDate,
      bestRetDate: topDeal.retDate,
      airline: topDeal.airline,
      isDirect: topDeal.isDirect,
      duration: topDeal.duration,
      discoveredDestCode: topDeal.destCode,
      discoveredDestCity: topDeal.destCity,
      anywhereDeals,
      checkedAt: new Date().toISOString(),
      sources,
    };
  }

  const destinationIds = [`Station:airport:${destCode}`];
  let [priceSorted, qualitySorted] = await Promise.all([
    queryKiwiItineraries({
      originIds,
      destinationIds,
      periodMode,
      startDate,
      endDate,
      stayNightsMin,
      stayNightsMax,
      maxStopsCount: maxStops,
      sortBy: "PRICE",
      limit: 40,
    }),
    queryKiwiItineraries({
      originIds,
      destinationIds,
      periodMode,
      startDate,
      endDate,
      stayNightsMin,
      stayNightsMax,
      maxStopsCount: maxStops,
      sortBy: "QUALITY",
      limit: 40,
    }).catch(() => [] as ParsedItinerary[]),
  ]);

  if (priceSorted.length === 0 && directOnly) {
    priceSorted = await queryKiwiItineraries({
      originIds,
      destinationIds,
      periodMode,
      startDate,
      endDate,
      stayNightsMin,
      stayNightsMax,
      maxStopsCount: 1,
      sortBy: "PRICE",
      limit: 40,
    });
  }

  if (priceSorted.length === 0) {
    throw new FlightNotFoundError(
      "선택한 기간에 운항하는 항공편을 찾지 못했습니다."
    );
  }

  priceSorted.sort((a, b) => a.price - b.price);
  const cheapest = priceSorted[0];

  const referencePool =
    qualitySorted.length >= 5
      ? qualitySorted.map((i) => i.price)
      : priceSorted.map((i) => i.price);
  const marketMedian = computeMedian(referencePool);

  const usualAveragePrice =
    marketMedian > cheapest.price
      ? marketMedian
      : body.baselinePrice && body.baselinePrice > 0
      ? body.baselinePrice
      : Math.round((cheapest.price * 1.12) / 100) * 100;

  const sources: SourceLink[] = [];
  if (cheapest.kiwiBookingUrl) {
    sources.push({
      title: `${cheapest.airline} 최저가 예약 페이지`,
      uri: cheapest.kiwiBookingUrl,
    });
  }
  sources.push({
    title: "Skyscanner 노선 비교",
    uri: buildSkyscannerUrl(
      originCode,
      destCode,
      cheapest.depDate,
      cheapest.retDate
    ),
  });
  sources.push({
    title: "Google 항공편 비교",
    uri: buildGoogleFlightsUrl(
      originCode,
      destCode,
      cheapest.depDate,
      cheapest.retDate
    ),
  });

  return {
    currentPrice: cheapest.price,
    usualAveragePrice,
    bestDepDate: cheapest.depDate,
    bestRetDate: cheapest.retDate,
    airline: cheapest.airline,
    isDirect: cheapest.isDirect,
    duration: cheapest.durationText,
    checkedAt: new Date().toISOString(),
    sources,
  };
}

export async function sendNtfyNotification(params: {
  server?: string;
  topic: string;
  title: string;
  message: string;
  clickUrl?: string;
  priority?: 1 | 2 | 3 | 4 | 5;
  tags?: string[];
}): Promise<void> {
  const cleanTopic = params.topic.trim().replace(/^\/+/, "");
  if (!cleanTopic) {
    throw new Error("ntfy 토픽 이름이 비어 있습니다.");
  }

  const baseServer = (params.server || "https://ntfy.sh")
    .trim()
    .replace(/\/+$/, "");

  const body: Record<string, unknown> = {
    topic: cleanTopic,
    title: params.title,
    message: params.message,
    priority: params.priority ?? 4,
    tags: params.tags ?? ["airplane"],
  };

  if (params.clickUrl && /^https?:\/\//i.test(params.clickUrl)) {
    body.click = params.clickUrl;
    body.actions = [
      {
        action: "view",
        label: "항공권 확인",
        url: params.clickUrl,
      },
    ];
  }

  const res = await fetch(baseServer, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `ntfy 전송 실패 (${res.status})${errText ? `: ${errText}` : ""}`
    );
  }
}
