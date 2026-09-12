import { eq, and, or, like, isNull, desc, asc, sql, inArray, gt, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import path from "node:path";
import { InsertUser, users, authIdentities, boards, posts, comments, postLikes, commentLikes, reports, announcements, news, inquiries, conversations, messages, adBanners, moderationLogs, notifications } from "../drizzle/schema";
import { ENV } from './_core/env';
import { resolveInitialStatus } from "./_core/approval";
import { PRIVACY_VERSION, TERMS_VERSION } from "@shared/legal";
import {
  buildBoardAffinity,
  hasEnoughActivity,
  rankPosts,
  type BoardAffinity,
} from "./_core/ranking";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

/**
 * 서버 부팅 시 대기 중인 마이그레이션을 직접 적용한다. package.json의 prestart
 * 훅과 달리, 배포 플랫폼이 커스텀 Start Command로 pnpm/npm 스크립트 체인을
 * 건너뛰어도(예: "node dist/index.js"를 직접 실행) 항상 실행된다.
 */
export async function runMigrations() {
  const db = await getDb();
  if (!db) {
    console.warn("[Migrate] DATABASE_URL이 없어 마이그레이션을 건너뜁니다.");
    return;
  }
  try {
    await migrate(db, { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
    console.log("[Migrate] 마이그레이션 적용 완료");
  } catch (error) {
    console.error("[Migrate] 마이그레이션 적용 실패:", error);
    throw error;
  }
}

function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email || !ENV.ownerEmail) return false;
  return email.toLowerCase() === ENV.ownerEmail;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAuthIdentity(
  provider: "google" | "kakao" | "apple",
  providerUserId: string
) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(authIdentities)
    .where(
      and(
        eq(authIdentities.provider, provider),
        eq(authIdentities.providerUserId, providerUserId)
      )
    )
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/**
 * 이메일/비밀번호로 새 계정을 만든다. name은 "학번 이름" 형식이어야 한다 (라우터에서 검증).
 */
export async function createUserWithPassword(data: {
  email: string;
  passwordHash: string;
  name: string;
  notifyPost?: boolean;
  notifyMarketing?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const role = isOwnerEmail(data.email) ? "owner" : "user";
  // 신규 가입자는 원칙적으로 승인 대기. 예외 판단은 approval.ts 한 곳에서만 한다.
  const status = resolveInitialStatus({ email: data.email, role });
  const now = new Date();

  const [result] = await db.insert(users).values({
    email: data.email.toLowerCase(),
    passwordHash: data.passwordHash,
    name: data.name,
    loginMethod: "email",
    role,
    status,
    // 가입 화면에서 두 문서 링크와 함께 "가입 시 동의" 문구를 노출하므로,
    // 계정 생성 시점을 동의 시점으로 기록한다.
    termsAgreedAt: now,
    termsVersion: TERMS_VERSION,
    privacyAgreedAt: now,
    privacyVersion: PRIVACY_VERSION,
    notifyPost: data.notifyPost ?? false,
    notifyPostAt: data.notifyPost ? now : null,
    notifyMarketing: data.notifyMarketing ?? false,
    notifyMarketingAt: data.notifyMarketing ? now : null,
    lastSignedIn: now,
  });

  return getUserById(result.insertId);
}

/**
 * 소셜 로그인 최초 가입: 사용자 계정을 만들고 authIdentities에 연동 정보를 남긴다.
 */
export async function createUserFromOAuth(data: {
  provider: "google" | "kakao" | "apple";
  providerUserId: string;
  email: string | null;
  name: string;
  notifyPost?: boolean;
  notifyMarketing?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const role = isOwnerEmail(data.email) ? "owner" : "user";
  const status = resolveInitialStatus({ email: data.email, role });
  const now = new Date();

  const [result] = await db.insert(users).values({
    email: data.email ? data.email.toLowerCase() : null,
    name: data.name,
    loginMethod: data.provider,
    role,
    status,
    // 가입 화면에서 두 문서 링크와 함께 "가입 시 동의" 문구를 노출하므로,
    // 계정 생성 시점을 동의 시점으로 기록한다.
    termsAgreedAt: now,
    termsVersion: TERMS_VERSION,
    privacyAgreedAt: now,
    privacyVersion: PRIVACY_VERSION,
    notifyPost: data.notifyPost ?? false,
    notifyPostAt: data.notifyPost ? now : null,
    notifyMarketing: data.notifyMarketing ?? false,
    notifyMarketingAt: data.notifyMarketing ? now : null,
    lastSignedIn: now,
  });

  await db.insert(authIdentities).values({
    userId: result.insertId,
    provider: data.provider,
    providerUserId: data.providerUserId,
  });

  return getUserById(result.insertId);
}

/**
 * 로그인할 때마다 호출된다. OWNER_EMAIL이 계정 생성 이후에 설정되거나 바뀐
 * 경우에도 다음 로그인 시 자동으로 admin 권한이 반영되도록, 여기서도 한 번 더
 * 확인한다 (계정 생성 시점에만 확인하면 이미 만들어진 계정은 영영 못 올라간다).
 * 이메일이 일치하지 않으면 아무 영향 없고, admin을 내리는 로직은 없다.
 */
export async function touchLastSignedIn(userId: number, loginMethod?: string) {
  const db = await getDb();
  if (!db) return;

  const existing = await getUserById(userId);
  const shouldPromote = existing && existing.role !== "owner" && isOwnerEmail(existing.email);

  await db
    .update(users)
    .set({
      lastSignedIn: new Date(),
      ...(loginMethod ? { loginMethod } : {}),
      ...(shouldPromote ? { role: "owner" as const } : {}),
    })
    .where(eq(users.id, userId));
}

/**
 * 게시판 관련 쿼리
 */
export async function getBoards() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(boards).where(eq(boards.isActive, true)).orderBy(asc(boards.displayOrder));
}

/**
 * 게시판 목록 + 각 게시판의 최신 글 한 건.
 *
 * 홈 화면이 게시판마다 posts.listByBoard를 따로 부르던 것을 대체한다(게시판 5개면
 * 요청 5건, 10개면 10건이었다). 최신 글은 게시판별로 id가 가장 큰 한 건만 고르면
 * 되므로, 서브쿼리로 그 id 목록을 구한 뒤 한 번에 조인한다.
 *
 * 익명 글의 제목은 그대로 보여주되 작성자 정보는 어차피 싣지 않는다.
 */
export async function getBoardsWithLatestPost() {
  const db = await getDb();
  if (!db) return [];

  const boardRows = await db
    .select()
    .from(boards)
    .where(eq(boards.isActive, true))
    .orderBy(asc(boards.displayOrder));

  if (boardRows.length === 0) return [];

  // 게시판별 최신 글 id (삭제되지 않은 글 중 가장 큰 id)
  const latestIdRows = await db
    .select({ boardId: posts.boardId, latestId: sql<number>`MAX(${posts.id})` })
    .from(posts)
    .where(and(isNull(posts.deletedAt), inArray(posts.boardId, boardRows.map((b) => b.id))))
    .groupBy(posts.boardId);

  const latestIds = latestIdRows.map((r) => Number(r.latestId)).filter(Boolean);
  const latestPosts = latestIds.length
    ? await db
        .select({
          id: posts.id,
          boardId: posts.boardId,
          title: posts.title,
          likeCount: posts.likeCount,
          commentCount: posts.commentCount,
          createdAt: posts.createdAt,
        })
        .from(posts)
        .where(inArray(posts.id, latestIds))
    : [];

  const byBoard = new Map(latestPosts.map((p) => [p.boardId, p]));
  return boardRows.map((board) => ({ ...board, latestPost: byBoard.get(board.id) ?? null }));
}

export async function getBoardBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(boards).where(eq(boards.slug, slug)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createBoard(data: { name: string; slug: string; description?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(boards).values(data);
  return result;
}

export async function updateBoard(id: number, data: Partial<{ name: string; slug: string; description: string; displayOrder: number; isActive: boolean }>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(boards).set(data).where(eq(boards.id, id));
}

export async function deleteBoard(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(boards).where(eq(boards.id, id));
}

export type WithAuthor<T> = Omit<T, "userId"> & {
  /** 익명 글에는 null. 작성자를 역추적할 단서를 응답에 아예 싣지 않기 위해서다. */
  userId: number | null;
  /** 보는 사람이 작성자 본인인지. 익명 글이라 userId를 지워도 본인은 수정·삭제할 수 있어야 한다. */
  isMine: boolean;
  authorName: string | null;
  authorAvatarEmoji: string | null;
  authorAvatarImageUrl: string | null;
};

/**
 * 게시글/댓글 목록에 작성자 정보를 붙인다.
 *
 * 익명 글은 이름·아바타뿐 아니라 **userId까지 응답에서 제거**한다. 이름만 지우고
 * userId를 남겨두면, 같은 사람이 실명으로 쓴 글 하나만 있어도 userId를 열쇠로
 * 익명 글의 작성자를 복원할 수 있다 — 로그인조차 필요 없는 공개 API에서 그대로
 * 노출되므로 이름을 지우는 것만으로는 익명이 되지 않는다.
 *
 * 대신 본인 여부는 서버가 계산한 isMine으로 알려준다. 익명 글 작성자가 자기 글을
 * 수정·삭제하는 경로는 그대로 유지된다.
 *
 * viewerId는 요청한 사용자의 id(비로그인이면 null). 작성자 판별 외에는 쓰지 않는다.
 */
async function attachAuthors<T extends { userId: number; isAnonymous: boolean }>(
  rows: T[],
  viewerId: number | null = null
): Promise<WithAuthor<T>[]> {
  const anonymize = (row: T): WithAuthor<T> => ({
    ...row,
    userId: null,
    isMine: viewerId !== null && viewerId === row.userId,
    authorName: null,
    authorAvatarEmoji: null,
    authorAvatarImageUrl: null,
  });

  if (rows.length === 0) return [];
  const db = await getDb();
  if (!db) {
    return rows.map((row) =>
      row.isAnonymous
        ? anonymize(row)
        : {
            ...row,
            isMine: viewerId !== null && viewerId === row.userId,
            authorName: null,
            authorAvatarEmoji: null,
            authorAvatarImageUrl: null,
          }
    );
  }

  const ids = Array.from(new Set(rows.map((r) => r.userId)));
  const authors = await db
    .select({ id: users.id, name: users.name, avatarEmoji: users.avatarEmoji, avatarImageUrl: users.avatarImageUrl })
    .from(users)
    .where(inArray(users.id, ids));
  const authorMap = new Map(authors.map((a) => [a.id, a]));

  return rows.map((row) => {
    if (row.isAnonymous) return anonymize(row);
    const author = authorMap.get(row.userId);
    return {
      ...row,
      isMine: viewerId !== null && viewerId === row.userId,
      authorName: author?.name ?? null,
      authorAvatarEmoji: author?.avatarEmoji ?? null,
      authorAvatarImageUrl: author?.avatarImageUrl ?? null,
    };
  });
}

/**
 * MariaDB(로컬 개발 DB)는 MySQL의 네이티브 JSON 타입이 없어서 JSON 컬럼을 프로토콜
 * 레벨에서 그냥 문자열로 내려준다 — drizzle의 json() 컬럼이 기대하는 자동 파싱이
 * 이 경우 동작하지 않아 select 결과의 `images`가 배열이 아니라 "[]" 같은 문자열로
 * 온다. MySQL/MariaDB 어느 쪽에서 읽어도 항상 배열이 되도록 여기서 직접 정규화한다.
 */
function normalizePostImages<T extends { images?: unknown }>(row: T): T {
  if (typeof (row as any).images === "string") {
    try {
      return { ...row, images: JSON.parse((row as any).images) };
    } catch {
      return { ...row, images: [] };
    }
  }
  if (!Array.isArray((row as any).images)) {
    return { ...row, images: [] };
  }
  return row;
}

/**
 * 게시글 관련 쿼리
 */
export async function getPostsByBoard(boardId: number, limit: number = 20, offset: number = 0, sortBy: 'latest' | 'popular' = 'latest', search?: string, viewerId: number | null = null) {
  const db = await getDb();
  if (!db) return [];

  const orderBy = sortBy === 'popular' ? desc(posts.likeCount) : desc(posts.createdAt);

  let whereCondition = and(eq(posts.boardId, boardId), isNull(posts.deletedAt));

  if (search) {
    whereCondition = and(
      whereCondition,
      or(
        like(posts.title, `%${search}%`),
        like(posts.content, `%${search}%`)
      )
    );
  }

  // createdAt/likeCount만으로는 동점(같은 초에 작성되거나 좋아요 수가 같은 경우) 순서가
  // 불안정해지므로 id를 2차 정렬 기준으로 추가해 항상 같은 순서가 나오게 한다.
  const rows = await db.select().from(posts)
    .where(whereCondition)
    .orderBy(desc(posts.isNotice), orderBy, desc(posts.id))
    .limit(limit)
    .offset(offset);
  return attachAuthors(rows.map(normalizePostImages), viewerId);
}

export async function getPostById(id: number, viewerId: number | null = null) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  if (result.length === 0) return undefined;
  const [withAuthor] = await attachAuthors(result.map(normalizePostImages), viewerId);
  return withAuthor;
}

/**
 * 익명 글·댓글의 작성자 신원 조회 (조물주 전용 — routers.ts에서 권한을 건다).
 *
 * 괴롭힘 등 사안 조사를 위해 남겨둔 경로다. 일반 관리자에게도 열어두면 익명
 * 게시판이 사실상 실명이 되므로 최상위 권한 한 명만 쓸 수 있게 한다.
 */
export async function getAnonymousAuthor(
  targetType: "post" | "comment",
  targetId: number
): Promise<{ userId: number; name: string | null; email: string | null } | null> {
  const db = await getDb();
  if (!db) return null;

  const [row] =
    targetType === "post"
      ? await db.select({ userId: posts.userId, isAnonymous: posts.isAnonymous }).from(posts).where(eq(posts.id, targetId)).limit(1)
      : await db.select({ userId: comments.userId, isAnonymous: comments.isAnonymous }).from(comments).where(eq(comments.id, targetId)).limit(1);

  if (!row) return null;

  const [author] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, row.userId))
    .limit(1);

  if (!author) return null;
  return { userId: author.id, name: author.name, email: author.email };
}

/**
 * 서버 내부 전용 작성자 조회. getPostById는 익명 글의 userId를 지워서 돌려주므로,
 * "내 글에 댓글이 달렸다" 같은 알림을 보내려면 원본 작성자를 따로 읽어야 한다.
 * 이 값은 알림 대상 결정에만 쓰고 절대 응답에 실어 보내지 않는다.
 */
export async function getPostAuthorId(postId: number): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select({ userId: posts.userId })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);
  return row?.userId ?? null;
}

