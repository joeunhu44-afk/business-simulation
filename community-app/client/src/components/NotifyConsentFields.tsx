/**
 * 회원가입 시 받는 알림 수신 동의 체크박스. 이메일 가입과 소셜 가입 완료 화면이
 * 같은 문구·같은 동작을 쓰도록 한 곳에 모아둔다.
 *
 * 두 항목 모두 선택 동의이며 기본값은 해제 상태다 — 동의하지 않아도 가입은 된다.
 */
import { Checkbox } from "@/components/ui/checkbox";

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
    <div>
      {/* 폼 안에 또 박스를 두면 무거워 보여서, 얇은 구분선으로 영역만 나눈다. */}
      <hr className="border-0 border-t border-border mb-3" />
      <p className="text-xs text-muted-foreground mb-2.5">
        아래 두 항목은 선택이며, 동의하지 않아도 가입할 수 있어요.
      </p>

      <div className="space-y-2.5">
        <label className="flex items-start gap-2.5 cursor-pointer">
          <Checkbox
            checked={value.notifyPost}
            disabled={disabled}
            onCheckedChange={(checked) => onChange({ ...value, notifyPost: checked === true })}
            className="mt-0.5"
          />
          <span className="leading-tight">
            <span className="block text-sm font-medium">
              활동 알림 받기 <span className="text-xs font-normal text-muted-foreground">(선택)</span>
            </span>
            <span className="block text-xs text-muted-foreground">내 글에 댓글이 달리거나 추천을 받으면 알려드려요</span>
          </span>
        </label>

        <label className="flex items-start gap-2.5 cursor-pointer">
          <Checkbox
            checked={value.notifyMarketing}
            disabled={disabled}
            onCheckedChange={(checked) => onChange({ ...value, notifyMarketing: checked === true })}
            className="mt-0.5"
          />
          <span className="leading-tight">
            <span className="block text-sm font-medium">
              광고성 정보 받기 <span className="text-xs font-normal text-muted-foreground">(선택)</span>
            </span>
            <span className="block text-xs text-muted-foreground">이벤트·제휴 소식을 알려드려요</span>
          </span>
        </label>
      </div>
    </div>
  );
}
