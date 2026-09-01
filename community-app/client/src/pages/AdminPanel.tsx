import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Shield, Users, FileText, AlertCircle, Megaphone, Search } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import HeaderMenuButton from "@/components/HeaderMenuButton";
import BackButton from "@/components/BackButton";
import { Textarea } from "@/components/ui/textarea";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";

const INQUIRY_CATEGORY_LABELS: Record<string, string> = {
  general: "일반 문의",
  bug: "버그 신고",
  suggestion: "건의사항",
  report_abuse: "신고 관련",
  account: "계정 문의",
};

export default function AdminPanel() {
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('users');

  if (!isAuthenticated || user?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <h1 className="text-2xl mb-4">접근 권한이 없습니다</h1>
          <p className="text-muted-foreground mb-6">관리자만 접근할 수 있습니다</p>
          <a href="/" className="accent-text hover:underline">홈으로 돌아가기</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-3 z-40 mx-3 sm:mx-6 lg:mx-auto lg:max-w-6xl rounded-2xl border border-border bg-card/90 backdrop-blur-md shadow-sm">
        <div className="container flex items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <BackButton />
            <HeaderMenuButton />
            <a href="/" className="font-serif text-xl font-bold accent-text hover:opacity-80 transition-opacity">
              커뮤니티
            </a>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">관리자 패널</span>
          </div>
        </div>
      </nav>

      <div className="container py-8">
        <h1 className="section-heading text-3xl mb-8">관리자 패널</h1>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <TabsList className="sm:w-full sm:grid sm:grid-cols-7">
            <TabsTrigger value="users">회원 관리</TabsTrigger>
            <TabsTrigger value="boards">게시판 관리</TabsTrigger>
            <TabsTrigger value="posts">게시글 관리</TabsTrigger>
            <TabsTrigger value="reports">신고 관리</TabsTrigger>
            <TabsTrigger value="announcements">공지사항</TabsTrigger>
            <TabsTrigger value="news">뉴스</TabsTrigger>
            <TabsTrigger value="inquiries">문의함</TabsTrigger>
            </TabsList>
          </div>

          {/* Users Tab */}
          <TabsContent value="users">
            <UsersTab />
          </TabsContent>

          {/* Boards Tab */}
          <TabsContent value="boards">
            <BoardsTab />
          </TabsContent>

          {/* Posts Tab */}
          <TabsContent value="posts">
            <PostsTab />
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports">
            <ReportsTab />
          </TabsContent>

          {/* Announcements Tab */}
          <TabsContent value="announcements">
            <AnnouncementsTab />
          </TabsContent>

          {/* Inquiries Tab */}
          <TabsContent value="inquiries">
            <InquiriesTab />
          </TabsContent>

          {/* News Tab */}
          <TabsContent value="news">
            <NewsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function UsersTab() {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: users, isLoading } = trpc.admin.users.list.useQuery({ limit: 100 });
  const utils = trpc.useUtils();
  const filteredUsers = users?.filter(user =>
    (user.name?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
    (user.email?.toLowerCase().includes(searchQuery.toLowerCase()) || false)
  ) || [];
  const updateRoleMutation = trpc.admin.users.updateRole.useMutation({
    onSuccess: () => {
      toast.success('역할이 변경되었습니다');
      utils.admin.users.list.invalidate();
    },
    onError: (error) => toast.error(error.message || '역할 변경에 실패했습니다'),
  });
  const updateStatusMutation = trpc.admin.users.updateStatus.useMutation({
    onSuccess: () => {
      toast.success('상태가 변경되었습니다');
      utils.admin.users.list.invalidate();
    },
    onError: (error) => toast.error(error.message || '상태 변경에 실패했습니다'),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="사용자 이름 또는 이메일로 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>
      {filteredUsers.length === 0 ? (
        <Card className="card-elevated p-12 text-center">
          <p className="text-muted-foreground">검색 결과가 없습니다</p>
        </Card>
      ) : (
      <Card className="card-elevated overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-6 py-3 text-left font-semibold">사용자</th>
                <th className="px-6 py-3 text-left font-semibold">이메일</th>
                <th className="px-6 py-3 text-left font-semibold">역할</th>
                <th className="px-6 py-3 text-left font-semibold">상태</th>
                <th className="px-6 py-3 text-left font-semibold">가입일</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
              <tr key={user.id} className="border-b border-border hover:bg-muted/30">
                <td className="px-6 py-3">{user.name || '(이름 없음)'}</td>
                <td className="px-6 py-3">{user.email || '(이메일 없음)'}</td>
                <td className="px-6 py-3">
                  <select
                    value={user.role}
                    onChange={(e) => updateRoleMutation.mutate({ userId: user.id, role: e.target.value as 'user' | 'admin' })}
                    className="px-2 py-1 rounded border border-border"
                  >
                    <option value="user">사용자</option>
                    <option value="admin">관리자</option>
                  </select>
                </td>
                <td className="px-6 py-3">
                  <select
                    value={user.status}
                    onChange={(e) => updateStatusMutation.mutate({ userId: user.id, status: e.target.value as 'active' | 'blocked' })}
                    className="px-2 py-1 rounded border border-border"
                  >
                    <option value="active">활성</option>
                    <option value="blocked">차단</option>
                  </select>
                </td>
                <td className="px-6 py-3 text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(user.createdAt), { locale: ko, addSuffix: true })}
                </td>
              </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      )}
    </div>
  );
}

function BoardsTab() {
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardSlug, setNewBoardSlug] = useState('');
  const [newBoardDesc, setNewBoardDesc] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const { data: boards, isLoading } = trpc.boards.list.useQuery();
  const utils = trpc.useUtils();

  const createBoardMutation = trpc.boards.create.useMutation({
    onSuccess: () => {
      toast.success('게시판이 생성되었습니다');
      setNewBoardName('');
      setNewBoardSlug('');
      setNewBoardDesc('');
      utils.boards.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || '게시판 생성에 실패했습니다');
    },
  });

  const updateBoardMutation = trpc.boards.update.useMutation({
    onSuccess: () => {
      toast.success('게시판이 수정되었습니다');
      setEditingId(null);
      utils.boards.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || '게시판 수정에 실패했습니다');
    },
  });

  const deleteBoardMutation = trpc.boards.delete.useMutation({
    onSuccess: () => {
      toast.success('게시판이 삭제되었습니다');
      utils.boards.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || '게시판 삭제에 실패했습니다');
    },
  });

  const handleCreateBoard = () => {
    if (!newBoardName.trim() || !newBoardSlug.trim()) {
      toast.error('게시판 이름과 슬러그를 입력해주세요');
      return;
    }
    createBoardMutation.mutate({
      name: newBoardName,
      slug: newBoardSlug,
      description: newBoardDesc || undefined,
    });
  };

  const startEdit = (board: { id: number; name: string; description: string | null }) => {
    setEditingId(board.id);
    setEditName(board.name);
    setEditDesc(board.description || '');
  };

  const handleSaveEdit = (id: number) => {
    if (!editName.trim()) {
      toast.error('게시판 이름을 입력해주세요');
      return;
    }
    updateBoardMutation.mutate({ id, name: editName, description: editDesc || undefined });
  };

  const handleDelete = (id: number, name: string) => {
    if (!window.confirm(`"${name}" 게시판을 삭제하시겠습니까? 게시판 안의 글은 사라지지 않지만 목록에서 더 이상 보이지 않습니다.`)) return;
    deleteBoardMutation.mutate({ id });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="card-elevated p-6 bg-secondary">
        <h3 className="font-semibold mb-4">새 게시판 생성</h3>
        <div className="space-y-3">
          <Input
            placeholder="게시판 이름"
            value={newBoardName}
            onChange={(e) => setNewBoardName(e.target.value)}
          />
          <Input
            placeholder="슬러그 (URL 경로)"
            value={newBoardSlug}
            onChange={(e) => setNewBoardSlug(e.target.value)}
          />
          <Input
            placeholder="설명 (선택사항)"
            value={newBoardDesc}
            onChange={(e) => setNewBoardDesc(e.target.value)}
          />
          <Button
            onClick={handleCreateBoard}
            disabled={createBoardMutation.isPending}
            className="w-full"
          >
            {createBoardMutation.isPending ? '생성 중...' : '게시판 생성'}
          </Button>
        </div>
      </Card>
      <Card className="card-elevated p-6">
        <div className="space-y-4">
          {boards?.map((board) => (
            <div key={board.id} className="p-4 border border-border rounded-lg">
              {editingId === board.id ? (
                <div className="space-y-2">
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="게시판 이름" />
                  <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="설명" />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleSaveEdit(board.id)} disabled={updateBoardMutation.isPending}>
                      저장
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>취소</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="font-semibold">{board.name}</h3>
                    <p className="text-sm text-muted-foreground">{board.description}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => startEdit(board)}>수정</Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(board.id, board.name)}
                      disabled={deleteBoardMutation.isPending}
                    >
                      삭제
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function PostsTab() {
  const [selectedBoardId, setSelectedBoardId] = useState<number | null>(null);
  const [expandedPostId, setExpandedPostId] = useState<number | null>(null);
  const { data: boards } = trpc.boards.list.useQuery();
  const { data: posts, isLoading } = trpc.posts.listByBoard.useQuery(
    { boardId: selectedBoardId || 0, limit: 50 },
    { enabled: !!selectedBoardId }
  );
  const utils = trpc.useUtils();
  const deletePostMutation = trpc.admin.posts.forceDelete.useMutation({
    onSuccess: () => {
      toast.success('게시글이 삭제되었습니다');
      utils.posts.listByBoard.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || '게시글 삭제에 실패했습니다');
    },
  });

  const handleDeletePost = (id: number, title: string) => {
    if (!window.confirm(`"${title}" 게시글을 삭제하시겠습니까?`)) return;
    deletePostMutation.mutate({ id });
  };

  return (
    <div className="space-y-4">
      <select
        value={selectedBoardId || ''}
        onChange={(e) => {
          setSelectedBoardId(e.target.value ? parseInt(e.target.value) : null);
          setExpandedPostId(null);
        }}
        className="w-full px-3 py-2 rounded border border-border"
      >
        <option value="">게시판을 선택하세요</option>
        {boards?.map((board) => (
          <option key={board.id} value={board.id}>{board.name}</option>
        ))}
      </select>

      {!selectedBoardId ? (
        <Card className="card-elevated p-12 text-center">
          <p className="text-muted-foreground">게시판을 선택하세요</p>
        </Card>
      ) : isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !posts || posts.length === 0 ? (
        <Card className="card-elevated p-12 text-center">
          <p className="text-muted-foreground">게시글이 없습니다</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {posts.map((post: any) => (
            <Card key={post.id} className="card-elevated overflow-hidden">
              <div className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <a href={`/post/${post.id}`} target="_blank" rel="noopener noreferrer" className="font-semibold truncate hover:underline block">
                    {post.title}
                  </a>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {post.isAnonymous ? '익명' : post.authorName || '사용자'} · {new Date(post.createdAt).toLocaleDateString()} · 댓글 {post.commentCount}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExpandedPostId(expandedPostId === post.id ? null : post.id)}
                  >
                    {expandedPostId === post.id ? '댓글 닫기' : `댓글 관리 (${post.commentCount})`}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeletePost(post.id, post.title)}
                    disabled={deletePostMutation.isPending}
                  >
                    삭제
                  </Button>
                </div>
              </div>
              {expandedPostId === post.id && <PostCommentsAdmin postId={post.id} />}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function PostCommentsAdmin({ postId }: { postId: number }) {
  const { data: comments, isLoading } = trpc.comments.listByPost.useQuery({ postId });
  const utils = trpc.useUtils();
  const deleteCommentMutation = trpc.admin.comments.forceDelete.useMutation({
    onSuccess: () => {
      toast.success('댓글이 삭제되었습니다');
      utils.comments.listByPost.invalidate({ postId });
      utils.posts.listByBoard.invalidate();
    },
    onError: (error) => toast.error(error.message || '댓글 삭제에 실패했습니다'),
  });

  const handleDelete = (id: number) => {
    if (!window.confirm('이 댓글을 삭제하시겠습니까?')) return;
    deleteCommentMutation.mutate({ id });
  };

  return (
    <div className="border-t border-border bg-muted/30 p-4 space-y-2">
      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : !comments || comments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-2">댓글이 없습니다</p>
      ) : (
        comments.map((comment: any) => (
          <div key={comment.id} className="flex items-start justify-between gap-3 bg-card rounded-lg p-3 border border-border">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground mb-1">
                {comment.isAnonymous ? '익명' : comment.authorName || '사용자'} ·{' '}
                {formatDistanceToNow(new Date(comment.createdAt), { locale: ko, addSuffix: true })}
              </p>
              <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleDelete(comment.id)}
              disabled={deleteCommentMutation.isPending}
              className="shrink-0"
            >
              삭제
            </Button>
          </div>
        ))
      )}
    </div>
  );
}

const REPORT_TARGET_LABELS: Record<string, string> = { post: '게시글', comment: '댓글' };
const REPORT_STATUS_LABELS: Record<string, string> = { pending: '대기', resolved: '해결', dismissed: '무시' };

function ReportsTab() {
  const [statusFilter, setStatusFilter] = useState<'pending' | 'resolved' | 'dismissed' | 'all'>('pending');
  const { data: reports, isLoading } = trpc.reports.list.useQuery({
    status: statusFilter === 'all' ? undefined : statusFilter,
    limit: 50,
  });
  const utils = trpc.useUtils();
  const updateStatusMutation = trpc.reports.updateStatus.useMutation({
    onSuccess: () => {
      toast.success('신고 상태가 변경되었습니다');
      utils.reports.list.invalidate();
    },
    onError: (error) => toast.error(error.message || '상태 변경에 실패했습니다'),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['pending', 'resolved', 'dismissed', 'all'] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={statusFilter === s ? 'default' : 'outline'}
            onClick={() => setStatusFilter(s)}
          >
            {s === 'all' ? '전체' : REPORT_STATUS_LABELS[s]}
          </Button>
        ))}
      </div>

      {!reports || reports.length === 0 ? (
        <Card className="card-elevated p-12 text-center">
          <p className="text-muted-foreground">신고 내역이 없습니다</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <Card key={report.id} className="card-elevated p-5">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="tag-pill">{REPORT_TARGET_LABELS[report.targetType] || report.targetType}</span>
                <span className="text-sm font-semibold">{report.reason}</span>
                {report.targetType === 'post' && (
                  <a href={`/post/${report.targetId}`} target="_blank" rel="noopener noreferrer" className="text-xs accent-text hover:underline">
                    게시글 보기 →
                  </a>
                )}
              </div>
              {report.description && (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap mb-3">{report.description}</p>
              )}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(report.createdAt), { locale: ko, addSuffix: true })}
                </span>
                <select
                  value={report.status}
                  onChange={(e) => updateStatusMutation.mutate({ id: report.id, status: e.target.value as any })}
                  className="px-2 py-1 rounded border border-border text-sm"
                >
                  <option value="pending">대기</option>
                  <option value="resolved">해결</option>
                  <option value="dismissed">무시</option>
                </select>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function AnnouncementsTab() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  const { data: announcements, isLoading } = trpc.announcements.list.useQuery({ limit: 50 });
  const utils = trpc.useUtils();
  const invalidate = () => utils.announcements.list.invalidate();

  const createMutation = trpc.announcements.create.useMutation({
    onSuccess: () => {
      toast.success('공지사항이 등록되었습니다');
      setNewTitle('');
      setNewContent('');
      setShowCreateForm(false);
      invalidate();
    },
    onError: (error) => toast.error(error.message || '공지사항 등록에 실패했습니다'),
  });

  const updateMutation = trpc.announcements.update.useMutation({
    onSuccess: () => {
      toast.success('공지사항이 수정되었습니다');
      setEditingId(null);
      invalidate();
    },
    onError: (error) => toast.error(error.message || '공지사항 수정에 실패했습니다'),
  });

  const deleteMutation = trpc.announcements.delete.useMutation({
    onSuccess: () => {
      toast.success('공지사항이 삭제되었습니다');
      invalidate();
    },
    onError: (error) => toast.error(error.message || '삭제에 실패했습니다'),
  });

  const handleCreate = () => {
    if (!newTitle.trim() || !newContent.trim()) {
      toast.error('제목과 내용을 입력해주세요');
      return;
    }
    createMutation.mutate({ title: newTitle.trim(), content: newContent.trim() });
  };

  const startEdit = (a: { id: number; title: string; content: string }) => {
    setEditingId(a.id);
    setEditTitle(a.title);
    setEditContent(a.content);
  };

  const handleSaveEdit = (id: number) => {
    if (!editTitle.trim() || !editContent.trim()) {
      toast.error('제목과 내용을 입력해주세요');
      return;
    }
    updateMutation.mutate({ id, title: editTitle.trim(), content: editContent.trim() });
  };

  const handleDelete = (id: number, title: string) => {
    if (!window.confirm(`"${title}" 공지사항을 삭제하시겠습니까?`)) return;
    deleteMutation.mutate({ id });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showCreateForm ? (
        <Card className="card-elevated p-6 bg-secondary">
          <h3 className="font-semibold mb-4">새 공지사항 작성</h3>
          <div className="space-y-3">
            <Input placeholder="제목" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
            <Textarea placeholder="내용" value={newContent} onChange={(e) => setNewContent(e.target.value)} className="min-h-24" />
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={createMutation.isPending} className="flex-1">
                {createMutation.isPending ? '등록 중...' : '등록'}
              </Button>
              <Button variant="outline" onClick={() => setShowCreateForm(false)}>취소</Button>
            </div>
          </div>
        </Card>
      ) : (
        <Button onClick={() => setShowCreateForm(true)}>+ 새 공지사항 작성</Button>
      )}
      <Card className="card-elevated p-6">
        <div className="space-y-4">
          {announcements?.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">등록된 공지사항이 없습니다</p>
          )}
          {announcements?.map((announcement) => (
            <div key={announcement.id} className="p-4 border border-border rounded-lg">
              {editingId === announcement.id ? (
                <div className="space-y-2">
                  <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="제목" />
                  <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} placeholder="내용" className="min-h-24" />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleSaveEdit(announcement.id)} disabled={updateMutation.isPending}>
                      저장
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>취소</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="font-semibold">{announcement.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">{announcement.content}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => startEdit(announcement)}>수정</Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(announcement.id, announcement.title)}
                      disabled={deleteMutation.isPending}
                    >
                      삭제
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function NewsTab() {
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const { data: newsItems, isLoading } = trpc.news.listAll.useQuery();
  const utils = trpc.useUtils();

  const invalidateNews = () => {
    utils.news.listAll.invalidate();
    utils.news.list.invalidate();
  };

  const createMutation = trpc.news.create.useMutation({
    onSuccess: () => {
      toast.success('뉴스가 추가되었습니다');
      setNewTitle('');
      setNewUrl('');
      invalidateNews();
    },
    onError: (error) => {
      toast.error(error.message || '뉴스 추가에 실패했습니다');
    },
  });

  const toggleActiveMutation = trpc.news.update.useMutation({
    onSuccess: invalidateNews,
    onError: (error) => {
      toast.error(error.message || '수정에 실패했습니다');
    },
  });

  const deleteMutation = trpc.news.delete.useMutation({
    onSuccess: () => {
      toast.success('뉴스가 삭제되었습니다');
      invalidateNews();
    },
    onError: (error) => {
      toast.error(error.message || '삭제에 실패했습니다');
    },
  });

  const handleCreate = () => {
    if (!newTitle.trim()) {
      toast.error('제목을 입력해주세요');
      return;
    }
    createMutation.mutate({ title: newTitle.trim(), url: newUrl.trim() || undefined });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="card-elevated p-6 bg-secondary">
        <h3 className="font-semibold mb-4">새 뉴스 추가</h3>
        <p className="text-sm text-muted-foreground mb-3">
          여기서 추가한 뉴스가 홈 화면 오른쪽 상단 "오늘의 뉴스" 패널에 노출됩니다.
        </p>
        <div className="space-y-3">
          <Input
            placeholder="제목"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <Input
            placeholder="링크 (선택사항, https://...)"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
          />
          <Button
            onClick={handleCreate}
            disabled={createMutation.isPending}
            className="w-full"
          >
            {createMutation.isPending ? '추가 중...' : '뉴스 추가'}
          </Button>
        </div>
      </Card>
      <Card className="card-elevated p-6">
        <div className="space-y-4">
          {newsItems?.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">등록된 뉴스가 없습니다</p>
          )}
          {newsItems?.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
              <div className="min-w-0">
                <h3 className="font-semibold">
                  {item.title}
                  {!item.isActive && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">(숨김)</span>
                  )}
                </h3>
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline break-all"
                  >
                    {item.url}
                  </a>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={toggleActiveMutation.isPending}
                  onClick={() => toggleActiveMutation.mutate({ id: item.id, isActive: !item.isActive })}
                >
                  {item.isActive ? '숨기기' : '노출하기'}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate({ id: item.id })}
                >
                  삭제
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function InquiriesTab() {
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'answered'>('pending');
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const { data: inquiries, isLoading } = trpc.inquiries.listAll.useQuery({
    status: statusFilter === 'all' ? undefined : statusFilter,
  });
  const utils = trpc.useUtils();

  const answerMutation = trpc.inquiries.answer.useMutation({
    onSuccess: () => {
      toast.success('답변이 등록되었습니다');
      utils.inquiries.listAll.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || '답변 등록에 실패했습니다');
    },
  });

  const handleAnswer = (id: number) => {
    const reply = (replyDrafts[id] || '').trim();
    if (!reply) {
      toast.error('답변 내용을 입력해주세요');
      return;
    }
    answerMutation.mutate({ id, adminReply: reply });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['pending', 'answered', 'all'] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={statusFilter === s ? 'default' : 'outline'}
            onClick={() => setStatusFilter(s)}
          >
            {s === 'pending' ? '답변 대기중' : s === 'answered' ? '답변 완료' : '전체'}
          </Button>
        ))}
      </div>

      {!inquiries || inquiries.length === 0 ? (
        <Card className="card-elevated p-12 text-center">
          <p className="text-muted-foreground">문의가 없습니다</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {inquiries.map((inquiry) => (
            <Card key={inquiry.id} className="card-elevated p-6">
              <div className="flex items-center gap-2 mb-2 min-w-0">
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded shrink-0"
                  style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent-color)" }}
                >
                  {INQUIRY_CATEGORY_LABELS[inquiry.category] || inquiry.category}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatDistanceToNow(new Date(inquiry.createdAt), { locale: ko, addSuffix: true })}
                </span>
                {inquiry.status === 'answered' && (
                  <span className="text-xs font-semibold shrink-0 ml-auto" style={{ color: "var(--accent-color)" }}>
                    답변 완료
                  </span>
                )}
              </div>
              <h3 className="font-semibold mb-1">{inquiry.title}</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap mb-4">{inquiry.content}</p>

              {inquiry.status === 'answered' ? (
                <div className="pt-3 border-t border-border">
                  <p className="text-xs font-semibold accent-text mb-1">관리자 답변</p>
                  <p className="text-sm whitespace-pre-wrap">{inquiry.adminReply}</p>
                </div>
              ) : (
                <div className="pt-3 border-t border-border space-y-2">
                  <Textarea
                    placeholder="답변을 입력해주세요"
                    value={replyDrafts[inquiry.id] || ''}
                    onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [inquiry.id]: e.target.value }))}
                    className="min-h-20"
                  />
                  <Button
                    size="sm"
                    disabled={answerMutation.isPending}
                    onClick={() => handleAnswer(inquiry.id)}
                  >
                    답변 등록
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
