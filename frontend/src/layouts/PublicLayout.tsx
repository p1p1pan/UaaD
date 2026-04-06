import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { PublicHeader } from '../components/public/PublicHeader';
import { PublicFooter } from '../components/public/PublicFooter';
import { usePreferredCity } from '../hooks/usePreferredCity';

export interface PublicLayoutContext {
  preferredCity: string;
  setPreferredCity: (city: string) => void;
}

export default function PublicLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { city, setCity } = usePreferredCity();
  const initialSearchValue = new URLSearchParams(location.search).get('keyword') ?? '';
  const isHomeRoute = location.pathname === '/';

  const contextValue = useMemo<PublicLayoutContext>(
    () => ({
      preferredCity: city,
      setPreferredCity: setCity,
    }),
    [city, setCity],
  );

  const handleSearchSubmit = (nextSearchValue: string) => {
    const params = new URLSearchParams();

    if (nextSearchValue.trim()) {
      params.set('keyword', nextSearchValue.trim());
    }

    navigate(`/activities${params.toString() ? `?${params.toString()}` : ''}`);
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#fffaf7] text-slate-900">
      <PublicHeader
        key={`${location.pathname}:${location.search}`}
        initialSearchValue={initialSearchValue}
        onSearchSubmit={handleSearchSubmit}
      />
      <main
        className={
          isHomeRoute
            ? 'w-full flex-1'
            : 'mx-auto w-full max-w-7xl flex-1 px-4 py-6 lg:px-6 lg:py-8'
        }
      >
        <Outlet context={contextValue} />
      </main>
      <PublicFooter />
    </div>
  );
}
