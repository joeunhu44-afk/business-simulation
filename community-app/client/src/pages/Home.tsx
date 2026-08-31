import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, ArrowRight, Search as SearchIcon, ThumbsUp, MessageCircle } from "lucide-react";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import HeaderMenuButton from "@/components/HeaderMenuButton";

const FEATURES = [
  { title: "게시판", desc: "관심사에 맞는 게시판을 찾아 이야기를 나눠요" },
  { title: "댓글과 추천", desc: "생각에 공감하고, 다른 시선을 들어봐요" },
  { title: "검색", desc: "지나간 이야기도 금방 다시 찾을 수 있어요" },
  { title: "공지사항", desc: "놓치면 아쉬운 소식을 상단에 모아둬요" },
  { title: "쪽지", desc: "1:1로 조용히 대화를 이어갈 수 있어요" },
  { title: "신고와 관리", desc: "불편한 게시물은 바로 신고할 수 있어요" },
];

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const { data: boards, isLoading: boardsLoading } = trpc.boards.list.useQuery();
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        {/* Navigation */}
        <nav className="border-b border-border bg-card">
          <div className="container flex items-center justify-between py-4">
            <a href="/" className="font-serif text-xl font-bold accent-text">커뮤니티</a>
            <div className="flex items-center gap-4">
              <form onSubmit={handleSearch} className="hidden sm:flex gap-2 flex-1 max-w-xs">
                <div className="flex-1 relative">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-9 search-input"
                  />
                </div>
              </form>
              <Button asChild size="sm">
                <a href={getLoginUrl()}>로그인</a>
              </Button>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <div className="container py-24 md:py-32">
          <div className="max-w-2xl mx-auto text-center space-y-7">
            <p className="text-sm tracking-wide text-muted-foreground">조용히, 그러나 꾸준히 이어지는 이야기</p>
            <h1 className="text-4xl md:text-5xl leading-[1.25] text-foreground">
              오늘 하루의 이야기를<br />여기에 남겨보세요
            </h1>
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-lg mx-auto">
              가볍게 시작해서 오래 머물게 되는 공간. 관심사가 맞는 사람들과
              부담 없이 이야기를 나눠보세요.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button asChild size="lg" className="h-11 px-7">
                <a href={getLoginUrl()}>시작하기</a>
              </Button>
              <a
                href="#features"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                더 알아보기 <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>

        {/* Features */}
        <div id="features" className="border-t border-border py-20">
          <div className="container">
            <h2 className="text-2xl mb-12 text-center">이 공간에서 할 수 있는 것들</h2>
            <div className="grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto">
              {FEATURES.map((feature, idx) => (
                <div key={idx} className="space-y-1.5">
                  <span className="text-xs font-mono text-muted-foreground">{String(idx + 1).padStart(2, "0")}</span>
                  <h3 className="font-semibold text-foreground">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="border-t border-border py-20 text-center">
          <h2 className="text-2xl mb-6">지금 바로 시작해보세요</h2>
          <Button asChild size="lg" className="h-11 px-8">
            <a href={getLoginUrl()}>로그인하기</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-card sticky top-0 z-40">
        <div className="container flex items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-2 shrink-0">
            <HeaderMenuButton />
            <a href="/" className="font-serif text-xl font-bold accent-text hover:opacity-80 transition-opacity">
              커뮤니티
            </a>
          </div>
          <div className="flex items-center gap-4 min-w-0">
            <span className="text-sm text-muted-foreground truncate">{user?.name || "사용자"}</span>
            {user?.role === 'admin' && (
              <a href="/admin" className="text-sm font-semibold accent-text hover:underline shrink-0">
                관리자
              </a>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container py-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <div>
            {/* Announcements */}
            <div className="mb-8 pb-8 border-b border-border">
              <AnnouncementsSection />
            </div>

            {/* Boards Grid */}
            <div>
              <h2 className="mb-6 text-xl">게시판</h2>
              {boardsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : boards && boards.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {boards.map((board) => (
                    <a
                      key={board.id}
                      href={`/board/${board.slug}`}
                      className="card-elevated block p-6"
                    >
                      <h3 className="font-semibold text-base mb-1.5">{board.name}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{board.description}</p>
                      <BoardPreview boardId={board.id} />
                    </a>
                  ))}
                </div>
              ) : (
                <Card className="card-elevated p-12 text-center">
                  <p className="text-muted-foreground">게시판이 없습니다.</p>
                </Card>
              )}
            </div>
          </div>

          {/* News Panel (top-right) */}
          <div>
            <NewsPanel />
          </div>
        </div>
      </div>
    </div>
  );
}

function BoardPreview({ boardId }: { boardId: number }) {
  const { data: latestPosts } = trpc.posts.listByBoard.useQuery({ boardId, limit: 1, sortBy: 'latest' });
  const { data: popularPosts } = trpc.posts.listByBoard.useQuery({ boardId, limit: 1, sortBy: 'popular' });

  const latest = latestPosts?.[0];
  const popular = popularPosts?.[0] && popularPosts[0].id !== latest?.id ? popularPosts[0] : undefined;

  if (!latest && !popular) return null;

  return (
    <div className="mt-3 pt-3 border-t border-border space-y-1.5">
      {latest && <BoardPreviewRow label="최신" post={latest} />}
      {popular && <BoardPreviewRow label="인기" post={popular} />}
    </div>
  );
}

function BoardPreviewRow({
  label,
  post,
}: {
  label: string;
  post: { title: string; likeCount: number; commentCount: number };
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="font-semibold accent-text shrink-0">{label}</span>
      <span className="shrink-0">·</span>
      <span className="truncate min-w-0 flex-1">{post.title}</span>
      <span className="flex items-center gap-2 shrink-0">
        <span className="flex items-center gap-0.5">
          <ThumbsUp className="h-3 w-3" />
          {post.likeCount}
        </span>
        <span className="flex items-center gap-0.5">
          <MessageCircle className="h-3 w-3" />
          {post.commentCount}
        </span>
      </span>
    </div>
  );
}

function NewsPanel() {
  const { data: newsItems, isLoading } = trpc.news.list.useQuery({ limit: 5 });

  if (isLoading) {
    return (
      <Card className="card-elevated p-4">
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      </Card>
    );
  }

  if (!newsItems || newsItems.length === 0) return null;

  return (
    <Card className="card-elevated p-4">
      <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-3">오늘의 뉴스</h3>
      <div className="space-y-3">
        {newsItems.map((item) =>
          item.url ? (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sm font-medium leading-snug hover:accent-text hover:underline"
            >
              {item.title}
            </a>
          ) : (
            <p key={item.id} className="text-sm font-medium leading-snug">
              {item.title}
            </p>
          )
        )}
      </div>
    </Card>
  );
}

function AnnouncementsSection() {
  const { data: announcements, isLoading } = trpc.announcements.list.useQuery({ limit: 5 });

  if (isLoading) return null;
  if (!announcements || announcements.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">공지사항</h3>
      <div className="space-y-2">
        {announcements.map((announcement) => (
          <Card key={announcement.id} className="card-elevated p-4 border-l-4 border-l-accent">
            <h4 className="font-semibold text-sm mb-1">{announcement.title}</h4>
            <p className="text-xs text-muted-foreground line-clamp-2">{announcement.content}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
