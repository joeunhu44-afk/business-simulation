import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Shield, ShieldCheck, ShieldOff, Users, FileText, AlertCircle, Megaphone, Search, ImagePlus, X, MousePointerClick, Eye, HardDrive } from "lucide-react";
import { Link } from "wouter";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { useRef, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import HeaderMenuButton from "@/components/HeaderMenuButton";
import BackButton from "@/components/BackButton";
import { Textarea } from "@/components/ui/textarea";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { isAdminRole, roleLabel } from "@/lib/role";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SYSTEM_REPORTER_USER_ID } from "@shared/const";

const ADMIN_CATEGORIES: { key: string; label: string; tabs: { key: string; label: string }[] }[] = [
  {
    key: 'user',
    label: '사용자',
    tabs: [
      { key: 'approvals', label: '가입 승인' },
      { key: 'users', label: '회원 관리' },
    ],
  },
  {
    key: 'content',
    label: '콘텐츠',
    tabs: [
      { key: 'boards', label: '게시판 관리' },
      { key: 'posts', label: '게시글 관리' },
      { key: 'banners', label: '배너 관리' },
    ],
  },
  {
    key: 'support',
    label: '문의',
    tabs: [
      { key: 'reports', label: '신고 관리' },
      { key: 'inquiries', label: '문의 관리' },
      { key: 'blocked', label: '차단 기록' },
    ],
  },
  {
    key: 'news',
    label: '소식',
    tabs: [
      { key: 'announcements', label: '공지사항' },
      { key: 'news', label: '뉴스' },
      { key: 'push', label: '알림 발송' },
    ],
  },
];

const INQUIRY_CATEGORY_LABELS: Record<string, string> = {
  general: "일반 문의",
  bug: "버그 신고",
  suggestion: "건의사항",
  report_abuse: "신고 관련",
  account: "계정 문의",
};

export default function AdminPanel() {
  const { user, isAuthenticated } = useAuth();
  const [activeCategory, setActiveCategory] = useState(ADMIN_CATEGORIES[0].key);
  const [activeTab, setActiveTab] = useState(ADMIN_CATEGORIES[0].tabs[0].key);

  const currentCategory = ADMIN_CATEGORIES.find((c) => c.key === activeCategory) ?? ADMIN_CATEGORIES[0];

  // 대기 인원은 탭을 열지 않아도 보여야 놓치지 않는다.
  const { data: pendingCount } = trpc.admin.users.pendingCount.useQuery(undefined, {
    enabled: isAdminRole(user?.role),
  });

  const handleSelectCategory = (categoryKey: string) => {
    const category = ADMIN_CATEGORIES.find((c) => c.key === categoryKey);
    if (!category) return;
    setActiveCategory(categoryKey);
    setActiveTab(category.tabs[0].key);
  };

  if (!isAuthenticated || !isAdminRole(user?.role)) {
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
        <h1 className="section-heading text-3xl mb-4">관리자 패널</h1>

        <StorageNotice />

        <div className="space-y-4">
          {/* 1단계: 카테고리 */}
          <div className="flex gap-2 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            {ADMIN_CATEGORIES.map((category) => (
              <Button
                key={category.key}
                size="sm"
                variant={activeCategory === category.key ? 'default' : 'outline'}
                onClick={() => handleSelectCategory(category.key)}
                className="shrink-0"
              >
                {category.label}
              </Button>
            ))}
          </div>

          {/* 2단계: 카테고리 안의 세부 메뉴 (하나뿐이면 생략) */}
          {currentCategory.tabs.length > 1 && (
            <div className="flex gap-2 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pl-2 border-l-2" style={{ borderColor: 'var(--border-color)' }}>
              {currentCategory.tabs.map((tab) => (
                <Button
                  key={tab.key}
                  size="sm"
                  variant={activeTab === tab.key ? 'secondary' : 'ghost'}
                  onClick={() => setActiveTab(tab.key)}
                  className="shrink-0"
                >
                  {tab.label}
                  {tab.key === 'approvals' && !!pendingCount && (
                    <span
                      className="ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums"
                      style={{ backgroundColor: 'var(--accent-color)', color: '#fff' }}
                    >
                      {pendingCount}
                    </span>
                  )}
                </Button>
              ))}
            </div>
          )}

          <div>
            {activeTab === 'approvals' && <ApprovalsTab />}
            {activeTab === 'users' && <UsersTab />}
            {activeTab === 'boards' && <BoardsTab />}
            {activeTab === 'posts' && <PostsTab />}
            {activeTab === 'banners' && <AdBannersTab />}
            {activeTab === 'reports' && <ReportsTab />}
            {activeTab === 'announcements' && <AnnouncementsTab />}
            {activeTab === 'news' && <NewsTab />}
            {activeTab === 'push' && <MarketingNotificationTab />}
            {activeTab === 'inquiries' && <InquiriesTab />}
            {activeTab === 'blocked' && <BlockedAttemptsTab />}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 가입 승인 탭. 학번+이름·가입 수단·이메일·가입 시각을 보고 재학생인지 판단한다.
 * 거절은 계정을 지우지 않고 차단 처리하므로, 사유를 남기면 그 사람이 다시 로그인할 때 보인다.
 */
