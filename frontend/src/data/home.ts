import type { HomeBannerItem } from '../types';

export const HOME_BANNERS: HomeBannerItem[] = [
  {
    id: 'masters',
    titleKey: 'home.banners.masters.title',
    subtitleKey: 'home.banners.masters.subtitle',
    descriptionKey: 'home.banners.masters.description',
    ctaLabelKey: 'home.banners.masters.cta',
    href: '/activities?category=EXHIBITION&keyword=%E8%BE%BE%E8%8A%AC%E5%A5%87',
    imageUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=1400&q=80',
    category: 'EXHIBITION',
  },
  {
    id: 'stadium',
    titleKey: 'home.banners.stadium.title',
    subtitleKey: 'home.banners.stadium.subtitle',
    descriptionKey: 'home.banners.stadium.description',
    ctaLabelKey: 'home.banners.stadium.cta',
    href: '/activities?category=CONCERT&sort=hot',
    imageUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1400&q=80',
    category: 'CONCERT',
  },
  {
    id: 'sports',
    titleKey: 'home.banners.sports.title',
    subtitleKey: 'home.banners.sports.subtitle',
    descriptionKey: 'home.banners.sports.description',
    ctaLabelKey: 'home.banners.sports.cta',
    href: '/activities?category=SPORTS&sort=soon',
    imageUrl: 'https://images.unsplash.com/photo-1547347298-4074fc3086f0?auto=format&fit=crop&w=1400&q=80',
    category: 'SPORTS',
  },
];

