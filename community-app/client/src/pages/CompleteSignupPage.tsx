import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function CompleteSignupPage() {
  const [, navigate] = useLocation();
  const [name, setName] = useState("");

  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") ?? "";

  const utils = trpc.useUtils();
  const completeMutation = trpc.auth.completeOAuthSignup.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      navigate("/");
    },
    onError: (error) => {
      toast.error(error.message || "가입 완료에 실패했습니다");
    },
  });

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4" style={{ backgroundColor: "var(--bg-base)" }}>
        <p className="text-sm text-muted-foreground text-center">
          잘못된 접근입니다.{" "}
          <a href="/login" className="accent-text underline">
            로그인 페이지로 이동
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16" style={{ backgroundColor: "var(--bg-base)" }}>
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <a href="/" className="font-serif text-3xl font-bold accent-text">커뮤니티</a>
          <p className="mt-3 text-sm text-muted-foreground">
            거의 다 왔어요. 이용하실 이름만 알려주세요.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            completeMutation.mutate({ token, name });
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name" className="text-sm font-normal" style={{ color: "var(--text-normal)" }}>이름 (학번 + 이름)</Label>
            <Input
              id="name"
              required
              autoFocus
              pattern="^\d{5} .+$"
              title="학번(5자리) 이름 형식으로 입력해주세요"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 20223 조은후"
              className="h-11"
            />
          </div>
          <Button type="submit" className="w-full h-11 mt-1" disabled={completeMutation.isPending}>
            가입 완료
          </Button>
        </form>
      </div>
    </div>
  );
}
