export type Role = "user" | "admin" | "owner";

/** owner("조물주")는 admin의 상위 권한이라 관리자 전용 화면/버튼은 owner에게도 항상 열려있어야 한다. */
export function isAdminRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "owner";
}

export function roleLabel(role: string | null | undefined): string {
  if (role === "owner") return "조물주";
  if (role === "admin") return "관리자";
  return "사용자";
}
