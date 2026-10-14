import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENV } from "./_core/env";
import * as storage from "./storage";
import * as local from "./localStorage";
import { deleteUploadByUrl, mediaUrlFor } from "./media";

const original = {
  endpoint: ENV.s3.endpoint,
  bucket: ENV.s3.bucket,
  publicUrl: ENV.s3.publicUrl,
  appUrl: ENV.appUrl,
};

beforeEach(() => {
  ENV.appUrl = "https://community.example.com";
});

afterEach(() => {
  ENV.s3.endpoint = original.endpoint;
  ENV.s3.bucket = original.bucket;
  ENV.s3.publicUrl = original.publicUrl;
  ENV.appUrl = original.appUrl;
  vi.restoreAllMocks();
});

describe("비공개 버킷", () => {
  it("S3_PUBLIC_URL이 없어도 공개 URL 조회가 터지지 않는다", () => {
    // 버킷을 비공개로 두라고 안내하고 있으므로 S3_PUBLIC_URL이 없는 게 정상이다.
    // 예전에는 여기서 예외를 던져 업로드 자체가 실패했다.
    ENV.s3.publicUrl = "";
    expect(() => storage.storageGet("avatars/a/1.png")).not.toThrow();
    expect(storage.storageGet("avatars/a/1.png").url).toBeNull();
  });

  it("공개 URL이 설정돼 있으면 그대로 만들어준다", () => {
    ENV.s3.publicUrl = "https://cdn.example.com";
    expect(storage.storageGet("avatars/a/1.png").url).toBe(
      "https://cdn.example.com/avatars/a/1.png"
    );
  });

  it("저장되는 주소는 버킷이 아니라 앱을 거친다 (주소만 알아도 못 열게)", () => {
    expect(mediaUrlFor("avatars/a/1.png")).toBe(
      "https://community.example.com/uploads/avatars/a/1.png"
    );
  });
});

describe("볼륨 → R2 전환", () => {
  it("R2를 켜도 볼륨에 있던 예전 파일을 함께 지운다", async () => {
    // 주소만으로는 볼륨에 있는지 버킷에 있는지 알 수 없다. 한쪽만 지우면 파일이 남는다.
    ENV.s3.endpoint = "https://acc.r2.cloudflarestorage.com";
    ENV.s3.bucket = "uploads";
    const s3del = vi.spyOn(storage, "storageDelete").mockResolvedValue(undefined);
    const localdel = vi.spyOn(local, "localStorageDelete").mockResolvedValue(undefined);

    await deleteUploadByUrl("https://community.example.com/uploads/avatars/a/1.png");

    expect(s3del).toHaveBeenCalledWith("avatars/a/1.png");
    expect(localdel).toHaveBeenCalledWith("avatars/a/1.png");
  });

  it("R2를 안 쓰면 버킷은 건드리지 않는다", async () => {
    ENV.s3.endpoint = "";
    ENV.s3.bucket = "";
    const s3del = vi.spyOn(storage, "storageDelete").mockResolvedValue(undefined);
    const localdel = vi.spyOn(local, "localStorageDelete").mockResolvedValue(undefined);

    await deleteUploadByUrl("https://community.example.com/uploads/avatars/a/1.png");

    expect(s3del).not.toHaveBeenCalled();
    expect(localdel).toHaveBeenCalledWith("avatars/a/1.png");
  });

  it("삭제가 실패해도 예외가 새어나가지 않는다 (탈퇴·글삭제가 막히면 안 된다)", async () => {
    ENV.s3.endpoint = "https://acc.r2.cloudflarestorage.com";
    ENV.s3.bucket = "uploads";
    vi.spyOn(storage, "storageDelete").mockRejectedValue(new Error("network"));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(
      deleteUploadByUrl("https://community.example.com/uploads/avatars/a/1.png")
    ).resolves.toBeUndefined();
  });

  it("주소가 없으면 아무것도 지우지 않는다", async () => {
    const localdel = vi.spyOn(local, "localStorageDelete").mockResolvedValue(undefined);
    await deleteUploadByUrl(null);
    await deleteUploadByUrl("");
    expect(localdel).not.toHaveBeenCalled();
  });
});
