import { useState, useRef, useEffect } from "react";
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
  Bell,
  ThumbsUp,
  Megaphone,
  Check,
  Moon,
  Sun,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { useThemeColor, type ThemeColor } from "@/contexts/ThemeColorContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useMenu } from "@/contexts/MenuContext";
import { useLocation } from "wouter";
import { AVATAR_EMOJI_OPTIONS, WITHDRAW_CONFIRM_TEXT } from "@shared/const";
import Avatar from "@/components/Avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { roleLabel } from "@/lib/role";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";

// label은 변경 토스트에 쓰는 정식 이름, short는 칩 안에 들어가는 짧은 이름.
// 칩 폭이 좁아 정식 이름을 그대로 넣으면 "오로라 …"처럼 잘려 서로 구분이 안 된다.
const THEME_COLORS: { color: ThemeColor; label: string; short: string; swatch: string }[] = [
  { color: "dark", label: "오로라 틸", short: "틸", swatch: "#107872" },
  { color: "blue", label: "코스믹 인디고", short: "인디고", swatch: "#4256c9" },
  { color: "purple", label: "오로라 바이올렛", short: "바이올렛", swatch: "#7346b8" },
  { color: "green", label: "오로라 그린", short: "그린", swatch: "#1a7455" },
  { color: "red", label: "브릭 로즈", short: "로즈", swatch: "#ad4256" },
  { color: "amber", label: "오커", short: "오커", swatch: "#b8863f" },
];

/** 알림 종류별 아이콘. 셋 다 같은 점이면 목록을 훑을 때 구분이 안 된다. */
const NOTIFICATION_STYLES: Record<string, { icon: typeof Bell; tint: string }> = {
  post_comment: { icon: MessageSquareText, tint: "var(--bg-surface-2)" },
  post_like: { icon: ThumbsUp, tint: "var(--bg-surface-2)" },
  marketing: { icon: Megaphone, tint: "var(--bg-surface-2)" },
  announcement: { icon: Bell, tint: "var(--bg-surface-2)" },
};

type MenuView = "root" | "profile" | "chat" | "search" | "settings" | "notifications";