export async function createPost(data: { boardId: number; userId: number; title: string; content: string; isAnonymous: boolean; images?: string[] }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(posts).values(data);
  return result;
}

export async function updatePost(id: number, data: Partial<{ title: string; content: string; images: string[] }>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(posts).set(data).where(eq(posts.id, id));
}

export async function deletePost(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(posts).set({ deletedAt: new Date() }).where(eq(posts.id, id));
}

export async function incrementPostViewCount(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(posts).set({ viewCount: sql`${posts.viewCount} + 1` }).where(eq(posts.id, id));
}

/**
 * 게시판 전체를 대상으로 한 검색. FULLTEXT 인덱스 없이도 동작해야 하고
 * 한글은 MySQL 기본 파서로 토큰화가 잘 안 되므로(공백 기준), MATCH AGAINST
 * 대신 LIKE 부분일치를 쓴다 — 게시판별 검색(getPostsByBoard)과 동일한 방식.
 */
export async function searchPosts(query: string, limit: number = 20, offset: number = 0, viewerId: number | null = null) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(posts)
    .where(and(
      or(
        like(posts.title, `%${query}%`),
        like(posts.content, `%${query}%`)
      ),
      isNull(posts.deletedAt)
    ))
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(limit)
    .offset(offset);
  return attachAuthors(rows.map(normalizePostImages), viewerId);
}

