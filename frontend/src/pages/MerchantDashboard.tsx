import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, CalendarRange, CircleDot, PlusCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { listMerchantActivities } from '../api/endpoints';
import type { ActivityListItem } from '../types';
import { getRequestErrorMessage } from '../utils/requestErrorMessage';

export default function MerchantDashboardPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<ActivityListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;

    listMerchantActivities()
      .then((data) => {
        if (!cancelled) {
          setLoadError('');
          setItems(data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(getRequestErrorMessage(err));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const total = items.length;
    const published = items.filter((item) => ['PUBLISHED', 'SELLING_OUT'].includes(item.status)).length;
    const draft = items.filter((item) => item.status === 'DRAFT' || item.status === 'PREHEAT').length;
    const enrollTotal = items.reduce((sum, item) => sum + item.enrollCount, 0);
    return { total, published, draft, enrollTotal };
  }, [items]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-white">{t('merchant.dashboard')}</h2>
          <p className="mt-2 text-slate-300">{t('merchant.dashboardSubtitle')}</p>
        </div>
        <Link
          to="/merchant/activities/new"
          className="inline-flex items-center gap-2 rounded-full bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-600"
        >
          <PlusCircle size={16} />
          {t('merchant.createActivity')}
        </Link>
      </div>

      {loadError ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {loadError}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
          <p className="text-sm text-slate-400">{t('merchant.stats.total')}</p>
          <p className="mt-2 text-3xl font-black text-white">{loading ? '-' : stats.total}</p>
        </div>
        <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
          <p className="text-sm text-slate-400">{t('merchant.stats.published')}</p>
          <p className="mt-2 text-3xl font-black text-emerald-300">{loading ? '-' : stats.published}</p>
        </div>
        <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
          <p className="text-sm text-slate-400">{t('merchant.stats.draft')}</p>
          <p className="mt-2 text-3xl font-black text-amber-300">{loading ? '-' : stats.draft}</p>
        </div>
        <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
          <p className="text-sm text-slate-400">{t('merchant.stats.enrollTotal')}</p>
          <p className="mt-2 text-3xl font-black text-rose-200">{loading ? '-' : stats.enrollTotal.toLocaleString()}</p>
        </div>
      </div>

      <section className="rounded-3xl border border-slate-700 bg-slate-900/50 p-6">
        <h3 className="mb-4 text-lg font-bold text-white">{t('merchant.recentActivities')}</h3>
        {loading ? (
          <p className="text-slate-400">{t('merchant.loading')}</p>
        ) : items.length === 0 ? (
          <p className="text-slate-400">{t('merchant.empty')}</p>
        ) : (
          <div className="space-y-3">
            {items.slice(0, 5).map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-700/60 bg-slate-950/40 p-4">
                <div>
                  <p className="font-semibold text-slate-100">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-400">{item.location}</p>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <BarChart3 size={14} />
                  {item.enrollCount.toLocaleString()}
                  <CircleDot size={12} className="text-rose-400" />
                  <CalendarRange size={14} />
                  {new Date(item.activityAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
