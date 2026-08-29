import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Flag, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface ReportDialogProps {
  targetType: 'post' | 'comment';
  targetId: number;
}

export function ReportDialog({ targetType, targetId }: ReportDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');

  const createReportMutation = trpc.reports.create.useMutation({
    onSuccess: () => {
      toast.success('신고가 접수되었습니다. 감사합니다.');
      setOpen(false);
      setReason('');
      setDescription('');
    },
    onError: (error) => {
      toast.error(error.message || '신고 접수에 실패했습니다');
    },
  });

  const handleSubmit = () => {
    if (!reason) {
      toast.error('신고 사유를 선택해주세요');
      return;
    }

    createReportMutation.mutate({
      targetType,
      targetId,
      reason,
      description: description || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Flag className="h-4 w-4 mr-2" />
          신고
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {targetType === 'post' ? '게시글' : '댓글'} 신고
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-2">신고 사유</label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="신고 사유를 선택해주세요" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="spam">스팸/광고</SelectItem>
                <SelectItem value="inappropriate">부적절한 내용</SelectItem>
                <SelectItem value="harassment">욕설/괴롭힘</SelectItem>
                <SelectItem value="misinformation">거짓 정보</SelectItem>
                <SelectItem value="copyright">저작권 침해</SelectItem>
                <SelectItem value="other">기타</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">상세 설명 (선택)</label>
            <Textarea
              placeholder="신고 사유에 대한 상세 설명을 입력해주세요"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-24"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={createReportMutation.isPending}
            >
              취소
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createReportMutation.isPending || !reason}
            >
              {createReportMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  신고 중...
                </>
              ) : (
                '신고하기'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
