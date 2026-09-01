import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, bigint, unique, json } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** 앱 내에서 사용할 이름. "학번 이름" 형식 (예: "20223 조은후"). */
  name: text("name"),
  /** 로그인 식별자. 이메일/비밀번호 로그인 시 필수, 소셜 로그인은 제공되면 저장. */
  email: varchar("email", { length: 320 }).unique(),
  /** 이메일/비밀번호 로그인 사용자만 값이 있음 (bcrypt 해시). 소셜 로그인 전용 계정은 null. */
  passwordHash: varchar("passwordHash", { length: 255 }),
  /** 가장 최근에 사용한 로그인 수단 (google | kakao | apple | email) — 표시용. */
  loginMethod: varchar("loginMethod", { length: 64 }),
  /** 프로필 아바타로 쓰는 이모지 한 글자. avatarImageUrl이 있으면 그쪽이 우선한다. */
  avatarEmoji: varchar("avatarEmoji", { length: 8 }),
  /** 직접 업로드한 프로필 사진 URL. 설정되어 있으면 이모지보다 우선 표시된다. */
  avatarImageUrl: varchar("avatarImageUrl", { length: 1024 }),
  /** owner("조물주")는 OWNER_EMAIL 계정에게만 자동으로 부여되는 최상위 권한. 딱 한 명뿐이고
   *  아무도(본인 포함) UI로 바꿀 수 없다 — 로그인할 때마다 이메일이 일치하는지로만 결정된다. */
  role: mysqlEnum("role", ["user", "admin", "owner"]).default("user").notNull(),
  status: mysqlEnum("status", ["active", "blocked"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * 소셜 로그인 연동 테이블
 * 한 사용자(users.id)가 구글/카카오/애플 중 여러 수단으로 로그인할 수 있도록
 * provider + providerUserId 조합을 사용자에게 연결한다.
 */
export const authIdentities = mysqlTable("authIdentities", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  provider: mysqlEnum("provider", ["google", "kakao", "apple"]).notNull(),
  /** 해당 제공자가 발급한 고유 사용자 ID (예: 구글 sub, 카카오 id, 애플 sub) */
  providerUserId: varchar("providerUserId", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  uniqueProviderUser: unique("authIdentities_provider_user_unique").on(table.provider, table.providerUserId),
}));

export type AuthIdentity = typeof authIdentities.$inferSelect;
export type InsertAuthIdentity = typeof authIdentities.$inferInsert;

/**
 * 게시판 테이블
 * 자유게시판, 질문게시판 등 다중 게시판을 관리
 */
export const boards = mysqlTable("boards", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  description: text("description"),
  displayOrder: int("displayOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Board = typeof boards.$inferSelect;
export type InsertBoard = typeof boards.$inferInsert;

/**
 * 게시글 테이블
 * 익명 옵션 포함
 */
export const posts = mysqlTable("posts", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  boardId: int("boardId").notNull(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  isAnonymous: boolean("isAnonymous").default(false).notNull(),
  viewCount: int("viewCount").default(0).notNull(),
  likeCount: int("likeCount").default(0).notNull(),
  commentCount: int("commentCount").default(0).notNull(),
  isNotice: boolean("isNotice").default(false).notNull(),
  /** 첨부 이미지 URL 목록 (최대 4장). 없으면 빈 배열. */
  images: json("images").$type<string[]>().default([]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp("deletedAt"),
});

export type Post = typeof posts.$inferSelect;
export type InsertPost = typeof posts.$inferInsert;

/**
 * 댓글 테이블
 * 익명 옵션 포함, 대댓글 지원 (parentCommentId)
 */
export const comments = mysqlTable("comments", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  postId: bigint("postId", { mode: "number" }).notNull(),
  userId: int("userId").notNull(),
  parentCommentId: bigint("parentCommentId", { mode: "number" }),
  content: text("content").notNull(),
  isAnonymous: boolean("isAnonymous").default(false).notNull(),
  likeCount: int("likeCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp("deletedAt"),
});

export type Comment = typeof comments.$inferSelect;
export type InsertComment = typeof comments.$inferInsert;

/**
 * 게시글 추천(좋아요) 테이블
 */
export const postLikes = mysqlTable("postLikes", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  postId: bigint("postId", { mode: "number" }).notNull(),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  // 동시에 두 번 누르는 등의 레이스 컨디션으로 좋아요가 중복 저장되면
  // likeCount가 실제 행 수와 어긋나 버튼이 안 눌리는 것처럼 보이는 버그로
  // 이어진다. DB 레벨에서 아예 중복을 막는다.
  uniqueLike: unique("postLikes_post_user_unique").on(table.postId, table.userId),
}));

export type PostLike = typeof postLikes.$inferSelect;
export type InsertPostLike = typeof postLikes.$inferInsert;

/**
 * 댓글 추천(좋아요) 테이블
 */
export const commentLikes = mysqlTable("commentLikes", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  commentId: bigint("commentId", { mode: "number" }).notNull(),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  uniqueLike: unique("commentLikes_comment_user_unique").on(table.commentId, table.userId),
}));

export type CommentLike = typeof commentLikes.$inferSelect;
export type InsertCommentLike = typeof commentLikes.$inferInsert;

