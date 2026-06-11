import { ArrowRight, Home, ShieldAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import type { AuthRole } from '../types/auth';
import { buildLoginPath, getDefaultAuthenticatedPath } from '../utils/auth';

export const ProtectedRoute = ({
  children,
  allowedRoles,
}: {
  children: ReactNode;
  allowedRoles?: AuthRole[];
}) => {
  const { isAuthenticated, isInitializing, role } = useAuth();
  const location = useLocation();
  const { t } = useTranslation();

  if (isInitializing) {
    return null;
  }

  if (!isAuthenticated) {
    const redirectTo = `${location.pathname}${location.search}${location.hash}`;
    return (
      <Navigate
        to={buildLoginPath({ redirectTo })}
        state={{ from: location }}
        replace
      />
    );
  }

  if (allowedRoles && !allowedRoles.includes(role ?? '')) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10 text-slate-50">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(244,63,94,0.22),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(34,211,238,0.16),transparent_28%)]" />
        <div className="relative w-full max-w-2xl rounded-[32px] border border-white/10 bg-slate-900/80 p-8 shadow-[0_30px_100px_-50px_rgba(15,23,42,0.95)] backdrop-blur">
          <div className="mb-6 inline-flex rounded-2xl border border-white/10 bg-white/5 p-3 text-rose-300">
            <ShieldAlert size={24} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
            {t('merchant.panel')}
          </p>
          <h1 className="mt-3 text-3xl font-black text-white">{t('merchant.guardTitle')}</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300">
            {t('merchant.guardDescription')}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to={getDefaultAuthenticatedPath(role)}
              className="inline-flex items-center gap-2 rounded-full bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-400"
            >
              {t('merchant.goDashboard')}
              <ArrowRight size={15} />
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-5 py-2.5 text-sm font-semibold text-slate-100 transition hover:border-white/20 hover:bg-white/10"
            >
              <Home size={15} />
              {t('merchant.goHome')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
