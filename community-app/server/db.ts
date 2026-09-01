import { eq, and, or, like, isNull, desc, asc, sql, inArray, gt, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import path from "node:path";
import { InsertUser, users, authIdentities, boards, posts, comments, postLikes, commentLikes, reports, announcements, news, inquiries, conversations, messages } from "../drizzle/schema";
import { ENV } from './_core/env';

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
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const role = isOwnerEmail(data.email) ? "admin" : "user";

  const [result] = await db.insert(users).values({
    email: data.email.toLowerCase(),
    passwordHash: data.passwordHash,
    name: data.name,
    loginMethod: "email",
    role,
    lastSignedIn: new Date(),
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
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const role = isOwnerEmail(data.email) ? "admin" : "user";

  const [result] = await db.insert(users).values({
    email: data.email ? data.email.toLowerCase() : null,
    name: data.name,
    loginMethod: data.provider,
    role,
    lastSignedIn: new Date(),
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
  const shouldPromote = existing && existing.role !== "admin" && isOwnerEmail(existing.email);

  await db
    .update(users)
    .set({
      lastSignedIn: new Date(),
      ...(loginMethod ? { loginMethod } : {}),
      ...(shouldPromote ? { role: "admin" as const } : {}),
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

export async function updateBoard(id: number, data: Partial<{ name: string; description: string; displayOrder: number; isActive: boolean }>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(boards).set(data).where(eq(boards.id, id));
}

export async function deleteBoard(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(boards).where(eq(boards.id, id));
}

/**
 * 게시글/댓글 목록에 작성자 이름·아바타를 붙여준다. 익명 글은 서버에서부터
 * 작성자 정보를 null로 지워서, 응답 페이로드 자체에 익명 작성자 신원이
 * 노출되지 않도록 한다 (프론트에서 숨기는 게 아니라 애초에 안 보낸다).
 */
async function attachAuthors<T extends { userId: number; isAnonymous: boolean }>(
  rows: T[]
): Promise<(T & { authorName: string | null; authorAvatarEmoji: string | null; authorAvatarImageUrl: string | null })[]> {
  if (rows.length === 0) return [];
  const db = await getDb();
  if (!db) return rows.map((r) => ({ ...r, authorName: null, authorAvatarEmoji: null, authorAvatarImageUrl: null }));

  const ids = Array.from(new Set(rows.map((r) => r.userId)));
  const authors = await db
    .select({ id: users.id, name: users.name, avatarEmoji: users.avatarEmoji, avatarImageUrl: users.avatarImageUrl })
    .from(users)
    .where(inArray(users.id, ids));
  const authorMap = new Map(authors.map((a) => [a.id, a]));

  return rows.map((row) => {
    if (row.isAnonymous) return { ...row, authorName: null, authorAvatarEmoji: null, authorAvatarImageUrl: null };
    const author = authorMap.get(row.userId);
    return {
      ...row,
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
export async function getPostsByBoard(boardId: number, limit: number = 20, offset: number = 0, sortBy: 'latest' | 'popular' = 'latest', search?: string) {
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
  return attachAuthors(rows.map(normalizePostImages));
}

export async function getPostById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  if (result.length === 0) return undefined;
  const [withAuthor] = await attachAuthors(result.map(normalizePostImages));
  return withAuthor;
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
export async function searchPosts(query: string, limit: number = 20, offset: number = 0) {
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
  return attachAuthors(rows.map(normalizePostImages));
}

/**
 * 댓글 관련 쿼리
 */
export async function getCommentsByPost(postId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(comments)
    .where(and(eq(comments.postId, postId), isNull(comments.deletedAt)))
    .orderBy(asc(comments.createdAt));
  return attachAuthors(rows);
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

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
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
      .select({ id: users.id, name: users.name })
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