/**
 * 추천 게시글 — 후보를 모아 ranking.ts에 점수 계산을 위임한다.
 *
 * 여기서는 "어떤 글을 후보로 볼지"(기간·삭제·공지 제외)와 "사용자 활동을 어떻게
 * 읽어올지"만 정하고, 점수와 정렬은 전부 ranking.ts가 맡는다. 알고리즘 교체 시
 * 이 함수는 그대로 두고 ranking.ts만 바꾸면 된다.
 */
const RECOMMEND_WINDOW_DAYS = 14;
/** 점수를 매길 후보 상한. 이 정도면 학교 커뮤니티 규모에서 2주치를 다 덮는다. */
const RECOMMEND_CANDIDATE_LIMIT = 200;
/** 목록 미리보기에 쓸 본문 길이. 한 줄 말줄임으로 잘리므로 넉넉히 이 정도면 충분하다. */
const EXCERPT_MAX_CHARS = 120;

/**
 * 로그인 사용자의 게시판 선호도 원천 데이터.
 *
 * 새 테이블 없이 기존 postLikes / posts.userId / comments만으로 만든다 —
 * "좋아요 누른 글의 게시판", "내가 쓴 글의 게시판", "내가 댓글 단 글의 게시판"이
 * 모두 이 세 테이블에서 조인으로 나온다. (별도의 방문 로그는 저장하지 않는다.)
 */
