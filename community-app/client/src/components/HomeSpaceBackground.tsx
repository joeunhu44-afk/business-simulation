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
 *   섞여도 "가까운 슬롯=크고, 콘텐츠 스크롤 속도에 가깝게 따라옴 / 먼 슬롯=작고,
 *   스크롤보다 눈에 띄게 느리게 따라옴" 규칙은 유지된다 (둘 다 콘텐츠보다
 *   느리며, 크기로는 원근감을 표현하지 않는다).
 * - 슬롯 크기는 "가늠하기 어려운 크기" 느낌을 위해 화면 가장자리에서 살짝
 *   잘려나가지만, 각 슬롯의 sideClass 오프셋은 sizeClass 대비 약 15~25%만
 *   잘라내도록 계산되어 있어 항상 60~70% 이상(대부분 75% 이상)이 화면 안에
 *   남는다 — 반달/초승달처럼 대부분이 잘려나가는 일은 없다. 특히 모바일
 *   기준 크기는 뷰포트 너비의 최대 48%로 상한을 둬서, 좁은 화면에서 카드
 *   뒤 비침(투명도)과 은은한 디테일로 존재감을 주는 쪽에 더 무게를 뒀다.
 */

type PlanetKey = "moon" | "mars" | "saturn" | "jupiter";

interface SlotConfig {
  id: string;
  verticalPercent: number; // 페이지 전체 스크롤 높이 기준 % (최소 간격 로직은 HomeSpaceBackground 참고)
  // 좌/우 여백 배치: 휴대폰(기본)/sm:(태블릿~노트북)/2xl:(큰 데스크톱) 각각
  // sizeClass 대비 약 15~25%만 화면 밖으로 걸치도록 계산된 음수 오프셋.
  sideClass: string;
  // 전체 바운딩 박스 크기(토성은 고리 포함). 모바일은 뷰포트 너비의 최대
  // 48%로 상한(가시성 확보), sm:(640px~) ~ 2xl: 직전(1536px 미만)까지는
  // 화면의 40%대, 2xl:(1536px~, 큰 데스크톱 모니터)에서는 고정 픽셀 캡.
  sizeClass: string;
  opacity: number;
  blurClass: string;
  floatX: number;
  floatY: number;
  floatDuration: number;
  floatDelay: number;
  // 실제 스크롤 픽셀량 대비 행성이 이동하는 비율 (0~1). 콘텐츠는 스크롤과
  // 1:1로 움직이므로, 이 값은 항상 1보다 작아야 행성이 "콘텐츠보다 뒤에서
  // 느리게 따라오는" 원근감을 준다 — 크고 가까운 슬롯은 1에 가깝게(0.7~0.8),
  // 작고 먼 슬롯은 0에 가깝게(0.4~0.5) 잡는다. 크기(scale)는 절대 건드리지
  // 않고 오직 이 속도 차이만으로 원근감을 표현한다.
  parallaxSpeed: number;
  /** 이 슬롯 하나에만 아주 옅은 비대칭 디테일(눈동자 같은 은은한 glow + 살짝 기울어진 각도)을 준다. */
  eerie?: boolean;
}

const MIN_GAP_VH_RATIO = 1.15; // 슬롯 사이 최소 간격 = 뷰포트 높이의 이 배수

