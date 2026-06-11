import { Bell, Globe, MapPinned, RotateCcw, Shield, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useUserPreferences } from '../hooks/useUserPreferences';
import { usePreferredCity } from '../hooks/usePreferredCity';
import { CITY_OPTIONS } from '../constants/public';

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { logout, session } = useAuth();
  const { preferences, updatePreferences, resetPreferences } = useUserPreferences();
  const { city, setCity } = usePreferredCity();

  return (
    <div className="mx-auto w-full max-w-5xl animate-fade-in space-y-8 pb-12">
      <section className="overflow-hidden rounded-[32px] border border-rose-100 bg-[linear-gradient(135deg,#fff8f3_0%,#fff1eb_60%,#ffe3d8_100%)] px-6 py-8 shadow-[0_28px_80px_-52px_rgba(244,63,94,0.28)] lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-rose-400">UAAD</p>
        <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900">
          {t('dashboard.settings', 'Settings')}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500 lg:text-base">
          Control your universal platform preferences.
        </p>
      </section>

      <div className="space-y-8">
        <section className="rounded-[32px] border border-rose-100 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-start gap-4 border-b border-rose-100 pb-6">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-rose-500">
              <Bell size={24} />
            </div>
            <div>
              <h3 className="mb-1 text-xl font-black text-slate-900">
                {t('settings.notificationsTitle')}
              </h3>
              <p className="text-sm text-slate-500">{t('settings.notificationsDescription')}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-[#fffaf7] p-4 sm:flex-row sm:items-center">
              <div>
                <p className="mb-1 text-sm font-medium text-slate-700">
                  {t('settings.emailNotifications')}
                </p>
                <p className="text-sm text-slate-500">{t('settings.emailNotificationsHint')}</p>
              </div>
              <button
                type="button"
                onClick={() =>
                  updatePreferences({ emailNotifications: !preferences.emailNotifications })
                }
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  preferences.emailNotifications
                    ? 'bg-rose-500 text-white hover:bg-rose-600'
                    : 'border border-rose-100 bg-white text-slate-600 hover:border-rose-200 hover:text-rose-600'
                }`}
              >
                {preferences.emailNotifications ? t('settings.enabled') : t('settings.disabled')}
              </button>
            </div>

            <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-[#fffaf7] p-4 sm:flex-row sm:items-center">
              <div>
                <p className="mb-1 text-sm font-medium text-slate-700">
                  {t('settings.smsNotifications')}
                </p>
                <p className="text-sm text-slate-500">{t('settings.smsNotificationsHint')}</p>
              </div>
              <button
                type="button"
                onClick={() => updatePreferences({ smsNotifications: !preferences.smsNotifications })}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  preferences.smsNotifications
                    ? 'bg-rose-500 text-white hover:bg-rose-600'
                    : 'border border-rose-100 bg-white text-slate-600 hover:border-rose-200 hover:text-rose-600'
                }`}
              >
                {preferences.smsNotifications ? t('settings.enabled') : t('settings.disabled')}
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-rose-100 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-start gap-4 border-b border-rose-100 pb-6">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-rose-500">
              <Globe size={24} />
            </div>
            <div>
              <h3 className="mb-1 text-xl font-black text-slate-900">
                {t('settings.languageTitle')}
              </h3>
              <p className="text-sm text-slate-500">{t('settings.languageDescription')}</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <button
              type="button"
              onClick={() => i18n.changeLanguage('zh')}
              className={`rounded-2xl border px-4 py-4 text-left transition ${
                i18n.resolvedLanguage?.startsWith('zh')
                  ? 'border-rose-200 bg-rose-50 text-rose-600'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-rose-200'
              }`}
            >
              <p className="text-sm font-bold uppercase tracking-[0.18em]">ZH</p>
              <p className="mt-2 text-sm">{t('settings.languageChinese')}</p>
            </button>
            <button
              type="button"
              onClick={() => i18n.changeLanguage('en')}
              className={`rounded-2xl border px-4 py-4 text-left transition ${
                i18n.resolvedLanguage?.startsWith('en')
                  ? 'border-rose-200 bg-rose-50 text-rose-600'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-rose-200'
              }`}
            >
              <p className="text-sm font-bold uppercase tracking-[0.18em]">EN</p>
              <p className="mt-2 text-sm">{t('settings.languageEnglish')}</p>
            </button>
          </div>
        </section>

        <section className="rounded-[32px] border border-rose-100 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-start gap-4 border-b border-rose-100 pb-6">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-rose-500">
              <MapPinned size={24} />
            </div>
            <div>
              <h3 className="mb-1 text-xl font-black text-slate-900">
                {t('settings.discoveryTitle')}
              </h3>
              <p className="text-sm text-slate-500">{t('settings.discoveryDescription')}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-[#fffaf7] p-4">
            <label className="block text-sm font-medium text-slate-700">
              {t('settings.preferredCity')}
            </label>
            <select
              value={city}
              onChange={(event) => setCity(event.target.value)}
              className="mt-3 w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-rose-300 focus:ring-2 focus:ring-rose-200/60"
            >
              {CITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(`cities.${option.value}`)}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="rounded-[32px] border border-rose-100 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-start gap-4 border-b border-rose-100 pb-6">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-rose-500">
              <Shield size={24} />
            </div>
            <div>
              <h3 className="mb-1 text-xl font-black text-slate-900">
                {t('settings.accountTitle')}
              </h3>
              <p className="text-sm text-slate-500">{t('settings.accountDescription')}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-[#fffaf7] p-4">
              <p className="text-sm font-medium text-slate-700">{t('settings.currentAccount')}</p>
              <p className="mt-2 text-sm text-slate-500">
                {session?.username} ·{' '}
                {session?.role ? t(`profile.roles.${session.role}`) : '-'}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  resetPreferences();
                  setCity('ALL');
                }}
                className="inline-flex items-center gap-2 rounded-full border border-rose-100 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-rose-200 hover:text-rose-600"
              >
                <RotateCcw size={16} />
                {t('settings.resetPersonalization')}
              </button>
              <button
                type="button"
                onClick={() => {
                  logout();
                  navigate('/', { replace: true });
                }}
                className="inline-flex items-center gap-2 rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-600"
              >
                <LogOut size={16} />
                {t('settings.logoutToHome')}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
