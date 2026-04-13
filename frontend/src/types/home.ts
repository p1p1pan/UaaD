import type { ActivityCategory, ActivityListItem } from './activity';

export interface HomeBannerItem {
  id: string;
  titleKey: string;
  subtitleKey: string;
  descriptionKey: string;
  ctaLabelKey: string;
  href: string;
  imageUrl: string;
  category: ActivityCategory | 'ALL';
}

export interface RecommendationSectionItem extends ActivityListItem {
  recommendReason?: string;
}

export interface HomeCategorySection {
  category: ActivityCategory;
  title: string;
  items: ActivityListItem[];
}

export interface ProvinceHeatDatum {
  code: string;
  name: string;
  displayName: string;
  value: number;
  topActivityTitle: string;
}

export interface CityHeatDatum {
  code: string;
  name: string;
  displayName: string;
  searchKey: string;
  value: number;
  topActivityTitle: string;
}

export interface ProvinceDrilldownState {
  code: string;
  name: string;
  displayName: string;
}
