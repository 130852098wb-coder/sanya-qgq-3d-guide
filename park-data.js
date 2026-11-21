// 三亚千古情景区 1:1 3D导览图核心数据模块 (ES Module)
// 坐标系约定：以导游图中心(u0=535, v0=300)为世界原点(0,0,0)
// +X 指向画面右下(东南)，+Y 垂直向上(高度)，+Z 指向画面左下(西南入口方向；-Z 指向园区纵深东北)

export const MAP_CALIBRATION = {
  imageWidth: 1070,
  imageHeight: 600,
  u0: 535.0,
  v0: 300.0,
  pixelsPerMeter: 2.0,
  thetaDeg: 38.52,
  phiDeg: 36.37,
  referenceImage: './assets/reference_map.png',
};

const THETA = (MAP_CALIBRATION.thetaDeg * Math.PI) / 180;
const PHI = (MAP_CALIBRATION.phiDeg * Math.PI) / 180;
const COS_T = Math.cos(THETA);
const SIN_T = Math.sin(THETA);
const COS_P = Math.cos(PHI);
const SIN_P = Math.sin(PHI);

// WGS84，迎宾路333号。园区纵深（世界 -Z）的方位角从真北顺时针量起。
export const PARK_GEO_ANCHOR = {
  lat: 18.2915, lng: 109.5311, originXZ: { x: 0, z: 0 }, headingDeg: 45, parkRadiusMeters: 650,
};

export function geoToParkXZ(lat, lng) {
  const anchor = PARK_GEO_ANCHOR;
  const rad = Math.PI / 180;
  const lat0 = anchor.lat * rad, lat1 = lat * rad, dLng = (lng - anchor.lng) * rad;
  const a = Math.sin((lat1 - lat0) / 2) ** 2 + Math.cos(lat0) * Math.cos(lat1) * Math.sin(dLng / 2) ** 2;
  const distanceFromParkMeters = 2 * 6371008.8 * Math.asin(Math.sqrt(Math.min(1, a)));
  const bearing = Math.atan2(Math.sin(dLng) * Math.cos(lat1),
    Math.cos(lat0) * Math.sin(lat1) - Math.sin(lat0) * Math.cos(lat1) * Math.cos(dLng));
  const localAngle = bearing - anchor.headingDeg * rad;
  return {
    x: anchor.originXZ.x + distanceFromParkMeters * Math.sin(localAngle),
    z: anchor.originXZ.z - distanceFromParkMeters * Math.cos(localAngle),
    distanceFromParkMeters,
    inPark: distanceFromParkMeters <= anchor.parkRadiusMeters,
  };
}

// 导游图地面像素(u, v)反解为3D地面世界坐标(x, z)，单位：米
export function uvToXZ(u, v) {
  const du = (u - MAP_CALIBRATION.u0) / MAP_CALIBRATION.pixelsPerMeter;
  const dv = (v - MAP_CALIBRATION.v0) / MAP_CALIBRATION.pixelsPerMeter;
  const q = dv / SIN_P;
  const x = du * COS_T + q * SIN_T;
  const z = -du * SIN_T + q * COS_T;
  return { x: Number(x.toFixed(2)), z: Number(z.toFixed(2)) };
}

// 3D世界坐标(x, y, z)正投回1070x600原图像素坐标(u, v)，用于1:1叠图校准
export function xyzToUV(x, y, z) {
  const du = x * COS_T - z * SIN_T;
  const dv = (x * SIN_T + z * COS_T) * SIN_P - y * COS_P;
  return {
    u: Number((MAP_CALIBRATION.u0 + du * MAP_CALIBRATION.pixelsPerMeter).toFixed(1)),
    v: Number((MAP_CALIBRATION.v0 + dv * MAP_CALIBRATION.pixelsPerMeter).toFixed(1)),
  };
}

// 由原图建筑西角地面点(uw,vw)、北角(un,vn)、南角(us,vs)换算3D矩形体块参数
export function rectFromCorners(uw, vw, un, vn, us, vs, height) {
  const w = uvToXZ(uw, vw);
  const n = uvToXZ(un, vn);
  const s = uvToXZ(us, vs);
  const dxN = n.x - w.x;
  const dzN = n.z - w.z;
  const dxS = s.x - w.x;
  const dzS = s.z - w.z;
  return {
    cx: Number((w.x + 0.5 * (dxN + dxS)).toFixed(2)),
    cz: Number((w.z + 0.5 * (dzN + dzS)).toFixed(2)),
    wx: Number(Math.hypot(dxS, dzS).toFixed(2)),
    dz: Number(Math.hypot(dxN, dzN).toFixed(2)),
    h: height,
    yawRad: Number(Math.atan2(dzS, dxS).toFixed(4)),
  };
}

export const PARK_ZONES = [
  { id: 'all', name: '全部区域', color: '#E85D3F' },
  { id: 'entrance', name: '入口门头区', color: '#D97724' },
  { id: 'theaters', name: '核心剧院区', color: '#C8372D' },
  { id: 'streets', name: '主题街区', color: '#2B6CB0' },
  { id: 'villages', name: '黎苗民俗区', color: '#2F855A' },
  { id: 'adventure', name: '奇幻游乐区', color: '#6B46C1' },
];

