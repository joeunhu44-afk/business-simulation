import { describe, expect, it } from "vitest";
import {
  MIN_ACTIVITY_FOR_PERSONALIZATION,
  affinityMultiplier,
  buildBoardAffinity,
  hasEnoughActivity,
  hotScore,
  rankPosts,
  type RankablePost,
} from "./ranking";

const NOW = new Date("2026-09-10T12:00:00Z");

function hoursAgo(hours: number): Date {
  return new Date(NOW.getTime() - hours * 60 * 60 * 1000);
}

function post(overrides: Partial<RankablePost> & { id: number }): RankablePost {
  return {
    boardId: 1,
    likeCount: 0,
    commentCount: 0,
    viewCount: 0,
    createdAt: hoursAgo(1),
    ...overrides,
  };
}

describe("hotScore — 1단계 인기글 점수", () => {
  it("반응이 같으면 최근 글이 더 높은 점수를 받는다", () => {
    const fresh = post({ id: 1, likeCount: 5, createdAt: hoursAgo(1) });
    const old = post({ id: 2, likeCount: 5, createdAt: hoursAgo(48) });

    expect(hotScore(fresh, NOW)).toBeGreaterThan(hotScore(old, NOW));
  });

  it("같은 시각이면 반응이 많은 글이 더 높은 점수를 받는다", () => {
    const popular = post({ id: 1, likeCount: 10, createdAt: hoursAgo(3) });
    const quiet = post({ id: 2, likeCount: 1, createdAt: hoursAgo(3) });

    expect(hotScore(popular, NOW)).toBeGreaterThan(hotScore(quiet, NOW));
  });

  it("댓글이 좋아요보다, 좋아요가 조회수보다 크게 반영된다", () => {
    const at = hoursAgo(2);
    const oneComment = hotScore(post({ id: 1, commentCount: 1, createdAt: at }), NOW);
    const oneLike = hotScore(post({ id: 2, likeCount: 1, createdAt: at }), NOW);
    const oneView = hotScore(post({ id: 3, viewCount: 1, createdAt: at }), NOW);

    expect(oneComment).toBeGreaterThan(oneLike);
    expect(oneLike).toBeGreaterThan(oneView);
  });

  it("반응이 압도적이면 오래된 글도 반응 없는 최신 글을 이긴다", () => {
    const oldButLoved = post({ id: 1, likeCount: 50, commentCount: 20, createdAt: hoursAgo(72) });
    const freshButQuiet = post({ id: 2, likeCount: 0, createdAt: hoursAgo(0) });

    expect(hotScore(oldButLoved, NOW)).toBeGreaterThan(hotScore(freshButQuiet, NOW));
  });

  it("반응이 하나도 없으면 0점이다", () => {
    expect(hotScore(post({ id: 1 }), NOW)).toBe(0);
  });

  it("작성 시각이 미래여도(시계 어긋남) 점수가 발산하지 않는다", () => {
    const future = post({ id: 1, likeCount: 1, createdAt: new Date(NOW.getTime() + 60 * 60 * 1000) });
    const justNow = post({ id: 2, likeCount: 1, createdAt: NOW });

    const score = hotScore(future, NOW);
    expect(Number.isFinite(score)).toBe(true);
    // 미래 시각은 나이 0으로 취급되므로 방금 쓴 글과 같은 점수가 된다.
    expect(score).toBe(hotScore(justNow, NOW));
  });
});

describe("hasEnoughActivity — 2단계 전환 조건", () => {
  it("활동이 기준 미만이면 개인화하지 않는다", () => {
    expect(
      hasEnoughActivity({ likedBoardIds: [1], authoredBoardIds: [], commentedBoardIds: [] })
    ).toBe(false);
  });

  it("세 신호를 합쳐 기준을 넘으면 개인화한다", () => {
    expect(
      hasEnoughActivity({ likedBoardIds: [1], authoredBoardIds: [2], commentedBoardIds: [3] })
    ).toBe(true);
  });

  it("활동이 전혀 없는 신규 사용자는 개인화하지 않는다", () => {
    expect(
      hasEnoughActivity({ likedBoardIds: [], authoredBoardIds: [], commentedBoardIds: [] })
    ).toBe(false);
  });

  it("기준값 경계에서 정확히 동작한다", () => {
    const ids = Array.from({ length: MIN_ACTIVITY_FOR_PERSONALIZATION - 1 }, () => 1);
    expect(
      hasEnoughActivity({ likedBoardIds: ids, authoredBoardIds: [], commentedBoardIds: [] })
    ).toBe(false);
    expect(
      hasEnoughActivity({ likedBoardIds: [...ids, 1], authoredBoardIds: [], commentedBoardIds: [] })
    ).toBe(true);
  });
});

