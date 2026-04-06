import { Mail, MapPinned, PhoneCall } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function PublicFooter() {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-rose-100 bg-white/85">
      <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-10 lg:grid-cols-[minmax(0,1.15fr)_340px] lg:px-6">
        <div className="grid gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[radial-gradient(circle_at_top,_#ffb5cf,_#fb7185_55%,_#f97316)] text-xl font-black text-white shadow-[0_18px_45px_-24px_rgba(244,63,94,0.6)]">
              U
            </div>
            <div>
              <p className="text-2xl font-black tracking-tight text-rose-600">UAAD</p>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                {t('footer.brandDescription')}
              </p>
            </div>
          </div>

          <section className="rounded-[28px] border border-slate-200 bg-white p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
              {t('footer.serviceTitle')}
            </p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <li className="flex items-center gap-3">
                <MapPinned size={16} className="text-rose-500" />
                {t('footer.serviceCoverage')}
              </li>
              <li className="flex items-center gap-3">
                <PhoneCall size={16} className="text-rose-500" />
                {t('footer.serviceHours')}
              </li>
              <li className="flex items-center gap-3">
                <Mail size={16} className="text-rose-500" />
                {t('footer.serviceMail')}
              </li>
            </ul>
          </section>
        </div>

        <section className="rounded-[28px] border border-slate-200 bg-slate-900 p-5 text-slate-100">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-rose-200">
            {t('footer.contactTitle')}
          </p>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            {t('footer.contactDescription')}
          </p>
          <div className="mt-5 space-y-3 text-sm">
            <p className="font-semibold text-white">{t('footer.contactMail')}</p>
            <p className="font-semibold text-white">{t('footer.contactPhone')}</p>
          </div>
        </section>
      </div>
    </footer>
  );
}
