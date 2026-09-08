// 게시글/댓글 자동 필터링. 2단계 하이브리드 구조:
//   1차 — 한국어 비속어 키워드 필터 (아래 상수 배열). 한국어 은어·신조어는
//         범용 AI 모델이 자주 놓치므로 이쪽이 실질적인 1차 방어선이다.
//   2차 — OpenAI Moderation API (omni-moderation-latest). 무료 엔드포인트라
//         매 글마다 호출해도 과금되지 않는다 (Chat Completions API와 다름).
//
// 오탐(정상 글 차단)은 커뮤니티 이용을 크게 해치므로 차단 기준은 보수적으로 잡고,
// 애매한 내용은 차단하지 않고 게시한 뒤 관리자 검토 목록에만 올린다.

import { SYSTEM_REPORTER_USER_ID } from "@shared/const";
import { ENV } from "./_core/env";
import * as db from "./db";

export { SYSTEM_REPORTER_USER_ID };

/**
 * 즉시 차단할 명백한 비속어. 정상적인 문장에 우연히 섞일 수 없는 표현만 넣는다
 * (예: "새끼"는 "강아지 새끼"처럼 정상 문맥이 있어 넣지 않고, "개새끼"만 넣는다).
 * 관리자가 운영하면서 추가/삭제하기 쉽도록 단순 문자열 배열로 관리한다.
 * 값은 normalizeText()를 거친 형태(공백·특수문자 없는 소문자)로 적을 것.
 */
export const BLOCK_KEYWORDS: string[] = [
  // 욕설
  "시발", "씨발", "시바ㄹ", "씨빨", "시빨", "쉬발", "씨팔", "시팔",
  "좆", "좇", "좃같", "좆같", "좆밥",
  "병신", "븅신", "빙신", "등신",
  "지랄", "지럴",
  "개새끼", "개색기", "개세끼", "개쌔끼", "쌍놈", "썅놈", "썅년",
  "씹새끼", "씹창",
  "미친놈", "미친년",
  // 가족 관련 모욕
  "니미럴", "니애미", "느금마", "느검마", "엠창", "앰창", "애미뒤진", "애비뒤진",
  "호로자식", "후레자식",
  // 성적 모욕
  "창녀", "걸레년",
  // 초성체 (사용자가 자음만 입력한 경우 — 정상 문장에는 이 조합이 나오지 않는다)
  "ㅅㅂ", "ㅆㅂ", "ㅂㅅ", "ㅄ", "ㅈㄹ", "ㅆㅃ",
];

/**
 * 차단까지는 아니지만 관리자가 한 번 볼 필요가 있는 표현.
 * 게시는 정상적으로 되고, 관리자 페이지의 검토 목록에만 자동 등록된다.
 */
export const REVIEW_KEYWORDS: string[] = [
  "존나", "존내", "ㅈㄴ", "졸라",
  "꺼져", "닥쳐", "닥쳐라",
  "대가리", "돌아이", "또라이",
  "죽여버", "패버릴", "때려죽",
];

/** 차단 시 사용자에게 보여줄 안내. 어떤 표현이 걸렸는지는 우회 학습에 악용되므로 알리지 않는다. */
export const BLOCKED_MESSAGE =
  "커뮤니티 이용규칙에 어긋나는 표현이 포함되어 있어 등록할 수 없습니다. 내용을 다시 확인해주세요.";

/** 자동 등록되는 신고의 reason. 관리자 페이지에서 사용자 신고와 구분된다. */
export const AUTO_REPORT_REASON = "자동 검토 필요";

const MODERATION_ENDPOINT = "https://api.openai.com/v1/moderations";
const MODERATION_MODEL = "omni-moderation-latest";
const MODERATION_TIMEOUT_MS = 4000;

/**
 * 이 카테고리 점수가 임계치를 넘으면 작성을 차단한다. 심각하고 명백한 위반만
 * 넣고, 나머지 카테고리는 아무리 점수가 높아도 차단하지 않고 검토로만 넘긴다
 * (오탐으로 정상 글이 막히는 것을 피하기 위한 보수적 설정).
 * 미성년자 성적 콘텐츠는 학교 커뮤니티 특성상 임계치를 훨씬 낮게 잡는다.
 */
const BLOCK_CATEGORY_THRESHOLDS: Record<string, number> = {
  "sexual/minors": 0.3,
  "harassment/threatening": 0.8,
  "hate/threatening": 0.8,
  "self-harm/instructions": 0.8,
  "violence/graphic": 0.9,
  hate: 0.9,
  sexual: 0.9,
};

/** 어떤 카테고리든 이 점수를 넘으면 게시는 하되 관리자 검토 목록에 올린다. */
const REVIEW_THRESHOLD = 0.5;

