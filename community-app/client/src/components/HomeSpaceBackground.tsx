import { useEffect, useState } from "react";
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
 * - 위치("슬롯")는 페이지 전체 스크롤 높이에 대한 %를 기본으로 하되, 실제 픽셀
 *   간격이 "뷰포트 높이 * MIN_GAP_VH_RATIO"보다 좁아지면 그 최소 간격을 강제한다.
 *   글이 적어 페이지가 짧을 때 %만 쓰면 슬롯 간 픽셀 거리가 좁아져 여러 행성이
 *   한 화면에 우르르 몰려 보이는 문제가 있었는데, 이 최소 간격 덕분에 짧은
 *   페이지에서는 뒤쪽 슬롯 몇 개가 아예 안 보이더라도(문서 끝을 넘어가 잘림)
 *   보이는 것들끼리는 항상 한 번에 하나씩만 들어오고, 글이 늘어나 페이지가
 *   길어지면 %가 최소 간격을 자연히 앞질러서 더 많은 슬롯이 드러난다.
 * - 어떤 슬롯에 어떤 행성(달/화성/토성/목성)이 들어갈지는 마운트(새로고침) 시
 *   한 번만 무작위로 섞인다 — SLOTS는 항상 위→아래 순서로 정의돼 있고 섞인
 *   결과를 그 순서 그대로 배정하므로, 스크롤을 내리며 만나는 행성의 순서
 *   자체가 새로고침마다 랜덤해진다. 슬롯 자체의 크기/속도/불투명도는 고정이라
 *   섞여도 "가까운 슬롯=크고 빠름, 먼 슬롯=작고 느림" 규칙은 유지된다.
 */

type PlanetKey = "moon" | "mars" | "saturn" | "jupiter";

interface SlotConfig {
  id: string;
  verticalPercent: number; // 페이지 전체 스크롤 높이 기준 % (최소 간격 로직은 HomeSpaceBackground 참고)
  // 좌/우 여백 배치: 휴대폰(기본) 살짝 걸치기, sm:(태블릿~노트북)/2xl:(큰 데스크톱)는 그 크기에 맞춘 여백
  sideClass: string;
  // 전체 바운딩 박스 크기(토성은 고리 포함): 휴대폰은 화면을 거의 채우고,
  // sm:(640px~) ~ 2xl: 직전(1536px 미만)까지는 화면의 절반 — 실제 태블릿은
  // CSS 너비가 1024~1366px까지도 흔해서 이 구간을 넓게 잡아야 "절반"으로 보인다.
  // 2xl:(1536px~, 큰 데스크톱 모니터)에서만 고정 픽셀로 캡을 씌운다.
  sizeClass: string;
  opacity: number;
  blurClass: string;
  floatX: number;
  floatY: number;
  floatDuration: number;
  floatDelay: number;
  parallaxSpeed: number; // 1보다 크면 더 빠르게(가까운 느낌), 작으면 더 느리게(먼 느낌)
}

const BASE_DRIFT = 80; // px — 슬롯의 parallaxSpeed가 이 기준값에 곱해져 스크롤 추가 이동량을 만든다
const MIN_GAP_VH_RATIO = 1.15; // 슬롯 사이 최소 간격 = 뷰포트 높이의 이 배수

