import { COOKIE_NAME, ONE_YEAR_MS, AVATAR_EMOJI_OPTIONS, WITHDRAW_CONFIRM_TEXT } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure, approvedProcedure } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { hashPassword, verifyPassword } from "./_core/auth/password";
import { createSessionToken, verifyPendingSignupToken } from "./_core/auth/session";
import { deleteUploadByUrl, deleteUploadsByUrl, putUpload, uploadScopeId } from "./media";
import { checkContent, BLOCKED_MESSAGE } from "./_core/moderation";
import { enforceRateLimit } from "./_core/rateLimit";
import { describeStorage } from "./_core/storageHealth";

const STUDENT_NAME_REGEX = /^\d{5} .+$/;
const STUDENT_NAME_MESSAGE = "학번(5자리) 이름 형식으로 입력해주세요 (예: 20223 조은후)";

const IMAGE_DATA_URL_REGEX = /^data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=]+)$/;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

// 소문자/숫자/하이픈만 허용 (슬래시가 섞이면 /board/:slug 라우팅이 깨진다)
const boardSlugSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "슬러그는 영문 소문자, 숫자, 하이픈(-)만 사용할 수 있어요 (예: free-board)");

/** "data:image/png;base64,...." 형식의 문자열을 검증하고 오브젝트 스토리지에 올린 뒤 공개 URL을 돌려준다. */
async function uploadImageDataUrl(dataUrl: string, keyPrefix: string): Promise<string> {
  const match = dataUrl.match(IMAGE_DATA_URL_REGEX);
  if (!match) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "지원하지 않는 이미지 형식입니다 (PNG/JPEG/WEBP/GIF만 가능)" });
  }
  const [, ext, base64] = match;
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "이미지는 8MB 이하만 업로드할 수 있어요" });
  }
  try {
    const { url } = await putUpload(`${keyPrefix}/${Date.now()}.${ext}`, buffer, `image/${ext}`);
    return url;
  } catch (error) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "이미지 업로드에 실패했습니다. 잠시 후 다시 시도해주세요",
      cause: error,
    });
  }
}

function issueSession(ctx: { req: any; res: any }, sessionToken: string) {
  const cookieOptions = getSessionCookieOptions(ctx.req);
  ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
}

/**
 * 자동 필터가 막은 작성 시도를 기록한다. 어떤 표현이 자주 시도되는지 관리자가
 * 파악해 금지어를 보강하기 위한 것으로, 기록 실패가 응답을 막으면 안 되므로
 * 오류는 로그만 남기고 삼킨다.
 */
async function logBlockedAttempt(data: {
  userId: number;
  targetType: 'post' | 'comment';
  boardId?: number;
  content: string;
  reason: string;
}) {
  try {
    await db.createModerationLog(data);
  } catch (error) {
    console.warn('[Moderation] 차단 기록 저장 실패:', error);
  }
}

/**
 * 내 글에 달린 활동(댓글/좋아요)을 글쓴이에게 알린다.
 * - 글쓴이가 활동 알림(notifyPost)에 동의한 경우에만 쌓는다.
 * - 자기 글에 자기가 단 댓글/좋아요는 알리지 않는다.
 * - 알림 생성 실패가 댓글/좋아요 자체를 막으면 안 되므로 오류는 로그만 남긴다.
 */
async function notifyPostActivity(params: {
  postAuthorId: number;
  actorId: number;
  type: 'post_comment' | 'post_like';
  postId: number;
  postTitle: string;
}) {
  const { postAuthorId, actorId, type, postId, postTitle } = params;
  if (postAuthorId === actorId) return;
  try {
    if (!(await db.hasPostNotifyConsent(postAuthorId))) return;
    await db.createNotification({
      userId: postAuthorId,
      type,
      title: type === 'post_comment' ? '내 글에 새 댓글이 달렸어요' : '내 글이 추천을 받았어요',
      body: postTitle,
      linkUrl: `/post/${postId}`,
    });
  } catch (error) {
    console.warn('[Notification] 활동 알림 생성 실패:', error);
  }
}

/** owner는 admin의 상위 권한이므로 관리자 판정에 항상 포함한다. */
function isAdminRole(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'owner';
}

// Admin procedure - only admin users can access
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin' && ctx.user.role !== 'owner') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return next({ ctx });
});

/**
 * 조물주(owner) 전용. 일반 admin에게도 열면 안 되는 동작에만 쓴다.
 * 현재는 익명 작성자 신원 조회 하나뿐이다 — 익명 게시판의 익명성은 운영진 다수가
 * 들여다볼 수 있는 순간 사실상 사라지므로, 최상위 권한 한 명으로 제한한다.
 */
const ownerProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'owner') {
    throw new TRPCError({ code: 'FORBIDDEN', message: '조물주만 사용할 수 있는 기능입니다' });
  }
  return next({ ctx });
});

/**
 * 클라이언트로 내보내는 사용자 정보.
 *
 * ctx.user는 users 행 전체라서 그대로 돌려주면 비밀번호 해시까지 브라우저로 나간다.
 * 해시는 클라이언트가 쓸 일이 전혀 없고, 유출되면 오프라인 대입 공격의 재료가 되므로
 * 응답에서 지운다. 대신 UI가 필요로 하는 "비밀번호가 설정된 계정인가"만 불리언으로 준다
 * (소셜 전용 계정은 현재 비밀번호 입력을 요구하지 않아야 하므로 이 구분이 필요하다).
 */