// 导游图标注点位及可单独导航的南海女神门头。
export const PARK_VENUES = [
  {
    id: 'entrance',
    name: '景区入口',
    zone: 'entrance',
    badgeType: 'gate',
    uv: [452, 502],
    pinHeight: 16,
    roadNode: 'n_gate_outer',
    footprint: null,
    summary: '迎宾路333号景区主牌坊入口，经图腾大道直通南海女神门头检票大厅。',
  },
  {
    id: 'totem_ave',
    name: '图腾大道',
    zone: 'entrance',
    badgeType: 'red',
    uv: [485, 456],
    pinHeight: 13,
    roadNode: 'n_totem_mid',
    footprint: [432, 488, 506, 430, 476, 514, 1.2],
    summary: '两侧矗立8根黎苗文化彩绘神柱的迎宾礼仪石阶大道，连接牌坊与南海女神造像门头。',
  },
  {
    id: 'goddess_portal',
    name: '南海女神门头',
    zone: 'entrance',
    badgeType: 'gate',
    uv: [522, 418],
    pinHeight: 24,
    roadNode: 'n_portal_hall',
    footprint: null,
    summary: '沿图腾大道抵达的检票门头，可在此欣赏南海女神造像与白象群雕。',
  },
  {
    id: 'gift_shop',
    name: '千古情礼品店',
    zone: 'entrance',
    badgeType: 'blue',
    uv: [376, 355],
    pinHeight: 11,
    roadNode: 'n_gift_front',
    footprint: [362, 356, 386, 338, 395, 372, 9.0],
    summary: '位于爱情广场西侧林荫步道的文创伴手礼商铺，临近2号剧院出口动线。',
  },
  {
    id: 'love_plaza',
    name: '爱情广场',
    zone: 'entrance',
    badgeType: 'red',
    uv: [478, 344],
    pinHeight: 8,
    roadNode: 'n_love_plaza',
    footprint: null,
    summary: '穿过南海女神门头后的入园首站集散广场，西通两大剧院与喊泉，东北接爱情街。',
  },
  {
    id: 'shouting_fountain',
    name: '喊泉',
    zone: 'streets',
    badgeType: 'blue',
    uv: [396, 302],
    pinHeight: 15,
    roadNode: 'n_fountain_front',
    footprint: [348, 298, 392, 265, 382, 315, 14.0],
    waterPool: [386, 316, 442, 274, 406, 328, 1.2],
    summary: '重檐歇山古亭与长条蓝砖喷泉池组合景观，声控水柱随呼喊分贝冲高，背靠火焰火山假山。',
  },
  {
    id: 'theater_2',
    name: '千古情2号剧院',
    zone: 'theaters',
    badgeType: 'red',
    uv: [252, 352],
    pinHeight: 28,
    roadNode: 'n_theater2_gate',
    footprint: [196, 362, 276, 302, 280, 402, 25.0],
    summary: '朱红墙体配鎏金雕花门楼的大型实景剧场，常驻上演5D实景剧《大地震》等剧目（不对票入座，先到先得）。',
  },
  {
    id: 'theater_1',
    name: '千古情1号剧院',
    zone: 'theaters',
    badgeType: 'red',
    uv: [152, 286],
    pinHeight: 29,
    roadNode: 'n_theater1_east',
    footprint: [72, 312, 195, 218, 150, 350, 26.0],
    summary: '景区核心主剧场，西南外立面嵌山石瀑布造景，上演王牌大型歌舞《三亚千古情》及大厅亲子互动演出。',
  },
  {
    id: 'hainan_battle',
    name: '海南岛战役',
    zone: 'theaters',
    badgeType: 'blue',
    uv: [164, 214],
    pinHeight: 24,
    roadNode: 'n_battle_entry',
    footprint: [72, 282, 188, 194, 88, 290, 22.0],
    summary: '毗邻1号剧院北翼的沉浸式走动演出馆，以实景水火特效重现琼州海峡渡海作战历史场景。',
  },
  {
    id: 'phantom_space',
    name: '幻影空间',
    zone: 'adventure',
    badgeType: 'blue',
    uv: [252, 232],
    pinHeight: 18,
    roadNode: 'n_theater1_east',
    footprint: [232, 232, 255, 214, 272, 252, 16.0],
    summary: '位于千古情广场西侧、1号剧院门厅旁的裸眼动感体验馆，分时段轮播《星际奇遇》《恐龙新纪元》《八大奇迹》。',
  },
  {
    id: 'romance_plaza',
    name: '千古情广场',
    zone: 'theaters',
    badgeType: 'red',
    uv: [338, 244],
    pinHeight: 9,
    roadNode: 'n_romance_plaza',
    footprint: null,
    summary: '圆形放射纹石砌中心演艺广场，北倚丹霞崖壁与风情街廊柱，夜间举办《解忧空间》音乐狂欢秀及街头互动。',
  },
  {
    id: 'exotic_street',
    name: '风情街',
    zone: 'streets',
    badgeType: 'red',
    uv: [452, 184],
    pinHeight: 18,
    roadNode: 'n_exotic_ne',
    footprint: [406, 214, 492, 148, 436, 228, 16.0],
    summary: '异域沙岩城堡与图腾柱廊交织的主题商业街区，定时上演古彩戏法《通天戏法》等街头演艺。',
  },
  {
    id: 'lijin_hall',
    name: '黎锦文化馆',
    zone: 'streets',
    badgeType: 'blue',
    uv: [466, 252],
    pinHeight: 13,
    roadNode: 'n_love_st_sw',
    footprint: [432, 268, 498, 218, 466, 286, 11.0],
    summary: '青瓦坡顶传统院落展馆，展示海南黎族纺染织绣非遗技艺与传统织锦器物。',
  },
  {
    id: 'love_street',
    name: '爱情街',
    zone: 'streets',
    badgeType: 'red',
    uv: [538, 204],
    pinHeight: 13,
    roadNode: 'n_love_st_ne',
    footprint: [498, 218, 578, 158, 532, 236, 11.0],
    summary: '串联爱情广场、美食广场与绣楼广场的中轴古风商业步街，两侧排布特色茶饮、旅拍与手作铺面。',
  },
  {
    id: 'interactive_hall',
    name: '互动游乐馆',
    zone: 'adventure',
    badgeType: 'blue',
    uv: [612, 356],
    pinHeight: 28,
    roadNode: 'n_love_st_ne',
    footprint: [520, 357, 594, 302, 681, 433, 26.0],
    portalHall: [476, 392, 515, 362, 608, 456, 17.0],
    summary: '与南海女神门头相连的超大体量室内综合馆（外墙饰白象群雕），全天轮演《东坡学堂》《江湖密令》《胡姬夜宴》等沉浸互动。',
  },
  {
    id: 'food_plaza',
    name: '美食广场',
    zone: 'streets',
    badgeType: 'blue',
    uv: [586, 146],
    pinHeight: 15,
    roadNode: 'n_food_south',
    footprint: [520, 156, 602, 95, 605, 198, 13.0],
    summary: '合院式青瓦飞檐餐饮聚落，汇集海南抱罗粉、清补凉、热带鲜果及各地风味小吃，内设免费休息处。',
  },
  {
    id: 'horror_inst',
    name: '恐怖研究院',
    zone: 'adventure',
    badgeType: 'blue',
    uv: [620, 86],
    pinHeight: 16,
    roadNode: 'n_food_north',
    footprint: [590, 88, 636, 54, 642, 112, 14.0],
    summary: '位于园区北端林荫深处的主题鬼屋体验馆，以复古实验院落场景打造沉浸惊悚动线。',
  },
  {
    id: 'miao_village',
    name: '苗寨',
    zone: 'villages',
    badgeType: 'red',
    uv: [684, 96],
    pinHeight: 17,
    roadNode: 'n_miao_front',
    footprint: [636, 98, 695, 56, 712, 134, 15.0],
    summary: '依喀斯特奇石叠建的木构吊脚楼与瞭望塔聚落，与黎村相连，呈现海南苗族山寨风貌与民俗演艺。',
  },
  {
    id: 'romance_inn',
    name: '千古情客栈',
    zone: 'streets',
    badgeType: 'red',
    uv: [698, 154],
    pinHeight: 15,
    roadNode: 'n_yazhou_west',
    footprint: [672, 152, 704, 128, 756, 192, 12.0],
    northWing: [566, 118, 594, 96, 656, 160, 13.0],
    summary: '沿北街铺展的二层古风木构客栈建筑群，衔接美食广场、苗寨与崖州古街。',
  },
  {
    id: 'tie_dye_hall',
    name: '扎染文化馆',
    zone: 'villages',
    badgeType: 'blue',
    uv: [726, 192],
    pinHeight: 12,
    roadNode: 'n_yazhou_west',
    footprint: [704, 192, 730, 172, 745, 212, 10.0],
    summary: '绣楼广场北侧的传统草木蓝染非遗工坊，展示古法扎染布艺与手工体验。',
  },
  {
    id: 'xiulou_plaza',
    name: '绣楼广场',
    zone: 'villages',
    badgeType: 'red',
    uv: [736, 260],
    pinHeight: 24,
    roadNode: 'n_xiulou_plaza',
    footprint: [652, 206, 678, 186, 686, 222, 22.0],
    summary: '以三层朱红鎏金重檐绣楼为地标的东区核心演艺广场，每日定时上演民俗互动《黎寨招亲》。',
  },
  {
    id: 'li_village',
    name: '黎村',
    zone: 'villages',
    badgeType: 'red',
    uv: [804, 136],
    pinHeight: 13,
    roadNode: 'n_li_village',
    footprint: [735, 132, 795, 86, 865, 192, 10.0],
    summary: '还原海南黎族传统茅草船型屋聚落与椰林院落，定时上演《黎椰传习所》《岭南风云》等互动演出。',
  },
  {
    id: 'yazhou_street',
    name: '崖州古街',
    zone: 'streets',
    badgeType: 'red',
    uv: [802, 196],
    pinHeight: 15,
    roadNode: 'n_yazhou_mid',
    footprint: [756, 188, 788, 164, 848, 232, 12.5],
    summary: '古崖州骑楼木廊与牌坊街巷，高频上演NPC互动《一千零一夜》、快闪秀《穿越快闪》及非遗演艺。',
  },
  {
    id: 'virtual_space',
    name: '虚拟空间',
    zone: 'adventure',
    badgeType: 'blue',
    uv: [848, 198],
    pinHeight: 17,
    roadNode: 'n_virtual_front',
    footprint: [810, 200, 858, 166, 868, 228, 15.0],
    summary: '崖州古街东端的米黄石砌拱窗科技体验馆，分时段轮播《地心幽境》《天空之城》《深海探险》。',
  },
  {
    id: 'elf_valley',
    name: '精灵谷',
    zone: 'adventure',
    badgeType: 'red',
    uv: [948, 156],
    pinHeight: 14,
    roadNode: 'n_parrot_elf',
    footprint: [912, 158, 952, 128, 982, 188, 12.0],
    summary: '园区东北角童话茅草蘑菇屋与花园秘境，适合亲子漫步与童趣打卡。',
  },
  {
    id: 'parrot_dance',
    name: '鹦歌燕舞',
    zone: 'adventure',
    badgeType: 'blue',
    uv: [944, 202],
    pinHeight: 13,
    roadNode: 'n_parrot_elf',
    footprint: [902, 198, 938, 172, 982, 234, 11.0],
    summary: '紧邻精灵谷的红木栈道户外亲子攀爬滑梯与萌宠飞禽互动游乐区。',
  },
  {
    id: 'water_play',
    name: '戏水区',
    zone: 'adventure',
    badgeType: 'blue',
    uv: [792, 304],
    pinHeight: 6,
    roadNode: 'n_water_west',
    footprint: [752, 316, 816, 268, 814, 346, 1.5],
    summary: '绣楼广场东南侧的蓝绿方格浅水互动闯关池，配有遮阳凉亭与亲水栈桥。',
  },
  {
    id: 'ghost_domain',
    name: '天涯鬼域',
    zone: 'adventure',
    badgeType: 'blue',
    uv: [824, 376],
    pinHeight: 17,
    roadNode: 'n_ghost_entry',
    footprint: [762, 412, 818, 368, 822, 440, 15.0],
    corridorWing: [822, 385, 952, 286, 858, 402, 14.0],
    summary: '沿园区东南边界绵延的大型古宅长廊式实景鬼屋，开放时间覆盖午间至夜间闭园前。',
  },
];

