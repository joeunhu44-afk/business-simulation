import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-6 text-center text-sm text-gray-600">
            잘못된 접근입니다.{" "}
            <a href="/login" className="underline">
              로그인 페이지로 이동
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl text-center">가입 완료</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <p className="text-sm text-gray-600 text-center">
            앱에서 사용할 이름을 입력해주세요.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              completeMutation.mutate({ token, name });
            }}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">이름 (학번 + 이름)</Label>
              <Input
                id="name"
                required
                autoFocus
                pattern="^\d{5} .+$"
                title="학번(5자리) 이름 형식으로 입력해주세요"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 20223 조은후"
              />
            </div>
            <Button type="submit" className="w-full" disabled={completeMutation.isPending}>
              가입 완료
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
