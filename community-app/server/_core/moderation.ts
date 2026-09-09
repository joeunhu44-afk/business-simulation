// 게시글/댓글 본문 검열. 외부 AI API를 쓰지 않고 로컬에서만 판정한다.
//
// 3중 구조:
//   A. korcen(원본)        — 라이브러리가 자체 오탐 목록으로 보호하는 원문 그대로 검사
//   B. korcen(기본 정규화)  — 공백·특수문자를 지운 형태로 재검사 ("시-발", "시.발")
//   C. 커스텀 금지어        — 강한 정규화(유사 자모 통일, 숫자 제거) 후 자체 목록과 대조
//
// C를 따로 두는 이유: korcen 1.0.1의 단어 목록에는 "씨발"이 빠져 있는 등 구멍이 있고,
// 학교별 은어도 담아야 하기 때문이다. 반대로 강한 정규화를 korcen에 그대로 먹이면
// korcen의 오탐 목록("시발점", "시바견" 등)이 무력화되므로, C에는 자체 허용 목록을 둔다.
//
// 나중에 LLM 2차 검사를 붙일 자리는 checkContent() 안이다 — 라우터는 이 함수만 부른다.

import { check as korcenCheck } from "korcen";

export type ModerationResult = {
  blocked: boolean;
  /** 관리자 기록용 사유. 사용자에게는 절대 노출하지 않는다(우회 학습 방지). */
  reason?: string;
};

/** 사용자에게 보여줄 안내. 어떤 표현이 걸렸는지는 알려주지 않는다. */
export const BLOCKED_MESSAGE = "부적절한 표현이 포함되어 있습니다. 내용을 다시 확인해주세요.";

/**
 * korcen이 놓치는 표현을 보강하는 자체 금지어 목록.
 * 반드시 normalizeAggressive()를 거친 형태로 적을 것 — 된소리(ㅆ→ㅅ)와
 * ㅐ/ㅔ 계열이 통일되므로 "시발" 하나가 "씨발/시빨/씨빨"까지 함께 잡는다.
 * TODO: 관리자 페이지에서 편집할 수 있도록 DB 테이블로 옮길 수 있다.
 */
export const CUSTOM_BLOCK_KEYWORDS: string[] = [
  // korcen 목록에 "씨발"이 없어 반드시 필요하다 (된소리 통일로 씨발/시빨/씨빨 포함)
  "시발",
  "시이발", // 모음을 끼워 넣은 우회 ("시이이이발"은 반복 축약으로 여기에 합쳐진다)
  "시바ㄹ",
  // 초성체 (된소리 통일로 ㅆㅂ 포함)
  "ㅅㅂ",
  "ㅄ",
  "ㅂㅅ",
  "ㅈㄹ",
  // 학교 커뮤니티에서 자주 쓰이는 표현
  "존나",
  "존내",
  "느금마",
  "느검마",
  "앰창",
  "니애미",
];

/**
 * 금지어를 부분 문자열로 포함하지만 정상인 단어들. 검사 전에 본문에서 먼저 지운다
 * (korcen이 쓰는 방식과 동일). korcen 자체 오탐 목록이 못 거르는 것도 여기서 보강한다.
 *
 * 주의: 여기 넣는 항목이 실제 비속어의 부분 문자열이면 안 된다. 예를 들어 "세끼"만
 * 넣으면 "개세끼"에서 "세끼"가 지워져 "개"만 남아 탐지를 피해간다. 그래서 앞뒤
 * 맥락까지 포함한 형태("세끼다", "세끼먹")로 적는다.
 */
const CUSTOM_ALLOWLIST: string[] = [
  // 시발 계열 정상 단어
  "시발점", "시발유", "시발역", "시발택시", "시발자동차", "시발수뢰", "시발음", "시발표",
  "시바견", "시바이누", "시바신", "시바산", "시바스리갈",
  "다시발", "무시발언", "아저시발", "일시발", "임시발",
  // 이발(理髮) — "시이발" 금지어와 겹치지 않도록 맥락을 포함해서 적는다
  "다시이발", "이발소", "이발관", "이발사", "이발했", "이발하",
  // 새끼(동물) — "개세끼"의 부분 문자열이 되지 않도록 맥락 포함
  "강아지새끼", "세끼다", "세끼먹", "삼시세끼", "하루세끼",
];

const HANGUL_BASE = 0xac00;
const HANGUL_LAST = 0xd7a3;
const JUNG_COUNT = 21;
const JONG_COUNT = 28;

const CHO_LIST = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const JUNG_LIST = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ";
const JONG_LIST = " ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ";

/** 된소리를 예사소리로 통일 (ㅆ→ㅅ). "씨발"과 "시발"을 같은 것으로 본다. */
const TENSE_TO_PLAIN: Record<string, string> = {
  ㄲ: "ㄱ", ㄸ: "ㄷ", ㅃ: "ㅂ", ㅆ: "ㅅ", ㅉ: "ㅈ",
};

