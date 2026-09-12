export const COOKIE_NAME = "app_session_id";

/** 프로필 아바타로 고를 수 있는 이모지 목록. 사진 업로드 없이도 개인화된 느낌을 준다. */
export const AVATAR_EMOJI_OPTIONS = [
  "🐰", "🐱", "🐶", "🦊", "🐼", "🐨", "🦁", "🐯",
  "🐸", "🐧", "🦉", "🐢", "🦄", "🐙", "🌟", "🍀",
] as const;
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
/**
 * 자동 필터가 등록한 신고의 reporterUserId. 실제 사용자 id는 1부터 시작하므로
 * 0은 "시스템이 올린 신고"를 뜻한다 (관리자 페이지에서 사용자 신고와 구분용).
 */
export const SYSTEM_REPORTER_USER_ID = 0;

export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';
/** 승인 대기(pending) 계정이 활동성 기능을 호출했을 때. 클라이언트가 그대로 보여준다. */
export const NOT_APPROVED_ERR_MSG = '관리자 승인 후 이용할 수 있습니다';

/** 회원 탈퇴 시 사용자가 그대로 입력해야 하는 확인 문구. 오조작 방지용. */
export const WITHDRAW_CONFIRM_TEXT = "탈퇴하겠습니다";
