import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type Mode = "login" | "signup";

const STUDENT_NAME_PLACEHOLDER = "예: 20223 조은후";

function OAuthButtons() {
  return (
    <div className="flex flex-col gap-2.5">
      <a href="/api/auth/google">
        <Button
          variant="outline"
          className="w-full justify-center gap-2 h-11 border-[var(--border-color)] font-normal"
        >
          Google로 계속하기
        </Button>
      </a>
      <a href="/api/auth/kakao">
        <Button className="w-full justify-center gap-2 h-11 bg-[#FEE500] text-black hover:bg-[#FEE500]/90 font-normal">
          카카오로 계속하기
        </Button>
      </a>
      <a href="/api/auth/apple">
        <Button className="w-full justify-center gap-2 h-11 bg-[#1a1a1a] text-white hover:bg-[#1a1a1a]/90 font-normal">
          Apple로 계속하기
        </Button>
      </a>
    </div>
  );
}

export default function LoginPage() {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

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
      signupMutation.mutate({ email, password, name });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16" style={{ backgroundColor: "var(--bg-base)" }}>
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
