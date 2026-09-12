/**
 * 추천 게시글 랭킹 로직.
 *
 * DB 접근이 전혀 없는 순수 함수 모음이라 알고리즘만 따로 테스트하고 교체할 수 있다.
 * db.ts의 getRecommendedPosts()는 후보 글을 긁어오는 일만 하고, 점수 계산과 정렬은
 * 전부 여기에 맡긴다 — 나중에 알고리즘을 바꾸려면 이 파일만 건드리면 된다.
 *
 * 2단계 구조:
 *   1단계(기본) — 반응 수에 시간 감쇠를 적용한 인기글 점수. 데이터가 적어도 동작한다.
 *   2단계(자동) — 로그인 사용자의 활동 이력에서 게시판 선호도를 뽑아 가산점을 준다.
 *                활동이 MIN_ACTIVITY_FOR_PERSONALIZATION 미만이면 자동으로 1단계로 돌아간다.
 */

/** 랭킹 계산에 필요한 최소한의 게시글 정보. */
export type RankablePost = {
  id: number;
  boardId: number;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  createdAt: Date;
};

/**
 * 반응 종류별 가중치. 댓글은 좋아요보다 품이 많이 드는 반응이라 더 높게 치고,
 * 조회수는 누구나 스쳐 지나가며 올릴 수 있으니 아주 낮게 잡는다.
 */
export const ENGAGEMENT_WEIGHTS = {
  like: 3,
  comment: 5,
  view: 0.2,
} as const;

/**
 * Hacker News 랭킹의 중력 상수와 같은 역할. 값이 클수록 오래된 글이 빨리 밀려난다.
 * 글이 하루에 몇 개 올라오지 않는 학교 커뮤니티라 HN(1.8)보다 완만하게 잡았다.
 */
export const GRAVITY = 1.5;

/** 나이가 0시간인 글의 점수가 발산하지 않도록 분모에 더해주는 시간(시간 단위). */
export const AGE_OFFSET_HOURS = 2;

/** 개인화를 켜기 위해 필요한 최소 활동 수(좋아요 + 작성글 + 댓글의 합). */
export const MIN_ACTIVITY_FOR_PERSONALIZATION = 3;

/**
 * 즐겨찾기 한 건의 가중치.
 *
 * 활동 이력은 "이 게시판을 좋아하는 것 같다"는 짐작이지만 즐겨찾기는 본인이 직접
 * 말한 것이라, 댓글 한 번(1.5)이나 글 한 편(2)보다 확실한 신호로 친다.
 */
export const FAVORITE_WEIGHT = 4;

/** 선호 게시판 글에 곱해주는 최대 가산 배율 (1.0 = 가산 없음). */
export const MAX_AFFINITY_BOOST = 0.5;

/**
 * 게시글 한 건의 인기 점수(1단계).
 *
 *   (가중 반응 수) / (경과 시간 + 오프셋)^중력
 *
 * 반응이 같다면 최근 글이 위로, 오래된 글이라도 반응이 압도적이면 살아남는다.
 * `now`를 인자로 받는 이유는 테스트에서 시간을 고정하기 위해서다.
 */
export function hotScore(post: RankablePost, now: Date = new Date()): number {
  const engagement =
    post.likeCount * ENGAGEMENT_WEIGHTS.like +
    post.commentCount * ENGAGEMENT_WEIGHTS.comment +
    post.viewCount * ENGAGEMENT_WEIGHTS.view;

  const ageMs = now.getTime() - post.createdAt.getTime();
  // 서버/DB 시계 차이로 미래 시각이 들어와도 음수 나이가 되지 않게 0으로 막는다.
  const ageHours = Math.max(0, ageMs) / (1000 * 60 * 60);

  return engagement / Math.pow(ageHours + AGE_OFFSET_HOURS, GRAVITY);
}

/** 사용자의 게시판별 활동 횟수. boardId -> 활동 수. */
export type BoardAffinity = Map<number, number>;

