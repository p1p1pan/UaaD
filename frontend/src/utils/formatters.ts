import i18n from '../i18n/config';

function getLocale() {
  return i18n.resolvedLanguage?.startsWith('en') ? 'en-US' : 'zh-CN';
}

export function formatDateRange(startAt: string, endAt?: string) {
  const start = new Date(startAt);
  const end = endAt ? new Date(endAt) : null;

  const formatter = new Intl.DateTimeFormat(getLocale(), {
    month: '2-digit',
    day: '2-digit',
  });

  if (!end) {
    return formatter.format(start);
  }

  return `${formatter.format(start)}-${formatter.format(end)}`;
}

export function formatLongDate(date: string) {
  return new Intl.DateTimeFormat(getLocale(), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function formatCurrency(value: number) {
  const locale = getLocale();

  if (value <= 0) {
    return locale === 'en-US' ? 'Free' : '0元起';
  }

  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 0,
  }).format(value);

  return locale === 'en-US' ? `From ${formatted}` : `${formatted}起`;
}

export function formatExactCurrency(value: number) {
  return new Intl.NumberFormat(getLocale(), {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