// 슬롯이 많을수록(=세로 간격이 촘촘할수록) 스크롤할 때 행성이 더 자주 등장한다.
const SLOTS: SlotConfig[] = [
  {
    id: "slot-a",
    verticalPercent: 3,
    sideClass: "-right-[24vw] sm:right-[1%] 2xl:right-[2%]",
    sizeClass: "w-[92vw] h-[92vw] sm:w-[50vw] sm:h-[50vw] 2xl:w-[460px] 2xl:h-[460px]",
    opacity: 0.48,
    blurClass: "blur-[3px]",
    floatX: 12,
    floatY: 18,
    floatDuration: 26,
    floatDelay: 0,
    parallaxSpeed: 1.6,
  },
  {
    id: "slot-b",
    verticalPercent: 19,
    sideClass: "-left-[20vw] sm:-left-[6%] 2xl:-left-[4%]",
    sizeClass: "w-[80vw] h-[80vw] sm:w-[44vw] sm:h-[44vw] 2xl:w-[400px] 2xl:h-[400px]",
    opacity: 0.42,
    blurClass: "blur-[3px]",
    floatX: -10,
    floatY: 14,
    floatDuration: 30,
    floatDelay: 2,
    parallaxSpeed: 1.25,
  },
  {
    id: "slot-c",
    verticalPercent: 35,
    sideClass: "-right-[17vw] sm:right-[4%] 2xl:right-[6%]",
    sizeClass: "w-[70vw] h-[70vw] sm:w-[38vw] sm:h-[38vw] 2xl:w-[340px] 2xl:h-[340px]",
    opacity: 0.38,
    blurClass: "blur-[2px]",
    floatX: 9,
    floatY: -11,
    floatDuration: 24,
    floatDelay: 4,
    parallaxSpeed: 0.95,
  },
  {
    id: "slot-d",
    verticalPercent: 53,
    sideClass: "-left-[14vw] sm:left-[2%] 2xl:left-[4%]",
    sizeClass: "w-[60vw] h-[60vw] sm:w-[33vw] sm:h-[33vw] 2xl:w-[280px] 2xl:h-[280px]",
    opacity: 0.34,
    blurClass: "blur-[2px]",
    floatX: -8,
    floatY: 10,
    floatDuration: 28,
    floatDelay: 6,
    parallaxSpeed: 0.7,
  },
  {
    id: "slot-e",
    verticalPercent: 71,
    sideClass: "-right-[11vw] sm:right-[8%] 2xl:right-[10%]",
    sizeClass: "w-[50vw] h-[50vw] sm:w-[28vw] sm:h-[28vw] 2xl:w-[220px] 2xl:h-[220px]",
    opacity: 0.3,
    blurClass: "blur-[2px]",
    floatX: 6,
    floatY: -8,
    floatDuration: 20,
    floatDelay: 8,
    parallaxSpeed: 0.5,
  },
  {
    id: "slot-f",
    verticalPercent: 88,
    sideClass: "-left-[9vw] sm:left-[6%] 2xl:left-[8%]",
    sizeClass: "w-[42vw] h-[42vw] sm:w-[22vw] sm:h-[22vw] 2xl:w-[170px] 2xl:h-[170px]",
    opacity: 0.26,
    blurClass: "blur-[2px]",
    floatX: -5,
    floatY: 7,
    floatDuration: 18,
    floatDelay: 10,
    parallaxSpeed: 0.35,
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
  topPx,
  scrollYProgress,
  reducedMotion,
}: {
  slot: SlotConfig;
  planet: PlanetKey;
  topPx: number;
  scrollYProgress: MotionValue<number>;
  reducedMotion: boolean;
}) {
  // 스크롤 진행률에 따라 슬롯마다 다른 양만큼 더 얹어서 서로 다른 속도로 보이게 한다.
  const rawExtraY = useTransform(scrollYProgress, [0, 1], [0, -(slot.parallaxSpeed - 1) * BASE_DRIFT]);

  return (
    <motion.div
      className={`absolute ${slot.sideClass}`}
      style={{ top: `${topPx}px`, y: reducedMotion ? 0 : rawExtraY }}
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

  // 문서 높이 / 뷰포트 높이를 추적해서, 콘텐츠가 적어 페이지가 짧을 때도 슬롯끼리
  // 최소 간격을 유지하도록 한다 (아래 topPx 계산 참고).
  const [docHeight, setDocHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  useEffect(() => {
    const updateViewport = () => setViewportHeight(window.innerHeight);
    updateViewport();
    window.addEventListener("resize", updateViewport);

    const updateDocHeight = () => setDocHeight(document.documentElement.scrollHeight);
    updateDocHeight();
    const resizeObserver = new ResizeObserver(updateDocHeight);
    resizeObserver.observe(document.documentElement);

    return () => {
      window.removeEventListener("resize", updateViewport);
      resizeObserver.disconnect();
    };
  }, []);

  const minGapPx = viewportHeight * MIN_GAP_VH_RATIO;

  return (
    <div className="absolute inset-0 -z-[5] overflow-hidden pointer-events-none" aria-hidden="true">
      {SLOTS.map((slot, i) => {
        // 문서 전체 높이 기준 %와, 뷰포트 기준 최소 간격 중 더 아래쪽 값을 쓴다 —
        // 페이지가 길면 %가 이기고, 짧으면 최소 간격이 이겨서 서로 겹치지 않는다.
        const percentPx = (slot.verticalPercent / 100) * docHeight;
        const topPx = Math.max(percentPx, i * minGapPx);
        return (
          <PlanetLayer
            key={slot.id}
            slot={slot}
            planet={planetOrder[i % planetOrder.length]}
            topPx={topPx}
            scrollYProgress={scrollYProgress}
            reducedMotion={reducedMotion}
          />
        );
      })}
    </div>
  );
}
