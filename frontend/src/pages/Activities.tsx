import { Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { listActivities } from '../api/endpoints';
import { ActivityGridCard } from '../components/public/ActivityGridCard';
import { EmptyState } from '../components/public/EmptyState';
import { LoadingCards } from '../components/public/LoadingCards';
import { Pagination } from '../components/public/Pagination';
import type { ActivityListItem, ActivitySearchParams } from '../types';

const PAGE_SIZE = 12;

function readPage(searchParams: URLSearchParams) {
  const raw = Number(searchParams.get('page') ?? '1');
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1;
}

export default function ActivitiesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [draftKeyword, setDraftKeyword] = useState(searchParams.get('keyword') ?? '');
  const [items, setItems] = useState<ActivityListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const currentPage = useMemo(() => readPage(searchParams), [searchParams]);
  const keyword = searchParams.get('keyword') ?? '';
  const role = (localStorage.getItem('user_role') ?? '').toUpperCase();
  const isMerchant = role === 'MERCHANT' || role === 'ADMIN';

  useEffect(() => {
    setDraftKeyword(keyword);
  }, [keyword]);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError('');
        const params: ActivitySearchParams = {
          keyword,
          region: 'ALL',
          artist: '',
          category: 'ALL',
          sort: 'hot',
          page: currentPage,
          pageSize: PAGE_SIZE,
        };

        const result = await listActivities(params);
        if (!active) {
          return;
        }
        setItems(result.list);
        setTotal(result.total);
      } catch {
        if (!active) {
          return;
        }
        setItems([]);
        setTotal(0);
        setError('活动列表加载失败，请稍后重试。');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [keyword, currentPage]);

  const updateParams = (nextKeyword: string, nextPage = 1) => {
    const params = new URLSearchParams();
    const normalizedKeyword = nextKeyword.trim();
    if (normalizedKeyword) {
      params.set('keyword', normalizedKeyword);
    }
    if (nextPage > 1) {
      params.set('page', String(nextPage));
    }
    setSearchParams(params);
  };

  return (
    <div className="w-full animate-fade-in space-y-6 pb-12">
      <section className="rounded-[28px] border border-slate-800 bg-slate-900/30 p-5 shadow-lg">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-white">Activities</h2>
            <p className="mt-2 text-sm text-slate-400">Use real-time activity data for enrollment decisions.</p>
          </div>
          {isMerchant ? (
            <Link
              to="/merchant/activities/new"
              className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              Create Event
            </Link>
          ) : null}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            updateParams(draftKeyword, 1);
          }}
          className="mt-5"
        >
          <label className="flex items-center gap-3 rounded-full border border-slate-700 bg-slate-950/50 px-4 py-3">
            <Search size={18} className="text-slate-400" />
            <input
              value={draftKeyword}
              onChange={(event) => setDraftKeyword(event.target.value)}
              placeholder="Search activities"
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
            />
          </label>
        </form>
      </section>

      <section className="rounded-[28px] border border-slate-800 bg-slate-900/20 p-5 shadow-lg lg:p-6">
        {loading ? (
          <LoadingCards count={6} />
        ) : error ? (
          <EmptyState title="加载失败" description={error} />
        ) : items.length === 0 ? (
          <EmptyState description="当前条件下暂无活动数据。" />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <ActivityGridCard key={item.id} item={item} />
              ))}
            </div>
            <div className="mt-6">
              <Pagination
                currentPage={currentPage}
                total={total}
                pageSize={PAGE_SIZE}
                onPageChange={(page) => updateParams(keyword, page)}
              />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
