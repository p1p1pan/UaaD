import * as echarts from 'echarts';
import ReactECharts from 'echarts-for-react';
import { ArrowLeft, MapPinned } from 'lucide-react';
import { startTransition, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  getProvinceByCode,
  inferCitySearchKey,
  inferProvinceByLocation,
  MUNICIPALITY_CODES,
  PROVINCES,
  simplifyRegionName,
} from '../../data/geo';
import type { ActivityListItem, CityHeatDatum, ProvinceDrilldownState, ProvinceHeatDatum } from '../../types';

interface GeoFeatureProperties {
  name: string;
  adcode?: number | string;
}

interface GeoPolygonGeometry {
  type: 'Polygon';
  coordinates: number[][][];
}

interface GeoMultiPolygonGeometry {
  type: 'MultiPolygon';
  coordinates: number[][][][];
}

interface GeoFeature {
  properties: GeoFeatureProperties;
  geometry: GeoPolygonGeometry | GeoMultiPolygonGeometry;
}

interface GeoJsonShape {
  type?: string;
  features: GeoFeature[];
}

interface HomeCityAtlasProps {
  activities: ActivityListItem[];
  isLoading?: boolean;
}

const CHINA_MAP_KEY = 'uaad-china';
const REGISTERED_MAP_KEYS = new Set<string>();

const FALLBACK_PROVINCE_HEAT: Record<string, number> = {
  '110000': 31,
  '310000': 26,
  '440000': 22,
  '330000': 19,
  '510000': 17,
  '420000': 14,
  '320000': 13,
  '350000': 11,
  '430000': 10,
  '610000': 9,
  '370000': 9,
  '500000': 8,
  '410000': 8,
  '530000': 7,
  '210000': 6,
  '120000': 6,
  '220000': 5,
  '230000': 5,
  '340000': 5,
  '130000': 5,
  '450000': 5,
  '360000': 4,
  '620000': 3,
};

function provinceMapKey(code: string) {
  return `uaad-province-${code}`;
}

function compareActivityPriority(left: ActivityListItem, right: ActivityListItem) {
  if (right.enrollCount !== left.enrollCount) {
    return right.enrollCount - left.enrollCount;
  }

  return right.viewCount - left.viewCount;
}

function hashText(value: string) {
  return [...value].reduce((accumulator, character) => {
    return accumulator + character.charCodeAt(0);
  }, 0);
}

function getPolygonMaxLatitude(ring: number[][]) {
  return ring.reduce((maxLatitude, point) => Math.max(maxLatitude, point[1]), -Infinity);
}

function shouldDropChinaFeature(feature: GeoFeature) {
  const { name = '', adchar = '', adcode = '' } = feature.properties as {
    name?: string;
    adchar?: string;
    adcode?: string | number;
  };

  return !name || adchar === 'JD' || String(adcode) === '100000_JD';
}

function sanitizeChinaGeoJson(json: GeoJsonShape) {
  return {
    ...json,
    features: json.features
      .filter((feature) => !shouldDropChinaFeature(feature))
      .map((feature) => {
        if (
          feature.properties.name !== '海南省' ||
          feature.geometry.type !== 'MultiPolygon'
        ) {
          return feature;
        }

        const filteredCoordinates = feature.geometry.coordinates.filter((polygon) =>
          getPolygonMaxLatitude(polygon[0]) >= 18,
        );

        return {
          ...feature,
          geometry: {
            ...feature.geometry,
            coordinates: filteredCoordinates,
          },
        };
      }),
  };
}

function sanitizeProvinceGeoJson(provinceCode: string, json: GeoJsonShape) {
  const features = json.features.filter((feature) => Boolean(feature.properties.name));

  if (provinceCode !== '460000') {
    return {
      ...json,
      features,
    };
  }

  return {
    ...json,
    features: features.filter((feature) => feature.properties.name !== '三沙市'),
  };
}

function normalizeProvinceDatum(
  activities: ActivityListItem[],
  getFallbackActivityLabel: () => string,
) {
  const grouped = new Map<string, { count: number; topActivity: ActivityListItem | null }>();

  activities.forEach((activity) => {
    const province = inferProvinceByLocation(activity.location);

    if (!province) {
      return;
    }

    const current = grouped.get(province.code) ?? {
      count: 0,
      topActivity: null,
    };
    const nextTopActivity =
      !current.topActivity || compareActivityPriority(current.topActivity, activity) > 0
        ? activity
        : current.topActivity;

    grouped.set(province.code, {
      count: current.count + 1,
      topActivity: nextTopActivity,
    });
  });

  const useFallback = activities.length === 0;

  return PROVINCES.map<ProvinceHeatDatum>((province) => {
    const real = grouped.get(province.code);
    const fallbackCount = useFallback ? FALLBACK_PROVINCE_HEAT[province.code] : undefined;

    return {
      code: province.code,
      name: province.mapName,
      displayName: province.displayName,
      value: real?.count ?? fallbackCount ?? 0,
      topActivityTitle: real?.topActivity?.title ?? getFallbackActivityLabel(),
    };
  });
}

