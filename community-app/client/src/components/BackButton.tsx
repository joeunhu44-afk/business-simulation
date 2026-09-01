import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/** 브라우저 히스토리가 있으면 뒤로가기, 없으면(직접 링크로 들어온 경우) fallback으로 이동. */
export default function BackButton({ fallback = "/" }: { fallback?: string }) {
  const goBack = () => {
    if (window.history.length > 1) window.history.back();
    else window.location.href = fallback;
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={goBack}
      aria-label="뒤로가기"
      className="rounded-full shrink-0"
    >
      <ArrowLeft className="h-5 w-5" />
    </Button>
  );
}
