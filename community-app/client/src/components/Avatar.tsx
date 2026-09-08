import { User } from "lucide-react";
import { useState } from "react";
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
    return <ImageAvatar key={avatarImageUrl} url={avatarImageUrl} userId={userId} name={name} avatarEmoji={avatarEmoji} size={size} textSize={textSize} />;
  }

  const initial = getInitial(name);
  return (
    <span className={`tone-badge ${toneClass(userId)} ${size} ${textSize} shrink-0`}>
      {avatarEmoji || initial || <User className="h-[55%] w-[55%]" />}
    </span>
  );
}

/**
 * 업로드된 프로필 사진 전용 렌더러. 스토리지 설정 문제 등으로 이미지 URL이
 * 깨져 있으면(로드 실패) 새로고침해도 계속 깨진 아이콘만 보이는 대신, 이모지
 * → 이니셜 → 기본 아이콘 순으로 자동 대체한다. avatarImageUrl이 바뀌면
 * key로 리마운트되어 실패 상태가 초기화된다.
 */
function ImageAvatar({
  url,
  userId,
  name,
  avatarEmoji,
  size,
  textSize,
}: {
  url: string;
  userId: number;
  name?: string | null;
  avatarEmoji?: string | null;
  size: string;
  textSize: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    const initial = getInitial(name);
    return (
      <span className={`tone-badge ${toneClass(userId)} ${size} ${textSize} shrink-0`}>
        {avatarEmoji || initial || <User className="h-[55%] w-[55%]" />}
      </span>
    );
  }

  return (
    <span className={`tone-badge ${toneClass(userId)} ${size} shrink-0 overflow-hidden p-0`}>
      <img src={url} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} />
    </span>
  );
}
