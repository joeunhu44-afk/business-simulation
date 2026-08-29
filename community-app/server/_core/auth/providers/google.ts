import { createRemoteJWKSet, jwtVerify } from "jose";
import { ENV } from "../../env";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs")
);

export function getGoogleAuthorizationUrl(
  state: string,
  redirectUri: string
): string {
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", ENV.google.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export async function exchangeGoogleCode(
  code: string,
  redirectUri: string
): Promise<{ providerUserId: string; email: string | null; name: string | null }> {
  const body = new URLSearchParams({
    client_id: ENV.google.clientId,
    client_secret: ENV.google.clientSecret,
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
    throw new Error(`Google token exchange failed (${tokenResp.status}): ${text}`);
  }

  const tokenData = (await tokenResp.json()) as { id_token?: string };
  if (!tokenData.id_token) {
    throw new Error("Google response missing id_token");
  }

  const { payload } = await jwtVerify(tokenData.id_token, JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: ENV.google.clientId,
  });

  const sub = payload.sub;
  if (!sub) throw new Error("Google id_token missing sub claim");

  return {
    providerUserId: sub,
    email: typeof payload.email === "string" ? payload.email : null,
    name: typeof payload.name === "string" ? payload.name : null,
  };
}
