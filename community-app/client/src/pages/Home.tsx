import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, ArrowRight, Search as SearchIcon, MessageCircle, MessageSquareText, Newspaper, Compass, Megaphone, Hash, UtensilsCrossed, Shield, ThumbsUp, Star } from "lucide-react";
import { getLoginUrl } from "@/const";
import { Link, useLocation } from "wouter";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { hasDraft } from "@/lib/postDraft";
import HeaderMenuButton from "@/components/HeaderMenuButton";
import Reveal from "@/components/Reveal";
import HomeSpaceBackground from "@/components/HomeSpaceBackground";
import { isAdminRole } from "@/lib/role";
import AdBannerCarousel from "@/components/AdBannerCarousel";
import NotificationBell from "@/components/NotificationBell";
import SiteFooter from "@/components/SiteFooter";
import { toast } from "sonner";

const QUICK_LINKS: {
  key: string;
  label: string;
  icon: typeof MessageSquareText;
  href: string;
  external?: boolean;
  iconClassName?: string;
  /** 타일에 한 줄로 붙는 부연. 헤더 아이콘 버튼에서는 쓰지 않는다. */
  hint?: string;
}[] = [
  { key: "inquiry", label: "문의하기", icon: MessageSquareText, href: "/inquiries", iconClassName: "accent-text", hint: "관리자에게 바로 전달" },
  { key: "talk", label: "신흥고 홈페이지", icon: MessageCircle, href: "https://school.cbe.go.kr/shinheung-h/M01/", external: true, hint: "학교 공식" },
  { key: "meal", label: "급식표", icon: UtensilsCrossed, href: "https://school.cbe.go.kr/shinheung-h/M01030801", external: true, hint: "학교 홈페이지" },
];

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
  // 게시판마다 최신 글을 따로 조회하면 게시판 수만큼 요청이 늘어난다. 한 번에 받는다.
  const { data: boards, isLoading: boardsLoading } = trpc.boards.listWithLatest.useQuery();
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  // "즐겨찾기만 보기" 토글. 즐겨찾기가 하나도 없으면 버튼 자체를 띄우지 않는다.
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const favoriteCount = boards?.filter((b) => b.isFavorite).length ?? 0;
  const visibleBoards = favoritesOnly ? boards?.filter((b) => b.isFavorite) : boards;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  if (loading) {
    return (
      <div className="cosmic-empty flex min-h-screen items-center justify-center">
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

        {/* Ad Banner */}
        <AdBannerCarousel position="home_top" className="container pt-8" />

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

        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <HomeSpaceBackground />
      {/* Navigation */}
      <nav className="sticky top-3 z-40 mx-3 sm:mx-6 lg:mx-auto lg:max-w-6xl rounded-2xl border border-border bg-card/90 backdrop-blur-md shadow-sm">
        <div className="container flex items-center justify-between gap-2 py-4">
          <div className="flex items-center gap-2 shrink-0 min-w-0">
            <HeaderMenuButton />
            <a href="/" className="font-serif text-xl font-bold accent-text hover:opacity-80 transition-opacity shrink-0">
              커뮤니티
            </a>
          </div>

          {/* 모바일(md 미만): 바로가기를 사이드바 카드 대신 헤더 아이콘 버튼으로 노출.
              항목이 3개뿐이라 "더보기" 없이 전부 아이콘으로 넣어도 폭에 들어간다
              (실측 확인: 375px 기준 줄바꿈 없음). 라벨 텍스트는 aria-label로만 제공. */}
          <div className="flex md:hidden items-center gap-0.5 shrink-0">
            <NotificationBell />
            {QUICK_LINKS.map(({ key, label, icon: Icon, href, external, iconClassName }) =>
              external ? (
                <a
                  key={key}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  title={label}
                  className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-secondary transition-colors shrink-0"
                >
                  <Icon className={`h-[18px] w-[18px] text-muted-foreground ${iconClassName || ""}`} />
                </a>
              ) : (
                <Link
                  key={key}
                  href={href}
                  aria-label={label}
                  title={label}
                  className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-secondary transition-colors shrink-0"
                >
                  <Icon className={`h-[18px] w-[18px] text-muted-foreground ${iconClassName || ""}`} />
                </Link>
              )
            )}
            {isAdminRole(user?.role) && (
              <a
                href="/admin"
                aria-label="관리자"
                title="관리자"
                className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-secondary transition-colors shrink-0"
              >
                <Shield className="h-[18px] w-[18px] accent-text" />
              </a>
            )}
          </div>

          <div className="hidden md:flex items-center gap-2 min-w-0">
            <NotificationBell />
            <span className="text-sm text-muted-foreground truncate ml-2">{user?.name || "사용자"}</span>
            {isAdminRole(user?.role) && (
              <a href="/admin" className="text-sm font-semibold accent-text hover:underline shrink-0">
                관리자
              </a>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container pt-6 pb-4 sm:py-8">
        {/* 홈 상단 검색 — 게시판과 게시글을 함께 찾는다. 헤더 아이콘이 빽빽한
            모바일에서도 눌리도록 내비게이션 아래 한 줄을 통째로 내준다. */}
        <form onSubmit={handleSearch} className="mb-6 flex gap-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="게시판, 게시글 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="게시판, 게시글 검색"
              className="pl-10"
            />
          </div>
          <Button type="submit" className="shrink-0">검색</Button>
        </form>

        {/* 공지는 카드 위계 밖이다 — 놓치면 안 되는 안내라 그리드 위에 전폭으로 둔다 */}
        <AnnouncementsSection />

        <AdBannerCarousel position="home_top" className="mb-6" />

        {/* 홈의 주인공은 왼쪽 게시판 카드 하나. 오른쪽은 딸린 기능들.
            items-start가 없으면 오른쪽 카드가 왼쪽 높이에 맞춰 늘어난다. */}
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
          <BoardsCard
            boards={visibleBoards}
            isLoading={boardsLoading}
            totalCount={boards?.length ?? 0}
            favoriteCount={favoriteCount}
            favoritesOnly={favoritesOnly}
            onToggleFavoritesOnly={() => setFavoritesOnly((v) => !v)}
          />

          {/* md 미만에서는 헤더 아이콘이 같은 곳으로 보내주므로 타일을 숨긴다
              (안 그러면 같은 항목이 화면에 두 번 보인다). */}
          <div className="space-y-4">
            <NewsPanel />
            <div className="hidden md:grid grid-cols-2 gap-3">
              {QUICK_LINKS.map((link, index) => (
                <QuickTile key={link.key} link={link} wide={index === 0} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}

type BoardWithLatest = RouterOutput["boards"]["listWithLatest"][number];

/**
 * 게시판 카드 — 홈의 주인공.
 *
 * 게시판마다 카드를 하나씩 두지 않고 "게시판 기능" 전체를 카드 하나에 담는다.
 * 게시판이 늘어나도 카드 수는 그대로고 행만 늘어난다. 추천도 이 안에 넣는다 —
 * 추천 글은 결국 게시판 글이라 따로 떼면 같은 글이 화면에 두 번 뜬다.
 */
function BoardsCard({
  boards,
  isLoading,
  totalCount,
  favoriteCount,
  favoritesOnly,
  onToggleFavoritesOnly,
}: {
  boards: BoardWithLatest[] | undefined;
  isLoading: boolean;
  totalCount: number;
  favoriteCount: number;
  favoritesOnly: boolean;
  onToggleFavoritesOnly: () => void;
}) {
  return (
    <Card className="card-elevated overflow-hidden p-0">
      <div className="flex items-center gap-2 px-4 py-3.5 sm:px-5">
        <h2 className="section-heading text-xl">게시판</h2>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {favoriteCount > 0 && (
            <button
              type="button"
              onClick={onToggleFavoritesOnly}
              aria-pressed={favoritesOnly}
              className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors"
              style={
                favoritesOnly
                  ? { backgroundColor: "var(--accent-soft)", color: "var(--accent-color)" }
                  : { backgroundColor: "var(--bg-surface-2)", color: "var(--text-normal)" }
              }
            >
              <Star className="h-3 w-3" fill={favoritesOnly ? "currentColor" : "none"} />
              즐겨찾기 {favoriteCount}
            </button>
          )}
          <span
            className="rounded-full px-2.5 py-1 text-[11.5px]"
            style={{ backgroundColor: "var(--bg-surface-2)", color: "var(--text-muted)" }}
          >
            전체 {totalCount}
          </span>
        </div>
      </div>

      <RecommendedSection />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : boards && boards.length > 0 ? (
        <div>
          {boards.map((board) => (
            <BoardRow key={board.id} board={board} latest={board.latestPost} />
          ))}
        </div>
      ) : (
        <p className="px-4 py-12 text-center text-muted-foreground sm:px-5">
          {favoritesOnly ? "즐겨찾기한 게시판이 없습니다." : "게시판이 없습니다."}
        </p>
      )}

      {favoriteCount > 0 && !favoritesOnly && (
        <p
          className="border-t px-4 py-2.5 text-[11.5px] sm:px-5"
          style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}
        >
          즐겨찾기한 게시판이 위로 옵니다
        </p>
      )}
    </Card>
  );
}

/** 오른쪽 열의 작은 기능 타일. 첫 칸(문의하기)만 두 칸을 쓴다. */
function QuickTile({ link, wide }: { link: (typeof QUICK_LINKS)[number]; wide?: boolean }) {
  const { label, icon: Icon, href, external } = link;
  const inner = (
    <>
      <span
        className="flex h-7 w-7 items-center justify-center rounded-lg"
        style={{ backgroundColor: "var(--accent-soft)" }}
      >
        <Icon className="h-[15px] w-[15px]" style={{ color: "var(--accent-color)" }} />
      </span>
      <span className="text-[13px] font-semibold text-foreground">{label}</span>
      {link.hint && <span className="text-[11.5px] text-muted-foreground">{link.hint}</span>}
    </>
  );
  const className = `card-elevated flex flex-col gap-2 rounded-xl p-3 transition-shadow hover:shadow-md ${wide ? "col-span-2" : ""}`;

  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={className}>
      {inner}
    </Link>
  );
}

/**
 * 지금 인기있는 글. 반응 수에 시간 감쇠를 적용한 점수 상위 글을 보여준다
 * (로그인 사용자는 활동 이력이 쌓이면 서버에서 자동으로 개인화된다).
 *
 * 표시할 글이 MIN_RECOMMENDED개 미만이면 영역 자체를 렌더링하지 않는다 —
 * 글이 서너 개뿐인 상태에서 "추천"을 띄우면 게시판 목록과 같은 글이 중복될 뿐이라
 * 빈 껍데기를 보여주느니 없는 편이 낫다.
 */
const MIN_RECOMMENDED = 3;
/** 홈에 얹는 요약 영역이므로 3개까지만. 목록의 주인공은 아래 게시판이다. */
const RECOMMENDED_LIMIT = 3;

function RecommendedSection() {
  const { data: recommended, isLoading } = trpc.posts.recommended.useQuery({ limit: RECOMMENDED_LIMIT });

  // 로딩 중에는 자리를 잡아두지 않는다. 어차피 추천이 없으면 영역이 사라지는데
  // 스켈레톤을 깔면 그때마다 게시판 목록이 밀려 올라온다.
  if (isLoading || !recommended || recommended.items.length < MIN_RECOMMENDED) return null;

  // 같은 알고리즘이지만 개인화가 켜졌는지에 따라 이름을 달리 붙인다. "인기있는 글"로만
  // 적어두면 내 관심사가 반영되고 있다는 걸 알 방법이 없다.
  const personalized = recommended.personalized;

  return (
    // 게시판 목록의 곁다리 요약임을 드러내는 옅은 톤 블록. 제목도 accent 바가 붙는
    // section-heading이 아니라 작은 라벨을 써서, 아래 "게시판"보다 한 단계 낮게 둔다.
    <div className="px-4 pb-3 sm:px-5">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <h2 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
          {personalized ? "회원님을 위한 추천" : "지금 인기있는 글"}
        </h2>
        {personalized && (
          <span className="shrink-0 text-[11px] text-muted-foreground/80">
            관심 게시판 반영됨
          </span>
        )}
      </div>
      <div>
        {recommended.items.map((post, index) => (
          <RecommendedRow key={post.id} post={post} rank={index + 1} />
        ))}
      </div>
    </div>
  );
}

/**
 * 인기글 한 줄. 순위 + 제목 + 본문 한 줄 + 메타가 한 덩어리로 붙어 보이도록
 * 행 간격과 글자 크기를 모두 게시판 행보다 작게 잡았다 — "맛보기" 밀도.
 */
function RecommendedRow({
  post,
  rank,
}: {
  post: {
    id: number;
    title: string;
    boardName: string;
    commentCount: number;
  };
  rank: number;
}) {
  return (
    // 카드 안의 요약이라 한 줄로 끝낸다. 본문 미리보기를 넣으면 아래 게시판 목록보다
    // 덩치가 커져서 "주인공은 게시판"이라는 위계가 뒤집힌다.
    <Link
      href={`/post/${post.id}`}
      className="mb-1 flex items-center gap-2 rounded-lg px-2.5 py-2 transition-colors last:mb-0 hover:brightness-[.97]"
      style={{ backgroundColor: "var(--bg-surface-2)" }}
    >
      <span
        aria-hidden="true"
        className="w-3 shrink-0 text-center font-sans text-[12px] font-bold tabular-nums"
        style={{ color: "var(--accent-color)" }}
      >
        {rank}
      </span>
      <span className="min-w-0 flex-1 truncate font-sans text-[13px] font-medium text-foreground">
        {post.title}
      </span>
      <span className="shrink-0 text-[11px] text-muted-foreground">
        {post.boardName} · 댓글 {post.commentCount}
      </span>
    </Link>
  );
}

/**
 * 게시판 한 줄. 카드/그림자 없이 얇은 구분선(.list-row)만으로 나뉜다.
 * 게시판 구분은 색이 아니라 이름(텍스트)으로만 하고, 최신 글 제목 +
 * 좋아요/댓글 수를 같은 줄에 붙여서 한 눈에 활동성을 파악할 수 있게 한다
 * (설명은 최신 글이 없을 때만 대신 보여준다).
 */
function BoardRow({
  board,
  latest,
}: {
  board: { id: number; slug: string; name: string; description: string | null; isFavorite: boolean; todayCount: number };
  /** 최신 글은 목록 쿼리에서 함께 받아온다 (행마다 따로 조회하지 않는다). */
  latest: { title: string; likeCount: number; commentCount: number } | null;
}) {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();

  // 별을 누른 순간 바로 채워지게 하고(낙관적 갱신), 실패하면 되돌린다. 서버 응답을
  // 기다렸다 바꾸면 목록이 위로 재정렬되는 것과 겹쳐 눌린 건지 아닌지 헷갈린다.
  const [favorite, setFavorite] = useState(board.isFavorite);
  useEffect(() => {
    setFavorite(board.isFavorite);
  }, [board.isFavorite]);

  const toggleFavorite = trpc.boards.toggleFavorite.useMutation({
    onSuccess: (result) => {
      setFavorite(result.favorited);
      // 목록 순서(즐겨찾기가 위)와 추천 결과가 모두 즐겨찾기에 영향을 받는다.
      utils.boards.listWithLatest.invalidate();
      utils.posts.recommended.invalidate();
    },
    onError: () => {
      setFavorite(board.isFavorite);
      toast.error("즐겨찾기를 변경하지 못했어요");
    },
  });

  const handleToggleFavorite = (e: React.MouseEvent) => {
    // 행 전체가 링크라서 막지 않으면 게시판으로 이동해버린다.
    e.preventDefault();
    e.stopPropagation();
    setFavorite((v) => !v);
    toggleFavorite.mutate({ boardId: board.id });
  };

  // 작성 중인 임시저장 글 표시용. 항상 같은 크기의 점 자리를 예약해두고 색만
  // 켜고 끄는 방식이라(투명 vs 은은한 회색), 표시가 생겨도/사라져도 옆 요소의
  // 위치는 절대 밀리지 않는다.
  const [draftHere, setDraftHere] = useState(false);
  useEffect(() => {
    setDraftHere(hasDraft(board.slug));
  }, [board.slug]);

  return (
    // 게시판명과 최신 글 제목을 한 줄에 나란히 둔다(게시판명은 고정, 제목은 남는
    // 폭만큼 쓰고 말줄임). 홈의 주인공이므로 탭 영역(py-4)은 넉넉하게 유지한다.
    <Link
      href={`/board/${board.slug}`}
      className="flex items-center gap-3 border-t px-4 py-3.5 transition-colors hover:brightness-[.98] sm:px-5"
      style={{ borderColor: "var(--border-color)" }}
    >
      <Hash className="h-[18px] w-[18px] shrink-0 text-muted-foreground/70" />
      <div className="min-w-0 flex-1 flex items-baseline gap-2">
        <span className="shrink-0 font-sans text-[17px] font-bold leading-6 text-foreground">{board.name}</span>
        <span className="truncate text-[13px] text-muted-foreground">
          {latest ? latest.title : board.description}
        </span>
      </div>
      {/* 활동성은 최신 글의 반응 수보다 "오늘 몇 개 올라왔나"가 더 잘 보여준다 */}
      <span
        className="shrink-0 text-[12px] font-semibold tabular-nums"
        style={{ color: board.todayCount > 0 ? "var(--accent-color)" : "var(--text-muted)" }}
      >
        오늘 {board.todayCount}
      </span>
      {isAuthenticated && (
        <button
          type="button"
          onClick={handleToggleFavorite}
          aria-pressed={favorite}
          aria-label={`${board.name} 즐겨찾기 ${favorite ? "해제" : "추가"}`}
          title={favorite ? "즐겨찾기 해제" : "즐겨찾기에 추가"}
          className="-m-1.5 shrink-0 rounded-full p-1.5 transition-colors hover:bg-secondary"
        >
          <Star
            className="h-4 w-4 transition-colors"
            fill={favorite ? "currentColor" : "none"}
            style={{ color: favorite ? "var(--accent-color)" : "var(--text-muted)" }}
          />
        </button>
      )}
      <span
        aria-hidden={!draftHere}
        title={draftHere ? "작성 중인 글이 있어요" : undefined}
        className={`h-1.5 w-1.5 rounded-full shrink-0 ${draftHere ? "bg-muted-foreground/40" : "bg-transparent"}`}
      />
    </Link>
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
    <div className="space-y-3 mb-8 pb-8 border-b border-border">
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
