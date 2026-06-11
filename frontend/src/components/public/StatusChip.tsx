import { useTranslation } from 'react-i18next';
import type { ActivityStatus } from '../../types';

const STATUS_CLASSNAME: Record<'soft' | 'dark', Record<ActivityStatus, string>> = {
  soft: {
    DRAFT: 'bg-slate-100 text-slate-500',
    PREHEAT: 'bg-amber-100 text-amber-700',
    PUBLISHED: 'bg-emerald-100 text-emerald-700',
    SELLING_OUT: 'bg-rose-100 text-rose-600',
    SOLD_OUT: 'bg-slate-200 text-slate-500',
    OFFLINE: 'bg-slate-100 text-slate-500',
    CANCELLED: 'bg-red-100 text-red-600',
  },
  dark: {
    DRAFT: 'border border-slate-600/80 bg-slate-800/70 text-slate-200',
    PREHEAT: 'border border-amber-400/25 bg-amber-500/12 text-amber-200',
    PUBLISHED: 'border border-emerald-400/25 bg-emerald-500/12 text-emerald-200',
    SELLING_OUT: 'border border-rose-400/25 bg-rose-500/12 text-rose-200',
    SOLD_OUT: 'border border-slate-600/90 bg-slate-800/70 text-slate-300',
    OFFLINE: 'border border-slate-600/80 bg-slate-800/70 text-slate-300',
    CANCELLED: 'border border-red-400/25 bg-red-500/12 text-red-200',
  },
};

export function StatusChip({
  status,
  theme = 'soft',
}: {
  status: ActivityStatus;
  theme?: 'soft' | 'dark';
}) {
  const { t } = useTranslation();

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${STATUS_CLASSNAME[theme][status]}`}
    >
      {t(`status.${status}`)}
    </span>
  );
}
