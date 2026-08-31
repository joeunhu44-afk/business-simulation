export const COOKIE_NAME = "app_session_id";

/** 프로필 아바타로 고를 수 있는 이모지 목록. 사진 업로드 없이도 개인화된 느낌을 준다. */
export const AVATAR_EMOJI_OPTIONS = [
  "🐰", "🐱", "🐶", "🦊", "🐼", "🐨", "🦁", "🐯",
  "🐸", "🐧", "🦉", "🐢", "🦄", "🐙", "🌟", "🍀",
] as const;
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';
