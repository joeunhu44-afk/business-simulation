import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * 빈 상태(게시글 없음, 검색 결과 없음 등) 공용 UI. 회색 글씨 한 줄 대신
 * 은은한 아이콘 배지 + 제목 + (선택) 설명/행동 버튼으로 구성하고,
 * cosmic-empty로 아주 옅은 별 반짝임을 얹어 우주 컨셉과 이어지게 한다.
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = "",
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`cosmic-empty flex flex-col items-center justify-center gap-3 py-12 text-center ${className}`}>
      <span className="empty-state-icon">
        <Icon className="h-6 w-6" />
      </span>
      <div>
        <p className="font-semibold" style={{ color: "var(--text-strong)" }}>{title}</p>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {action}
    </div>
  );
}
