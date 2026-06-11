import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MerchantForm } from '../components/MerchantForm';
import { getActivityDetail, updateMerchantActivity } from '../api/endpoints';
import { MerchantPageHeader } from '../components/merchant/MerchantPageHeader';
import { MerchantStateCard } from '../components/merchant/MerchantStateCard';
import { StatusChip } from '../components/public/StatusChip';
import type { ActivityStatus, MerchantActivityInput } from '../types';
import { resolveApiErrorMessage } from '../utils/api';

export default function MerchantActivityEditPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const activityId = Number(id);
  const isValidActivityId = Number.isFinite(activityId);

  const [initialValue, setInitialValue] = useState<MerchantActivityInput | null>(null);
  const [activityStatus, setActivityStatus] = useState<ActivityStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState('');

  const loadActivity = useCallback(async () => {
    if (!isValidActivityId) {
      setLoadError(t('merchant.invalidIdDescription'));
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError('');

    try {
      const activity = await getActivityDetail(activityId);
      setInitialValue({
        title: activity.title,
        description: activity.description,
        coverUrl: activity.coverUrl ?? '',
        location: activity.location,
        category: activity.category,
        maxCapacity: activity.maxCapacity,
        price: activity.price,
        enrollOpenAt: activity.enrollOpenAt,
        enrollCloseAt: activity.enrollCloseAt,
        activityAt: activity.activityAt,
      });
      setActivityStatus(activity.status);
    } catch (error) {
      setLoadError(
        resolveApiErrorMessage(error, {
          fallback: t('merchant.editLoadFailed'),
          networkFallback: t('merchant.networkError'),
          notFoundFallback: t('merchant.invalidIdDescription'),
        }),
      );
    } finally {
      setLoading(false);
    }
  }, [activityId, isValidActivityId, t]);

  useEffect(() => {
    void loadActivity();
  }, [activityId, loadActivity]);

  return (
    <div className="space-y-5">
      <MerchantPageHeader
        eyebrow={t('merchant.panel')}
        title={t('merchant.editActivity')}
        description={t('merchant.editSubtitle')}
        actions={activityStatus ? <StatusChip status={activityStatus} theme="soft" /> : null}
      />

      {loading ? (
        <MerchantStateCard
          tone="loading"
          title={t('merchant.loadingTitle')}
          description={t('merchant.loadingDescription')}
        />
      ) : loadError ? (
        <MerchantStateCard
          tone="error"
          title={
            isValidActivityId ? t('merchant.editLoadFailedTitle') : t('merchant.invalidIdTitle')
          }
          description={loadError}
          action={
            <div className="flex flex-wrap justify-center gap-3">
              {isValidActivityId ? (
                <button
                  type="button"
                  onClick={() => void loadActivity()}
                  className="rounded-full bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-600"
                >
                  {t('merchant.retry')}
                </button>
              ) : null}
              <Link
                to="/merchant/activities"
                className="inline-flex items-center gap-2 rounded-full border border-rose-100 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-rose-200 hover:text-rose-600"
              >
                <ArrowLeft size={15} />
                {t('merchant.backToList')}
              </Link>
            </div>
          }
        />
      ) : !initialValue ? (
        <MerchantStateCard
          tone="empty"
          title={t('merchant.invalidIdTitle')}
          description={t('merchant.invalidIdDescription')}
          action={
            <Link
              to="/merchant/activities"
              className="inline-flex items-center gap-2 rounded-full border border-rose-100 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-rose-200 hover:text-rose-600"
            >
              <ArrowLeft size={15} />
              {t('merchant.backToList')}
            </Link>
          }
        />
      ) : (
        <MerchantForm
          initialValue={initialValue}
          activityStatus={activityStatus}
          loading={submitting}
          submitLabel={t('merchant.editSubmit')}
          onSubmit={async (payload) => {
            setSubmitting(true);
            try {
              const result = await updateMerchantActivity(activityId, payload);
              navigate('/merchant/activities', {
                state: {
                  feedback: {
                    tone: 'success',
                    title: t('merchant.successTitle'),
                    message: result.message || t('merchant.editSuccess'),
                  },
                },
              });
            } finally {
              setSubmitting(false);
            }
          }}
        />
      )}
    </div>
  );
}
