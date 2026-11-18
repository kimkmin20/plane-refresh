import type { AirportOption } from "../types";

export const ANYWHERE_OPTIONS: AirportOption[] = [
  { code: "ANYWHERE", city: "해외 어디든지", country: "전 세계 최저가" },
  { code: "ANYWHERE_ALL", city: "어디든지 (국내 포함)", country: "국내·해외 전체" },
];

export const DOMESTIC_AIRPORTS: AirportOption[] = [
  { code: "ICN", city: "서울/인천", country: "대한민국" },
  { code: "GMP", city: "서울/김포", country: "대한민국" },
  { code: "PUS", city: "부산/김해", country: "대한민국" },
  { code: "CJU", city: "제주", country: "대한민국" },
  { code: "CJJ", city: "청주", country: "대한민국" },
  { code: "TAE", city: "대구", country: "대한민국" },
  { code: "MWX", city: "무안", country: "대한민국" },
  { code: "YNY", city: "양양", country: "대한민국" },
  { code: "RSU", city: "여수", country: "대한민국" },
  { code: "USN", city: "울산", country: "대한민국" },
  { code: "KWJ", city: "광주", country: "대한민국" },
  { code: "HIN", city: "사천/진주", country: "대한민국" },
  { code: "KPO", city: "포항경주", country: "대한민국" },
  { code: "KUV", city: "군산", country: "대한민국" },
  { code: "WJU", city: "원주", country: "대한민국" },
];

export const INTERNATIONAL_AIRPORTS: AirportOption[] = [
  { code: "NRT", city: "도쿄/나리타", country: "일본" },
  { code: "HND", city: "도쿄/하네다", country: "일본" },
  { code: "KIX", city: "오사카", country: "일본" },
  { code: "FUK", city: "후쿠오카", country: "일본" },
  { code: "CTS", city: "삿포로", country: "일본" },
  { code: "OKA", city: "오키나와", country: "일본" },
  { code: "NGO", city: "나고야", country: "일본" },
  { code: "TAK", city: "다카마쓰", country: "일본" },
  { code: "TPE", city: "타이베이", country: "대만" },
  { code: "HKG", city: "홍콩", country: "홍콩" },
  { code: "PVG", city: "상하이", country: "중국" },
  { code: "TAO", city: "칭다오", country: "중국" },
  { code: "BKK", city: "방콕", country: "태국" },
  { code: "CNX", city: "치앙마이", country: "태국" },
  { code: "DAD", city: "다낭", country: "베트남" },
  { code: "CXR", city: "나트랑", country: "베트남" },
  { code: "PQC", city: "푸꾸옥", country: "베트남" },
  { code: "HAN", city: "하노이", country: "베트남" },
  { code: "SGN", city: "호치민", country: "베트남" },
  { code: "SIN", city: "싱가포르", country: "싱가포르" },
  { code: "DPS", city: "발리", country: "인도네시아" },
  { code: "CEB", city: "세부", country: "필리핀" },
  { code: "MNL", city: "마닐라", country: "필리핀" },
  { code: "BKI", city: "코타키나발루", country: "말레이시아" },
  { code: "GUM", city: "괌", country: "미국령" },
  { code: "HNL", city: "호놀룰루", country: "미국" },
  { code: "LAX", city: "로스앤젤레스", country: "미국" },
  { code: "SFO", city: "샌프란시스코", country: "미국" },
  { code: "JFK", city: "뉴욕", country: "미국" },
  { code: "SYD", city: "시드니", country: "호주" },
  { code: "CDG", city: "파리", country: "프랑스" },
  { code: "LHR", city: "런던", country: "영국" },
  { code: "FCO", city: "로마", country: "이탈리아" },
  { code: "BCN", city: "바르셀로나", country: "스페인" },
  { code: "FRA", city: "프랑크푸르트", country: "독일" },
  { code: "PRG", city: "프라하", country: "체코" },
  { code: "IST", city: "이스탄불", country: "튀르키예" },
];

export const AIRPORTS: AirportOption[] = [
  ...DOMESTIC_AIRPORTS,
  ...INTERNATIONAL_AIRPORTS,
];

export function isAnywhereCode(code: string): boolean {
  return code === "ANYWHERE" || code === "ANYWHERE_ALL";
}

export function findAirportLabel(code: string): AirportOption {
  const normalized = code.trim().toUpperCase();
  const anywhereMatch = ANYWHERE_OPTIONS.find((a) => a.code === normalized);
  if (anywhereMatch) return anywhereMatch;
  const match = AIRPORTS.find((a) => a.code === normalized);
  if (match) return match;
  return { code: normalized, city: normalized, country: "" };
}
