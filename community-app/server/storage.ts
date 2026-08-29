// S3 호환 오브젝트 스토리지 (Cloudflare R2, AWS S3 등) 업로드/다운로드 헬퍼.
// R2를 쓰는 경우 S3_ENDPOINT에 https://<account_id>.r2.cloudflarestorage.com 를 넣으면 된다.

import {
  GetObjectCommand,
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

function publicUrlFor(key: string): string {
  if (!ENV.s3.publicUrl) {
    throw new Error("Storage config missing: set S3_PUBLIC_URL");
  }
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
): Promise<{ key: string; url: string }> {
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

/** 이미 저장된 파일의 공개 URL을 반환한다 (버킷이 공개인 경우). */
export function storageGet(relKey: string): { key: string; url: string } {
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