export type ModerationVerdict =
  | { action: "allow" }
  | { action: "block"; userMessage: string }
  | { action: "review"; reason: string };

/**
 * 우회 표현을 잡기 위한 정규화. 공백/특수문자를 지우고("시.발" → "시발"),
 * 3번 이상 반복되는 문자를 줄인다("ㅋㅋㅋㅋ" → "ㅋㅋ").
 *
 * NFKC가 아니라 NFC를 쓰는 게 중요하다. NFKC는 "ㅅ"/"ㅂ" 같은 호환 자모(U+3131~)를
 * 조합용 자모(U+1100~)로 바꿔버려서 아래 문자 범위에 걸리지 않고 통째로 지워진다
 * (= 초성체 우회를 못 잡는다). NFC는 호환 자모를 그대로 두면서, 자모로 분해된
 * 한글은 음절로 합쳐준다.
 */
export function normalizeText(text: string): string {
  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^0-9a-z가-힣ㄱ-ㅎㅏ-ㅣ]/g, "")
    .replace(/(.)\1{2,}/g, "$1$1");
}

/** 정규화된 문자열에서 숫자까지 제거한 형태 — "시1발"처럼 숫자를 끼워 넣은 우회를 잡는다. */
function stripDigits(normalized: string): string {
  return normalized.replace(/[0-9]/g, "");
}

/** 키워드 목록 중 하나라도 본문에 포함되면 그 키워드를 돌려준다 (없으면 null). */
export function findKeyword(text: string, keywords: string[]): string | null {
  const normalized = normalizeText(text);
  const digitless = stripDigits(normalized);
  return keywords.find((keyword) => normalized.includes(keyword) || digitless.includes(keyword)) ?? null;
}

type CategoryScores = Record<string, number>;

/**
 * OpenAI Moderation API 호출. 키가 없거나 호출이 실패하면 null을 돌려주고,
 * 호출부는 이를 "검사 못 함"으로 보고 글을 통과시킨다 — 외부 API 장애로
 * 커뮤니티 글쓰기 전체가 멈추면 안 되기 때문이다.
 */
async function fetchModerationScores(text: string): Promise<CategoryScores | null> {
  if (!ENV.openaiApiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MODERATION_TIMEOUT_MS);
  try {
    const response = await fetch(MODERATION_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ENV.openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: MODERATION_MODEL, input: text }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(`[Moderation] API 응답 오류 (${response.status}) — 이 글은 검사 없이 통과시킵니다`);
      return null;
    }

    const data = (await response.json()) as { results?: { category_scores?: CategoryScores }[] };
    return data.results?.[0]?.category_scores ?? null;
  } catch (error) {
    console.warn("[Moderation] API 호출 실패 — 이 글은 검사 없이 통과시킵니다:", error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * 본문을 검사해 차단/검토/통과 중 하나를 판정한다.
 * 키워드 직격 → 차단, Moderation 高스코어 → 차단, 중간 스코어나 주의 표현 → 검토.
 */
export async function moderateContent(text: string): Promise<ModerationVerdict> {
  if (findKeyword(text, BLOCK_KEYWORDS)) {
    return { action: "block", userMessage: BLOCKED_MESSAGE };
  }

  const reviewKeyword = findKeyword(text, REVIEW_KEYWORDS);
  const scores = await fetchModerationScores(text);

  if (scores) {
    for (const [category, threshold] of Object.entries(BLOCK_CATEGORY_THRESHOLDS)) {
      if ((scores[category] ?? 0) >= threshold) {
        return { action: "block", userMessage: BLOCKED_MESSAGE };
      }
    }

    const flagged = Object.entries(scores)
      .filter(([, score]) => score >= REVIEW_THRESHOLD)
      .map(([category]) => category);
    if (flagged.length > 0) {
      return { action: "review", reason: `AI 검토 신호: ${flagged.join(", ")}` };
    }
  }

  if (reviewKeyword) {
    return { action: "review", reason: `주의 표현 감지: ${reviewKeyword}` };
  }

  return { action: "allow" };
}

/**
 * 검토가 필요한 글/댓글을 기존 신고 시스템에 시스템 자동 신고로 등록한다.
 * 등록 실패가 글 작성 자체를 막으면 안 되므로 오류는 로그만 남기고 삼킨다.
 */
export async function recordAutoReport(
  targetType: "post" | "comment",
  targetId: number,
  reason: string
): Promise<void> {
  try {
    await db.createReport({
      reporterUserId: SYSTEM_REPORTER_USER_ID,
      targetType,
      targetId,
      reason: AUTO_REPORT_REASON,
      description: reason,
    });
  } catch (error) {
    console.warn("[Moderation] 자동 검토 등록 실패:", error);
  }
}
