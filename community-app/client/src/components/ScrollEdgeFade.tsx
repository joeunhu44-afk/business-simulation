/**
 * 화면 위/아래 끝에서 콘텐츠가 배경색으로 서서히 사라지는 페이드 효과.
 * 스크롤 위치와 무관하게 항상 떠 있는 고정 오버레이라, 스크롤할 때마다
 * (매번, 몇 번이든) 지나가는 콘텐츠가 경계에서 자연스럽게 옅어져 보인다.
 */
export default function ScrollEdgeFade() {
  return (
    <>
      <div
        className="pointer-events-none fixed top-0 left-0 right-0 h-20 sm:h-28 z-30"
        style={{ background: "linear-gradient(to bottom, var(--bg-base) 0%, transparent 100%)" }}
      />
      <div
        className="pointer-events-none fixed bottom-0 left-0 right-0 h-20 sm:h-28 z-30"
        style={{ background: "linear-gradient(to top, var(--bg-base) 0%, transparent 100%)" }}
      />
    </>
  );
}