// 슬롯이 많을수록(=세로 간격이 촘촘할수록) 스크롤할 때 행성이 더 자주 등장한다.
const SLOTS: SlotConfig[] = [
  {
    id: "slot-a",
    verticalPercent: 3,
    sideClass: "-right-[12vw] sm:-right-[7vw] 2xl:-right-[84px]",
    sizeClass: "w-[48vw] h-[48vw] sm:w-[46vw] sm:h-[46vw] 2xl:w-[560px] 2xl:h-[560px]",
    opacity: 0.5,
    blurClass: "blur-[3px]",
    floatX: 14,
    floatY: 21,
    floatDuration: 21,
    floatDelay: 0,
    parallaxSpeed: 0.78,
  },
  {
    id: "slot-b",
    verticalPercent: 19,
    sideClass: "-left-[11vw] sm:-left-[6vw] 2xl:-left-[72px]",
    sizeClass: "w-[44vw] h-[44vw] sm:w-[42vw] sm:h-[42vw] 2xl:w-[480px] 2xl:h-[480px]",
    opacity: 0.44,
    blurClass: "blur-[3px]",
    floatX: -12,
    floatY: 16,
    floatDuration: 24,
    floatDelay: 2,
    parallaxSpeed: 0.7,
  },
  {
    id: "slot-c",
    verticalPercent: 35,
    sideClass: "-right-[10vw] sm:-right-[6vw] 2xl:-right-[62px]",
    sizeClass: "w-[40vw] h-[40vw] sm:w-[38vw] sm:h-[38vw] 2xl:w-[410px] 2xl:h-[410px]",
    opacity: 0.4,
    blurClass: "blur-[2px]",
    floatX: 11,
    floatY: -13,
    floatDuration: 19,
    floatDelay: 4,
    parallaxSpeed: 0.62,
    eerie: true,
  },
  {
    id: "slot-d",
    verticalPercent: 53,
    sideClass: "-left-[9vw] sm:-left-[5vw] 2xl:-left-[51px]",
    sizeClass: "w-[36vw] h-[36vw] sm:w-[34vw] sm:h-[34vw] 2xl:w-[340px] 2xl:h-[340px]",
    opacity: 0.36,
    blurClass: "blur-[2px]",
    floatX: -9,
    floatY: 12,
    floatDuration: 22,
    floatDelay: 6,
    parallaxSpeed: 0.54,
  },
  {
    id: "slot-e",
    verticalPercent: 71,
    sideClass: "-right-[8vw] sm:-right-[5vw] 2xl:-right-[41px]",
    sizeClass: "w-[32vw] h-[32vw] sm:w-[30vw] sm:h-[30vw] 2xl:w-[270px] 2xl:h-[270px]",
    opacity: 0.32,
    blurClass: "blur-[2px]",
    floatX: 7,
    floatY: -9,
    floatDuration: 16,
    floatDelay: 8,
    parallaxSpeed: 0.46,
  },
  {
    id: "slot-f",
    verticalPercent: 88,
    sideClass: "-left-[7vw] sm:-left-[4vw] 2xl:-left-[32px]",
    sizeClass: "w-[28vw] h-[28vw] sm:w-[26vw] sm:h-[26vw] 2xl:w-[210px] 2xl:h-[210px]",
    opacity: 0.28,
    blurClass: "blur-[2px]",
    floatX: -6,
    floatY: 8,
    floatDuration: 15,
    floatDelay: 10,
    parallaxSpeed: 0.4,
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

function PlanetVisual({
  planet,
  sizeClass,
  eerie,
  reducedMotion,
}: {
  planet: PlanetKey;
  sizeClass: string;
  eerie?: boolean;
  reducedMotion: boolean;
}) {
  return (
    <div className={`relative ${sizeClass} ${eerie ? "rotate-[7deg]" : ""}`}>
      <img
        src={PLANET_IMAGES[planet]}
        alt=""
        draggable={false}
        className="h-full w-full object-contain select-none"
      />
      {eerie && (
        <motion.div
          className="pointer-events-none absolute rounded-full"
          style={{
            top: "44%",
            left: "51%",
            width: "13%",
            height: "13%",
            background:
              "radial-gradient(circle at 34% 34%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.15) 11%, transparent 13%), " +
              "radial-gradient(circle, rgba(12,12,16,0.55) 0%, rgba(12,12,16,0.28) 48%, transparent 72%)",
          }}
          animate={reducedMotion ? undefined : { opacity: [0.55, 0.9, 0.55] }}
          transition={
            reducedMotion ? undefined : { duration: 9, repeat: Infinity, ease: "easeInOut" }
          }
        />
      )}
    </div>
  );
}

function PlanetLayer({
  slot,
  planet,
  topPx,
  scrollY,
  reducedMotion,
}: {
  slot: SlotConfig;
  planet: PlanetKey;
  topPx: number;
  scrollY: MotionValue<number>;
  reducedMotion: boolean;
}) {
  // 이 레이어는 문서 좌표(topPx)에 절대 배치되어 있어서, 아무 보정도 없으면
  // 스크롤한 만큼(1:1) 화면 위로 움직여 콘텐츠와 완전히 같은 속도로 보인다.
  // 여기서 스크롤량(scrollY, px)의 (1 - parallaxSpeed)만큼을 반대 방향으로
  // 되돌려주면, 실제 화면 이동량은 "-scrollY + scrollY*(1-parallaxSpeed)
  // = -scrollY*parallaxSpeed"가 되어 콘텐츠보다 항상 parallaxSpeed 배만큼
  // 느리게(0~1배) 따라오게 된다. 문서 길이와 무관하게 스크롤 픽셀량에
  // 직접 비례하므로, 페이지가 길든 짧든 체감 속도가 일정하다.
  const rawExtraY = useTransform(scrollY, (v) => v * (1 - slot.parallaxSpeed));

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
        <PlanetVisual planet={planet} sizeClass={slot.sizeClass} eerie={slot.eerie} reducedMotion={reducedMotion} />
      </motion.div>
    </motion.div>
  );
}

export default function HomeSpaceBackground() {
  // 실제 스크롤 픽셀량(px) — 패럴랙스 속도를 문서 길이와 무관하게 일정한
  // 비율로 유지하려면 0~1 정규화된 progress가 아니라 raw px 값이 필요하다.
  const { scrollY } = useScroll();
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
    <>
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
              scrollY={scrollY}
              reducedMotion={reducedMotion}
            />
          );
        })}
      </div>
      {/* 화면 가장자리를 아주 옅게 어둡게 해 은은한 긴장감을 준다. 뷰포트에
          고정되어 스크롤과 무관하게 항상 같은 위치(가장자리)에 걸린다.
          중심부는 완전히 투명해 가독성/밝기에는 거의 영향이 없다. */}
      <div
        className="fixed inset-0 -z-[4] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 58%, rgba(12,14,26,0.05) 88%, rgba(12,14,26,0.09) 100%)",
        }}
        aria-hidden="true"
      />
    </>
  );
}
