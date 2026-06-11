import { motion } from 'framer-motion';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HOME_CATEGORY_RAIL } from '../../constants/public';

export function CategoryStrip() {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState(HOME_CATEGORY_RAIL[0]?.value ?? 'CONCERT');

  return (
    <section className="w-full border-y border-rose-100 bg-[linear-gradient(180deg,#fff7f2_0%,#fffdfb_100%)] py-10 lg:py-14">
      <div className="mx-auto w-full max-w-7xl px-4 lg:px-6">
        <div className="mb-7 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.26em] text-rose-400">
            {t('home.categoryEyebrow')}
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900 lg:text-4xl">
            {t('home.categoryTitle')}
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-500 lg:text-base">
            {t('home.categoryDescription')}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {HOME_CATEGORY_RAIL.map((category, index) => {
            const Icon = category.icon;
            const isActive = category.value === activeCategory;

            return (
              <motion.div
                key={category.value}
                layout
                onMouseEnter={() => setActiveCategory(category.value)}
                whileHover={{ y: -8, scale: 1.03 }}
                transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                className="min-w-0"
              >
                <Link
                  to={`/activities?category=${category.value}`}
                  className="group relative flex min-h-[220px] overflow-hidden rounded-[34px] border border-white/70 bg-white/55 p-6 shadow-[0_20px_70px_-35px_rgba(148,163,184,0.65)] backdrop-blur-2xl transition duration-300 hover:border-rose-200/80 lg:min-h-[236px]"
                >
                  <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.72),rgba(255,255,255,0.28))]" />
                  {category.imageUrl ? (
                    <div
                      className={`absolute inset-0 bg-cover bg-center transition-all duration-500 ${
                        isActive ? 'scale-105 opacity-100' : 'scale-100 opacity-0'
                      }`}
                      style={{ backgroundImage: `url(${category.imageUrl})` }}
                    />
                  ) : null}
                  <div
                    className={`absolute inset-0 transition duration-500 ${
                      isActive
                        ? 'bg-[linear-gradient(180deg,rgba(15,23,42,0.12)_0%,rgba(15,23,42,0.58)_100%)]'
                        : 'bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.08)_100%)]'
                    }`}
                  />

                  <div className="relative z-10 flex h-full w-full flex-col justify-between">
                    <div className="flex items-start justify-between gap-3">
                      {Icon ? (
                        <span
                          className={`flex h-16 w-16 items-center justify-center rounded-full border shadow-sm transition duration-300 ${
                            isActive
                              ? 'border-white/28 bg-white/18 text-white backdrop-blur-xl'
                              : 'border-slate-200 bg-white/88 text-rose-500'
                          }`}
                        >
                          <Icon size={28} />
                        </span>
                      ) : null}
                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] transition ${
                          isActive
                            ? 'border border-white/25 bg-white/14 text-white/90 backdrop-blur-xl'
                            : 'bg-rose-50 text-rose-500'
                        }`}
                      >
                        0{index + 1}
                      </span>
                    </div>

                    <div>
                      <h3
                        className={`text-xl font-black transition duration-300 lg:text-2xl ${
                          isActive ? 'text-white' : 'text-slate-900'
                        }`}
                      >
                        {t(`categories.${category.value}`)}
                      </h3>
                      <p
                        className={`mt-3 max-w-[18rem] text-sm leading-6 transition duration-300 ${
                          isActive ? 'text-white/84' : 'text-slate-500'
                        }`}
                      >
                        {t('home.categoryCardHint')}
                      </p>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
