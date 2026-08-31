import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowLeft } from "lucide-react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import HeaderMenuButton from "@/components/HeaderMenuButton";
import ImagePicker from "@/components/ImagePicker";

export default function EditPostPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const postId = parseInt(id || "0", 10);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 수정 페이지에서는 조회수를 증가시키지 않기 위해 직접 API 호출 대신 다른 방식 사용
  const { data: post, isLoading: postLoading } = trpc.posts.get.useQuery(
    { id: postId },
    { enabled: !!postId && !isLoading }
  );

  const updateMutation = trpc.posts.update.useMutation({
    onSuccess: () => {
      toast.success("게시글이 수정되었습니다");
      navigate(`/post/${postId}`);
    },
    onError: (error) => {
      toast.error(error.message || "게시글 수정에 실패했습니다");
    },
  });

  useEffect(() => {
    if (post) {
      setTitle(post.title);
      setContent(post.content);
      setImages(post.images ?? []);
      setIsLoading(false);
    } else if (postLoading) {
      setIsLoading(true);
    }
  }, [post, postLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl mb-4">로그인이 필요합니다</h1>
          <a href="/" className="text-primary hover:underline">
            홈으로 돌아가기
          </a>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl mb-4">게시글을 찾을 수 없습니다</h1>
          <a href="/" className="text-primary hover:underline">
            홈으로 돌아가기
          </a>
        </div>
      </div>
    );
  }

  if (post.userId !== user?.id && user?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl mb-4">수정 권한이 없습니다</h1>
          <a href="/" className="text-primary hover:underline">
            홈으로 돌아가기
          </a>
        </div>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error("제목과 내용을 입력해주세요");
      return;
    }
    updateMutation.mutate({
      id: postId,
      title: title.trim(),
      content: content.trim(),
      images,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6 flex items-center gap-4">
          <a href={`/post/${postId}`} className="accent-text hover:underline">
            <ArrowLeft className="h-5 w-5" />
          </a>
          <HeaderMenuButton />
          <h1 className="text-3xl">게시글 수정</h1>
        </div>

        <Card className="card-elevated p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">제목</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="게시글 제목을 입력하세요"
                disabled={updateMutation.isPending}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">내용</label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="게시글 내용을 입력하세요"
                rows={10}
                disabled={updateMutation.isPending}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">사진 첨부</label>
              <ImagePicker images={images} onChange={setImages} />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                className="flex-1"
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    수정 중...
                  </>
                ) : (
                  "수정하기"
                )}
              </Button>
              <a href={`/post/${postId}`} className="flex-1">
                <Button type="button" variant="outline" className="w-full">
                  취소
                </Button>
              </a>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
