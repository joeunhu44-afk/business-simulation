import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import HeaderMenuButton from "@/components/HeaderMenuButton";
import BackButton from "@/components/BackButton";
import ImagePicker from "@/components/ImagePicker";
import { Checkbox } from "@/components/ui/checkbox";
import { clearDraft, getDraft, saveDraft } from "@/lib/postDraft";

const DRAFT_SAVE_DELAY_MS = 1500;
const STATUS_FADE_START_MS = 2000;
const STATUS_REMOVE_DELAY_MS = 2700;

export default function WritePostPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user, isAuthenticated } = useAuth();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [draftExists, setDraftExists] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusVisible, setStatusVisible] = useState(false);

  // 방금 임시저장에서 복원한 값 — 사용자가 실제로 더 수정하기 전까지는
  // 재저장/"임시저장됨" 알림을 띄우지 않기 위한 스냅샷.
  const restoredSnapshotRef = useRef<{ title: string; content: string; isAnonymous: boolean } | null>(null);
  const skipFirstAutosaveRef = useRef(true);
  const statusHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusRemoveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showStatus = (message: string) => {
    if (statusHideTimerRef.current) clearTimeout(statusHideTimerRef.current);
    if (statusRemoveTimerRef.current) clearTimeout(statusRemoveTimerRef.current);
    setStatusMessage(message);
    setStatusVisible(true);
    statusHideTimerRef.current = setTimeout(() => setStatusVisible(false), STATUS_FADE_START_MS);
    statusRemoveTimerRef.current = setTimeout(() => setStatusMessage(null), STATUS_REMOVE_DELAY_MS);
  };

  // 게시판 진입 시 해당 게시판의 임시저장을 바로 복원 (별도 확인 모달 없음)
  useEffect(() => {
    const draft = getDraft(slug);
    if (draft && (draft.title.trim() || draft.content.trim())) {
      setTitle(draft.title);
      setContent(draft.content);
      setIsAnonymous(draft.isAnonymous);
      setDraftExists(true);
      restoredSnapshotRef.current = { title: draft.title, content: draft.content, isAnonymous: draft.isAnonymous };
      showStatus('이전에 작성하던 내용을 불러왔어요');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // 타이핑을 멈춘 뒤 일정 시간 후 자동 저장(디바운스). 방금 복원한 값 그대로면
  // 건드리지 않는다 — 사용자가 실제로 뭔가 바꿔야 그때부터 저장 대상이 된다.
  useEffect(() => {
    if (skipFirstAutosaveRef.current) {
      skipFirstAutosaveRef.current = false;
      return;
    }
    const snapshot = restoredSnapshotRef.current;
    if (snapshot && snapshot.title === title && snapshot.content === content && snapshot.isAnonymous === isAnonymous) {
      return;
    }
    restoredSnapshotRef.current = null;

    const timer = setTimeout(() => {
      if (!title.trim() && !content.trim()) {
        clearDraft(slug);
        setDraftExists(false);
        return;
      }
      saveDraft(slug, { title, content, isAnonymous });
      setDraftExists(true);
      showStatus('임시저장됨');
    }, DRAFT_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [title, content, isAnonymous, slug]);

  const handleDiscardDraft = () => {
    clearDraft(slug);
    restoredSnapshotRef.current = null;
    setTitle('');
    setContent('');
    setIsAnonymous(false);
    setImages([]);
    setDraftExists(false);
    if (statusHideTimerRef.current) clearTimeout(statusHideTimerRef.current);
    if (statusRemoveTimerRef.current) clearTimeout(statusRemoveTimerRef.current);
    setStatusVisible(false);
    setStatusMessage(null);
  };

  const { data: boards } = trpc.boards.list.useQuery();
  const board = boards?.find((b) => b.slug === slug);

  const createPostMutation = trpc.posts.create.useMutation({
    onSuccess: () => {
      clearDraft(slug);
      toast.success('게시글이 등록되었습니다');
      window.location.href = `/board/${slug}`;
    },
    onError: (error) => {
      toast.error(error.message || '게시글 등록에 실패했습니다');
    },
  });

  const handleSubmit = () => {
    if (!title.trim()) {
      toast.error('제목을 입력해주세요');
      return;
    }
    if (!content.trim()) {
      toast.error('내용을 입력해주세요');
      return;
    }

    if (!board) {
      toast.error('게시판을 찾을 수 없습니다');
      return;
    }

    createPostMutation.mutate({
      boardId: board.id,
      title,
      content,
      isAnonymous,
      images,
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl mb-4">로그인이 필요합니다</h1>
          <a href="/" className="inline-block">
            <Button>홈으로 돌아가기</Button>
          </a>
        </div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl mb-4">게시판을 찾을 수 없습니다</h1>
          <a href="/" className="inline-block">
            <Button>홈으로 돌아가기</Button>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-3 z-40 mx-3 sm:mx-6 lg:mx-auto lg:max-w-6xl rounded-2xl border border-border bg-card/90 backdrop-blur-md shadow-sm">
        <div className="container flex items-center gap-2 py-4">
          <BackButton />
          <HeaderMenuButton />
          <a href="/" className="font-serif text-xl font-bold accent-text hover:opacity-80 transition-opacity">
            커뮤니티
          </a>
        </div>
      </nav>

      <div className="container py-8 max-w-3xl">
        <div>
          <div className="flex items-start justify-between gap-3 mb-8">
            <div>
              <span className="tag-pill mb-3 inline-flex">{board.name}</span>
              <h1 className="text-3xl">새 게시글 작성</h1>
            </div>
            {draftExists && (
              <button
                type="button"
                onClick={handleDiscardDraft}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-1"
              >
                새로 쓰기
              </button>
            )}
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold mb-2">제목</label>
              <Input
                placeholder="게시글 제목을 입력해주세요"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">내용</label>
              <Textarea
                placeholder="게시글 내용을 입력해주세요"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full min-h-64"
              />
              <div className="h-4 mt-1 text-right">
                {statusMessage && (
                  <span
                    className={`text-[11px] text-muted-foreground/70 transition-opacity duration-700 motion-reduce:transition-none ${
                      statusVisible ? 'opacity-100' : 'opacity-0'
                    }`}
                  >
                    {statusMessage}
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">사진 첨부</label>
              <ImagePicker images={images} onChange={setImages} />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="anonymous"
                checked={isAnonymous}
                onCheckedChange={(checked) => setIsAnonymous(checked === true)}
              />
              <label htmlFor="anonymous" className="text-sm cursor-pointer">
                익명으로 작성
              </label>
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                onClick={handleSubmit}
                disabled={createPostMutation.isPending}
                size="lg"
              >
                {createPostMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    등록 중...
                  </>
                ) : (
                  '게시글 등록'
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => window.history.back()}
                size="lg"
              >
                취소
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
