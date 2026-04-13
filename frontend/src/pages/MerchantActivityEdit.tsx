import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MerchantForm } from '../components/MerchantForm';
import { getActivityDetail, updateMerchantActivity } from '../api/endpoints';
import type { MerchantActivityInput } from '../types';
import { getRequestErrorMessage } from '../utils/requestErrorMessage';

export default function MerchantActivityEditPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const activityId = Number(id);
  const isActivityIdValid = Number.isFinite(activityId);

  const [initialValue, setInitialValue] = useState<MerchantActivityInput | null>(null);
  const [loading, setLoading] = useState(isActivityIdValid);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!isActivityIdValid) {
      return;
    }

    let cancelled = false;

    setLoadError('');
    getActivityDetail(activityId)
      .then((activity) => {
        if (cancelled) {
          return;
        }
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
  }, [activityId, isActivityIdValid]);

  if (!isActivityIdValid) {
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

      {loadError ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {loadError}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-3xl border border-slate-700 bg-slate-900/50 p-8 text-slate-300">
          {t('merchant.loading')}
        </div>
      ) : initialValue ? (
        <>
          {submitError ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {submitError}
            </div>
          ) : null}
          <MerchantForm
            initialValue={initialValue}
            loading={submitting}
            submitLabel={t('merchant.editSubmit')}
            onSubmit={async (payload) => {
              setSubmitError('');
              setSubmitting(true);
              try {
                await updateMerchantActivity(activityId, payload);
                navigate('/merchant/activities', { state: { message: t('merchant.editSuccess') } });
              } catch (err) {
                setSubmitError(getRequestErrorMessage(err));
              } finally {
                setSubmitting(false);
              }
            }}
          />
        </>
      ) : null}
    </div>
  );
}
