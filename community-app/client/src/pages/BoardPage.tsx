import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Search, Eye, MessageCircle, ThumbsUp, Hash, Rocket } from "lucide-react";
import { Link, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import HeaderMenuButton from "@/components/HeaderMenuButton";
import Avatar from "@/components/Avatar";
import BackButton from "@/components/BackButton";
import EmptyState from "@/components/EmptyState";
import AdBannerCarousel from "@/components/AdBannerCarousel";

export default function BoardPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user, isAuthenticated } = useAuth();
  const [sortBy, setSortBy] = useState<'latest' | 'popular'>('latest');
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const limit = 20;

  const { data: boards, isLoading: boardsLoading } = trpc.boards.list.useQuery();
  const board = boards?.find((b) => b.slug === slug);

  const { data: posts, isLoading: postsLoading } = trpc.posts.listByBoard.useQuery(
    {
      boardId: board?.id || 0,
      limit,
      offset: page * limit,
      sortBy,
      search: searchQuery || undefined,
    },
    { enabled: !!board }
  );

  const { data: announcements } = trpc.announcements.list.useQuery({ limit: 5 });

  if (boardsLoading) {
    return (
      <div className="cosmic-empty min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!board) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl mb-4">게시판을 찾을 수 없습니다</h1>
          <a href="/" className="accent-text hover:underline">홈으로 돌아가기</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-3 z-40 mx-3 sm:mx-6 lg:mx-auto lg:max-w-6xl rounded-2xl border border-border bg-card/90 backdrop-blur-md shadow-sm">
        <div className="container flex items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <BackButton />
            <HeaderMenuButton />
            <a href="/" className="font-serif text-xl font-bold accent-text hover:opacity-80 transition-opacity">
              커뮤니티
            </a>
          </div>
          <div className="flex items-center gap-4">
            {isAuthenticated && (
              <a href={`/board/${slug}/write`} className="inline-flex items-center gap-2">
                <Button size="sm">
                  <Plus className="h-4 w-4" />
                  글쓰기
                </Button>
              </a>
            )}
          </div>
        </div>
      </nav>

      <div className="container py-8">
        {/* Announcements */}
        {announcements && announcements.length > 0 && (
          <div className="mb-8 pb-8 border-b border-border space-y-3">
            <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">공지사항</h3>
            <div className="space-y-2">
              {announcements.map((announcement) => (
                <Card key={announcement.id} className="card-elevated p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="tag-pill">공지</span>
                    <h4 className="font-semibold text-sm">{announcement.title}</h4>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{announcement.content}</p>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Board Header */}
        <div className="mb-6 flex items-center gap-3">
          <span className="category-icon h-10 w-10">
            <Hash className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl leading-tight">{board.name}</h1>
            {board.description && (
              <p className="text-sm text-muted-foreground mt-0.5">{board.description}</p>
            )}
          </div>
        </div>

        {/* Filters and Search */}
        {/* 모바일에서 검색창과 정렬이 세로로 쌓이면 첫 화면의 1/3을 먹는다. 한 줄로 붙인다. */}
        <div className="mb-5 flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="게시글 검색..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(0);
              }}
              className="w-full pl-10"
            />
          </div>
          <Select value={sortBy} onValueChange={(value) => {
            setSortBy(value as 'latest' | 'popular');
            setPage(0);
          }}>
            <SelectTrigger className="w-[104px] shrink-0 sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">최신순</SelectItem>
              <SelectItem value="popular">인기순</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Ad Banner */}
        <AdBannerCarousel position="board_top" boardId={board.id} className="mb-6" />

        {/* Posts List */}
        <div>
          {postsLoading ? (
            <div className="cosmic-empty flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : posts && posts.length > 0 ? (
            posts.map((post) => (
              <a
                key={post.id}
                href={`/post/${post.id}`}
                className="list-row items-start gap-3 -mx-2 px-2 py-2.5"
              >
                <Avatar
                  userId={post.userId}
                  isAnonymous={post.isAnonymous}
                  name={post.authorName}
                  avatarEmoji={post.authorAvatarEmoji}
                  avatarImageUrl={post.authorAvatarImageUrl}
                  size="h-8 w-8"
                  textSize="text-xs"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {post.isNotice && <span className="tag-pill shrink-0">공지</span>}
                    <h3 className="font-sans font-bold text-[15px] text-foreground truncate">{post.title}</h3>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                    <span className="truncate">{post.isAnonymous ? '익명' : post.authorName || '사용자'}</span>
                    <span className="shrink-0">·</span>
                    <span className="shrink-0">
                      {formatDistanceToNow(new Date(post.createdAt), { locale: ko, addSuffix: true })}
                    </span>
                    <span className="ml-auto flex items-center gap-2 shrink-0">
                      <span className="inline-flex items-center gap-0.5"><ThumbsUp className="h-3 w-3" />{post.likeCount}</span>
                      <span className="inline-flex items-center gap-0.5"><MessageCircle className="h-3 w-3" />{post.commentCount}</span>
                      <span className="inline-flex items-center gap-0.5"><Eye className="h-3 w-3" />{post.viewCount}</span>
                    </span>
                  </div>
                </div>
              </a>
            ))
          ) : (
            <Card className="card-elevated p-4">
              <EmptyState
                icon={Rocket}
                title="아직 게시글이 없어요"
                description="가장 먼저 글을 남겨보세요"
                action={
                  isAuthenticated && (
                    <a href={`/board/${slug}/write`}>
                      <Button size="sm">
                        <Plus className="h-4 w-4" />
                        글쓰기
                      </Button>
                    </a>
                  )
                }
              />
            </Card>
          )}
        </div>

        {/* Pagination */}
        {posts && posts.length === limit && (
          <div className="mt-8 flex justify-center gap-2">
            <Button
              variant="outline"
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
            >
              이전
            </Button>
            <Button
              variant="outline"
              onClick={() => setPage(page + 1)}
            >
              다음
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