export async function getUserBoardActivity(userId: number): Promise<{
  likedBoardIds: number[];
  authoredBoardIds: number[];
  commentedBoardIds: number[];
}> {
  const db = await getDb();
  const empty = { likedBoardIds: [], authoredBoardIds: [], commentedBoardIds: [] };
  if (!db) return empty;

  const [liked, authored, commented] = await Promise.all([
    db
      .select({ boardId: posts.boardId })
      .from(postLikes)
      .innerJoin(posts, eq(postLikes.postId, posts.id))
      .where(and(eq(postLikes.userId, userId), isNull(posts.deletedAt)))
      .orderBy(desc(postLikes.createdAt))
      .limit(100),
    db
      .select({ boardId: posts.boardId })
      .from(posts)
      .where(and(eq(posts.userId, userId), isNull(posts.deletedAt)))
      .orderBy(desc(posts.createdAt))
      .limit(100),
    db
      .select({ boardId: posts.boardId })
      .from(comments)
      .innerJoin(posts, eq(comments.postId, posts.id))
      .where(and(eq(comments.userId, userId), isNull(comments.deletedAt), isNull(posts.deletedAt)))
      .orderBy(desc(comments.createdAt))
      .limit(100),
  ]);

  return {
    likedBoardIds: liked.map((r) => r.boardId),
    authoredBoardIds: authored.map((r) => r.boardId),
    commentedBoardIds: commented.map((r) => r.boardId),
  };
}

/**
 * 홈 화면 추천 목록. userId가 없거나(비로그인) 활동이 부족하면 자동으로
 * 인기글(1단계)만으로 계산된다 — 호출부는 분기할 필요가 없다.
 */
export async function getRecommendedPosts(userId: number | null, limit: number = 5) {
  const db = await getDb();
  if (!db) return [];

  const since = new Date(Date.now() - RECOMMEND_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // 공지는 이미 별도 영역에서 항상 상단 고정으로 노출되므로 추천에서는 뺀다.
  const candidates = await db
    .select({
      id: posts.id,
      boardId: posts.boardId,
      title: posts.title,
      content: posts.content,
      likeCount: posts.likeCount,
      commentCount: posts.commentCount,
      viewCount: posts.viewCount,
      createdAt: posts.createdAt,
      boardName: boards.name,
      boardSlug: boards.slug,
    })
    .from(posts)
    .innerJoin(boards, eq(posts.boardId, boards.id))
    .where(and(
      isNull(posts.deletedAt),
      eq(posts.isNotice, false),
      eq(boards.isActive, true),
      gt(posts.createdAt, since),
    ))
    .orderBy(desc(posts.createdAt))
    .limit(RECOMMEND_CANDIDATE_LIMIT);

  if (candidates.length === 0) return [];

  let affinity: BoardAffinity = new Map();
  if (userId !== null) {
    const activity = await getUserBoardActivity(userId);
    // 활동이 적을 때 억지로 개인화하면 표본이 1~2건인 게시판이 추천을 독점한다.
    if (hasEnoughActivity(activity)) {
      affinity = buildBoardAffinity(activity);
    }
  }

  // 미리보기용으로 본문 첫 줄만 잘라 보낸다. 목록에 쓸 것이라 전문을 실어 보낼
  // 이유가 없고, 줄바꿈이 섞이면 한 줄 말줄임이 깨지므로 공백으로 눕혀둔다.
  return rankPosts(candidates, { affinity, limit }).map(({ content, ...post }) => ({
    ...post,
    excerpt: content.replace(/\s+/g, " ").trim().slice(0, EXCERPT_MAX_CHARS),
  }));
}

/**
 * 댓글 관련 쿼리
 */
/** 댓글 조회 상한. 인기 글의 댓글이 수백 개여도 한 번에 다 내려보내지 않는다. */
const COMMENT_PAGE_LIMIT = 200;

export async function getCommentsByPost(postId: number, viewerId: number | null = null, limit: number = COMMENT_PAGE_LIMIT) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(comments)
    .where(and(eq(comments.postId, postId), isNull(comments.deletedAt)))
    .orderBy(asc(comments.createdAt))
    .limit(limit);
  return attachAuthors(rows, viewerId);
}

