import { useId, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";

/**
 * 홈 화면 전용 배경 장식 — 밝은 낮 하늘에 희미하게 비치는 행성들.
 * 전역 AnimatedBackground(단색 배경) 위, 실제 콘텐츠 아래에 겹쳐 그린다.
 * 다른 페이지에는 영향이 없도록 Home.tsx에서만 마운트한다.
 *
 * - 위치("슬롯")는 페이지 전체 스크롤 높이에 대한 %로 정의되어 있어서,
 *   글이 늘어나 페이지가 길어지면 아래쪽 슬롯도 자연스럽게 스크롤해서 나타난다.
 * - 어떤 슬롯에 어떤 행성(달/화성/토성/목성)이 들어갈지는 마운트(새로고침) 시
 *   한 번만 무작위로 섞인다. 슬롯 자체의 크기/속도/불투명도는 고정이라
 *   섞여도 "가까운 슬롯=크고 빠름, 먼 슬롯=작고 느림" 규칙은 유지된다.
 */

type PlanetKey = "moon" | "mars" | "saturn" | "jupiter";

interface SlotConfig {
  id: string;
  verticalPercent: number; // 페이지 전체 스크롤 높이 기준 %
  sideClass: string; // 좌/우 여백 배치 (모바일 살짝 걸치기 + sm: 이상 안쪽으로)
  sizeClass: string; // 전체 바운딩 박스 크기 (토성은 고리 포함)
  opacity: number;
  blurClass: string;
  floatX: number;
  floatY: number;
  floatDuration: number;
  floatDelay: number;
  parallaxSpeed: number; // 1보다 크면 더 빠르게(가까운 느낌), 작으면 더 느리게(먼 느낌)
  hideOnMobile?: boolean;
}

const BASE_DRIFT = 80; // px — 슬롯의 parallaxSpeed가 이 기준값에 곱해져 스크롤 추가 이동량을 만든다

const SLOTS: SlotConfig[] = [
  {
    id: "slot-a",
    verticalPercent: 3,
    sideClass: "-right-16 sm:right-[3%]",
    sizeClass: "w-[190px] h-[190px] sm:w-[300px] sm:h-[300px]",
    opacity: 0.4,
    blurClass: "blur-[3px]",
    floatX: 10,
    floatY: 16,
    floatDuration: 26,
    floatDelay: 0,
    parallaxSpeed: 1.5,
  },
  {
    id: "slot-b",
    verticalPercent: 26,
    sideClass: "-left-14 sm:-left-6",
    sizeClass: "w-[140px] h-[140px] sm:w-[230px] sm:h-[230px]",
    opacity: 0.34,
    blurClass: "blur-[3px]",
    floatX: -8,
    floatY: 12,
    floatDuration: 32,
    floatDelay: 2,
    parallaxSpeed: 1.05,
  },
  {
    id: "slot-c",
    verticalPercent: 56,
    sideClass: "-right-10 sm:right-[10%]",
    sizeClass: "w-[110px] h-[110px] sm:w-[190px] sm:h-[190px]",
    opacity: 0.28,
    blurClass: "blur-[2px]",
    floatX: 7,
    floatY: -10,
    floatDuration: 22,
    floatDelay: 4,
    parallaxSpeed: 0.7,
    hideOnMobile: true,
  },
  {
    id: "slot-d",
    verticalPercent: 84,
    sideClass: "-left-10 sm:-left-4",
    sizeClass: "w-[90px] h-[90px] sm:w-[160px] sm:h-[160px]",
    opacity: 0.22,
    blurClass: "blur-[2px]",
    floatX: -6,
    floatY: 10,
    floatDuration: 20,
    floatDelay: 6,
    parallaxSpeed: 0.45,
    hideOnMobile: true,
  },
];

const PLANET_KEYS: PlanetKey[] = ["moon", "mars", "saturn", "jupiter"];

function shuffle<T>(list: T[]): T[] {
  const result = [...list];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * 각 행성은 SVG로 그린다: 구체는 radialGradient로 한쪽에서 빛을 받는 느낌(음영)을 주고,
 * 표면 무늬는 feTurbulence 필터로 자연스러운(기계적이지 않은) 얼룩/줄무늬를 만든다.
 * 인스턴스마다 고유한 id 접두사를 붙여 여러 개가 동시에 떠 있어도 gradient/filter가 서로 섞이지 않게 한다.
 */
function PlanetVisual({ planet, sizeClass }: { planet: PlanetKey; sizeClass: string }) {
  const uid = useId().replace(/[:]/g, "");

  switch (planet) {
    case "moon": {
      const base = `moonBase-${uid}`;
      const noise = `moonNoise-${uid}`;
      return (
        <svg viewBox="0 0 100 100" className={sizeClass} style={{ overflow: "visible" }}>
          <defs>
            <radialGradient id={base} cx="35%" cy="32%" r="75%">
              <stop offset="0%" stopColor="#fcfcfa" />
              <stop offset="55%" stopColor="#d7d7d2" />
              <stop offset="100%" stopColor="#a3a39d" />
            </radialGradient>
            <filter id={noise} x="-20%" y="-20%" width="140%" height="140%">
              <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves={3} seed={11} result="n" />
              <feColorMatrix
                in="n"
                type="matrix"
                values="0 0 0 0 0.32  0 0 0 0 0.32  0 0 0 0 0.3  0 0 0 1.1 -0.42"
                result="tex"
              />
              <feComposite in="tex" in2="SourceGraphic" operator="in" />
            </filter>
          </defs>
          <circle cx="50" cy="50" r="48" fill={`url(#${base})`} />
          <circle cx="50" cy="50" r="48" filter={`url(#${noise})`} opacity={0.55} />
          {/* 큰 크레이터 몇 개 — 테두리는 밝게, 안쪽은 그림자로 파인 느낌 */}
          <circle cx="34" cy="66" r="7" fill="#00000022" />
          <circle cx="33" cy="64" r="6.4" fill="#ffffff26" />
          <circle cx="62" cy="28" r="5.5" fill="#00000022" />
          <circle cx="61" cy="26.3" r="5" fill="#ffffff26" />
          <circle cx="70" cy="60" r="4" fill="#00000020" />
        </svg>
      );
    }
    case "mars": {
      const base = `marsBase-${uid}`;
      const noise = `marsNoise-${uid}`;
      return (
        <svg viewBox="0 0 100 100" className={sizeClass} style={{ overflow: "visible" }}>
          <defs>
            <radialGradient id={base} cx="34%" cy="30%" r="78%">
              <stop offset="0%" stopColor="#f0ad8c" />
              <stop offset="55%" stopColor="#c96b34" />
              <stop offset="100%" stopColor="#8a3f1a" />
            </radialGradient>
            <filter id={noise} x="-20%" y="-20%" width="140%" height="140%">
              <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves={3} seed={4} result="n" />
              <feColorMatrix
                in="n"
                type="matrix"
                values="0 0 0 0 0.32  0 0 0 0 0.14  0 0 0 0 0.06  0 0 0 1.1 -0.32"
                result="tex"
              />
              <feComposite in="tex" in2="SourceGraphic" operator="in" />
            </filter>
          </defs>
          <circle cx="50" cy="50" r="48" fill={`url(#${base})`} />
          <circle cx="50" cy="50" r="48" filter={`url(#${noise})`} opacity={0.6} />
        </svg>
      );
    }
    case "jupiter": {
      const base = `jupBase-${uid}`;
      const bands = `jupBands-${uid}`;
      return (
        <svg viewBox="0 0 100 100" className={sizeClass} style={{ overflow: "visible" }}>
          <defs>
            <radialGradient id={base} cx="34%" cy="30%" r="78%">
              <stop offset="0%" stopColor="#faeecb" />
              <stop offset="55%" stopColor="#dcb583" />
              <stop offset="100%" stopColor="#a97c4a" />
            </radialGradient>
            <filter id={bands} x="-20%" y="-20%" width="140%" height="140%">
              <feTurbulence type="fractalNoise" baseFrequency="0.012 0.24" numOctaves={2} seed={9} result="n" />
              <feColorMatrix
                in="n"
                type="matrix"
                values="0 0 0 0 0.33  0 0 0 0 0.2  0 0 0 0 0.09  0 0 0 1.4 -0.5"
                result="tex"
              />
              <feComposite in="tex" in2="SourceGraphic" operator="in" />
            </filter>
          </defs>
          <circle cx="50" cy="50" r="48" fill={`url(#${base})`} />
          <circle cx="50" cy="50" r="48" filter={`url(#${bands})`} opacity={0.6} />
          <ellipse cx="66" cy="58" rx="7" ry="4.2" fill="#b5502f" opacity={0.55} />
        </svg>
      );
    }
    case "saturn": {
      const base = `satBase-${uid}`;
      const ring = `satRing-${uid}`;
      const clip = `satClip-${uid}`;
      return (
        <svg viewBox="0 0 100 100" className={sizeClass} style={{ overflow: "visible" }}>
          <defs>
            <radialGradient id={base} cx="34%" cy="30%" r="78%">
              <stop offset="0%" stopColor="#faf1d6" />
              <stop offset="55%" stopColor="#e0c48c" />
              <stop offset="100%" stopColor="#b48c50" />
            </radialGradient>
            <linearGradient id={ring} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#cdb27f" stopOpacity={0.1} />
              <stop offset="15%" stopColor="#cdb27f" stopOpacity={0.85} />
              <stop offset="50%" stopColor="#e8d3a3" stopOpacity={0.92} />
              <stop offset="85%" stopColor="#cdb27f" stopOpacity={0.85} />
              <stop offset="100%" stopColor="#cdb27f" stopOpacity={0.1} />
            </linearGradient>
            <clipPath id={clip}>
              <rect x="0" y="50" width="100" height="50" />
            </clipPath>
          </defs>
          {/* 고리 뒷부분 — 몸체 뒤로 지나가는 절반 */}
          <ellipse
            cx="50"
            cy="50"
            rx="46"
            ry="12"
            fill="none"
            stroke={`url(#${ring})`}
            strokeWidth={9}
            transform="rotate(-14 50 50)"
          />
          {/* 몸체 */}
          <circle cx="50" cy="50" r="30" fill={`url(#${base})`} />
          {/* 고리 앞부분 — 몸체 아래쪽을 가로지르는 절반만 보이게 클립 */}
          <g clipPath={`url(#${clip})`}>
            <ellipse
              cx="50"
              cy="50"
              rx="46"
              ry="12"
              fill="none"
              stroke={`url(#${ring})`}
              strokeWidth={9}
              transform="rotate(-14 50 50)"
            />
          </g>
        </svg>
      );
    }
  }
}

function PlanetLayer({
  slot,
  planet,
  scrollYProgress,
  reducedMotion,
}: {
  slot: SlotConfig;
  planet: PlanetKey;
  scrollYProgress: MotionValue<number>;
  reducedMotion: boolean;
}) {
  // 기본 위치는 문서 전체 높이의 %로 고정해두고(=콘텐츠가 늘어나면 같이 늘어남),
  // 스크롤 진행률에 따라 슬롯마다 다른 양만큼 더 얹어서 서로 다른 속도로 보이게 한다.
  const rawExtraY = useTransform(scrollYProgress, [0, 1], [0, -(slot.parallaxSpeed - 1) * BASE_DRIFT]);

  return (
    <motion.div
      className={`absolute ${slot.sideClass} ${slot.hideOnMobile ? "hidden sm:block" : ""}`}
      style={{ top: `${slot.verticalPercent}%`, y: reducedMotion ? 0 : rawExtraY }}
    >
      <motion.div
        className={slot.blurClass}
        style={{ opacity: slot.opacity }}
        animate={reducedMotion ? undefined : { x: [0, slot.floatX, 0], y: [0, slot.floatY, 0] }}
        transition={
          reducedMotion
            ? undefined
            : { duration: slot.floatDuration, delay: slot.floatDelay, repeat: Infinity, ease: "easeInOut" }
        }
      >
        <PlanetVisual planet={planet} sizeClass={slot.sizeClass} />
      </motion.div>
    </motion.div>
  );
}

export default function HomeSpaceBackground() {
  // 페이지 전체(문서) 스크롤 진행률 — 콘텐츠가 늘어나 페이지가 길어지면 범위도 자동으로 늘어난다.
  const { scrollYProgress } = useScroll();
  const reducedMotion = useReducedMotion() ?? false;
  // 마운트(새로고침) 시 한 번만 섞고, 이후 리렌더/스크롤에는 다시 섞이지 않는다.
  const [planetOrder] = useState<PlanetKey[]>(() => shuffle(PLANET_KEYS));

  return (
    <div className="absolute inset-0 -z-[5] overflow-hidden pointer-events-none" aria-hidden="true">
      {SLOTS.map((slot, i) => (
        <PlanetLayer
          key={slot.id}
          slot={slot}
          planet={planetOrder[i % planetOrder.length]}
          scrollYProgress={scrollYProgress}
          reducedMotion={reducedMotion}
        />
      ))}
    </div>
  );
}