export default function TopLeftMenu({ showFloatingButton = true }: { showFloatingButton?: boolean }) {
  const { user, logout, refresh } = useAuth();
  const { themeColor, setThemeColor } = useThemeColor();
  const { theme, toggleTheme } = useTheme();
  const { isOpen, setOpen: setIsOpen, openMenu: openMenuCtx, pendingTarget, clearPendingTarget } = useMenu();
  const [, navigate] = useLocation();
  const [view, setView] = useState<MenuView>("root");

  const [searchQuery, setSearchQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [passwordInputs, setPasswordInputs] = useState({ current: "", new: "" });
  const [withdrawInput, setWithdrawInput] = useState("");

  const utils = trpc.useUtils();
  const { data: notifications } = trpc.notifications.list.useQuery(
    { limit: 30 },
    { enabled: !!user }
  );
  const { data: unreadNotifications } = trpc.notifications.unreadCount.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 60_000,
  });

  const markReadMutation = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });

  const markAllReadMutation = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });

  const updateNotifyPrefsMutation = trpc.auth.updateNotificationPrefs.useMutation({
    onSuccess: () => {
      refresh();
      toast.success("알림 설정이 저장되었습니다");
    },
    onError: (error) => toast.error(error.message || "설정 저장에 실패했습니다"),
  });

  /** 알림을 누르면 읽음 처리하고 linkUrl로 이동한다. */
  const openNotification = (notification: { id: number; linkUrl: string | null; isRead: boolean }) => {
    if (!notification.isRead) markReadMutation.mutate({ id: notification.id });
    if (notification.linkUrl) {
      setIsOpen(false);
      navigate(notification.linkUrl);
    }
  };

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

  const withdrawMutation = trpc.auth.withdraw.useMutation({
    onSuccess: () => {
      toast.success("탈퇴가 완료되었습니다");
      // 세션이 이미 끊겼으므로 전체 새로고침으로 초기 상태로 되돌린다.
      window.location.href = "/";
    },
    onError: (error) => toast.error(error.message || "탈퇴에 실패했습니다"),
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
    // 비밀번호가 설정된 계정은 서버가 현재 비밀번호를 반드시 요구한다.
    // (소셜 전용 계정은 아직 비밀번호가 없어 새로 설정하는 것이므로 생략한다)
    if (user?.hasPassword && !passwordInputs.current) {
      toast.error("현재 비밀번호를 입력하세요");
      return;
    }
    updatePasswordMutation.mutate({
      currentPassword: passwordInputs.current || undefined,
      newPassword: passwordInputs.new,
    });
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

  // 상단바 알림 아이콘처럼 바깥에서 특정 화면을 지정해 연 경우 그 화면으로 전환한다.
  useEffect(() => {
    if (isOpen && pendingTarget) {
      setView(pendingTarget);
      clearPendingTarget();
    }
  }, [isOpen, pendingTarget, clearPendingTarget]);

  // 비로그인 상태에서는 클로그인 페이지 자체 헤더가 로그인 버튼을 제공하므로 떠있는 메뉴 버튼은 숨긴다.
  if (!user) return null;

  const ROOT_ITEMS: { key: MenuView; label: string; icon: typeof User; badge?: number }[] = [
    { key: "profile", label: "마이페이지", icon: User },
    { key: "notifications", label: "알림", icon: Bell, badge: unreadNotifications || 0 },
    { key: "chat", label: "채팅", icon: MessageCircle, badge: unreadCount || 0 },
    { key: "search", label: "사용자 검색", icon: Search },
    { key: "settings", label: "설정", icon: Settings },
  ];

  const titleMap: Record<MenuView, string> = {
    root: "메뉴",
    profile: "마이페이지",
    notifications: "알림",
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
          className="sheet-glow w-[85vw] max-w-[340px] sm:w-[380px] sm:max-w-[380px] p-0 flex flex-col"
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
                  <label className="text-sm font-semibold mt-3 block" style={{ color: "var(--text-strong)" }}>
                    {user.hasPassword ? "비밀번호 변경" : "비밀번호 설정"}
                  </label>
                  {user.hasPassword && (
                    <Input
                      type="password"
                      placeholder="현재 비밀번호"
                      value={passwordInputs.current}
                      onChange={(e) => setPasswordInputs({ ...passwordInputs, current: e.target.value })}
                      className="mb-2 mt-2"
                    />
                  )}
                  <Input
                    type="password"
                    placeholder="새 비밀번호"
                    value={passwordInputs.new}
                    onChange={(e) => setPasswordInputs({ ...passwordInputs, new: e.target.value })}
                    className={`mb-2 ${user.hasPassword ? "" : "mt-2"}`}
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

            {/* 알림함 */}
            {view === "notifications" && (
              <div className="py-2">
                {!notifications || notifications.length === 0 ? (
                  <p className="text-sm text-center px-5 py-10" style={{ color: "var(--text-muted)" }}>
                    아직 받은 알림이 없어요
                  </p>
                ) : (
                  <div>
                    {!!unreadNotifications && unreadNotifications > 0 && (
                      <div className="flex justify-end px-4 py-2">
                        <button
                          onClick={() => markAllReadMutation.mutate()}
                          disabled={markAllReadMutation.isPending}
                          className="text-xs font-semibold hover:underline disabled:opacity-50"
                          style={{ color: "var(--accent-color)" }}
                        >
                          모두 읽음
                        </button>
                      </div>
                    )}
                    {notifications.map((notification) => {
                      const style = NOTIFICATION_STYLES[notification.type] ?? NOTIFICATION_STYLES.announcement;
                      const Icon = style.icon;
                      return (
                        <button
                          key={notification.id}
                          onClick={() => openNotification(notification)}
                          className="w-full text-left flex items-start gap-3 px-4 py-3 transition-colors hover:bg-black/[0.04] active:bg-black/[0.07]"
                          style={{ backgroundColor: notification.isRead ? undefined : "var(--accent-soft)" }}
                        >
                          {/* 종류별 아이콘 — 댓글/추천/이벤트를 한눈에 구분 */}
                          <span
                            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                            style={{ backgroundColor: style.tint, color: "var(--text-normal)" }}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold truncate" style={{ color: "var(--text-strong)" }}>
                              {notification.title}
                            </span>
                            {notification.body && (
                              <span className="block text-xs truncate mt-0.5" style={{ color: "var(--text-muted)" }}>
                                {notification.body}
                              </span>
                            )}
                          </span>
                          {/* 시각은 우측 정렬로 붙여 세로 공간을 아낀다 */}
                          <span className="flex shrink-0 items-center gap-1.5 pt-0.5">
                            <span className="text-[11px] whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                              {formatDistanceToNow(new Date(notification.createdAt), { locale: ko, addSuffix: true })}
                            </span>
                            {!notification.isRead && (
                              <span
                                aria-label="안 읽음"
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ backgroundColor: "var(--accent-color)" }}
                              />
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
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
                  {/* 스와치를 가로형 칩으로 눕혀 두 줄로 압축. 선택된 색은 링 + 체크로 표시한다. */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {THEME_COLORS.map(({ color, label, short, swatch }) => {
                      const selected = themeColor === color;
                      return (
                        <button
                          key={color}
                          onClick={() => {
                            setThemeColor(color);
                            toast.success(`${label} 색상으로 변경되었습니다`);
                          }}
                          aria-pressed={selected}
                          className="flex items-center gap-1.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-black/[0.04] active:bg-black/[0.07]"
                          style={{ backgroundColor: selected ? "var(--accent-soft)" : undefined }}
                        >
                          <span
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white transition-shadow"
                            style={{
                              backgroundColor: swatch,
                              boxShadow: selected ? `0 0 0 2px var(--bg-surface), 0 0 0 3.5px ${swatch}` : undefined,
                            }}
                          >
                            {selected && <Check className="h-3 w-3" strokeWidth={3} />}
                          </span>
                          <span
                            className="min-w-0 flex-1 truncate text-left text-[11px]"
                            style={{
                              color: selected ? "var(--text-strong)" : "var(--text-normal)",
                              fontWeight: selected ? 600 : 500,
                            }}
                            title={label}
                          >
                            {short}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 다크모드 CSS는 전부터 있었지만 켤 방법이 없어 죽은 코드였다. */}
                {toggleTheme && (
                  <div className="border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
                    <label className="text-sm font-semibold block mb-2" style={{ color: "var(--text-strong)" }}>
                      화면 모드
                    </label>
                    <button
                      onClick={toggleTheme}
                      className="flex w-full items-center justify-between rounded-lg px-2 py-2 -mx-2 text-sm transition-colors hover:bg-black/[0.04]"
                      style={{ color: "var(--text-normal)" }}
                    >
                      <span className="flex items-center gap-2">
                        {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                        {theme === "dark" ? "어두운 화면" : "밝은 화면"}
                      </span>
                      <span
                        aria-hidden="true"
                        className="relative h-5 w-9 shrink-0 rounded-full transition-colors"
                        style={{ backgroundColor: theme === "dark" ? "var(--accent-color)" : "var(--bg-surface-2)" }}
                      >
                        <span
                          className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all"
                          style={{ left: theme === "dark" ? "1.125rem" : "0.125rem" }}
                        />
                      </span>
                    </button>
                  </div>
                )}

                <div className="border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
                  <label className="text-sm font-semibold block mb-1" style={{ color: "var(--text-strong)" }}>
                    알림 수신 동의
                  </label>
                  <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
                    두 항목 모두 선택이며 언제든 바꿀 수 있어요.
                  </p>
                  <div className="space-y-3">
                    <label className="flex items-start gap-2.5 cursor-pointer" style={{ color: "var(--text-normal)" }}>
                      <Checkbox
                        className="mt-0.5"
                        checked={user.notifyPost}
                        disabled={updateNotifyPrefsMutation.isPending}
                        onCheckedChange={(checked) => updateNotifyPrefsMutation.mutate({ notifyPost: checked === true })}
                      />
                      <span className="text-sm leading-snug">
                        활동 알림
                        <span className="block text-xs" style={{ color: "var(--text-muted)" }}>
                          내 글의 댓글·추천 알림
                        </span>
                      </span>
                    </label>
                    <label className="flex items-start gap-2.5 cursor-pointer" style={{ color: "var(--text-normal)" }}>
                      <Checkbox
                        className="mt-0.5"
                        checked={user.notifyMarketing}
                        disabled={updateNotifyPrefsMutation.isPending}
                        onCheckedChange={(checked) => updateNotifyPrefsMutation.mutate({ notifyMarketing: checked === true })}
                      />
                      <span className="text-sm leading-snug">
                        광고성 정보
                        <span className="block text-xs" style={{ color: "var(--text-muted)" }}>
                          이벤트·제휴 소식 알림
                        </span>
                      </span>
                    </label>
                  </div>
                </div>

                {/* 약관·방침은 설정에서 상시 찾아볼 수 있어야 한다 */}
                <div className="border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
                  <label className="text-sm font-semibold block mb-2" style={{ color: "var(--text-strong)" }}>
                    약관 및 정책
                  </label>
                  <div className="space-y-1">
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        navigate("/terms");
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-2 py-2 -mx-2 text-sm transition-colors hover:bg-black/[0.04]"
                      style={{ color: "var(--text-normal)" }}
                    >
                      이용약관
                      <ChevronRight className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
                    </button>
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        navigate("/privacy");
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-2 py-2 -mx-2 text-sm transition-colors hover:bg-black/[0.04]"
                      style={{ color: "var(--text-normal)" }}
                    >
                      개인정보처리방침
                      <ChevronRight className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
                    </button>
                  </div>
                </div>

                {/* 탈퇴는 되돌릴 수 없어 맨 아래에 두고, 확인 문구를 정확히 입력해야 눌린다. */}
                <div className="border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
                  <label className="text-sm font-semibold block mb-1" style={{ color: "var(--text-strong)" }}>
                    회원 탈퇴
                  </label>
                  <p className="text-xs mb-2 leading-5" style={{ color: "var(--text-muted)" }}>
                    이름·이메일·프로필 사진이 삭제되고 다시 로그인할 수 없습니다. 작성한 글과 댓글은 남으며,
                    작성자는 알 수 없게 표시됩니다. 되돌릴 수 없어요.
                  </p>
                  <Input
                    value={withdrawInput}
                    onChange={(e) => setWithdrawInput(e.target.value)}
                    placeholder={`확인을 위해 "${WITHDRAW_CONFIRM_TEXT}"를 입력하세요`}
                    className="mb-2 h-9 text-[13px]"
                  />
                  <Button
                    variant="outline"
                    disabled={withdrawInput !== WITHDRAW_CONFIRM_TEXT || withdrawMutation.isPending}
                    onClick={() => withdrawMutation.mutate({ confirm: WITHDRAW_CONFIRM_TEXT })}
                    className="w-full"
                  >
                    {withdrawMutation.isPending ? "처리 중..." : "탈퇴하기"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
