// 학교 검색 — 교육부 나이스(NEIS) 교육정보 개방 포털의 학교기본정보 API를 쓴다.
//
// 학교 목록을 앱에 박아두지 않는 이유: 학교는 신설·통폐합·개명이 계속 일어나서
// 고정 목록은 금세 틀린 데이터가 된다. 공식 API를 그때그때 물어보면 항상 최신이다.
//
// 지금은 고등학교만 검색한다(SCHUL_KND_SC_NM=고등학교). 나중에 중학교 등으로 넓히려면
// SCHOOL_KIND만 바꾸면 된다.

import { ENV } from "./_core/env";

/**
 * 나이스 학교기본정보 엔드포인트.
 *
 * 환경변수로 덮어쓸 수 있게 둔 이유: 나이스에 나갈 수 없는 환경(테스트·개발 샌드박스)에서
 * 응답을 흉내 내는 서버로 돌려 전체 경로를 확인하기 위해서다. 평소에는 건드리지 않는다.
 */
const NEIS_ENDPOINT = process.env.NEIS_ENDPOINT || "https://open.neis.go.kr/hub/schoolInfo";
const SCHOOL_KIND = "고등학교";

/** 외부 API가 느릴 때 로그인 화면이 하염없이 기다리지 않도록 끊는다. */
const REQUEST_TIMEOUT_MS = 6000;

/** 같은 검색어를 이 시간 동안은 다시 묻지 않는다. 학교 목록은 자주 바뀌지 않는다. */
const CACHE_TTL_MS = 60 * 60 * 1000;

/** 캐시가 무한정 늘지 않도록 상한을 둔다(가장 오래된 것부터 버린다). */
const CACHE_MAX_ENTRIES = 500;

export type School = {
  /** 표준학교코드 — 나중에 학교별로 나눌 때 쓸 안정적인 식별자. */
  code: string;
  name: string;
  /** 도로명주소. 나이스가 주소를 안 주는 학교도 있어 null이 될 수 있다. */
  address: string | null;
  /** 시도 (예: 충청북도). 주소가 없을 때 최소한의 위치 정보가 된다. */
  region: string | null;
  /** 일반고/특성화고 등 */
  kind: string | null;
  /** 공립/사립 */
  foundation: string | null;
};

export class SchoolSearchUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchoolSearchUnavailableError";
  }
}

type CacheEntry = { at: number; schools: School[] };
const cache = new Map<string, CacheEntry>();

function cacheGet(key: string, now: number): School[] | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (now - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.schools;
}

function cacheSet(key: string, schools: School[], now: number): void {
  // Map은 삽입 순서를 지키므로 첫 키가 가장 오래된 항목이다.
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(key, { at: now, schools });
}

/** 테스트용 — 캐시를 비운다. */
export function resetSchoolCache(): void {
  cache.clear();
}

/** 나이스 응답 한 줄을 화면에서 쓸 모양으로 옮긴다. */
export function mapNeisRow(row: Record<string, unknown>): School | null {
  const code = typeof row.SD_SCHUL_CODE === "string" ? row.SD_SCHUL_CODE.trim() : "";
  const name = typeof row.SCHUL_NM === "string" ? row.SCHUL_NM.trim() : "";
  // 코드나 이름이 없으면 화면에 띄울 수도, 구분할 수도 없다.
  if (!code || !name) return null;

  const text = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  };

  return {
    code,
    name,
    address: text(row.ORG_RDNMA),
    region: text(row.LCTN_SC_NM),
    kind: text(row.HS_SC_NM),
    foundation: text(row.FOND_SC_NM),
  };
}

/**
 * 나이스 응답 본문에서 학교 목록을 꺼낸다.
 *
 * 나이스는 성공/실패 형태가 완전히 달라서(성공은 schoolInfo 배열, 결과 없음은
 * 최상위 RESULT) 여기서 한 번에 흡수한다. "결과 없음"은 오류가 아니라 빈 목록이다.
 */
export function parseNeisResponse(body: unknown): School[] {
  if (!body || typeof body !== "object") {
    throw new SchoolSearchUnavailableError("학교 정보를 불러오지 못했습니다");
  }

  const payload = body as Record<string, unknown>;

  // 최상위 RESULT만 있으면 데이터가 없거나 인증 등에 문제가 있는 경우다.
  if (!payload.schoolInfo) {
    const result = payload.RESULT as { CODE?: string; MESSAGE?: string } | undefined;
    const code = result?.CODE ?? "";
    // INFO-200 = 해당하는 데이터가 없음. 검색 결과 0건이지 오류가 아니다.
    if (code === "INFO-200") return [];
    throw new SchoolSearchUnavailableError(
      result?.MESSAGE ? `학교 정보를 불러오지 못했습니다 (${result.MESSAGE})` : "학교 정보를 불러오지 못했습니다"
    );
  }

  const sections = payload.schoolInfo;
  if (!Array.isArray(sections)) {
    throw new SchoolSearchUnavailableError("학교 정보를 불러오지 못했습니다");
  }

  const rowSection = sections.find(
    (section) => section && typeof section === "object" && Array.isArray((section as Record<string, unknown>).row)
  ) as { row: unknown[] } | undefined;
  if (!rowSection) return [];

  const schools: School[] = [];
  for (const row of rowSection.row) {
    if (!row || typeof row !== "object") continue;
    const school = mapNeisRow(row as Record<string, unknown>);
    if (school) schools.push(school);
  }
  return schools;
}

export function isSchoolSearchConfigured(): boolean {
  return Boolean(ENV.neisApiKey);
}

/**
 * 학교명에 키워드가 들어간 고등학교를 찾는다.
 *
 * 나이스의 SCHUL_NM은 부분 일치로 동작하므로 검색어를 그대로 넘긴다.
 */
export async function searchSchools(query: string, limit: number = 20): Promise<School[]> {
  const keyword = query.trim();
  if (!keyword) return [];

  if (!isSchoolSearchConfigured()) {
    throw new SchoolSearchUnavailableError(
      "학교 검색이 아직 설정되지 않았습니다. 관리자에게 문의해주세요"
    );
  }

  const now = Date.now();
  const cacheKey = `${keyword}:${limit}`;
  const cached = cacheGet(cacheKey, now);
  if (cached) return cached;

  const url = new URL(NEIS_ENDPOINT);
  url.searchParams.set("KEY", ENV.neisApiKey);
  url.searchParams.set("Type", "json");
  url.searchParams.set("pIndex", "1");
  url.searchParams.set("pSize", String(limit));
  url.searchParams.set("SCHUL_KND_SC_NM", SCHOOL_KIND);
  url.searchParams.set("SCHUL_NM", keyword);

  let body: unknown;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!response.ok) {
      throw new SchoolSearchUnavailableError(`학교 정보를 불러오지 못했습니다 (${response.status})`);
    }
    body = await response.json();
  } catch (error) {
    if (error instanceof SchoolSearchUnavailableError) throw error;
    // 타임아웃·네트워크 오류. 원인은 서버 로그로만 남기고 사용자에겐 짧게 알린다.
    console.warn("[Schools] 나이스 API 호출 실패:", error);
    throw new SchoolSearchUnavailableError("학교 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요");
  }

  const schools = parseNeisResponse(body);
  cacheSet(cacheKey, schools, now);
  return schools;
}
