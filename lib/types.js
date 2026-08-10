/** @typedef {'baidu'|'aliyun'|'quark'|'tianyi'|'uc'|'mobile'|'115'|'pikpak'|'xunlei'|'123'|'magnet'|'ed2k'|'others'} PanType */

/**
 * @typedef {Object} PanLink
 * @property {PanType} type
 * @property {string} url
 * @property {string} password
 * @property {string} [workTitle]
 */

/**
 * @typedef {Object} SearchResult
 * @property {string} uniqueId
 * @property {string} channel
 * @property {string} messageId
 * @property {string} messageUrl
 * @property {string} datetime
 * @property {string} title
 * @property {string} content
 * @property {string[]} tags
 * @property {string} image
 * @property {PanLink[]} links
 * @property {string[]} mergedFromChannels
 */

/**
 * @typedef {Object} ChannelConfig
 * @property {string} slug
 * @property {string} title
 * @property {boolean} enabled
 * @property {string} [lastPostAt]
 * @property {string} [source]
 */

/** @type {{ key: PanType | 'all'; label: string }[]} */
export const PAN_TAB_ORDER = [
  { key: "all", label: "全部" },
  { key: "quark", label: "夸克" },
  { key: "baidu", label: "百度" },
  { key: "aliyun", label: "阿里" },
  { key: "115", label: "115" },
  { key: "xunlei", label: "迅雷" },
  { key: "tianyi", label: "天翼" },
  { key: "uc", label: "UC" },
  { key: "123", label: "123" },
  { key: "mobile", label: "移动" },
  { key: "pikpak", label: "PikPak" },
  { key: "magnet", label: "磁力" },
  { key: "ed2k", label: "电驴" },
  { key: "others", label: "其他" },
];