/** 형태·발음이 비슷한 모음을 하나로 통일 (ㅐ/ㅔ/ㅒ/ㅖ). */
const VOWEL_UNIFY: Record<string, string> = {
  ㅔ: "ㅐ", ㅒ: "ㅐ", ㅖ: "ㅐ",
};

/** 같은 문자가 연속으로 반복되면 하나로 줄인다 ("시이이이발" → "시이발", "ㅋㅋㅋ" → "ㅋ"). */
function collapseRepeats(text: string): string {
  return text.replace(/(.)\1+/g, "$1");
}

/**
 * 기본 정규화 — korcen에 한 번 더 먹이기 위한 형태.
 * 공백/특수문자만 지우고 숫자는 남긴다. korcen의 오탐 목록에는 "8시발", "118"처럼
 * 숫자를 포함한 항목이 있어서, 숫자를 지워버리면 그 보호가 풀리기 때문이다.
 */
export function normalizeBasic(text: string): string {
  return collapseRepeats(
    text.normalize("NFC").toLowerCase().replace(/[^0-9a-z가-힣ㄱ-ㅎㅏ-ㅣ]/g, "")
  );
}

/**
 * 강한 정규화 — 자체 금지어 목록과 대조하기 위한 형태.
 * 숫자를 지우고("시1발"→"시발"), 된소리와 유사 모음을 통일한다.
 */
export function normalizeAggressive(text: string): string {
  const base = collapseRepeats(
    text.normalize("NFC").toLowerCase().replace(/[^a-z가-힣ㄱ-ㅎㅏ-ㅣ]/g, "")
  );

  let result = "";
  for (const char of base) {
    const code = char.codePointAt(0)!;

    // 완성형 한글이면 자모로 분해해 통일한 뒤 다시 합친다
    if (code >= HANGUL_BASE && code <= HANGUL_LAST) {
      const offset = code - HANGUL_BASE;
      const choIndex = Math.floor(offset / (JUNG_COUNT * JONG_COUNT));
      const jungIndex = Math.floor((offset % (JUNG_COUNT * JONG_COUNT)) / JONG_COUNT);
      const jongIndex = offset % JONG_COUNT;

      const cho = TENSE_TO_PLAIN[CHO_LIST[choIndex]] ?? CHO_LIST[choIndex];
      const jung = VOWEL_UNIFY[JUNG_LIST[jungIndex]] ?? JUNG_LIST[jungIndex];
      const jong = JONG_LIST[jongIndex];

      const newCho = CHO_LIST.indexOf(cho);
      const newJung = JUNG_LIST.indexOf(jung);
      const newJong = JONG_LIST.indexOf(jong);
      result += String.fromCodePoint(
        HANGUL_BASE + (newCho * JUNG_COUNT + newJung) * JONG_COUNT + (newJong < 0 ? 0 : newJong)
      );
      continue;
    }

    // 단독 자모(초성체 "ㅆㅂ" 등)도 같은 규칙으로 통일한다
    result += TENSE_TO_PLAIN[char] ?? VOWEL_UNIFY[char] ?? char;
  }
  return result;
}

/** korcen은 빈 문자열/비문자열에 예외를 던지므로 감싸서 호출한다. */
function runKorcen(text: string): boolean {
  if (!text.trim()) return false;
  return korcenCheck(text);
}

/** 허용 목록에 있는 정상 단어를 본문에서 지운다. */
function stripAllowlisted(text: string): string {
  let result = text;
  for (const allowed of CUSTOM_ALLOWLIST) {
    result = result.split(allowed).join("");
  }
  return result;
}

/** 커스텀 금지어 검사. 허용 목록에 걸리는 부분은 먼저 지운 뒤 대조한다. */
function findCustomKeyword(text: string): string | null {
  const target = stripAllowlisted(normalizeAggressive(text));
  return CUSTOM_BLOCK_KEYWORDS.find((keyword) => target.includes(keyword)) ?? null;
}

/**
 * 본문이 부적절한지 판정한다. 라우터(posts.create, comments.create)는 이 함수만 부른다.
 *
 * 검사 중 예외가 나면 차단하지 않고 통과시킨다 — 필터 장애로 글쓰기 전체가
 * 멈추면 안 되기 때문이다(대신 서버 로그에 남긴다).
 */
export async function checkContent(text: string): Promise<ModerationResult> {
  try {
    // korcen은 내부적으로 공백을 지우고 판정하므로, 공백/특수문자를 정리하고
    // 허용 목록을 걷어낸 형태를 최종 판정 기준으로 쓴다. 원본 검사 결과는
    // "어느 쪽에서 걸렸는지" 기록용으로만 함께 본다.
    const korcenTarget = stripAllowlisted(normalizeBasic(text));
    if (runKorcen(korcenTarget)) {
      return { blocked: true, reason: runKorcen(text) ? "korcen:원본" : "korcen:정규화" };
    }

    const custom = findCustomKeyword(text);
    if (custom) {
      return { blocked: true, reason: `커스텀 금지어:${custom}` };
    }

    return { blocked: false };
  } catch (error) {
    console.warn("[Moderation] 검사 실패 — 이 글은 검사 없이 통과시킵니다:", error);
    return { blocked: false };
  }
}
