import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";

/**
 * 홈 화면 전용 배경 장식 — 낮 하늘에 희미하게 비치는 행성들.
 * 전역 AnimatedBackground(단색 배경) 위, 실제 콘텐츠 아래에 겹쳐 그린다.
 * 다른 페이지에는 영향이 없도록 Home.tsx에서만 마운트한다.
 */

interface PlanetConfig {
  id: string;
  sizeClass: string;
  positionClass: string;
  gradient: string;
  opacity: number;
  blurClass: string;
  floatX: number;
  floatY: number;
  floatDuration: number;
  floatDelay: number;
  parallaxDistance: number;
  hideOnMobile?: boolean;
}

const PLANETS: PlanetConfig[] = [
  {
    id: "apricot",
    sizeClass: "w-[200px] h-[200px] sm:w-[320px] sm:h-[320px]",
    positionClass: "top-[4%] -right-20 sm:right-[2%]",
    gradient:
      "radial-gradient(circle at 32% 30%, rgba(255,195,140,1) 0%, rgba(235,140,90,0.75) 55%, rgba(235,140,90,0) 75%)",
    opacity: 0.4,
    blurClass: "blur-2xl",
    floatX: 10,
    floatY: 16,
    floatDuration: 26,
    floatDelay: 0,
    parallaxDistance: -140,
  },
  {
    id: "slate-blue",
    sizeClass: "w-[150px] h-[150px] sm:w-[250px] sm:h-[250px]",
    positionClass: "top-[42%] -left-16 sm:left-[3%]",
    gradient:
      "radial-gradient(circle at 35% 32%, rgba(190,214,228,1) 0%, rgba(120,155,180,0.7) 55%, rgba(120,155,180,0) 75%)",
    opacity: 0.36,
    blurClass: "blur-2xl",
    floatX: -8,
    floatY: 12,
    floatDuration: 32,
    floatDelay: 2,
    parallaxDistance: -80,
  },
  {
    id: "sage",
    sizeClass: "w-[110px] h-[110px] sm:w-[180px] sm:h-[180px]",
    positionClass: "bottom-[8%] right-[6%] sm:right-[16%]",
    gradient:
      "radial-gradient(circle at 30% 30%, rgba(200,220,190,1) 0%, rgba(140,168,130,0.7) 55%, rgba(140,168,130,0) 75%)",
    opacity: 0.3,
    blurClass: "blur-xl",
    floatX: 6,
    floatY: -10,
    floatDuration: 22,
    floatDelay: 4,
    parallaxDistance: -40,
    hideOnMobile: true,
  },
];

function PlanetLayer({
  planet,
  scrollY,
  reducedMotion,
}: {
  planet: PlanetConfig;
  scrollY: MotionValue<number>;
  reducedMotion: boolean;
}) {
  // 스크롤에 따라 행성마다 다른 속도로 위로 이동 (거리감 있는 패럴랙스).
  const rawParallaxY = useTransform(scrollY, [0, 2400], [0, planet.parallaxDistance]);

  return (
    <motion.div
      className={`absolute ${planet.positionClass} ${planet.hideOnMobile ? "hidden sm:block" : ""}`}
      style={{ y: reducedMotion ? 0 : rawParallaxY }}
    >
      <motion.div
        className={`rounded-full ${planet.sizeClass} ${planet.blurClass}`}
        style={{ background: planet.gradient, opacity: planet.opacity }}
        animate={
          reducedMotion
            ? undefined
            : { x: [0, planet.floatX, 0], y: [0, planet.floatY, 0] }
        }
        transition={
          reducedMotion
            ? undefined
            : {
                duration: planet.floatDuration,
                delay: planet.floatDelay,
                repeat: Infinity,
                ease: "easeInOut",
              }
        }
      />
    </motion.div>
  );
}

export default function HomeSpaceBackground() {
  const { scrollY } = useScroll();
  const reducedMotion = useReducedMotion() ?? false;

  return (
    <div className="fixed inset-0 -z-[5] overflow-hidden pointer-events-none" aria-hidden="true">
      {PLANETS.map((planet) => (
        <PlanetLayer key={planet.id} planet={planet} scrollY={scrollY} reducedMotion={reducedMotion} />
      ))}
    </div>
  );
}
