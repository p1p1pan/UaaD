import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MerchantForm } from '../components/MerchantForm';
import { createMerchantActivity } from '../api/endpoints';
import { MerchantPageHeader } from '../components/merchant/MerchantPageHeader';
import { getRequestErrorMessage } from '../utils/requestErrorMessage';

export default function MerchantActivityNewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  return (
    <div className="space-y-5">
      <MerchantPageHeader
        eyebrow={t('merchant.panel')}
        title={t('merchant.createActivity')}
        description={t('merchant.createSubtitle')}
        actions={
          <div className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-600">
            <PlusCircle size={16} />
            {t('merchant.createActivity')}
          </div>
        }
      />

      {submitError ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {submitError}
        </div>
      ) : null}

      <MerchantForm
        loading={loading}
        submitLabel={t('merchant.createSubmit')}
        onSubmit={async (payload) => {
          setSubmitError('');
          setLoading(true);
          try {
            const result = await createMerchantActivity(payload);
            navigate('/merchant/activities', {
              state: {
                feedback: {
                  tone: 'success',
                  title: t('merchant.successTitle'),
                  message: result.message || t('merchant.createSuccess'),
                },
              },
            });
          } catch (err) {
            setSubmitError(getRequestErrorMessage(err));
          } finally {
            setLoading(false);
          }
        }}
      />
    </div>
  );
}