// 原图未单独挂牌但构成1:1空间轮廓的关键景观体块（供scene-3d建模使用）
export const EXTRA_STRUCTURES = [
  { id: 'front_gallery_west', name: '剧院前商业长廊西翼', rect: [94, 356, 134, 326, 232, 418, 8.5] },
  { id: 'front_gallery_south', name: '剧院前商业长廊南翼', rect: [214, 404, 316, 330, 274, 434, 8.5] },
  { id: 'cliff_colonnade_west', name: '千古情广场北侧图腾廊柱', rect: [228, 132, 252, 114, 342, 188, 11.0] },
  { id: 'cliff_colonnade_east', name: '风情街北侧丹霞柱廊', rect: [342, 188, 524, 52, 366, 204, 11.5] },
  { id: 'volcano_rockery', name: '千古情广场火焰山假山', uv: [396, 242], radius: 16, height: 21.0 },
  { id: 'yazhou_wood_arch', name: '绣楼东侧古木牌楼', rect: [776, 236, 796, 220, 816, 256, 13.0] },
];

// 导游图右下角图例完整12类服务设施定义
export const FACILITY_TYPES = [
  { id: 'ticket', name: '售票处', color: '#5A626A', badge: '票' },
  { id: 'eticket', name: '电子换票处', color: '#5A626A', badge: '换' },
  { id: 'luggage', name: '寄存处', color: '#5A626A', badge: '存' },
  { id: 'restroom', name: '洗手间', color: '#1E88E5', badge: '卫' },
  { id: 'accessible_wc', name: '无障碍卫生间', color: '#5A626A', badge: '无' },
  { id: 'accessible', name: '残疾人设施', color: '#5A626A', badge: '助' },
  { id: 'water', name: '免费饮水', color: '#5A626A', badge: '水' },
  { id: 'rest_area', name: '免费休息处', color: '#5A626A', badge: '休' },
  { id: 'driver_rest', name: '司陪休息处', color: '#5A626A', badge: '司' },
  { id: 'medical', name: '医务室', color: '#1B8A3D', badge: '医' },
  { id: 'parking', name: '停车场', color: '#6E747C', badge: 'P' },
  { id: 'bus', name: '公交站点', color: '#6E747C', badge: '巴' },
];