/**
 * 신고 테이블
 * 게시글 및 댓글 신고 관리
 */
export const reports = mysqlTable("reports", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  reporterUserId: int("reporterUserId").notNull(),
  targetType: mysqlEnum("targetType", ["post", "comment"]).notNull(),
  targetId: bigint("targetId", { mode: "number" }).notNull(),
  reason: varchar("reason", { length: 255 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["pending", "resolved", "dismissed"]).default("pending").notNull(),
  adminNotes: text("adminNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Report = typeof reports.$inferSelect;
export type InsertReport = typeof reports.$inferInsert;

/**
 * 공지사항 테이블
 */
export const announcements = mysqlTable("announcements", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  createdBy: int("createdBy").notNull(),
  displayOrder: int("displayOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Announcement = typeof announcements.$inferSelect;
export type InsertAnnouncement = typeof announcements.$inferInsert;

/**
 * 오늘의 중요 뉴스 테이블 (관리자 큐레이션)
 * 홈 화면 공지사항과 게시판 사이에 노출된다.
 */
export const news = mysqlTable("news", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content"),
  /** 외부 원문 링크 (선택) */
  url: varchar("url", { length: 1000 }),
  createdBy: int("createdBy").notNull(),
  displayOrder: int("displayOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type News = typeof news.$inferSelect;
export type InsertNews = typeof news.$inferInsert;

/**
 * 문의함: 학생이 관리자에게 보내는 문의/건의.
 * 관리자 패널에서 확인 후 답변을 남기면 status가 answered로 바뀐다.
 */
export const inquiries = mysqlTable("inquiries", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  category: mysqlEnum("category", ["general", "bug", "suggestion", "report_abuse", "account"]).default("general").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  status: mysqlEnum("status", ["pending", "answered"]).default("pending").notNull(),
  adminReply: text("adminReply"),
  repliedBy: int("repliedBy"),
  repliedAt: timestamp("repliedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export const inquiriesRelations = relations(inquiries, ({ one }) => ({
  user: one(users, {
    fields: [inquiries.userId],
    references: [users.id],
  }),
}));
export type Inquiry = typeof inquiries.$inferSelect;
export type InsertInquiry = typeof inquiries.$inferInsert;

/**
 * 1:1 개인 채팅 대화 테이블
 * 두 사용자 간의 대화를 나타낸다. userAId < userBId 규칙으로 중복 방지.
 */
export const conversations = mysqlTable("conversations", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  /** 항상 작은 쪽 userId를 저장 (중복 대화 방지용) */
  userAId: int("userAId").notNull(),
  /** 항상 큰 쪽 userId를 저장 */
  userBId: int("userBId").notNull(),
  /** 마지막 메시지 미리보기 */
  lastMessage: text("lastMessage"),
  lastMessageAt: timestamp("lastMessageAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  uniquePair: unique("conversations_pair_unique").on(table.userAId, table.userBId),
}));

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = typeof conversations.$inferInsert;

/**
 * 개인 채팅 메시지 테이블
 */
export const messages = mysqlTable("messages", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  conversationId: bigint("conversationId", { mode: "number" }).notNull(),
  senderId: int("senderId").notNull(),
  content: text("content").notNull(),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

/**
 * Relations
 */
export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
  comments: many(comments),
  postLikes: many(postLikes),
  commentLikes: many(commentLikes),
  reports: many(reports),
  authIdentities: many(authIdentities),
}));

export const authIdentitiesRelations = relations(authIdentities, ({ one }) => ({
  user: one(users, {
    fields: [authIdentities.userId],
    references: [users.id],
  }),
}));

export const boardsRelations = relations(boards, ({ many }) => ({
  posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  board: one(boards, {
    fields: [posts.boardId],
    references: [boards.id],
  }),
  user: one(users, {
    fields: [posts.userId],
    references: [users.id],
  }),
  comments: many(comments),
  likes: many(postLikes),
}));

export const commentsRelations = relations(comments, ({ one, many }) => ({
  post: one(posts, {
    fields: [comments.postId],
    references: [posts.id],
  }),
  user: one(users, {
    fields: [comments.userId],
    references: [users.id],
  }),
  parentComment: one(comments, {
    fields: [comments.parentCommentId],
    references: [comments.id],
  }),
  replies: many(comments),
  likes: many(commentLikes),
}));

export const postLikesRelations = relations(postLikes, ({ one }) => ({
  post: one(posts, {
    fields: [postLikes.postId],
    references: [posts.id],
  }),
  user: one(users, {
    fields: [postLikes.userId],
    references: [users.id],
  }),
}));

export const commentLikesRelations = relations(commentLikes, ({ one }) => ({
  comment: one(comments, {
    fields: [commentLikes.commentId],
    references: [comments.id],
  }),
  user: one(users, {
    fields: [commentLikes.userId],
    references: [users.id],
  }),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  reporter: one(users, {
    fields: [reports.reporterUserId],
    references: [users.id],
  }),
}));

export const announcementsRelations = relations(announcements, ({ one }) => ({
  creator: one(users, {
    fields: [announcements.createdBy],
    references: [users.id],
  }),
}));
