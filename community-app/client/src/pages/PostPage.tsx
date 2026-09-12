import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ThumbsUp, Trash2, Edit2, Reply, ArrowLeft, MessageCircle, X, ImageOff } from "lucide-react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { toast } from "sonner";
import { ReportDialog } from "@/components/ReportDialog";
import HeaderMenuButton from "@/components/HeaderMenuButton";
import Avatar from "@/components/Avatar";
import EmptyState from "@/components/EmptyState";

export default function PostPage() {
  const { id } = useParams<{ id: string }>();
  const postId = parseInt(id || '0');
  const { user, isAuthenticated } = useAuth();
  const [commentContent, setCommentContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  /** 크게 보고 있는 첨부 이미지 index. null이면 닫힘. */
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: post, isLoading: postLoading } = trpc.posts.get.useQuery({ id: postId });
  const { data: comments, refetch: refetchComments } = trpc.comments.listByPost.useQuery({ postId });
  const { data: isLiked } = trpc.likes.isPostLiked.useQuery({ postId }, { enabled: isAuthenticated });
  const { data: boards } = trpc.boards.list.useQuery();
  const board = boards?.find((b) => b.id === post?.boardId);

  const createCommentMutation = trpc.comments.create.useMutation({
    onSuccess: () => {
      setCommentContent('');
      setReplyingTo(null);
      refetchComments();
      utils.posts.get.invalidate({ id: postId });
      toast.success('댓글이 등록되었습니다');
    },
    onError: (error) => {
      toast.error(error.message || '댓글 등록에 실패했습니다');
    },
  });

  const toggleLikeMutation = trpc.likes.togglePostLike.useMutation({
    // 옵티미스틱 업데이트: 추천 수와 버튼 상태를 즉시 반영
    onMutate: async () => {
      await utils.posts.get.cancel({ id: postId });
      await utils.likes.isPostLiked.cancel({ postId });
      const prevPost = utils.posts.get.getData({ id: postId });
      const prevLiked = utils.likes.isPostLiked.getData({ postId });

      utils.likes.isPostLiked.setData({ postId }, !prevLiked);
      if (prevPost) {
        utils.posts.get.setData(
          { id: postId },
          { ...prevPost, likeCount: prevPost.likeCount + (prevLiked ? -1 : 1) },
        );
      }
      return { prevPost, prevLiked };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevPost) utils.posts.get.setData({ id: postId }, ctx.prevPost);
      if (ctx?.prevLiked !== undefined) utils.likes.isPostLiked.setData({ postId }, ctx.prevLiked);
      toast.error('추천 처리에 실패했습니다');
    },
    onSettled: () => {
      utils.posts.get.invalidate({ id: postId });
      utils.likes.isPostLiked.invalidate({ postId });
    },
  });

  const deletePostMutation = trpc.posts.delete.useMutation({
    onSuccess: () => {
      toast.success('게시글이 삭제되었습니다');
      window.location.href = '/';
    },
    onError: (error) => {
      toast.error(error.message || '삭제에 실패했습니다');
    },
  });

  const handleSubmitComment = () => {
    if (!commentContent.trim()) {
      toast.error('댓글을 입력해주세요');
      return;
    }

    createCommentMutation.mutate({
      postId,
      content: commentContent,
      isAnonymous,
      parentCommentId: replyingTo || undefined,
    });
  };

  const goBack = () => {
    if (window.history.length > 1) window.history.back();
    else window.location.href = '/';
  };

  if (postLoading) {
    return (
      <div className="cosmic-empty flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl mb-4">게시글을 찾을 수 없습니다</h1>
          <a href="/" className="accent-text hover:underline">홈으로 돌아가기</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-3 z-40 mx-3 sm:mx-6 lg:mx-auto lg:max-w-6xl rounded-2xl border border-border bg-card/90 backdrop-blur-md shadow-sm">
        <div className="container flex items-center gap-2 py-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={goBack}
            aria-label="뒤로가기"
            className="rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <HeaderMenuButton />
          <a href="/" className="font-serif text-xl font-bold accent-text hover:opacity-80 transition-opacity">
            커뮤니티
          </a>
        </div>
      </nav>

      <div className="container py-8 max-w-3xl">
        {/* Post */}
        {/* 목록을 카드에서 리스트로 바꾼 방향에 맞춰 본문도 카드를 걷어낸다.
            모바일에서 카드 테두리·안쪽 여백이 폭을 좁히기만 했다. */}
        <div className="mb-8 pb-6 border-b border-border">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 min-w-0">
              {board && (
                <a href={`/board/${board.slug}`} className="tag-pill mb-3 inline-flex">
                  {board.name}
                </a>
              )}
              <h1 className="text-3xl mb-4">{post.title}</h1>
              {/* 390px에서 "약 3시간 전"이 "약 3시 / 간 전"으로 쪼개지던 문제 때문에
                  각 조각에 whitespace-nowrap을 주고, 줄바꿈은 조각 사이에서만 일어나게 한다. */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                <Avatar
                  userId={post.userId}
                  isAnonymous={post.isAnonymous}
                  name={post.authorName}
                  avatarEmoji={post.authorAvatarEmoji}
                  avatarImageUrl={post.authorAvatarImageUrl}
                  size="h-6 w-6"
                  textSize="text-xs"
                />
                <span className="whitespace-nowrap">{post.isAnonymous ? '익명' : post.authorName || '사용자'}</span>
                <span aria-hidden="true">·</span>
                <span className="whitespace-nowrap">
                  {formatDistanceToNow(new Date(post.createdAt), { locale: ko, addSuffix: true })}
                </span>

              </div>
            </div>
            {isAuthenticated && post.isMine && (
              <div className="flex gap-2">
                <a href={`/post/${post.id}/edit`}>
                  <Button variant="ghost" size="sm">
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </a>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deletePostMutation.mutate({ id: postId })}
                  disabled={deletePostMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="divider-elegant my-4" />

          <div className="prose prose-sm max-w-none mb-6">
            <p className="text-foreground whitespace-pre-wrap">{post.content}</p>
          </div>

          {post.images && post.images.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2 mb-8">
              {post.images.map((url, index) => (
                // 새 탭으로 원본을 열면 돌아왔을 때 스크롤 위치를 잃는다. 같은 화면에서 크게 본다.
                <PostImage
                  key={url}
                  url={url}
                  index={index}
                  onOpen={() => setLightboxIndex(index)}
                />
              ))}
            </div>
          )}

          <div className="flex items-center gap-3 pt-6 border-t border-border">
            {isAuthenticated ? (
              <>
                <Button
                  variant={isLiked ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleLikeMutation.mutate({ postId })}
                  disabled={toggleLikeMutation.isPending}
                >
                  <ThumbsUp className="h-4 w-4 mr-2" />
                  추천 {post.likeCount}
                </Button>
                <ReportDialog targetType="post" targetId={postId} />
              </>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ThumbsUp className="h-4 w-4" />
                추천 {post.likeCount}
              </div>
            )}
            {/* 조회수는 추천·신고와 같은 줄 오른쪽 끝에. 상단 메타에 두면 모바일에서
                줄이 넘어가 "· 조회 210"이 다음 줄 맨 앞에 홀로 떨어진다. */}
            <span className="ml-auto whitespace-nowrap text-[13px] text-muted-foreground">
              조회 {post.viewCount}
            </span>
          </div>
        </div>

        {/* Comments Section */}
        <div className="space-y-6">
          <h2 className="section-heading text-2xl">댓글 {post.commentCount}</h2>

          {/* Comment Form */}
          {isAuthenticated && (
            <Card className="card-elevated p-6">
              <div className="space-y-4">
                {replyingTo && (
                  <div className="flex items-center justify-between text-sm text-muted-foreground bg-black/5 rounded-lg px-3 py-2">
                    <span>답글 작성 중...</span>
                    <button onClick={() => setReplyingTo(null)} className="underline">취소</button>
                  </div>
                )}
                <Textarea
                  placeholder="댓글을 입력해주세요..."
                  value={commentContent}
                  onChange={(e) => setCommentContent(e.target.value)}
                  className="min-h-24"
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={isAnonymous}
                      onCheckedChange={(checked) => setIsAnonymous(checked === true)}
                    />
                    <span className="text-sm text-muted-foreground">익명으로 작성</span>
                  </label>
                  <Button
                    onClick={handleSubmitComment}
                    disabled={createCommentMutation.isPending || !commentContent.trim()}
                  >
                    {createCommentMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        등록 중...
                      </>
                    ) : (
                      '댓글 등록'
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Comments List */}
          <div className="space-y-4">
            {comments && comments.length > 0 ? (
              comments
                .filter((c) => !c.parentCommentId)
                .map((comment) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    replies={comments.filter((c) => c.parentCommentId === comment.id)}
                    onReply={() => setReplyingTo(comment.id)}
                    isAuthenticated={isAuthenticated}
                    postId={postId}
                  />
                ))
            ) : (
              <Card className="card-elevated p-4">
                <EmptyState
                  icon={MessageCircle}
                  title="아직 댓글이 없어요"
                  description="첫 번째 댓글을 남겨보세요"
                />
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* 첨부 이미지 크게 보기. 배경이나 닫기를 누르면 닫히고, Esc로도 닫힌다. */}
      {lightboxIndex !== null && post.images?.[lightboxIndex] && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="첨부 이미지 크게 보기"
          tabIndex={-1}
          ref={(el) => el?.focus()}
          onClick={() => setLightboxIndex(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setLightboxIndex(null);
          }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4"
        >
          <button
            type="button"
            aria-label="닫기"
            onClick={() => setLightboxIndex(null)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={post.images[lightboxIndex]}
            alt={`첨부 이미지 ${lightboxIndex + 1}`}
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        </div>
      )}
    </div>
  );
}

/**
 * 첨부 이미지 한 장.
 *
 * 파일이 사라졌거나(과거에 임시 디스크에 저장된 사진) 권한이 없어 못 불러오는 경우,
 * 브라우저 기본 깨진 이미지 아이콘 대신 이유를 적어 보여준다.
 */
function PostImage({ url, index, onOpen }: { url: string; index: number; onOpen: () => void }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border aspect-square p-3 text-center"
        style={{ backgroundColor: 'var(--bg-surface-2)' }}
      >
        <ImageOff className="h-5 w-5" style={{ color: 'var(--text-muted)' }} />
        <span className="text-[12px] leading-tight" style={{ color: 'var(--text-muted)' }}>
          이미지를 불러올 수 없어요
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`첨부 이미지 ${index + 1} 크게 보기`}
      className="block rounded-xl overflow-hidden border border-border aspect-square shadow-sm hover:shadow-md transition-shadow"
    >
      <img
        src={url}
        alt={`첨부 이미지 ${index + 1}`}
        className="h-full w-full object-cover"
        onError={() => setFailed(true)}
      />
    </button>
  );
}

function CommentItem({
  comment,
  replies,
  onReply,
  isAuthenticated,
  postId,
}: {
  comment: any;
  replies: any[];
  onReply: () => void;
  isAuthenticated: boolean;
  postId: number;
}) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [likeCount, setLikeCount] = useState<number>(comment.likeCount);

  const { data: isCommentLiked } = trpc.likes.isCommentLiked.useQuery(
    { commentId: comment.id },
    { enabled: isAuthenticated },
  );

  const toggleCommentLike = trpc.likes.toggleCommentLike.useMutation({
    onMutate: async () => {
      await utils.likes.isCommentLiked.cancel({ commentId: comment.id });
      const prevLiked = utils.likes.isCommentLiked.getData({ commentId: comment.id });
      utils.likes.isCommentLiked.setData({ commentId: comment.id }, !prevLiked);
      setLikeCount((c) => c + (prevLiked ? -1 : 1));
      return { prevLiked };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevLiked !== undefined) {
        utils.likes.isCommentLiked.setData({ commentId: comment.id }, ctx.prevLiked);
        setLikeCount((c) => c + (ctx.prevLiked ? 1 : -1));
      }
      toast.error('추천 처리에 실패했습니다');
    },
    onSettled: () => {
      utils.likes.isCommentLiked.invalidate({ commentId: comment.id });
      utils.comments.listByPost.invalidate({ postId });
    },
  });

  const deleteCommentMutation = trpc.comments.delete.useMutation({
    onSuccess: () => {
      utils.comments.listByPost.invalidate({ postId });
      utils.posts.get.invalidate({ id: postId });
    },
  });

  return (
    <div className="space-y-3">
      <Card className="card-elevated p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <Avatar
              userId={comment.userId}
              isAnonymous={comment.isAnonymous}
              name={comment.authorName}
              avatarEmoji={comment.authorAvatarEmoji}
              avatarImageUrl={comment.authorAvatarImageUrl}
              size="h-7 w-7"
              textSize="text-sm"
            />
            <div>
              <p className="text-sm font-semibold">{comment.isAnonymous ? '익명' : comment.authorName || '사용자'}</p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(comment.createdAt), { locale: ko, addSuffix: true })}
              </p>
            </div>
          </div>
          {isAuthenticated && comment.isMine && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => deleteCommentMutation.mutate({ id: comment.id })}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="text-sm text-foreground mb-3 whitespace-pre-wrap">{comment.content}</p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onReply}>
            <Reply className="h-4 w-4 mr-1" />
            답글
          </Button>
          {isAuthenticated ? (
            <Button
              variant={isCommentLiked ? 'default' : 'ghost'}
              size="sm"
              onClick={() => toggleCommentLike.mutate({ commentId: comment.id })}
              disabled={toggleCommentLike.isPending}
            >
              <ThumbsUp className="h-4 w-4 mr-1" />
              {likeCount}
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground inline-flex items-center px-2">
              <ThumbsUp className="h-3 w-3 inline mr-1" />
              {likeCount}
            </span>
          )}
          {isAuthenticated && (
            <ReportDialog targetType="comment" targetId={comment.id} />
          )}
        </div>
      </Card>

      {/* Replies */}
      {replies.length > 0 && (
        <div className="ml-6 space-y-3">
          {replies.map((reply) => (
            <ReplyItem key={reply.id} reply={reply} isAuthenticated={isAuthenticated} postId={postId} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReplyItem({
  reply,
  isAuthenticated,
  postId,
}: {
  reply: any;
  isAuthenticated: boolean;
  postId: number;
}) {
  const utils = trpc.useUtils();
  const [likeCount, setLikeCount] = useState<number>(reply.likeCount);

  const { data: isReplyLiked } = trpc.likes.isCommentLiked.useQuery(
    { commentId: reply.id },
    { enabled: isAuthenticated },
  );

  const toggleReplyLike = trpc.likes.toggleCommentLike.useMutation({
    onMutate: async () => {
      await utils.likes.isCommentLiked.cancel({ commentId: reply.id });
      const prevLiked = utils.likes.isCommentLiked.getData({ commentId: reply.id });
      utils.likes.isCommentLiked.setData({ commentId: reply.id }, !prevLiked);
      setLikeCount((c) => c + (prevLiked ? -1 : 1));
      return { prevLiked };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevLiked !== undefined) {
        utils.likes.isCommentLiked.setData({ commentId: reply.id }, ctx.prevLiked);
        setLikeCount((c) => c + (ctx.prevLiked ? 1 : -1));
      }
      toast.error('추천 처리에 실패했습니다');
    },
    onSettled: () => {
      utils.likes.isCommentLiked.invalidate({ commentId: reply.id });
      utils.comments.listByPost.invalidate({ postId });
    },
  });

  return (
    <Card className="card-elevated p-4 bg-black/[0.02]">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Avatar
            userId={reply.userId}
            isAnonymous={reply.isAnonymous}
            name={reply.authorName}
            avatarEmoji={reply.authorAvatarEmoji}
            avatarImageUrl={reply.authorAvatarImageUrl}
            size="h-7 w-7"
            textSize="text-sm"
          />
          <div>
            <p className="text-sm font-semibold">{reply.isAnonymous ? '익명' : reply.authorName || '사용자'}</p>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(reply.createdAt), { locale: ko, addSuffix: true })}
            </p>
          </div>
        </div>
      </div>
      <p className="text-sm text-foreground mb-3 whitespace-pre-wrap">{reply.content}</p>
      <div className="flex items-center gap-2">
        {isAuthenticated ? (
          <Button
            variant={isReplyLiked ? 'default' : 'ghost'}
            size="sm"
            onClick={() => toggleReplyLike.mutate({ commentId: reply.id })}
            disabled={toggleReplyLike.isPending}
          >
            <ThumbsUp className="h-4 w-4 mr-1" />
            {likeCount}
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground inline-flex items-center px-2">
            <ThumbsUp className="h-3 w-3 inline mr-1" />
            {likeCount}
          </span>
        )}
      </div>
    </Card>
  );
}
