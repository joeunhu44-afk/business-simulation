import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ENV } from "./_core/env";
import { describeStorage } from "./_core/storageHealth";

// ENV는 모듈 로드 시 한 번 계산되므로, 테스트에서는 필드를 직접 바꿨다가 되돌린다.
const original = {
  isProduction: ENV.isProduction,
  uploadDir: ENV.uploadDir,
  volumeMountPath: ENV.volumeMountPath,
  endpoint: ENV.s3.endpoint,
  bucket: ENV.s3.bucket,
};

beforeEach(() => {
  ENV.isProduction = true;
  ENV.uploadDir = "uploads";
  ENV.volumeMountPath = "";
  ENV.s3.endpoint = "";
  ENV.s3.bucket = "";
});

afterEach(() => {
  ENV.isProduction = original.isProduction;
  ENV.uploadDir = original.uploadDir;
  ENV.volumeMountPath = original.volumeMountPath;
  ENV.s3.endpoint = original.endpoint;
  ENV.s3.bucket = original.bucket;
});

describe("업로드 보관 위치 점검", () => {
  it("아무 설정이 없으면 '사라지는 위치'로 판정한다 (실제로 사진이 날아갔던 상황)", () => {
    const health = describeStorage();

    expect(health.mode).toBe("ephemeral");
    expect(health.persistent).toBe(false);
    expect(health.remedy).not.toBeNull();
  });

  it("S3/R2가 설정돼 있으면 안전하다", () => {
    ENV.s3.endpoint = "https://acc.r2.cloudflarestorage.com";
    ENV.s3.bucket = "community";

    const health = describeStorage();

    expect(health.mode).toBe("object-storage");
    expect(health.persistent).toBe(true);
    expect(health.remedy).toBeNull();
  });

  it("볼륨 안에 저장하면 안전하다", () => {
    ENV.volumeMountPath = "/data";
    ENV.uploadDir = "/data";

    const health = describeStorage();

    expect(health.mode).toBe("volume");
    expect(health.persistent).toBe(true);
  });

  it("볼륨 하위 폴더도 안전하다", () => {
    ENV.volumeMountPath = "/data";
    ENV.uploadDir = "/data/uploads";

    expect(describeStorage().persistent).toBe(true);
  });

  it("볼륨은 붙였는데 업로드 경로가 그 밖이면 경고한다 (가장 하기 쉬운 실수)", () => {
    ENV.volumeMountPath = "/data";
    ENV.uploadDir = "uploads";

    const health = describeStorage();

    expect(health.persistent).toBe(false);
    expect(health.remedy).toContain("UPLOAD_DIR");
  });

  it("이름만 비슷한 옆 디렉터리를 볼륨 안으로 착각하지 않는다", () => {
    ENV.volumeMountPath = "/data";
    ENV.uploadDir = "/data-backup/uploads";

    expect(describeStorage().persistent).toBe(false);
  });

  it("로컬 개발에서는 경고하지 않는다", () => {
    ENV.isProduction = false;

    const health = describeStorage();

    expect(health.mode).toBe("local-dev");
    expect(health.persistent).toBe(true);
  });
});
