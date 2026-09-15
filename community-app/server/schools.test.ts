import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { ENV } from "./_core/env";
import * as schools from "./schools";
import { resetRateLimits, RATE_LIMITS } from "./_core/rateLimit";

const originalKey = ENV.neisApiKey;

function ctxWithIp(ip = "1.2.3.4"): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {}, ip, socket: {} } as unknown as TrpcContext["req"],
    res: { cookie: () => {} } as unknown as TrpcContext["res"],
  };
}

beforeEach(() => {
  schools.resetSchoolCache();
  resetRateLimits();
});

afterEach(() => {
  ENV.neisApiKey = originalKey;
  vi.restoreAllMocks();
});

// 나이스가 실제로 돌려주는 모양. 성공/결과없음/오류의 형태가 서로 완전히 달라서
// 파싱을 잘못하면 "결과 없음"이 오류로 보이거나 그 반대가 된다.
const successBody = {
  schoolInfo: [
    { head: [{ list_total_count: 2 }, { RESULT: { CODE: "INFO-000", MESSAGE: "정상 처리되었습니다." } }] },
    {
      row: [
        {
          SD_SCHUL_CODE: "M100000001",
          SCHUL_NM: "신흥고등학교",
          ORG_RDNMA: "충청북도 청주시 상당구 대성로 103",
          LCTN_SC_NM: "충청북도",
          HS_SC_NM: "일반고",
          FOND_SC_NM: "사립",
          SCHUL_KND_SC_NM: "고등학교",
        },
        {
          SD_SCHUL_CODE: "M100000002",
          SCHUL_NM: "신흥여자고등학교",
          ORG_RDNMA: "   ",
          LCTN_SC_NM: "경기도",
          HS_SC_NM: "일반고",
          FOND_SC_NM: "공립",
        },
      ],
    },
  ],
};

/** Response 본문은 한 번만 읽을 수 있어서, 호출마다 새 객체를 만들어야 한다. */
function okResponse(): Response {
  return new Response(JSON.stringify(successBody), { status: 200 });
}

describe("나이스 응답 파싱", () => {
  it("학교 목록을 이름과 위치로 옮긴다", () => {
    const result = schools.parseNeisResponse(successBody);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      code: "M100000001",
      name: "신흥고등학교",
      address: "충청북도 청주시 상당구 대성로 103",
      region: "충청북도",
      kind: "일반고",
      foundation: "사립",
    });
  });

  it("주소가 공백뿐이면 null로 둔다 (화면에서 시도명으로 대체된다)", () => {
    const result = schools.parseNeisResponse(successBody);

    expect(result[1].address).toBeNull();
    expect(result[1].region).toBe("경기도");
  });

  it("결과 없음(INFO-200)은 오류가 아니라 빈 목록이다", () => {
    const body = { RESULT: { CODE: "INFO-200", MESSAGE: "해당하는 데이터가 없습니다." } };

    expect(schools.parseNeisResponse(body)).toEqual([]);
  });

  it("인증키 오류 등은 오류로 올린다", () => {
    const body = { RESULT: { CODE: "INFO-300", MESSAGE: "인증키가 유효하지 않습니다." } };

    expect(() => schools.parseNeisResponse(body)).toThrow(schools.SchoolSearchUnavailableError);
  });

  it("row가 아예 없으면 빈 목록", () => {
    expect(schools.parseNeisResponse({ schoolInfo: [{ head: [] }] })).toEqual([]);
  });

  it("코드나 이름이 빠진 줄은 버린다 (화면에서 구분할 수 없다)", () => {
    const body = {
      schoolInfo: [
        { head: [] },
        { row: [{ SCHUL_NM: "이름만있는학교" }, { SD_SCHUL_CODE: "X" }, { SD_SCHUL_CODE: "Y", SCHUL_NM: "정상고등학교" }] },
      ],
    };

    const result = schools.parseNeisResponse(body);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("정상고등학교");
  });

  it("응답이 엉뚱한 모양이면 오류로 올린다", () => {
    expect(() => schools.parseNeisResponse(null)).toThrow(schools.SchoolSearchUnavailableError);
    expect(() => schools.parseNeisResponse("문자열")).toThrow(schools.SchoolSearchUnavailableError);
  });
});

