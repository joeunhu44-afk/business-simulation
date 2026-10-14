// S3 호환 오브젝트 스토리지 (Cloudflare R2, AWS S3 등) 업로드/다운로드 헬퍼.
// R2를 쓰는 경우 S3_ENDPOINT에 https://<account_id>.r2.cloudflarestorage.com 를 넣으면 된다.

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { ENV } from "./_core/env";

let _client: S3Client | null = null;

function getClient(): S3Client {
  if (_client) return _client;

  const { endpoint, region, accessKeyId, secretAccessKey } = ENV.s3;
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Storage config missing: set S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY"
    );
  }

  _client = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    // R2는 path-style 요청을 사용한다.
    forcePathStyle: true,
  });
  return _client;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

/**
 * 공개 URL. 버킷을 비공개로 두면 S3_PUBLIC_URL이 없는 게 정상이므로 null을 돌려준다.
 * (이 앱은 앱을 거친 서명 URL로만 파일을 내보내므로 공개 URL이 없어도 된다.)
 */
function publicUrlFor(key: string): string | null {
  if (!ENV.s3.publicUrl) return null;
  return `${ENV.s3.publicUrl.replace(/\/+$/, "")}/${key}`;
}

/**
 * 파일을 버킷에 직접 업로드하고 공개 URL을 반환한다.
 * 버킷이 공개 읽기로 설정되어 있어야 반환된 url로 바로 접근 가능하다 (R2 Public Access 또는 커스텀 도메인 연결).
 */
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string | null }> {
  if (!ENV.s3.bucket) {
    throw new Error("Storage config missing: set S3_BUCKET");
  }

  const key = appendHashSuffix(normalizeKey(relKey));

  await getClient().send(
    new PutObjectCommand({
      Bucket: ENV.s3.bucket,
      Key: key,
      Body: data,
      ContentType: contentType,
    })
  );

  return { key, url: publicUrlFor(key) };
}

/** 이미 저장된 파일의 공개 URL을 반환한다 (버킷이 공개인 경우에만 url이 채워진다). */
export function storageGet(relKey: string): { key: string; url: string | null } {
  const key = normalizeKey(relKey);
  return { key, url: publicUrlFor(key) };
}

/**
 * 버킷을 비공개로 운영하는 경우, 임시로 유효한 서명된 다운로드 URL을 발급한다.
 */
export async function storageGetSignedUrl(
  relKey: string,
  expiresInSeconds = 3600
): Promise<string> {
  if (!ENV.s3.bucket) {
    throw new Error("Storage config missing: set S3_BUCKET");
  }
  const key = normalizeKey(relKey);
  const command = new GetObjectCommand({ Bucket: ENV.s3.bucket, Key: key });
  return getSignedUrl(getClient(), command, { expiresIn: expiresInSeconds });
}

/**
 * 버킷에 이 키가 실제로 있는지 확인한다.
 *
 * 서명 URL은 객체가 없어도 발급되기 때문에, 없는 키로 리다이렉트하면 사용자는
 * 깨진 이미지만 보게 된다. 볼륨에 있던 예전 파일을 계속 서빙하려면 먼저 물어봐야 한다.
 */
export async function storageHas(relKey: string): Promise<boolean> {
  const key = normalizeKey(relKey);
  try {
    await getClient().send(new HeadObjectCommand({ Bucket: ENV.s3.bucket, Key: key }));
    return true;
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404 || status === 403) return false;
    // 설정 오류나 장애는 "없음"으로 삼키면 안 된다 — 호출부가 판단하게 올린다.
    throw error;
  }
}

/**
 * 버킷에서 객체를 지운다. 이미 없는 키여도 S3/R2는 성공으로 응답하므로 호출부가
 * 존재 여부를 먼저 확인할 필요는 없다.
 */
export async function storageDelete(relKey: string): Promise<void> {
  const key = normalizeKey(relKey);
  await getClient().send(
    new DeleteObjectCommand({ Bucket: ENV.s3.bucket, Key: key })
  );
}

/** 공개 URL에서 버킷 키를 되돌린다. 다른 도메인의 URL이면 null. */
export function storageKeyFromUrl(url: string): string | null {
  if (!ENV.s3.publicUrl) return null;
  const base = `${ENV.s3.publicUrl.replace(/\/+$/, "")}/`;
  return url.startsWith(base) ? url.slice(base.length) : null;
}
