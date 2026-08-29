import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import { randomBytes } from "node:crypto";
import * as db from "../../db";
import { getSessionCookieOptions } from "../cookies";
import { ENV } from "../env";
import { getAppleAuthorizationUrl, exchangeAppleCode } from "./providers/apple";
import { getGoogleAuthorizationUrl, exchangeGoogleCode } from "./providers/google";
import { getKakaoAuthorizationUrl, exchangeKakaoCode } from "./providers/kakao";
import {
  createPendingSignupToken,
  createSessionToken,
  signOAuthState,
  verifyOAuthState,
} from "./session";

const STATE_COOKIE_NAME = "oauth_state";
type Provider = "google" | "kakao" | "apple";

function redirectUriFor(provider: Provider) {
  return `${ENV.appUrl.replace(/\/+$/, "")}/api/auth/${provider}/callback`;
}

/** 로그인 후 최종적으로 클라이언트가 도착할 페이지 (성공: 홈, 신규가입: 이름 입력 페이지) */
function finish(
  res: Response,
  outcome:
    | { kind: "login"; sessionToken: string }
    | { kind: "signup"; pendingToken: string },
  req: Request
) {
  if (outcome.kind === "login") {
    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, outcome.sessionToken, {
      ...cookieOptions,
      maxAge: ONE_YEAR_MS,
    });
    res.redirect(302, "/");
    return;
  }

  const url = new URL("/signup/complete", ENV.appUrl);
  url.searchParams.set("token", outcome.pendingToken);
  res.redirect(302, url.pathname + url.search);
}

async function handleProviderResult(
  req: Request,
  res: Response,
  provider: Provider,
  result: { providerUserId: string; email: string | null }
) {
  const existing = await db.getAuthIdentity(provider, result.providerUserId);

  if (existing) {
    // 이미 가입된 사용자 -> 바로 로그인 처리
    await db.touchLastSignedIn(existing.userId, provider);
    const sessionToken = await createSessionToken(existing.userId);
    finish(res, { kind: "login", sessionToken }, req);
    return;
  }

  // 최초 로그인 -> 학번+이름을 입력받기 위해 임시 토큰 발급
  const pendingToken = await createPendingSignupToken({
    provider,
    providerUserId: result.providerUserId,
    email: result.email,
  });
  finish(res, { kind: "signup", pendingToken }, req);
}

function setStateCookie(res: Response, req: Request, signedState: string) {
  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(STATE_COOKIE_NAME, signedState, {
    ...cookieOptions,
    maxAge: 10 * 60 * 1000,
  });
}

async function checkState(
  req: Request
): Promise<{ ok: boolean }> {
  const cookies = parseCookieHeader(req.headers.cookie ?? "");
  const cookieState = cookies[STATE_COOKIE_NAME];
  const queryState = typeof req.query.state === "string" ? req.query.state : undefined;
  const bodyState =
    typeof req.body?.state === "string" ? req.body.state : undefined;
  const returnedState = queryState ?? bodyState;

  if (!cookieState || !returnedState || cookieState !== returnedState) {
    return { ok: false };
  }

  try {
    await verifyOAuthState(cookieState);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export function registerAuthRoutes(app: Express) {
  // ---- Google ----
  app.get("/api/auth/google", async (req, res) => {
    if (!ENV.google.clientId) {
      res.status(500).send("Google login is not configured (GOOGLE_CLIENT_ID missing)");
      return;
    }
    const state = await signOAuthState({ nonce: randomBytes(16).toString("hex") });
    setStateCookie(res, req, state);
    res.redirect(302, getGoogleAuthorizationUrl(state, redirectUriFor("google")));
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    try {
      const code = typeof req.query.code === "string" ? req.query.code : undefined;
      const { ok } = await checkState(req);
      if (!code || !ok) {
        res.redirect(302, "/login?error=invalid_state");
        return;
      }
      const result = await exchangeGoogleCode(code, redirectUriFor("google"));
      await handleProviderResult(req, res, "google", result);
    } catch (error) {
      console.error("[Auth][Google] callback failed", error);
      res.redirect(302, "/login?error=google_failed");
    }
  });

  // ---- Kakao ----
  app.get("/api/auth/kakao", async (req, res) => {
    if (!ENV.kakao.clientId) {
      res.status(500).send("Kakao login is not configured (KAKAO_CLIENT_ID missing)");
      return;
    }
    const state = await signOAuthState({ nonce: randomBytes(16).toString("hex") });
    setStateCookie(res, req, state);
    res.redirect(302, getKakaoAuthorizationUrl(state, redirectUriFor("kakao")));
  });

  app.get("/api/auth/kakao/callback", async (req, res) => {
    try {
      const code = typeof req.query.code === "string" ? req.query.code : undefined;
      const { ok } = await checkState(req);
      if (!code || !ok) {
        res.redirect(302, "/login?error=invalid_state");
        return;
      }
      const result = await exchangeKakaoCode(code, redirectUriFor("kakao"));
      await handleProviderResult(req, res, "kakao", result);
    } catch (error) {
      console.error("[Auth][Kakao] callback failed", error);
      res.redirect(302, "/login?error=kakao_failed");
    }
  });

  // ---- Apple ----
  app.get("/api/auth/apple", async (req, res) => {
    if (!ENV.apple.clientId) {
      res.status(500).send("Apple login is not configured (APPLE_CLIENT_ID missing)");
      return;
    }
    const state = await signOAuthState({ nonce: randomBytes(16).toString("hex") });
    setStateCookie(res, req, state);
    res.redirect(302, getAppleAuthorizationUrl(state, redirectUriFor("apple")));
  });

  // Apple은 scope에 email/name이 있으면 반드시 POST(form_post)로 콜백함
  app.post("/api/auth/apple/callback", async (req, res) => {
    try {
      const code = typeof req.body?.code === "string" ? req.body.code : undefined;
      const { ok } = await checkState(req);
      if (!code || !ok) {
        res.redirect(302, "/login?error=invalid_state");
        return;
      }
      const result = await exchangeAppleCode(code, redirectUriFor("apple"));
      await handleProviderResult(req, res, "apple", result);
    } catch (error) {
      console.error("[Auth][Apple] callback failed", error);
      res.redirect(302, "/login?error=apple_failed");
    }
  });
}