// 原图实标服务设施坐标点位
export const SERVICE_FACILITIES = [
  { id: 'wc_theater1_n', type: 'restroom', name: '洗手间（1号剧院北侧）', uv: [150, 218], roadNode: 'n_battle_entry' },
  { id: 'wc_theater1_e', type: 'restroom', name: '洗手间（1号剧院东廊）', uv: [224, 276], roadNode: 'n_theater1_east' },
  { id: 'wc_theater2_w', type: 'restroom', name: '洗手间（2号剧院正门侧）', uv: [216, 326], roadNode: 'n_theater2_gate' },
  { id: 'wc_gate_e', type: 'restroom', name: '洗手间（入口门头东侧）', uv: [586, 400], roadNode: 'n_portal_hall' },
  { id: 'wc_love_st', type: 'restroom', name: '洗手间（爱情街北口）', uv: [622, 212], roadNode: 'n_love_st_ne' },
  { id: 'wc_inn_s', type: 'restroom', name: '洗手间（绣楼北侧）', uv: [675, 165], roadNode: 'n_xiulou_nw' },
  { id: 'wc_miao_w', type: 'restroom', name: '洗手间（苗寨前街）', uv: [668, 95], roadNode: 'n_miao_front' },
  { id: 'wc_ghost_n', type: 'restroom', name: '洗手间（天涯鬼域北口）', uv: [924, 252], roadNode: 'n_water_east' },
  { id: 'acc_wc_gate', type: 'accessible_wc', name: '无障碍卫生间（门头大厅）', uv: [588, 366], roadNode: 'n_portal_hall' },
  { id: 'acc_gate_ramp', type: 'accessible', name: '残疾人无障碍通道（检票口）', uv: [572, 378], roadNode: 'n_portal_hall' },
  { id: 'luggage_gate', type: 'luggage', name: '游客寄存处（门头东厅）', uv: [608, 366], roadNode: 'n_portal_hall' },
  { id: 'ticket_gate', type: 'ticket', name: '景区售票处（门头东翼）', uv: [602, 390], roadNode: 'n_totem_mid' },
  { id: 'eticket_gate', type: 'eticket', name: '电子换票处（门头自助厅）', uv: [595, 396], roadNode: 'n_totem_mid' },
  { id: 'water_gate', type: 'water', name: '免费饮水点（门头服务区）', uv: [584, 422], roadNode: 'n_totem_mid' },
  { id: 'medical_gate', type: 'medical', name: '景区医务室（入口东翼）', uv: [592, 438], roadNode: 'n_totem_mid' },
  { id: 'rest_food', type: 'rest_area', name: '免费休息处（美食广场中庭）', uv: [618, 126], roadNode: 'n_food_south' },
  { id: 'driver_ghost', type: 'driver_rest', name: '司陪休息处（东侧前院）', uv: [818, 406], roadNode: 'n_ghost_entry' },
  { id: 'parking_main', type: 'parking', name: '生态停车场（入口外广场）', uv: [584, 522], roadNode: 'n_gate_outer' },
  { id: 'bus_stop_main', type: 'bus', name: '千古情公交站点（迎宾路）', uv: [674, 558], roadNode: 'n_gate_outer' },
];