/** 默认频道（与 Web 版同源；可在设置里增删） */
/** @type {ChannelConfig[]} */
export const DEFAULT_CHANNELS = [
  { slug: "tgsearchers7", title: "tgsearchers7", enabled: true },
  { slug: "Aliyun_4K_Movies", title: "Aliyun_4K_Movies", enabled: true },
  { slug: "bdbdndn11", title: "bdbdndn11", enabled: true },
  { slug: "yunpanx", title: "yunpanx", enabled: true },
  { slug: "bsbdbfjfjff", title: "bsbdbfjfjff", enabled: true },
  { slug: "yp123pan", title: "yp123pan", enabled: true },
  { slug: "yunpanxunlei", title: "yunpanxunlei", enabled: true },
  { slug: "tianyifc", title: "tianyifc", enabled: true },
  { slug: "BaiduCloudDisk", title: "BaiduCloudDisk", enabled: true },
  { slug: "txtyzy", title: "txtyzy", enabled: true },
  { slug: "peccxinpd", title: "peccxinpd", enabled: true },
  { slug: "gotopan", title: "gotopan", enabled: true },
  { slug: "PanjClub", title: "PanjClub", enabled: true },
  { slug: "baicaoZY", title: "baicaoZY", enabled: true },
  { slug: "MCPH01", title: "MCPH01", enabled: true },
  { slug: "MCPH02", title: "MCPH02", enabled: true },
  { slug: "MCPH03", title: "MCPH03", enabled: true },
  { slug: "bdwpzhpd", title: "bdwpzhpd", enabled: true },
  { slug: "ysxb48", title: "ysxb48", enabled: true },
  { slug: "jdjdn1111", title: "jdjdn1111", enabled: true },
  { slug: "yggpan", title: "yggpan", enabled: true },
  { slug: "MCPH086", title: "MCPH086", enabled: true },
  { slug: "zaihuayun", title: "zaihuayun", enabled: true },
  { slug: "Q66Share", title: "Q66Share", enabled: true },
  { slug: "ucwpzy", title: "ucwpzy", enabled: true },
  { slug: "shareAliyun", title: "shareAliyun", enabled: true },
  { slug: "alyp_1", title: "alyp_1", enabled: true },
  { slug: "dianyingshare", title: "dianyingshare", enabled: true },
  { slug: "Quark_Movies", title: "Quark_Movies", enabled: true },
  { slug: "ydypzyfx", title: "ydypzyfx", enabled: true },
  { slug: "ucquark", title: "ucquark", enabled: true },
  { slug: "xx123pan", title: "xx123pan", enabled: true },
  { slug: "yingshifenxiang123", title: "yingshifenxiang123", enabled: true },
  { slug: "zyfb123", title: "zyfb123", enabled: true },
  { slug: "tyypzhpd", title: "tyypzhpd", enabled: true },
  { slug: "tianyirigeng", title: "tianyirigeng", enabled: true },
  { slug: "cloudtianyi", title: "cloudtianyi", enabled: true },
  { slug: "hdhhd21", title: "hdhhd21", enabled: true },
  { slug: "Lsp115", title: "Lsp115", enabled: true },
  { slug: "oneonefivewpfx", title: "oneonefivewpfx", enabled: true },
  { slug: "qixingzhenren", title: "qixingzhenren", enabled: true },
  { slug: "taoxgzy", title: "taoxgzy", enabled: true },
  { slug: "Channel_Shares_115", title: "Channel_Shares_115", enabled: true },
  { slug: "tyysypzypd", title: "tyysypzypd", enabled: true },
  { slug: "vip115hot", title: "vip115hot", enabled: true },
  { slug: "wp123zy", title: "wp123zy", enabled: true },
  { slug: "yunpan139", title: "yunpan139", enabled: true },
  { slug: "yunpan189", title: "yunpan189", enabled: true },
  { slug: "yunpanuc", title: "yunpanuc", enabled: true },
  { slug: "yydf_hzl", title: "yydf_hzl", enabled: true },
  { slug: "leoziyuan", title: "leoziyuan", enabled: true },
  { slug: "Q_dongman", title: "Q_dongman", enabled: true },
  { slug: "yoyokuakeduanju", title: "yoyokuakeduanju", enabled: true },
  { slug: "TG654TG", title: "TG654TG", enabled: true },
  { slug: "WFYSFX02", title: "WFYSFX02", enabled: true },
  { slug: "QukanMovie", title: "QukanMovie", enabled: true },
  { slug: "yeqingjie_GJG666", title: "yeqingjie_GJG666", enabled: true },
  { slug: "movielover8888_film3", title: "movielover8888_film3", enabled: true },
  { slug: "Baidu_netdisk", title: "Baidu_netdisk", enabled: true },
  { slug: "D_wusun", title: "D_wusun", enabled: true },
  { slug: "FLMdongtianfudi", title: "FLMdongtianfudi", enabled: true },
  { slug: "KaiPanshare", title: "KaiPanshare", enabled: true },
  { slug: "QQZYDAPP", title: "QQZYDAPP", enabled: true },
  { slug: "rjyxfx", title: "rjyxfx", enabled: true },
  { slug: "PikPak_Share_Channel", title: "PikPak_Share_Channel", enabled: true },
  { slug: "btzhi", title: "btzhi", enabled: true },
  { slug: "QuarkFree", title: "QuarkFree", enabled: true },
  { slug: "yunpanNB", title: "yunpanNB", enabled: true },
  { slug: "kkdj001", title: "kkdj001", enabled: true },
  { slug: "pxyunpanxunlei", title: "pxyunpanxunlei", enabled: true },
  { slug: "jxwpzy", title: "jxwpzy", enabled: true },
  { slug: "kuakedongman", title: "kuakedongman", enabled: true },
  { slug: "guoman4K", title: "guoman4K", enabled: true },
  { slug: "cilidianying", title: "cilidianying", enabled: true },
  { slug: "SharePanFilms", title: "SharePanFilms", enabled: true },
  { slug: "Oscar_4Kmovies", title: "Oscar_4Kmovies", enabled: true },
  { slug: "douerpan", title: "douerpan", enabled: true },
  { slug: "baidu_yppan", title: "baidu_yppan", enabled: true },
  { slug: "Q_jilupian", title: "Q_jilupian", enabled: true },
  { slug: "Netdisk_Movies", title: "Netdisk_Movies", enabled: true },
  { slug: "yunpanquark", title: "yunpanquark", enabled: true },
  { slug: "ciliziyuanku", title: "ciliziyuanku", enabled: true },
  { slug: "cili8888", title: "cili8888", enabled: true },
  { slug: "jzmm_123pan", title: "jzmm_123pan", enabled: true },
  { slug: "Q_dianying", title: "Q_dianying", enabled: true },
  { slug: "dianying4k", title: "dianying4k", enabled: true },
  { slug: "q_dianshiju", title: "q_dianshiju", enabled: true },
  { slug: "ucshare", title: "ucshare", enabled: true },
  { slug: "godupan", title: "godupan", enabled: true },
  { slug: "gokuapan", title: "gokuapan", enabled: true },
  { slug: "gimy115", title: "gimy115", enabled: true },
  { slug: "Movie888035", title: "Movie888035", enabled: true },
  { slug: "xlwpzy", title: "xlwpzy", enabled: true },
  { slug: "gimy100", title: "gimy100", enabled: true },
  { slug: "aliyunys", title: "aliyunys", enabled: true },
  { slug: "XunLeiPinDao", title: "XunLeiPinDao", enabled: true },
  { slug: "ydwpzy", title: "ydwpzy", enabled: true },
  { slug: "a123fxme", title: "a123fxme", enabled: true },
  { slug: "kuyupan", title: "kuyupan", enabled: true },
  { slug: "yingshiziyuanpindao", title: "yingshiziyuanpindao", enabled: true },
  { slug: "kuakenetpan", title: "kuakenetpan", enabled: true },
  { slug: "PikPakShareChannel", title: "PikPakShareChannel", enabled: true },
  // —— 补充频道 ——
  { slug: "tgbox115", title: "tgbox115", enabled: true },
  { slug: "baicaoZY1", title: "baicaoZY1", enabled: true },
  { slug: "BaiduCloudDiskchat", title: "BaiduCloudDiskchat", enabled: true },
  { slug: "BooksRealm", title: "BooksRealm", enabled: true },
  { slug: "CBduanju", title: "CBduanju", enabled: true },
  { slug: "cctv1211", title: "cctv1211", enabled: true },
  { slug: "cloud189_group", title: "cloud189_group", enabled: true },
  { slug: "duan_ju", title: "duan_ju", enabled: true },
  { slug: "dzsgx", title: "dzsgx", enabled: true },
  { slug: "kduanju", title: "kduanju", enabled: true },
  { slug: "xxzlzn", title: "xxzlzn", enabled: true },
  { slug: "kuakeclound", title: "kuakeclound", enabled: true },
  { slug: "MCPH608", title: "MCPH608", enabled: true },
  { slug: "newproductsourcing", title: "newproductsourcing", enabled: true },
  { slug: "peccxin", title: "peccxin", enabled: true },
  { slug: "quanziyuanshe", title: "quanziyuanshe", enabled: true },
  { slug: "ResourceUniverse", title: "ResourceUniverse", enabled: true },
  { slug: "Resourcesharing", title: "Resourcesharing", enabled: true },
  { slug: "share_pan", title: "share_pan", enabled: true },
  { slug: "shangguandianyingyuan1", title: "shangguandianyingyuan1", enabled: true },
  { slug: "solidsexydoll", title: "solidsexydoll", enabled: true },
  { slug: "tgbokee", title: "tgbokee", enabled: true },
  { slug: "ucwangpan", title: "ucwangpan", enabled: true },
  { slug: "wpzyhj", title: "wpzyhj", enabled: true },
  { slug: "xiangnikanj", title: "xiangnikanj", enabled: true },
  { slug: "XiangxiuNBB", title: "XiangxiuNBB", enabled: true },
  { slug: "xlshare", title: "xlshare", enabled: true },
  { slug: "xunleibl", title: "xunleibl", enabled: true },
  { slug: "yinfans", title: "yinfans", enabled: true },
  { slug: "zdqxm", title: "zdqxm", enabled: true },
  { slug: "zh_video", title: "zh_video", enabled: true },
  { slug: "zyzhpd123", title: "zyzhpd123", enabled: true },
  { slug: "tgsearchers5", title: "tgsearchers5", enabled: true },
  { slug: "ammmziyuan", title: "ammmziyuan", enabled: true },
  { slug: "clouddriveresources", title: "clouddriveresources", enabled: true },
  { slug: "clouddriveresources_g", title: "clouddriveresources_g", enabled: true },
  { slug: "pikpakpan", title: "pikpakpan", enabled: true },
  { slug: "CN_ani115", title: "CN_ani115", enabled: true },
];
