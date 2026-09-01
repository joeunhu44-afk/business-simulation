import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, MessageSquareText } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import HeaderMenuButton from "@/components/HeaderMenuButton";
import BackButton from "@/components/BackButton";

const CATEGORY_LABELS: Record<string, string> = {
  general: "일반 문의",
  bug: "버그 신고",
  suggestion: "건의사항",
  report_abuse: "신고 관련",
  account: "계정 문의",
};

export default function InquiryPage() {
  const { isAuthenticated, loading } = useAuth();
  const [category, setCategory] = useState("general");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const utils = trpc.useUtils();
  const { data: myInquiries, isLoading } = trpc.inquiries.listMine.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const createMutation = trpc.inquiries.create.useMutation({
    onSuccess: () => {
      toast.success("문의가 접수되었습니다");
      setTitle("");
      setContent("");
      setCategory("general");
      utils.inquiries.listMine.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "문의 접수에 실패했습니다");
    },
  });

  const handleSubmit = () => {
    if (!title.trim() || !content.trim()) {
      toast.error("제목과 내용을 입력해주세요");
      return;
    }
    createMutation.mutate({
      category: category as any,
      title: title.trim(),
      content: content.trim(),
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl mb-4">로그인이 필요합니다</h1>
          <a href="/" className="inline-block">
            <Button>홈으로 돌아가기</Button>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-3 z-40 mx-3 sm:mx-6 lg:mx-auto lg:max-w-6xl rounded-2xl border border-border bg-card/90 backdrop-blur-md shadow-sm">
        <div className="container flex items-center gap-2 py-4">
          <BackButton />
          <HeaderMenuButton />
          <a href="/" className="font-serif text-xl font-bold accent-text hover:opacity-80 transition-opacity">
            커뮤니티
          </a>
        </div>
      </nav>

      <div className="container py-8 max-w-2xl">
        <div className="mb-8 flex items-center gap-3">
          <MessageSquareText className="h-6 w-6 accent-text shrink-0" />
          <div>
            <h1 className="text-2xl">문의하기</h1>
            <p className="text-sm text-muted-foreground mt-1">불편한 점이나 건의사항을 관리자에게 전달해주세요.</p>
          </div>
        </div>

        <Card className="card-elevated p-6 mb-8">
          <div className="space-y-4">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="제목"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Textarea
              placeholder="문의 내용을 자세히 적어주세요"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-32"
            />
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending}
              className="w-full sm:w-auto"
            >
              {createMutation.isPending ? "접수 중..." : "문의 보내기"}
            </Button>
          </div>
        </Card>

        <div>
          <h2 className="section-heading text-lg mb-4">내가 보낸 문의</h2>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : myInquiries && myInquiries.length > 0 ? (
            <div className="space-y-3">
              {myInquiries.map((inquiry) => (
                <Card key={inquiry.id} className="card-elevated p-5">
                  <div className="flex items-center gap-2 mb-1.5 min-w-0">
                    <span className="tag-pill shrink-0">
                      {CATEGORY_LABELS[inquiry.category] || inquiry.category}
                    </span>
                    <span
                      className="text-xs font-semibold shrink-0"
                      style={{ color: inquiry.status === "answered" ? "var(--accent-color)" : "var(--text-muted)" }}
                    >
                      {inquiry.status === "answered" ? "답변 완료" : "답변 대기중"}
                    </span>
                  </div>
                  <h3 className="font-semibold mb-1 truncate">{inquiry.title}</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap mb-2">{inquiry.content}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(inquiry.createdAt), { locale: ko, addSuffix: true })}
                  </p>
                  {inquiry.adminReply && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-xs font-semibold accent-text mb-1">관리자 답변</p>
                      <p className="text-sm whitespace-pre-wrap">{inquiry.adminReply}</p>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <Card className="card-elevated p-8 text-center">
              <p className="text-muted-foreground">보낸 문의가 없습니다</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
