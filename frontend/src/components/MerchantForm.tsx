import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ActivityCategory, ActivityStatus, MerchantActivityInput } from '../types';
import { CATEGORY_OPTIONS } from '../constants/public';
import { resolveApiErrorMessage } from '../utils/api';
import { MerchantNotice } from './merchant/MerchantNotice';

interface MerchantFormProps {
  initialValue?: MerchantActivityInput;
  activityStatus?: ActivityStatus | null;
  submitLabel: string;
  loading?: boolean;
  onSubmit: (payload: MerchantActivityInput) => Promise<void>;
}

const defaultValue: MerchantActivityInput = {
  title: '',
  description: '',
  coverUrl: '',
  location: '',
  category: 'CONCERT',
  maxCapacity: 1000,
  price: 0,
  enrollOpenAt: '',
  enrollCloseAt: '',
  activityAt: '',
};

type MerchantFormField = keyof MerchantActivityInput | 'form';
type MerchantFormErrors = Record<MerchantFormField, string>;

function createEmptyErrors(): MerchantFormErrors {
  return {
    title: '',
    description: '',
    coverUrl: '',
    location: '',
    category: '',
    maxCapacity: '',
    price: '',
    enrollOpenAt: '',
    enrollCloseAt: '',
    activityAt: '',
    form: '',
  };
}