describe("학교 검색 요청", () => {
  it("고등학교만, 검색어를 그대로 넘긴다", async () => {
    ENV.neisApiKey = "test-key";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => okResponse());

    await schools.searchSchools("신흥", 10);

    const url = new URL((fetchSpy.mock.calls[0][0] as URL).toString());
    expect(url.searchParams.get("SCHUL_KND_SC_NM")).toBe("고등학교");
    expect(url.searchParams.get("SCHUL_NM")).toBe("신흥");
    expect(url.searchParams.get("pSize")).toBe("10");
    expect(url.searchParams.get("KEY")).toBe("test-key");
  });

  it("같은 검색어는 다시 묻지 않는다 (캐시)", async () => {
    ENV.neisApiKey = "test-key";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => okResponse());

    await schools.searchSchools("신흥", 10);
    await schools.searchSchools("신흥", 10);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("키가 없으면 호출조차 하지 않는다", async () => {
    ENV.neisApiKey = "";
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(schools.searchSchools("신흥")).rejects.toThrow(schools.SchoolSearchUnavailableError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("빈 검색어는 호출하지 않고 빈 목록", async () => {
    ENV.neisApiKey = "test-key";
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    expect(await schools.searchSchools("   ")).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("나이스가 죽어 있어도 예외가 새어나가지 않는다", async () => {
    ENV.neisApiKey = "test-key";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ETIMEDOUT"));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(schools.searchSchools("신흥")).rejects.toThrow(schools.SchoolSearchUnavailableError);
  });

  it("실패한 응답은 캐시하지 않는다 (복구되면 바로 되어야 한다)", async () => {
    ENV.neisApiKey = "test-key";
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("ETIMEDOUT"))
      .mockImplementation(async () => okResponse());

    await expect(schools.searchSchools("신흥", 10)).rejects.toThrow();
    const result = await schools.searchSchools("신흥", 10);

    expect(result).toHaveLength(2);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

describe("schools.search 라우터", () => {
  it("로그인 없이 검색할 수 있다 (로그인 화면에서 쓴다)", async () => {
    ENV.neisApiKey = "test-key";
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => okResponse());

    const result = await appRouter.createCaller(ctxWithIp()).schools.search({ query: "신흥" });

    expect(result.configured).toBe(true);
    expect(result.schools).toHaveLength(2);
  });

  it("키가 없으면 오류 대신 '준비 중'으로 알린다", async () => {
    ENV.neisApiKey = "";

    const result = await appRouter.createCaller(ctxWithIp()).schools.search({ query: "신흥" });

    expect(result.configured).toBe(false);
    expect(result.schools).toEqual([]);
  });

  it("한 글자는 거부한다 (전국 학교를 통째로 긁어오지 않도록)", async () => {
    await expect(appRouter.createCaller(ctxWithIp()).schools.search({ query: "신" })).rejects.toThrow();
  });

  it("IP별로 속도를 제한한다", async () => {
    ENV.neisApiKey = "test-key";
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => okResponse());

    const caller = appRouter.createCaller(ctxWithIp("9.9.9.9"));
    for (let i = 0; i < RATE_LIMITS.schoolSearch.max; i++) {
      await caller.schools.search({ query: `학교${i}` });
    }
    await expect(caller.schools.search({ query: "한번더" })).rejects.toThrow(
      RATE_LIMITS.schoolSearch.message
    );

    // 다른 IP는 영향을 받지 않아야 한다
    await expect(
      appRouter.createCaller(ctxWithIp("8.8.8.8")).schools.search({ query: "신흥" })
    ).resolves.toBeTruthy();
  });
});