// 严格贴合导游图石板步道的真实步行路网拓扑节点
export const ROAD_NODES = {
  n_gate_outer: { uv: [452, 502], name: '景区牌坊口' },
  n_totem_mid: { uv: [486, 462], name: '图腾大道' },
  n_portal_hall: { uv: [522, 418], name: '门头检票口' },
  n_love_plaza: { uv: [472, 344], name: '爱情广场' },
  n_gift_front: { uv: [348, 348], name: '礼品店前步道' },
  n_fountain_front: { uv: [428, 322], name: '喊泉池东南侧步道' },
  n_theater2_gate: { uv: [192, 348], name: '2号剧院门前庭院' },
  n_romance_plaza: { uv: [338, 246], name: '千古情广场中心' },
  n_theater1_east: { uv: [256, 238], name: '1号剧院与幻影空间门前' },
  n_battle_entry: { uv: [208, 192], name: '海南岛战役入口' },
  n_exotic_sw: { uv: [398, 206], name: '风情街西段' },
  n_exotic_ne: { uv: [494, 158], name: '风情街东口' },
  n_love_st_sw: { uv: [514, 296], name: '爱情街南口' },
  n_love_st_ne: { uv: [590, 238], name: '爱情街北口' },
  n_food_south: { uv: [544, 194], name: '美食广场南口' },
  n_food_north: { uv: [586, 106], name: '恐怖研究院前街' },
  n_miao_front: { uv: [654, 118], name: '苗寨前街' },
  n_xiulou_nw: { uv: [652, 226], name: '绣楼西侧路口' },
  n_xiulou_plaza: { uv: [728, 262], name: '绣楼广场中心' },
  n_yazhou_west: { uv: [718, 198], name: '扎染馆与客栈南口' },
  n_yazhou_mid: { uv: [788, 218], name: '崖州古街中段' },
  n_li_village: { uv: [766, 152], name: '黎村巷口' },
  n_virtual_front: { uv: [852, 238], name: '虚拟空间门前' },
  n_parrot_elf: { uv: [918, 210], name: '精灵谷与鹦歌燕舞口' },
  n_water_west: { uv: [762, 294], name: '戏水区西步道' },
  n_water_east: { uv: [866, 258], name: '戏水区东侧通道' },
  n_ghost_entry: { uv: [776, 362], name: '天涯鬼域入口' },
};

export const ROAD_EDGES = [
  ['n_gate_outer', 'n_totem_mid'],
  ['n_totem_mid', 'n_portal_hall'],
  ['n_portal_hall', 'n_love_plaza'],
  ['n_love_plaza', 'n_gift_front'],
  ['n_love_plaza', 'n_fountain_front'],
  ['n_fountain_front', 'n_love_st_sw'],
  ['n_gift_front', 'n_theater2_gate'],
  ['n_theater2_gate', 'n_theater1_east'],
  ['n_romance_plaza', 'n_theater1_east'],
  ['n_theater1_east', 'n_battle_entry'],
  ['n_romance_plaza', 'n_exotic_sw'],
  ['n_exotic_sw', 'n_exotic_ne'],
  ['n_love_plaza', 'n_love_st_sw'],
  ['n_love_st_sw', 'n_love_st_ne'],
  ['n_love_st_ne', 'n_food_south'],
  ['n_food_south', 'n_exotic_ne'],
  ['n_exotic_ne', 'n_food_north'],
  ['n_food_north', 'n_miao_front'],
  ['n_miao_front', 'n_yazhou_west'],
  ['n_miao_front', 'n_li_village'],
  ['n_love_st_ne', 'n_xiulou_nw'],
  ['n_xiulou_nw', 'n_yazhou_west'],
  ['n_xiulou_nw', 'n_xiulou_plaza'],
  ['n_yazhou_west', 'n_yazhou_mid'],
  ['n_yazhou_mid', 'n_li_village'],
  ['n_yazhou_mid', 'n_xiulou_plaza'],
  ['n_yazhou_mid', 'n_virtual_front'],
  ['n_virtual_front', 'n_parrot_elf'],
  ['n_virtual_front', 'n_water_east'],
  ['n_xiulou_plaza', 'n_water_west'],
  ['n_water_west', 'n_water_east'],
  ['n_water_west', 'n_ghost_entry'],
  ['n_water_east', 'n_ghost_entry'],
];

