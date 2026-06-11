import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getHotRecommendations, getRecommendations, listActivities } from '../api/endpoints';
import { BannerCarousel } from '../components/public/BannerCarousel';
import { CategoryStrip } from '../components/public/CategoryStrip';
import { EmptyState } from '../components/public/EmptyState';
import { HomeCityAtlas } from '../components/public/HomeCityAtlas';
import { SpotlightActivity } from '../components/public/SpotlightActivity';
import { HOME_BANNERS } from '../data/home';
import type { ActivityListItem, HomeSpotlightItem, RecommendationSectionItem } from '../types';

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
  const [spotlights, setSpotlights] = useState<HomeSpotlightItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    function toSpotlightItem(item: RecommendationSectionItem | ActivityListItem): HomeSpotlightItem {
      return {
        id: item.id,
        title: item.title,
        summary:
          'recommendReason' in item && item.recommendReason
            ? item.recommendReason
            : item.description || t('public.emptyDescription'),
        imageUrl: item.coverUrl,
        location: item.location,
        openAt: item.enrollOpenAt,
        href: `/activity/${item.id}`,
        category: item.category,
      };
    }

    async function load() {
      try {
        const activityResultPromise = listActivities({
          keyword: '',
          region: 'ALL',
          artist: '',
          category: 'ALL',
          sort: 'hot',
          page: 1,
          pageSize: 120,
        }).catch(() => ({
          list: [],
          total: 0,
          page: 1,
          pageSize: 120,
        }));

        const recommendationResultPromise = getRecommendations(3)
          .then((result) => result.list)
          .catch(() => getHotRecommendations(3))
          .catch(() => []);

        const [activityResult, recommendationResult] = await Promise.all([
          activityResultPromise,
          recommendationResultPromise,
        ]);

        if (!active) {
          return;
        }

        setActivities(activityResult.list);

        const preferredSpotlights =
          recommendationResult.length > 0
            ? recommendationResult.map(toSpotlightItem)
            : activityResult.list.slice(0, 3).map(toSpotlightItem);

        setSpotlights(preferredSpotlights);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [t]);

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

      <section className="w-full">
        <CategoryStrip />
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

        {spotlights.length === 0 && !isLoading ? (
          <EmptyState
            title={t('public.emptyTitle')}
            description={t('home.selectedEmptyDescription')}
          />
        ) : (
          <div className="space-y-8">
            {spotlights.map((item, index) => (
              <motion.div key={item.id} {...animationProps}>
                <SpotlightActivity item={item} mirrored={index % 2 === 1} />
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
