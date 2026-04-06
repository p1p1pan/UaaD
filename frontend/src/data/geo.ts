export interface ProvinceMeta {
  code: string;
  mapName: string;
  displayName: string;
  aliases: string[];
}

export const PROVINCES: ProvinceMeta[] = [
  { code: '110000', mapName: '北京市', displayName: '北京', aliases: ['北京', '北京市'] },
  { code: '120000', mapName: '天津市', displayName: '天津', aliases: ['天津', '天津市'] },
  { code: '130000', mapName: '河北省', displayName: '河北', aliases: ['河北', '河北省'] },
  { code: '140000', mapName: '山西省', displayName: '山西', aliases: ['山西', '山西省'] },
  { code: '150000', mapName: '内蒙古自治区', displayName: '内蒙古', aliases: ['内蒙古', '内蒙古自治区'] },
  { code: '210000', mapName: '辽宁省', displayName: '辽宁', aliases: ['辽宁', '辽宁省'] },
  { code: '220000', mapName: '吉林省', displayName: '吉林', aliases: ['吉林', '吉林省'] },
  { code: '230000', mapName: '黑龙江省', displayName: '黑龙江', aliases: ['黑龙江', '黑龙江省'] },
  { code: '310000', mapName: '上海市', displayName: '上海', aliases: ['上海', '上海市'] },
  { code: '320000', mapName: '江苏省', displayName: '江苏', aliases: ['江苏', '江苏省'] },
  { code: '330000', mapName: '浙江省', displayName: '浙江', aliases: ['浙江', '浙江省'] },
  { code: '340000', mapName: '安徽省', displayName: '安徽', aliases: ['安徽', '安徽省'] },
  { code: '350000', mapName: '福建省', displayName: '福建', aliases: ['福建', '福建省'] },
  { code: '360000', mapName: '江西省', displayName: '江西', aliases: ['江西', '江西省'] },
  { code: '370000', mapName: '山东省', displayName: '山东', aliases: ['山东', '山东省'] },
  { code: '410000', mapName: '河南省', displayName: '河南', aliases: ['河南', '河南省'] },
  { code: '420000', mapName: '湖北省', displayName: '湖北', aliases: ['湖北', '湖北省'] },
  { code: '430000', mapName: '湖南省', displayName: '湖南', aliases: ['湖南', '湖南省'] },
  { code: '440000', mapName: '广东省', displayName: '广东', aliases: ['广东', '广东省'] },
  { code: '450000', mapName: '广西壮族自治区', displayName: '广西', aliases: ['广西', '广西壮族自治区'] },
  { code: '460000', mapName: '海南省', displayName: '海南', aliases: ['海南', '海南省'] },
  { code: '500000', mapName: '重庆市', displayName: '重庆', aliases: ['重庆', '重庆市'] },
  { code: '510000', mapName: '四川省', displayName: '四川', aliases: ['四川', '四川省'] },
  { code: '520000', mapName: '贵州省', displayName: '贵州', aliases: ['贵州', '贵州省'] },
  { code: '530000', mapName: '云南省', displayName: '云南', aliases: ['云南', '云南省'] },
  { code: '540000', mapName: '西藏自治区', displayName: '西藏', aliases: ['西藏', '西藏自治区'] },
  { code: '610000', mapName: '陕西省', displayName: '陕西', aliases: ['陕西', '陕西省'] },
  { code: '620000', mapName: '甘肃省', displayName: '甘肃', aliases: ['甘肃', '甘肃省'] },
  { code: '630000', mapName: '青海省', displayName: '青海', aliases: ['青海', '青海省'] },
  { code: '640000', mapName: '宁夏回族自治区', displayName: '宁夏', aliases: ['宁夏', '宁夏回族自治区'] },
  { code: '650000', mapName: '新疆维吾尔自治区', displayName: '新疆', aliases: ['新疆', '新疆维吾尔自治区'] },
  { code: '710000', mapName: '台湾省', displayName: '台湾', aliases: ['台湾', '台湾省'] },
  { code: '810000', mapName: '香港特别行政区', displayName: '香港', aliases: ['香港', '香港特别行政区'] },
  { code: '820000', mapName: '澳门特别行政区', displayName: '澳门', aliases: ['澳门', '澳门特别行政区'] },
];

