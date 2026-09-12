// 앱 실행에 필요한 환경변수를 한 곳에 모아둔 파일.
// 값은 .env 파일 또는 배포 플랫폼(Railway 등)의 환경변수 설정에서 채워야 한다.
// .env.example 파일을 참고할 것.

function required(name: string, value: string) {
  if (!value && ENV_IS_PRODUCTION) {
    console.warn(`[ENV] ${name} is not set. Related features will not work.`);
  }
  return value;
}

const ENV_IS_PRODUCTION = process.env.NODE_ENV === "production";

export const ENV = {
  isProduction: ENV_IS_PRODUCTION,
  /** 세션(JWT) 서명에 사용하는 비밀키. 반드시 길고 무작위한 문자열로 설정할 것. */
  cookieSecret: required("JWT_SECRET", process.env.JWT_SECRET ?? ""),
  databaseUrl: process.env.DATABASE_URL ?? "",
  /** 이 이메일로 가입/로그인하는 사용자는 자동으로 admin 권한을 받는다. */
  ownerEmail: (process.env.OWNER_EMAIL ?? "").toLowerCase(),
  /** 배포된 앱의 실제 주소 (예: https://mydomain.com). OAuth redirect URI 생성에 사용. */
  appUrl: process.env.APP_URL ?? "http://localhost:3000",

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  },
  kakao: {
    clientId: process.env.KAKAO_CLIENT_ID ?? "",
    // 카카오는 client secret이 선택사항 (카카오 개발자 콘솔에서 활성화한 경우만 필요)
    clientSecret: process.env.KAKAO_CLIENT_SECRET ?? "",
  },
  apple: {
    // Apple의 "Services ID" (예: com.mydomain.app.web)
    clientId: process.env.APPLE_CLIENT_ID ?? "",
    teamId: process.env.APPLE_TEAM_ID ?? "",
    keyId: process.env.APPLE_KEY_ID ?? "",
    // .p8 파일 내용을 그대로 환경변수에 붙여넣으면 줄바꿈이 \n 문자열로 들어오므로 복원
    privateKey: (process.env.APPLE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
  },

  /** S3 호환 오브젝트 스토리지 (Cloudflare R2, AWS S3 등) 설정. 설정돼 있으면 로컬 디스크보다 우선 사용된다. */
  s3: {
    endpoint: process.env.S3_ENDPOINT ?? "",
    region: process.env.S3_REGION ?? "auto",
    bucket: process.env.S3_BUCKET ?? "",
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    /** 업로드된 파일에 접근할 때 사용할 공개 URL prefix (예: https://cdn.mydomain.com) */
    publicUrl: process.env.S3_PUBLIC_URL ?? "",
  },

  /**
   * 업로드 파일을 저장할 로컬 디스크 경로 (S3를 설정하지 않았을 때 사용).
   *
   * 컨테이너의 일반 디스크는 재배포할 때마다 통째로 새로 만들어진다. 그 위에 파일을
   * 저장하면 배포 한 번에 프로필 사진과 게시물 사진이 전부 사라진다. 파일이 남으려면
   * Volume(영구 디스크)을 붙이거나 S3/R2를 설정해야 한다.
   *
   * Railway에서 Volume을 붙이면 RAILWAY_VOLUME_MOUNT_PATH가 자동으로 채워지므로,
   * UPLOAD_DIR을 따로 설정하지 않아도 그 경로를 쓰도록 했다 (설정 빠뜨림 방지).
   */
  uploadDir: process.env.UPLOAD_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || "uploads",

  /** 배포 플랫폼이 알려주는 영구 디스크 마운트 경로. 없으면 영구 디스크가 없다는 뜻. */
  volumeMountPath: process.env.RAILWAY_VOLUME_MOUNT_PATH ?? "",
};
