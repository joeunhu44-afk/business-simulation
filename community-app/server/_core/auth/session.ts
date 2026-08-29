import { ONE_YEAR_MS } from "@shared/const";
import { SignJWT, jwtVerify } from "jose";
import { ENV } from "../env";

function getSecretKey() {
  if (!ENV.cookieSecret) {
    throw new Error(
      "JWT_SECRET is not configured. Set it in your environment variables."
    );
  }
  return new TextEncoder().encode(ENV.cookieSecret);
}

/**
 * 로그인 완료 후 발급하는 정식 세션 토큰. payload에는 내부 userId만 담는다.
 */
export async function createSessionToken(
  userId: number,
  expiresInMs: number = ONE_YEAR_MS
): Promise<string> {
  const expirationSeconds = Math.floor((Date.now() + expiresInMs) / 1000);
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expirationSeconds)
    .sign(getSecretKey());
}

export async function verifySessionToken(
  token: string | undefined | null
): Promise<number | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });
    const userId = payload.userId;
    return typeof userId === "number" ? userId : null;
  } catch (error) {
    return null;
  }
}

export type PendingOAuthSignup = {
  provider: "google" | "kakao" | "apple";
  providerUserId: string;
  email: string | null;
};

/**
 * 소셜 로그인은 성공했지만 아직 앱 내 계정(학번+이름)이 없는 사용자를 위한
 * 10분짜리 임시 토큰. 이 토큰을 들고 /signup/complete 에서 이름을 입력하면 계정이 생성된다.
 */
export async function createPendingSignupToken(
  data: PendingOAuthSignup
): Promise<string> {
  const expirationSeconds = Math.floor((Date.now() + 10 * 60 * 1000) / 1000);
  return new SignJWT({ ...data, purpose: "oauth_signup" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expirationSeconds)
    .sign(getSecretKey());
}

export async function verifyPendingSignupToken(
  token: string
): Promise<PendingOAuthSignup> {
  const { payload } = await jwtVerify(token, getSecretKey(), {
    algorithms: ["HS256"],
  });

  if (payload.purpose !== "oauth_signup") {
    throw new Error("Invalid token purpose");
  }

  return {
    provider: payload.provider as PendingOAuthSignup["provider"],
    providerUserId: payload.providerUserId as string,
    email: (payload.email as string | null) ?? null,
  };
}

/**
 * OAuth CSRF 방지용 state 값을 짧게 서명해서 쿠키에 저장할 때 사용.
 * (state는 그냥 랜덤 문자열이면 충분하지만, 여기서는 redirect 목적지 등 부가정보도 함께 담기 위해 JWT로 감쌌다.)
 */
export async function signOAuthState(data: {
  nonce: string;
}): Promise<string> {
  const expirationSeconds = Math.floor((Date.now() + 10 * 60 * 1000) / 1000);
  return new SignJWT(data)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expirationSeconds)
    .sign(getSecretKey());
}

export async function verifyOAuthState(
  token: string
): Promise<{ nonce: string }> {
  const { payload } = await jwtVerify(token, getSecretKey(), {
    algorithms: ["HS256"],
  });
  return { nonce: payload.nonce as string };
}
