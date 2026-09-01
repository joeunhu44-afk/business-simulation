// 업로드 저장소 선택: S3/R2 환경변수가 설정돼 있으면 그쪽을 쓰고,
// 아니면 로컬 디스크(Railway Volume)에 저장한다. 호출부는 어느 쪽인지 신경 쓸 필요 없다.

import { ENV } from "./_core/env";
import { storagePut } from "./storage";
import { localStoragePut } from "./localStorage";

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
