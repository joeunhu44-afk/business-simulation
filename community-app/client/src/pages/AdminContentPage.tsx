import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Trash2, Search } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";

export default function AdminContentPage() {
  const { user } = useAuth();
  const [postSearch, setPostSearch] = useState("");
  const [commentSearch, setCommentSearch] = useState("");

  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">접근 권한이 없습니다</h1>
          <a href="/admin" className="text-primary hover:underline">
            관리자 패널로 돌아가기
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">게시글 및 댓글 관리</h1>

        <Tabs defaultValue="posts" className="space-y-4">
          <TabsList>
            <TabsTrigger value="posts">게시글</TabsTrigger>
            <TabsTrigger value="comments">댓글</TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600" />
                <Input
                  placeholder="게시글 검색..."
                  value={postSearch}
                  onChange={(e) => setPostSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <PostsList searchQuery={postSearch} />
          </TabsContent>

          <TabsContent value="comments" className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600" />
                <Input
                  placeholder="댓글 검색..."
                  value={commentSearch}
                  onChange={(e) => setCommentSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <CommentsList searchQuery={commentSearch} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function PostsList({ searchQuery }: { searchQuery: string }) {
  const [page, setPage] = useState(0);
  const limit = 20;

  const { data: posts, isLoading } = trpc.posts.listByBoard.useQuery({
    boardId: 0,
    limit,
    offset: page * limit,
    search: searchQuery || undefined,
  });

  const deletePostMutation = trpc.admin.posts.forceDelete.useMutation({
    onSuccess: () => {
      toast.success("게시글이 삭제되었습니다");
    },
    onError: (error) => {
      toast.error(error.message || "게시글 삭제에 실패했습니다");
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!posts || posts.length === 0) {
    return (
      <Card className="card-elevated p-8 text-center">
        <p className="text-gray-600">게시글이 없습니다</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {posts.map((post: any) => (
        <Card key={post.id} className="card-elevated p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold">{post.title}</h3>
              <p className="text-sm text-gray-600 mt-1">
                {post.isAnonymous ? "익명" : "사용자"} • {formatDistanceToNow(new Date(post.createdAt), { locale: ko, addSuffix: true })}
              </p>
              <p className="text-sm text-gray-900 line-clamp-2 mt-2">{post.content}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => deletePostMutation.mutate({ id: post.id })}
              disabled={deletePostMutation.isPending}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

function CommentsList({ searchQuery }: { searchQuery: string }) {
  const [page, setPage] = useState(0);
  const limit = 20;

  // 모든 댓글을 조회하는 API가 없으므로 placeholder 표시
  return (
    <Card className="card-elevated p-8 text-center">
      <p className="text-gray-600">댓글 관리 기능은 준비 중입니다</p>
    </Card>
  );
}
