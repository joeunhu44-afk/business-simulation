import { SignJWT, createRemoteJWKSet, importPKCS8, jwtVerify } from "jose";
import { ENV } from "../../env";

const AUTH_URL = "https://appleid.apple.com/auth/authorize";
const TOKEN_URL = "https://appleid.apple.com/auth/token";
const JWKS = createRemoteJWKSet(
  new URL("https://appleid.apple.com/auth/keys")
);

// Apple 로그인은 scope에 email/name을 포함하면 반드시 POST(form_post)로 콜백을 받아야 한다.
export function getAppleAuthorizationUrl(
  state: string,
  redirectUri: string
): string {
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", ENV.apple.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("response_mode", "form_post");
  url.searchParams.set("scope", "email name");
  url.searchParams.set("state", state);
  return url.toString();
}

/**
 * Apple은 고정된 client secret이 아니라, 매 요청마다(또는 캐싱해서 최대 6개월)
 * 팀의 개인키(.p8)로 서명한 JWT를 client_secret으로 사용해야 한다.
 */
async function createAppleClientSecret(): Promise<string> {
  const privateKey = await importPKCS8(ENV.apple.privateKey, "ES256");
  const nowSeconds = Math.floor(Date.now() / 1000);

  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: ENV.apple.keyId })
    .setIssuer(ENV.apple.teamId)
    .setIssuedAt(nowSeconds)
    .setExpirationTime(nowSeconds + 60 * 5) // 5분이면 충분 (토큰 교환 직후 사용)
    .setAudience("https://appleid.apple.com")
    .setSubject(ENV.apple.clientId)
    .sign(privateKey);
}

export async function exchangeAppleCode(
  code: string,
  redirectUri: string
): Promise<{ providerUserId: string; email: string | null }> {
  const clientSecret = await createAppleClientSecret();

  const body = new URLSearchParams({
    client_id: ENV.apple.clientId,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });

  const tokenResp = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!tokenResp.ok) {
    const text = await tokenResp.text().catch(() => "");
    throw new Error(`Apple token exchange failed (${tokenResp.status}): ${text}`);
  }

  const tokenData = (await tokenResp.json()) as { id_token?: string };
  if (!tokenData.id_token) {
    throw new Error("Apple response missing id_token");
  }

  const { payload } = await jwtVerify(tokenData.id_token, JWKS, {
    issuer: "https://appleid.apple.com",
    audience: ENV.apple.clientId,
  });

  const sub = payload.sub;
  if (!sub) throw new Error("Apple id_token missing sub claim");

  return {
    providerUserId: sub,
    email: typeof payload.email === "string" ? payload.email : null,
  };
}
