import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, Search as SearchIcon, Eye, MessageCircle, ThumbsUp, Hash } from "lucide-react";
import { Link } from "wouter";
import React, { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import HeaderMenuButton from "@/components/HeaderMenuButton";
import Avatar from "@/components/Avatar";
import BackButton from "@/components/BackButton";

type SearchType = "all" | "boards" | "posts";

const FILTERS: { key: SearchType; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "boards", label: "게시판" },
  { key: "posts", label: "게시글" },
];

/** 주소창의 q/type을 읽어온다. 링크를 공유해도 같은 결과가 열리도록. */
function readParams(): { q: string; type: SearchType } {
  const params = new URLSearchParams(window.location.search);
  const type = params.get("type");
  return {
    q: params.get("q") ?? "",
    type: type === "boards" || type === "posts" ? type : "all",
  };
}

export default function SearchPage() {
  const initial = readParams();
  // 입력창의 값과 "실제로 검색한 값"을 나눈다. 타이핑하는 중간 글자마다 서버를
  // 때리면 결과가 깜빡이므로, 제출했을 때만 query가 바뀐다.
  const [input, setInput] = useState(initial.q);
  const [query, setQuery] = useState(initial.q);
  const [type, setType] = useState<SearchType>(initial.type);

  // 뒤로/앞으로 갔을 때도 주소에 맞는 결과가 보여야 한다.
  useEffect(() => {
    const onPop = () => {
      const next = readParams();
      setInput(next.q);
      setQuery(next.q);
      setType(next.type);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const syncUrl = (q: string, nextType: SearchType) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (nextType !== "all") params.set("type", nextType);
    const search = params.toString();
    window.history.replaceState(null, "", search ? `/search?${search}` : "/search");
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const next = input.trim();
    setQuery(next);
    syncUrl(next, type);
  };

  const handleType = (next: SearchType) => {
    setType(next);
    syncUrl(query, next);
  };

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

      <div className="container max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="section-heading text-3xl mb-5">검색</h1>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="flex-1 relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="게시판, 게시글 검색"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="pl-10"
                autoFocus
              />
            </div>
            <Button type="submit">검색</Button>
          </form>

          <div className="mt-3 flex gap-2">
            {FILTERS.map((filter) => (
              <Button
                key={filter.key}
                size="sm"
                variant={type === filter.key ? "default" : "outline"}
                onClick={() => handleType(filter.key)}
                className="rounded-full"
              >
                {filter.label}
              </Button>
            ))}
          </div>
        </div>

        {query ? (
          <SearchResults query={query} type={type} />
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

function SearchResults({ query, type }: { query: string; type: SearchType }) {
  const { data, isLoading } = trpc.search.all.useQuery(
    { query, type, limit: 20, offset: 0 },
    { enabled: !!query }
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const boards = data?.boards ?? [];
  const posts = data?.posts ?? [];

  if (boards.length === 0 && posts.length === 0) {
    return (
      <Card className="card-elevated p-12 text-center">
        <p className="text-muted-foreground">
          ‘{query}’에 대한 검색 결과가 없습니다
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {boards.length > 0 && (
        <section>
          {/* "전체"일 때만 무엇의 결과인지 구분이 필요하다. 한 종류만 볼 땐 군더더기다. */}
          {type === "all" && (
            <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
              게시판 {boards.length}
            </h2>
          )}
          <div>
            {boards.map((board) => (
              <Link
                key={board.id}
                href={`/board/${board.slug}`}
                className="list-row items-center gap-3 -mx-2 px-2 py-3"
              >
                <Hash className="h-[18px] w-[18px] shrink-0 text-muted-foreground/70" />
                <div className="min-w-0 flex-1 flex items-baseline gap-2">
                  <span className="shrink-0 font-sans text-[15px] font-bold text-foreground">{board.name}</span>
                  {board.description && (
                    <span className="truncate text-[13px] text-muted-foreground">{board.description}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {posts.length > 0 && (
        <section>
          {type === "all" && (
            <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
              게시글 {posts.length}
            </h2>
          )}
          <div>
            {posts.map((post) => (
              <Link key={post.id} href={`/post/${post.id}`} className="list-row items-start gap-3 -mx-2 px-2 py-2.5">
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
                  <h3 className="font-sans font-bold text-[15px] text-foreground truncate">{post.title}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                    <span className="truncate">{post.isAnonymous ? "익명" : post.authorName || "사용자"}</span>
                    <span className="shrink-0">·</span>
                    <span className="shrink-0">
                      {formatDistanceToNow(new Date(post.createdAt), { locale: ko, addSuffix: true })}
                    </span>
                    <span className="ml-auto flex items-center gap-2 shrink-0">
                      <span className="inline-flex items-center gap-0.5"><ThumbsUp className="h-3 w-3" />{post.likeCount || 0}</span>
                      <span className="inline-flex items-center gap-0.5"><MessageCircle className="h-3 w-3" />{post.commentCount || 0}</span>
                      <span className="inline-flex items-center gap-0.5"><Eye className="h-3 w-3" />{post.viewCount}</span>
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
