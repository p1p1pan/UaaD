import { isAxiosError } from 'axios';
import {
  BellRing,
  CalendarDays,
  Clock3,
  ExternalLink,
  Loader2,
  MapPin,
  RefreshCcw,
  Ticket,
  TriangleAlert,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ActivityCountdown from '../components/ActivityCountdown';
import { StatusChip } from '../components/public/StatusChip';
import {
  createEnrollment,
  findOrderByOrderNo,
  getActivityDetail,
  getActivityStock,
  trackBehavior,
} from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import type { ActivityDetail as ActivityDetailModel, ActivityStockSnapshot } from '../types';
import { hasActivityReminder, saveActivityReminder } from '../utils/activityReminderState';
import {
  resolveActivityCountdownState,
  type ActivityCountdownPhase,
} from '../utils/activityCountdown';
import { buildLoginPath } from '../utils/auth';
import { formatCurrency, formatLongDate } from '../utils/formatters';

type DetailViewState = 'loading' | 'success' | 'empty' | 'error';
type EnrollActionState = 'upcoming' | 'selling' | 'soldOut' | 'closed' | 'unavailable';
type StockState = 'ample' | 'tight' | 'soldOut';

interface StatePanelProps {
  title: string;
  description: string;
  icon: LucideIcon;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
}

interface DetailMetricProps {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  helper?: string;
}

interface HeroFactProps {
  icon: LucideIcon;
  label: string;
  value: string;
}

interface StockMeta {
  state: StockState;
  percent: number;
  tone: string;
  textTone: string;
  badgeTone: string;
  labelKey: string;
  helperKey: string;
}

function StatePanel({
  title,
  description,
  icon: Icon,
  primaryAction,
  secondaryAction,
}: StatePanelProps) {
  return (
    <div className="mx-auto flex min-h-[56vh] max-w-3xl flex-col items-center justify-center px-4 py-10 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-rose-500">
        <Icon size={28} />
      </div>
      <h1 className="mt-6 text-3xl font-black text-slate-900">{title}</h1>
      <p className="mt-3 max-w-xl text-sm leading-7 text-slate-500">{description}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        {primaryAction}
        {secondaryAction}
      </div>
    </div>
  );
}

function ActivityDetailSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <section className="overflow-hidden rounded-[36px] border border-slate-200 bg-white shadow-sm">
        <div className="h-[360px] animate-pulse bg-gradient-to-br from-rose-100 via-orange-50 to-white" />
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <article className="space-y-6 rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-28 animate-pulse rounded-[28px] bg-slate-100"
              />
            ))}
          </div>
          <div className="space-y-3">
            <div className="h-7 w-40 animate-pulse rounded-full bg-slate-100" />
            <div className="h-4 w-full animate-pulse rounded-full bg-slate-100" />
            <div className="h-4 w-11/12 animate-pulse rounded-full bg-slate-100" />
            <div className="h-4 w-8/12 animate-pulse rounded-full bg-slate-100" />
          </div>
        </article>

        <aside className="space-y-5 rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="h-40 animate-pulse rounded-[28px] bg-slate-100" />
          <div className="h-44 animate-pulse rounded-[28px] bg-slate-100" />
          <div className="h-40 animate-pulse rounded-[28px] bg-slate-100" />
        </aside>
      </section>
    </div>
  );
}

function DetailMetric({ icon: Icon, label, value, helper }: DetailMetricProps) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-slate-50/80 p-5">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-rose-500 shadow-sm">
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            {label}
          </p>
          <div className="mt-2 text-sm font-semibold leading-6 text-slate-900">{value}</div>
          {helper ? <p className="mt-2 text-xs leading-6 text-slate-500">{helper}</p> : null}
        </div>
      </div>
    </div>
  );
}

function HeroFact({ icon: Icon, label, value }: HeroFactProps) {
  return (
    <div className="rounded-[24px] border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-rose-100">
          <Icon size={16} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
            {label}
          </p>
          <p className="mt-1 text-sm font-semibold leading-6 text-white">{value}</p>
        </div>
      </div>
    </div>
  );
}