export async function getCommentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(comments).where(eq(comments.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createComment(data: { postId: number; userId: number; content: string; isAnonymous: boolean; parentCommentId?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(comments).values(data);
  // 게시글의 댓글 수 증가
  await db.update(posts).set({ commentCount: sql`${posts.commentCount} + 1` }).where(eq(posts.id, data.postId));
  return result;
}

export async function deleteComment(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const comment = await getCommentById(id);
  if (comment) {
    await db.update(posts).set({ commentCount: sql`${posts.commentCount} - 1` }).where(eq(posts.id, comment.postId));
  }
  return db.update(comments).set({ deletedAt: new Date() }).where(eq(comments.id, id));
}

/**
 * 추천 관련 쿼리
 */
export async function hasUserLikedPost(postId: number, userId: number) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.select().from(postLikes)
    .where(and(eq(postLikes.postId, postId), eq(postLikes.userId, userId)))
    .limit(1);
  return result.length > 0;
}

/** postLikes에 (postId, userId) 유니크 제약이 있어, 동시 클릭 등으로 두 번 들어와도
 *  두 번째 insert는 중복 키 에러가 난다 — 그 경우는 이미 좋아요된 상태이므로 조용히 무시하고
 *  카운트도 다시 올리지 않는다 (이미 첫 번째 호출에서 올라갔다). */
export async function addPostLike(postId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  try {
    await db.insert(postLikes).values({ postId, userId });
  } catch (error: any) {
    if (error?.code === "ER_DUP_ENTRY" || error?.cause?.code === "ER_DUP_ENTRY") return;
    throw error;
  }
  await db.update(posts).set({ likeCount: sql`${posts.likeCount} + 1` }).where(eq(posts.id, postId));
}

/** 실제로 삭제된 행이 있을 때만 카운트를 내린다 — 동시 요청 등으로 이미 지워진 상태에서
 *  또 호출되면 delete는 0행에 영향을 주지만, 그래도 카운트를 내리면 실제 좋아요 수보다
 *  낮게 어긋나 버린다. */
export async function removePostLike(postId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.delete(postLikes).where(and(eq(postLikes.postId, postId), eq(postLikes.userId, userId)));
  if (result.affectedRows === 0) return;
  await db.update(posts).set({ likeCount: sql`${posts.likeCount} - 1` }).where(eq(posts.id, postId));
}

export async function hasUserLikedComment(commentId: number, userId: number) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.select().from(commentLikes)
    .where(and(eq(commentLikes.commentId, commentId), eq(commentLikes.userId, userId)))
    .limit(1);
  return result.length > 0;
}

export async function addCommentLike(commentId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  try {
    await db.insert(commentLikes).values({ commentId, userId });
  } catch (error: any) {
    if (error?.code === "ER_DUP_ENTRY" || error?.cause?.code === "ER_DUP_ENTRY") return;
    throw error;
  }
  await db.update(comments).set({ likeCount: sql`${comments.likeCount} + 1` }).where(eq(comments.id, commentId));
}

export async function removeCommentLike(commentId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.delete(commentLikes).where(and(eq(commentLikes.commentId, commentId), eq(commentLikes.userId, userId)));
  if (result.affectedRows === 0) return;
  await db.update(comments).set({ likeCount: sql`${comments.likeCount} - 1` }).where(eq(comments.id, commentId));
}

/**
 * 신고 관련 쿼리
 */
/** 같은 사람이 같은 대상을 이미 신고했는지. 중복 신고로 관리자 목록이 도배되는 것을 막는다. */
export async function hasReported(
  reporterUserId: number,
  targetType: "post" | "comment",
  targetId: number
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const [row] = await db
    .select({ id: reports.id })
    .from(reports)
    .where(and(
      eq(reports.reporterUserId, reporterUserId),
      eq(reports.targetType, targetType),
      eq(reports.targetId, targetId),
    ))
    .limit(1);
  return Boolean(row);
}

export async function createReport(data: { reporterUserId: number; targetType: 'post' | 'comment'; targetId: number; reason: string; description?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(reports).values(data);
}

export async function getReports(status?: 'pending' | 'resolved' | 'dismissed', limit: number = 20, offset: number = 0) {
  const db = await getDb();
  if (!db) return [];
  const query = status ? db.select().from(reports).where(eq(reports.status, status)) : db.select().from(reports);
  return query.orderBy(desc(reports.createdAt)).limit(limit).offset(offset);
}

export async function updateReportStatus(id: number, status: 'pending' | 'resolved' | 'dismissed', adminNotes?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(reports).set({ status, adminNotes }).where(eq(reports.id, id));
}

/**
 * 문의함 관련 쿼리
 */
export async function createInquiry(data: {
  userId: number;
  category: 'general' | 'bug' | 'suggestion' | 'report_abuse' | 'account';
  title: string;
  content: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(inquiries).values(data);
}

export async function getInquiriesByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(inquiries).where(eq(inquiries.userId, userId)).orderBy(desc(inquiries.createdAt));
}

export async function getAllInquiries(status?: 'pending' | 'answered') {
  const db = await getDb();
  if (!db) return [];
  const query = status
    ? db.select().from(inquiries).where(eq(inquiries.status, status))
    : db.select().from(inquiries);
  return query.orderBy(desc(inquiries.createdAt));
}

export async function answerInquiry(id: number, adminReply: string, repliedBy: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(inquiries)
    .set({ adminReply, repliedBy, repliedAt: new Date(), status: 'answered' })
    .where(eq(inquiries.id, id));
}

/**
 * 공지사항 관련 쿼리
 */
export async function getAnnouncements(limit: number = 10) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(announcements)
    .where(eq(announcements.isActive, true))
    .orderBy(desc(announcements.displayOrder), desc(announcements.createdAt))
    .limit(limit);
}

export async function createAnnouncement(data: { title: string; content: string; createdBy: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(announcements).values(data);
}

export async function updateAnnouncement(id: number, data: Partial<{ title: string; content: string; displayOrder: number; isActive: boolean }>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(announcements).set(data).where(eq(announcements.id, id));
}

export async function deleteAnnouncement(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(announcements).where(eq(announcements.id, id));
}

/**
 * 알림 수신 동의 / 앱 내 알림함 관련 쿼리
 */

/** 동의를 켤 때만 동의 시각을 갱신하고, 끌 때는 시각을 지운다(동의 이력 추적용). */
export async function updateNotificationPrefs(
  userId: number,
  prefs: { notifyPost?: boolean; notifyMarketing?: boolean }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = new Date();
  const data: Record<string, unknown> = {};
  if (prefs.notifyPost !== undefined) {
    data.notifyPost = prefs.notifyPost;
    data.notifyPostAt = prefs.notifyPost ? now : null;
  }
  if (prefs.notifyMarketing !== undefined) {
    data.notifyMarketing = prefs.notifyMarketing;
    data.notifyMarketingAt = prefs.notifyMarketing ? now : null;
  }
  if (Object.keys(data).length === 0) return;
  return db.update(users).set(data).where(eq(users.id, userId));
}

export async function createNotification(data: {
  userId: number;
  type: 'post_comment' | 'post_like' | 'marketing' | 'announcement';
  title: string;
  body?: string | null;
  linkUrl?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(notifications).values(data);
}

/** 여러 사용자에게 같은 알림을 한 번에 넣는다 (관리자 광고성 발송용). */
export async function createNotificationsForUsers(
  userIds: number[],
  data: {
    type: 'post_comment' | 'post_like' | 'marketing' | 'announcement';
    title: string;
    body?: string | null;
    linkUrl?: string | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (userIds.length === 0) return;
  return db.insert(notifications).values(userIds.map((userId) => ({ ...data, userId })));
}

/** 광고성 정보 수신에 동의했고 차단되지 않은 사용자 id 목록. */
export async function getMarketingOptInUserIds(): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.notifyMarketing, true), eq(users.status, 'active')));
  return rows.map((row) => row.id);
}

