import { useRef, useState } from "react";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const MAX_IMAGES = 4;
const MAX_FILE_BYTES = 8 * 1024 * 1024;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** 게시글 작성/수정용 이미지 첨부 위젯. 선택 즉시 업로드하고, 업로드된 URL 배열을 부모가 들고 있는다. */
export default function ImagePicker({
  images,
  onChange,
}: {
  images: string[];
  onChange: (images: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const uploadMutation = trpc.media.uploadPostImage.useMutation();

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      toast.error(`이미지는 최대 ${MAX_IMAGES}장까지 첨부할 수 있어요`);
      return;
    }

    const picked = Array.from(files).slice(0, remaining);
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of picked) {
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name}은 이미지 파일이 아니에요`);
          continue;
        }
        if (file.size > MAX_FILE_BYTES) {
          toast.error(`${file.name}은 8MB를 초과해요`);
          continue;
        }
        const dataUrl = await fileToDataUrl(file);
        const { url } = await uploadMutation.mutateAsync({ dataUrl });
        uploaded.push(url);
      }
      if (uploaded.length > 0) onChange([...images, ...uploaded]);
    } catch (error: any) {
      toast.error(error?.message || "이미지 업로드에 실패했습니다");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {images.map((url, idx) => (
          <div key={url} className="relative h-20 w-20 rounded-lg overflow-hidden border border-border shrink-0">
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(images.filter((_, i) => i !== idx))}
              className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center"
              aria-label="이미지 삭제"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {images.length < MAX_IMAGES && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="h-20 w-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors shrink-0"
            aria-label="이미지 추가"
          >
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <p className="text-xs text-muted-foreground">사진 최대 {MAX_IMAGES}장, 장당 8MB까지 첨부할 수 있어요</p>
    </div>
  );
}