/** 선호도를 만드는 재료. 즐겨찾기는 본인이 직접 고른 것이라 따로 둔다. */
export type BoardActivity = {
  likedBoardIds: number[];
  authoredBoardIds: number[];
  commentedBoardIds: number[];
  favoritedBoardIds?: number[];
};

/**
 * 활동 이력에서 게시판 선호도를 만든다.
 *
 * 세 신호를 모두 "그 게시판에 관심이 있다"는 같은 종류의 증거로 취급하되,
 * 직접 글을 쓴 쪽이 좋아요 한 번보다 강한 신호라 가중치를 다르게 준다.
 */
export function buildBoardAffinity(activity: BoardActivity): BoardAffinity {
  const affinity: BoardAffinity = new Map();
  const add = (boardId: number, weight: number) => {
    affinity.set(boardId, (affinity.get(boardId) ?? 0) + weight);
  };

  for (const boardId of activity.likedBoardIds) add(boardId, 1);
  for (const boardId of activity.commentedBoardIds) add(boardId, 1.5);
  for (const boardId of activity.authoredBoardIds) add(boardId, 2);
  for (const boardId of activity.favoritedBoardIds ?? []) add(boardId, FAVORITE_WEIGHT);

  return affinity;
}

/**
 * 개인화를 적용할 만큼 근거가 쌓였는지. 미만이면 1단계(인기글)로 폴백한다.
 *
 * 즐겨찾기가 하나라도 있으면 활동 수와 무관하게 바로 켠다 — 짐작이 아니라 본인이
 * 직접 고른 게시판이므로 표본이 적다고 틀릴 일이 없다. 가입 직후라 활동이 전혀 없는
 * 사용자도 별 하나만 누르면 추천이 자기 관심사를 따라가기 시작한다.
 */
export function hasEnoughActivity(activity: BoardActivity): boolean {
  if ((activity.favoritedBoardIds?.length ?? 0) > 0) return true;

  const total =
    activity.likedBoardIds.length +
    activity.authoredBoardIds.length +
    activity.commentedBoardIds.length;
  return total >= MIN_ACTIVITY_FOR_PERSONALIZATION;
}

/**
 * 선호 게시판 가산 배율. 가장 활동이 많은 게시판을 1.0으로 두고 상대적으로 환산해
 * 최대 (1 + MAX_AFFINITY_BOOST)배까지만 올려준다.
 *
 * 배율에 상한을 두는 이유: 가산점이 무제한이면 반응이 거의 없는 내 게시판 글이
 * 커뮤니티 전체가 반응한 글을 밀어내 버려서, "추천"이 아니라 "내 게시판 최신글"이 된다.
 */
export function affinityMultiplier(boardId: number, affinity: BoardAffinity): number {
  if (affinity.size === 0) return 1;
  const max = Math.max(...Array.from(affinity.values()));
  if (max <= 0) return 1;
  const score = affinity.get(boardId) ?? 0;
  return 1 + (score / max) * MAX_AFFINITY_BOOST;
}

export type RankedPost<T extends RankablePost> = T & { score: number };

/**
 * 후보 글을 점수순으로 정렬해 상위 limit개를 돌려준다.
 *
 * affinity가 비어 있으면(비로그인이거나 활동이 부족하면) 순수 인기글 정렬이 되므로,
 * 1단계와 2단계가 별도 분기 없이 같은 경로를 탄다.
 */
export function rankPosts<T extends RankablePost>(
  candidates: T[],
  options: { now?: Date; affinity?: BoardAffinity; limit?: number } = {}
): RankedPost<T>[] {
  const { now = new Date(), affinity = new Map(), limit = 5 } = options;

  return candidates
    .map((post) => ({
      ...post,
      score: hotScore(post, now) * affinityMultiplier(post.boardId, affinity),
    }))
    // 점수가 같을 때(반응이 하나도 없어 둘 다 0점인 경우 등) 순서가 흔들리지 않도록
    // 최신 글, 그다음 id 순으로 고정한다.
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.createdAt.getTime() - a.createdAt.getTime() ||
        b.id - a.id
    )
    .slice(0, limit);
}
