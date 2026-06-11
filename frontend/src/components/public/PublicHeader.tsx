import {
  Bell,
  ChevronDown,
  LayoutDashboard,
  ListChecks,
  LogOut,
  PlusCircle,
  Search,
  Settings,
  Ticket,
  User,
  UserCircle2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageToggle from '../LanguageToggle';
import { useAvatarObjectUrl } from '../../hooks/useAvatarObjectUrl';
import { useAuth } from '../../context/AuthContext';
import { useUserPreferences } from '../../hooks/useUserPreferences';
import { listNotifications } from '../../api/endpoints';
import { useNotificationCount } from '../../hooks/useNotificationCount';
import type { NotificationItem } from '../../types';
import { mergeNotificationReadState } from '../../utils/notificationState';

interface PublicHeaderProps {
  initialSearchValue: string;
  onSearchSubmit: (value: string) => void;
}

export function PublicHeader({
  initialSearchValue,
  onSearchSubmit,
}: PublicHeaderProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { count } = useNotificationCount();
  const { isAuthenticated, logout, session } = useAuth();
  const { preferences } = useUserPreferences();
  const [searchValue, setSearchValue] = useState(initialSearchValue);
  const [activePanel, setActivePanel] = useState<'notifications' | 'account' | null>(null);
  const [notificationItems, setNotificationItems] = useState<NotificationItem[]>([]);
  const [notificationState, setNotificationState] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle',
  );
  const notificationPanelRef = useRef<HTMLDivElement | null>(null);
  const accountPanelRef = useRef<HTMLDivElement | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearchSubmit(searchValue);
  };

  useEffect(() => {
    if (!activePanel) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        notificationPanelRef.current?.contains(target) ||
        accountPanelRef.current?.contains(target)
      ) {
        return;
      }

      setActivePanel(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActivePanel(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activePanel]);

  const accountMenuItems = useMemo(() => {
    if (!session) {
      return [];
    }

    if (session.role === 'MERCHANT') {
      return [
        {
          icon: LayoutDashboard,
          label: t('merchant.dashboard'),
          path: '/merchant/dashboard',
        },
        {
          icon: ListChecks,
          label: t('merchant.activityList'),
          path: '/merchant/activities',
        },
        {
          icon: PlusCircle,
          label: t('merchant.createActivity'),
          path: '/merchant/activities/new',
        },
      ];
    }

    return [
      {
        icon: Bell,
        label: t('dashboard.notifications'),
        path: '/notifications',
      },
      {
        icon: Ticket,
        label: t('orders.title'),
        path: '/orders',
      },
      {
        icon: User,
        label: t('dashboard.profile'),
        path: '/profile',
      },
      {
        icon: Settings,
        label: t('dashboard.settings'),
        path: '/settings',
      },
    ];
  }, [session, t]);

  const previewItems = useMemo(
    () =>
      [...notificationItems]
        .sort((left, right) => +new Date(right.createdAt) - +new Date(left.createdAt))
        .slice(0, 5),
    [notificationItems],
  );

  const loadNotificationPreview = async () => {
    setNotificationState('loading');

    try {
      const result = await listNotifications();
      setNotificationItems(mergeNotificationReadState(result.list, session?.userId));
      setNotificationState('ready');
    } catch {
      setNotificationItems([]);
      setNotificationState('error');
    }
  };

  const handleNotificationClick = () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    setActivePanel((current) => {
      const nextPanel = current === 'notifications' ? null : 'notifications';

      if (nextPanel === 'notifications' && (notificationState === 'idle' || notificationState === 'error')) {
        void loadNotificationPreview();
      }

      return nextPanel;
    });
  };

  const handleAccountClick = () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    setActivePanel((current) => (current === 'account' ? null : 'account'));
  };

  const handleLogout = () => {
    logout();
    setActivePanel(null);
    navigate('/', { replace: true });
  };

  const accountLabel = session
    ? session.role
      ? t(`profile.roles.${session.role}`)
      : t('auth.login')
    : t('auth.login');
  const avatarSeed = session?.username?.trim().charAt(0).toUpperCase() || 'U';
  const avatarUrl = useAvatarObjectUrl(preferences.avatarDataUrl);

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
          <LanguageToggle variant="light" size="icon" />
          <div ref={notificationPanelRef} className="relative">
            <button
              type="button"
              onClick={handleNotificationClick}
              className={`relative flex h-12 w-12 items-center justify-center rounded-full border bg-white text-slate-700 transition ${
                activePanel === 'notifications'
                  ? 'border-rose-200 text-rose-600 shadow-sm'
                  : 'border-rose-100 hover:border-rose-200 hover:text-rose-600'
              }`}
              aria-label={t('public.notifications')}
              title={t('public.notifications')}
              aria-expanded={activePanel === 'notifications'}
              aria-haspopup="dialog"
            >
              <Bell size={18} />
              {count > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white">
                  {count > 99 ? '99+' : count}
                </span>
              ) : null}
            </button>

            {activePanel === 'notifications' ? (
              <div className="absolute right-0 top-full mt-3 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-[28px] border border-rose-100 bg-white shadow-[0_24px_60px_-30px_rgba(225,29,72,0.35)]">
                <div className="border-b border-rose-100 px-5 py-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-rose-400">
                    UAAD
                  </p>
                  <h3 className="mt-2 text-lg font-black text-slate-900">
                    {t('public.notifications')}
                  </h3>
                </div>

                <div className="max-h-[360px] overflow-y-auto px-3 py-3">
                  {notificationState === 'loading' ? (
                    <div className="space-y-3 p-2">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <div
                          key={index}
                          className="rounded-2xl border border-rose-100 bg-[#fffaf7] p-4"
                        >
                          <div className="h-4 w-28 animate-pulse rounded-full bg-rose-100" />
                          <div className="mt-3 h-3 w-full animate-pulse rounded-full bg-rose-100" />
                          <div className="mt-2 h-3 w-2/3 animate-pulse rounded-full bg-rose-100" />
                        </div>
                      ))}
                    </div>
                  ) : notificationState === 'error' ? (
                    <div className="p-4 text-sm leading-6 text-slate-500">
                      {t('public.errorDescription')}
                    </div>
                  ) : previewItems.length === 0 ? (
                    <div className="p-4 text-sm leading-6 text-slate-500">
                      {t('notifications.empty')}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {previewItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setActivePanel(null);
                            navigate('/notifications', {
                              state: { selectedNotificationId: item.id },
                            });
                          }}
                          className={`block w-full rounded-2xl border px-4 py-4 text-left transition ${
                            item.isRead
                              ? 'border-rose-100 bg-white hover:border-rose-200 hover:bg-[#fffaf7]'
                              : 'border-rose-200 bg-rose-50/80 hover:border-rose-300'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-slate-900">
                                {item.title}
                              </p>
                              <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">
                                {item.content}
                              </p>
                            </div>
                            {!item.isRead ? (
                              <span className="mt-1 inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-rose-500" />
                            ) : null}
                          </div>
                          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                            {new Date(item.createdAt).toLocaleString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-rose-100 p-3">
                  <button
                    type="button"
                    onClick={() => {
                      setActivePanel(null);
                      navigate('/notifications');
                    }}
                    className="w-full rounded-full bg-rose-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-rose-600"
                  >
                    {t('public.viewAll')}
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div ref={accountPanelRef} className="relative">
            <button
              type="button"
              onClick={handleAccountClick}
              className={
                isAuthenticated
                  ? `flex h-12 items-center gap-3 rounded-full border bg-white pl-2 pr-4 text-slate-700 transition ${
                      activePanel === 'account'
                        ? 'border-rose-200 text-rose-600 shadow-sm'
                        : 'border-rose-100 hover:border-rose-200 hover:text-rose-600'
                    }`
                  : 'flex h-12 w-12 items-center justify-center rounded-full border border-rose-100 bg-white text-slate-700 transition hover:border-rose-200 hover:text-rose-600'
              }
              aria-label={isAuthenticated ? t('public.myAccount') : t('auth.login')}
              title={isAuthenticated ? t('public.myAccount') : t('auth.login')}
              aria-expanded={activePanel === 'account'}
              aria-haspopup="menu"
            >
              {isAuthenticated ? (
                <>
                  <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[radial-gradient(circle_at_top,_#ffcadb,_#fb7185_62%,_#f97316)] text-sm font-black text-white">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={session?.username ?? 'UAAD'} className="h-full w-full object-cover" />
                    ) : (
                      avatarSeed
                    )}
                  </span>
                  <span className="max-w-[120px] truncate text-sm font-semibold text-slate-700">
                    {session?.username}
                  </span>
                  <ChevronDown size={16} className="text-slate-400" />
                </>
              ) : (
                <UserCircle2 size={20} />
              )}
            </button>

            {activePanel === 'account' && session ? (
              <div className="absolute right-0 top-full mt-3 w-[min(320px,calc(100vw-2rem))] overflow-hidden rounded-[28px] border border-rose-100 bg-white shadow-[0_24px_60px_-30px_rgba(225,29,72,0.35)]">
                <div className="border-b border-rose-100 bg-[linear-gradient(180deg,#fff8f3_0%,#ffffff_100%)] px-5 py-5">
                  <div className="flex items-center gap-4">
                    <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-[radial-gradient(circle_at_top,_#ffcadb,_#fb7185_62%,_#f97316)] text-lg font-black text-white">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={session.username ?? 'UAAD'} className="h-full w-full object-cover" />
                      ) : (
                        avatarSeed
                      )}
                    </span>
                    <div>
                      <p className="text-base font-black text-slate-900">{session.username ?? 'UAAD'}</p>
                      <p className="mt-1 text-sm text-slate-500">{accountLabel}</p>
                    </div>
                  </div>
                </div>

                <div className="p-3">
                  <div className="space-y-1">
                    {accountMenuItems.map((item) => (
                      <button
                        key={item.path}
                        type="button"
                        onClick={() => {
                          setActivePanel(null);
                          navigate(item.path);
                        }}
                        className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-[#fff4ef] hover:text-rose-600"
                      >
                        <item.icon size={16} />
                        {item.label}
                      </button>
                    ))}
                  </div>

                  <div className="mt-3 border-t border-rose-100 pt-3">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold text-red-500 transition hover:bg-red-50 hover:text-red-600"
                    >
                      <LogOut size={16} />
                      {t('dashboard.logout')}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
