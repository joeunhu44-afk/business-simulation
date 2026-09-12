# 배포 가이드 (마누스 외부 호스팅)

이 문서는 이 프로젝트를 마누스 밖에서 자체 도메인으로 배포하는 방법을 정리한 것입니다.
필요한 환경변수 전체 목록은 `.env.example`을 참고하세요.

---

## 0. 로컬에서 먼저 확인하기

```bash
pnpm install
cp .env.example .env   # 값을 채워넣기 전에는 로그인/스토리지 기능이 동작하지 않습니다
pnpm dev
```

`DATABASE_URL`, `JWT_SECRET`만 채워도 게시판 조회 등 로그인 없이 되는 기능은 바로 확인할 수 있습니다.

---

## 1. 데이터베이스 (MySQL)

`drizzle/schema.ts`가 사용자 테이블 구조를 정의합니다. 실제 DB에 반영하려면:

```bash
pnpm db:push
```

Railway를 쓰면 MySQL 플러그인을 추가하는 것만으로 `DATABASE_URL`이 자동으로 채워집니다 (3단계 참고).

---

## 2. 소셜 로그인 키 발급

### Google
1. https://console.cloud.google.com → 프로젝트 생성 → "API 및 서비스 > OAuth 동의 화면" 설정
2. "사용자 인증 정보 > OAuth 클라이언트 ID 만들기" → 애플리케이션 유형: 웹 애플리케이션
3. **승인된 리디렉션 URI**에 정확히 추가: `https://your-domain.com/api/auth/google/callback`
4. 발급된 클라이언트 ID/보안 비밀번호를 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`에 입력

### Kakao
1. https://developers.kakao.com → 애플리케이션 추가
2. "제품 설정 > 카카오 로그인" 활성화
3. **Redirect URI**에 정확히 추가: `https://your-domain.com/api/auth/kakao/callback`
4. "동의항목"에서 이메일/닉네임 항목을 활성화 (이메일은 비즈니스 앱 전환 또는 검수가 필요할 수 있음 — 검수 전에는 테스트로 등록한 카카오 계정만 이메일 제공됨)
5. "앱 키 > REST API 키"를 `KAKAO_CLIENT_ID`에 입력

### Apple
1. https://developer.apple.com/account → Certificates, Identifiers & Profiles
2. **Identifiers**에서 새 "Services ID" 생성 (예: `com.yourdomain.app.web`) → 이 값이 `APPLE_CLIENT_ID`
3. 해당 Services ID의 "Sign in with Apple" 설정에서 **Return URLs**에 추가: `https://your-domain.com/api/auth/apple/callback`
4. **Keys**에서 "Sign in with Apple" 키를 새로 생성 → 다운로드한 `.p8` 파일 내용을 `APPLE_PRIVATE_KEY`에, Key ID를 `APPLE_KEY_ID`에 입력
5. 계정 페이지 상단의 **Team ID**를 `APPLE_TEAM_ID`에 입력

> 어느 하나라도 값을 채우지 않으면 해당 로그인 버튼을 눌렀을 때 에러가 반환됩니다 (다른 로그인 수단은 정상 작동).

---

## 3. 업로드 파일 보관 — 재배포해도 사진이 남게 하기

> **가장 흔한 사고**: 아무 설정 없이 배포하면 업로드 파일이 컨테이너의 일반 디스크에 쌓입니다.
> Railway는 배포할 때마다 컨테이너를 새로 만들기 때문에, 배포 한 번에 프로필 사진과
> 게시물 사진이 **전부** 사라집니다. DB는 별도 서비스라 글과 계정은 그대로 남고
> 사진만 깨져 보이기 때문에 "DB가 초기화됐다"고 오해하기 쉽습니다.
>
> 아래 A · B 중 **하나는 반드시** 해야 합니다. 둘 다 안 돼 있으면 서버 부팅 로그와
> 관리자 패널 상단에 빨간 경고가 뜹니다.

### A. Railway Volume (간단 — 추가 계정 불필요, 권장)

1. Railway → 해당 서비스 → **Settings → Volumes → + New Volume**
2. Mount path를 `/data` 로 지정하고 생성
3. 재배포 (Volume을 붙이면 서비스가 자동으로 재시작됩니다)

