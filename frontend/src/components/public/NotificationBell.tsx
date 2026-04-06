import { Bell } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getUnreadNotificationCount } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';

export function NotificationBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;

    if (!isAuthenticated) {
      return undefined;
    }

    getUnreadNotificationCount()
      .then((value) => {
        if (active) {
          setCount(value);
        }
      })
      .catch(() => {
        if (active) {
          setCount(0);
        }
      });

    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  const handleClick = () => {
    navigate(isAuthenticated ? '/app/notifications' : '/login');
  };

  const displayedCount = isAuthenticated ? count : 0;

  return (
    <button
      type="button"
      onClick={handleClick}
      className="relative flex h-12 w-12 items-center justify-center rounded-full border border-rose-100 bg-white text-slate-700 transition hover:border-rose-200 hover:text-rose-600"
      aria-label={t('public.notifications')}
      title={t('public.notifications')}
    >
      <Bell size={18} />
      {displayedCount > 0 ? (
        <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white">
          {displayedCount > 99 ? '99+' : displayedCount}
        </span>
      ) : null}
    </button>
  );
}
