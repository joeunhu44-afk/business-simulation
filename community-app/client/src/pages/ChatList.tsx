import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import { Loader2, MessageCircle, ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import HeaderMenuButton from "@/components/HeaderMenuButton";
export default function ChatList() {
  const { user, loading: authLoading } = useAuth({ redirectOnUnauthenticated: true });
  const [, navigate] = useLocation();

  const { data: conversations, isLoading, error, refetch } = trpc.chat.listConversations.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 5000,
  });

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-3 z-40 mx-3 sm:mx-6 lg:mx-auto lg:max-w-6xl rounded-2xl border border-border bg-card/90 backdrop-blur-md shadow-sm">
        <div className="container flex items-center gap-2 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="shrink-0">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <HeaderMenuButton />
          <h1 className="text-xl">메시지</h1>
        </div>
      </nav>

      <div className="container max-w-2xl py-6">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="text-center py-20 space-y-3">
            <p className="text-destructive">대화 목록을 불러오지 못했습니다</p>
            <Button variant="outline" onClick={() => refetch()}>
              다시 시도
            </Button>
          </div>
        ) : !conversations || conversations.length === 0 ? (
          <div className="text-center py-20">
            <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-40" />
            <p className="text-muted-foreground">아직 대화가 없습니다</p>
            <p className="text-sm text-muted-foreground mt-1">
              왼쪽 상단 메뉴의 검색에서 사용자를 찾아 채팅을 시작해보세요
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map((conv) => (
              <Link key={conv.id} href={`/chat/${conv.id}`}>
                <Card className="card-elevated p-4 flex items-center gap-3 cursor-pointer">
                  <div
                    className="h-11 w-11 rounded-full flex items-center justify-center font-semibold shrink-0"
                    style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent-color)" }}
                  >
                    {(conv.otherUserName || "?").charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold truncate">{conv.otherUserName}</p>
                      {conv.lastMessageAt && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatDistanceToNow(new Date(conv.lastMessageAt), {
                            addSuffix: true,
                            locale: ko,
                          })}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {conv.lastMessage || "새 대화"}
                    </p>
                  </div>
                  {conv.unreadCount > 0 && (
                    <span className="shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                      {conv.unreadCount}
                    </span>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