`UPLOAD_DIR`은 **비워두면 됩니다.** Volume을 붙이면 Railway가 `RAILWAY_VOLUME_MOUNT_PATH`를
자동으로 넣어주고, 앱이 그 경로를 업로드 폴더로 사용합니다.
(직접 지정하고 싶으면 `UPLOAD_DIR`을 마운트 경로와 똑같이 설정하세요.)

확인 방법: 관리자 패널 상단에 `영구 디스크(/data)에 저장합니다` 라고 나오면 정상입니다.

한계: Volume은 서비스 인스턴스 한 대에 붙습니다. 나중에 서버를 여러 대로 늘리거나
이미지 트래픽이 많아지면 B로 옮기는 게 좋습니다.

### B. Cloudflare R2 (확장성 — 트래픽 비용 없음)

1. https://dash.cloudflare.com → R2 → 버킷 생성
2. **버킷은 비공개로 둡니다.** Public Access를 켜면 안 됩니다 — 이 앱은 로그인한
   사용자에게만 짧게 유효한 서명 URL을 발급해 사진을 보여주는데, 버킷이 공개되어
   있으면 주소만 아는 사람이 그 통제를 우회할 수 있습니다.
3. "R2 API 토큰 관리"에서 토큰 생성 → Access Key ID/Secret을
   `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`에 입력
4. 버킷 개요의 "S3 API" endpoint(`https://<account_id>.r2.cloudflarestorage.com`)를
   `S3_ENDPOINT`에 입력
5. `S3_BUCKET`에 버킷 이름, `S3_REGION`은 `auto`

AWS S3를 쓰려면 `S3_ENDPOINT`를 비우고(`server/storage.ts`의 `S3Client` 생성부를
리전 기반으로 소폭 수정) 나머지를 AWS 값으로 채우면 됩니다.

### 이미 사라진 사진은?

파일 자체가 없어진 것이라 복구할 수 없습니다. DB에는 주소만 남아 있어서 해당 게시물에는
"이미지를 불러올 수 없어요" 안내가 표시됩니다. 위 설정을 마친 뒤 새로 올린 사진부터는
재배포해도 유지됩니다.

---

## 4. 서버 배포 — Railway (권장)

이 앱은 Express 서버가 상시 실행되는 구조라 서버리스(Vercel 등)보다 Railway/Render/Fly.io처럼 컨테이너를 계속 띄워주는 곳이 잘 맞습니다.

1. https://railway.app → New Project → GitHub 저장소 연결 (또는 CLI로 배포)
2. "+ New" → Database → MySQL 추가 → `DATABASE_URL`이 자동 생성/연결됨
3. 서비스 설정 → Variables에 `.env.example`의 나머지 값 입력 (`APP_URL`은 5단계에서 도메인 연결 후 그 주소로)
4. Build Command: `pnpm build` / Start Command: `pnpm start` (Railway가 자동 감지하는 경우가 많음)
5. 배포 후 최초 1회 `pnpm db:push`를 Railway 콘솔(또는 로컬에서 배포된 `DATABASE_URL`을 가리켜)로 실행해 테이블 생성

---

## 5. 커스텀 도메인 연결

Railway 서비스 설정 → Settings → Networking → Custom Domain에 원하는 도메인 입력 → 안내되는 CNAME 레코드를 도메인 등록기관(가비아 등) DNS에 추가하면 SSL까지 자동 처리됩니다.

도메인이 연결되면:
- `APP_URL` 환경변수를 실제 도메인으로 갱신 (`https://your-domain.com`)
- Google/Kakao/Apple 콘솔에 등록한 redirect URI들도 실제 도메인 기준인지 다시 확인

---

## 체크리스트

- [ ] `JWT_SECRET` 설정 (`openssl rand -hex 32`)
- [ ] `DATABASE_URL` 연결 + `pnpm db:push` 실행
- [ ] `OWNER_EMAIL`에 본인 이메일 입력 (해당 이메일로 가입 시 자동 admin)
- [ ] 최소 하나 이상의 로그인 수단(소셜 또는 이메일) 동작 확인
- [ ] **업로드 보관 설정** — Railway Volume 추가(권장) 또는 R2 연결
      → 관리자 패널 상단에 빨간 경고가 없는지 확인
- [ ] 커스텀 도메인 연결 + `APP_URL` 갱신 + OAuth redirect URI 재확인
