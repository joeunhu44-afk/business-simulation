import { User } from "lucide-react";
import { toneClass } from "@/lib/tone";

function getInitial(name?: string | null): string | null {
  if (!name) return null;
  const parts = name.trim().split(/\s+/);
  const namePart = parts[parts.length - 1];
  return namePart ? namePart.charAt(0) : null;
}

/**
 * 게시글/댓글 작성자 아바타. 익명 글은 항상 기본(회색) 아이콘만 보여주고,
 * 실명 글은 작성자가 설정한 프로필 사진(있으면 최우선) → 이모지 → 이름
 * 이니셜 순으로, 사용자별로 고정된 색상 원 안에 보여준다.
 */
export default function Avatar({
  userId,
  isAnonymous,
  name,
  avatarEmoji,
  avatarImageUrl,
  size = "h-9 w-9",
  textSize = "text-sm",
}: {
  userId: number;
  isAnonymous: boolean;
  name?: string | null;
  avatarEmoji?: string | null;
  avatarImageUrl?: string | null;
  size?: string;
  textSize?: string;
}) {
  if (isAnonymous) {
    return (
      <span className={`tone-badge avatar-default ${size} ${textSize} shrink-0`}>
        <User className="h-[55%] w-[55%]" />
      </span>
    );
  }

  if (avatarImageUrl) {
    return (
      <span className={`tone-badge ${toneClass(userId)} ${size} shrink-0 overflow-hidden p-0`}>
        <img src={avatarImageUrl} alt="" className="h-full w-full object-cover" />
      </span>
    );
  }

  const initial = getInitial(name);
  return (
    <span className={`tone-badge ${toneClass(userId)} ${size} ${textSize} shrink-0`}>
      {avatarEmoji || initial || <User className="h-[55%] w-[55%]" />}
    </span>
  );
}
