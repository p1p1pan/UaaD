import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, CalendarRange, CircleDot, PlusCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { listMerchantActivities } from '../api/endpoints';
import { MerchantNotice } from '../components/merchant/MerchantNotice';
import { MerchantPageHeader } from '../components/merchant/MerchantPageHeader';
import { MerchantStateCard } from '../components/merchant/MerchantStateCard';
import { StatusChip } from '../components/public/StatusChip';
import type { ActivityListItem } from '../types';
import { resolveApiErrorMessage } from '../utils/api';

export default function MerchantDashboardPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<ActivityListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const loadActivities = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const nextItems = await listMerchantActivities();
      setItems(nextItems);
    } catch (error) {
      setItems([]);
      setLoadError(
        resolveApiErrorMessage(error, {
          fallback: t('merchant.dashboardLoadFailed'),
          networkFallback: t('merchant.networkError'),
        }),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadActivities();
  }, [loadActivities]);

  const stats = useMemo(() => {
    const total = items.length;
    const published = items.filter((item) => ['PUBLISHED', 'SELLING_OUT'].includes(item.status)).length;
    const draft = items.filter((item) => item.status === 'DRAFT' || item.status === 'PREHEAT').length;
    const enrollTotal = items.reduce((sum, item) => sum + item.enrollCount, 0);
    return { total, published, draft, enrollTotal };
  }, [items]);

  return (
    <div className="space-y-6">
      <MerchantPageHeader
        eyebrow={t('merchant.panel')}
        title={t('merchant.dashboard')}
        description={t('merchant.dashboardSubtitle')}
        actions={
          <Link
            to="/merchant/activities/new"
            className="inline-flex items-center gap-2 rounded-full bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-600"
          >
            <PlusCircle size={16} />
            {t('merchant.createActivity')}
          </Link>
        }
      />

      {loadError ? (
        <MerchantNotice
          tone="error"
          title={t('merchant.dashboardLoadFailedTitle')}
          message={loadError}
          action={
            <button
              type="button"
              onClick={() => void loadActivities()}
              className="rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-rose-300 hover:text-rose-600"
            >
              {t('merchant.retry')}
            </button>
          }
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-rose-100 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-400">{t('merchant.stats.total')}</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{loading ? '-' : stats.total}</p>
        </div>
        <div className="rounded-2xl border border-rose-100 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-400">{t('merchant.stats.published')}</p>
          <p className="mt-2 text-3xl font-black text-emerald-600">{loading ? '-' : stats.published}</p>
        </div>
        <div className="rounded-2xl border border-rose-100 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-400">{t('merchant.stats.draft')}</p>
          <p className="mt-2 text-3xl font-black text-amber-600">{loading ? '-' : stats.draft}</p>
        </div>
        <div className="rounded-2xl border border-rose-100 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-400">{t('merchant.stats.enrollTotal')}</p>
          <p className="mt-2 text-3xl font-black text-rose-600">{loading ? '-' : stats.enrollTotal.toLocaleString()}</p>
        </div>
      </div>

      <section className="rounded-3xl border border-rose-100 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-bold text-slate-900">{t('merchant.recentActivities')}</h3>
        {loading ? (
          <MerchantStateCard
            compact
            tone="loading"
            title={t('merchant.loadingTitle')}
            description={t('merchant.loadingDescription')}
          />
        ) : items.length === 0 ? (
          <MerchantStateCard
            compact
            tone="empty"
            title={t('merchant.empty')}
            description={t('merchant.emptyDescription')}
            action={
              <Link
                to="/merchant/activities/new"
                className="inline-flex items-center gap-2 rounded-full bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-600"
              >
                <PlusCircle size={15} />
                {t('merchant.createActivity')}
              </Link>
            }
          />
        ) : (
          <div className="space-y-3">
            {items.slice(0, 5).map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-[#fffaf7] p-4">
                <div>
                  <p className="font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-500">{item.location}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                  <StatusChip status={item.status} theme="soft" />
                  <span className="inline-flex items-center gap-2">
                    <BarChart3 size={14} />
                    {item.enrollCount.toLocaleString()}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <CircleDot size={12} className="text-rose-400" />
                    <CalendarRange size={14} />
                    {new Date(item.activityAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