function buildCityHeatData(
  province: ProvinceDrilldownState,
  features: GeoFeature[],
  activities: ActivityListItem[],
  provinceValue: number,
  getFallbackActivityLabel: () => string,
) {
  const grouped = new Map<string, { count: number; topActivity: ActivityListItem | null }>();

  activities.forEach((activity) => {
    const activityProvince = inferProvinceByLocation(activity.location);

    if (!activityProvince || activityProvince.code !== province.code) {
      return;
    }

    const rawSearchKey = inferCitySearchKey(activity.location, province.code);
    const matchedFeature = features.find((feature) => {
      const simpleName = simplifyRegionName(feature.properties.name);

      return (
        feature.properties.name.includes(rawSearchKey) ||
        rawSearchKey.includes(simpleName) ||
        simpleName.includes(rawSearchKey)
      );
    });
    const bucketKey = matchedFeature?.properties.name ?? rawSearchKey;
    const current = grouped.get(bucketKey) ?? { count: 0, topActivity: null };
    const nextTopActivity =
      !current.topActivity || compareActivityPriority(current.topActivity, activity) > 0
        ? activity
        : current.topActivity;

    grouped.set(bucketKey, {
      count: current.count + 1,
      topActivity: nextTopActivity,
    });
  });

  return features.map<CityHeatDatum>((feature, index) => {
    const rawName = feature.properties.name;
    const shortName = simplifyRegionName(rawName) || rawName;
    const groupedValue = grouped.get(rawName) ?? grouped.get(shortName);
    const generatedValue =
      groupedValue?.count ??
      Math.max(
        provinceValue > 0 ? 1 : 0,
        Math.round((provinceValue || 6) * (0.18 + ((hashText(rawName) + index) % 7) / 10)),
      );

    return {
      code: String(feature.properties.adcode ?? `${province.code}-${index}`),
      name: rawName,
      displayName: shortName,
      searchKey: MUNICIPALITY_CODES.has(province.code) ? province.displayName : shortName,
      value: generatedValue,
      topActivityTitle: groupedValue?.topActivity?.title ?? getFallbackActivityLabel(),
    };
  });
}

