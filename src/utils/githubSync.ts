import type { WatchRoute } from "../types";

/**
 * 브라우저에서 바꾼 감시 노선을 GitHub 저장소의 watch-config.json에
 * 바로 커밋한다. GitHub Actions 감시 스크립트는 이 파일만 읽는다.
 */

export const STORAGE_GITHUB_TOKEN_KEY = "farewatch_github_token_v1";
export const STORAGE_GITHUB_REPO_KEY = "farewatch_github_repo_v1";
export const STORAGE_LAST_PUSHED_KEY = "farewatch_last_pushed_config_v1";

const CONFIG_PATH = "watch-config.json";
const DEFAULT_REPO = "kimkmin20/plane-refresh";

/** 현재 주소(owner.github.io/repo)에서 저장소 이름을 알아낸다. */
export function detectRepo(): string {
  try {
    const host = window.location.hostname;
    const m = host.match(/^([^.]+)\.github\.io$/i);
    if (m) {
      const seg = window.location.pathname.split("/").filter(Boolean)[0];
      if (seg) return `${m[1]}/${seg}`;
      return `${m[1]}/${m[1]}.github.io`;
    }
  } catch {
    // ignore
  }
  return DEFAULT_REPO;
}

/**
 * 감시에 필요한 항목만 뽑아 watch-config.json 내용을 만든다.
 * 저장소가 공개라서 ntfy 토픽은 파일에 넣지 않는다
 * (토픽은 GitHub Secrets의 NTFY_TOPIC으로 관리).
 */
export function buildWatchConfig(routes: WatchRoute[]): string {
  const payload = {
    ntfyServer: "https://ntfy.sh",
    ntfyTopic: "",
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
  return JSON.stringify(payload, null, 2) + "\n";
}

function toBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64Utf8(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ""));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function apiHeaders(token: string): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function explainStatus(status: number): string {
  if (status === 401) return "토큰이 틀렸거나 만료되었습니다.";
  if (status === 403)
    return "토큰에 이 저장소의 Contents 쓰기 권한이 없습니다.";
  if (status === 404) return "저장소를 찾을 수 없습니다. 저장소 이름과 토큰 권한을 확인하세요.";
  return `GitHub 응답 오류 (${status})`;
}

async function getCurrentFile(
  token: string,
  repo: string
): Promise<{ sha: string; content: string } | null> {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/contents/${CONFIG_PATH}?ref=main&t=${Date.now()}`,
    { headers: apiHeaders(token), cache: "no-store" }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(explainStatus(res.status));
  const data = (await res.json()) as { sha: string; content: string };
  return { sha: data.sha, content: fromBase64Utf8(data.content) };
}

/** watch-config.json을 커밋한다. 이미 같은 내용이면 커밋하지 않는다. */
export async function pushWatchConfig(
  token: string,
  repo: string,
  content: string
): Promise<"pushed" | "unchanged"> {
  // sha 충돌(동시에 다른 커밋)이 나면 한 번 더 시도한다.
  for (let attempt = 0; attempt < 2; attempt++) {
    const current = await getCurrentFile(token, repo);
    if (current && current.content === content) return "unchanged";

    const res = await fetch(
      `https://api.github.com/repos/${repo}/contents/${CONFIG_PATH}`,
      {
        method: "PUT",
        headers: { ...apiHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "chore: 브라우저에서 감시 노선 변경 [skip ci]",
          content: toBase64Utf8(content),
          branch: "main",
          ...(current ? { sha: current.sha } : {}),
        }),
      }
    );
    if (res.ok) return "pushed";
    if (res.status === 409 && attempt === 0) continue;
    throw new Error(explainStatus(res.status));
  }
  throw new Error("저장 충돌이 계속됩니다. 잠시 뒤 다시 시도하세요.");
}
