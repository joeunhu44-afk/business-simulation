// 업로드 파일이 재배포 후에도 남는 곳에 저장되는지 점검한다.
//
// 배경: 컨테이너의 일반 디스크는 배포할 때마다 새로 만들어진다. 거기에 파일을 쓰면
// DB의 posts.images / users.avatarImageUrl 행은 그대로 남는데 파일만 사라져서,
// "DB가 초기화된 것처럼" 사진만 전부 깨져 보인다. 실제로 이 서비스에서 한 번 일어났다.
//
// 설정 실수는 조용히 지나가면 몇 주 뒤 사진이 날아간 뒤에야 발견되므로,
// 부팅할 때 로그로 크게 경고하고 관리자 화면에서도 현재 상태를 볼 수 있게 한다.

import path from "node:path";
import { ENV } from "./env";

export type StorageMode = "object-storage" | "volume" | "ephemeral" | "local-dev";

export type StorageHealth = {
  mode: StorageMode;
  /** 재배포/재시작 후에도 파일이 남는가 */
  persistent: boolean;
  /** 관리자 화면에 그대로 보여줄 한 줄 설명 */
  summary: string;
  /** 문제가 있을 때의 조치 안내 (없으면 null) */
  remedy: string | null;
  uploadDir: string;
};

export function describeStorage(): StorageHealth {
  const uploadDir = ENV.uploadDir;

  if (ENV.s3.endpoint && ENV.s3.bucket) {
    return {
      mode: "object-storage",
      persistent: true,
      summary: `오브젝트 스토리지(${ENV.s3.bucket})에 저장합니다. 재배포해도 사진이 유지됩니다.`,
      remedy: null,
      uploadDir,
    };
  }

  const mount = ENV.volumeMountPath;
  if (mount) {
    const root = path.resolve(mount);
    const dir = path.resolve(uploadDir);
    if (dir === root || dir.startsWith(root + path.sep)) {
      return {
        mode: "volume",
        persistent: true,
        summary: `영구 디스크(${root})에 저장합니다. 재배포해도 사진이 유지됩니다.`,
        remedy: null,
        uploadDir,
      };
    }
    return {
      mode: "ephemeral",
      persistent: false,
      summary: `영구 디스크가 ${root}에 붙어 있지만, 업로드 경로는 ${dir}입니다. 재배포하면 사진이 사라집니다.`,
      remedy: `UPLOAD_DIR 환경변수를 ${root} 로 바꾸거나 비워두세요(비우면 자동으로 영구 디스크를 씁니다).`,
      uploadDir,
    };
  }

  if (!ENV.isProduction) {
    return {
      mode: "local-dev",
      persistent: true,
      summary: `개발 환경입니다. ${path.resolve(uploadDir)} 폴더에 저장합니다.`,
      remedy: null,
      uploadDir,
    };
  }

  return {
    mode: "ephemeral",
    persistent: false,
    summary: `임시 디스크(${path.resolve(uploadDir)})에 저장하고 있습니다. 재배포하면 업로드된 사진이 모두 사라집니다.`,
    remedy:
      "배포 플랫폼에서 Volume(영구 디스크)을 추가하거나, S3/R2 환경변수(S3_ENDPOINT, S3_BUCKET 등)를 설정하세요.",
    uploadDir,
  };
}

/** 부팅 시 1회. 설정이 잘못됐으면 눈에 띄게 경고한다. */
export function warnIfEphemeralStorage(): void {
  const health = describeStorage();
  if (health.persistent) {
    console.log(`[Storage] ${health.summary}`);
    return;
  }
  console.warn("");
  console.warn("=".repeat(72));
  console.warn("[Storage] 경고: 업로드된 파일이 재배포 시 사라지는 위치에 저장됩니다.");
  console.warn(`[Storage] ${health.summary}`);
  console.warn(`[Storage] 조치: ${health.remedy}`);
  console.warn("=".repeat(72));
  console.warn("");
}
