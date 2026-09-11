import { NOT_ADMIN_ERR_MSG, NOT_APPROVED_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

/**
 * 승인된(active) 사용자만 통과하는 미들웨어.
 *
 * 글·댓글 작성, 추천, 쪽지처럼 "커뮤니티에 무언가를 남기는" 모든 동작은
 * protectedProcedure가 아니라 이걸 써야 한다. 라우터마다 status를 일일이 검사하면
 * 새 기능을 추가할 때 빠뜨리기 쉬워서, 검사 지점을 여기 하나로 모았다.
 *
 * blocked 사용자는 createContext에서 이미 로그아웃 취급되어 여기까지 오지 않고,
 * 실질적으로 여기서 걸러지는 건 승인 대기(pending) 사용자다.
 */
const requireApproved = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  if (ctx.user.status !== "active") {
    throw new TRPCError({ code: "FORBIDDEN", message: NOT_APPROVED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const approvedProcedure = t.procedure.use(requireApproved);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
