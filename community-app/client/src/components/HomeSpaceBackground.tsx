import { useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";
import moonImg from "@/assets/planets/moon.png";
import marsImg from "@/assets/planets/mars.png";
import jupiterImg from "@/assets/planets/jupiter.png";
import saturnImg from "@/assets/planets/saturn.png";

/**
 * 홈 화면 전용 배경 장식 — 밝은 낮 하늘에 희미하게 비치는 행성들.
 * 전역 AnimatedBackground(단색 배경) 위, 실제 콘텐츠 아래에 겹쳐 그린다.
 * 다른 페이지에는 영향이 없도록 Home.tsx에서만 마운트한다.
 *
 * 행성 이미지는 NASA가 공개한 실제 행성 사진(태양계 합성 이미지)에서 잘라내
 * 검은 우주 배경을 투명하게 처리한 PNG다 (client/src/assets/planets). "달" 슬롯은
 * 태양계 사진 속 수성(크레이터로 덮인 회색 표면이 달과 매우 흡사) 사진을 사용했다 —
 * 실제 달 표면 질감과 거의 동일해 보이는 결정적 라벨은 아니고 순수 장식용이다.
 *
 * - 위치("슬롯")는 페이지 전체 스크롤 높이에 대한 %로 정의되어 있어서,
 *   글이 늘어나 페이지가 길어지면 아래쪽 슬롯도 자연스럽게 스크롤해서 나타난다.
 * - 슬롯 간 세로 간격을 넉넉히 벌려서, 스크롤할 때 한 번에 하나의 행성만
 *   화면에 크게 들어오는 느낌을 준다.
 * - 어떤 슬롯에 어떤 행성(달/화성/토성/목성)이 들어갈지는 마운트(새로고침) 시
 *   한 번만 무작위로 섞인다 — SLOTS는 항상 위→아래 순서로 정의돼 있고 섞인
 *   결과를 그 순서 그대로 배정하므로, 스크롤을 내리며 만나는 행성의 순서
 *   자체가 새로고침마다 랜덤해진다. 슬롯 자체의 크기/속도/불투명도는 고정이라
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
}

const BASE_DRIFT = 80; // px — 슬롯의 parallaxSpeed가 이 기준값에 곱해져 스크롤 추가 이동량을 만든다

const SLOTS: SlotConfig[] = [
  {
    id: "slot-a",
    verticalPercent: 4,
    sideClass: "-right-[18vw] sm:right-[2%]",
    sizeClass: "w-[64vw] h-[64vw] sm:w-[420px] sm:h-[420px]",
    opacity: 0.34,
    blurClass: "blur-[3px]",
    floatX: 12,
    floatY: 18,
    floatDuration: 26,
    floatDelay: 0,
    parallaxSpeed: 1.5,
  },
  {
    id: "slot-b",
    verticalPercent: 34,
    sideClass: "-left-[16vw] sm:-left-[4%]",
    sizeClass: "w-[54vw] h-[54vw] sm:w-[360px] sm:h-[360px]",
    opacity: 0.3,
    blurClass: "blur-[3px]",
    floatX: -10,
    floatY: 14,
    floatDuration: 32,
    floatDelay: 2,
    parallaxSpeed: 1.05,
  },
  {
    id: "slot-c",
    verticalPercent: 64,
    sideClass: "-right-[14vw] sm:right-[6%]",
    sizeClass: "w-[46vw] h-[46vw] sm:w-[300px] sm:h-[300px]",
    opacity: 0.26,
    blurClass: "blur-[2px]",
    floatX: 8,
    floatY: -12,
    floatDuration: 22,
    floatDelay: 4,
    parallaxSpeed: 0.7,
  },
  {
    id: "slot-d",
    verticalPercent: 90,
    sideClass: "-left-[13vw] sm:left-[4%]",
    sizeClass: "w-[38vw] h-[38vw] sm:w-[240px] sm:h-[240px]",
    opacity: 0.22,
    blurClass: "blur-[2px]",
    floatX: -7,
    floatY: 11,
    floatDuration: 20,
    floatDelay: 6,
    parallaxSpeed: 0.45,
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

const PLANET_IMAGES: Record<PlanetKey, string> = {
  moon: moonImg,
  mars: marsImg,
  jupiter: jupiterImg,
  saturn: saturnImg,
};

function PlanetVisual({ planet, sizeClass }: { planet: PlanetKey; sizeClass: string }) {
  return (
    <img
      src={PLANET_IMAGES[planet]}
      alt=""
      draggable={false}
      className={`${sizeClass} object-contain select-none`}
    />
  );
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
      className={`absolute ${slot.sideClass}`}
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
