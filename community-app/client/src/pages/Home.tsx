import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, ArrowRight, Search as SearchIcon, ThumbsUp, MessageCircle, MessageSquareText, Newspaper, Compass, Megaphone, Hash, UtensilsCrossed } from "lucide-react";
import { getLoginUrl } from "@/const";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import HeaderMenuButton from "@/components/HeaderMenuButton";
import Reveal from "@/components/Reveal";
import HomeSpaceBackground from "@/components/HomeSpaceBackground";
import { isAdminRole } from "@/lib/role";

const FEATURES = [
  { title: "게시판", desc: "관심사에 맞는 게시판을 찾아 이야기를 나눠요" },
  { title: "댓글과 추천", desc: "생각에 공감하고, 다른 시선을 들어봐요" },
  { title: "검색", desc: "지나간 이야기도 금방 다시 찾을 수 있어요" },
  { title: "공지사항", desc: "놓치면 아쉬운 소식을 상단에 모아둬요" },
  { title: "쪽지", desc: "1:1로 조용히 대화를 이어갈 수 있어요" },
  { title: "문의함", desc: "불편한 점은 관리자에게 바로 전달할 수 있어요" },
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
      <div className="min-h-screen relative">
        <HomeSpaceBackground />
        <div className="p-3 sm:p-5">
          <div className="hero-panel min-h-[560px] md:min-h-[640px] flex flex-col">
            {/* Glass floating nav */}
            <nav className="glass-nav-dark sticky top-3 z-40 mx-3 sm:mx-5 mt-3 sm:mt-5 rounded-full">
              <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3">
                <a href="/" className="font-serif text-lg font-bold text-white shrink-0">커뮤니티</a>
                <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-xs mx-4">
                  <div className="flex-1 relative">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60" />
                    <input
                      placeholder="검색..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full h-9 pl-10 pr-4 rounded-full bg-white/10 border border-white/15 text-sm text-white placeholder:text-white/50 outline-none focus:bg-white/15 transition-colors"
                    />
                  </div>
                </form>
                <Button asChild size="sm" className="rounded-full bg-white text-[#3d0a10] hover:bg-white/90 shrink-0">
                  <a href={getLoginUrl()}>로그인</a>
                </Button>
              </div>
            </nav>

            {/* Hero content */}
            <div className="flex-1 flex items-center px-6 sm:px-12 py-16 sm:py-20">
              <Reveal className="max-w-2xl">
                <p className="text-sm tracking-wide text-white/70 mb-5">조용히, 그러나 꾸준히 이어지는 이야기</p>
                <h1 className="text-4xl md:text-6xl font-bold leading-[1.15] text-white mb-6">
                  오늘 하루의 이야기를<br />여기에 남겨보세요
                </h1>
                <p className="text-base md:text-lg text-white/75 leading-relaxed max-w-lg mb-8">
                  가볍게 시작해서 오래 머물게 되는 공간. 관심사가 맞는 친구들과
                  부담 없이 이야기를 나눠보세요.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <Button asChild size="lg" className="h-12 px-8 rounded-full bg-white text-[#3d0a10] hover:bg-white/90 font-semibold">
                    <a href={getLoginUrl()}>시작하기</a>
                  </Button>
                  <a
                    href="#features"
                    className="inline-flex items-center gap-1.5 h-12 px-6 rounded-full border border-white/30 text-white text-sm font-semibold hover:bg-white/10 transition-colors"
                  >
                    더 알아보기 <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                </div>
              </Reveal>
            </div>
          </div>
        </div>

        {/* Features */}
        <div id="features" className="py-20">
          <div className="container">
            <Reveal className="text-center mb-14">
              <h2 className="text-2xl">이 공간에서 할 수 있는 것들</h2>
            </Reveal>
            <div className="grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto">
              {FEATURES.map((feature, idx) => (
                <Reveal key={idx} delay={idx * 0.06} className="space-y-1.5">
                  <span className="text-xs font-mono accent-text">{String(idx + 1).padStart(2, "0")}</span>
                  <h3 className="font-semibold text-foreground">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="border-t border-border py-20 text-center">
          <Reveal>
            <h2 className="text-2xl mb-6">지금 바로 시작해보세요</h2>
            <Button asChild size="lg" className="h-11 px-8 rounded-full">
              <a href={getLoginUrl()}>로그인하기</a>
            </Button>
          </Reveal>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <HomeSpaceBackground />
      {/* Navigation */}
      <nav className="sticky top-3 z-40 mx-3 sm:mx-6 lg:mx-auto lg:max-w-6xl rounded-2xl border border-border bg-card/90 backdrop-blur-md shadow-sm">
        <div className="container flex items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-2 shrink-0">
            <HeaderMenuButton />
            <a href="/" className="font-serif text-xl font-bold accent-text hover:opacity-80 transition-opacity">
              커뮤니티
            </a>
          </div>
          <div className="flex items-center gap-4 min-w-0">
            <span className="text-sm text-muted-foreground truncate">{user?.name || "사용자"}</span>
            {isAdminRole(user?.role) && (
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
              <h2 className="section-heading mb-6 text-xl">게시판</h2>
              {boardsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : boards && boards.length > 0 ? (
                <div className="space-y-4">
                  {boards.map((board, idx) => (
                    <Reveal key={board.id} delay={Math.min(idx, 5) * 0.03} duration={0.32} slide={false}>
                      <div className="card-elevated board-card overflow-hidden">
                        <div className="flex flex-col sm:flex-row">
                          <Link
                            href={`/board/${board.slug}`}
                            className="flex sm:w-56 shrink-0 items-start gap-3 p-5 hover:bg-secondary/50 transition-colors"
                          >
                            <span className="category-icon h-9 w-9 shrink-0">
                              <Hash className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                              <h3 className="font-semibold text-base leading-tight">{board.name}</h3>
                              <p className="text-sm text-muted-foreground leading-relaxed mt-1">{board.description}</p>
                            </div>
                          </Link>
                          <div className="hidden sm:block w-px shrink-0 self-stretch my-4" style={{ background: "var(--border-color)" }} />
                          <div className="block sm:hidden h-px w-full" style={{ background: "var(--border-color)" }} />
                          <div className="flex-1 min-w-0 p-5">
                            <BoardPostList boardId={board.id} />
                          </div>
                        </div>
                      </div>
                    </Reveal>
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
          <div className="space-y-4">
            <NewsPanel />
            <QuickLinksPanel />
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickLinksPanel() {
  return (
    <Card className="card-elevated p-4">
      <h3 className="panel-header font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-3">
        <span className="panel-icon"><Compass className="h-3.5 w-3.5" /></span>
        바로가기
      </h3>
      <div className="space-y-1">
        <Link
          href="/inquiries"
          className="flex items-center gap-2.5 rounded-lg px-2 py-2 -mx-2 text-sm font-medium hover:bg-secondary transition-colors"
        >
          <MessageSquareText className="h-4 w-4 accent-text shrink-0" />
          문의하기
        </Link>
        <a
          href="https://school.cbe.go.kr/shinheung-h/M010304"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 rounded-lg px-2 py-2 -mx-2 text-sm font-medium hover:bg-secondary transition-colors"
        >
          <MessageCircle className="h-4 w-4 text-muted-foreground shrink-0" />
          신흥톡톡
        </a>
        <a
          href="https://school.cbe.go.kr/shinheung-h/M01030801"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 rounded-lg px-2 py-2 -mx-2 text-sm font-medium hover:bg-secondary transition-colors"
        >
          <UtensilsCrossed className="h-4 w-4 text-muted-foreground shrink-0" />
          급식표
        </a>
      </div>
    </Card>
  );
}

function BoardPostList({ boardId }: { boardId: number }) {
  const { data: posts, isLoading } = trpc.posts.listByBoard.useQuery({ boardId, limit: 5, sortBy: 'latest' });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!posts || posts.length === 0) {
    return <p className="text-sm text-muted-foreground py-2">아직 게시글이 없어요</p>;
  }

  return (
    <div className="space-y-1.5">
      {posts.map((post) => (
        <Link
          key={post.id}
          href={`/post/${post.id}`}
          className="flex items-center gap-2 text-sm rounded-lg px-2 py-1.5 -mx-2 hover:bg-secondary transition-colors"
        >
          <span className="truncate min-w-0 flex-1 font-medium text-foreground/85">{post.title}</span>
          <span className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
            <span className="flex items-center gap-0.5">
              <ThumbsUp className="h-3 w-3" />
              {post.likeCount}
            </span>
            <span className="flex items-center gap-0.5">
              <MessageCircle className="h-3 w-3" />
              {post.commentCount}
            </span>
          </span>
        </Link>
      ))}
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
      <h3 className="panel-header font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-3">
        <span className="panel-icon"><Newspaper className="h-3.5 w-3.5" /></span>
        오늘의 뉴스
      </h3>
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
      <h3 className="panel-header font-semibold text-xs text-muted-foreground uppercase tracking-wide">
        <span className="panel-icon"><Megaphone className="h-3.5 w-3.5" /></span>
        공지사항
      </h3>
      <div className="space-y-2">
        {announcements.map((announcement) => (
          <Card key={announcement.id} className="card-elevated p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="tag-pill">공지</span>
              <h4 className="font-semibold text-sm">{announcement.title}</h4>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">{announcement.content}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