function getStockMeta(activity: ActivityDetailModel, currentStock: number): StockMeta {
  const percent =
    activity.maxCapacity > 0
      ? Math.round((Math.max(0, currentStock) / activity.maxCapacity) * 100)
      : 0;

  if (currentStock <= 0 || activity.status === 'SOLD_OUT') {
    return {
      state: 'soldOut',
      percent: 0,
      tone: 'bg-slate-300',
      textTone: 'text-slate-500',
      badgeTone: 'bg-slate-200 text-slate-600',
      labelKey: 'activityDetail.stockStateSoldOut',
      helperKey: 'activityDetail.stockHintSoldOut',
    };
  }

  if (activity.status === 'SELLING_OUT' || percent <= 35) {
    return {
      state: 'tight',
      percent,
      tone: 'bg-amber-500',
      textTone: 'text-amber-600',
      badgeTone: 'bg-amber-100 text-amber-700',
      labelKey: 'activityDetail.stockStateTight',
      helperKey: 'activityDetail.stockHintTight',
    };
  }

  return {
    state: 'ample',
    percent,
    tone: 'bg-emerald-500',
    textTone: 'text-emerald-600',
    badgeTone: 'bg-emerald-100 text-emerald-700',
    labelKey: 'activityDetail.stockStateAmple',
    helperKey: 'activityDetail.stockHintAmple',
  };
}

function getEnrollActionState(
  activity: ActivityDetailModel,
  countdownPhase: ActivityCountdownPhase,
): EnrollActionState {
  if (
    activity.status === 'DRAFT' ||
    activity.status === 'OFFLINE' ||
    activity.status === 'CANCELLED'
  ) {
    return 'unavailable';
  }

  if (countdownPhase === 'upcoming') {
    return 'upcoming';
  }

  if (countdownPhase === 'soldOut') {
    return 'soldOut';
  }

  if (countdownPhase === 'closed') {
    return 'closed';
  }

  return 'selling';
}

function buildMapModel(activity: ActivityDetailModel | null) {
  if (!activity) {
    return {
      hasCoordinates: false,
      openUrl: '',
      embedUrl: null,
      latitudeLabel: null,
      longitudeLabel: null,
    };
  }

  const hasCoordinates =
    typeof activity.latitude === 'number' && typeof activity.longitude === 'number';

  if (!hasCoordinates) {
    return {
      hasCoordinates: false,
      openUrl: `https://www.openstreetmap.org/search?query=${encodeURIComponent(activity.location)}`,
      embedUrl: null,
      latitudeLabel: null,
      longitudeLabel: null,
    };
  }

  const latitude = Number(activity.latitude);
  const longitude = Number(activity.longitude);
  const delta = 0.03;
  const bbox = [
    (longitude - delta).toFixed(5),
    (latitude - delta).toFixed(5),
    (longitude + delta).toFixed(5),
    (latitude + delta).toFixed(5),
  ].join('%2C');

  return {
    hasCoordinates: true,
    openUrl: `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=15/${latitude}/${longitude}`,
    embedUrl: `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude}%2C${longitude}`,
    latitudeLabel: latitude.toFixed(4),
    longitudeLabel: longitude.toFixed(4),
  };
}