/**
 * 업로드 파일 저장 위치 안내.
 *
 * 임시 디스크에 쌓이고 있으면 재배포 한 번에 프로필/게시물 사진이 전부 사라진다.
 * 문제가 있을 때만 눈에 띄게 띄우고, 정상이면 한 줄로 조용히 보여준다.
 */
function StorageNotice() {
  const { data } = trpc.admin.storageStatus.useQuery();
  if (!data) return null;

  if (data.persistent) {
    return (
      <p className="mb-6 flex items-center gap-2 text-[13px]" style={{ color: 'var(--text-muted)' }}>
        <HardDrive className="h-3.5 w-3.5 shrink-0" />
        <span>{data.summary}</span>
      </p>
    );
  }

  return (
    <div
      className="mb-6 rounded-xl border p-4"
      style={{ borderColor: 'var(--destructive, #dc2626)', backgroundColor: 'rgba(220, 38, 38, 0.06)' }}
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 shrink-0" style={{ color: '#dc2626' }} />
        <div className="space-y-1">
          <p className="font-semibold text-[14px]" style={{ color: '#dc2626' }}>
            업로드된 사진이 재배포 시 사라지는 상태입니다
          </p>
          <p className="text-[13px]" style={{ color: 'var(--text-normal)' }}>{data.summary}</p>
          {data.remedy && (
            <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>{data.remedy}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ApprovalsTab() {
  const utils = trpc.useUtils();
  const { data: pending, isLoading } = trpc.admin.users.pending.useQuery();
  const [notes, setNotes] = useState<Record<number, string>>({});

  const decide = trpc.admin.users.decideApproval.useMutation({
    onSuccess: (_result, variables) => {
      toast.success(variables.decision === 'approve' ? '가입을 승인했습니다' : '가입을 거절했습니다');
      utils.admin.users.pending.invalidate();
      utils.admin.users.pendingCount.invalidate();
      utils.admin.users.list.invalidate();
    },
    onError: (error) => toast.error(error.message || '처리에 실패했습니다'),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!pending || pending.length === 0) {
    return (
      <Card className="card-elevated p-10 text-center">
        <p className="text-sm text-muted-foreground">승인을 기다리는 가입 신청이 없습니다.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        승인 대기 {pending.length}명 · 학번과 이름이 실제 재학생과 맞는지 확인한 뒤 처리해주세요.
      </p>
      {pending.map((applicant) => (
        <Card key={applicant.id} className="card-elevated p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-[15px]" style={{ color: 'var(--text-strong)' }}>
                {applicant.name || '(이름 없음)'}
              </p>
              <p className="mt-0.5 text-[13px] text-muted-foreground break-all">
                {applicant.email || '이메일 없음'} · {applicant.loginMethod || '알 수 없음'} 가입
              </p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                {formatDistanceToNow(new Date(applicant.createdAt), { locale: ko, addSuffix: true })} 신청
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                size="sm"
                disabled={decide.isPending}
                onClick={() => decide.mutate({ userId: applicant.id, decision: 'approve' })}
              >
                승인
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={decide.isPending}
                onClick={() =>
                  decide.mutate({
                    userId: applicant.id,
                    decision: 'reject',
                    note: notes[applicant.id]?.trim() || undefined,
                  })
                }
              >
                거절
              </Button>
            </div>
          </div>
          <Input
            value={notes[applicant.id] ?? ''}
            onChange={(e) => setNotes((prev) => ({ ...prev, [applicant.id]: e.target.value }))}
            placeholder="거절 사유 (선택) — 거절 시 본인이 로그인할 때 보입니다"
            maxLength={200}
            className="mt-3 h-9 text-[13px]"
          />
        </Card>
      ))}
    </div>
  );
}

function UsersTab() {
  const { user: viewer } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);
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

  const viewerIsOwner = viewer?.role === 'owner';

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
        <div className="space-y-2">
          {filteredUsers.map((target) => {
            const isOwnerRow = target.role === 'owner';
            const isAdminRow = target.role === 'admin';
            const canEdit = !isOwnerRow && (!isAdminRow || viewerIsOwner);
            const canViewActivity = target.role === 'user' || viewerIsOwner;

            return (
              <Card key={target.id} className="card-elevated overflow-hidden">
                <div className="flex items-center gap-4 p-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{target.name || '(이름 없음)'}</p>
                      {isAdminRole(target.role) ? (
                        <span className="shield-pill shield-pill-safe">
                          <ShieldCheck className="h-3 w-3" />
                          {roleLabel(target.role)}
                        </span>
                      ) : (
                        <span className="tag-pill">{roleLabel(target.role)}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{target.email || '(이메일 없음)'}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {canEdit ? (
                      <select
                        value={target.role}
                        onChange={(e) => updateRoleMutation.mutate({ userId: target.id, role: e.target.value as 'user' | 'admin' })}
                        disabled={updateRoleMutation.isPending}
                        className="px-2 py-1 rounded border border-border text-sm"
                      >
                        <option value="user">사용자</option>
                        <option value="admin">관리자</option>
                      </select>
                    ) : (
                      <span
                        className="shield-pill shield-pill-safe"
                        title={isOwnerRow ? '조물주 권한은 변경할 수 없습니다' : '다른 관리자의 권한은 조물주만 변경할 수 있습니다'}
                      >
                        <ShieldCheck className="h-3 w-3" />
                        {roleLabel(target.role)} (고정)
                      </span>
                    )}
                    {canEdit ? (
                      <select
                        value={target.status}
                        onChange={(e) => updateStatusMutation.mutate({ userId: target.id, status: e.target.value as 'active' | 'blocked' })}
                        disabled={updateStatusMutation.isPending}
                        className="px-2 py-1 rounded border border-border text-sm"
                      >
                        <option value="active">활성</option>
                        <option value="blocked">차단</option>
                      </select>
                    ) : target.status === 'active' ? (
                      <span className="shield-pill shield-pill-safe">
                        <ShieldCheck className="h-3 w-3" />
                        활성
                      </span>
                    ) : (
                      <span className="shield-pill shield-pill-danger">
                        <ShieldOff className="h-3 w-3" />
                        차단
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(target.createdAt), { locale: ko, addSuffix: true })}
                    </span>
                    {canViewActivity && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setExpandedUserId(expandedUserId === target.id ? null : target.id)}
                      >
                        {expandedUserId === target.id ? '활동 닫기' : '활동 보기'}
                      </Button>
                    )}
                  </div>
                </div>
                {expandedUserId === target.id && canViewActivity && <UserActivityPanel userId={target.id} />}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function UserActivityPanel({ userId }: { userId: number }) {
  const { data: activity, isLoading } = trpc.admin.users.activity.useQuery({ userId });

  if (isLoading) {
    return (
      <div className="border-t border-border p-4 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!activity) return null;

  const hasNothing =
    activity.posts.length === 0 &&
    activity.comments.length === 0 &&
    activity.likedPosts.length === 0 &&
    activity.likedComments.length === 0;

  return (
    <div className="border-t border-border bg-muted/30 p-4 space-y-4">
      {hasNothing ? (
        <p className="text-sm text-muted-foreground text-center py-2">활동 내역이 없습니다</p>
      ) : (
        <>
          <ActivitySection title={`작성한 게시글 (${activity.posts.length})`}>
            {activity.posts.map((post: any) => (
              <a key={post.id} href={`/post/${post.id}`} target="_blank" rel="noopener noreferrer" className="block text-sm hover:underline truncate">
                {post.title}
              </a>
            ))}
          </ActivitySection>
          <ActivitySection title={`작성한 댓글 (${activity.comments.length})`}>
            {activity.comments.map((comment: any) => (
              <p key={comment.id} className="text-sm text-muted-foreground truncate">{comment.content}</p>
            ))}
          </ActivitySection>
          <ActivitySection title={`좋아요한 게시글 (${activity.likedPosts.length})`}>
            {activity.likedPosts.map((like: any) => (
              <a key={like.postId} href={`/post/${like.postId}`} target="_blank" rel="noopener noreferrer" className="block text-sm hover:underline truncate">
                {like.title || `게시글 #${like.postId}`}
              </a>
            ))}
          </ActivitySection>
          <ActivitySection title={`좋아요한 댓글 (${activity.likedComments.length})`}>
            {activity.likedComments.map((like: any) => (
              <p key={like.commentId} className="text-sm text-muted-foreground truncate">{like.content || `댓글 #${like.commentId}`}</p>
            ))}
          </ActivitySection>
        </>
      )}
    </div>
  );
}

function ActivitySection({ title, children }: { title: string; children: ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;
  if (!hasChildren) return null;
  return (
    <div>
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{title}</h4>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function BoardsTab() {
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardSlug, setNewBoardSlug] = useState('');
  const [newBoardDesc, setNewBoardDesc] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');
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
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(newBoardSlug.trim())) {
      toast.error('슬러그는 영문 소문자, 숫자, 하이픈(-)만 사용할 수 있어요 (예: free-board)');
      return;
    }
    createBoardMutation.mutate({
      name: newBoardName,
      slug: newBoardSlug.trim(),
      description: newBoardDesc || undefined,
    });
  };

  const startEdit = (board: { id: number; name: string; slug: string; description: string | null }) => {
    setEditingId(board.id);
    setEditName(board.name);
    setEditSlug(board.slug);
    setEditDesc(board.description || '');
  };

  const handleSaveEdit = (id: number) => {
    if (!editName.trim()) {
      toast.error('게시판 이름을 입력해주세요');
      return;
    }
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(editSlug.trim())) {
      toast.error('슬러그는 영문 소문자, 숫자, 하이픈(-)만 사용할 수 있어요 (예: free-board)');
      return;
    }
    updateBoardMutation.mutate({ id, name: editName, slug: editSlug.trim(), description: editDesc || undefined });
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
            placeholder="슬러그 (URL 경로, 예: free-board)"
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
                  <Input
                    value={editSlug}
                    onChange={(e) => setEditSlug(e.target.value)}
                    placeholder="슬러그 (URL 경로, 예: free-board)"
                  />
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
                    <p className="text-xs text-muted-foreground font-mono">/board/{board.slug}</p>
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

  const actMutation = trpc.reports.act.useMutation({
    onSuccess: () => {
      utils.reports.list.invalidate();
      utils.admin.users.list.invalidate();
    },
    onError: (error) => toast.error(error.message || '처리에 실패했습니다'),
  });

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
            <ReportCard
              key={report.id}
              report={report}
              onAct={(action) => actMutation.mutate({ id: report.id, action })}
              onChangeStatus={(status) => updateStatusMutation.mutate({ id: report.id, status })}
              isActing={actMutation.isPending && actMutation.variables?.id === report.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type ReportRow = RouterOutput['reports']['list'][number];

/**
 * 신고 한 건.
 *
 * 예전에는 신고 사유만 보여줘서, 정작 어떤 글이 문제인지 확인할 수도 조치할 수도 없었다.
 * 이제 신고당한 내용을 카드 안에서 바로 읽고 여기서 삭제·차단까지 끝낼 수 있다.
 */
function ReportCard({
  report,
  onAct,
  onChangeStatus,
  isActing,
}: {
  report: ReportRow;
  onAct: (action: 'delete_content' | 'block_author' | 'resolve' | 'dismiss') => void;
  onChangeStatus: (status: 'pending' | 'resolved' | 'dismissed') => void;
  isActing: boolean;
}) {
  const target = report.target;
  const isComment = report.targetType === 'comment';
  const isAuto = report.reporterUserId === SYSTEM_REPORTER_USER_ID;

  const confirmAct = (action: 'delete_content' | 'block_author', message: string) => {
    if (window.confirm(message)) onAct(action);
  };

  return (
    <Card className="card-elevated p-5">
      {/* 머리말: 무엇이 · 왜 신고됐는지 */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="tag-pill">{REPORT_TARGET_LABELS[report.targetType] || report.targetType}</span>
        {isAuto && <span className="shield-pill shield-pill-safe">자동 감지</span>}
        <span className="text-sm font-semibold">{report.reason}</span>
        <span className="text-xs text-muted-foreground">
          · 신고자 {isAuto ? '자동 필터' : report.reporterName ?? '알 수 없음'}
        </span>
      </div>

      {report.description && (
        <p className="text-sm text-muted-foreground whitespace-pre-wrap mb-3">{report.description}</p>
      )}

      {/* 신고당한 내용 */}
      {!target ? (
        <div className="rounded-lg border border-border p-4 mb-3" style={{ backgroundColor: 'var(--bg-surface-2)' }}>
          <p className="text-sm text-muted-foreground">
            신고된 {isComment ? '댓글' : '게시글'}을 찾을 수 없습니다 (영구 삭제되었을 수 있습니다).
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border p-4 mb-3" style={{ backgroundColor: 'var(--bg-surface-2)' }}>
          <div className="flex items-center gap-2 flex-wrap mb-2 text-xs text-muted-foreground">
            {target.boardName && <span>{target.boardName}</span>}
            <span>
              작성자 {target.isAnonymous ? '익명' : target.authorName ?? '알 수 없음'}
            </span>
            {target.createdAt && (
              <span>{formatDistanceToNow(new Date(target.createdAt), { locale: ko, addSuffix: true })}</span>
            )}
            {!target.exists && <span className="font-semibold text-destructive">이미 삭제됨</span>}
          </div>

          {target.postTitle && (
            <p className="text-sm font-semibold mb-1">
              {isComment ? `${target.postTitle} (글)` : target.postTitle}
            </p>
          )}

          {target.content && (
            <p className="text-sm whitespace-pre-wrap line-clamp-6" style={{ color: 'var(--text-normal)' }}>
              {target.content}
            </p>
          )}

          {target.images.length > 0 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {target.images.map((url: string) => (
                <img
                  key={url}
                  src={url}
                  alt="신고된 첨부 이미지"
                  className="h-20 w-20 rounded-md border border-border object-cover"
                />
              ))}
            </div>
          )}

          {target.postId && (
            <a
              href={`/post/${target.postId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-3 text-xs accent-text hover:underline"
            >
              원문에서 보기 →
            </a>
          )}
        </div>
      )}

      {/* 조치 */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">
          신고 {formatDistanceToNow(new Date(report.createdAt), { locale: ko, addSuffix: true })}
        </span>

        <div className="flex items-center gap-2 flex-wrap">
          {report.status === 'pending' && (
            <>
              {target?.exists && (
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={isActing}
                  onClick={() =>
                    confirmAct(
                      'delete_content',
                      `이 ${isComment ? '댓글' : '게시글'}을 삭제할까요? 작성자에게는 보이지 않게 됩니다.`
                    )
                  }
                >
                  {isComment ? '댓글' : '게시글'} 삭제
                </Button>
              )}
              {target && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isActing}
                  onClick={() =>
                    confirmAct(
                      'block_author',
                      target.isAnonymous
                        ? '익명 작성자를 차단할까요? 누구인지는 표시되지 않지만 해당 계정의 이용이 제한됩니다.'
                        : `${target.authorName ?? '작성자'} 계정을 차단할까요? 로그인과 서비스 이용이 제한됩니다.`
                    )
                  }
                >
                  작성자 차단
                </Button>
              )}
              <Button size="sm" variant="ghost" disabled={isActing} onClick={() => onAct('dismiss')}>
                문제 없음
              </Button>
            </>
          )}

          <select
            value={report.status}
            onChange={(e) => onChangeStatus(e.target.value as 'pending' | 'resolved' | 'dismissed')}
            className="px-2 py-1 rounded border border-border text-sm"
          >
            <option value="pending">대기</option>
            <option value="resolved">해결</option>
            <option value="dismissed">무시</option>
          </select>
        </div>
      </div>
    </Card>
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

type AdBannerFormState = {
  title: string;
  imageUrl: string;
  linkUrl: string;
  position: 'home_top' | 'board_top';
  targetBoardId: string;
  startsAt: string;
  endsAt: string;
};

const EMPTY_BANNER_FORM: AdBannerFormState = {
  title: '',
  imageUrl: '',
  linkUrl: '',
  position: 'home_top',
  targetBoardId: '',
  startsAt: '',
  endsAt: '',
};

/** 서버의 Date/ISO 문자열을 <input type="datetime-local">에 바로 쓸 수 있는 형식으로 변환한다. */
function toDatetimeLocalValue(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function AdBannerImagePicker({ imageUrl, onChange }: { imageUrl: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const uploadMutation = trpc.media.uploadAdBannerImage.useMutation();
  const ref = useRef<HTMLInputElement | null>(null);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('이미지 파일만 업로드할 수 있어요');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error('이미지는 8MB 이하만 업로드할 수 있어요');
      return;
    }
    setUploading(true);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const { url } = await uploadMutation.mutateAsync({ dataUrl });
      onChange(url);
    } catch (error: any) {
      toast.error(error?.message || '이미지 업로드에 실패했습니다');
    } finally {
      setUploading(false);
      if (ref.current) ref.current.value = '';
    }
  };

  return (
    <div>
      {imageUrl ? (
        <div className="relative w-full max-w-xs">
          <img src={imageUrl} alt="배너 미리보기" className="w-full h-auto max-h-40 object-cover rounded-lg border border-border" />
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center"
            aria-label="이미지 제거"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={uploading}
          className="h-24 w-full max-w-xs rounded-lg border-2 border-dashed border-border flex items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
        >
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
          <span className="text-sm">배너 이미지 업로드</span>
        </button>
      )}
      <input
        ref={(el) => { ref.current = el; }}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}

function AdBannersTab() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState<AdBannerFormState>(EMPTY_BANNER_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<AdBannerFormState>(EMPTY_BANNER_FORM);

  const { data: banners, isLoading } = trpc.adBanners.listAll.useQuery();
  const { data: boards } = trpc.boards.list.useQuery();
  const utils = trpc.useUtils();
  const invalidate = () => utils.adBanners.listAll.invalidate();

  const createMutation = trpc.adBanners.create.useMutation({
    onSuccess: () => {
      toast.success('배너가 등록되었습니다');
      setForm(EMPTY_BANNER_FORM);
      setShowCreateForm(false);
      invalidate();
    },
    onError: (error) => toast.error(error.message || '배너 등록에 실패했습니다'),
  });

  const updateMutation = trpc.adBanners.update.useMutation({
    onSuccess: () => {
      toast.success('배너가 수정되었습니다');
      setEditingId(null);
      invalidate();
    },
    onError: (error) => toast.error(error.message || '배너 수정에 실패했습니다'),
  });

  const deleteMutation = trpc.adBanners.delete.useMutation({
    onSuccess: () => {
      toast.success('배너가 삭제되었습니다');
      invalidate();
    },
    onError: (error) => toast.error(error.message || '삭제에 실패했습니다'),
  });

  const validateForm = (f: AdBannerFormState) => {
    if (!f.title.trim() || !f.imageUrl.trim() || !f.linkUrl.trim()) {
      toast.error('제목, 이미지, 링크 URL을 모두 입력해주세요');
      return false;
    }
    if (f.position === 'board_top' && !f.targetBoardId) {
      toast.error('노출할 게시판을 선택해주세요');
      return false;
    }
    return true;
  };

  const handleCreate = () => {
    if (!validateForm(form)) return;
    createMutation.mutate({
      title: form.title.trim(),
      imageUrl: form.imageUrl,
      linkUrl: form.linkUrl.trim(),
      position: form.position,
      targetBoardId: form.position === 'board_top' ? Number(form.targetBoardId) : undefined,
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
    });
  };

  const startEdit = (b: NonNullable<typeof banners>[number]) => {
    setEditingId(b.id);
    setEditForm({
      title: b.title,
      imageUrl: b.imageUrl,
      linkUrl: b.linkUrl,
      position: b.position,
      targetBoardId: b.targetBoardId ? String(b.targetBoardId) : '',
      startsAt: toDatetimeLocalValue(b.startsAt),
      endsAt: toDatetimeLocalValue(b.endsAt),
    });
  };

  const handleSaveEdit = (id: number) => {
    if (!validateForm(editForm)) return;
    updateMutation.mutate({
      id,
      title: editForm.title.trim(),
      imageUrl: editForm.imageUrl,
      linkUrl: editForm.linkUrl.trim(),
      position: editForm.position,
      targetBoardId: editForm.position === 'board_top' ? Number(editForm.targetBoardId) : null,
      startsAt: editForm.startsAt ? new Date(editForm.startsAt).toISOString() : null,
      endsAt: editForm.endsAt ? new Date(editForm.endsAt).toISOString() : null,
    });
  };

  const handleToggleActive = (b: NonNullable<typeof banners>[number]) => {
    updateMutation.mutate({ id: b.id, isActive: !b.isActive });
  };

  const handleDelete = (id: number, title: string) => {
    if (!window.confirm(`"${title}" 배너를 삭제하시겠습니까?`)) return;
    deleteMutation.mutate({ id });
  };

  const boardName = (id: number | null) => boards?.find((b) => b.id === id)?.name || `#${id}`;

  const renderPositionFields = (f: AdBannerFormState, setF: (updater: (prev: AdBannerFormState) => AdBannerFormState) => void) => (
    <>
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">노출 위치</label>
        <Select value={f.position} onValueChange={(v) => setF((prev) => ({ ...prev, position: v as 'home_top' | 'board_top' }))}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="home_top">홈 상단</SelectItem>
            <SelectItem value="board_top">특정 게시판</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {f.position === 'board_top' && (
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">대상 게시판</label>
          <Select value={f.targetBoardId} onValueChange={(v) => setF((prev) => ({ ...prev, targetBoardId: v }))}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="게시판 선택" />
            </SelectTrigger>
            <SelectContent>
              {boards?.map((board) => (
                <SelectItem key={board.id} value={String(board.id)}>{board.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">노출 시작(선택)</label>
          <Input type="datetime-local" value={f.startsAt} onChange={(e) => setF((prev) => ({ ...prev, startsAt: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">노출 종료(선택)</label>
          <Input type="datetime-local" value={f.endsAt} onChange={(e) => setF((prev) => ({ ...prev, endsAt: e.target.value }))} />
        </div>
      </div>
    </>
  );

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
          <h3 className="font-semibold mb-4">새 배너 등록</h3>
          <div className="space-y-3">
            <AdBannerImagePicker imageUrl={form.imageUrl} onChange={(url) => setForm((prev) => ({ ...prev, imageUrl: url }))} />
            <Input placeholder="제목" value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} />
            <Input placeholder="링크 URL (클릭 시 이동할 주소)" value={form.linkUrl} onChange={(e) => setForm((prev) => ({ ...prev, linkUrl: e.target.value }))} />
            {renderPositionFields(form, setForm)}
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={createMutation.isPending} className="flex-1">
                {createMutation.isPending ? '등록 중...' : '등록'}
              </Button>
              <Button variant="outline" onClick={() => { setShowCreateForm(false); setForm(EMPTY_BANNER_FORM); }}>취소</Button>
            </div>
          </div>
        </Card>
      ) : (
        <Button onClick={() => setShowCreateForm(true)}>+ 새 배너 등록</Button>
      )}
      <Card className="card-elevated p-6">
        <div className="space-y-4">
          {banners?.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">등록된 배너가 없습니다</p>
          )}
          {banners?.map((banner) => (
            <div key={banner.id} className="p-4 border border-border rounded-lg">
              {editingId === banner.id ? (
                <div className="space-y-2">
                  <AdBannerImagePicker imageUrl={editForm.imageUrl} onChange={(url) => setEditForm((prev) => ({ ...prev, imageUrl: url }))} />
                  <Input value={editForm.title} onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="제목" />
                  <Input value={editForm.linkUrl} onChange={(e) => setEditForm((prev) => ({ ...prev, linkUrl: e.target.value }))} placeholder="링크 URL" />
                  {renderPositionFields(editForm, setEditForm)}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleSaveEdit(banner.id)} disabled={updateMutation.isPending}>
                      저장
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>취소</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <img src={banner.imageUrl} alt={banner.title} className="h-14 w-20 object-cover rounded-md border border-border shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">{banner.title}</h3>
                        <span className={`shield-pill ${banner.isActive ? 'shield-pill-safe' : 'shield-pill-danger'}`}>
                          {banner.isActive ? '노출 중' : '비활성'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {banner.position === 'home_top' ? '홈 상단' : `게시판: ${boardName(banner.targetBoardId)}`}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{banner.impressionCount}</span>
                        <span className="inline-flex items-center gap-1"><MousePointerClick className="h-3.5 w-3.5" />{banner.clickCount}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => handleToggleActive(banner)} disabled={updateMutation.isPending}>
                      {banner.isActive ? '비활성화' : '활성화'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => startEdit(banner)}>수정</Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(banner.id, banner.title)}
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

function MarketingNotificationTab() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  const sendMutation = trpc.notifications.sendMarketing.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.sentCount}명에게 발송되었습니다`);
      setTitle('');
      setBody('');
      setLinkUrl('');
    },
    onError: (error) => toast.error(error.message || '발송에 실패했습니다'),
  });

  const handleSend = () => {
    if (!title.trim()) {
      toast.error('제목을 입력해주세요');
      return;
    }
    if (!window.confirm('광고성 정보 수신에 동의한 사용자 전원에게 발송됩니다. 계속할까요?')) return;
    sendMutation.mutate({
      title: title.trim(),
      body: body.trim() || undefined,
      linkUrl: linkUrl.trim() || undefined,
    });
  };

  return (
    <div className="space-y-4">
      <Card className="card-elevated p-6 bg-secondary">
        <h3 className="font-semibold mb-1">광고성 알림 발송</h3>
        <p className="text-xs text-muted-foreground mb-4">
          광고성 정보 수신에 <span className="font-semibold">동의한 사용자에게만</span> 전달됩니다.
          동의하지 않은 사용자에게는 발송되지 않습니다.
        </p>
        <div className="space-y-3">
          <Input placeholder="제목" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea
            placeholder="내용 (선택)"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="min-h-24"
          />
          <Input
            placeholder="이동할 링크 (선택, 예: /board/free)"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
          />
          <Button onClick={handleSend} disabled={sendMutation.isPending} className="w-full">
            {sendMutation.isPending ? '발송 중...' : '동의자에게 발송'}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function BlockedAttemptsTab() {
  const { data: logs, isLoading } = trpc.moderation.listBlocked.useQuery({ limit: 100 });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <Card className="card-elevated p-12 text-center">
        <p className="text-muted-foreground">차단된 작성 시도가 없습니다</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        자동 필터가 막은 작성 시도입니다. 자주 시도되는 표현을 확인해 금지어 목록(server/_core/moderation.ts)을 보강하세요.
      </p>
      <Card className="card-elevated p-6">
        <div className="space-y-3">
          {logs.map((log) => (
            <div key={log.id} className="p-4 border border-border rounded-lg">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="tag-pill">{log.targetType === 'post' ? '게시글' : '댓글'}</span>
                <span className="text-xs font-mono text-muted-foreground">{log.reason}</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {formatDistanceToNow(new Date(log.createdAt), { locale: ko, addSuffix: true })}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap break-words line-clamp-4">{log.content}</p>
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
