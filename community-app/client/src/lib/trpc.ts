import { createTRPCReact } from "@trpc/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";

export const trpc = createTRPCReact<AppRouter>();

/** 서버 프로시저의 반환 타입. 화면 컴포넌트에 prop 타입을 붙일 때 쓴다. */
export type RouterOutput = inferRouterOutputs<AppRouter>;
