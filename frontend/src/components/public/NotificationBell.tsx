import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useNotificationCount } from '../../hooks/useNotificationCount';

export function NotificationBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { count } = useNotificationCount();

  const handleClick = () => {
    navigate(isAuthenticated ? '/notifications' : '/login');
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="relative flex h-12 w-12 items-center justify-center rounded-full border border-rose-100 bg-white text-slate-700 transition hover:border-rose-200 hover:text-rose-600"
      aria-label={t('public.notifications')}
      title={t('public.notifications')}
    >
      <Bell size={18} />
      {count > 0 ? (
        <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white">
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </button>
  );
}