export const MUNICIPALITY_CODES = new Set(['110000', '120000', '310000', '500000', '810000', '820000']);

const CITY_TO_PROVINCE_MAP: Record<string, string> = {
  北京: '110000',
  天津: '120000',
  石家庄: '130000',
  唐山: '130000',
  秦皇岛: '130000',
  保定: '130000',
  太原: '140000',
  大同: '140000',
  呼和浩特: '150000',
  包头: '150000',
  鄂尔多斯: '150000',
  沈阳: '210000',
  大连: '210000',
  长春: '220000',
  哈尔滨: '230000',
  上海: '310000',
  南京: '320000',
  苏州: '320000',
  无锡: '320000',
  常州: '320000',
  徐州: '320000',
  南通: '320000',
  杭州: '330000',
  宁波: '330000',
  温州: '330000',
  绍兴: '330000',
  金华: '330000',
  合肥: '340000',
  芜湖: '340000',
  福州: '350000',
  厦门: '350000',
  泉州: '350000',
  南昌: '360000',
  赣州: '360000',
  济南: '370000',
  青岛: '370000',
  烟台: '370000',
  潍坊: '370000',
  郑州: '410000',
  洛阳: '410000',
  开封: '410000',
  武汉: '420000',
  宜昌: '420000',
  长沙: '430000',
  株洲: '430000',
  广州: '440000',
  深圳: '440000',
  佛山: '440000',
  东莞: '440000',
  珠海: '440000',
  中山: '440000',
  南宁: '450000',
  桂林: '450000',
  柳州: '450000',
  海口: '460000',
  三亚: '460000',
  重庆: '500000',
  成都: '510000',
  绵阳: '510000',
  德阳: '510000',
  乐山: '510000',
  贵阳: '520000',
  遵义: '520000',
  昆明: '530000',
  大理: '530000',
  丽江: '530000',
  拉萨: '540000',
  西安: '610000',
  咸阳: '610000',
  兰州: '620000',
  西宁: '630000',
  银川: '640000',
  乌鲁木齐: '650000',
  香港: '810000',
  澳门: '820000',
};

export const PROVINCE_BY_CODE = Object.fromEntries(
  PROVINCES.map((province) => [province.code, province]),
) as Record<string, ProvinceMeta>;

export const PROVINCE_BY_MAP_NAME = Object.fromEntries(
  PROVINCES.map((province) => [province.mapName, province]),
) as Record<string, ProvinceMeta>;

export function simplifyRegionName(value: string) {
  return value
    .replace(/特别行政区/g, '')
    .replace(/维吾尔自治区|回族自治区|壮族自治区|自治区/g, '')
    .replace(/自治州/g, '')
    .replace(/地区/g, '')
    .replace(/盟/g, '')
    .replace(/省/g, '')
    .replace(/市/g, '')
    .trim();
}

export function getProvinceByCode(code: string) {
  return PROVINCE_BY_CODE[code] ?? null;
}

export function inferProvinceByLocation(location: string) {
  const directMatch = PROVINCES.find((province) =>
    province.aliases.some((alias) => location.includes(alias)),
  );

  if (directMatch) {
    return directMatch;
  }

  const cityEntry = Object.entries(CITY_TO_PROVINCE_MAP).find(([city]) =>
    location.includes(city),
  );

  if (!cityEntry) {
    return null;
  }

  return PROVINCE_BY_CODE[cityEntry[1]] ?? null;
}

export function inferCitySearchKey(location: string, provinceCode: string) {
  if (MUNICIPALITY_CODES.has(provinceCode)) {
    return getProvinceByCode(provinceCode)?.displayName ?? simplifyRegionName(location);
  }

  const cityEntry = Object.keys(CITY_TO_PROVINCE_MAP).find((city) => location.includes(city));

  if (cityEntry) {
    return cityEntry;
  }

  return simplifyRegionName(location);
}
