import { Search, UserCircle2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageToggle from '../LanguageToggle';
import { useAuth } from '../../context/AuthContext';
import { NotificationBell } from './NotificationBell';

interface PublicHeaderProps {
  initialSearchValue: string;
  onSearchSubmit: (value: string) => void;
}

export function PublicHeader({
  initialSearchValue,
  onSearchSubmit,
}: PublicHeaderProps) {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [searchValue, setSearchValue] = useState(initialSearchValue);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearchSubmit(searchValue);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-rose-100 bg-[#fffaf7]/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-3 px-4 py-4 lg:flex-nowrap lg:px-6">
        <NavLink to="/" className="flex shrink-0 items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[radial-gradient(circle_at_top,_#ffb6d0,_#fb7185_55%,_#f97316)] text-white shadow-[0_20px_45px_-24px_rgba(244,63,94,0.7)]">
            <span className="text-xl font-black">U</span>
          </div>
          <div className="hidden sm:block">
            <p className="text-3xl font-black tracking-tight text-rose-600">UAAD</p>
          </div>
        </NavLink>

        <nav className="order-3 flex w-full items-center gap-2 sm:w-auto lg:order-none">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                isActive
                  ? 'border-rose-200 bg-white text-rose-600 shadow-sm'
                  : 'border-transparent bg-white/70 text-slate-700 hover:border-rose-100 hover:text-rose-600'
              }`
            }
          >
            {t('public.navHome')}
          </NavLink>
          <NavLink
            to="/activities"
            className={({ isActive }) =>
              `rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                isActive
                  ? 'border-rose-200 bg-white text-rose-600 shadow-sm'
                  : 'border-transparent bg-white/70 text-slate-700 hover:border-rose-100 hover:text-rose-600'
              }`
            }
          >
            {t('public.navCategories')}
          </NavLink>
        </nav>

        <form
          onSubmit={handleSubmit}
          className="order-5 flex min-w-0 flex-1 basis-full lg:order-none lg:ml-auto lg:w-[440px] lg:flex-none lg:pl-2"
        >
          <div className="flex min-w-0 flex-1 items-center overflow-hidden rounded-full border border-slate-300 bg-white shadow-sm">
            <div className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3">
              <Search size={18} className="shrink-0 text-slate-400" />
              <input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                placeholder={t('public.searchPlaceholder')}
              />
            </div>
            <button
              type="submit"
              className="shrink-0 border-l border-rose-500 bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-700"
            >
              {t('public.searchAction')}
            </button>
          </div>
        </form>

        <div className="flex shrink-0 items-center gap-2">
          <LanguageToggle variant="light" />
          <NotificationBell />
          <NavLink
            to={isAuthenticated ? '/app/overview' : '/login'}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-rose-100 bg-white text-slate-700 transition hover:border-rose-200 hover:text-rose-600"
            aria-label={isAuthenticated ? t('public.myAccount') : t('auth.login')}
            title={isAuthenticated ? t('public.myAccount') : t('auth.login')}
          >
            <UserCircle2 size={20} />
          </NavLink>
        </div>
      </div>
    </header>
  );
}