function toDatetimeLocal(iso: string) {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function fromDatetimeLocal(value: string) {
  if (!value) {
    return '';
  }
  return new Date(value).toISOString();
}

function hasTwoOrFewerDecimals(value: number) {
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-8;
}

function isPublishLocked(status?: ActivityStatus | null) {
  return Boolean(status && !['DRAFT', 'PREHEAT'].includes(status));
}

export function MerchantForm({
  initialValue,
  activityStatus,
  submitLabel,
  loading,
  onSubmit,
}: MerchantFormProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<MerchantActivityInput>({
    ...defaultValue,
    ...initialValue,
  });
  const [errors, setErrors] = useState<MerchantFormErrors>(() => createEmptyErrors());
  const [formError, setFormError] = useState('');
  const lockImmutableFields = isPublishLocked(activityStatus);

  const categoryOptions = useMemo(
    () =>
      CATEGORY_OPTIONS.filter((item) => item.value !== 'ALL').map((item) => ({
        value: item.value as ActivityCategory,
        label: t(`categories.${item.value}`),
      })),
    [t],
  );

  const updateField = <K extends keyof MerchantActivityInput>(field: K, value: MerchantActivityInput[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '', form: '' }));
    if (formError) {
      setFormError('');
    }
  };

  const hasFieldError = (field: keyof MerchantActivityInput) => Boolean(errors[field]);
  const renderFieldError = (field: keyof MerchantActivityInput) =>
    errors[field] ? <p className="text-sm text-red-600">{errors[field]}</p> : null;

  const getInputClass = (field: keyof MerchantActivityInput) =>
    `w-full rounded-2xl border bg-white px-4 py-3 text-sm text-slate-700 outline-none transition ${
      hasFieldError(field)
        ? 'border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100'
        : 'border-slate-200 focus:border-rose-300 focus:ring-2 focus:ring-rose-100'
    } disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400`;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = createEmptyErrors();
    setErrors(nextErrors);
    setFormError('');

    const title = form.title.trim();
    const description = form.description.trim();
    const location = form.location.trim();
    const coverUrl = form.coverUrl?.trim() ?? '';

    const openAt = new Date(form.enrollOpenAt).getTime();
    const closeAt = new Date(form.enrollCloseAt).getTime();
    const activityAt = new Date(form.activityAt).getTime();

    if (!title) {
      nextErrors.title = t('merchant.form.titleRequired');
    }

    if (!description) {
      nextErrors.description = t('merchant.form.descriptionRequired');
    }

    if (!location) {
      nextErrors.location = t('merchant.form.locationRequired');
    }

    if (!Number.isInteger(form.maxCapacity) || form.maxCapacity <= 0) {
      nextErrors.maxCapacity = t('merchant.form.capacityInvalid');
    }

    if (!Number.isFinite(form.price) || form.price < 0 || !hasTwoOrFewerDecimals(form.price)) {
      nextErrors.price = t('merchant.form.priceInvalid');
    }

    if (coverUrl) {
      try {
        const parsed = new URL(coverUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          nextErrors.coverUrl = t('merchant.form.coverUrlInvalid');
        }
      } catch {
        nextErrors.coverUrl = t('merchant.form.coverUrlInvalid');
      }
    }

    if (!form.enrollOpenAt || Number.isNaN(openAt)) {
      nextErrors.enrollOpenAt = t('merchant.form.datetimeRequired');
    }

    if (!form.enrollCloseAt || Number.isNaN(closeAt)) {
      nextErrors.enrollCloseAt = t('merchant.form.datetimeRequired');
    }

    if (!form.activityAt || Number.isNaN(activityAt)) {
      nextErrors.activityAt = t('merchant.form.datetimeRequired');
    }

    if (!nextErrors.enrollOpenAt && !nextErrors.enrollCloseAt && !nextErrors.activityAt) {
      if (!(openAt < closeAt && closeAt < activityAt)) {
        nextErrors.form = t('merchant.form.timeInvalid');
      }
    }

    const hasValidationError = Object.values(nextErrors).some(Boolean);
    if (hasValidationError) {
      setErrors(nextErrors);
      setFormError(nextErrors.form);
      return;
    }

    const payload: MerchantActivityInput = {
      ...form,
      title,
      description,
      location,
      coverUrl,
    };

    try {
      await onSubmit(payload);
    } catch (error) {
      const message = resolveApiErrorMessage(error, {
        fallback: t('merchant.form.submitFailed'),
        networkFallback: t('merchant.networkError'),
      });
      setFormError(message);
      setErrors((prev) => ({ ...prev, form: message }));
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-[32px] border border-rose-100 bg-white p-6 shadow-sm sm:p-7"
    >
      {lockImmutableFields ? (
        <MerchantNotice
          tone="info"
          title={t('merchant.form.lockedNoticeTitle')}
          message={t('merchant.form.lockedNotice')}
        />
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-semibold text-slate-700">{t('merchant.form.title')}</span>
          <input
            required
            value={form.title}
            disabled={loading}
            onChange={(event) => updateField('title', event.target.value)}
            className={getInputClass('title')}
            placeholder={t('merchant.form.titlePlaceholder')}
          />
          {renderFieldError('title')}
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-semibold text-slate-700">{t('merchant.form.description')}</span>
          <textarea
            required
            rows={4}
            disabled={loading}
            value={form.description}
            onChange={(event) => updateField('description', event.target.value)}
            className={`${getInputClass('description')} resize-y`}
            placeholder={t('merchant.form.descriptionPlaceholder')}
          />
          {renderFieldError('description')}
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">{t('merchant.form.location')}</span>
          <input
            required
            value={form.location}
            disabled={loading}
            onChange={(event) => updateField('location', event.target.value)}
            className={getInputClass('location')}
            placeholder={t('merchant.form.locationPlaceholder')}
          />
          {renderFieldError('location')}
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">{t('merchant.form.category')}</span>
          <select
            disabled={loading}
            value={form.category}
            onChange={(event) => updateField('category', event.target.value as ActivityCategory)}
            className={getInputClass('category')}
          >
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">{t('merchant.form.capacity')}</span>
          <input
            required
            min={1}
            type="number"
            step={1}
            disabled={loading || lockImmutableFields}
            value={Number.isFinite(form.maxCapacity) ? form.maxCapacity : ''}
            onChange={(event) =>
              updateField(
                'maxCapacity',
                event.target.value === '' ? Number.NaN : Number(event.target.value),
              )
            }
            className={getInputClass('maxCapacity')}
          />
          {lockImmutableFields ? (
            <p className="text-xs text-slate-400">{t('merchant.form.capacityLocked')}</p>
          ) : null}
          {renderFieldError('maxCapacity')}
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">{t('merchant.form.price')}</span>
          <input
            min={0}
            step={0.01}
            type="number"
            disabled={loading}
            value={Number.isFinite(form.price) ? form.price : ''}
            onChange={(event) =>
              updateField('price', event.target.value === '' ? Number.NaN : Number(event.target.value))
            }
            className={getInputClass('price')}
          />
          {renderFieldError('price')}
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-semibold text-slate-700">{t('merchant.form.coverUrl')}</span>
          <input
            value={form.coverUrl ?? ''}
            disabled={loading}
            onChange={(event) => updateField('coverUrl', event.target.value)}
            className={getInputClass('coverUrl')}
            placeholder="https://..."
          />
          {renderFieldError('coverUrl')}
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">{t('merchant.form.enrollOpenAt')}</span>
          <input
            required
            type="datetime-local"
            disabled={loading || lockImmutableFields}
            value={toDatetimeLocal(form.enrollOpenAt)}
            onChange={(event) => updateField('enrollOpenAt', fromDatetimeLocal(event.target.value))}
            className={getInputClass('enrollOpenAt')}
          />
          {lockImmutableFields ? (
            <p className="text-xs text-slate-400">{t('merchant.form.enrollOpenAtLocked')}</p>
          ) : null}
          {renderFieldError('enrollOpenAt')}
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">{t('merchant.form.enrollCloseAt')}</span>
          <input
            required
            type="datetime-local"
            disabled={loading}
            value={toDatetimeLocal(form.enrollCloseAt)}
            onChange={(event) => updateField('enrollCloseAt', fromDatetimeLocal(event.target.value))}
            className={getInputClass('enrollCloseAt')}
          />
          {renderFieldError('enrollCloseAt')}
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-semibold text-slate-700">{t('merchant.form.activityAt')}</span>
          <input
            required
            type="datetime-local"
            disabled={loading}
            value={toDatetimeLocal(form.activityAt)}
            onChange={(event) => updateField('activityAt', fromDatetimeLocal(event.target.value))}
            className={getInputClass('activityAt')}
          />
          {renderFieldError('activityAt')}
        </label>
      </div>

      {formError ? <MerchantNotice tone="error" title={t('merchant.errorTitle')} message={formError} /> : null}

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-rose-100 pt-2">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t('merchant.form.requiredHint')}</p>
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-rose-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? t('merchant.form.submitting') : submitLabel}
        </button>
      </div>
    </form>
  );
}
