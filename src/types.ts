export type PeriodMode = "flexible" | "fixed";

export interface SourceLink {
  title: string;
  uri: string;
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

export interface PricePoint {
  timestamp: string;
  price: number;
  depDate: string;
  retDate: string;
  airline: string;
  destCode?: string;
  destCity?: string;
  isSimulated?: boolean;
}

export interface WatchRoute {
  id: string;
  originCode: string;
  originCity: string;
  destCode: string; // Supports "ANYWHERE" | "ANYWHERE_ALL" | 3-letter IATA
  destCity: string;
  periodMode: PeriodMode;
  startDate: string;
  endDate: string;
  stayNights: number;
  stayNightsMax?: number;
  directOnly: boolean;
  baselinePrice: number;
  currentPrice: number;
  bestDepDate: string;
  bestRetDate: string;
  airline: string;
  duration: string;
  discoveredDestCode?: string;
  discoveredDestCity?: string;
  anywhereDeals?: AnywhereDealItem[];
  dropThresholdPercent: number;
  targetPrice: number | null;
  checkIntervalMinutes: number;
  isActive: boolean;
  lastCheckedAt: string | null;
  lastAlertedPrice: number | null;
  sources: SourceLink[];
  history: PricePoint[];
  errorMessage?: string | null;
}

export interface DealAlert {
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

export interface AirportOption {
  code: string;
  city: string;
  country: string;
}
