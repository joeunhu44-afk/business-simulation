import { useState } from "react";
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

// blur는 아주 약하게만 걸리므로(가장자리만 부드럽게), 크레이터/줄무늬 등
// 표면 디테일은 흐려져도 형태가 남도록 스팟 크기와 대비를 넉넉하게 잡는다.
const MOON_GRADIENT = [
  "radial-gradient(circle at 28% 62%, rgba(120,120,120,0.75) 0%, rgba(120,120,120,0) 16%)",
  "radial-gradient(circle at 62% 24%, rgba(110,110,110,0.7) 0%, rgba(110,110,110,0) 19%)",
  "radial-gradient(circle at 72% 60%, rgba(130,130,128,0.65) 0%, rgba(130,130,128,0) 14%)",
  "radial-gradient(circle at 40% 84%, rgba(120,120,118,0.6) 0%, rgba(120,120,118,0) 13%)",
  "radial-gradient(circle at 18% 26%, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0) 24%)",
  "radial-gradient(circle at 40% 38%, #f6f6f3 0%, #d5d5d0 55%, #b9b9b3 100%)",
].join(", ");

const MARS_GRADIENT = [
  "radial-gradient(circle at 64% 56%, rgba(95,35,15,0.6) 0%, rgba(95,35,15,0) 17%)",
  "radial-gradient(circle at 28% 66%, rgba(115,45,20,0.55) 0%, rgba(115,45,20,0) 15%)",
  "radial-gradient(circle at 55% 84%, rgba(105,40,18,0.5) 0%, rgba(105,40,18,0) 12%)",
  "radial-gradient(ellipse 60% 16% at 42% 38%, rgba(140,55,25,0.55) 0%, rgba(140,55,25,0) 75%)",
  "radial-gradient(ellipse 50% 12% at 60% 68%, rgba(130,50,22,0.45) 0%, rgba(130,50,22,0) 75%)",
  "radial-gradient(circle at 32% 28%, #eea082 0%, #c2601f 55%, #8c3d18 100%)",
].join(", ");

const JUPITER_GRADIENT = [
  "radial-gradient(circle at 32% 26%, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 34%)",
  "repeating-linear-gradient(0deg, rgba(100,60,34,0.5) 0px, rgba(100,60,34,0.5) 7px, transparent 7px, transparent 16px, rgba(196,146,100,0.4) 16px, rgba(196,146,100,0.4) 23px, transparent 23px, transparent 34px)",
  "radial-gradient(circle at 36% 34%, #f2ddb9 0%, #d3ac78 55%, #a97c4a 100%)",
].join(", ");

const SATURN_RING_GRADIENT =
  "radial-gradient(ellipse at center, transparent 48%, rgba(206,184,132,0.85) 55%, rgba(206,184,132,0.85) 78%, transparent 84%)";
const SATURN_BODY_GRADIENT = "radial-gradient(circle at 33% 30%, #f7e9c8 0%, #ddb97e 55%, #b48c50 100%)";

function shuffle<T>(list: T[]): T[] {
  const result = [...list];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function PlanetVisual({ planet, sizeClass }: { planet: PlanetKey; sizeClass: string }) {
  switch (planet) {
    case "moon":
      return <div className={`rounded-full ${sizeClass}`} style={{ background: MOON_GRADIENT }} />;
    case "mars":
      return <div className={`rounded-full ${sizeClass}`} style={{ background: MARS_GRADIENT }} />;
    case "jupiter":
      return <div className={`rounded-full ${sizeClass}`} style={{ background: JUPITER_GRADIENT }} />;
    case "saturn":
      return (
        <div className={`relative ${sizeClass}`}>
          {/* 살짝 기울어진 얇은 고리 — 몸체 뒤에서 앞뒤로 감싸는 느낌만 흐릿하게 낸다 */}
          <div
            className="absolute top-1/2 left-1/2 w-full h-[34%] rounded-full"
            style={{ transform: "translate(-50%, -50%) rotate(-16deg)", background: SATURN_RING_GRADIENT }}
          />
          <div
            className="absolute top-1/2 left-1/2 w-[62%] h-[62%] rounded-full"
            style={{ transform: "translate(-50%, -50%)", background: SATURN_BODY_GRADIENT }}
          />
        </div>
      );
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
