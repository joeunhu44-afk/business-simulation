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

export default function AdminPanel() {
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('users');

  if (!isAuthenticated || user?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <h1 className="text-2xl font-bold mb-4">접근 권한이 없습니다</h1>
          <p className="text-gray-600 mb-6">관리자만 접근할 수 있습니다</p>
          <a href="/" className="text-primary hover:underline">홈으로 돌아가기</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-gray-200 bg-white shadow-sm sticky top-0 z-40">
        <div className="container flex items-center justify-between py-4">
          <a href="/" className="text-2xl font-bold text-primary hover:opacity-80 transition-opacity">
            커뮤니티
          </a>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">관리자 패널</span>
          </div>
        </div>
      </nav>

      <div className="container py-8">
        <h1 className="text-3xl font-bold mb-8">관리자 패널</h1>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="users">회원 관리</TabsTrigger>
            <TabsTrigger value="boards">게시판 관리</TabsTrigger>
            <TabsTrigger value="posts">게시글 관리</TabsTrigger>
            <TabsTrigger value="reports">신고 관리</TabsTrigger>
            <TabsTrigger value="announcements">공지사항</TabsTrigger>
            <TabsTrigger value="news">뉴스</TabsTrigger>
          </TabsList>

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
  const filteredUsers = users?.filter(user => 
    (user.name?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
    (user.email?.toLowerCase().includes(searchQuery.toLowerCase()) || false)
  ) || [];
  const updateRoleMutation = trpc.admin.users.updateRole.useMutation({
    onSuccess: () => {
      toast.success('역할이 변경되었습니다');
    },
  });
  const updateStatusMutation = trpc.admin.users.updateStatus.useMutation({
    onSuccess: () => {
      toast.success('상태가 변경되었습니다');
    },
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
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600" />
        <Input
          placeholder="사용자 이름 또는 이메일로 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>
      {filteredUsers.length === 0 ? (
        <Card className="card-elevated p-12 text-center">
          <p className="text-gray-600">검색 결과가 없습니다</p>
        </Card>
      ) : (
      <Card className="card-elevated overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-100/50">
              <tr>
                <th className="px-6 py-3 text-left font-semibold">사용자</th>
                <th className="px-6 py-3 text-left font-semibold">이메일</th>
                <th className="px-6 py-3 text-left font-semibold">역할</th>
                <th className="px-6 py-3 text-left font-semibold">상태</th>
                <th className="px-6 py-3 text-left font-semibold">작업</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
              <tr key={user.id} className="border-b border-gray-200 hover:bg-gray-100/30">
                <td className="px-6 py-3">{user.name || '(이름 없음)'}</td>
                <td className="px-6 py-3">{user.email || '(이메일 없음)'}</td>
                <td className="px-6 py-3">
                  <select
                    value={user.role}
                    onChange={(e) => updateRoleMutation.mutate({ userId: user.id, role: e.target.value as 'user' | 'admin' })}
                    className="px-2 py-1 rounded border border-gray-200"
                  >
                    <option value="user">사용자</option>
                    <option value="admin">관리자</option>
                  </select>
                </td>
                <td className="px-6 py-3">
                  <select
                    value={user.status}
                    onChange={(e) => updateStatusMutation.mutate({ userId: user.id, status: e.target.value as 'active' | 'blocked' })}
                    className="px-2 py-1 rounded border border-gray-200"
                  >
                    <option value="active">활성</option>
                    <option value="blocked">차단</option>
                  </select>
                </td>
                <td className="px-6 py-3">
                  <Button variant="outline" size="sm" disabled>
                    상세보기
                  </Button>
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

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="card-elevated p-6 bg-gray-50">
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
            <div key={board.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div>
                <h3 className="font-semibold">{board.name}</h3>
                <p className="text-sm text-gray-600">{board.description}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">수정</Button>
                <Button variant="destructive" size="sm">삭제</Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function PostsTab() {
  const [selectedBoardId, setSelectedBoardId] = useState<number | null>(null);
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

  return (
    <div className="space-y-4">
      <select
        value={selectedBoardId || ''}
        onChange={(e) => setSelectedBoardId(e.target.value ? parseInt(e.target.value) : null)}
        className="w-full px-3 py-2 rounded border border-gray-200"
      >
        <option value="">게시판을 선택하세요</option>
        {boards?.map((board) => (
          <option key={board.id} value={board.id}>{board.name}</option>
        ))}
      </select>

      {!selectedBoardId ? (
        <Card className="card-elevated p-12 text-center">
          <p className="text-gray-600">게시판을 선택하세요</p>
        </Card>
      ) : isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !posts || posts.length === 0 ? (
        <Card className="card-elevated p-12 text-center">
          <p className="text-gray-600">게시글이 없습니다</p>
        </Card>
      ) : (
        <Card className="card-elevated overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-100/50">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold">제목</th>
                  <th className="px-6 py-3 text-left font-semibold">작성자</th>
                  <th className="px-6 py-3 text-left font-semibold">작성일</th>
                  <th className="px-6 py-3 text-left font-semibold">작업</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post: any) => (
                  <tr key={post.id} className="border-b border-gray-200 hover:bg-gray-100/30">
                    <td className="px-6 py-3 truncate">{post.title}</td>
                    <td className="px-6 py-3">{post.isAnonymous ? '익명' : '사용자'}</td>
                    <td className="px-6 py-3 text-xs">{new Date(post.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-3">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deletePostMutation.mutate({ id: post.id })}
                        disabled={deletePostMutation.isPending}
                      >
                        삭제
                      </Button>
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

function ReportsTab() {
  const { data: reports, isLoading } = trpc.reports.list.useQuery({ status: 'pending', limit: 50 });
  const updateStatusMutation = trpc.reports.updateStatus.useMutation({
    onSuccess: () => {
      toast.success('신고 상태가 변경되었습니다');
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="card-elevated overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-100/50">
            <tr>
              <th className="px-6 py-3 text-left font-semibold">대상</th>
              <th className="px-6 py-3 text-left font-semibold">사유</th>
              <th className="px-6 py-3 text-left font-semibold">상태</th>
              <th className="px-6 py-3 text-left font-semibold">작업</th>
            </tr>
          </thead>
          <tbody>
            {reports?.map((report) => (
              <tr key={report.id} className="border-b border-gray-200 hover:bg-gray-100/30">
                <td className="px-6 py-3">{report.targetType}</td>
                <td className="px-6 py-3">{report.reason}</td>
                <td className="px-6 py-3">
                  <select
                    value={report.status}
                    onChange={(e) => updateStatusMutation.mutate({ id: report.id, status: e.target.value as any })}
                    className="px-2 py-1 rounded border border-gray-200"
                  >
                    <option value="pending">대기</option>
                    <option value="resolved">해결</option>
                    <option value="dismissed">무시</option>
                  </select>
                </td>
                <td className="px-6 py-3">
                  <Button variant="outline" size="sm">상세보기</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function AnnouncementsTab() {
  const { data: announcements, isLoading } = trpc.announcements.list.useQuery({ limit: 50 });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button>+ 새 공지사항 작성</Button>
      <Card className="card-elevated p-6">
        <div className="space-y-4">
          {announcements?.map((announcement) => (
            <div key={announcement.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div>
                <h3 className="font-semibold">{announcement.title}</h3>
                <p className="text-sm text-gray-600 line-clamp-2">{announcement.content}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">수정</Button>
                <Button variant="destructive" size="sm">삭제</Button>
              </div>
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
      <Card className="card-elevated p-6 bg-gray-50">
        <h3 className="font-semibold mb-4">새 뉴스 추가</h3>
        <p className="text-sm text-gray-600 mb-3">
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
            <p className="text-sm text-gray-600 text-center py-4">등록된 뉴스가 없습니다</p>
          )}
          {newsItems?.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="min-w-0">
                <h3 className="font-semibold">
                  {item.title}
                  {!item.isActive && (
                    <span className="ml-2 text-xs font-normal text-gray-500">(숨김)</span>
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
