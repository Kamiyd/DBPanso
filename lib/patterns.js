/** 网盘链接识别正则 — 与 Web 版 tg-pansearch 对齐 */

export const PAN_PATTERNS = {
  baidu: /https?:\/\/pan\.baidu\.com\/s\/[a-zA-Z0-9_-]+(?:\?pwd=[a-zA-Z0-9]{4})?/gi,
  quark: /https?:\/\/pan\.quark\.cn\/s\/[a-zA-Z0-9]+/gi,
  aliyun: /https?:\/\/(?:www\.)?(?:alipan|aliyundrive)\.com\/s\/[a-zA-Z0-9]+/gi,
  tianyi: /https?:\/\/cloud\.189\.cn\/t\/[a-zA-Z0-9]+/gi,
  uc: /https?:\/\/drive\.uc\.cn\/s\/[a-zA-Z0-9]+(?:\?public=\d)?/gi,
  mobile:
    /https?:\/\/(?:(?:www\.)?yun\.139\.com\/shareweb\/#\/w\/i\/[a-zA-Z0-9]+|(?:www\.)?caiyun\.139\.com\/(?:w\/i\/[a-zA-Z0-9]+|m\/i\?[a-zA-Z0-9]+)[^\s<>"']*|caiyun\.feixin\.10086\.cn\/[a-zA-Z0-9]+)/gi,
  "115":
    /https?:\/\/(?:115\.com|115cdn\.com|anxia\.com)\/s\/[a-zA-Z0-9]+(?:\?password=[a-zA-Z0-9]{4})?/gi,
  xunlei: /https?:\/\/pan\.xunlei\.com\/s\/[a-zA-Z0-9]+(?:\?pwd=[a-zA-Z0-9]{4})?/gi,
  "123": /https?:\/\/(?:www\.)?123(?:684|865|685|912|pan|592)\.(?:com|cn)\/s\/[a-zA-Z0-9_-]+/gi,
  pikpak: /https?:\/\/mypikpak\.com\/s\/[a-zA-Z0-9]+/gi,
  magnet: /magnet:\?xt=urn:btih:[a-zA-Z0-9]+/gi,
  ed2k: /ed2k:\/\/\|file\|[^|]+\|\d+\|[A-Fa-f0-9]+\|\/?/gi,
};

export const PASSWORD_PATTERN =
  /(?:(?:提取|访问|提取密|密)码|pwd)[：:]\s*([a-zA-Z0-9]{4})(?![a-zA-Z0-9])/i;

export const URL_PASSWORD_PATTERN = /[?&]pwd=([a-zA-Z0-9]{4})(?![a-zA-Z0-9])/i;
export const URL_PASSWORD_115_PATTERN =
  /[?&]password=([a-zA-Z0-9]{4})(?![a-zA-Z0-9])/i;

const TYPE_ORDER = [
  "baidu",
  "quark",
  "aliyun",
  "tianyi",
  "uc",
  "mobile",
  "115",
  "xunlei",
  "123",
  "pikpak",
  "magnet",
  "ed2k",
];

export function detectPanType(url) {
  for (const type of TYPE_ORDER) {
    const re = PAN_PATTERNS[type];
    if (!re) continue;
    re.lastIndex = 0;
    if (re.test(url)) return type;
  }
  return "others";
}

export function extractLinksFromText(text) {
  const found = new Set();
  for (const re of Object.values(PAN_PATTERNS)) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      found.add(m[0]);
    }
  }
  return Array.from(found);
}

export function normalizeUrlKey(url) {
  let u = url.trim();
  try {
    u = decodeURIComponent(u);
  } catch {
    // keep
  }
  const hashIdx = u.indexOf("#");
  if (hashIdx !== -1 && !u.includes("yun.139.com")) {
    if (!/yun\.139\.com|caiyun\.139\.com/.test(u)) {
      u = u.slice(0, hashIdx);
    }
  }
  u = u.replace(/\/+$/, "");
  try {
    if (u.startsWith("http")) {
      const parsed = new URL(u);
      parsed.hash = "";
      const keepParams = ["pwd", "password", "public"];
      for (const k of Array.from(parsed.searchParams.keys())) {
        if (!keepParams.includes(k.toLowerCase())) {
          parsed.searchParams.delete(k);
        }
      }
      parsed.hostname = parsed.hostname.toLowerCase();
      u = parsed.toString().replace(/\/$/, "");
    }
  } catch {
    // ignore
  }
  return u.toLowerCase();
}

export function ensureBaiduPwd(url, password) {
  if (!password) return url;
  if (/[?&]pwd=/i.test(url)) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}pwd=${password}`;
}

export function extractPassword(url, nearbyText, fullText) {
  const fromUrl = url.match(URL_PASSWORD_PATTERN);
  if (fromUrl?.[1]) return fromUrl[1];
  const from115 = url.match(URL_PASSWORD_115_PATTERN);
  if (from115?.[1]) return from115[1];
  const nearby = nearbyText.match(PASSWORD_PATTERN);
  if (nearby?.[1]) return nearby[1];
  const full = fullText.match(PASSWORD_PATTERN);
  if (full?.[1]) return full[1];
  return "";
}

export function extractChannelSlug(input) {
  let s = input.trim();
  if (!s) return null;
  if (s.startsWith("@")) s = s.slice(1);
  const urlMatch = s.match(
    /(?:https?:\/\/)?(?:t\.me|telegram\.me)\/(?:s\/)?([a-zA-Z0-9_]+)/i
  );
  if (urlMatch?.[1]) return urlMatch[1];
  if (/^[a-zA-Z0-9_]+$/.test(s)) return s;
  return null;
}