async function registerMapFromUrl(mapKey: string, url: string, force = false) {
  if (REGISTERED_MAP_KEYS.has(mapKey) && !force) {
    return;
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Unable to fetch ${url}`);
  }

  const json = (await response.json()) as GeoJsonShape;
  const sanitizedJson = mapKey === CHINA_MAP_KEY ? sanitizeChinaGeoJson(json) : json;
  echarts.registerMap(mapKey, sanitizedJson as never);
  REGISTERED_MAP_KEYS.add(mapKey);
}

export function HomeCityAtlas({ activities, isLoading = false }: HomeCityAtlasProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [nationalReady, setNationalReady] = useState(false);
  const [provinceFeatures, setProvinceFeatures] = useState<Record<string, GeoFeature[]>>({});
  const [provinceLoadingCode, setProvinceLoadingCode] = useState('');
  const [drilldown, setDrilldown] = useState<ProvinceDrilldownState | null>(null);
  const [mapError, setMapError] = useState('');

  useEffect(() => {
    let active = true;

    registerMapFromUrl(CHINA_MAP_KEY, '/geojson/china.json', true)
      .then(() => {
        if (active) {
          setNationalReady(true);
        }
      })
      .catch(() => {
        if (active) {
          setMapError(t('home.mapError'));
        }
      });

    return () => {
      active = false;
    };
  }, [t]);

  const getProvinceLabel = (provinceCode?: string, fallback = '') => {
    if (!provinceCode) {
      return fallback;
    }

    return t(`regions.provinces.${provinceCode}`, { defaultValue: fallback });
  };
  const getCityLabel = (cityName?: string, fallback = '') => {
    if (!cityName) {
      return fallback;
    }

    return t(`cities.${cityName}`, { defaultValue: fallback });
  };
  const getFallbackActivityLabel = () => t('home.mapFallbackTopActivity');

  const provinceData = normalizeProvinceDatum(activities, getFallbackActivityLabel);
  const maxProvinceValue = Math.max(...provinceData.map((item) => item.value), 1);
  const currentProvinceValue =
    drilldown ? provinceData.find((item) => item.code === drilldown.code)?.value ?? 0 : 0;
  const currentCityData =
    drilldown && provinceFeatures[drilldown.code]
      ? buildCityHeatData(
          drilldown,
          provinceFeatures[drilldown.code],
          activities,
          currentProvinceValue,
          getFallbackActivityLabel,
        )
      : [];

  const loadProvinceMap = async (provinceCode: string) => {
    const mapKey = provinceMapKey(provinceCode);

    if (!provinceFeatures[provinceCode]) {
      setProvinceLoadingCode(provinceCode);

      try {
        const response = await fetch(`/geojson/provinces/${provinceCode}.json`);

        if (!response.ok) {
          throw new Error(`Unable to fetch province map ${provinceCode}`);
        }

        const json = (await response.json()) as GeoJsonShape;
        const sanitizedJson = sanitizeProvinceGeoJson(provinceCode, json);

        if (!REGISTERED_MAP_KEYS.has(mapKey)) {
          echarts.registerMap(mapKey, sanitizedJson as never);
          REGISTERED_MAP_KEYS.add(mapKey);
        }

        startTransition(() => {
          setProvinceFeatures((current) => ({
            ...current,
            [provinceCode]: sanitizedJson.features,
          }));
        });
      } finally {
        setProvinceLoadingCode('');
      }

      return;
    }

    await registerMapFromUrl(mapKey, `/geojson/provinces/${provinceCode}.json`);
  };

  const handleMapClick = async (params: {
    data?: ProvinceHeatDatum | CityHeatDatum;
    name: string;
  }) => {
    if (!drilldown) {
      const clickedProvinceFromData =
        params.data &&
        typeof params.data === 'object' &&
        'code' in params.data &&
        typeof params.data.code === 'string'
          ? (params.data as ProvinceHeatDatum)
          : undefined;
      const clickedProvince =
        clickedProvinceFromData ??
        provinceData.find((item) => item.name === params.name);

      if (!clickedProvince) {
        return;
      }

      const province = getProvinceByCode(clickedProvince.code);

      if (!province) {
        return;
      }

      try {
        await loadProvinceMap(province.code);
        startTransition(() => {
          setDrilldown({
            code: province.code,
            name: province.mapName,
            displayName: province.displayName,
          });
        });
      } catch {
        setMapError(t('home.mapError'));
      }

      return;
    }

    const clickedCityFromData =
      params.data &&
      typeof params.data === 'object' &&
      'searchKey' in params.data &&
      typeof params.data.searchKey === 'string'
        ? (params.data as CityHeatDatum)
        : undefined;
    const clickedCity =
      clickedCityFromData ??
      currentCityData.find((item) => item.name === params.name);

    if (!clickedCity) {
      return;
    }

    navigate(`/activities?region=${encodeURIComponent(clickedCity.searchKey)}&sort=hot`);
  };

  const chartOption = drilldown
    ? {
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'item',
          backgroundColor: '#0f172a',
          borderColor: '#fb7185',
          textStyle: {
            color: '#fff7ed',
          },
          formatter: (params: { data?: CityHeatDatum; name: string }) => {
            const datumFromData =
              params.data &&
              typeof params.data === 'object' &&
              'searchKey' in params.data &&
              typeof params.data.searchKey === 'string'
                ? (params.data as CityHeatDatum)
                : undefined;
            const datum =
              datumFromData ?? currentCityData.find((item) => item.name === params.name);

            if (!datum) {
              return params.name || '';
            }

            return [
              `<div style="font-weight:700;margin-bottom:6px;">${getCityLabel(
                datum.searchKey,
                datum.displayName,
              )}</div>`,
              `<div>${t('home.mapTooltipCount', { count: datum.value })}</div>`,
              `<div style="max-width:240px;white-space:normal;">${t('home.mapTooltipTopActivity', { title: datum.topActivityTitle })}</div>`,
            ].join('');
          },
        },
        visualMap: {
          min: 0,
          max: Math.max(...currentCityData.map((item) => item.value), 1),
          show: false,
          inRange: {
            color: ['#fff1eb', '#fda4af', '#fb7185', '#e11d48'],
          },
        },
        series: [
          {
            type: 'map',
            map: provinceMapKey(drilldown.code),
            roam: false,
            layoutCenter: ['50%', '57%'],
            layoutSize: '72%',
            label: {
              show: false,
            },
            emphasis: {
              scale: true,
              itemStyle: {
                areaColor: '#fb7185',
                borderColor: '#f8fafc',
                borderWidth: 1.5,
              },
              label: {
                show: false,
              },
            },
            itemStyle: {
              areaColor: '#f8fafc',
              borderColor: '#cbd5e1',
              borderWidth: 1.15,
            },
            data: currentCityData,
          },
        ],
      }
    : {
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'item',
          backgroundColor: '#0f172a',
          borderColor: '#fb7185',
          textStyle: {
            color: '#fff7ed',
          },
          formatter: (params: { data?: ProvinceHeatDatum; name: string }) => {
            const datumFromData =
              params.data &&
              typeof params.data === 'object' &&
              'code' in params.data &&
              typeof params.data.code === 'string'
                ? (params.data as ProvinceHeatDatum)
                : undefined;
            const datum =
              datumFromData ?? provinceData.find((item) => item.name === params.name);

            if (!datum) {
              return params.name || '';
            }

            return [
              `<div style="font-weight:700;margin-bottom:6px;">${getProvinceLabel(
                datum.code,
                datum.displayName,
              )}</div>`,
              `<div>${t('home.mapTooltipCount', { count: datum.value })}</div>`,
              `<div style="max-width:240px;white-space:normal;">${t('home.mapTooltipTopActivity', { title: datum.topActivityTitle })}</div>`,
            ].join('');
          },
        },
        visualMap: {
          min: 0,
          max: maxProvinceValue,
          show: false,
          inRange: {
            color: ['#fff1eb', '#fdba74', '#fb7185', '#e11d48'],
          },
        },
        series: [
          {
            type: 'map',
            map: CHINA_MAP_KEY,
            roam: false,
            layoutCenter: ['50%', '63%'],
            layoutSize: '79%',
            label: {
              show: false,
            },
            emphasis: {
              scale: true,
              itemStyle: {
                areaColor: '#fb7185',
                borderColor: '#f8fafc',
                borderWidth: 1.5,
              },
              label: {
                show: false,
              },
            },
            itemStyle: {
              areaColor: '#f8fafc',
              borderColor: '#cbd5e1',
              borderWidth: 1.15,
            },
            data: provinceData,
          },
        ],
      };

  return (
    <section className="relative overflow-hidden bg-white">
      {/* Full-bleed chart — header overlaid on top */}
      {isLoading || !nationalReady ? (
        <div className="animate-pulse" style={{ height: 560 }} />
      ) : mapError ? (
        <div
          className="flex items-center justify-center px-6 text-center text-sm leading-7 text-slate-500"
          style={{ height: 560 }}
        >
          {mapError}
        </div>
      ) : (
        <div className="relative">
          <ReactECharts
            echarts={echarts}
            option={chartOption}
            notMerge
            lazyUpdate
            onEvents={{ click: handleMapClick }}
            style={{ height: 560, width: '100%', background: 'transparent' }}
          />

          {/* Title overlay — top-left */}
          <div className="absolute left-6 top-6 z-20">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-rose-400">
              {t('home.mapEyebrow')}
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900 lg:text-3xl">
              {drilldown
                ? t('home.mapDrilldownTitle', {
                    province: getProvinceLabel(drilldown.code, drilldown.displayName),
                  })
                : t('home.mapTitle')}
            </h2>
            <div className="mt-2">
              {drilldown ? (
                <button
                  type="button"
                  onClick={() => setDrilldown(null)}
                  className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-sm transition hover:text-rose-600"
                >
                  <ArrowLeft size={16} />
                  {t('home.mapBack')}
                </button>
              ) : (
                <div className="hidden items-center gap-1.5 text-sm font-medium text-slate-500 lg:flex">
                  <MapPinned size={14} className="text-rose-400" />
                  {t('home.mapHint')}
                </div>
              )}
            </div>
          </div>

          {/* Legend — top-right */}
          <div className="absolute right-6 top-6 z-20 flex flex-col items-center gap-1.5 rounded-2xl border border-rose-100 bg-white/80 px-3 py-3 shadow-sm backdrop-blur-sm">
            <span className="text-[10px] font-semibold tracking-[0.14em] text-slate-500">
              {t('home.mapLegendHigh')}
            </span>
            <div
              className="w-2 rounded-full"
              style={{
                height: 72,
                background: 'linear-gradient(0deg,#fff1eb 0%,#fdba74 35%,#fb7185 70%,#e11d48 100%)',
              }}
            />
            <span className="text-[10px] font-semibold tracking-[0.14em] text-slate-500">
              {t('home.mapLegendLow')}
            </span>
          </div>

          {provinceLoadingCode ? (
            <div className="absolute inset-x-4 bottom-4 z-20 rounded-2xl bg-slate-900/90 px-4 py-3 text-sm text-white">
              {t('home.mapLoadingProvince', {
                province: getProvinceLabel(
                  provinceLoadingCode,
                  getProvinceByCode(provinceLoadingCode)?.displayName ?? '',
                ),
              })}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
