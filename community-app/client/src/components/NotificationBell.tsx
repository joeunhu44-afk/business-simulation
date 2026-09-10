import { Bell } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useMenu } from "@/contexts/MenuContext";

/**
 * 상단바 알림 아이콘. 안 읽은 알림이 있으면 개수 뱃지 대신 primary 색 작은 점만
 * 띄운다(알림/긴급 느낌을 주지 않기 위해). 누르면 슬라이드 메뉴의 알림함이 열린다.
 */
export default function NotificationBell({ className = "" }: { className?: string }) {
  const { openMenu } = useMenu();
  const { data: unreadCount } = trpc.notifications.unreadCount.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  const hasUnread = !!unreadCount && unreadCount > 0;

  return (
    <button
      onClick={() => openMenu("notifications")}
      aria-label={hasUnread ? `알림 ${unreadCount}건 안 읽음` : "알림"}
      title="알림"
      className={`relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-secondary transition-colors shrink-0 ${className}`}
    >
      <Bell className="h-[18px] w-[18px] text-muted-foreground" />
      {hasUnread && (
        <span
          aria-hidden="true"
          className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: "var(--accent-color)" }}
        />
      )}
    </button>
  );
}
