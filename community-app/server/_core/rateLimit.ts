import { TRPCError } from "@trpc/server";

/**
 * 사용자별 작성 속도 제한 (도배 방지).
 *
 * 서버가 한 프로세스로 도는 구조라(Railway 단일 인스턴스) 메모리에만 담는다.
 * 재시작하면 초기화되지만, 막으려는 것이 "한 사람이 몇 초 사이에 수십 건을 쏟아내는 것"
 * 이라 그 정도로 충분하다. 여러 인스턴스로 늘리면 Redis 등 공유 저장소로 옮겨야 한다.
 *
 * 정확한 슬라이딩 윈도우를 쓴다 — 고정 윈도우는 경계에서 한도의 두 배가 통과한다.
 */
type Bucket = number[];

const buckets = new Map<string, Bucket>();

/** 메모리가 무한정 늘지 않도록, 창을 벗어난 항목은 접근할 때마다 정리한다. */
function prune(times: Bucket, windowMs: number, now: number): Bucket {
  const cutoff = now - windowMs;
  return times.filter((t) => t > cutoff);
}

export type RateLimitRule = {
  /** 창 길이(ms) */
  windowMs: number;
  /** 창 안에서 허용하는 최대 횟수 */
  max: number;
  /** 한도를 넘겼을 때 사용자에게 보여줄 문구 */
  message: string;
};

/** 글쓰기는 댓글보다 무겁고 도배 피해도 커서 더 촘촘하게 잡는다. */
export const RATE_LIMITS = {
  post: { windowMs: 60_000, max: 3, message: "글을 너무 빠르게 올리고 있어요. 잠시 후 다시 시도해주세요" },
  comment: { windowMs: 60_000, max: 10, message: "댓글을 너무 빠르게 남기고 있어요. 잠시 후 다시 시도해주세요" },
  message: { windowMs: 60_000, max: 30, message: "쪽지를 너무 빠르게 보내고 있어요. 잠시 후 다시 시도해주세요" },
  report: { windowMs: 60_000, max: 5, message: "신고를 너무 많이 보내고 있어요. 잠시 후 다시 시도해주세요" },
  inquiry: { windowMs: 300_000, max: 3, message: "문의를 너무 자주 보내고 있어요. 잠시 후 다시 시도해주세요" },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitKind = keyof typeof RATE_LIMITS;

/**
 * 한도를 넘겼으면 TOO_MANY_REQUESTS를 던지고, 아니면 이번 시도를 기록한다.
 * 호출 즉시 기록하므로, 실제 작업이 실패해도 한 번 쓴 것으로 친다(재시도 폭주 방지).
 */
export function enforceRateLimit(kind: RateLimitKind, userId: number, now: number = Date.now()): void {
  const rule = RATE_LIMITS[kind];
  const key = `${kind}:${userId}`;
  const times = prune(buckets.get(key) ?? [], rule.windowMs, now);

  if (times.length >= rule.max) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: rule.message });
  }

  times.push(now);
  buckets.set(key, times);
}

/** 테스트용 — 프로세스 메모리에 쌓인 기록을 비운다. */
export function resetRateLimits(): void {
  buckets.clear();
}
