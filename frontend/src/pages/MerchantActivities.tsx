import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PenLine, Rocket, PlusCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { listMerchantActivities, publishMerchantActivity } from '../api/endpoints';
import type { ActivityListItem } from '../types';
import { formatCurrency } from '../utils/formatters';

export default function MerchantActivitiesPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const [items, setItems] = useState<ActivityListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishingId, setPublishingId] = useState<number | null>(null);
  const banner = useMemo(() => (location.state as { message?: string } | null)?.message ?? '', [location.state]);

  const fetchItems = () =>
    listMerchantActivities()
      .then(setItems)
      .finally(() => setLoading(false));

  const load = () => {
    setLoading(true);
    void fetchItems();
  };

  useEffect(() => {
    void fetchItems();
  }, []);

  const canPublish = (status: ActivityListItem['status']) => status === 'DRAFT' || status === 'PREHEAT';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-white">{t('merchant.activityList')}</h2>
          <p className="mt-2 text-slate-300">{t('merchant.listSubtitle')}</p>
        </div>
        <Link
          to="/merchant/activities/new"
          className="inline-flex items-center gap-2 rounded-full bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-600"
        >
          <PlusCircle size={16} />
          {t('merchant.createActivity')}
        </Link>
      </div>

      {banner ? (
        <div className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {banner}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-3xl border border-slate-700 bg-slate-900/50">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-950/50 text-slate-400">
            <tr>
              <th className="px-5 py-4">{t('merchant.table.activity')}</th>
              <th className="px-5 py-4">{t('merchant.table.status')}</th>
              <th className="px-5 py-4">{t('merchant.table.price')}</th>
              <th className="px-5 py-4">{t('merchant.table.enroll')}</th>
              <th className="px-5 py-4">{t('merchant.table.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                  {t('merchant.loading')}
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                  {t('merchant.empty')}
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-t border-slate-700/70 text-slate-200">
                  <td className="px-5 py-4">
                    <p className="font-semibold">{item.title}</p>
                    <p className="mt-1 text-xs text-slate-400">{item.location}</p>
                  </td>
                  <td className="px-5 py-4">{t(`status.${item.status}`)}</td>
                  <td className="px-5 py-4">{formatCurrency(item.price)}</td>
                  <td className="px-5 py-4">{item.enrollCount.toLocaleString()}</td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        to={`/merchant/activities/${item.id}/edit`}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-rose-400 hover:text-rose-200"
                      >
                        <PenLine size={12} />
                        {t('merchant.edit')}
                      </Link>
                      <button
                        type="button"
                        disabled={!canPublish(item.status) || publishingId === item.id}
                        onClick={async () => {
                          setPublishingId(item.id);
                          await publishMerchantActivity(item.id).catch(() => undefined);
                          setPublishingId(null);
                          load();
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Rocket size={12} />
                        {t('merchant.publish')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