/** 특정 사용자가 활동 알림(notifyPost)에 동의했는지 확인. */
export async function hasPostNotifyConsent(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select({ notifyPost: users.notifyPost }).from(users).where(eq(users.id, userId)).limit(1);
  return rows.length > 0 ? rows[0].notifyPost : false;
}

export async function getNotifications(userId: number, limit: number = 30, offset: number = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getUnreadNotificationCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.select({ id: notifications.id }).from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return rows.length;
}

/** 본인 알림만 읽음 처리할 수 있도록 userId를 함께 조건에 넣는다. */
export async function markNotificationRead(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(notifications).set({ isRead: true })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
}

export async function markAllNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(notifications).set({ isRead: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
}

/**
 * 자동 필터 차단 기록 관련 쿼리
 */
export async function createModerationLog(data: {
  userId: number;
  targetType: 'post' | 'comment';
  boardId?: number | null;
  content: string;
  reason: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(moderationLogs).values(data);
}

export async function getModerationLogs(limit: number = 50, offset: number = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(moderationLogs)
    .orderBy(desc(moderationLogs.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * 광고 배너 관련 쿼리
 */
export async function getActiveAdBanners(position: "home_top" | "board_top", boardId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(adBanners.isActive, true), eq(adBanners.position, position)];
  if (position === "board_top") {
    if (!boardId) return [];
    conditions.push(eq(adBanners.targetBoardId, boardId));
  }
  const rows = await db.select().from(adBanners)
    .where(and(...conditions))
    .orderBy(desc(adBanners.displayOrder), desc(adBanners.createdAt));
  const now = Date.now();
  return rows.filter((b) => {
    if (b.startsAt && new Date(b.startsAt).getTime() > now) return false;
    if (b.endsAt && new Date(b.endsAt).getTime() < now) return false;
    return true;
  });
}

export async function getAllAdBanners() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(adBanners).orderBy(desc(adBanners.displayOrder), desc(adBanners.createdAt));
}

export async function createAdBanner(data: {
  title: string;
  imageUrl: string;
  linkUrl: string;
  position: "home_top" | "board_top";
  targetBoardId?: number | null;
  displayOrder?: number;
  startsAt?: Date | null;
  endsAt?: Date | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(adBanners).values(data);
}

export async function updateAdBanner(
  id: number,
  data: Partial<{
    title: string;
    imageUrl: string;
    linkUrl: string;
    position: "home_top" | "board_top";
    targetBoardId: number | null;
    isActive: boolean;
    displayOrder: number;
    startsAt: Date | null;
    endsAt: Date | null;
  }>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(adBanners).set(data).where(eq(adBanners.id, id));
}

export async function deleteAdBanner(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(adBanners).where(eq(adBanners.id, id));
}

export async function incrementAdBannerClick(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(adBanners).set({ clickCount: sql`${adBanners.clickCount} + 1` }).where(eq(adBanners.id, id));
}

export async function incrementAdBannerImpression(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(adBanners).set({ impressionCount: sql`${adBanners.impressionCount} + 1` }).where(eq(adBanners.id, id));
}

/**
 * 오늘의 중요 뉴스 관련 쿼리 (관리자 큐레이션)
 */
export async function getActiveNews(limit: number = 10) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(news)
    .where(eq(news.isActive, true))
    .orderBy(desc(news.displayOrder), desc(news.createdAt))
    .limit(limit);
}

export async function getAllNews() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(news).orderBy(desc(news.displayOrder), desc(news.createdAt));
}

export async function createNews(data: { title: string; url?: string; createdBy: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(news).values(data);
}

export async function updateNews(id: number, data: Partial<{ title: string; url: string | null; displayOrder: number; isActive: boolean }>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(news).set(data).where(eq(news.id, id));
}

export async function deleteNews(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(news).where(eq(news.id, id));
}

/**
 * 사용자 관리 쿼리
 */
export async function getAllUsers(limit: number = 20, offset: number = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt)).limit(limit).offset(offset);
}

/** 관리자 패널의 "활동 내역" 보기용 — 최근 게시글/댓글/좋아요를 모아서 돌려준다. */
export async function getUserActivity(userId: number) {
  const db = await getDb();
  if (!db) return { posts: [], comments: [], likedPosts: [], likedComments: [] };

  const userPosts = await db.select().from(posts)
    .where(and(eq(posts.userId, userId), isNull(posts.deletedAt)))
    .orderBy(desc(posts.createdAt))
    .limit(20);

  const userComments = await db.select().from(comments)
    .where(and(eq(comments.userId, userId), isNull(comments.deletedAt)))
    .orderBy(desc(comments.createdAt))
    .limit(20);

  const likedPostRows = await db.select({ postId: postLikes.postId, createdAt: postLikes.createdAt })
    .from(postLikes)
    .where(eq(postLikes.userId, userId))
    .orderBy(desc(postLikes.createdAt))
    .limit(20);

  const likedCommentRows = await db.select({ commentId: commentLikes.commentId, createdAt: commentLikes.createdAt })
    .from(commentLikes)
    .where(eq(commentLikes.userId, userId))
    .orderBy(desc(commentLikes.createdAt))
    .limit(20);

  const likedPostIds = likedPostRows.map((r) => r.postId);
  const likedPostDetails = likedPostIds.length > 0
    ? await db.select({ id: posts.id, title: posts.title }).from(posts).where(inArray(posts.id, likedPostIds))
    : [];
  const likedPostTitleMap = new Map(likedPostDetails.map((p) => [p.id, p.title]));

  const likedCommentIds = likedCommentRows.map((r) => r.commentId);
  const likedCommentDetails = likedCommentIds.length > 0
    ? await db.select({ id: comments.id, content: comments.content, postId: comments.postId }).from(comments).where(inArray(comments.id, likedCommentIds))
    : [];
  const likedCommentDetailMap = new Map(likedCommentDetails.map((c) => [c.id, c]));

  return {
    posts: userPosts.map(normalizePostImages),
    comments: userComments,
    likedPosts: likedPostRows.map((r) => ({
      postId: r.postId,
      createdAt: r.createdAt,
      title: likedPostTitleMap.get(r.postId) ?? null,
    })),
    likedComments: likedCommentRows.map((r) => ({
      commentId: r.commentId,
      createdAt: r.createdAt,
      content: likedCommentDetailMap.get(r.commentId)?.content ?? null,
      postId: likedCommentDetailMap.get(r.commentId)?.postId ?? null,
    })),
  };
}

/**
 * 회원 탈퇴.
 *
 * 계정 행을 지우지 않고 개인정보만 비운다(soft delete). 행을 통째로 지우면 그 사람이
 * 남긴 게시글·댓글·쪽지의 userId가 가리킬 곳이 없어져 남의 글로 보이거나 목록이 깨진다.
 * 그래서 식별정보(이름·이메일·비밀번호·아바타·소셜 연동)만 제거하고 껍데기를 남긴다.
 *
 * 반환값의 avatarImageUrl은 호출부가 업로드 파일까지 정리할 수 있도록 돌려주는 것이다.
 */
/**
 * 탈퇴하면서 본인이 쓴 글·댓글도 함께 지운다.
 *
 * 글 삭제와 같은 soft delete(deletedAt)를 쓴다 — 다른 사람의 댓글이 달려 있을 수 있고,
 * 신고 처리 기록과도 연결돼 있어 행을 즉시 지우면 참조가 깨진다.
 * 첨부 이미지 URL은 호출부가 저장소 정리에 쓰도록 함께 돌려준다.
 */
export async function softDeleteUserContent(userId: number): Promise<{ imageUrls: string[] }> {
  const db = await getDb();
  if (!db) return { imageUrls: [] };

  const myPosts = await db
    .select({ id: posts.id, images: posts.images })
    .from(posts)
    .where(and(eq(posts.userId, userId), isNull(posts.deletedAt)));

  const now = new Date();
  await db.update(posts).set({ deletedAt: now }).where(and(eq(posts.userId, userId), isNull(posts.deletedAt)));
  await db.update(comments).set({ deletedAt: now }).where(and(eq(comments.userId, userId), isNull(comments.deletedAt)));

  const imageUrls: string[] = [];
  for (const row of myPosts) {
    const normalized = normalizePostImages(row) as { images?: unknown };
    if (Array.isArray(normalized.images)) {
      for (const url of normalized.images) if (typeof url === "string") imageUrls.push(url);
    }
  }
  return { imageUrls };
}

export async function withdrawUser(userId: number): Promise<{ avatarImageUrl: string | null }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getUserById(userId);
  const avatarImageUrl = existing?.avatarImageUrl ?? null;

  // 소셜 연동을 끊어야 같은 소셜 계정으로 다시 가입할 수 있다.
  await db.delete(authIdentities).where(eq(authIdentities.userId, userId));

  await db
    .update(users)
    .set({
      name: null,
      // 이메일은 unique 제약이 있어 null로 비워야 같은 주소로 재가입할 수 있다.
      email: null,
      passwordHash: null,
      avatarEmoji: null,
      avatarImageUrl: null,
      loginMethod: null,
      status: "blocked",
      approvalNote: "회원 탈퇴",
      notifyPost: false,
      notifyMarketing: false,
    })
    .where(eq(users.id, userId));

  return { avatarImageUrl };
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/**
 * 승인 대기 중인 가입 신청 목록. 오래 기다린 사람이 위로 오도록 가입 순으로 정렬한다.
 */
export async function getPendingUsers(limit: number = 100) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      loginMethod: users.loginMethod,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.status, "pending"))
    .orderBy(asc(users.createdAt))
    .limit(limit);
}

