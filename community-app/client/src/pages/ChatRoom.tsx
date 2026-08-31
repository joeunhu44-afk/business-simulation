import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useLocation, useParams } from "wouter";
import { Loader2, ChevronLeft, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import HeaderMenuButton from "@/components/HeaderMenuButton";

export default function ChatRoom() {
  const { id } = useParams<{ id: string }>();
  const conversationId = Number(id);
  const { user, loading: authLoading } = useAuth({ redirectOnUnauthenticated: true });
  const [, navigate] = useLocation();
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  const { data, isLoading, error } = trpc.chat.getMessages.useQuery(
    { conversationId },
    { enabled: !!user && Number.isFinite(conversationId), refetchInterval: 4000 }
  );

  const markReadMutation = trpc.chat.markRead.useMutation();

  // 메시지 로드 시 읽음 처리
  useEffect(() => {
    if (data && data.messages.length > 0) {
      markReadMutation.mutate({ conversationId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.messages.length, conversationId]);

  // 새 메시지 도착 시 스크롤 하단으로
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.messages.length]);

  const sendMutation = trpc.chat.sendMessage.useMutation({
    onSuccess: () => {
      setDraft("");
      utils.chat.getMessages.invalidate({ conversationId });
    },
    onError: (err) => {
      toast.error(err.message || "메시지를 보낼 수 없습니다");
    },
  });

  const handleSend = () => {
    const content = draft.trim();
    if (!content) return;
    sendMutation.mutate({ conversationId, content });
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="mb-4">{error.message}</p>
          <Button onClick={() => navigate("/chat")}>대화 목록으로</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <nav className="border-b border-border bg-card sticky top-0 z-40">
        <div className="container flex items-center gap-2 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/chat")} className="shrink-0">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <HeaderMenuButton />
          <div
            className="h-9 w-9 rounded-full flex items-center justify-center font-semibold shrink-0"
            style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent-color)" }}
          >
            {(data?.otherUserName || "?").charAt(0)}
          </div>
          <h1 className="text-lg truncate">{data?.otherUserName || "대화"}</h1>
        </div>
      </nav>

      <div className="flex-1 container max-w-2xl py-6 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !data || data.messages.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            첫 메시지를 보내보세요
          </div>
        ) : (
          <div className="space-y-3">
            {data.messages.map((m) => {
              const mine = m.senderId === user.id;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                      mine
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-card text-foreground rounded-bl-sm border border-border"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    <p className={`text-[10px] mt-1 ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {new Date(m.createdAt).toLocaleTimeString("ko-KR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="border-t border-border bg-card sticky bottom-0">
        <div className="container max-w-2xl py-3 flex items-center gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="메시지 입력..."
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={sendMutation.isPending || !draft.trim()}
            className="shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
