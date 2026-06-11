import { AlertTriangle, BadgeCheck, Info } from 'lucide-react';
import type { ReactNode } from 'react';

export type MerchantNoticeTone = 'success' | 'error' | 'info';

interface MerchantNoticeProps {
  tone: MerchantNoticeTone;
  title?: string;
  message: string;
  action?: ReactNode;
}

const TONE_STYLES: Record<
  MerchantNoticeTone,
  {
    wrapper: string;
    icon: string;
  }
> = {
  success: {
    wrapper: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    icon: 'bg-emerald-100 text-emerald-600',
  },
  error: {
    wrapper: 'border-red-200 bg-red-50 text-red-700',
    icon: 'bg-red-100 text-red-600',
  },
  info: {
    wrapper: 'border-rose-200 bg-rose-50 text-rose-700',
    icon: 'bg-rose-100 text-rose-600',
  },
};

const TONE_ICON = {
  success: BadgeCheck,
  error: AlertTriangle,
  info: Info,
} as const;

export function MerchantNotice({ tone, title, message, action }: MerchantNoticeProps) {
  const Icon = TONE_ICON[tone];
  const styles = TONE_STYLES[tone];

  return (
    <div
      className={`flex flex-col gap-4 rounded-2xl border px-4 py-4 shadow-sm sm:flex-row sm:items-start sm:justify-between ${styles.wrapper}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 rounded-xl p-2 ${styles.icon}`}>
          <Icon size={16} />
        </div>
        <div className="space-y-1">
          {title ? <p className="text-sm font-semibold">{title}</p> : null}
          <p className="text-sm leading-6 text-inherit/90">{message}</p>
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
