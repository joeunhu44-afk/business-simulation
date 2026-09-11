import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useEffect, useState } from "react";
import NotifyConsentFields, { EMPTY_NOTIFY_CONSENT } from "@/components/NotifyConsentFields";
import { useLocation } from "wouter";
import { toast } from "sonner";

type Mode = "login" | "signup";

const STUDENT_NAME_PLACEHOLDER = "예: 20223 조은후";

/**
 * 소셜 로그인 버튼. 각 사의 공식 심볼을 인라인 SVG로 넣는다(에셋 파일 없이).
 * 세 버튼의 높이(h-12)·폰트 크기(text-sm)·로고 크기(18px)·간격(gap-2.5)을 통일해
 * 실제 서비스의 소셜 로그인 블록과 같은 리듬으로 보이게 한다.
 */
function GoogleLogo() {
  // 구글 브랜드 가이드라인의 4색 "G" 마크
  return (
    <svg className="size-[18px]" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function KakaoLogo() {
  // 카카오톡 말풍선 심볼 (노란 배경 위 검정)
  return (
    <svg className="size-[18px]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 3C6.477 3 2 6.463 2 10.733c0 2.708 1.797 5.09 4.51 6.46-.2.73-.72 2.62-.825 3.028-.13.506.185.5.39.363.16-.107 2.556-1.737 3.59-2.44.764.113 1.55.172 2.335.172 5.523 0 10-3.463 10-7.733S17.523 3 12 3z" />
    </svg>
  );
}

function AppleLogo() {
  // 애플 심볼 (검정 배경 위 흰색)
  return (
    <svg className="size-[18px]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.05 12.04c-.03-2.85 2.33-4.22 2.44-4.28-1.33-1.95-3.4-2.21-4.13-2.24-1.76-.18-3.43 1.03-4.32 1.03-.89 0-2.26-1.01-3.72-.98-1.91.03-3.67 1.11-4.65 2.82-1.98 3.44-.51 8.52 1.42 11.31.94 1.36 2.06 2.89 3.53 2.83 1.42-.06 1.95-.91 3.66-.91 1.71 0 2.19.91 3.68.88 1.52-.03 2.48-1.39 3.41-2.75 1.07-1.58 1.51-3.11 1.54-3.19-.03-.01-2.95-1.13-2.98-4.48zM14.5 3.6c.78-.95 1.31-2.27 1.17-3.6-1.13.05-2.5.75-3.31 1.7-.72.84-1.36 2.19-1.19 3.48 1.26.1 2.55-.64 3.33-1.58z" />
    </svg>
  );
}

const OAUTH_BUTTON_BASE = "w-full justify-center gap-2.5 h-12 text-sm font-medium";

function OAuthButtons() {
  return (
    <div className="flex flex-col gap-2.5">
      <a href="/api/auth/google">
        <Button
          variant="outline"
          className={`${OAUTH_BUTTON_BASE} border-[var(--border-color)] bg-white text-[#1f1f1f] hover:bg-black/[0.04]`}
        >
          <GoogleLogo />
          Google로 계속하기
        </Button>
      </a>
      <a href="/api/auth/kakao">
        <Button className={`${OAUTH_BUTTON_BASE} bg-[#FEE500] text-black hover:bg-[#FEE500]/90`}>
          <KakaoLogo />
          카카오로 계속하기
        </Button>
      </a>
      <a href="/api/auth/apple">
        <Button className={`${OAUTH_BUTTON_BASE} bg-black text-white hover:bg-black/90`}>
          <AppleLogo />
          Apple로 계속하기
        </Button>
      </a>
    </div>
  );
}

export default function LoginPage() {
  const [, navigate] = useLocation();
  // 소셜 로그인은 서버에서 리다이렉트로 돌아오므로, 차단(가입 거절) 사유를
  // 쿼리스트링으로 받아 한 번만 띄운다.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") !== "blocked") return;
    const reason = params.get("reason");
    toast.error(reason ? `이용이 제한된 계정입니다 (사유: ${reason})` : "이용이 제한된 계정입니다");
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(EMPTY_NOTIFY_CONSENT);

  const utils = trpc.useUtils();

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      navigate("/");
    },
    onError: (error) => {
      toast.error(error.message || "로그인에 실패했습니다");
    },
  });

  const signupMutation = trpc.auth.signup.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      navigate("/");
    },
    onError: (error) => {
      toast.error(error.message || "회원가입에 실패했습니다");
    },
  });

  const isPending = loginMutation.isPending || signupMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "login") {
      loginMutation.mutate({ email, password });
    } else {
      signupMutation.mutate({ email, password, name, ...consent });
    }
  };

  // 하단 여백은 전역 ScrollEdgeFade(화면 아래 h-20/h-28 페이드 오버레이)보다 커야 한다.
  // 그렇지 않으면 폼 맨 아래 회원가입 버튼이 페이드에 덮여 그라데이션처럼 흐려 보인다.
  return (
    <div className="min-h-screen flex items-center justify-center px-4 pt-16 pb-32 sm:pb-36" style={{ backgroundColor: "var(--bg-base)" }}>
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <a href="/" className="font-serif text-3xl font-bold accent-text">
            커뮤니티
          </a>
          <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>
            {mode === "login" ? "다시 만나서 반가워요" : "가입하고 이야기를 시작해보세요"}
          </p>
        </div>

        <div className="flex flex-col gap-6">
          <OAuthButtons />

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" style={{ borderColor: "var(--border-color)" }} />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3" style={{ backgroundColor: "var(--bg-base)", color: "var(--text-muted)" }}>
                또는 이메일로
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" className="text-sm font-normal" style={{ color: "var(--text-normal)" }}>이메일</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-11"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password" className="text-sm font-normal" style={{ color: "var(--text-normal)" }}>비밀번호</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={4}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11"
              />
            </div>
            {mode === "signup" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name" className="text-sm font-normal" style={{ color: "var(--text-normal)" }}>이름 (학번 + 이름)</Label>
                <Input
                  id="name"
                  required
                  pattern="^\d{5} .+$"
                  title="학번(5자리) 이름 형식으로 입력해주세요"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={STUDENT_NAME_PLACEHOLDER}
                  className="h-11"
                />
              </div>
            )}
            {mode === "signup" && (
              <NotifyConsentFields value={consent} onChange={setConsent} disabled={isPending} />
            )}

            <Button type="submit" className="w-full h-11 mt-1" disabled={isPending}>
              {mode === "login" ? "로그인" : "회원가입"}
            </Button>
          </form>

          <button
            type="button"
            className="text-sm text-center hover:opacity-70 transition-opacity"
            style={{ color: "var(--text-muted)" }}
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
          >
            {mode === "login"
              ? "계정이 없으신가요? 회원가입"
              : "이미 계정이 있으신가요? 로그인"}
          </button>
        </div>
      </div>
    </div>
  );
}
