export function formatRelativeTime(iso) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;

  const now = Date.now();
  const diff = Math.max(0, now - t);
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hour = Math.floor(min / 60);
  const day = Math.floor(hour / 24);

  if (sec < 60) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  if (hour < 24) return `${hour} 小时前`;
  if (day < 7) return `${day} 天前`;

  const d = new Date(t);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function formatLinkDisplay(url, maxLen = 42) {
  let s = url.replace(/^https?:\/\//i, "");
  if (s.length <= maxLen) return s;
  const keep = Math.floor((maxLen - 1) / 2);
  return s.slice(0, keep) + "…" + s.slice(-keep);
}

export function highlightKeyword(title, kw) {
  if (!kw.trim()) return escapeHtml(title);
  const escaped = escapeHtml(title);
  const re = new RegExp(`(${escapeRegExp(kw.trim())})`, "gi");
  return escaped.replace(re, '<mark class="hl">$1</mark>');
}

export function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 从豆瓣完整标题提取主标题，便于 TG 搜索命中。
 * 以首个文字脚本为基准，在切换到另一种语言且存在空格/分隔符时截断。
 */
const TITLE_SCRIPT_PATTERNS = [
  {
    kind: "cjk",
    re: /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u,
  },
  { kind: "latin", re: /\p{Script=Latin}/u },
  { kind: "thai", re: /\p{Script=Thai}/u },
  { kind: "cyrillic", re: /\p{Script=Cyrillic}/u },
  { kind: "greek", re: /\p{Script=Greek}/u },
  { kind: "arabic", re: /\p{Script=Arabic}/u },
  { kind: "hebrew", re: /\p{Script=Hebrew}/u },
  { kind: "devanagari", re: /\p{Script=Devanagari}/u },
  { kind: "bengali", re: /\p{Script=Bengali}/u },
  { kind: "myanmar", re: /\p{Script=Myanmar}/u },
  { kind: "khmer", re: /\p{Script=Khmer}/u },
  { kind: "lao", re: /\p{Script=Lao}/u },
];

function titleScriptOf(ch) {
  for (const pattern of TITLE_SCRIPT_PATTERNS) {
    if (pattern.re.test(ch)) return pattern.kind;
  }
  return "";
}

function isTitleSeparator(ch) {
  return /[:：·•|｜/／\\\-—–_、,，;；&＆+＋()[\]（）【】]/.test(ch || "");
}

export function extractChineseTitle(full) {
  const s = String(full || "")
    .trim()
    .replace(/\s*[（(]\s*\d{4}\s*[）)]\s*$/, "")
    .trim();
  if (!s) return "";

  const chars = Array.from(s);
  let firstScript = "";
  for (const ch of chars) {
    firstScript = titleScriptOf(ch);
    if (firstScript) break;
  }
  if (!firstScript) return s.replace(/\s+/g, " ");

  for (let i = 1; i < chars.length; i += 1) {
    const script = titleScriptOf(chars[i]);
    if (!script || script === firstScript) continue;

    let previous = i - 1;
    let separated = false;
    while (previous >= 0 && /\s/.test(chars[previous])) {
      separated = true;
      previous -= 1;
    }
    if (previous >= 0 && isTitleSeparator(chars[previous])) separated = true;
    if (!separated) continue;

    let end = i;
    while (end > 0 && /\s/.test(chars[end - 1])) end -= 1;
    while (end > 0 && isTitleSeparator(chars[end - 1])) end -= 1;
    const main = chars.slice(0, end).join("").trim();
    if (main) return main.replace(/\s+/g, " ");
  }

  return s.replace(/\s+/g, " ");
}

export function panTypeLabel(type) {
  const map = {
    baidu: "百度",
    quark: "夸克",
    aliyun: "阿里",
    "115": "115",
    xunlei: "迅雷",
    tianyi: "天翼",
    uc: "UC",
    "123": "123",
    mobile: "移动",
    pikpak: "PikPak",
    magnet: "磁力",
    ed2k: "电驴",
    others: "其他",
  };
  return map[type] || type;
}
