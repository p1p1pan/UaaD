import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, Clock3, MapPin, Ticket, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { createEnrollment, getActivityDetail, getActivityStock, getEnrollmentStatus } from '../api/endpoints';
import type { ActivityDetail } from '../types';
import type { ApiBusinessError } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatLongDate } from '../utils/formatters';

type CountdownState = 'upcoming' | 'selling' | 'closed';

function getCountdownTarget(activity: ActivityDetail): {
  state: CountdownState;
  target: number;
} {
  const now = Date.now();
  const openAt = new Date(activity.enrollOpenAt).getTime();
  const closeAt = new Date(activity.enrollCloseAt).getTime();

  if (now < openAt) {
    return { state: 'upcoming', target: openAt };
  }

  if (now <= closeAt) {
    return { state: 'selling', target: closeAt };
  }

  return { state: 'closed', target: now };
}

function formatRemain(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}

export default function ActivityDetailPage() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const activityId = Number(id);
  const [activity, setActivity] = useState<ActivityDetail | null>(null);
  const [stockRemaining, setStockRemaining] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const [isSubmittingEnrollment, setIsSubmittingEnrollment] = useState(false);
  const [enrollmentMessage, setEnrollmentMessage] = useState('');
  const [isQueuePolling, setIsQueuePolling] = useState(false);
  const queuePollTimerRef = useRef<number | null>(null);

  const clearQueuePolling = () => {
    if (queuePollTimerRef.current !== null) {
      window.clearInterval(queuePollTimerRef.current);
      queuePollTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (!Number.isFinite(activityId)) {
      setError(t('activityDetail.invalidId'));
      setLoading(false);
      return;
    }

    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError('');
        const detail = await getActivityDetail(activityId);
        if (!active) {
          return;
        }

        setActivity(detail);
        setStockRemaining(detail.stockRemaining);

        const stock = await getActivityStock(activityId).catch(() => null);
        if (!active || !stock) {
          return;
        }
        setStockRemaining(stock.stockRemaining);
      } catch {
        if (!active) {
          return;
        }
        setError(t('activityDetail.loadError'));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [activityId, t]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(
    () => () => {
      clearQueuePolling();
    },
    [],
  );

  useEffect(() => {
    if (!activity) {
      return;
    }

    const poll = window.setInterval(async () => {
      const stock = await getActivityStock(activity.id).catch(() => null);
      if (stock) {
        setStockRemaining(stock.stockRemaining);
      }
    }, 15000);

    return () => window.clearInterval(poll);
  }, [activity]);

  const stockMeta = useMemo(() => {
    if (!activity) {
      return { percent: 0, tone: 'bg-emerald-500', textTone: 'text-emerald-600' };
    }

    const remain = Math.max(0, stockRemaining ?? activity.stockRemaining);
    const percent = activity.maxCapacity > 0 ? Math.round((remain / activity.maxCapacity) * 100) : 0;

    if (percent <= 10) {
      return { percent, tone: 'bg-rose-500', textTone: 'text-rose-600' };
    }
    if (percent <= 35) {
      return { percent, tone: 'bg-amber-500', textTone: 'text-amber-600' };
    }
    return { percent, tone: 'bg-emerald-500', textTone: 'text-emerald-600' };
  }, [activity, stockRemaining]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-5 px-4 py-8">
        <div className="h-72 animate-pulse rounded-3xl bg-rose-100/60" />
        <div className="h-48 animate-pulse rounded-3xl bg-slate-100" />
      </div>
    );
  }

  if (error || !activity) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-3xl flex-col items-center justify-center gap-5 px-4 text-center">
        <p className="text-2xl font-bold text-slate-900">{t('public.errorTitle')}</p>
        <p className="text-slate-500">{error || t('activityDetail.notFound')}</p>
        <Link
          to="/activities"
          className="rounded-full bg-rose-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-rose-600"
        >
          {t('activityDetail.backToList')}
        </Link>
      </div>
    );
  }

  const countdown = getCountdownTarget(activity);
  const remain = formatRemain(countdown.target - now);

  const handleEnroll = async () => {
    if (!activity) {
      return;
    }

    if (!isAuthenticated) {
      navigate('/login', {
        state: {
          from: {
            pathname: location.pathname,
            search: location.search,
          },
        },
      });
      return;
    }

    clearQueuePolling();
    setIsQueuePolling(false);
    setIsSubmittingEnrollment(true);
    setEnrollmentMessage('');

    try {
      const result = await createEnrollment(activity.id);

      if (result.status === 'SUCCESS') {
        setEnrollmentMessage(result.orderNo ? `报名成功，订单号：${result.orderNo}` : '报名成功，请前往订单页完成支付。');
        return;
      }

      if (result.status === 'QUEUING' && result.enrollmentId) {
        setEnrollmentMessage(`排队中，当前队列序号：${result.queuePosition}`);
        setIsQueuePolling(true);
        let retries = 0;
        const maxRetries = 45;

        queuePollTimerRef.current = window.setInterval(async () => {
          retries += 1;
          if (retries > maxRetries) {
            clearQueuePolling();
            setIsQueuePolling(false);
            setEnrollmentMessage('排队状态查询超时，请稍后在通知中心确认结果。');
            return;
          }

          const status = await getEnrollmentStatus(result.enrollmentId).catch(() => null);
          if (!status) {
            return;
          }

          if (status.status === 'SUCCESS') {
            clearQueuePolling();
            setIsQueuePolling(false);
            setEnrollmentMessage(status.orderNo ? `排队成功，订单号：${status.orderNo}` : '排队成功，请继续完成支付。');
            return;
          }

          if (status.status === 'FAILED' || status.status === 'CANCELLED') {
            clearQueuePolling();
            setIsQueuePolling(false);
            setEnrollmentMessage('报名失败，请稍后重试。');
          }
        }, 4000);

        return;
      }

      setEnrollmentMessage('报名请求已提交，请稍后查看状态。');
    } catch (rawError) {
      const businessError = rawError as Partial<ApiBusinessError>;
      setEnrollmentMessage(
        businessError.response?.data?.message ?? '报名失败，请稍后重试。',
      );
    } finally {
      setIsSubmittingEnrollment(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
        <div className="relative h-[320px] bg-slate-100">
          {activity.coverUrl ? (
            <img src={activity.coverUrl} alt={activity.title} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-rose-100 via-white to-orange-100" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 to-black/10" />
          <div className="absolute bottom-0 left-0 right-0 p-6 lg:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-rose-100">
              {t(`categories.${activity.category}`)}
            </p>
            <h1 className="mt-2 text-3xl font-black leading-tight text-white lg:text-4xl">
              {activity.title}
            </h1>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <article className="space-y-6 rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
          <div className="grid gap-4 text-sm text-slate-600 md:grid-cols-2">
            <p className="flex items-center gap-2">
              <MapPin size={16} className="text-rose-500" />
              {activity.location}
            </p>
            <p className="flex items-center gap-2">
              <CalendarDays size={16} className="text-rose-500" />
              {formatLongDate(activity.activityAt)}
            </p>
            <p className="flex items-center gap-2">
              <Clock3 size={16} className="text-rose-500" />
              {t('activityDetail.enrollWindow')} {formatLongDate(activity.enrollOpenAt)} - {formatLongDate(activity.enrollCloseAt)}
            </p>
            <p className="flex items-center gap-2">
              <Users size={16} className="text-rose-500" />
              {t('activityDetail.enrolledCount', { count: activity.enrollCount })}
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black text-slate-900">{t('activityDetail.descriptionTitle')}</h2>
            <p className="mt-3 leading-8 text-slate-600">{activity.description}</p>
          </div>
        </article>

        <aside className="space-y-5 rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-slate-400">{t('activityDetail.ticketPrice')}</p>
            <p className="mt-2 text-4xl font-black text-rose-600">{formatCurrency(activity.price)}</p>
          </div>

          <div className="space-y-3 rounded-2xl bg-rose-50 p-4">
            <p className="text-sm font-semibold text-slate-500">{t('activityDetail.stockLabel')}</p>
            <p className={`text-2xl font-black ${stockMeta.textTone}`}>
              {Math.max(0, stockRemaining ?? activity.stockRemaining).toLocaleString()}
            </p>
            <div className="h-2 rounded-full bg-white">
              <div
                className={`h-2 rounded-full transition-all ${stockMeta.tone}`}
                style={{ width: `${Math.max(0, Math.min(100, stockMeta.percent))}%` }}
              />
            </div>
            <p className="text-xs text-slate-500">
              {t('activityDetail.capacityLabel', { count: activity.maxCapacity })}
            </p>
          </div>

          <div className="rounded-2xl border border-rose-100 bg-white p-4">
            <p className="text-sm font-semibold text-slate-500">
              {countdown.state === 'upcoming'
                ? t('activityDetail.countdownOpen')
                : countdown.state === 'selling'
                  ? t('activityDetail.countdownClose')
                  : t('activityDetail.countdownClosed')}
            </p>
            {countdown.state === 'closed' ? (
              <p className="mt-3 text-lg font-bold text-slate-700">{t('activityDetail.closed')}</p>
            ) : (
              <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                <div className="rounded-xl bg-slate-50 py-2">
                  <p className="text-lg font-black text-slate-900">{remain.days}</p>
                  <p className="text-[10px] text-slate-500">{t('activityDetail.day')}</p>
                </div>
                <div className="rounded-xl bg-slate-50 py-2">
                  <p className="text-lg font-black text-slate-900">{remain.hours}</p>
                  <p className="text-[10px] text-slate-500">{t('activityDetail.hour')}</p>
                </div>
                <div className="rounded-xl bg-slate-50 py-2">
                  <p className="text-lg font-black text-slate-900">{remain.minutes}</p>
                  <p className="text-[10px] text-slate-500">{t('activityDetail.minute')}</p>
                </div>
                <div className="rounded-xl bg-slate-50 py-2">
                  <p className="text-lg font-black text-slate-900">{remain.seconds}</p>
                  <p className="text-[10px] text-slate-500">{t('activityDetail.second')}</p>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleEnroll}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-rose-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={countdown.state !== 'selling' || isSubmittingEnrollment || isQueuePolling}
          >
            <Ticket size={16} />
            {countdown.state === 'selling'
              ? isSubmittingEnrollment
                ? '提交中...'
                : t('activityDetail.enrollNow')
              : t('activityDetail.enrollUnavailable')}
          </button>
          {enrollmentMessage ? (
            <p
              className={`rounded-xl border px-4 py-3 text-sm ${
                enrollmentMessage.includes('失败') || enrollmentMessage.includes('超时')
                  ? 'border-rose-200 bg-rose-50 text-rose-600'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700'
              }`}
            >
              {enrollmentMessage}
              {isQueuePolling ? '（轮询中）' : ''}
            </p>
          ) : null}
        </aside>
      </section>
    </div>
  );
}
