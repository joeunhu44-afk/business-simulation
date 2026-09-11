// 업로드 파일 접근 통제.
//
// 예전에는 /uploads 를 express.static 으로 그냥 열어두고, R2를 쓰는 경우에는 아예
// 앱을 거치지 않는 공개 URL을 DB에 저장했다. 주소만 알면 로그인 없이 누구나 볼 수 있어서,
// 익명 글에 올린 사진도 링크가 한 번 새어 나가면 그대로 열렸다.
//
// 이제 모든 업로드는 이 라우트를 거친다. 로그인한 사용자만 통과시키고,
//  - R2를 쓰면 짧게 유효한 서명 URL로 302 리다이렉트하고 (버킷은 비공개여야 한다)
//  - 로컬 디스크면 파일을 직접 스트리밍한다.

import { COOKIE_NAME } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import fs from "node:fs";
import path from "node:path";
import * as db from "../db";
import { ENV } from "./env";
import { verifySessionToken } from "./auth/session";
import { storageGetSignedUrl } from "../storage";

/** 서명 URL 유효 시간. 짧을수록 안전하지만, 너무 짧으면 이미지가 로드되다 만료된다. */
const SIGNED_URL_TTL_SECONDS = 300;

/** 로그인한(차단되지 않은) 사용자인지. 승인 대기 중이어도 글은 읽을 수 있으므로 통과시킨다. */
async function resolveViewer(req: Request): Promise<number | null> {
  try {
    const cookies = parseCookieHeader(req.headers.cookie ?? "");
    const userId = await verifySessionToken(cookies[COOKIE_NAME]);
    if (userId === null) return null;
    const user = await db.getUserById(userId);
    if (!user || user.status === "blocked") return null;
    return user.id;
  } catch {
    return null;
  }
}

function usingObjectStorage(): boolean {
  return Boolean(ENV.s3.endpoint && ENV.s3.bucket);
}

export function registerMediaRoutes(app: Express) {
  // Express 4의 와일드카드는 req.params[0]에 담긴다 (Express 5의 :splat 문법이 아니다).
  app.get("/uploads/*", async (req: Request, res: Response) => {
    const viewer = await resolveViewer(req);
    if (viewer === null) {
      res.status(401).send("로그인이 필요합니다");
      return;
    }

    const raw = (req.params as unknown as Record<string, string>)[0] ?? "";
    const key = decodeURIComponent(raw).replace(/^\/+/, "");
    if (!key) {
      res.status(404).send("Not found");
      return;
    }

    if (usingObjectStorage()) {
      try {
        const signed = await storageGetSignedUrl(key, SIGNED_URL_TTL_SECONDS);
        // 캐시에 남아 계속 열리면 통제가 무의미해지므로 재검증을 강제한다.
        res.setHeader("Cache-Control", "private, no-store");
        res.redirect(302, signed);
      } catch (error) {
        console.warn("[Media] 서명 URL 발급 실패:", key, error);
        res.status(404).send("Not found");
      }
      return;
    }

    // 로컬 디스크: ".." 등으로 업로드 디렉터리 밖을 읽지 못하게 경로를 검증한다.
    const root = path.resolve(ENV.uploadDir);
    const filePath = path.resolve(root, key);
    if (filePath !== root && !filePath.startsWith(root + path.sep)) {
      res.status(403).send("Forbidden");
      return;
    }
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      res.status(404).send("Not found");
      return;
    }

    res.setHeader("Cache-Control", "private, max-age=300");
    res.sendFile(filePath);
  });
}
