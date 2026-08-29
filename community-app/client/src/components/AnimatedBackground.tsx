export default function AnimatedBackground() {
  // 에브리타임 스타일: 깔끔한 라이트 배경 (장식 없음)
  return (
    <div
      className="fixed inset-0 -z-10"
      style={{ backgroundColor: "var(--bg-base)" }}
    />
  );
}
