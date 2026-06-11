import {
  Baby,
  Drama,
  GalleryVerticalEnd,
  Guitar,
  Mic2,
  Music2,
  Orbit,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import type { ActivityCategory, ActivitySort } from '../types';

export interface CityOption {
  value: string;
  labelZh: string;
  labelEn: string;
}

export interface CategoryOption {
  value: ActivityCategory | 'ALL';
  labelZh: string;
  labelEn: string;
  icon?: LucideIcon;
  imageUrl?: string;
}

export interface SortOption {
  value: ActivitySort;
  labelZh: string;
  labelEn: string;
}

export const CITY_OPTIONS: CityOption[] = [
  { value: 'ALL', labelZh: '全国', labelEn: 'Nationwide' },
  { value: '北京', labelZh: '北京', labelEn: 'Beijing' },
  { value: '上海', labelZh: '上海', labelEn: 'Shanghai' },
  { value: '广州', labelZh: '广州', labelEn: 'Guangzhou' },
  { value: '深圳', labelZh: '深圳', labelEn: 'Shenzhen' },
  { value: '杭州', labelZh: '杭州', labelEn: 'Hangzhou' },
  { value: '成都', labelZh: '成都', labelEn: 'Chengdu' },
  { value: '武汉', labelZh: '武汉', labelEn: 'Wuhan' },
  { value: '南京', labelZh: '南京', labelEn: 'Nanjing' },
  { value: '西安', labelZh: '西安', labelEn: 'Xi’an' },
];

export const CATEGORY_OPTIONS: CategoryOption[] = [
  { value: 'ALL', labelZh: '全部', labelEn: 'All' },
  {
    value: 'CONCERT',
    labelZh: '演唱会',
    labelEn: 'Concerts',
    icon: Mic2,
    imageUrl:
      'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1400&q=80',
  },
  {
    value: 'THEATER',
    labelZh: '话剧歌剧',
    labelEn: 'Theater',
    icon: Drama,
    imageUrl:
      'https://images.unsplash.com/photo-1507924538820-ede94a04019d?auto=format&fit=crop&w=1400&q=80',
  },
  {
    value: 'SPORTS',
    labelZh: '体育',
    labelEn: 'Sports',
    icon: Trophy,
    imageUrl:
      'https://images.unsplash.com/photo-1547347298-4074fc3086f0?auto=format&fit=crop&w=1400&q=80',
  },
  {
    value: 'CHILDREN',
    labelZh: '儿童亲子',
    labelEn: 'Kids',
    icon: Baby,
    imageUrl:
      'https://images.unsplash.com/photo-1516627145497-ae6968895b74?auto=format&fit=crop&w=1400&q=80',
  },
  {
    value: 'EXHIBITION',
    labelZh: '展览休闲',
    labelEn: 'Exhibitions',
    icon: GalleryVerticalEnd,
    imageUrl:
      'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=1400&q=80',
  },
  {
    value: 'MUSIC',
    labelZh: '音乐会',
    labelEn: 'Orchestras',
    icon: Music2,
    imageUrl:
      'https://images.unsplash.com/photo-1501612780327-45045538702b?auto=format&fit=crop&w=1400&q=80',
  },
  {
    value: 'DANCE',
    labelZh: '舞蹈芭蕾',
    labelEn: 'Dance',
    icon: Orbit,
    imageUrl:
      'https://images.unsplash.com/photo-1515169067868-5387ec356754?auto=format&fit=crop&w=1400&q=80',
  },
  {
    value: 'OTHER',
    labelZh: '其他',
    labelEn: 'Other',
    icon: Guitar,
    imageUrl:
      'https://images.unsplash.com/photo-1521334884684-d80222895322?auto=format&fit=crop&w=1400&q=80',
  },
];

export const HOME_CATEGORY_RAIL = CATEGORY_OPTIONS.filter((option) => option.value !== 'ALL').slice(0, 6);

export const SORT_OPTIONS: SortOption[] = [
  { value: 'relevance', labelZh: '相关度', labelEn: 'Relevance' },
  { value: 'hot', labelZh: '最热门', labelEn: 'Hottest' },
  { value: 'soon', labelZh: '最近开场', labelEn: 'Starting Soon' },
  { value: 'recent', labelZh: '最新上架', labelEn: 'Newest' },
];

export const DEFAULT_ACTIVITY_SEARCH: Readonly<{
  keyword: string;
  region: string;
  artist: string;
  category: 'ALL';
  sort: 'relevance';
  page: 1;
  pageSize: 12;
}> = {
  keyword: '',
  region: 'ALL',
  artist: '',
  category: 'ALL',
  sort: 'relevance',
  page: 1,
  pageSize: 12,
};

export const HOME_SECTION_ORDER: ActivityCategory[] = ['CONCERT', 'THEATER', 'EXHIBITION'];
