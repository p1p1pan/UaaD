import { useEffect, useMemo, useState } from 'react';
import { Bell, CheckCheck, ChevronRight, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { listNotifications, markNotificationAsRead } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import type { NotificationFilter, NotificationItem } from '../types';
import { mergeNotificationReadState, rememberReadNotifications } from '../utils/notificationState';

export default function NotificationsPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const { session } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<NotificationFilter>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedNotificationId, setSelectedNotificationId] = useState<number | null>(
    () => (location.state as { selectedNotificationId?: number } | null)?.selectedNotificationId ?? null,
  );

  const filteredItems = useMemo(() => {
    if (filter === 'UNREAD') {
      return items.filter((item) => !item.isRead);
    }

    if (filter === 'READ') {
      return items.filter((item) => item.isRead);
    }

    return items;
  }, [filter, items]);

  const selectedNotification = useMemo(
    () => items.find((item) => item.id === selectedNotificationId) ?? null,
    [items, selectedNotificationId],
  );
  const unreadCount = useMemo(() => items.filter((item) => !item.isRead).length, [items]);

  useEffect(() => {
    let active = true;

    listNotifications()
      .then((result) => {
        if (active) {
          setItems(mergeNotificationReadState(result.list, session?.userId));
          setError('');
        }
      })
      .catch(() => {
        if (active) {
          setItems([]);
          setError(t('public.errorDescription'));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [session?.userId, t]);

  const markItemsAsRead = async (ids: number[]) => {
    if (!ids.length) {
      return;
    }

    rememberReadNotifications(session?.userId, ids);
    setItems((currentItems) =>
      currentItems.map((item) =>
        ids.includes(item.id)
          ? {
              ...item,
              isRead: true,
            }
          : item,
      ),
    );

    await Promise.all(ids.map((id) => markNotificationAsRead(id).catch(() => undefined)));
  };

  const handleOpenNotification = async (item: NotificationItem) => {
    setSelectedNotificationId(item.id);

    if (!item.isRead) {
      await markItemsAsRead([item.id]);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-12">
      <section className="overflow-hidden rounded-[32px] border border-rose-100 bg-[linear-gradient(135deg,#fff8f3_0%,#fff1eb_60%,#ffe3d8_100%)] px-6 py-8 shadow-[0_28px_80px_-52px_rgba(244,63,94,0.28)] lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-rose-400">UAAD</p>
        <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900">
          {t('public.notifications')}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500 lg:text-base">
          {t('notifications.subtitle')}
        </p>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          {(['ALL', 'UNREAD', 'READ'] as NotificationFilter[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                filter === value
                  ? 'border-rose-500 bg-rose-500 text-white'
                  : 'border-rose-100 bg-white text-slate-600 hover:border-rose-200 hover:text-rose-600'
              }`}
            >
              {t(`notifications.filters.${value}`)}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => void markItemsAsRead(items.filter((item) => !item.isRead).map((item) => item.id))}
          disabled={unreadCount === 0}
          className="inline-flex items-center gap-2 rounded-full border border-rose-100 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-rose-200 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CheckCheck size={16} />
          {t('notifications.markAllRead')}
        </button>
      </div>

      {error ? (
        <div className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="space-y-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="rounded-[28px] border border-rose-100 bg-white p-6 shadow-sm"
            >
              <div className="h-5 w-40 animate-pulse rounded-full bg-rose-100" />
              <div className="mt-4 h-4 w-full animate-pulse rounded-full bg-rose-100" />
              <div className="mt-2 h-4 w-3/4 animate-pulse rounded-full bg-rose-100" />
            </div>
          ))
        ) : error ? (
          <div className="rounded-[32px] border border-amber-200 bg-amber-50 px-6 py-5 text-sm text-amber-700 shadow-sm">
            {error}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-[32px] border border-dashed border-rose-200 bg-white px-6 py-12 text-center shadow-sm">
            <Bell className="mx-auto text-rose-300" size={28} />
            <p className="mt-4 text-slate-500">{t('notifications.empty')}</p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <article
              key={item.id}
              className={`rounded-[28px] border p-6 shadow-sm ${
                item.isRead
                  ? 'border-rose-100 bg-white'
                  : 'border-rose-200 bg-rose-50/80'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    {!item.isRead ? (
                      <span className="inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
                    ) : null}
                    <h3 className="text-lg font-bold text-slate-900">{item.title}</h3>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm leading-7 text-slate-600">{item.content}</p>
                </div>
                <span className="rounded-full border border-slate-200 bg-[#fff8f3] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {new Date(item.createdAt).toLocaleDateString('zh-CN')}
                </span>
              </div>
              <div className="mt-5 flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={() => void handleOpenNotification(item)}
                  className="inline-flex items-center gap-2 rounded-full border border-rose-100 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-rose-200 hover:text-rose-600"
                >
                  {t('notifications.viewDetails')}
                  <ChevronRight size={14} />
                </button>
                {!item.isRead ? (
                  <button
                    type="button"
                    onClick={() => void markItemsAsRead([item.id])}
                    className="rounded-full bg-rose-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-600"
                  >
                    {t('notifications.markRead')}
                  </button>
                ) : (
                  <span className="rounded-full border border-slate-200 bg-[#fff8f3] px-4 py-2 text-xs font-semibold text-slate-400">
                    {t('notifications.readOnly')}
                  </span>
                )}
              </div>
            </article>
          ))
        )}
      </div>

      {selectedNotification ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-[32px] border border-rose-100 bg-white shadow-[0_32px_90px_-48px_rgba(244,63,94,0.22)]">
            <div className="flex items-start justify-between gap-4 border-b border-rose-100 bg-[linear-gradient(180deg,#fff8f3_0%,#ffffff_100%)] px-6 py-5">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-rose-400">
                  UAAD
                </p>
                <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                  {selectedNotification.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNotificationId(null)}
                className="rounded-full border border-rose-100 bg-white p-2 text-slate-400 transition hover:border-rose-200 hover:text-rose-600"
                aria-label={t('notifications.closeDetails')}
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5 px-6 py-6">
              <div className="flex flex-wrap gap-3">
                <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-rose-600">
                  {selectedNotification.type}
                </span>
                <span className="rounded-full border border-slate-200 bg-[#fff8f3] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {new Date(selectedNotification.createdAt).toLocaleString('zh-CN')}
                </span>
              </div>

              <p className="text-sm leading-8 text-slate-600">{selectedNotification.content}</p>
            </div>

            <div className="flex flex-wrap justify-end gap-3 border-t border-rose-100 px-6 py-4">
              {!selectedNotification.isRead ? (
                <button
                  type="button"
                  onClick={() => void markItemsAsRead([selectedNotification.id])}
                  className="rounded-full border border-rose-100 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-rose-200 hover:text-rose-600"
                >
                  {t('notifications.markRead')}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setSelectedNotificationId(null)}
                className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-600"
              >
                {t('notifications.closeDetails')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