// 源自三亚千古情实表（《5.6日起.xls》常态双场版 &《五一期间三场节目单.xls》假日三场版）及官网公告
export const OFFICIAL_NOTICES = [
  '【数据口径】营业时间(15:00-21:30)与主秀基础场次(17:00/20:00)已核对2026-11-21宋城官网实况；外场逐条排期暂用2025年5月实表占位，待替换为当日最新排期表。',
  '景区项目与演出会因天气、现场等实际情况进行调整或取消，具体以景区现场公告为准。',
  '《大地震》《WA!恐龙》等剧院演出不对票入座，先到先得，座满即止。',
  '景区地址：三亚市吉阳区迎宾路333号 ｜ 咨询热线：0898-88658333',
];

export const SCHEDULE_PRESETS = {
  regular_two_shows: {
    id: 'regular_two_shows',
    name: '常态双场版（15:00开演档）',
    openHours: '15:00 - 21:30',
    mainShowTimes: ['17:00', '20:00'],
    items: [
      { id: 'r1', title: '《虚拟空间》天空之城', time: '15:00-18:00', venueId: 'virtual_space', place: '黎村苗寨-虚拟空间', tag: '体验时长：6分钟/次' },
      { id: 'r2', title: '《幻影空间》星际奇遇', time: '15:00-18:00', venueId: 'phantom_space', place: '千古情广场-幻影空间', tag: '体验时长：6分钟/次' },
      { id: 'r3', title: '民俗表演《黎寨招亲》', time: '15:10-15:25', venueId: 'xiulou_plaza', place: '绣楼广场', tag: '抛绣球互动' },
      { id: 'r4', title: '5D实景剧《大地震》', time: '15:35-16:10', venueId: 'theater_2', place: '千古情2号剧院', tag: '先到先得' },
      { id: 'r5', title: 'NPC互动《一千零一夜》', time: '15:45-16:15', venueId: 'yazhou_street', place: '崖州古街', tag: '' },
      { id: 'r6', title: '古彩戏法《通天戏法》', time: '15:50-15:55', venueId: 'exotic_street', place: '风情街', tag: '' },
      { id: 'r7', title: '沉浸式互动《胡姬夜宴》', time: '16:05-16:10', venueId: 'interactive_hall', place: '互动游乐馆', tag: '' },
      { id: 'r8', title: '沉浸式互动《江湖密令》', time: '16:15-16:30', venueId: 'interactive_hall', place: '互动游乐馆', tag: '' },
      { id: 'r9', title: '互动快闪秀《穿越快闪》', time: '16:20-16:27', venueId: 'yazhou_street', place: '崖州古街', tag: '' },
      { id: 'r10', title: '沉浸式互动《东坡学堂》', time: '16:35-16:50', venueId: 'interactive_hall', place: '互动游乐馆', tag: '' },
      { id: 'r11', title: '野人模仿秀《黎椰传习所》', time: '16:40-16:50', venueId: 'li_village', place: '黎村苗寨', tag: '' },
      { id: 'r12', title: '大型歌舞《三亚千古情》', time: '17:00-18:00', venueId: 'theater_1', place: '千古情1号剧院', tag: '一生必看的演出', highlight: true },
      { id: 'r13', title: 'NPC互动《一千零一夜》', time: '17:10-17:40', venueId: 'yazhou_street', place: '崖州古街', tag: '' },
      { id: 'r14', title: '古彩戏法《通天戏法》', time: '17:15-17:20', venueId: 'exotic_street', place: '风情街', tag: '' },
      { id: 'r15', title: '亲子互动《沙滩咒语解码》', time: '17:40-17:50', venueId: 'theater_1', place: '1号剧院大厅', tag: '亲子互动' },
      { id: 'r16', title: '《虚拟空间》深海探险', time: '18:00-20:00', venueId: 'virtual_space', place: '黎村苗寨-虚拟空间', tag: '体验时长：6分钟/次' },
      { id: 'r17', title: '《幻影空间》恐龙新纪元', time: '18:00-20:00', venueId: 'phantom_space', place: '千古情广场-幻影空间', tag: '体验时长：6分钟/次' },
      { id: 'r18', title: 'NPC互动《岭南风云》', time: '18:05-18:35', venueId: 'yazhou_street', place: '黎村苗寨-崖州古街', tag: '' },
      { id: 'r19', title: '野人模仿秀《黎椰传习所》', time: '18:10-18:25', venueId: 'li_village', place: '黎村苗寨', tag: '' },
      { id: 'r20', title: '沉浸式互动《江湖密令》', time: '18:10-18:25', venueId: 'interactive_hall', place: '互动游乐馆', tag: '' },
      { id: 'r21', title: '沉浸式互动《胡姬夜宴》', time: '18:30-18:35', venueId: 'interactive_hall', place: '互动游乐馆', tag: '' },
      { id: 'r22', title: '沉浸式互动《东坡学堂》', time: '18:40-18:55', venueId: 'interactive_hall', place: '互动游乐馆', tag: '' },
      { id: 'r23', title: '互动快闪秀《穿越快闪》', time: '19:05-19:12', venueId: 'yazhou_street', place: '崖州古街', tag: '' },
      { id: 'r24', title: '街头互动《赛博花神巡游》', time: '19:22-19:30', venueId: 'love_street', place: '全景区主街巡游', tag: '全园巡游', isParade: true },
      { id: 'r25', title: '狂欢秀《解忧空间》', time: '19:40-19:52', venueId: 'romance_plaza', place: '千古情广场', tag: '广场狂欢' },
      { id: 'r26', title: '大型歌舞《三亚千古情》', time: '20:00-21:00', venueId: 'theater_1', place: '千古情1号剧院', tag: '一生必看的演出', highlight: true },
    ],
  },
  holiday_three_shows: {
    id: 'holiday_three_shows',
    name: '假日三场版（12:00开园档）',
    openHours: '12:00 - 21:30',
    mainShowTimes: ['14:00', '17:00', '20:00'],
    items: [
      { id: 'h1', title: '《虚拟空间》地心幽境', time: '12:00-15:00', venueId: 'virtual_space', place: '黎村苗寨-虚拟空间', tag: '体验时长：6分钟/次' },
      { id: 'h2', title: '《幻影空间》八大奇迹', time: '12:00-15:00', venueId: 'phantom_space', place: '千古情广场-幻影空间', tag: '体验时长：6分钟/次' },
      { id: 'h3', title: '鬼屋《恐怖研究院》', time: '12:00-20:00', venueId: 'horror_inst', place: '黎村苗寨-恐怖研究院', tag: '常驻开放' },
      { id: 'h4', title: '鬼屋《天涯鬼域》', time: '12:00-21:30', venueId: 'ghost_domain', place: '绣楼广场-天涯鬼域', tag: '常驻开放' },
      { id: 'h5', title: '走动式演出《海南岛战役》', time: '12:00-20:00', venueId: 'hainan_battle', place: '1号剧院大厅/战役馆', tag: '实景体验' },
      { id: 'h6', title: 'NPC互动《一千零一夜》', time: '12:10-12:40', venueId: 'yazhou_street', place: '崖州古街', tag: '' },
      { id: 'h7', title: '古彩戏法《通天戏法》', time: '12:15-12:20', venueId: 'exotic_street', place: '风情街', tag: '' },
      { id: 'h8', title: '沉浸式互动《东坡学堂》', time: '12:40-12:55', venueId: 'interactive_hall', place: '互动游乐馆', tag: '' },
      { id: 'h9', title: '沉浸式互动《江湖密令》', time: '13:05-13:20', venueId: 'interactive_hall', place: '互动游乐馆', tag: '' },
      { id: 'h10', title: '沉浸式互动《胡姬夜宴》', time: '13:25-13:30', venueId: 'interactive_hall', place: '互动游乐馆', tag: '' },
      { id: 'h11', title: '野人模仿秀《黎椰传习所》', time: '13:40-13:50', venueId: 'li_village', place: '黎村苗寨', tag: '' },
      { id: 'h12', title: '大型歌舞《三亚千古情》', time: '14:00-15:00', venueId: 'theater_1', place: '千古情1号剧院', tag: '一生必看的演出', highlight: true },
      { id: 'h13', title: '亲子互动《沙滩咒语解码》', time: '14:40-14:50', venueId: 'theater_1', place: '1号剧院大厅', tag: '' },
      { id: 'h14', title: '民俗表演《黎寨招亲》', time: '15:10-15:25', venueId: 'xiulou_plaza', place: '绣楼广场', tag: '抛绣球互动' },
      { id: 'h15', title: '5D实景剧《大地震》', time: '15:35-16:10', venueId: 'theater_2', place: '千古情2号剧院', tag: '先到先得' },
      { id: 'h16', title: '互动快闪秀《穿越快闪》', time: '16:20-16:27', venueId: 'yazhou_street', place: '崖州古街', tag: '' },
      { id: 'h17', title: 'NPC互动《岭南风云》', time: '16:30-17:00', venueId: 'miao_village', place: '黎村苗寨', tag: '' },
      { id: 'h18', title: '大型歌舞《三亚千古情》', time: '17:00-18:00', venueId: 'theater_1', place: '千古情1号剧院', tag: '一生必看的演出', highlight: true },
      { id: 'h19', title: '民俗表演《黎寨招亲》', time: '18:40-18:55', venueId: 'xiulou_plaza', place: '绣楼广场', tag: '夜场加演' },
      { id: 'h20', title: '街头互动《赛博花神巡游》', time: '19:22-19:30', venueId: 'love_street', place: '全景区主街巡游', tag: '全园巡游', isParade: true },
      { id: 'h21', title: '音乐会《解忧空间》', time: '19:35-19:47', venueId: 'romance_plaza', place: '千古情广场', tag: '广场音乐会' },
      { id: 'h22', title: '大型歌舞《三亚千古情》', time: '20:00-21:00', venueId: 'theater_1', place: '千古情1号剧院', tag: '一生必看的演出', highlight: true },
    ],
  },
};

