import { COOKIE_NAME, ONE_YEAR_MS, AVATAR_EMOJI_OPTIONS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { hashPassword, verifyPassword } from "./_core/auth/password";
import { createSessionToken, verifyPendingSignupToken } from "./_core/auth/session";
import { putUpload } from "./media";

const STUDENT_NAME_REGEX = /^\d{5} .+$/;
const STUDENT_NAME_MESSAGE = "학번(5자리) 이름 형식으로 입력해주세요 (예: 20223 조은후)";

const IMAGE_DATA_URL_REGEX = /^data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=]+)$/;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

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

// Admin procedure - only admin users can access
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
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
        });
        if (!user) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '회원가입에 실패했습니다' });
        }
        const sessionToken = await createSessionToken(user.id);
        issueSession(ctx, sessionToken);
        return user;
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
          throw new TRPCError({ code: 'FORBIDDEN', message: '이용이 제한된 계정입니다' });
        }
        await db.touchLastSignedIn(user.id, 'email');
        const sessionToken = await createSessionToken(user.id);
        issueSession(ctx, sessionToken);
        return user;
      }),

    /** 소셜 로그인 최초 사용자가 학번+이름을 입력해 가입을 완료 */
    completeOAuthSignup: publicProcedure
      .input(z.object({
        token: z.string(),
        name: z.string().regex(STUDENT_NAME_REGEX, STUDENT_NAME_MESSAGE),
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
          return db.getUserById(alreadyLinked.userId);
        }

        const user = await db.createUserFromOAuth({
          provider: pending.provider,
          providerUserId: pending.providerUserId,
          email: pending.email,
          name: input.name,
        });
        if (!user) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '회원가입에 실패했습니다' });
        }
        const sessionToken = await createSessionToken(user.id);
        issueSession(ctx, sessionToken);
        return user;
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
        const url = await uploadImageDataUrl(input.dataUrl, `avatars/${ctx.user.id}`);
        return db.updateUserAvatarImage(ctx.user.id, url);
      }),

    /** 프로필 사진을 지우고 이모지/이니셜 기본 아바타로 되돌린다. */
    removeAvatarPhoto: protectedProcedure.mutation(async ({ ctx }) => {
      return db.updateUserAvatarImage(ctx.user.id, null);
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
    
    create: adminProcedure
      .input(z.object({
        name: z.string().min(1).max(100),
        slug: z.string().min(1).max(100),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createBoard(input);
      }),
    
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(100).optional(),
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
      .query(async ({ input }) => {
        return db.getPostsByBoard(input.boardId, input.limit, input.offset, input.sortBy, input.search);
      }),
    
    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const post = await db.getPostById(input.id);
        if (!post) throw new TRPCError({ code: 'NOT_FOUND' });
        
        // Increment view count
        await db.incrementPostViewCount(input.id);
        
        return post;
      }),
    
    create: protectedProcedure
      .input(z.object({
        boardId: z.number(),
        title: z.string().min(1).max(255),
        content: z.string().min(1),
        isAnonymous: z.boolean().default(false),
        images: z.array(z.string().url()).max(4).default([]),
      }))
      .mutation(async ({ input, ctx }) => {
        return db.createPost({
          boardId: input.boardId,
          userId: ctx.user.id,
          title: input.title,
          content: input.content,
          isAnonymous: input.isAnonymous,
          images: input.images,
        });
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().min(1).max(255).optional(),
        content: z.string().min(1).optional(),
        images: z.array(z.string().url()).max(4).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const post = await db.getPostById(input.id);
        if (!post) throw new TRPCError({ code: 'NOT_FOUND' });
        if (post.userId !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        
        const { id, ...data } = input;
        return db.updatePost(id, data);
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const post = await db.getPostById(input.id);
        if (!post) throw new TRPCError({ code: 'NOT_FOUND' });
        if (post.userId !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        
        return db.deletePost(input.id);
      }),
    
    search: publicProcedure
      .input(z.object({
        query: z.string().min(1),
        limit: z.number().default(20),
        offset: z.number().default(0),
      }))
      .query(async ({ input }) => {
        return db.searchPosts(input.query, input.limit, input.offset);
      }),
  }),

  // 댓글 관련 API
  comments: router({
    listByPost: publicProcedure
      .input(z.object({ postId: z.number() }))
      .query(async ({ input }) => {
        return db.getCommentsByPost(input.postId);
      }),
    
    create: protectedProcedure
      .input(z.object({
        postId: z.number(),
        content: z.string().min(1),
        isAnonymous: z.boolean().default(false),
        parentCommentId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return db.createComment({
          postId: input.postId,
          userId: ctx.user.id,
          content: input.content,
          isAnonymous: input.isAnonymous,
          parentCommentId: input.parentCommentId,
        });
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const comment = await db.getCommentById(input.id);
        if (!comment) throw new TRPCError({ code: 'NOT_FOUND' });
        if (comment.userId !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        
        return db.deleteComment(input.id);
      }),
  }),

  // 추천(좋아요) 관련 API
  likes: router({
    togglePostLike: protectedProcedure
      .input(z.object({ postId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const hasLiked = await db.hasUserLikedPost(input.postId, ctx.user.id);
        
        if (hasLiked) {
          await db.removePostLike(input.postId, ctx.user.id);
          return { liked: false };
        } else {
          await db.addPostLike(input.postId, ctx.user.id);
          return { liked: true };
        }
      }),
    
    toggleCommentLike: protectedProcedure
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
    create: protectedProcedure
      .input(z.object({
        targetType: z.enum(['post', 'comment']),
        targetId: z.number(),
        reason: z.string().min(1).max(255),
        description: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
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
    uploadPostImage: protectedProcedure
      .input(z.object({ dataUrl: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const url = await uploadImageDataUrl(input.dataUrl, `posts/${ctx.user.id}`);
        return { url };
      }),
  }),

  // 관리자 API
  admin: router({
    users: router({
      list: adminProcedure
        .input(z.object({
          limit: z.number().default(20),
          offset: z.number().default(0),
        }))
        .query(async ({ input }) => {
          return db.getAllUsers(input.limit, input.offset);
        }),
      
      updateRole: adminProcedure
        .input(z.object({
          userId: z.number(),
          role: z.enum(['user', 'admin']),
        }))
        .mutation(async ({ input }) => {
          return db.updateUserRole(input.userId, input.role);
        }),
      
      updateStatus: adminProcedure
        .input(z.object({
          userId: z.number(),
          status: z.enum(['active', 'blocked']),
        }))
        .mutation(async ({ input }) => {
          return db.updateUserStatus(input.userId, input.status);
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
    search: protectedProcedure
      .input(z.object({ query: z.string().min(1).max(100) }))
      .query(async ({ input, ctx }) => {
        return db.searchUsers(input.query.trim(), ctx.user.id, 20);
      }),
  }),

  // 개인 채팅
  chat: router({
    // 대화 시작(또는 기존 대화 반환)
    startConversation: protectedProcedure
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
    sendMessage: protectedProcedure
      .input(z.object({ conversationId: z.number(), content: z.string().min(1).max(2000) }))
      .mutation(async ({ input, ctx }) => {
        const conv = await db.getConversationById(input.conversationId);
        if (!conv || (conv.userAId !== ctx.user.id && conv.userBId !== ctx.user.id)) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '접근 권한이 없습니다' });
        }
        return db.createMessage(input.conversationId, ctx.user.id, input.content.trim());
      }),
  }),
});
export type AppRouter = typeof appRouter;
