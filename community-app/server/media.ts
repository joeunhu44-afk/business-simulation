// 업로드 저장소 선택: S3/R2 환경변수가 설정돼 있으면 그쪽을 쓰고,
// 아니면 로컬 디스크(Railway Volume)에 저장한다. 호출부는 어느 쪽인지 신경 쓸 필요 없다.

import { createHmac } from "node:crypto";
import { ENV } from "./_core/env";
import { storageDelete, storageKeyFromUrl, storagePut } from "./storage";
import { localStorageDelete, localStorageKeyFromUrl, localStoragePut } from "./localStorage";

export async function putUpload(
  key: string,
  data: Buffer,
  contentType: string
): Promise<{ key: string; url: string }> {
  if (ENV.s3.endpoint && ENV.s3.bucket) {
    return storagePut(key, data, contentType);
  }
  return localStoragePut(key, data);
}

function usingObjectStorage(): boolean {
  return Boolean(ENV.s3.endpoint && ENV.s3.bucket);
}

/**
 * 업로드된 파일을 URL로 지운다.
 *
 * 저장은 성공했는데 삭제가 실패했다고 해서 회원 탈퇴나 글 삭제 자체가 막히면 안 되므로,
 * 실패는 로그만 남기고 삼킨다(어차피 DB 참조는 끊긴 뒤다). 호출부는 결과를 기다릴 필요가 없다.
 */
export async function deleteUploadByUrl(url: string | null | undefined): Promise<void> {
  if (!url) return;
  try {
    if (usingObjectStorage()) {
      const key = storageKeyFromUrl(url);
      if (key) await storageDelete(key);
      return;
    }
    const key = localStorageKeyFromUrl(url);
    if (key) await localStorageDelete(key);
  } catch (error) {
    console.warn("[Media] 업로드 파일 삭제 실패:", url, error);
  }
}

/** 여러 URL을 한 번에 정리한다. */
export async function deleteUploadsByUrl(urls: (string | null | undefined)[]): Promise<void> {
  await Promise.all(urls.map((url) => deleteUploadByUrl(url)));
}

/**
 * 업로드 경로에 쓰는 사용자별 불투명 식별자.
 *
 * 예전에는 키가 "posts/<userId>/..." 라서 익명 글에 이미지를 올리면 URL에 작성자
 * 회원번호가 그대로 박혔다 — 응답에서 userId를 지워도 이미지 주소만 보면 누구인지
 * 알 수 있어 익명이 깨진다. 그래서 서버 비밀키로 HMAC을 떠서 되돌릴 수 없는 값으로 바꾼다.
 * 같은 사용자는 항상 같은 값이 나오므로 파일을 사용자별로 묶어두는 이점은 유지된다.
 */
export function uploadScopeId(userId: number): string {
  return createHmac("sha256", ENV.cookieSecret).update(`upload:${userId}`).digest("hex").slice(0, 16);
}
