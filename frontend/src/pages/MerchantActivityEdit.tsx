import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MerchantForm } from '../components/MerchantForm';
import { getActivityDetail, updateMerchantActivity } from '../api/endpoints';
import type { MerchantActivityInput } from '../types';

export default function MerchantActivityEditPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const activityId = Number(id);
  const isValidActivityId = Number.isFinite(activityId);

  const [initialValue, setInitialValue] = useState<MerchantActivityInput | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isValidActivityId) {
      return;
    }

    getActivityDetail(activityId)
      .then((activity) => {
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
      })
      .finally(() => setLoading(false));
  }, [activityId, isValidActivityId]);

  if (!isValidActivityId) {
    return (
      <div className="rounded-3xl border border-amber-500/40 bg-amber-500/10 p-6 text-amber-100">
        {t('activityDetail.invalidId')}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-3xl font-black text-white">{t('merchant.editActivity')}</h2>
        <p className="mt-2 text-slate-300">{t('merchant.editSubtitle')}</p>
      </div>

      {loading || !initialValue ? (
        <div className="rounded-3xl border border-slate-700 bg-slate-900/50 p-8 text-slate-300">
          {t('merchant.loading')}
        </div>
      ) : (
        <MerchantForm
          initialValue={initialValue}
          loading={submitting}
          submitLabel={t('merchant.editSubmit')}
          onSubmit={async (payload) => {
            setSubmitting(true);
            await updateMerchantActivity(activityId, payload);
            setSubmitting(false);
            navigate('/merchant/activities', { state: { message: t('merchant.editSuccess') } });
          }}
        />
      )}
    </div>
  );
}
