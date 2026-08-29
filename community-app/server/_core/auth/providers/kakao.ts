import { ENV } from "../../env";

const AUTH_URL = "https://kauth.kakao.com/oauth/authorize";
const TOKEN_URL = "https://kauth.kakao.com/oauth/token";
const USER_INFO_URL = "https://kapi.kakao.com/v2/user/me";

export function getKakaoAuthorizationUrl(
  state: string,
  redirectUri: string
): string {
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", ENV.kakao.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeKakaoCode(
  code: string,
  redirectUri: string
): Promise<{ providerUserId: string; email: string | null; name: string | null }> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: ENV.kakao.clientId,
    redirect_uri: redirectUri,
    code,
  });
  // 카카오 개발자 콘솔에서 "Client Secret"을 활성화한 경우에만 전달
  if (ENV.kakao.clientSecret) {
    body.set("client_secret", ENV.kakao.clientSecret);
  }

  const tokenResp = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!tokenResp.ok) {
    const text = await tokenResp.text().catch(() => "");
    throw new Error(`Kakao token exchange failed (${tokenResp.status}): ${text}`);
  }

  const tokenData = (await tokenResp.json()) as { access_token?: string };
  if (!tokenData.access_token) {
    throw new Error("Kakao response missing access_token");
  }

  const userResp = await fetch(USER_INFO_URL, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!userResp.ok) {
    const text = await userResp.text().catch(() => "");
    throw new Error(`Kakao user info request failed (${userResp.status}): ${text}`);
  }

  const userData = (await userResp.json()) as {
    id: number;
    kakao_account?: {
      email?: string;
      profile?: { nickname?: string };
    };
  };

  return {
    providerUserId: String(userData.id),
    email: userData.kakao_account?.email ?? null,
    name: userData.kakao_account?.profile?.nickname ?? null,
  };
}
