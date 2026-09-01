import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useLocation, useParams } from "wouter";
import { Loader2, ChevronLeft, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import HeaderMenuButton from "@/components/HeaderMenuButton";
import Avatar from "@/components/Avatar";
import { isToday, isYesterday, format } from "date-fns";
import { ko } from "date-fns/locale";

const GROUP_WINDOW_MS = 5 * 60 * 1000;

function dayLabel(date: Date): string {
  if (isToday(date)) return "오늘";
  if (isYesterday(date)) return "어제";
  return format(date, "yyyy년 M월 d일", { locale: ko });
}

type ChatMessage = {
  id: number;
  senderId: number;
  content: string;
  isRead: boolean;
  createdAt: string | Date;
};

/** 메시지 배열을 [날짜 구분, 발신자+시간 근접 그룹] 구조로 미리 계산해둔다. */
function buildTimeline(messages: ChatMessage[]) {
  const items: { message: ChatMessage; isFirstInGroup: boolean; isLastInGroup: boolean; showDateSeparator: boolean }[] = [];
  messages.forEach((m, i) => {
    const prev = messages[i - 1];
    const next = messages[i + 1];
    const curDate = new Date(m.createdAt);
    const prevDate = prev ? new Date(prev.createdAt) : null;
    const nextDate = next ? new Date(next.createdAt) : null;

    const showDateSeparator = !prevDate || curDate.toDateString() !== prevDate.toDateString();
    const isFirstInGroup =
      showDateSeparator || !prev || prev.senderId !== m.senderId || curDate.getTime() - prevDate!.getTime() > GROUP_WINDOW_MS;
    const isLastInGroup =
      !next ||
      next.senderId !== m.senderId ||
      curDate.toDateString() !== nextDate!.toDateString() ||
      nextDate!.getTime() - curDate.getTime() > GROUP_WINDOW_MS;

    items.push({ message: m, isFirstInGroup, isLastInGroup, showDateSeparator });
  });
  return items;
}

export default function ChatRoom() {
  const { id } = useParams<{ id: string }>();
  const conversationId = Number(id);
  const { user, loading: authLoading } = useAuth({ redirectOnUnauthenticated: true });
  const [, navigate] = useLocation();
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const utils = trpc.useUtils();

  const { data, isLoading, error } = trpc.chat.getMessages.useQuery(
    { conversationId },
    { enabled: !!user && Number.isFinite(conversationId), refetchInterval: 4000 }
  );

  const markReadMutation = trpc.chat.markRead.useMutation();

  useEffect(() => {
    if (data && data.messages.length > 0) {
      markReadMutation.mutate({ conversationId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.messages.length, conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.messages.length]);

  // 입력창 자동 높이 조절 (최대 5줄 정도)
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [draft]);

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

  const timeline = useMemo(() => buildTimeline((data?.messages ?? []) as ChatMessage[]), [data?.messages]);

  // 내가 보낸 마지막 메시지 — 상대가 읽었으면 그 아래에 "읽음" 표시
  const lastMineId = useMemo(() => {
    const mine = (data?.messages ?? []).filter((m) => m.senderId === user?.id);
    return mine.length > 0 ? mine[mine.length - 1].id : null;
  }, [data?.messages, user?.id]);

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
      <nav className="sticky top-3 z-40 mx-3 sm:mx-6 lg:mx-auto lg:max-w-6xl rounded-2xl border border-border bg-card/90 backdrop-blur-md shadow-sm">
        <div className="container flex items-center gap-2 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/chat")} className="shrink-0">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <HeaderMenuButton />
          {data && (
            <Avatar
              userId={data.otherUserId}
              isAnonymous={false}
              name={data.otherUserName}
              avatarEmoji={data.otherUserAvatarEmoji}
              avatarImageUrl={data.otherUserAvatarImageUrl}
              size="h-9 w-9"
              textSize="text-sm"
            />
          )}
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
          <div className="space-y-0.5">
            {timeline.map(({ message: m, isFirstInGroup, isLastInGroup, showDateSeparator }) => {
              const mine = m.senderId === user.id;
              const showReadReceipt = mine && isLastInGroup && m.id === lastMineId && m.isRead;

              return (
                <div key={m.id}>
                  {showDateSeparator && (
                    <div className="flex justify-center my-4">
                      <span className="stat-pill">{dayLabel(new Date(m.createdAt))}</span>
                    </div>
                  )}
                  <div className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"} ${isFirstInGroup ? "mt-3" : "mt-0.5"}`}>
                    {!mine && (
                      <div className="w-7 shrink-0">
                        {isLastInGroup && data && (
                          <Avatar
                            userId={data.otherUserId}
                            isAnonymous={false}
                            name={data.otherUserName}
                            avatarEmoji={data.otherUserAvatarEmoji}
                            avatarImageUrl={data.otherUserAvatarImageUrl}
                            size="h-7 w-7"
                            textSize="text-xs"
                          />
                        )}
                      </div>
                    )}
                    <div className={`flex flex-col ${mine ? "items-end" : "items-start"} max-w-[75%]`}>
                      <div
                        className={`px-4 py-2 text-sm break-words whitespace-pre-wrap ${
                          mine
                            ? `bg-primary text-primary-foreground ${isLastInGroup ? "rounded-2xl rounded-br-md" : "rounded-2xl"}`
                            : `bg-card text-foreground border border-border ${isLastInGroup ? "rounded-2xl rounded-bl-md" : "rounded-2xl"}`
                        }`}
                      >
                        {m.content}
                      </div>
                      {isLastInGroup && (
                        <div className="flex items-center gap-1.5 mt-1 px-1">
                          {showReadReceipt && <span className="text-[10px] accent-text font-semibold">읽음</span>}
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(m.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="border-t border-border bg-card sticky bottom-0">
        <div className="container max-w-2xl py-3 flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="메시지 입력..."
            rows={1}
            className="search-input flex-1 resize-none px-4 py-2.5 text-sm leading-relaxed max-h-[120px] outline-none focus:border-primary transition-colors"
          />
          <Button
            onClick={handleSend}
            disabled={sendMutation.isPending || !draft.trim()}
            size="icon"
            className="shrink-0 rounded-full"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
