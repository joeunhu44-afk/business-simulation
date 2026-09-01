import { motion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * 뷰포트에 들어올 때 살짝 아래에서 위로 떠오르며 나타나는 스크롤 리빌 래퍼.
 * 같은 그룹 안에서 delay를 주면 순차적으로 나타나는 느낌을 낼 수 있다.
 * once:false라서 위/아래로 스크롤하며 같은 요소를 다시 지나갈 때마다 매번 다시 재생된다
 * (뷰포트를 벗어나면 initial 상태로 돌아갔다가, 다시 들어오면 재생).
 */
export default function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, margin: "-80px" }}
      transition={{ duration: 0.6, delay, ease: [0.23, 1, 0.32, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
