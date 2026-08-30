import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, MessageCircle, Users, Zap, Search as SearchIcon } from "lucide-react";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import HeaderMenuButton from "@/components/HeaderMenuButton";

export default function Home() {
  const { user, loading, isAuthenticated, logout } = useAuth();
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
      <div className="min-h-screen bg-gradient-to-br from-background to-muted">
        {/* Navigation */}
        <nav className="border-b border-gray-200 bg-white shadow-sm">
          <div className="container flex items-center justify-between py-4">
            <div className="text-2xl font-bold text-primary">커뮤니티</div>
            <div className="flex items-center gap-4">
              <form onSubmit={handleSearch} className="flex gap-2 flex-1 max-w-xs">
                <div className="flex-1 relative">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600" />
                  <Input
                    placeholder="검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-9 search-input"
                  />
                </div>
                <Button type="submit" size="sm">검색</Button>
              </form>
              <Button asChild>
                <a href={getLoginUrl()}>로그인</a>
              </Button>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <div className="container py-20">
          <div className="grid gap-12 md:grid-cols-2 md:items-center">
            <div className="space-y-6">
              <h1 className="text-4xl font-bold leading-tight text-gray-900">
                우아한 커뮤니티에서 <span className="text-primary">자유롭게 소통하세요</span>
              </h1>
              <p className="text-lg text-gray-600">
                다양한 주제의 게시판에서 의견을 나누고, 익명으로 자유롭게 표현하며, 함께 성장하는 공간입니다.
              </p>
              <div className="flex gap-4">
                <Button asChild size="lg">
                  <a href={getLoginUrl()}>시작하기</a>
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <a href="#features">더 알아보기</a>
                </Button>
              </div>
            </div>

            <div className="grid gap-4">
              <Card className="card-elevated p-6">
                <MessageCircle className="mb-4 h-8 w-8 text-primary" />
                <h3 className="font-semibold">자유로운 소통</h3>
                <p className="text-sm text-gray-600">익명 옵션으로 자유롭게 의견을 나눠보세요</p>
              </Card>
              <Card className="card-elevated p-6">
                <Users className="mb-4 h-8 w-8 text-primary" />
                <h3 className="font-semibold">다양한 커뮤니티</h3>
                <p className="text-sm text-gray-600">여러 게시판에서 관심사를 공유하세요</p>
              </Card>
              <Card className="card-elevated p-6">
                <Zap className="mb-4 h-8 w-8 text-primary" />
                <h3 className="font-semibold">활발한 상호작용</h3>
                <p className="text-sm text-gray-600">추천과 댓글로 의견을 나누세요</p>
              </Card>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div id="features" className="border-t border-gray-200 bg-white py-20">
          <div className="container">
            <h2 className="mb-12 text-center text-3xl font-bold">주요 기능</h2>
            <div className="grid gap-8 md:grid-cols-3">
              {[
                { title: "게시판 관리", desc: "다양한 주제의 게시판을 탐색하세요" },
                { title: "게시글 작성", desc: "자신의 생각을 자유롭게 표현하세요" },
                { title: "댓글 토론", desc: "다른 사용자와 의견을 나누세요" },
                { title: "추천 시스템", desc: "좋은 글에 추천을 해주세요" },
                { title: "검색 기능", desc: "원하는 글을 쉽게 찾아보세요" },
                { title: "공지사항", desc: "중요한 소식을 놓치지 마세요" },
              ].map((feature, idx) => (
                <Card key={idx} className="card-elevated p-6 text-center">
                  <h3 className="mb-2 font-semibold">{feature.title}</h3>
                  <p className="text-sm text-gray-600">{feature.desc}</p>
                </Card>
              ))}
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="container py-20 text-center">
          <h2 className="mb-6 text-3xl font-bold">지금 바로 시작하세요</h2>
          <Button asChild size="lg">
            <a href={getLoginUrl()}>로그인하기</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-gray-200 bg-white shadow-sm sticky top-0 z-40">
        <div className="container flex items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <HeaderMenuButton />
            <a href="/" className="text-2xl font-bold text-primary hover:opacity-80 transition-opacity">
              커뮤니티
            </a>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.name || "사용자"}</span>
            {user?.role === 'admin' && (
              <a href="/admin" className="text-sm font-semibold text-primary hover:underline">
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
            <div className="mb-8">
              <AnnouncementsSection />
            </div>

            {/* Boards Grid */}
            <div>
              <h2 className="mb-6 text-2xl font-bold">게시판</h2>
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
                      className="card-elevated block p-6 hover:shadow-md transition-shadow"
                    >
                      <h3 className="font-semibold text-lg mb-2">{board.name}</h3>
                      <p className="text-sm text-gray-600">{board.description}</p>
                    </a>
                  ))}
                </div>
              ) : (
                <Card className="card-elevated p-12 text-center">
                  <p className="text-gray-600">게시판이 없습니다.</p>
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
      <h3 className="font-semibold text-sm text-gray-600 uppercase tracking-wide mb-3">오늘의 뉴스</h3>
      <div className="space-y-3">
        {newsItems.map((item) =>
          item.url ? (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sm font-medium leading-snug hover:text-primary hover:underline"
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
      <h3 className="font-semibold text-sm text-gray-600 uppercase tracking-wide">공지사항</h3>
      <div className="space-y-2">
        {announcements.map((announcement) => (
          <Card key={announcement.id} className="card-elevated p-4 border-l-4 border-l-accent">
            <h4 className="font-semibold text-sm mb-1">{announcement.title}</h4>
            <p className="text-xs text-gray-600 line-clamp-2">{announcement.content}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