function toPublicUser<T extends { passwordHash: string | null }>(user: T) {
  const { passwordHash, ...rest } = user;
  return { ...rest, hasPassword: Boolean(passwordHash) };
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => (opts.ctx.user ? toPublicUser(opts.ctx.user) : null)),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),

    /** 이메일/비밀번호 회원가입 */
    signup: publicProcedure
      .input(z.object({
        email: z.string().email('올바른 이메일 형식이 아닙니다'),
        password: z.string().min(4, '비밀번호는 최소 4자 이상이어야 합니다'),
        name: z.string().regex(STUDENT_NAME_REGEX, STUDENT_NAME_MESSAGE),
        // 둘 다 선택 동의 — 미동의여도 가입이 되어야 하므로 기본값 false
        notifyPost: z.boolean().default(false),
        notifyMarketing: z.boolean().default(false),
      }))
      .mutation(async ({ input, ctx }) => {
        const existing = await db.getUserByEmail(input.email);
        if (existing) {
          throw new TRPCError({ code: 'CONFLICT', message: '이미 가입된 이메일입니다' });
        }
        const passwordHash = await hashPassword(input.password);
        const user = await db.createUserWithPassword({
          email: input.email,
          passwordHash,
          name: input.name,
          notifyPost: input.notifyPost,
          notifyMarketing: input.notifyMarketing,
        });
        if (!user) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '회원가입에 실패했습니다' });
        }
        const sessionToken = await createSessionToken(user.id);
        issueSession(ctx, sessionToken);
        return toPublicUser(user);
      }),

    /** 이메일/비밀번호 로그인 */
    login: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await db.getUserByEmail(input.email);
        if (!user || !user.passwordHash) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: '이메일 또는 비밀번호가 올바르지 않습니다' });
        }
        const valid = await verifyPassword(input.password, user.passwordHash);
        if (!valid) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: '이메일 또는 비밀번호가 올바르지 않습니다' });
        }
        if (user.status === 'blocked') {
          // 가입 거절로 막힌 계정이면 관리자가 남긴 사유를 함께 보여준다.
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: user.approvalNote
              ? `이용이 제한된 계정입니다 (사유: ${user.approvalNote})`
              : '이용이 제한된 계정입니다',
          });
        }
        await db.touchLastSignedIn(user.id, 'email');
        const sessionToken = await createSessionToken(user.id);
        issueSession(ctx, sessionToken);
        return toPublicUser(user);
      }),

    /** 소셜 로그인 최초 사용자가 학번+이름을 입력해 가입을 완료 */
    completeOAuthSignup: publicProcedure
      .input(z.object({
        token: z.string(),
        name: z.string().regex(STUDENT_NAME_REGEX, STUDENT_NAME_MESSAGE),
        notifyPost: z.boolean().default(false),
        notifyMarketing: z.boolean().default(false),
      }))
      .mutation(async ({ input, ctx }) => {
        let pending;
        try {
          pending = await verifyPendingSignupToken(input.token);
        } catch {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '로그인 시간이 만료되었습니다. 다시 시도해주세요' });
        }

        const alreadyLinked = await db.getAuthIdentity(pending.provider, pending.providerUserId);
        if (alreadyLinked) {
          // 동시에 두 번 완료 요청이 온 경우: 그냥 로그인 처리
          await db.touchLastSignedIn(alreadyLinked.userId, pending.provider);
          const sessionToken = await createSessionToken(alreadyLinked.userId);
          issueSession(ctx, sessionToken);
          const linkedUser = await db.getUserById(alreadyLinked.userId);
          return linkedUser ? toPublicUser(linkedUser) : null;
        }

        const user = await db.createUserFromOAuth({
          provider: pending.provider,
          providerUserId: pending.providerUserId,
          email: pending.email,
          name: input.name,
          notifyPost: input.notifyPost,
          notifyMarketing: input.notifyMarketing,
        });
        if (!user) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '회원가입에 실패했습니다' });
        }
        const sessionToken = await createSessionToken(user.id);
        issueSession(ctx, sessionToken);
        return toPublicUser(user);
      }),

    updateName: protectedProcedure
      .input(z.object({
        name: z.string().regex(STUDENT_NAME_REGEX, STUDENT_NAME_MESSAGE),
      }))
      .mutation(async ({ input, ctx }) => {
        return db.updateUserName(ctx.user.id, input.name);
      }),

    updateAvatar: protectedProcedure
      .input(z.object({
        avatarEmoji: z.enum(AVATAR_EMOJI_OPTIONS).nullable(),
      }))
      .mutation(async ({ input, ctx }) => {
        return db.updateUserAvatar(ctx.user.id, input.avatarEmoji);
      }),

    /** 프로필 사진을 직접 업로드한다. 설정되면 이모지 아바타보다 우선 표시된다. */
    updateAvatarPhoto: protectedProcedure
      .input(z.object({ dataUrl: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const previousUrl = ctx.user.avatarImageUrl;
        const url = await uploadImageDataUrl(input.dataUrl, `avatars/${uploadScopeId(ctx.user.id)}`);
        const result = await db.updateUserAvatarImage(ctx.user.id, url);
        // 새 사진이 자리를 잡은 뒤에 이전 파일을 지운다(실패해도 교체는 이미 끝났다).
        await deleteUploadByUrl(previousUrl);
        return result;
      }),

    /** 알림 수신 동의를 켜고 끈다. 동의 시각은 db 레이어에서 함께 기록된다. */
    updateNotificationPrefs: protectedProcedure
      .input(z.object({
        notifyPost: z.boolean().optional(),
        notifyMarketing: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.updateNotificationPrefs(ctx.user.id, input);
        return { success: true };
      }),

    /** 프로필 사진을 지우고 이모지/이니셜 기본 아바타로 되돌린다. */
    removeAvatarPhoto: protectedProcedure.mutation(async ({ ctx }) => {
      const previousUrl = ctx.user.avatarImageUrl;
      const result = await db.updateUserAvatarImage(ctx.user.id, null);
      await deleteUploadByUrl(previousUrl);
      return result;
    }),

    /**
     * 회원 탈퇴. 승인 대기 상태에서도 할 수 있어야 하므로 protectedProcedure를 쓴다.
     *
     * 확인 문구를 정확히 입력해야만 진행되게 해서, 실수로 눌러 되돌릴 수 없는 상태가
     * 되는 것을 막는다.
     */
    withdraw: protectedProcedure
      .input(z.object({
        confirm: z.literal(WITHDRAW_CONFIRM_TEXT),
        /** 내가 쓴 글·댓글도 함께 지울지. 기본값은 남기기 — 대화 맥락이 끊기지 않게. */
        deleteContent: z.boolean().default(false),
      }))
      .mutation(async ({ input, ctx }) => {
        // 조물주가 탈퇴하면 아무도 가입 승인을 할 수 없게 되어 서비스가 잠긴다.
        if (ctx.user.role === 'owner') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '조물주 계정은 탈퇴할 수 없습니다' });
        }

        // 계정 정보를 지우기 전에 글부터 처리한다 — userId로 찾아야 하기 때문이다.
        if (input.deleteContent) {
          const { imageUrls } = await db.softDeleteUserContent(ctx.user.id);
          await deleteUploadsByUrl(imageUrls);
        }

        const { avatarImageUrl } = await db.withdrawUser(ctx.user.id);
        await deleteUploadByUrl(avatarImageUrl);

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
        return { success: true } as const;
      }),

    updatePassword: protectedProcedure
      .input(z.object({
        currentPassword: z.string().optional(),
        newPassword: z.string().min(4, '비밀번호는 최소 4자 이상이어야 합니다'),
      }))
      .mutation(async ({ input, ctx }) => {
        const currentUser = await db.getUserById(ctx.user.id);
        if (currentUser?.passwordHash) {
          if (!input.currentPassword) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: '현재 비밀번호를 입력해주세요' });
          }
          const valid = await verifyPassword(input.currentPassword, currentUser.passwordHash);
          if (!valid) {
            throw new TRPCError({ code: 'UNAUTHORIZED', message: '현재 비밀번호가 올바르지 않습니다' });
          }
        }
        const newHash = await hashPassword(input.newPassword);
        return db.updateUserPasswordHash(ctx.user.id, newHash);
      }),
  }),

  // 게시판 관련 API
  boards: router({
    list: publicProcedure.query(async () => {
      return db.getBoards();
    }),

    /** 홈 화면용 — 게시판과 각 게시판의 최신 글을 한 번에 받아 요청 수를 줄인다. */
    listWithLatest: publicProcedure.query(async () => {
      return db.getBoardsWithLatestPost();
    }),

    create: adminProcedure
      .input(z.object({
        name: z.string().min(1).max(100),
        slug: boardSlugSchema,
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createBoard(input);
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(100).optional(),
        slug: boardSlugSchema.optional(),
        description: z.string().optional(),
        displayOrder: z.number().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateBoard(id, data);
      }),
    
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.deleteBoard(input.id);
      }),
  }),

  // 게시글 관련 API
  posts: router({
    listByBoard: publicProcedure
      .input(z.object({
        boardId: z.number(),
        limit: z.number().default(20),
        offset: z.number().default(0),
        sortBy: z.enum(['latest', 'popular']).default('latest'),
        search: z.string().optional(),
      }))
      .query(async ({ input, ctx }) => {
        return db.getPostsByBoard(input.boardId, input.limit, input.offset, input.sortBy, input.search, ctx.user?.id ?? null);
      }),
    
    /**
     * 홈 화면 추천 목록. 로그인 여부에 따라 개인화가 자동으로 켜지고 꺼지므로
     * publicProcedure로 두고 ctx.user만 넘긴다 (비로그인은 인기글로 계산된다).
     */
    recommended: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(10).default(5) }).optional())
      .query(async ({ input, ctx }) => {
        return db.getRecommendedPosts(ctx.user?.id ?? null, input?.limit ?? 5);
      }),

    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const post = await db.getPostById(input.id, ctx.user?.id ?? null);
        if (!post) throw new TRPCError({ code: 'NOT_FOUND' });
        
        // Increment view count
        await db.incrementPostViewCount(input.id);
        
        return post;
      }),
    
    create: approvedProcedure
      .input(z.object({
        boardId: z.number(),
        title: z.string().min(1).max(255),
        content: z.string().min(1),
        isAnonymous: z.boolean().default(false),
        images: z.array(z.string().url()).max(4).default([]),
      }))
      .mutation(async ({ input, ctx }) => {
        enforceRateLimit('post', ctx.user.id);
        const verdict = await checkContent(`${input.title}\n${input.content}`);
        if (verdict.blocked) {
          await logBlockedAttempt({
            userId: ctx.user.id,
            targetType: 'post',
            boardId: input.boardId,
            content: `${input.title}\n${input.content}`,
            reason: verdict.reason ?? 'unknown',
          });
          throw new TRPCError({ code: 'BAD_REQUEST', message: BLOCKED_MESSAGE });
        }

        return db.createPost({
          boardId: input.boardId,
          userId: ctx.user.id,
          title: input.title,
          content: input.content,
          isAnonymous: input.isAnonymous,
          images: input.images,
        });
      }),

    update: approvedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().min(1).max(255).optional(),
        content: z.string().min(1).optional(),
        images: z.array(z.string().url()).max(4).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const post = await db.getPostById(input.id);
        if (!post) throw new TRPCError({ code: 'NOT_FOUND' });
        // 익명 글은 응답에서 userId가 지워지므로 원본 작성자를 내부 조회로 확인한다.
        const authorId = await db.getPostAuthorId(input.id);
        if (authorId !== ctx.user.id && !isAdminRole(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        
        const { id, ...data } = input;
        return db.updatePost(id, data);
      }),
    
    delete: approvedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const post = await db.getPostById(input.id);
        if (!post) throw new TRPCError({ code: 'NOT_FOUND' });
        const authorId = await db.getPostAuthorId(input.id);
        if (authorId !== ctx.user.id && !isAdminRole(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }

        const result = await db.deletePost(input.id);
        // 글이 지워지면 첨부 이미지도 저장소에서 정리한다.
        await deleteUploadsByUrl(post.images ?? []);
        return result;
      }),
    
    search: publicProcedure
      .input(z.object({
        query: z.string().min(1),
        limit: z.number().default(20),
        offset: z.number().default(0),
      }))
      .query(async ({ input, ctx }) => {
        return db.searchPosts(input.query, input.limit, input.offset, ctx.user?.id ?? null);
      }),
  }),

  // 댓글 관련 API
  comments: router({
    listByPost: publicProcedure
      .input(z.object({ postId: z.number() }))
      .query(async ({ input, ctx }) => {
        return db.getCommentsByPost(input.postId, ctx.user?.id ?? null);
      }),
    
    create: approvedProcedure
      .input(z.object({
        postId: z.number(),
        content: z.string().min(1),
        isAnonymous: z.boolean().default(false),
        parentCommentId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        enforceRateLimit('comment', ctx.user.id);
        const verdict = await checkContent(input.content);
        if (verdict.blocked) {
          await logBlockedAttempt({
            userId: ctx.user.id,
            targetType: 'comment',
            content: input.content,
            reason: verdict.reason ?? 'unknown',
          });
          throw new TRPCError({ code: 'BAD_REQUEST', message: BLOCKED_MESSAGE });
        }

        const created = await db.createComment({
          postId: input.postId,
          userId: ctx.user.id,
          content: input.content,
          isAnonymous: input.isAnonymous,
          parentCommentId: input.parentCommentId,
        });

        // 익명 글은 응답에서 userId가 지워지므로 작성자를 내부 조회로 따로 읽는다.
        const post = await db.getPostById(input.postId);
        const postAuthorId = await db.getPostAuthorId(input.postId);
        if (post && postAuthorId !== null) {
          await notifyPostActivity({
            postAuthorId,
            actorId: ctx.user.id,
            type: 'post_comment',
            postId: post.id,
            postTitle: post.title,
          });
        }
        return created;
      }),
    
    delete: approvedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const comment = await db.getCommentById(input.id);
        if (!comment) throw new TRPCError({ code: 'NOT_FOUND' });
        if (comment.userId !== ctx.user.id && !isAdminRole(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        
        return db.deleteComment(input.id);
      }),
  }),

  // 추천(좋아요) 관련 API
  likes: router({
    togglePostLike: approvedProcedure
      .input(z.object({ postId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const hasLiked = await db.hasUserLikedPost(input.postId, ctx.user.id);
        
        if (hasLiked) {
          await db.removePostLike(input.postId, ctx.user.id);
          return { liked: false };
        }

        await db.addPostLike(input.postId, ctx.user.id);
        // 좋아요를 취소했다 다시 누르면 알림이 반복될 수 있지만, 알림함에서
        // 최신순으로 묶여 보이는 정도라 별도 중복 억제는 두지 않았다.
        // 익명 글은 응답에서 userId가 지워지므로 작성자를 내부 조회로 따로 읽는다.
        const post = await db.getPostById(input.postId);
        const postAuthorId = await db.getPostAuthorId(input.postId);
        if (post && postAuthorId !== null) {
          await notifyPostActivity({
            postAuthorId,
            actorId: ctx.user.id,
            type: 'post_like',
            postId: post.id,
            postTitle: post.title,
          });
        }
        return { liked: true };
      }),
    
    toggleCommentLike: approvedProcedure
      .input(z.object({ commentId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const hasLiked = await db.hasUserLikedComment(input.commentId, ctx.user.id);
        
        if (hasLiked) {
          await db.removeCommentLike(input.commentId, ctx.user.id);
          return { liked: false };
        } else {
          await db.addCommentLike(input.commentId, ctx.user.id);
          return { liked: true };
        }
      }),
    
    isPostLiked: protectedProcedure
      .input(z.object({ postId: z.number() }))
      .query(async ({ input, ctx }) => {
        return db.hasUserLikedPost(input.postId, ctx.user.id);
      }),
    
    isCommentLiked: protectedProcedure
      .input(z.object({ commentId: z.number() }))
      .query(async ({ input, ctx }) => {
        return db.hasUserLikedComment(input.commentId, ctx.user.id);
      }),
  }),

  // 신고 관련 API
  reports: router({
    create: approvedProcedure
      .input(z.object({
        targetType: z.enum(['post', 'comment']),
        targetId: z.number(),
        reason: z.string().min(1).max(255),
        description: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        enforceRateLimit('report', ctx.user.id);
        // 같은 대상을 여러 번 신고해도 관리자 목록만 길어질 뿐이라 한 번으로 제한한다.
        if (await db.hasReported(ctx.user.id, input.targetType, input.targetId)) {
          throw new TRPCError({ code: 'CONFLICT', message: '이미 신고한 게시물입니다' });
        }
        return db.createReport({
          reporterUserId: ctx.user.id,
          targetType: input.targetType,
          targetId: input.targetId,
          reason: input.reason,
          description: input.description,
        });
      }),
    
    list: adminProcedure
      .input(z.object({
        status: z.enum(['pending', 'resolved', 'dismissed']).optional(),
        limit: z.number().default(20),
        offset: z.number().default(0),
      }))
      .query(async ({ input }) => {
        return db.getReports(input.status, input.limit, input.offset);
      }),
    
    updateStatus: adminProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(['pending', 'resolved', 'dismissed']),
        adminNotes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.updateReportStatus(input.id, input.status, input.adminNotes);
      }),

    /**
     * 신고 처리 — 조치와 상태 변경을 한 번에.
     *
     * 예전에는 상태를 '해결'로 바꾸는 것밖에 못 해서, 정작 문제되는 글은 그대로 남았다.
     * 여기서 바로 삭제하거나 작성자를 차단할 수 있게 한다.
     */
    act: adminProcedure
      .input(z.object({
        id: z.number(),
        action: z.enum(['delete_content', 'block_author', 'resolve', 'dismiss']),
      }))
      .mutation(async ({ input, ctx }) => {
        const report = await db.getReportById(input.id);
        if (!report) throw new TRPCError({ code: 'NOT_FOUND', message: '신고를 찾을 수 없습니다' });

        if (input.action === 'delete_content') {
          if (report.targetType === 'post') {
            await db.deletePost(report.targetId);
          } else {
            await db.deleteComment(report.targetId);
          }
        }

        if (input.action === 'block_author') {
          // 익명 글이어도 차단은 된다. 작성자가 누구인지는 화면에 내보내지 않으므로
          // 관리자는 신원을 모른 채로 조치만 하게 된다 (익명 확인은 조물주 전용).
          const authorId = await db.getReportTargetAuthorId(report.targetType, report.targetId);
          if (!authorId) {
            throw new TRPCError({ code: 'NOT_FOUND', message: '작성자를 찾을 수 없습니다 (이미 삭제된 계정일 수 있습니다)' });
          }
          const author = await db.getUserById(authorId);
          if (!author) {
            throw new TRPCError({ code: 'NOT_FOUND', message: '작성자를 찾을 수 없습니다' });
          }
          if (author.id === ctx.user.id) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: '자기 자신은 차단할 수 없습니다' });
          }
          if (author.role === 'owner') {
            throw new TRPCError({ code: 'FORBIDDEN', message: '조물주는 차단할 수 없습니다' });
          }
          if (author.role === 'admin' && ctx.user.role !== 'owner') {
            throw new TRPCError({ code: 'FORBIDDEN', message: '다른 관리자는 조물주만 차단할 수 있습니다' });
          }
          await db.updateUserStatus(author.id, 'blocked');
        }

        const status = input.action === 'dismiss' ? 'dismissed' : 'resolved';
        await db.updateReportStatus(input.id, status);
        return { success: true, status };
      }),
  }),

  // 앱 내 알림함
  notifications: router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().default(30), offset: z.number().default(0) }))
      .query(async ({ input, ctx }) => {
        return db.getNotifications(ctx.user.id, input.limit, input.offset);
      }),

    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      return db.getUnreadNotificationCount(ctx.user.id);
    }),

    markRead: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        // userId 조건이 함께 걸려 있어 남의 알림은 읽음 처리되지 않는다
        await db.markNotificationRead(input.id, ctx.user.id);
        return { success: true };
      }),

    markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
      await db.markAllNotificationsRead(ctx.user.id);
      return { success: true };
    }),

    /** 광고성 알림 발송 — 관리자만, 그리고 수신 동의자에게만 전달된다. */
    sendMarketing: adminProcedure
      .input(z.object({
        title: z.string().min(1).max(255),
        body: z.string().max(2000).optional(),
        linkUrl: z.string().max(1024).optional(),
      }))
      .mutation(async ({ input }) => {
        const userIds = await db.getMarketingOptInUserIds();
        await db.createNotificationsForUsers(userIds, {
          type: 'marketing',
          title: input.title,
          body: input.body,
          linkUrl: input.linkUrl,
        });
        return { sentCount: userIds.length };
      }),
  }),

  // 자동 필터 차단 기록 (관리자 전용)
  moderation: router({
    listBlocked: adminProcedure
      .input(z.object({
        limit: z.number().default(50),
        offset: z.number().default(0),
      }))
      .query(async ({ input }) => {
        return db.getModerationLogs(input.limit, input.offset);
      }),
  }),

  // 공지사항 관련 API
  announcements: router({
    list: publicProcedure
      .input(z.object({ limit: z.number().default(10) }))
      .query(async ({ input }) => {
        return db.getAnnouncements(input.limit);
      }),
    
    create: adminProcedure
      .input(z.object({
        title: z.string().min(1).max(255),
        content: z.string().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        return db.createAnnouncement({
          title: input.title,
          content: input.content,
          createdBy: ctx.user.id,
        });
      }),
    
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().min(1).max(255).optional(),
        content: z.string().min(1).optional(),
        displayOrder: z.number().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateAnnouncement(id, data);
      }),
    
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.deleteAnnouncement(input.id);
      }),
  }),

  // 오늘의 중요 뉴스 관련 API
  news: router({
    list: publicProcedure
      .input(z.object({ limit: z.number().default(10) }))
      .query(async ({ input }) => {
        return db.getActiveNews(input.limit);
      }),

    listAll: adminProcedure.query(async () => {
      return db.getAllNews();
    }),

    create: adminProcedure
      .input(z.object({
        title: z.string().min(1).max(255),
        url: z.string().max(1000).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return db.createNews({
          title: input.title,
          url: input.url || undefined,
          createdBy: ctx.user.id,
        });
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().min(1).max(255).optional(),
        url: z.string().max(1000).optional(),
        displayOrder: z.number().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateNews(id, data);
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.deleteNews(input.id);
      }),
  }),

  // 문의함 API
  inquiries: router({
    create: protectedProcedure
      .input(z.object({
        category: z.enum(['general', 'bug', 'suggestion', 'report_abuse', 'account']).default('general'),
        title: z.string().min(1).max(255),
        content: z.string().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        enforceRateLimit('inquiry', ctx.user.id);
        return db.createInquiry({
          userId: ctx.user.id,
          category: input.category,
          title: input.title,
          content: input.content,
        });
      }),

    listMine: protectedProcedure.query(async ({ ctx }) => {
      return db.getInquiriesByUser(ctx.user.id);
    }),

    listAll: adminProcedure
      .input(z.object({ status: z.enum(['pending', 'answered']).optional() }))
      .query(async ({ input }) => {
        return db.getAllInquiries(input.status);
      }),

    answer: adminProcedure
      .input(z.object({
        id: z.number(),
        adminReply: z.string().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        return db.answerInquiry(input.id, input.adminReply, ctx.user.id);
      }),
  }),

  // 이미지 업로드 (게시글 첨부 등, 프로필 사진은 auth.updateAvatarPhoto 사용)
  media: router({
    uploadPostImage: approvedProcedure
      .input(z.object({ dataUrl: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const url = await uploadImageDataUrl(input.dataUrl, `posts/${uploadScopeId(ctx.user.id)}`);
        return { url };
      }),

    uploadAdBannerImage: adminProcedure
      .input(z.object({ dataUrl: z.string() }))
      .mutation(async ({ input }) => {
        const url = await uploadImageDataUrl(input.dataUrl, "ad-banners");
        return { url };
      }),
  }),

  // 광고 배너 API (제휴 업체 광고 등, 관리자가 등록/관리)
  adBanners: router({
    list: publicProcedure
      .input(z.object({
        position: z.enum(['home_top', 'board_top']),
        boardId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return db.getActiveAdBanners(input.position, input.boardId);
      }),

    listAll: adminProcedure.query(async () => {
      return db.getAllAdBanners();
    }),

    create: adminProcedure
      .input(z.object({
        title: z.string().min(1).max(255),
        imageUrl: z.string().min(1).max(1024),
        linkUrl: z.string().min(1).max(1024),
        position: z.enum(['home_top', 'board_top']).default('home_top'),
        targetBoardId: z.number().optional(),
        displayOrder: z.number().default(0),
        startsAt: z.string().datetime().optional(),
        endsAt: z.string().datetime().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createAdBanner({
          title: input.title,
          imageUrl: input.imageUrl,
          linkUrl: input.linkUrl,
          position: input.position,
          targetBoardId: input.position === 'board_top' ? (input.targetBoardId ?? null) : null,
          displayOrder: input.displayOrder,
          startsAt: input.startsAt ? new Date(input.startsAt) : null,
          endsAt: input.endsAt ? new Date(input.endsAt) : null,
        });
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().min(1).max(255).optional(),
        imageUrl: z.string().min(1).max(1024).optional(),
        linkUrl: z.string().min(1).max(1024).optional(),
        position: z.enum(['home_top', 'board_top']).optional(),
        targetBoardId: z.number().nullable().optional(),
        isActive: z.boolean().optional(),
        displayOrder: z.number().optional(),
        startsAt: z.string().datetime().nullable().optional(),
        endsAt: z.string().datetime().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, startsAt, endsAt, ...rest } = input;
        return db.updateAdBanner(id, {
          ...rest,
          ...(startsAt !== undefined ? { startsAt: startsAt ? new Date(startsAt) : null } : {}),
          ...(endsAt !== undefined ? { endsAt: endsAt ? new Date(endsAt) : null } : {}),
        });
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.deleteAdBanner(input.id);
      }),

    recordClick: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.incrementAdBannerClick(input.id);
        return { success: true };
      }),

    recordImpression: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.incrementAdBannerImpression(input.id);
        return { success: true };
      }),
  }),

  // 관리자 API
  admin: router({
    /**
     * 업로드 파일 저장 위치가 안전한지(재배포 후에도 남는지) 알려준다.
     *
     * 잘못 설정돼 있으면 부팅 로그에도 경고가 찍히지만, 로그를 볼 일이 없는
     * 운영자가 대부분이라 관리자 화면에서도 바로 보이게 했다.
     */
    storageStatus: adminProcedure.query(() => {
      const health = describeStorage();
      return {
        mode: health.mode,
        persistent: health.persistent,
        summary: health.summary,
        remedy: health.remedy,
      };
    }),

    users: router({
      list: adminProcedure
        .input(z.object({
          limit: z.number().default(20),
          offset: z.number().default(0),
        }))
        .query(async ({ input }) => {
          return db.getAllUsers(input.limit, input.offset);
        }),
      
      /**
       * 익명 글·댓글의 작성자 확인 (조물주 전용).
       *
       * 괴롭힘 조사 등 꼭 필요한 경우를 위한 경로이며, 조회 사실 자체가 기록으로
       * 남도록 moderationLogs에 남긴다 — 권한자가 마음대로 들여다봤는지 나중에
       * 확인할 수 있어야 견제가 된다.
       */
      revealAnonymousAuthor: ownerProcedure
        .input(z.object({
          targetType: z.enum(['post', 'comment']),
          targetId: z.number(),
          reason: z.string().min(2).max(200),
        }))
        .mutation(async ({ input, ctx }) => {
          const author = await db.getAnonymousAuthor(input.targetType, input.targetId);
          if (!author) throw new TRPCError({ code: 'NOT_FOUND', message: '대상을 찾을 수 없습니다' });

          try {
            await db.createModerationLog({
              userId: ctx.user.id,
              targetType: input.targetType,
              content: `익명 작성자 조회: ${input.targetType} #${input.targetId} -> userId ${author.userId}`,
              reason: `조회 사유: ${input.reason}`,
            });
          } catch (error) {
            console.warn('[Reveal] 익명 조회 기록 실패:', error);
          }

          return author;
        }),

      /** 승인 대기 목록 — 관리자가 학번·이름을 보고 재학생인지 판단한다. */
      pending: adminProcedure.query(async () => {
        return db.getPendingUsers();
      }),

      /** 탭 뱃지에 쓰는 대기 인원 수. 목록 전체를 받지 않아도 되게 따로 둔다. */
      pendingCount: adminProcedure.query(async () => {
        return db.countPendingUsers();
      }),

      /**
       * 가입 승인/거절. 거절해도 계정은 지우지 않고 blocked로 남긴다 —
       * 같은 이메일로 곧바로 재가입해 대기열을 다시 채우는 걸 막기 위해서다.
       */
      decideApproval: adminProcedure
        .input(z.object({
          userId: z.number(),
          decision: z.enum(['approve', 'reject']),
          note: z.string().max(200).optional(),
        }))
        .mutation(async ({ input }) => {
          const target = await db.getUserById(input.userId);
          if (!target) throw new TRPCError({ code: 'NOT_FOUND' });
          if (target.status !== 'pending') {
            throw new TRPCError({ code: 'BAD_REQUEST', message: '이미 처리된 가입 신청입니다' });
          }

          const approved = input.decision === 'approve';
          await db.setUserApproval(input.userId, approved ? 'active' : 'blocked', input.note ?? null);

          // 승인 알림은 수신 동의와 무관하게 항상 보낸다(계정 상태 안내라서).
          // 거절은 인앱 알림으로 전달할 수 없다 — blocked 계정은 createContext에서
          // 로그아웃으로 취급되어 알림함 자체를 못 연다. 거절 사유는 로그인 시점에
          // 안내하므로(auth.login) 여기서는 알림을 만들지 않는다.
          if (approved) {
            try {
              await db.createNotification({
                userId: input.userId,
                type: 'announcement',
                title: '가입이 승인되었습니다',
                body: '이제 글쓰기와 댓글 등 모든 기능을 이용할 수 있어요',
                linkUrl: '/',
              });
            } catch (error) {
              console.warn('[Approval] 승인 알림 생성 실패:', error);
            }
          }

          return { success: true } as const;
        }),

      updateRole: adminProcedure
        .input(z.object({
          userId: z.number(),
          role: z.enum(['user', 'admin']),
        }))
        .mutation(async ({ input, ctx }) => {
          const target = await db.getUserById(input.userId);
          if (!target) throw new TRPCError({ code: 'NOT_FOUND' });
          // 조물주(owner)는 아무도 건드릴 수 없다. admin끼리도 서로 권한을 바꿀 수 없고,
          // owner만 기존 admin의 권한을 바꿀 수 있다 — 일반 사용자를 admin으로 승격시키는
          // 것은(한쪽 방향) 어떤 admin이든 가능하다.
          if (target.role === 'owner') {
            throw new TRPCError({ code: 'FORBIDDEN', message: '조물주의 권한은 변경할 수 없습니다' });
          }
          if (target.role === 'admin' && ctx.user.role !== 'owner') {
            throw new TRPCError({ code: 'FORBIDDEN', message: '다른 관리자의 권한은 조물주만 변경할 수 있습니다' });
          }
          return db.updateUserRole(input.userId, input.role);
        }),

      updateStatus: adminProcedure
        .input(z.object({
          userId: z.number(),
          status: z.enum(['active', 'blocked']),
        }))
        .mutation(async ({ input, ctx }) => {
          const target = await db.getUserById(input.userId);
          if (!target) throw new TRPCError({ code: 'NOT_FOUND' });
          if (target.role === 'owner') {
            throw new TRPCError({ code: 'FORBIDDEN', message: '조물주는 차단할 수 없습니다' });
          }
          if (target.role === 'admin' && ctx.user.role !== 'owner') {
            throw new TRPCError({ code: 'FORBIDDEN', message: '다른 관리자는 조물주만 차단할 수 있습니다' });
          }
          return db.updateUserStatus(input.userId, input.status);
        }),

      /** 사용자 활동 내역: 일반 admin은 role='user'만, owner는 admin/owner 포함 누구든 볼 수 있다. */
      activity: adminProcedure
        .input(z.object({ userId: z.number() }))
        .query(async ({ input, ctx }) => {
          const target = await db.getUserById(input.userId);
          if (!target) throw new TRPCError({ code: 'NOT_FOUND' });
          if (target.role !== 'user' && ctx.user.role !== 'owner') {
            throw new TRPCError({ code: 'FORBIDDEN', message: '관리자의 활동 내역은 조물주만 볼 수 있습니다' });
          }
          return db.getUserActivity(input.userId);
        }),
    }),
    
    posts: router({
      forceDelete: adminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
          return db.deletePost(input.id);
        }),
    }),
    
        comments: router({
      forceDelete: adminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
          return db.deleteComment(input.id);
        }),
    }),
  }),

  // 계정 검색
  users: router({
    search: approvedProcedure
      .input(z.object({ query: z.string().min(1).max(100) }))
      .query(async ({ input, ctx }) => {
        return db.searchUsers(input.query.trim(), ctx.user.id, 20);
      }),
  }),

  // 개인 채팅
  chat: router({
    // 대화 시작(또는 기존 대화 반환)
    startConversation: approvedProcedure
      .input(z.object({ targetUserId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (input.targetUserId === ctx.user.id) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '자신과는 채팅할 수 없습니다' });
        }
        const target = await db.getUserById(input.targetUserId);
        if (!target) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '사용자를 찾을 수 없습니다' });
        }
        const conv = await db.getOrCreateConversation(ctx.user.id, input.targetUserId);
        return conv;
      }),
    // 내 대화 목록
    listConversations: protectedProcedure.query(async ({ ctx }) => {
      return db.getConversationsForUser(ctx.user.id);
    }),
    // 전체 미읽음 수
    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      return db.getTotalUnreadCount(ctx.user.id);
    }),
    // 특정 대화의 메시지 목록 (읽음 처리 포함)
    getMessages: protectedProcedure
      .input(z.object({ conversationId: z.number() }))
      .query(async ({ input, ctx }) => {
        const conv = await db.getConversationById(input.conversationId);
        if (!conv || (conv.userAId !== ctx.user.id && conv.userBId !== ctx.user.id)) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '접근 권한이 없습니다' });
        }
        const otherId = conv.userAId === ctx.user.id ? conv.userBId : conv.userAId;
        const other = await db.getUserById(otherId);
        const list = await db.getMessages(input.conversationId);
        return {
          otherUserId: otherId,
          otherUserName: other?.name ?? '알 수 없음',
          otherUserAvatarEmoji: other?.avatarEmoji ?? null,
          otherUserAvatarImageUrl: other?.avatarImageUrl ?? null,
          messages: list,
        };
      }),
    // 읽음 처리
    markRead: protectedProcedure
      .input(z.object({ conversationId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const conv = await db.getConversationById(input.conversationId);
        if (!conv || (conv.userAId !== ctx.user.id && conv.userBId !== ctx.user.id)) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '접근 권한이 없습니다' });
        }
        await db.markMessagesRead(input.conversationId, ctx.user.id);
        return { success: true } as const;
      }),
    // 메시지 전송
    sendMessage: approvedProcedure
      .input(z.object({ conversationId: z.number(), content: z.string().min(1).max(2000) }))
      .mutation(async ({ input, ctx }) => {
        enforceRateLimit('message', ctx.user.id);
        const conv = await db.getConversationById(input.conversationId);
        if (!conv || (conv.userAId !== ctx.user.id && conv.userBId !== ctx.user.id)) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '접근 권한이 없습니다' });
        }
        return db.createMessage(input.conversationId, ctx.user.id, input.content.trim());
      }),
  }),
});
export type AppRouter = typeof appRouter;
