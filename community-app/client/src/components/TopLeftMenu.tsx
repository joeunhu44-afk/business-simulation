import { useState, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Menu,
  LogOut,
  User,
  Settings,
  Search,
  MessageCircle,
  MessageSquareText,
  UtensilsCrossed,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { useThemeColor, type ThemeColor } from "@/contexts/ThemeColorContext";
import { useMenu } from "@/contexts/MenuContext";
import { useLocation } from "wouter";
import { AVATAR_EMOJI_OPTIONS } from "@shared/const";
import Avatar from "@/components/Avatar";
import { roleLabel } from "@/lib/role";

const THEME_COLORS: { color: ThemeColor; label: string; swatch: string }[] = [
  { color: "dark", label: "오로라 틸", swatch: "#107872" },
  { color: "blue", label: "코스믹 인디고", swatch: "#4256c9" },
  { color: "purple", label: "오로라 바이올렛", swatch: "#7346b8" },
  { color: "green", label: "오로라 그린", swatch: "#1a7455" },
  { color: "red", label: "브릭 로즈", swatch: "#ad4256" },
  { color: "amber", label: "오커", swatch: "#b8863f" },
];

type MenuView = "root" | "profile" | "chat" | "search" | "settings";

export default function TopLeftMenu({ showFloatingButton = true }: { showFloatingButton?: boolean }) {
  const { user, logout, refresh } = useAuth();
  const { themeColor, setThemeColor } = useThemeColor();
  const { isOpen, setOpen: setIsOpen, openMenu: openMenuCtx } = useMenu();
  const [, navigate] = useLocation();
  const [view, setView] = useState<MenuView>("root");

  const [searchQuery, setSearchQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [passwordInputs, setPasswordInputs] = useState({ current: "", new: "" });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      toast.success("로그아웃되었습니다");
      logout();
      setIsOpen(false);
    },
  });

  const updateNameMutation = trpc.auth.updateName.useMutation({
    onSuccess: () => {
      toast.success("이름이 변경되었습니다");
      setNameInput("");
    },
    onError: (error) => toast.error(error.message || "이름 변경 실패"),
  });

  const updatePasswordMutation = trpc.auth.updatePassword.useMutation({
    onSuccess: () => {
      toast.success("비밀번호가 변경되었습니다");
      setPasswordInputs({ current: "", new: "" });
    },
    onError: (error) => toast.error(error.message || "비밀번호 변경 실패"),
  });

  const updateAvatarMutation = trpc.auth.updateAvatar.useMutation({
    onSuccess: (_data, variables) => {
      toast.success(variables.avatarEmoji ? "프로필 아이콘이 변경되었습니다" : "기본 프로필로 되돌렸습니다");
      refresh();
    },
    onError: (error) => toast.error(error.message || "프로필 변경 실패"),
  });

  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  const updateAvatarPhotoMutation = trpc.auth.updateAvatarPhoto.useMutation({
    onSuccess: () => {
      toast.success("프로필 사진이 변경되었습니다");
      refresh();
    },
    onError: (error) => toast.error(error.message || "프로필 사진 변경 실패"),
  });

  const removeAvatarPhotoMutation = trpc.auth.removeAvatarPhoto.useMutation({
    onSuccess: () => refresh(),
    onError: (error) => toast.error(error.message || "프로필 사진 삭제 실패"),
  });

  const handleAvatarPhotoChange = (file: File | null) => {
    if (!file) return;
    if (avatarFileInputRef.current) avatarFileInputRef.current.value = "";
    if (!file.type.startsWith("image/")) {
      toast.error("이미지 파일만 업로드할 수 있어요");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("이미지는 8MB 이하만 업로드할 수 있어요");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      updateAvatarPhotoMutation.mutate({ dataUrl: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleNameChange = () => {
    const match = nameInput.match(/^(\d{5})\s+(.+)$/);
    if (!match) {
      toast.error("형식: 학번(5자리) 이름 (예: 20223 조은후)");
      return;
    }
    updateNameMutation.mutate({ name: nameInput });
  };

  const handlePasswordChange = () => {
    if (!passwordInputs.new) {
      toast.error("새 비밀번호를 입력하세요");
      return;
    }
    updatePasswordMutation.mutate({ currentPassword: "", newPassword: passwordInputs.new });
  };

  const { data: unreadCount } = trpc.chat.unreadCount.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 8000,
  });

  const { data: conversations, isLoading: convLoading } = trpc.chat.listConversations.useQuery(
    undefined,
    { enabled: !!user && view === "chat", refetchInterval: 6000 }
  );

  const searchResultsQuery = trpc.users.search.useQuery(
    { query: submittedQuery },
    { enabled: submittedQuery.trim().length > 0 }
  );
  const searchResults = searchResultsQuery.data ?? [];
  const isSearching = searchResultsQuery.isFetching;
  const searchError = searchResultsQuery.error;

  const startChatMutation = trpc.chat.startConversation.useMutation({
    onSuccess: (conv) => {
      setIsOpen(false);
      navigate(`/chat/${conv.id}`);
    },
    onError: (error) => toast.error(error.message || "채팅을 시작할 수 없습니다"),
  });

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    setSubmittedQuery(searchQuery.trim());
  };

  const openMenu = () => {
    setView("root");
    openMenuCtx();
  };

  // 비로그인 상태에서는 클로그인 페이지 자체 헤더가 로그인 버튼을 제공하므로 떠있는 메뉴 버튼은 숨긴다.
  if (!user) return null;

  const ROOT_ITEMS: { key: MenuView; label: string; icon: typeof User; badge?: number }[] = [
    { key: "profile", label: "마이페이지", icon: User },
    { key: "chat", label: "채팅", icon: MessageCircle, badge: unreadCount || 0 },
    { key: "search", label: "사용자 검색", icon: Search },
    { key: "settings", label: "설정", icon: Settings },
  ];

  const titleMap: Record<MenuView, string> = {
    root: "메뉴",
    profile: "마이페이지",
    chat: "채팅",
    search: "사용자 검색",
    settings: "설정",
  };

  return (
    <>
      {/* 왼쪽 상단 떠있는 메뉴 버튼 (헤더에 인라인 버튼이 없는 페이지에서만 표시) */}
      {showFloatingButton && (
        <button
          onClick={openMenu}
          aria-label="메뉴 열기"
          className="fixed top-5 left-5 rounded-full bg-white shadow-md hover:shadow-lg transition-all duration-200 p-3 z-40 light-border"
        >
          <Menu className="h-5 w-5" style={{ color: "var(--text-strong)" }} />
          {!!unreadCount && unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full text-white text-[10px] font-bold flex items-center justify-center"
              style={{ backgroundColor: "var(--accent-color)" }}>
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      )}

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          side="left"
          className="w-[85vw] max-w-[340px] sm:w-[380px] sm:max-w-[380px] p-0 flex flex-col"
          style={{ backgroundColor: "var(--bg-surface)" }}
        >
          <SheetHeader className="px-5 py-4 border-b" style={{ borderColor: "var(--border-color)" }}>
            <div className="flex items-center gap-2">
              {view !== "root" && (
                <button
                  onClick={() => setView("root")}
                  aria-label="뒤로"
                  className="rounded-md p-1 hover:bg-black/5"
                >
                  <ChevronLeft className="h-5 w-5" style={{ color: "var(--text-strong)" }} />
                </button>
              )}
              <SheetTitle className="text-lg font-extrabold" style={{ color: "var(--text-strong)" }}>
                {titleMap[view]}
              </SheetTitle>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            {/* 루트: 세로 정렬 메뉴 목록 */}
            {view === "root" && (
              <div className="p-3">
                {/* 사용자 요약 */}
                <div className="flex items-center gap-3 px-3 py-4 mb-2">
                  <Avatar
                    userId={user.id}
                    isAnonymous={false}
                    name={user.name}
                    avatarEmoji={user.avatarEmoji}
                    avatarImageUrl={user.avatarImageUrl}
                    size="h-11 w-11"
                    textSize="text-lg"
                  />
                  <div className="min-w-0">
                    <p className="font-extrabold truncate" style={{ color: "var(--text-strong)" }}>
                      {user.name || "익명"}
                    </p>
                    <p className="text-sm truncate" style={{ color: "var(--text-muted)" }}>
                      {roleLabel(user.role)}
                    </p>
                  </div>
                </div>

                <nav className="flex flex-col gap-1">
                  {ROOT_ITEMS.map(({ key, label, icon: Icon, badge }) => (
                    <button
                      key={key}
                      onClick={() => setView(key)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left hover:bg-black/5 transition-colors"
                    >
                      <Icon className="h-5 w-5 shrink-0" style={{ color: "var(--accent-color)" }} />
                      <span className="flex-1 font-semibold" style={{ color: "var(--text-strong)" }}>
                        {label}
                      </span>
                      {!!badge && badge > 0 && (
                        <span
                          className="min-w-5 h-5 px-1.5 rounded-full text-white text-[11px] font-bold flex items-center justify-center"
                          style={{ backgroundColor: "var(--accent-color)" }}
                        >
                          {badge > 99 ? "99+" : badge}
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "var(--text-muted)" }} />
                    </button>
                  ))}
                </nav>

                <div className="mt-2 pt-2 border-t flex flex-col gap-1" style={{ borderColor: "var(--border-color)" }}>
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      navigate("/inquiries");
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left hover:bg-black/5 transition-colors"
                  >
                    <MessageSquareText className="h-5 w-5 shrink-0" style={{ color: "var(--accent-color)" }} />
                    <span className="flex-1 font-semibold" style={{ color: "var(--text-strong)" }}>문의하기</span>
                    <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "var(--text-muted)" }} />
                  </button>
                  <a
                    href="https://school.cbe.go.kr/shinheung-h/M010304"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left hover:bg-black/5 transition-colors"
                  >
                    <MessageCircle className="h-5 w-5 shrink-0" style={{ color: "var(--text-muted)" }} />
                    <span className="flex-1 font-semibold" style={{ color: "var(--text-strong)" }}>신흥톡톡</span>
                    <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "var(--text-muted)" }} />
                  </a>
                  <a
                    href="https://school.cbe.go.kr/shinheung-h/M01030801"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left hover:bg-black/5 transition-colors"
                  >
                    <UtensilsCrossed className="h-5 w-5 shrink-0" style={{ color: "var(--text-muted)" }} />
                    <span className="flex-1 font-semibold" style={{ color: "var(--text-strong)" }}>급식표</span>
                    <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "var(--text-muted)" }} />
                  </a>
                </div>

                <div className="mt-2 pt-2 border-t px-1" style={{ borderColor: "var(--border-color)" }}>
                  <Button
                    onClick={() => logoutMutation.mutate()}
                    disabled={logoutMutation.isPending}
                    variant="ghost"
                    className="w-full justify-start gap-3 px-4 py-3 h-auto rounded-xl hover:bg-black/5"
                  >
                    <LogOut className="h-5 w-5" style={{ color: "var(--text-muted)" }} />
                    <span className="font-semibold" style={{ color: "var(--text-muted)" }}>
                      {logoutMutation.isPending ? "로그아웃 중..." : "로그아웃"}
                    </span>
                  </Button>
                </div>
              </div>
            )}

            {/* 마이페이지 */}
            {view === "profile" && (
              <div className="p-5 space-y-4">
                <div className="light-border p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar
                      userId={user.id}
                      isAnonymous={false}
                      name={user.name}
                      avatarEmoji={user.avatarEmoji}
                      avatarImageUrl={user.avatarImageUrl}
                      size="h-14 w-14"
                      textSize="text-2xl"
                    />
                    <div className="min-w-0">
                      <p className="font-extrabold truncate" style={{ color: "var(--text-strong)" }}>{user.name || "익명"}</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        게시글·댓글에 실명으로 쓸 때 이 아이콘이 보여요
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      ref={avatarFileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleAvatarPhotoChange(e.target.files?.[0] ?? null)}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => avatarFileInputRef.current?.click()}
                      disabled={updateAvatarPhotoMutation.isPending}
                    >
                      {updateAvatarPhotoMutation.isPending ? "업로드 중..." : "사진으로 설정"}
                    </Button>
                    {user.avatarImageUrl && (
                      <button
                        type="button"
                        onClick={() => removeAvatarPhotoMutation.mutate()}
                        disabled={removeAvatarPhotoMutation.isPending}
                        className="text-xs font-semibold underline"
                        style={{ color: "var(--text-muted)" }}
                      >
                        사진 삭제
                      </button>
                    )}
                  </div>

                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>또는 아이콘을 골라보세요</p>
                  <div className="grid grid-cols-8 gap-1.5 pt-1">
                    {AVATAR_EMOJI_OPTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => updateAvatarMutation.mutate({ avatarEmoji: emoji })}
                        disabled={updateAvatarMutation.isPending}
                        aria-label={`아바타 ${emoji} 선택`}
                        className="aspect-square rounded-lg flex items-center justify-center text-lg hover:bg-black/5 transition-colors"
                        style={{
                          outline: user.avatarEmoji === emoji ? `2px solid var(--accent-color)` : "none",
                          outlineOffset: "-2px",
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                  {(user.avatarEmoji || user.avatarImageUrl) && (
                    <button
                      type="button"
                      onClick={() => {
                        updateAvatarMutation.mutate({ avatarEmoji: null });
                        if (user.avatarImageUrl) removeAvatarPhotoMutation.mutate();
                      }}
                      disabled={updateAvatarMutation.isPending || removeAvatarPhotoMutation.isPending}
                      className="text-xs font-semibold underline"
                      style={{ color: "var(--text-muted)" }}
                    >
                      기본 아이콘으로 되돌리기
                    </button>
                  )}
                </div>
                <div className="light-border p-4 space-y-1">
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>이름</p>
                  <p className="font-extrabold" style={{ color: "var(--text-strong)" }}>{user.name || "익명"}</p>
                </div>
                <div className="light-border p-4 space-y-1">
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>이메일</p>
                  <p className="font-extrabold" style={{ color: "var(--text-strong)" }}>{user.email || "미설정"}</p>
                </div>
                <div className="light-border p-4 space-y-1">
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>역할</p>
                  <p className="font-extrabold" style={{ color: "var(--text-strong)" }}>
                    {roleLabel(user.role)}
                  </p>
                </div>

                <div className="pt-2">
                  <label className="text-sm font-semibold" style={{ color: "var(--text-strong)" }}>이름 변경</label>
                  <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>형식: 20223 조은후</p>
                  <Input
                    type="text"
                    placeholder="학번 이름"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="mb-2"
                  />
                  <Button
                    onClick={handleNameChange}
                    disabled={updateNameMutation.isPending}
                    className="w-full text-white"
                    style={{ backgroundColor: "var(--accent-color)" }}
                  >
                    {updateNameMutation.isPending ? "변경 중..." : "이름 변경"}
                  </Button>
                </div>

                <div className="pt-2 border-t" style={{ borderColor: "var(--border-color)" }}>
                  <label className="text-sm font-semibold mt-3 block" style={{ color: "var(--text-strong)" }}>비밀번호 변경</label>
                  <Input
                    type="password"
                    placeholder="새 비밀번호"
                    value={passwordInputs.new}
                    onChange={(e) => setPasswordInputs({ ...passwordInputs, new: e.target.value })}
                    className="mb-2 mt-2"
                  />
                  <Button
                    onClick={handlePasswordChange}
                    disabled={updatePasswordMutation.isPending}
                    className="w-full text-white"
                    style={{ backgroundColor: "var(--accent-color)" }}
                  >
                    {updatePasswordMutation.isPending ? "변경 중..." : "비밀번호 변경"}
                  </Button>
                </div>
              </div>
            )}

            {/* 채팅 */}
            {view === "chat" && (
              <div className="p-4 space-y-3">
                <Button
                  onClick={() => {
                    setIsOpen(false);
                    navigate("/chat");
                  }}
                  variant="outline"
                  className="w-full"
                >
                  전체 채팅 목록 열기
                </Button>

                {convLoading ? (
                  <p className="text-center text-sm py-6" style={{ color: "var(--text-muted)" }}>불러오는 중...</p>
                ) : !conversations || conversations.length === 0 ? (
                  <div className="text-center py-10">
                    <MessageCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p style={{ color: "var(--text-muted)" }}>아직 대화가 없습니다</p>
                    <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                      사용자 검색에서 채팅을 시작해 보세요
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {conversations.map((c: any) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setIsOpen(false);
                          navigate(`/chat/${c.id}`);
                        }}
                        className="w-full light-border p-3 flex items-center gap-3 text-left"
                      >
                        <Avatar
                          userId={c.otherUserId}
                          isAnonymous={false}
                          name={c.otherUserName}
                          avatarEmoji={c.otherUserAvatarEmoji}
                          avatarImageUrl={c.otherUserAvatarImageUrl}
                          size="h-10 w-10"
                          textSize="text-sm"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold truncate" style={{ color: "var(--text-strong)" }}>
                            {c.otherUserName || "익명"}
                          </p>
                          <p className="text-sm truncate" style={{ color: "var(--text-muted)" }}>
                            {c.lastMessage || "대화를 시작하세요"}
                          </p>
                        </div>
                        {!!c.unreadCount && c.unreadCount > 0 && (
                          <span
                            className="min-w-5 h-5 px-1.5 rounded-full text-white text-[11px] font-bold flex items-center justify-center shrink-0"
                            style={{ backgroundColor: "var(--accent-color)" }}
                          >
                            {c.unreadCount}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 사용자 검색 */}
            {view === "search" && (
              <div className="p-4 space-y-4">
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="사용자 이름 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                  <Button
                    onClick={handleSearch}
                    disabled={isSearching}
                    className="text-white shrink-0"
                    style={{ backgroundColor: "var(--accent-color)" }}
                  >
                    {isSearching ? "..." : "검색"}
                  </Button>
                </div>

                {searchResults.length > 0 && (
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                    {searchResults.map((result) => (
                      <div
                        key={result.id}
                        className="light-border p-3 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="font-bold truncate" style={{ color: "var(--text-strong)" }}>
                            {result.name || "익명"}
                          </p>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {roleLabel(result.role)}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => startChatMutation.mutate({ targetUserId: result.id })}
                          disabled={startChatMutation.isPending}
                          className="text-white shrink-0"
                          style={{ backgroundColor: "var(--accent-color)" }}
                        >
                          <MessageCircle className="h-4 w-4 mr-1" />
                          채팅
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {searchError && !isSearching && (
                  <div className="text-center py-2 space-y-2">
                    <p className="text-sm" style={{ color: "var(--accent-color)" }}>검색 중 오류가 발생했습니다</p>
                    <Button size="sm" variant="outline" onClick={() => searchResultsQuery.refetch()}>
                      다시 시도
                    </Button>
                  </div>
                )}

                {!searchError && searchResults.length === 0 && submittedQuery && !isSearching && (
                  <p className="text-center text-sm" style={{ color: "var(--text-muted)" }}>검색 결과가 없습니다</p>
                )}
              </div>
            )}

            {/* 설정 */}
            {view === "settings" && (
              <div className="p-5 space-y-5">
                <div>
                  <label className="text-sm font-semibold block mb-3" style={{ color: "var(--text-strong)" }}>
                    포인트 색상
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {THEME_COLORS.map(({ color, label, swatch }) => (
                      <button
                        key={color}
                        onClick={() => {
                          setThemeColor(color);
                          toast.success(`${label} 색상으로 변경되었습니다`);
                        }}
                        className="flex flex-col items-center gap-2 p-2 rounded-xl hover:bg-black/5 transition-colors"
                      >
                        <span
                          className="w-10 h-10 rounded-full border-2 transition-all"
                          style={{
                            backgroundColor: swatch,
                            borderColor: themeColor === color ? "var(--text-strong)" : "transparent",
                          }}
                        />
                        <span className="text-xs font-semibold" style={{ color: "var(--text-strong)" }}>
                          {label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
                  <label className="text-sm font-semibold block mb-2" style={{ color: "var(--text-strong)" }}>
                    알림 설정
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2" style={{ color: "var(--text-normal)" }}>
                      <input type="checkbox" defaultChecked className="rounded" />
                      새 댓글 알림
                    </label>
                    <label className="flex items-center gap-2" style={{ color: "var(--text-normal)" }}>
                      <input type="checkbox" defaultChecked className="rounded" />
                      새 게시글 알림
                    </label>
                    <label className="flex items-center gap-2" style={{ color: "var(--text-normal)" }}>
                      <input type="checkbox" defaultChecked className="rounded" />
                      메시지 알림
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
