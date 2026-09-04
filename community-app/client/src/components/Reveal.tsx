import { motion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * 뷰포트에 들어올 때 나타나는 스크롤 리빌 래퍼. 기본값은 살짝 아래에서 위로
 * 떠오르며(y) 페이드인되지만, slide={false}를 주면 위/아래로 이동하지 않고
 * 제자리에서 페이드인/아웃만 한다.
 * 같은 그룹 안에서 delay를 주면 순차적으로 나타나는 느낌을 낼 수 있다.
 * once:false라서 위/아래로 스크롤하며 같은 요소를 다시 지나갈 때마다 매번 다시 재생된다
 * (뷰포트를 벗어나면 initial 상태로 돌아갔다가, 다시 들어오면 재생).
 */
export default function Reveal({
  children,
  delay = 0,
  duration = 0.6,
  className,
  slide = true,
}: {
  children: ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
  slide?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: slide ? 24 : 0 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, margin: "-80px" }}
      transition={{ duration, delay, ease: [0.23, 1, 0.32, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
