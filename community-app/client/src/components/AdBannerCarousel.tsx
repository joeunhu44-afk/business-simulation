import { trpc } from "@/lib/trpc";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const SLIDE_INTERVAL_MS = 5000;

/**
 * 광고 배너 캐러셀. position="home_top"이면 홈 상단, position="board_top"이면
 * boardId로 지정된 게시판을 타겟팅한 배너만 노출한다. 활성 배너가 없으면
 * 아무것도 렌더링하지 않는다(레이아웃에 빈 공간을 남기지 않음).
 */
export default function AdBannerCarousel({
  position,
  boardId,
  className,
}: {
  position: "home_top" | "board_top";
  boardId?: number;
  className?: string;
}) {
  const { data: banners } = trpc.adBanners.list.useQuery(
    { position, boardId },
    { enabled: position === "home_top" || !!boardId }
  );
  const recordClick = trpc.adBanners.recordClick.useMutation();
  const recordImpression = trpc.adBanners.recordImpression.useMutation();
  const [index, setIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const impressedIds = useRef<Set<number>>(new Set());
  const reducedMotion = useReducedMotion() ?? false;

  const list = banners ?? [];
  const current = list[index % list.length];

  // 여러 개면 자동 슬라이드 (단, 모션 최소화 설정 시 자동 전환하지 않음)
  useEffect(() => {
    if (list.length <= 1 || reducedMotion) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % list.length);
    }, SLIDE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [list.length, reducedMotion]);

  // 현재 보이는 배너가 실제로 화면에 노출됐을 때만 impressionCount 카운트
  useEffect(() => {
    if (!current || !containerRef.current) return;
    const bannerId = current.id;
    if (impressedIds.current.has(bannerId)) return;
    const el = containerRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !impressedIds.current.has(bannerId)) {
            impressedIds.current.add(bannerId);
            recordImpression.mutate({ id: bannerId });
          }
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  if (!current) return null;

  const handleClick = () => {
    recordClick.mutate({ id: current.id });
    window.open(current.linkUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div ref={containerRef} className={`card-elevated board-card relative overflow-hidden ${className || ""}`}>
      <span className="absolute top-2 left-2 z-10 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold text-white bg-black/55 backdrop-blur-sm">
        광고
      </span>
      <AnimatePresence mode="wait">
        <motion.button
          key={current.id}
          type="button"
          onClick={handleClick}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="block w-full text-left"
          aria-label={current.title}
        >
          <img
            src={current.imageUrl}
            alt={current.title}
            className="w-full h-auto max-h-48 object-cover"
            loading="lazy"
          />
        </motion.button>
      </AnimatePresence>
      {list.length > 1 && (
        <div className="absolute bottom-2 right-2 z-10 flex items-center gap-1">
          {list.map((b, i) => (
            <button
              key={b.id}
              type="button"
              aria-label={`${i + 1}번째 배너로 이동`}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-4 bg-white" : "w-1.5 bg-white/50"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
