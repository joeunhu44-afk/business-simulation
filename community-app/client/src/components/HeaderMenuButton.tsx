import { Menu } from "lucide-react";
import { useMenu } from "@/contexts/MenuContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

/**
 * 헤더(로고 옆)에 인라인으로 배치하는 메뉴 버튼.
 * 전역 MenuContext를 통해 TopLeftMenu 패널을 연다.
 * 로그인 상태에서만 노출된다.
 */
export default function HeaderMenuButton() {
  const { openMenu } = useMenu();
  const { user } = useAuth();

  const { data: unreadCount } = trpc.chat.unreadCount.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 10000,
  });

  if (!user) return null;

  return (
    <button
      onClick={openMenu}
      aria-label="메뉴 열기"
      className="relative inline-flex items-center justify-center rounded-lg p-2 transition-colors hover:bg-black/5 active:scale-95"
      style={{ transition: "transform 160ms cubic-bezier(0.23, 1, 0.32, 1)" }}
    >
      <Menu className="h-6 w-6" style={{ color: "var(--text-strong)" }} />
      {!!unreadCount && unreadCount > 0 && (
        <span
          className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full text-white text-[10px] font-bold flex items-center justify-center"
          style={{ backgroundColor: "var(--accent-color)" }}
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  );
}