export default function ActivityDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, session } = useAuth();
  const { id } = useParams();
  const activityId = Number(id);
  const hasValidActivityId = Number.isFinite(activityId) && activityId > 0;

  const [viewState, setViewState] = useState<DetailViewState>('loading');
  const [activity, setActivity] = useState<ActivityDetailModel | null>(null);
  const [stockSnapshot, setStockSnapshot] = useState<ActivityStockSnapshot | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [reloadSeed, setReloadSeed] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReminderSet, setIsReminderSet] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);
  const reportedViewsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!hasValidActivityId) {
      setViewState('empty');
      setActivity(null);
      setStockSnapshot(null);
      setErrorMessage('');
      return;
    }

    let active = true;

    async function loadActivity() {
      try {
        setViewState('loading');
        setErrorMessage('');

        const detail = await getActivityDetail(activityId);
        if (!active) {
          return;
        }

        setActivity(detail);
        setStockSnapshot({
          activityId: detail.id,
          stockRemaining: detail.stockRemaining,
          maxCapacity: detail.maxCapacity,
        });
        setViewState('success');

        const stock = await getActivityStock(activityId).catch(() => null);
        if (!active || !stock) {
          return;
        }

        setStockSnapshot(stock);
      } catch (error) {
        if (!active) {
          return;
        }

        setActivity(null);
        setStockSnapshot(null);

        if (isAxiosError(error) && error.response?.status === 404) {
          setViewState('empty');
          return;
        }

        setErrorMessage(t('activityDetail.loadError'));
        setViewState('error');
      }
    }

    void loadActivity();

    return () => {
      active = false;
    };
  }, [activityId, hasValidActivityId, reloadSeed, t]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [activityId]);

  useEffect(() => {
    setIsReminderSet(hasActivityReminder(session?.userId ?? undefined, activityId));
  }, [activityId, session?.userId]);

  useEffect(() => {
    if (viewState !== 'success' || !activity || !isAuthenticated || !session?.userId) {
      return;
    }

    const reportKey = `${session.userId}:${activity.id}`;
    if (reportedViewsRef.current.has(reportKey)) {
      return;
    }

    reportedViewsRef.current.add(reportKey);
    trackBehavior(
      {
        activityId: activity.id,
        behaviorType: 'VIEW',
        detail: {
          source: 'activity_detail_page',
          path: location.pathname,
        },
      },
      { immediate: true, timeoutMs: 1000 },
    );
  }, [activity, isAuthenticated, location.pathname, session?.userId, viewState]);

  const currentStock = activity
    ? Math.max(0, stockSnapshot?.stockRemaining ?? activity.stockRemaining)
    : 0;
  const isSoldOut = activity ? currentStock <= 0 || activity.status === 'SOLD_OUT' : false;
  const countdown = activity
    ? resolveActivityCountdownState({
        enrollOpenAt: activity.enrollOpenAt,
        enrollCloseAt: activity.enrollCloseAt,
        soldOut: isSoldOut,
      })
    : null;
  const stockMeta = activity ? getStockMeta(activity, currentStock) : null;
  const enrollActionState =
    activity && countdown ? getEnrollActionState(activity, countdown.phase) : null;
  const stockPollInterval =
    countdown?.phase === 'upcoming'
      ? 30000
      : countdown?.phase === 'selling'
        ? 8000
        : countdown?.phase === 'soldOut'
          ? 20000
          : null;

  useEffect(() => {
    if (!activity || !stockPollInterval) {
      return;
    }

    let active = true;

    const timer = window.setInterval(async () => {
      const stock = await getActivityStock(activity.id).catch(() => null);
      if (!active || !stock) {
        return;
      }

      setStockSnapshot(stock);
    }, stockPollInterval);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [activity, stockPollInterval]);

  const mapModel = useMemo(() => buildMapModel(activity), [activity]);

  const handleAuthRedirect = () => {
    const redirectTo = `${location.pathname}${location.search}${location.hash}`;
    navigate(buildLoginPath({ redirectTo }), {
      state: {
        from: {
          pathname: location.pathname,
          search: location.search,
          hash: location.hash,
        },
      },
    });
  };

  const handlePrimaryAction = async () => {
    if (!activity || !enrollActionState) {
      return;
    }

    setActionFeedback(null);

    if (enrollActionState === 'upcoming') {
      if (!isAuthenticated) {
        handleAuthRedirect();
        return;
      }

      const created = saveActivityReminder(session?.userId ?? undefined, {
        activityId: activity.id,
        title: activity.title,
        openAt: activity.enrollOpenAt,
      });

      setIsReminderSet(true);
      setActionFeedback({
        tone: 'success',
        message: created
          ? t('activityDetail.reminderSaved', { time: formatLongDate(activity.enrollOpenAt) })
          : t('activityDetail.reminderExists'),
      });
      return;
    }

    if (enrollActionState !== 'selling') {
      return;
    }

    if (!isAuthenticated) {
      handleAuthRedirect();
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createEnrollment(activity.id);

      if (typeof result.stockRemaining === 'number') {
        setStockSnapshot((current) =>
          current
            ? {
                ...current,
                stockRemaining: result.stockRemaining ?? current.stockRemaining,
              }
            : current,
        );
      }

      if (result.code === 1101) {
        setActionFeedback({
          tone: 'error',
          message: result.message,
        });

        const stock = await getActivityStock(activity.id).catch(() => null);
        if (stock) {
          setStockSnapshot(stock);
        }
        return;
      }

      if (result.orderNo) {
        const order = await findOrderByOrderNo(result.orderNo).catch(() => null);
        if (order) {
          navigate(`/orders/${order.id}`, {
            state: { activityTitle: activity.title },
          });
          return;
        }
      }

      if (result.enrollmentId) {
        navigate(`/enroll-status/${result.enrollmentId}`, {
          state: { activityTitle: activity.title },
        });
        return;
      }

      setActionFeedback({
        tone: 'success',
        message: t('activityDetail.enrollSubmitted'),
      });
    } catch (error) {
      const errorWithResponse = error as { response?: { data?: { message?: string } } };
      setActionFeedback({
        tone: 'error',
        message: errorWithResponse.response?.data?.message || t('activityDetail.enrollError'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (viewState === 'loading') {
    return <ActivityDetailSkeleton />;
  }

  if (!hasValidActivityId) {
    return (
      <StatePanel
        icon={Ticket}
        title={t('activityDetail.emptyTitle')}
        description={t('activityDetail.invalidDescription')}
        primaryAction={
          <Link
            to="/activities"
            className="rounded-full bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-600"
          >
            {t('activityDetail.backToList')}
          </Link>
        }
      />
    );
  }

  if (viewState === 'empty') {
    return (
      <StatePanel
        icon={Ticket}
        title={t('activityDetail.emptyTitle')}
        description={t('activityDetail.emptyDescription')}
        primaryAction={
          <Link
            to="/activities"
            className="rounded-full bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-600"
          >
            {t('activityDetail.backToList')}
          </Link>
        }
      />
    );
  }

  if (viewState === 'error' || !activity || !countdown || !stockMeta || !enrollActionState) {
    return (
      <StatePanel
        icon={TriangleAlert}
        title={t('activityDetail.errorTitle')}
        description={errorMessage || t('activityDetail.errorDescription')}
        primaryAction={
          <button
            type="button"
            onClick={() => setReloadSeed((value) => value + 1)}
            className="inline-flex items-center gap-2 rounded-full bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-600"
          >
            <RefreshCcw size={16} />
            {t('activityDetail.retry')}
          </button>
        }
        secondaryAction={
          <Link
            to="/activities"
            className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
          >
            {t('activityDetail.backToList')}
          </Link>
        }
      />
    );
  }

  const actionHeading =
    enrollActionState === 'upcoming'
      ? t('activityDetail.actionUpcoming')
      : enrollActionState === 'selling'
        ? t('activityDetail.enrollNow')
        : enrollActionState === 'soldOut'
          ? t('activityDetail.actionSoldOut')
          : enrollActionState === 'closed'
            ? t('activityDetail.actionClosed')
            : t('activityDetail.actionUnavailable');

  const actionDescription =
    enrollActionState === 'upcoming'
      ? isReminderSet
        ? t('activityDetail.reminderSavedHint')
        : isAuthenticated
          ? t('activityDetail.reminderHintReady')
          : t('activityDetail.reminderHint')
      : enrollActionState === 'selling'
        ? isAuthenticated
          ? t('activityDetail.paymentHint')
          : t('activityDetail.loginHint')
        : enrollActionState === 'soldOut'
          ? t('activityDetail.soldOutHint')
          : enrollActionState === 'closed'
            ? t('activityDetail.closedHint')
            : t('activityDetail.actionUnavailableHint', {
                status: t(`status.${activity.status}`),
              });

  const actionButtonLabel =
    enrollActionState === 'upcoming'
      ? isReminderSet
        ? t('activityDetail.reminderSet')
        : t('activityDetail.remindMe')
      : enrollActionState === 'selling'
        ? t('activityDetail.enrollNow')
        : enrollActionState === 'soldOut'
          ? t('activityDetail.soldOut')
          : t('activityDetail.enrollUnavailable');

  const actionButtonClassName =
    enrollActionState === 'selling'
      ? 'bg-rose-500 text-white hover:bg-rose-600'
      : enrollActionState === 'upcoming'
        ? isReminderSet
          ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'bg-slate-900 text-white hover:bg-slate-800'
        : 'border border-slate-200 bg-slate-100 text-slate-400';

  const pollingHint =
    stockPollInterval === 8000
      ? t('activityDetail.pollingSelling')
      : stockPollInterval === 30000
        ? t('activityDetail.pollingUpcoming')
        : stockPollInterval === 20000
          ? t('activityDetail.pollingSoldOut')
          : t('activityDetail.pollingStopped');

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <section className="overflow-hidden rounded-[36px] border border-slate-200 bg-white shadow-sm">
        <div className="relative min-h-[360px] bg-slate-100">
          {activity.coverUrl ? (
            <img
              src={activity.coverUrl}
              alt={activity.title}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(251,113,133,0.32),_transparent_36%),linear-gradient(135deg,_#fff1f2_0%,_#fff7ed_45%,_#ffffff_100%)]" />
          )}

          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-950/60 to-slate-950/20" />

          <div className="relative flex min-h-[360px] flex-col justify-end gap-6 p-6 lg:p-10">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center rounded-full bg-white/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/90 backdrop-blur-sm">
                {t(`categories.${activity.category}`)}
              </span>
              <StatusChip status={activity.status} />
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${stockMeta.badgeTone}`}
              >
                {t(stockMeta.labelKey)}
              </span>
            </div>

            <div className="max-w-3xl">
              <h1 className="text-3xl font-black leading-tight text-white lg:text-5xl">
                {activity.title}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/78 lg:text-base">
                {activity.description.trim() || t('activityDetail.heroSummaryFallback')}
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <HeroFact
                icon={MapPin}
                label={t('activityDetail.venue')}
                value={activity.location}
              />
              <HeroFact
                icon={CalendarDays}
                label={t('activityDetail.activityTime')}
                value={formatLongDate(activity.activityAt)}
              />
              <HeroFact
                icon={Clock3}
                label={t('activityDetail.registrationWindow')}
                value={`${formatLongDate(activity.enrollOpenAt)} - ${formatLongDate(activity.enrollCloseAt)}`}
              />
              <HeroFact
                icon={Ticket}
                label={t('activityDetail.ticketPrice')}
                value={formatCurrency(activity.price)}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <article className="space-y-6 rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
          <div className="grid gap-4 md:grid-cols-2">
            <DetailMetric
              icon={MapPin}
              label={t('activityDetail.venue')}
              value={activity.location}
            />
            <DetailMetric
              icon={CalendarDays}
              label={t('activityDetail.activityTime')}
              value={formatLongDate(activity.activityAt)}
            />
            <DetailMetric
              icon={Clock3}
              label={t('activityDetail.registrationWindow')}
              value={`${formatLongDate(activity.enrollOpenAt)} - ${formatLongDate(activity.enrollCloseAt)}`}
            />
            <DetailMetric
              icon={Ticket}
              label={t('activityDetail.ticketPrice')}
              value={formatCurrency(activity.price)}
            />
            <DetailMetric
              icon={Users}
              label={t('activityDetail.enrollment')}
              value={t('activityDetail.enrolledCount', {
                count: activity.enrollCount.toLocaleString(),
              })}
              helper={t('activityDetail.capacityLabel', {
                count: activity.maxCapacity.toLocaleString(),
              })}
            />
            <DetailMetric
              icon={Users}
              label={t('activityDetail.organizer')}
              value={activity.organizerName || t('activityDetail.organizerFallback')}
            />
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-6">
            <h2 className="text-xl font-black text-slate-900">
              {t('activityDetail.descriptionTitle')}
            </h2>
            <p className="mt-4 text-sm leading-8 text-slate-600 lg:text-base">
              {activity.description.trim() || t('activityDetail.descriptionFallback')}
            </p>

            {activity.tags.length > 0 ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {activity.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-rose-100 bg-white px-3 py-1 text-xs font-semibold text-rose-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <section id="activity-location" className="space-y-4 border-t border-slate-100 pt-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <h2 className="text-xl font-black text-slate-900">
                  {t('activityDetail.locationTitle')}
                </h2>
                <p className="mt-3 leading-8 text-slate-600">{activity.location}</p>
                <p className="mt-2 text-sm leading-7 text-slate-500">
                  {t('activityDetail.locationDescription')}
                </p>
                {mapModel.hasCoordinates ? (
                  <p className="mt-2 text-sm text-slate-400">
                    {t('activityDetail.latitude')}: {mapModel.latitudeLabel}
                    {' · '}
                    {t('activityDetail.longitude')}: {mapModel.longitudeLabel}
                  </p>
                ) : null}
              </div>

              <a
                href={mapModel.openUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-rose-200 hover:text-rose-600"
              >
                {t('activityDetail.openMap')}
                <ExternalLink size={14} />
              </a>
            </div>

            {mapModel.embedUrl ? (
              <div className="overflow-hidden rounded-[24px] border border-slate-200">
                <iframe
                  title={t('activityDetail.mapFrameTitle', { location: activity.location })}
                  src={mapModel.embedUrl}
                  className="h-[320px] w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-slate-200 px-5 py-8 text-center text-sm leading-7 text-slate-500">
                {t('activityDetail.mapUnavailable')}
              </div>
            )}
          </section>
        </article>

        <aside className="space-y-5">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">
              {t('activityDetail.ticketPrice')}
            </p>
            <p className="mt-2 text-4xl font-black text-rose-600">
              {formatCurrency(activity.price)}
            </p>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-500">
                  {t('activityDetail.stockLabel')}
                </p>
                <p className={`mt-2 text-3xl font-black ${stockMeta.textTone}`}>
                  {currentStock.toLocaleString()}
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${stockMeta.badgeTone}`}>
                {t(stockMeta.labelKey)}
              </span>
            </div>

            <div className="mt-4 h-2 rounded-full bg-slate-100">
              <div
                className={`h-2 rounded-full transition-all ${stockMeta.tone}`}
                style={{ width: `${Math.max(0, Math.min(100, stockMeta.percent))}%` }}
              />
            </div>

            <p className="mt-3 text-xs leading-6 text-slate-500">
              {t(stockMeta.helperKey)}
            </p>
            <p className="mt-2 text-xs leading-6 text-slate-400">
              {stockSnapshot?.lastUpdated
                ? t('activityDetail.stockUpdated', {
                    time: formatLongDate(stockSnapshot.lastUpdated),
                  })
                : t('activityDetail.stockPendingSync')}
            </p>
          </div>

          <ActivityCountdown
            enrollOpenAt={activity.enrollOpenAt}
            enrollCloseAt={activity.enrollCloseAt}
            soldOut={isSoldOut}
          />

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              {t('activityDetail.actionTitle')}
            </p>
            <h2 className="mt-3 text-xl font-black text-slate-900">{actionHeading}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-500">{actionDescription}</p>

            {actionFeedback ? (
              <div
                className={`mt-4 rounded-2xl px-4 py-3 text-sm ${
                  actionFeedback.tone === 'success'
                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border border-amber-200 bg-amber-50 text-amber-700'
                }`}
              >
                {actionFeedback.message}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => void handlePrimaryAction()}
              disabled={isSubmitting || enrollActionState === 'soldOut' || enrollActionState === 'closed' || enrollActionState === 'unavailable'}
              className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${actionButtonClassName}`}
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
              <span>{isSubmitting ? t('activityDetail.processingAction') : actionButtonLabel}</span>
            </button>

            <p className="mt-3 text-xs leading-6 text-slate-400">{pollingHint}</p>

            {enrollActionState === 'upcoming' ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 text-sm text-slate-600">
                <div className="flex items-start gap-3">
                  <BellRing size={16} className="mt-0.5 shrink-0 text-rose-500" />
                  <p>{t('activityDetail.reminderPanelHint')}</p>
                </div>
              </div>
            ) : null}
          </div>
        </aside>
      </section>
    </div>
  );
}