// 全景区巡游标准动线（千古情广场 -> 风情街 -> 爱情街 -> 绣楼广场 -> 崖州古街）
export const PARADE_ROUTE_NODES = [
  'n_romance_plaza',
  'n_exotic_sw',
  'n_exotic_ne',
  'n_food_south',
  'n_love_st_ne',
  'n_xiulou_nw',
  'n_xiulou_plaza',
  'n_yazhou_mid',
];

// 一次性初始化所有点位、建筑体块与路网节点的3D世界坐标
export const VENUE_BY_ID = {};
for (const v of PARK_VENUES) {
  v.pos = uvToXZ(v.uv[0], v.uv[1]);
  v.box = v.footprint ? rectFromCorners(...v.footprint) : null;
  v.waterBox = v.waterPool ? rectFromCorners(...v.waterPool) : null;
  v.portalBox = v.portalHall ? rectFromCorners(...v.portalHall) : null;
  v.northWingBox = v.northWing ? rectFromCorners(...v.northWing) : null;
  v.corridorBox = v.corridorWing ? rectFromCorners(...v.corridorWing) : null;
  VENUE_BY_ID[v.id] = v;
}

for (const f of SERVICE_FACILITIES) {
  f.pos = uvToXZ(f.uv[0], f.uv[1]);
}

