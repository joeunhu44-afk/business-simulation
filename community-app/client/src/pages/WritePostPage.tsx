import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import HeaderMenuButton from "@/components/HeaderMenuButton";
import { toneClass } from "@/lib/tone";
import ImagePicker from "@/components/ImagePicker";

export default function WritePostPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user, isAuthenticated } = useAuth();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [images, setImages] = useState<string[]>([]);

  const { data: boards } = trpc.boards.list.useQuery();
  const board = boards?.find((b) => b.slug === slug);

  const createPostMutation = trpc.posts.create.useMutation({
    onSuccess: () => {
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
          <HeaderMenuButton />
          <a href="/" className="font-serif text-xl font-bold accent-text hover:opacity-80 transition-opacity">
            커뮤니티
          </a>
        </div>
      </nav>

      <div className="container py-8 max-w-3xl">
        <Card className={`card-elevated p-8 ${toneClass(board.id)}`}>
          <span className="tag-pill mb-3 inline-flex">{board.name}</span>
          <h1 className="text-3xl mb-8">새 게시글 작성</h1>

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
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">사진 첨부</label>
              <ImagePicker images={images} onChange={setImages} />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="anonymous"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="rounded border-border"
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
        </Card>
      </div>
    </div>
  );
}
