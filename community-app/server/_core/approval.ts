/**
 * 가입 승인 정책.
 *
 * 신규 가입자는 기본적으로 pending(관리자 승인 대기)으로 시작한다. 예외는 두 가지뿐이고,
 * 둘 다 여기 한 곳에서만 판단한다 — 가입 경로(이메일/구글/카카오/애플)가 늘어나도
 * 각 경로에서 status를 직접 정하지 않고 resolveInitialStatus()만 부르면 되도록.
 */

/** 사용자 계정 상태. pending은 로그인은 되지만 글쓰기 등 활동이 막힌 상태다. */
export type UserStatus = "active" | "blocked" | "pending";

/**
 * 자동 승인할 이메일 도메인 목록. 학교가 재학생에게 메일 계정을 발급한다면
 * AUTO_APPROVE_EMAIL_DOMAINS="school.hs.kr,shinheung.hs.kr" 처럼 넣으면 되고,
 * 비워두면(기본값) 모든 신규 가입이 관리자 승인을 거친다 — 코드 수정 없이 env로만 켠다.
 *
 * 주의: 카카오/애플은 이메일을 안 내려주는 경우가 있어(users.email이 nullable인 이유)
 * 이 화이트리스트는 이메일을 아는 가입 경로에서만 동작한다. 관리자 승인을 대체하는
 * 수단이 아니라 승인 업무를 줄여주는 보조 수단으로만 쓸 것.
 */
export function autoApproveDomains(env: NodeJS.ProcessEnv = process.env): string[] {
  return (env.AUTO_APPROVE_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
}

/** 이메일이 자동 승인 도메인에 속하는지. 도메인 목록이 비어 있으면 항상 false. */
export function isAutoApprovedEmail(
  email: string | null | undefined,
  domains: string[]
): boolean {
  if (!email || domains.length === 0) return false;
  const at = email.lastIndexOf("@");
  if (at === -1) return false;
  // 하위 도메인까지 허용하면(endsWith) "school.hs.kr.evil.com" 같은 주소가 통과하므로
  // 도메인 전체가 정확히 일치할 때만 승인한다.
  const domain = email.slice(at + 1).toLowerCase();
  return domains.includes(domain);
}

/**
 * 새로 만들어지는 계정의 초기 상태.
 *
 * - owner(OWNER_EMAIL 계정)는 절대 pending이 되지 않는다. 승인해 줄 사람이 본인뿐이라
 *   pending으로 시작하면 아무도 승인할 수 없는 잠금 상태가 된다.
 * - 자동 승인 도메인에 해당하면 active.
 * - 그 외 전부 pending.
 */
export function resolveInitialStatus(params: {
  email: string | null | undefined;
  role: "user" | "admin" | "owner";
  domains?: string[];
}): UserStatus {
  const { email, role, domains = autoApproveDomains() } = params;
  if (role === "owner" || role === "admin") return "active";
  if (isAutoApprovedEmail(email, domains)) return "active";
  return "pending";
}
