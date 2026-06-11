import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { HomeBannerItem } from '../../types';

interface BannerCarouselProps {
  items: HomeBannerItem[];
  className?: string;
  imageClassName?: string;
}

export function BannerCarousel({
  items,
  className = '',
  imageClassName = 'h-[360px] w-full object-cover lg:h-[460px]',
}: BannerCarouselProps) {
  const { t } = useTranslation();
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % items.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [items.length]);

  const activeItem = items[activeIndex];

  return (
    <section className={`relative overflow-hidden bg-slate-100 ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-black/15 to-black/5" />
      <img
        src={activeItem.imageUrl}
        alt={t(activeItem.titleKey)}
        className={imageClassName}
      />

      <div className="absolute inset-0">
        <div className="mx-auto flex h-full w-full max-w-7xl flex-col justify-end px-4 py-8 text-white lg:px-6 lg:py-12">
          <p className="mb-3 text-base font-semibold tracking-[0.2em] text-white/80">
            {t(activeItem.titleKey)}
          </p>
          <h1 className="max-w-3xl text-3xl font-black tracking-tight sm:text-4xl lg:text-6xl">
            {t(activeItem.subtitleKey)}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/90 lg:text-lg">
            {t(activeItem.descriptionKey)}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              to={activeItem.href}
              className="rounded-full bg-rose-600 px-6 py-3 text-sm font-bold text-white shadow-[0_18px_40px_-24px_rgba(244,63,94,0.85)] transition hover:bg-rose-700"
            >
              {t(activeItem.ctaLabelKey)}
            </Link>
            <span className="rounded-full border border-white/35 bg-white/12 px-4 py-3 text-sm font-semibold text-white/90 backdrop-blur">
              {t(`categories.${activeItem.category}`)}
            </span>
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-5 flex items-center justify-center px-4 lg:px-6">
        <div className="flex items-center justify-center gap-2 rounded-full border border-white/18 bg-white/10 px-3 py-2 shadow-[0_18px_60px_-28px_rgba(15,23,42,0.75)] backdrop-blur-2xl">
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onMouseEnter={() => setActiveIndex(index)}
              onFocus={() => setActiveIndex(index)}
              className={`group relative rounded-full border transition-all duration-300 ${
                index === activeIndex
                  ? 'h-3 w-12 border-white/80 bg-white shadow-[0_0_0_1px_rgba(255,255,255,0.18),0_10px_32px_-18px_rgba(255,255,255,0.9)]'
                  : 'h-3 w-3 border-white/16 bg-white/10 hover:w-7 hover:border-white/24 hover:bg-white/16'
              }`}
              aria-label={t(item.titleKey)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
