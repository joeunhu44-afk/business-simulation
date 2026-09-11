import { describe, expect, it } from "vitest";
import { autoApproveDomains, isAutoApprovedEmail, resolveInitialStatus } from "./approval";

describe("resolveInitialStatus — 신규 가입자의 초기 상태", () => {
  it("일반 가입자는 승인 대기(pending)로 시작한다", () => {
    expect(resolveInitialStatus({ email: "someone@gmail.com", role: "user", domains: [] })).toBe(
      "pending"
    );
  });

  it("이메일이 없는 소셜 가입(카카오·애플)도 승인 대기로 시작한다", () => {
    expect(resolveInitialStatus({ email: null, role: "user", domains: [] })).toBe("pending");
  });

  it("owner 계정은 절대 pending이 되지 않는다 (승인해 줄 사람이 본인뿐이라 잠금 상태가 된다)", () => {
    expect(resolveInitialStatus({ email: "owner@example.com", role: "owner", domains: [] })).toBe(
      "active"
    );
  });

  it("자동 승인 도메인에 해당하면 바로 active가 된다", () => {
    expect(
      resolveInitialStatus({ email: "student@school.hs.kr", role: "user", domains: ["school.hs.kr"] })
    ).toBe("active");
  });

  it("자동 승인 도메인이 비어 있으면(기본값) 아무도 자동 승인되지 않는다", () => {
    expect(
      resolveInitialStatus({ email: "student@school.hs.kr", role: "user", domains: [] })
    ).toBe("pending");
  });
});

describe("isAutoApprovedEmail — 도메인 화이트리스트", () => {
  it("도메인이 정확히 일치할 때만 통과한다", () => {
    expect(isAutoApprovedEmail("a@school.hs.kr", ["school.hs.kr"])).toBe(true);
  });

  it("허용 도메인을 접두사로 갖는 남의 도메인은 통과시키지 않는다", () => {
    // endsWith로 비교하면 뚫리는 케이스 — 우회 가입을 막는 핵심 방어선이다.
    expect(isAutoApprovedEmail("a@school.hs.kr.evil.com", ["school.hs.kr"])).toBe(false);
    expect(isAutoApprovedEmail("a@notschool.hs.kr", ["school.hs.kr"])).toBe(false);
  });

  it("@가 여러 개인 주소는 마지막 @ 뒤를 도메인으로 본다", () => {
    expect(isAutoApprovedEmail('"a@b"@school.hs.kr', ["school.hs.kr"])).toBe(true);
  });

  it("대소문자는 무시한다", () => {
    expect(isAutoApprovedEmail("A@School.HS.kr", ["school.hs.kr"])).toBe(true);
  });

  it("이메일이 없거나 목록이 비어 있으면 false", () => {
    expect(isAutoApprovedEmail(null, ["school.hs.kr"])).toBe(false);
    expect(isAutoApprovedEmail("a@school.hs.kr", [])).toBe(false);
    expect(isAutoApprovedEmail("골뱅이없음", ["school.hs.kr"])).toBe(false);
  });
});

describe("autoApproveDomains — env 파싱", () => {
  it("설정이 없으면 빈 목록 (= 전원 관리자 승인)", () => {
    expect(autoApproveDomains({} as NodeJS.ProcessEnv)).toEqual([]);
  });

  it("쉼표로 구분하고 공백·@·대문자를 정리한다", () => {
    expect(
      autoApproveDomains({ AUTO_APPROVE_EMAIL_DOMAINS: " @School.hs.kr , second.ac.kr " } as NodeJS.ProcessEnv)
    ).toEqual(["school.hs.kr", "second.ac.kr"]);
  });

  it("빈 항목은 버린다 (빈 문자열이 남으면 모든 도메인이 통과할 수 있다)", () => {
    expect(
      autoApproveDomains({ AUTO_APPROVE_EMAIL_DOMAINS: "a.kr,,," } as NodeJS.ProcessEnv)
    ).toEqual(["a.kr"]);
  });
});
