import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Search as SearchIcon, Eye, MessageCircle, ThumbsUp } from "lucide-react";
import { useLocation } from "wouter";
import React from "react";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import HeaderMenuButton from "@/components/HeaderMenuButton";

export default function SearchPage() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("posts");

  // URL query 파라미터에서 검색어 초기화
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (q) {
      setSearchQuery(q);
    }
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.history.replaceState(null, '', `/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-card sticky top-0 z-40">
        <div className="container flex items-center gap-2 py-4">
          <HeaderMenuButton />
          <a href="/" className="font-serif text-xl font-bold accent-text hover:opacity-80 transition-opacity">
            커뮤니티
          </a>
        </div>
      </nav>

      <div className="container max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl mb-6">검색</h1>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="flex-1 relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="게시글, 댓글, 사용자 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button type="submit">검색</Button>
          </form>
        </div>

        {searchQuery ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="posts">게시글</TabsTrigger>
              <TabsTrigger value="comments">댓글</TabsTrigger>
            </TabsList>

            <TabsContent value="posts">
              <SearchPostsResults query={searchQuery} />
            </TabsContent>

            <TabsContent value="comments">
              <div className="text-center py-12">
                <p className="text-muted-foreground">댓글 검색은 준비 중입니다</p>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <Card className="card-elevated p-12 text-center">
            <SearchIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">검색어를 입력하세요</p>
          </Card>
        )}
      </div>
    </div>
  );
}

function SearchPostsResults({ query }: { query: string }) {
  const [page, setPage] = useState(0);
  const limit = 20;

  // 모든 게시판에서 검색 (boardId: 0)
  const { data: posts, isLoading } = trpc.posts.listByBoard.useQuery(
    {
      boardId: 0,
      limit,
      offset: page * limit,
      search: query,
    },
    { enabled: !!query }
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!posts || posts.length === 0) {
    return (
      <Card className="card-elevated p-12 text-center">
        <p className="text-muted-foreground">검색 결과가 없습니다</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post: any) => (
        <Card key={post.id} className="card-elevated p-6">
          <a href={`/post/${post.id}`} className="block">
            <h3 className="text-lg font-semibold mb-2 accent-text hover:underline">
              {post.title}
            </h3>
          </a>
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{post.content}</p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>{post.isAnonymous ? "익명" : "사용자"}</span>
            <span>{formatDistanceToNow(new Date(post.createdAt), { locale: ko, addSuffix: true })}</span>
            <div className="flex items-center gap-4 ml-auto">
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {post.viewCount}
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle className="h-3 w-3" />
                {post.commentCount || 0}
              </span>
              <span className="flex items-center gap-1">
                <ThumbsUp className="h-3 w-3" />
                {post.likeCount || 0}
              </span>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
