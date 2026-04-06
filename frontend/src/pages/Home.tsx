import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listActivities } from '../api/endpoints';
import { BannerCarousel } from '../components/public/BannerCarousel';
import { HomeCityAtlas } from '../components/public/HomeCityAtlas';
import { SpotlightActivity } from '../components/public/SpotlightActivity';
import { HOME_BANNERS, HOME_SELECTED_ACTIVITIES } from '../data/home';
import type { ActivityListItem } from '../types';

const ENTRY_ANIMATION = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.55, ease: 'easeOut' as const },
};

export default function HomePage() {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const [activities, setActivities] = useState<ActivityListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    listActivities({
      keyword: '',
      region: 'ALL',
      artist: '',
      category: 'ALL',
      sort: 'hot',
      page: 1,
      pageSize: 120,
    })
      .then((result) => {
        if (active) {
          setActivities(result.list);
        }
      })
      .catch(() => {
        if (active) {
          setActivities([]);
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const animationProps = prefersReducedMotion ? {} : ENTRY_ANIMATION;

  return (
    <div className="pb-8 lg:pb-10">
      <section className="w-full border-b border-rose-100 bg-white">
        <BannerCarousel
          items={HOME_BANNERS}
          className="w-full border-b border-rose-100 shadow-none"
          imageClassName="h-[380px] w-full object-cover md:h-[520px] lg:h-[580px]"
        />
      </section>

      <section className="w-full border-b border-rose-100 bg-[linear-gradient(180deg,#fff8f3_0%,#fff1eb_100%)]">
        <HomeCityAtlas activities={activities} isLoading={isLoading} />
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-10 lg:px-6 lg:py-12">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.26em] text-rose-400">
            {t('home.selectedEyebrow')}
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
            {t('home.selectedTitle')}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500 lg:text-base">
            {t('home.selectedDescription')}
          </p>
        </div>

        <div className="space-y-8">
          {HOME_SELECTED_ACTIVITIES.map((item, index) => (
            <motion.div key={item.id} {...animationProps}>
              <SpotlightActivity item={item} mirrored={index % 2 === 1} />
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
