// 게시글 작성 중 임시저장 — 게시판(slug)별로 로컬 스토리지에만 저장된다
// (서버 전송 없음, 기기별로만 동작). 새 글쓰기 페이지에서만 쓰인다.

export type PostDraft = {
  title: string;
  content: string;
  isAnonymous: boolean;
  savedAt: number;
};

function draftKey(slug: string): string {
  return `draft:${slug}`;
}

export function getDraft(slug: string): PostDraft | null {
  const raw = localStorage.getItem(draftKey(slug));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PostDraft;
  } catch {
    return null;
  }
}

export function saveDraft(slug: string, draft: Omit<PostDraft, "savedAt">): void {
  localStorage.setItem(draftKey(slug), JSON.stringify({ ...draft, savedAt: Date.now() }));
}

export function clearDraft(slug: string): void {
  localStorage.removeItem(draftKey(slug));
}

export function hasDraft(slug: string): boolean {
  return getDraft(slug) !== null;
}
