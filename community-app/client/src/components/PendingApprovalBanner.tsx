import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import { Clock } from "lucide-react";

/**
 * 승인 대기(pending) 계정에게 항상 보이는 안내 띠.
 *
 * App.tsx에 전역으로 한 번만 마운트한다 — 페이지마다 붙이면 새 페이지를 추가할 때
 * 빠뜨리게 되고, 승인 대기자는 어느 화면에서 막히든 같은 이유를 알아야 한다.
 * 글쓰기 버튼을 눌렀다가 에러 토스트를 보고 나서야 이유를 아는 상황을 막는 게 목적.
 */
export default function PendingApprovalBanner() {
  const { user } = useAuth();

  if (!user || user.status !== "pending") return null;

  return (
    <div
      role="status"
      // sticky로 두면 아래 헤더(sticky top-3)와 겹쳐 보이고 모바일에서 세로 공간을
      // 계속 먹는다. 진입 시 최상단에 한 번 보이면 충분하므로 같이 스크롤되게 둔다.
      // relative z-40은 전역 ScrollEdgeFade(화면 위 페이드 오버레이, z-30) 위로
      // 올리기 위한 것 — 안 그러면 화면 맨 위에 있는 이 안내가 뿌옇게 덮인다.
      className="relative z-40 border-b px-4 py-2.5"
      style={{
        backgroundColor: "var(--accent-soft)",
        borderColor: "var(--border-color)",
        color: "var(--text-normal)",
      }}
    >
      <div className="container flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-[13px]">
        <Clock className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--accent-color)" }} />
        <span className="font-semibold" style={{ color: "var(--text-strong)" }}>
          관리자 승인 대기 중입니다
        </span>
        <span style={{ color: "var(--text-muted)" }}>
          승인되면 알림으로 알려드리고, 글쓰기·댓글·쪽지를 이용할 수 있어요.
        </span>
        <Link href="/inquiries" className="font-semibold underline underline-offset-2" style={{ color: "var(--accent-color)" }}>
          문의하기
        </Link>
      </div>
    </div>
  );
}
