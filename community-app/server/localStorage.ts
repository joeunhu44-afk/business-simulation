// Railway Volume 등 로컬 디스크에 파일을 저장하는 헬퍼. S3/R2를 설정하지 않았을 때 쓰인다.
// 저장된 파일은 /uploads/<key> 정적 경로로 같은 서버에서 바로 서빙된다 (server/_core/index.ts 참고).

import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ENV } from "./_core/env";

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function localStoragePut(
  relKey: string,
  data: Buffer | Uint8Array
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const filePath = path.join(ENV.uploadDir, key);

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, data);

  // z.string().url() 검증(posts.images 등)을 통과하도록 절대 URL로 돌려준다.
  const base = ENV.appUrl.replace(/\/+$/, "");
  return { key, url: `${base}/uploads/${key}` };
}

/** 로컬 디스크에서 파일을 지운다. 이미 없으면 조용히 넘어간다. */
export async function localStorageDelete(relKey: string): Promise<void> {
  const key = normalizeKey(relKey);
  // key에 ".."가 섞이면 업로드 디렉터리 밖 파일을 지울 수 있으므로, 정규화한 경로가
  // 업로드 디렉터리 안에 있는지 반드시 확인한다.
  const root = path.resolve(ENV.uploadDir);
  const filePath = path.resolve(root, key);
  if (filePath !== root && !filePath.startsWith(root + path.sep)) return;

  try {
    await fs.unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

/** /uploads/<key> 형태의 URL에서 키를 되돌린다. 형식이 다르면 null. */
export function localStorageKeyFromUrl(url: string): string | null {
  const marker = "/uploads/";
  const idx = url.indexOf(marker);
  return idx === -1 ? null : url.slice(idx + marker.length);
}