for (const s of EXTRA_STRUCTURES) {
  if (s.rect) s.box = rectFromCorners(...s.rect);
  if (s.uv) s.pos = uvToXZ(s.uv[0], s.uv[1]);
}

const ADJ = {};
for (const [id, node] of Object.entries(ROAD_NODES)) {
  node.pos = uvToXZ(node.uv[0], node.uv[1]);
  ADJ[id] = [];
}
for (const [a, b] of ROAD_EDGES) {
  const pa = ROAD_NODES[a].pos;
  const pb = ROAD_NODES[b].pos;
  const dist = Math.hypot(pa.x - pb.x, pa.z - pb.z);
  ADJ[a].push({ to: b, dist });
  ADJ[b].push({ to: a, dist });
}

export function findNearestRoadNode(x, z) {
  let nearest = null, best = Infinity;
  for (const [id, { pos }] of Object.entries(ROAD_NODES)) {
    const squared = (x - pos.x) ** 2 + (z - pos.z) ** 2;
    if (squared < best) { best = squared; nearest = id; }
  }
  return nearest;
}

function resolveRoadNodeId(idOrNode) {
  if (ROAD_NODES[idOrNode]) return idOrNode;
  if (VENUE_BY_ID[idOrNode]) return VENUE_BY_ID[idOrNode].roadNode;
  const fac = SERVICE_FACILITIES.find((f) => f.id === idOrNode);
  return fac ? fac.roadNode : null;
}

// 计算园区任意两点（场馆ID、设施ID或路网节点ID）沿真实步道的步行最短路径
export function findWalkingRoute(fromId, toId) {
  const start = resolveRoadNodeId(fromId);
  const goal = resolveRoadNodeId(toId);
  if (!start || !goal) return null;

  const distMap = { [start]: 0 };
  const prevMap = {};
  const visited = new Set();

  while (true) {
    let cur = null;
    let best = Infinity;
    for (const [n, d] of Object.entries(distMap)) {
      if (!visited.has(n) && d < best) {
        best = d;
        cur = n;
      }
    }
    if (!cur || cur === goal) break;
    visited.add(cur);
    for (const edge of ADJ[cur]) {
      const nextDist = best + edge.dist;
      if (nextDist < (distMap[edge.to] ?? Infinity)) {
        distMap[edge.to] = nextDist;
        prevMap[edge.to] = cur;
      }
    }
  }

  if (distMap[goal] === undefined) return null;
  const nodeIds = [];
  for (let at = goal; at; at = prevMap[at]) nodeIds.unshift(at);

  // 标牌位于建筑或水面上方，步行线应止在对应的可通行入口。
  const points3D = nodeIds.map((nid) => ({ ...ROAD_NODES[nid].pos, y: 0.35 }));

  const distanceMeters = Math.round(distMap[goal]);
  return {
    nodeIds,
    points3D,
    distanceMeters,
    walkMinutes: Math.max(1, Math.round(distanceMeters / 65)),
  };
}

export function parseTimeToMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function getShowStatus(timeRange, nowMinutes) {
  const [startStr, endStr] = timeRange.split('-');
  const start = parseTimeToMinutes(startStr);
  const end = parseTimeToMinutes(endStr);
  if (nowMinutes >= start && nowMinutes < end) return { code: 'live', label: '正在演出', remainMin: end - nowMinutes };
  if (nowMinutes < start && start - nowMinutes <= 30) return { code: 'soon', label: `${start - nowMinutes}分钟后开演`, remainMin: start - nowMinutes };
  if (nowMinutes < start) return { code: 'upcoming', label: '待开演', remainMin: start - nowMinutes };
  return { code: 'ended', label: '已结束', remainMin: 0 };
}