describe("buildBoardAffinity / affinityMultiplier — 게시판 선호도", () => {
  it("직접 쓴 글이 좋아요보다 강한 신호다", () => {
    const authored = buildBoardAffinity({ likedBoardIds: [], authoredBoardIds: [7], commentedBoardIds: [] });
    const liked = buildBoardAffinity({ likedBoardIds: [7], authoredBoardIds: [], commentedBoardIds: [] });

    expect(authored.get(7)!).toBeGreaterThan(liked.get(7)!);
  });

  it("같은 게시판의 활동은 누적된다", () => {
    const affinity = buildBoardAffinity({
      likedBoardIds: [3, 3, 3],
      authoredBoardIds: [],
      commentedBoardIds: [],
    });
    expect(affinity.get(3)).toBe(3);
  });

  it("활동이 없는 게시판은 가산이 없다(배율 1)", () => {
    const affinity = buildBoardAffinity({ likedBoardIds: [1], authoredBoardIds: [], commentedBoardIds: [] });
    expect(affinityMultiplier(99, affinity)).toBe(1);
  });

  it("선호도가 아무리 높아도 가산 배율에 상한이 있다", () => {
    const affinity = buildBoardAffinity({
      likedBoardIds: Array.from({ length: 500 }, () => 1),
      authoredBoardIds: Array.from({ length: 500 }, () => 1),
      commentedBoardIds: [],
    });
    expect(affinityMultiplier(1, affinity)).toBeLessThanOrEqual(1.5);
  });

  it("선호도 정보가 없으면 모든 게시판이 배율 1이다", () => {
    expect(affinityMultiplier(1, new Map())).toBe(1);
  });
});

describe("rankPosts — 정렬과 폴백", () => {
  it("선호도가 없으면 순수 인기글 순으로 정렬된다(1단계)", () => {
    const candidates = [
      post({ id: 1, likeCount: 1, createdAt: hoursAgo(2) }),
      post({ id: 2, likeCount: 20, createdAt: hoursAgo(2) }),
      post({ id: 3, likeCount: 5, createdAt: hoursAgo(2) }),
    ];

    const ranked = rankPosts(candidates, { now: NOW, limit: 5 });
    expect(ranked.map((p) => p.id)).toEqual([2, 3, 1]);
  });

  it("limit 개수만큼만 돌려준다", () => {
    const candidates = Array.from({ length: 20 }, (_, i) =>
      post({ id: i + 1, likeCount: i, createdAt: hoursAgo(2) })
    );
    expect(rankPosts(candidates, { now: NOW, limit: 5 })).toHaveLength(5);
  });

  it("선호 게시판 글이 비슷한 점수의 다른 글보다 위로 올라간다(2단계)", () => {
    const candidates = [
      post({ id: 1, boardId: 10, likeCount: 5, createdAt: hoursAgo(2) }),
      post({ id: 2, boardId: 20, likeCount: 5, createdAt: hoursAgo(2) }),
    ];
    const affinity = buildBoardAffinity({
      likedBoardIds: [20, 20],
      authoredBoardIds: [20],
      commentedBoardIds: [],
    });

    const ranked = rankPosts(candidates, { now: NOW, affinity, limit: 5 });
    expect(ranked[0].id).toBe(2);
  });

  it("선호 게시판이라도 반응 차이가 크면 인기글을 밀어내지 못한다", () => {
    const candidates = [
      post({ id: 1, boardId: 10, likeCount: 50, commentCount: 20, createdAt: hoursAgo(2) }),
      post({ id: 2, boardId: 20, likeCount: 1, createdAt: hoursAgo(2) }),
    ];
    const affinity = buildBoardAffinity({
      likedBoardIds: [20, 20, 20],
      authoredBoardIds: [20, 20],
      commentedBoardIds: [20],
    });

    const ranked = rankPosts(candidates, { now: NOW, affinity, limit: 5 });
    expect(ranked[0].id).toBe(1);
  });

  it("후보가 없으면 빈 배열을 돌려준다", () => {
    expect(rankPosts([], { now: NOW })).toEqual([]);
  });

  it("점수가 같으면 최신 글이 먼저 오고 순서가 흔들리지 않는다", () => {
    const candidates = [
      post({ id: 1, createdAt: hoursAgo(5) }),
      post({ id: 2, createdAt: hoursAgo(1) }),
      post({ id: 3, createdAt: hoursAgo(3) }),
    ];

    const first = rankPosts(candidates, { now: NOW, limit: 5 }).map((p) => p.id);
    const second = rankPosts([...candidates].reverse(), { now: NOW, limit: 5 }).map((p) => p.id);

    expect(first).toEqual([2, 3, 1]);
    expect(second).toEqual(first);
  });

  it("원본 글의 다른 필드를 그대로 유지한 채 score만 덧붙인다", () => {
    const candidates = [{ ...post({ id: 1, likeCount: 3 }), title: "제목", boardName: "자유게시판" }];
    const [ranked] = rankPosts(candidates, { now: NOW });

    expect(ranked.title).toBe("제목");
    expect(ranked.boardName).toBe("자유게시판");
    expect(ranked.score).toBeGreaterThan(0);
  });
});
