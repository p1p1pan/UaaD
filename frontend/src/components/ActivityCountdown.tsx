import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { resolveActivityCountdownState } from '../utils/activityCountdown';
import { formatLongDate } from '../utils/formatters';

interface ActivityCountdownProps {
  enrollOpenAt: string;
  enrollCloseAt: string;
  soldOut?: boolean;
  className?: string;
}

interface CountdownSegments {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function formatRemain(ms: number): CountdownSegments {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds };
}

export default function ActivityCountdown({
  enrollOpenAt,
  enrollCloseAt,
  soldOut = false,
  className = '',
}: ActivityCountdownProps) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());

  const countdown = resolveActivityCountdownState({
    enrollOpenAt,
    enrollCloseAt,
    soldOut,
    now,
  });

  useEffect(() => {
    if (countdown.phase === 'closed' || countdown.phase === 'soldOut') {
      return;
    }

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [countdown.phase, enrollCloseAt, enrollOpenAt, soldOut]);

  const remain = formatRemain(countdown.remainingMs);

  const helperText =
    countdown.phase === 'upcoming'
      ? t('activityDetail.countdownOpenHint', { time: formatLongDate(enrollOpenAt) })
      : countdown.phase === 'selling'
        ? t('activityDetail.countdownCloseHint', { time: formatLongDate(enrollCloseAt) })
        : countdown.phase === 'soldOut'
          ? t('activityDetail.countdownSoldOutHint', { time: formatLongDate(enrollCloseAt) })
          : t('activityDetail.countdownClosedHint', { time: formatLongDate(enrollCloseAt) });

  return (
    <div className={`rounded-[28px] border border-rose-100 bg-white p-5 shadow-sm ${className}`.trim()}>
      <p className="text-sm font-semibold text-slate-500">
        {countdown.phase === 'upcoming'
          ? t('activityDetail.countdownOpen')
          : countdown.phase === 'selling'
            ? t('activityDetail.countdownClose')
            : countdown.phase === 'soldOut'
              ? t('activityDetail.countdownSoldOut')
              : t('activityDetail.countdownClosed')}
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{helperText}</p>

      {countdown.phase === 'closed' ? (
        <p className="mt-4 text-lg font-bold text-slate-800">{t('activityDetail.closed')}</p>
      ) : countdown.phase === 'soldOut' ? (
        <p className="mt-4 text-lg font-bold text-rose-600">{t('activityDetail.stockSoldOut')}</p>
      ) : (
        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          <div className="rounded-2xl bg-slate-50 py-3">
            <p className="text-lg font-black text-slate-900">{remain.days}</p>
            <p className="text-[10px] text-slate-500">{t('activityDetail.day')}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 py-3">
            <p className="text-lg font-black text-slate-900">{remain.hours}</p>
            <p className="text-[10px] text-slate-500">{t('activityDetail.hour')}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 py-3">
            <p className="text-lg font-black text-slate-900">{remain.minutes}</p>
            <p className="text-[10px] text-slate-500">{t('activityDetail.minute')}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 py-3">
            <p className="text-lg font-black text-slate-900">{remain.seconds}</p>
            <p className="text-[10px] text-slate-500">{t('activityDetail.second')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
