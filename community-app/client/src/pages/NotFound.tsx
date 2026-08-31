import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center px-4"
      style={{ backgroundColor: "var(--bg-base)" }}
    >
      <div className="text-center max-w-sm">
        <p className="font-serif text-6xl font-bold accent-text mb-4">404</p>
        <h1 className="text-xl mb-3">페이지를 찾을 수 없습니다</h1>
        <p className="text-muted-foreground mb-8 leading-relaxed">
          요청하신 페이지가 삭제되었거나, 주소가 바뀌었을 수 있어요.
        </p>
        <Button onClick={() => setLocation("/")} size="lg">
          홈으로 돌아가기
        </Button>
      </div>
    </div>
  );
}