/** 승인 대기 인원 수 — 관리자 탭의 뱃지에 쓴다. */
export async function countPendingUsers(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(eq(users.status, "pending"));
  return Number(row?.count ?? 0);
}

/**
 * 가입 승인/거절. 거절은 계정을 지우지 않고 blocked로 남긴다 — 같은 이메일로
 * 곧바로 재가입해 승인 대기열을 다시 채우는 것을 막고, 누가 왜 거절됐는지 기록이 남는다.
 */
export async function setUserApproval(
  userId: number,
  status: "active" | "blocked",
  note?: string | null
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .update(users)
    .set({ status, approvalNote: note ?? null })
    .where(eq(users.id, userId));
}

export async function updateUserRole(id: number, role: 'user' | 'admin') {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(users).set({ role }).where(eq(users.id, id));
}

export async function updateUserStatus(id: number, status: 'active' | 'blocked') {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(users).set({ status }).where(eq(users.id, id));
}


export async function updateUserName(id: number, name: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(users).set({ name }).where(eq(users.id, id));
}

/** avatarEmoji가 null이면 기본(이니셜) 아바타로 되돌린다. 이모지와 사진은 동시에 쓰지 않으므로 사진은 지운다. */
export async function updateUserAvatar(id: number, avatarEmoji: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(users).set({ avatarEmoji, avatarImageUrl: null }).where(eq(users.id, id));
}

