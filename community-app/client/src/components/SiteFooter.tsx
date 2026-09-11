import { Link } from "wouter";

/**
 * 홈 화면 하단 푸터. 약관·개인정보처리방침으로 가는 상시 통로다.
 *
 * 설정 메뉴에도 같은 링크를 뒀지만, 로그인하지 않은 방문자는 메뉴를 열 이유가 없어
 * 문서에 닿을 방법이 없다. 푸터는 그 경로를 대신한다.
 */
export default function SiteFooter() {
  return (
    <footer
      className="mt-4 border-t px-4 py-6"
      style={{ borderColor: "var(--border-color)" }}
    >
      <div className="container flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[13px]">
        <Link href="/terms" className="hover:underline" style={{ color: "var(--text-muted)" }}>
          이용약관
        </Link>
        <span aria-hidden="true" style={{ color: "var(--text-muted)" }}>
          ·
        </span>
        {/* 개인정보처리방침은 관례상 약관보다 강조해서 표기한다 */}
        <Link href="/privacy" className="font-semibold hover:underline" style={{ color: "var(--text-normal)" }}>
          개인정보처리방침
        </Link>
        <span aria-hidden="true" style={{ color: "var(--text-muted)" }}>
          ·
        </span>
        <Link href="/inquiries" className="hover:underline" style={{ color: "var(--text-muted)" }}>
          문의하기
        </Link>
      </div>
    </footer>
  );
}
