import HeaderMenuButton from "@/components/HeaderMenuButton";
import BackButton from "@/components/BackButton";
import type { ReactNode } from "react";

export type LegalSection = {
  /** 목차 링크에 쓰는 앵커 id */
  id: string;
  title: string;
  body: ReactNode;
};

/**
 * 이용약관·개인정보처리방침 공통 레이아웃.
 *
 * 긴 글이라 본문 폭을 65~75자 수준으로 제한하고(max-w-2xl), 줄간격을 넉넉히 준다.
 * 상단에는 앵커 목차를 둬서 모바일에서도 원하는 조항으로 바로 갈 수 있게 했다.
 */
export default function LegalPage({
  title,
  effectiveDate,
  version,
  intro,
  sections,
}: {
  title: string;
  effectiveDate: string;
  version: string;
  intro?: ReactNode;
  sections: LegalSection[];
}) {
  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-3 z-40 mx-3 sm:mx-6 lg:mx-auto lg:max-w-4xl rounded-2xl border border-border bg-card/90 backdrop-blur-md shadow-sm">
        <div className="container flex items-center gap-2 py-4">
          <BackButton />
          <HeaderMenuButton />
          <a href="/" className="font-serif text-xl font-bold accent-text hover:opacity-80 transition-opacity">
            커뮤니티
          </a>
        </div>
      </nav>

      <div className="container max-w-2xl py-8">
        <header className="mb-8">
          <h1 className="section-heading text-2xl sm:text-3xl">{title}</h1>
          <p className="mt-3 text-[13px]" style={{ color: "var(--text-muted)" }}>
            시행일 {effectiveDate} · 버전 {version}
          </p>
          {intro && (
            <div className="mt-4 text-[15px] leading-7" style={{ color: "var(--text-normal)" }}>
              {intro}
            </div>
          )}
        </header>

        {/* 목차 — 조항이 많아 스크롤로만 찾기 어렵다 */}
        <nav
          aria-label="목차"
          className="mb-10 rounded-xl px-4 py-4"
          style={{ backgroundColor: "var(--bg-surface-2)" }}
        >
          <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            목차
          </h2>
          <ol className="space-y-1">
            {sections.map((section, index) => (
              <li key={section.id} className="flex gap-2 text-[14px] leading-6">
                <span className="shrink-0 tabular-nums" style={{ color: "var(--text-muted)" }}>
                  {index + 1}.
                </span>
                <a href={`#${section.id}`} className="hover:underline" style={{ color: "var(--text-normal)" }}>
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="space-y-10">
          {sections.map((section, index) => (
            <section key={section.id} id={section.id} className="scroll-mt-24">
              <h2 className="mb-3 font-sans text-[17px] font-bold leading-7" style={{ color: "var(--text-strong)" }}>
                제{index + 1}조 · {section.title}
              </h2>
              <div
                className="space-y-3 text-[15px] leading-7 [&_li]:leading-7 [&_ul]:space-y-1.5 [&_ol]:space-y-1.5"
                style={{ color: "var(--text-normal)" }}
              >
                {section.body}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

/** 문서 안에서 되풀이되는 불릿 목록 */
export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

/**
 * 운영자가 채워야 하는 빈칸. 화면에는 대괄호 표기로 그대로 보여서,
 * 배포 전에 채우지 않으면 눈에 띄도록 한다.
 */
export function Blank({ children }: { children: ReactNode }) {
  return (
    <mark
      className="rounded px-1 py-0.5 text-[14px] font-semibold"
      style={{ backgroundColor: "var(--accent-soft)", color: "var(--text-strong)" }}
    >
      [{children}]
    </mark>
  );
}

/** 표 형태가 읽기 쉬운 항목(수집 항목·보관기간 등)에 쓰는 단순 표 */
export function SimpleTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[14px]">
        <thead>
          <tr>
            {head.map((h) => (
              <th
                key={h}
                className="border-b px-2 py-2 text-left font-semibold whitespace-nowrap"
                style={{ borderColor: "var(--border-color)", color: "var(--text-strong)" }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  className="border-b px-2 py-2 align-top leading-6"
                  style={{ borderColor: "var(--border-color)", color: "var(--text-normal)" }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
