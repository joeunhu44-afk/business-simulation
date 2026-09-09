/**
 * 회원가입 시 받는 알림 수신 동의 체크박스. 이메일 가입과 소셜 가입 완료 화면이
 * 같은 문구·같은 동작을 쓰도록 한 곳에 모아둔다.
 *
 * 두 항목 모두 선택 동의이며 기본값은 해제 상태다 — 동의하지 않아도 가입은 된다.
 */
export type NotifyConsent = {
  notifyPost: boolean;
  notifyMarketing: boolean;
};

export const EMPTY_NOTIFY_CONSENT: NotifyConsent = {
  notifyPost: false,
  notifyMarketing: false,
};

export default function NotifyConsentFields({
  value,
  onChange,
  disabled,
}: {
  value: NotifyConsent;
  onChange: (next: NotifyConsent) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2.5 rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">
        아래 두 항목은 <span className="font-semibold">선택</span>이며, 동의하지 않아도 가입할 수 있어요.
        가입 후 설정에서 언제든 바꿀 수 있습니다.
      </p>

      <label className="flex items-start gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={value.notifyPost}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, notifyPost: e.target.checked })}
          className="mt-0.5 rounded border-border"
        />
        <span className="text-sm leading-snug">
          활동 알림 받기 <span className="text-xs text-muted-foreground">(선택)</span>
          <span className="block text-xs text-muted-foreground">내 글에 댓글이 달리거나 추천을 받으면 알려드려요</span>
        </span>
      </label>

      <label className="flex items-start gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={value.notifyMarketing}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, notifyMarketing: e.target.checked })}
          className="mt-0.5 rounded border-border"
        />
        <span className="text-sm leading-snug">
          광고성 정보 받기 <span className="text-xs text-muted-foreground">(선택)</span>
          <span className="block text-xs text-muted-foreground">이벤트·제휴 소식을 알려드려요</span>
        </span>
      </label>
    </div>
  );
}