/** avatarImageUrl이 null이면 사진을 지운다. 사진을 설정할 땐 이모지 선택을 함께 지운다(사진이 우선). */
export async function updateUserAvatarImage(id: number, avatarImageUrl: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const set = avatarImageUrl ? { avatarImageUrl, avatarEmoji: null } : { avatarImageUrl: null };
  return db.update(users).set(set).where(eq(users.id, id));
}

/** newPasswordHash는 이미 bcrypt로 해시된 값이어야 한다 (라우터에서 해시 후 호출). */
export async function updateUserPasswordHash(id: number, newPasswordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(users).set({ passwordHash: newPasswordHash }).where(eq(users.id, id));
}


// ============ 사용자 검색 ============
export async function searchUsers(query: string, excludeUserId: number, limit: number = 20) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const q = `%${query}%`;
  return db
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
      status: users.status,
    })
    .from(users)
    .where(
      and(
        like(users.name, q),
        sql`${users.id} <> ${excludeUserId}`,
        eq(users.status, "active")
      )
    )
    .orderBy(asc(users.name))
    .limit(limit);
}

// ============ 채팅: 대화 ============
/** 두 사용자 간 대화를 가져오거나 없으면 생성한다. */
export async function getOrCreateConversation(userId1: number, userId2: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const userAId = Math.min(userId1, userId2);
  const userBId = Math.max(userId1, userId2);

  const existing = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.userAId, userAId), eq(conversations.userBId, userBId)))
    .limit(1);
  if (existing.length > 0) return existing[0];

  try {
    await db.insert(conversations).values({ userAId, userBId });
  } catch (err) {
    // unique 제약 충돌(동시 생성)만 무시하고 아래에서 재조회한다.
    // 그 외 DB 오류는 그대로 throw하여 호출자가 인지하도록 한다.
    const code = (err as { code?: string } | null)?.code;
    const message = err instanceof Error ? err.message : String(err);
    const isDuplicate =
      code === "ER_DUP_ENTRY" ||
      /duplicate entry/i.test(message) ||
      /conversations_pair_unique/i.test(message);
    if (!isDuplicate) throw err;
  }
  const created = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.userAId, userAId), eq(conversations.userBId, userBId)))
    .limit(1);
  if (!created[0]) {
    throw new Error("Failed to create or retrieve conversation");
  }
  return created[0];
}

/** 특정 사용자가 참여한 대화 목록 (상대방 정보 + 최근 메시지 포함) */
export async function getConversationsForUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select()
    .from(conversations)
    .where(or(eq(conversations.userAId, userId), eq(conversations.userBId, userId)))
    .orderBy(desc(conversations.lastMessageAt));

  // 상대방 정보 채우기
  const result = [];
  for (const conv of rows) {
    const otherId = conv.userAId === userId ? conv.userBId : conv.userAId;
    const other = await db
      .select({ id: users.id, name: users.name, avatarEmoji: users.avatarEmoji, avatarImageUrl: users.avatarImageUrl })
      .from(users)
      .where(eq(users.id, otherId))
      .limit(1);
    // 읽지 않은 메시지 수 (상대가 보낸 것 중 미읽음)
    const unread = await db
      .select({ c: sql<number>`count(*)` })
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conv.id),
          eq(messages.isRead, false),
          sql`${messages.senderId} <> ${userId}`
        )
      );
    result.push({
      id: conv.id,
      otherUserId: otherId,
      otherUserName: other[0]?.name ?? "알 수 없음",
      otherUserAvatarEmoji: other[0]?.avatarEmoji ?? null,
      otherUserAvatarImageUrl: other[0]?.avatarImageUrl ?? null,
      lastMessage: conv.lastMessage,
      lastMessageAt: conv.lastMessageAt,
      unreadCount: Number(unread[0]?.c ?? 0),
    });
  }
  return result;
}

/** 대화 단건 조회 (권한 확인용) */
export async function getConversationById(conversationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  return result[0] ?? null;
}

// ============ 채팅: 메시지 ============
export async function getMessages(conversationId: number, limit: number = 100) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt))
    .limit(limit);
}

export async function createMessage(conversationId: number, senderId: number, content: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(messages).values({ conversationId, senderId, content });
  // 대화의 마지막 메시지 갱신
  await db
    .update(conversations)
    .set({ lastMessage: content.slice(0, 200), lastMessageAt: new Date() })
    .where(eq(conversations.id, conversationId));
  const created = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.id))
    .limit(1);
  return created[0];
}

/** 상대가 보낸 메시지를 읽음 처리 */
export async function markMessagesRead(conversationId: number, readerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .update(messages)
    .set({ isRead: true })
    .where(
      and(
        eq(messages.conversationId, conversationId),
        sql`${messages.senderId} <> ${readerId}`,
        eq(messages.isRead, false)
      )
    );
}

/** 사용자의 전체 미읽음 메시지 수 */
export async function getTotalUnreadCount(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const convs = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(or(eq(conversations.userAId, userId), eq(conversations.userBId, userId)));
  if (convs.length === 0) return 0;
  const ids = convs.map((c) => c.id);
  const res = await db
    .select({ c: sql<number>`count(*)` })
    .from(messages)
    .where(
      and(
        inArray(messages.conversationId, ids),
        eq(messages.isRead, false),
        sql`${messages.senderId} <> ${userId}`
      )
    );
  return Number(res[0]?.c ?? 0);
}
