/**
 * 网盘类型 → 官网品牌图标（icons/pan/*）
 * 无品牌图时回退 DBP Round Icons 语义图标 + 纯色
 */
import { iconHtml } from "./icon-library.js?v=20260809-dbpanso-1";

export const PAN_COLORS = {
  all: "#b4ff48",
  baidu: "#3b82f6",
  quark: "#8b5cf6",
  aliyun: "#f97316",
  "115": "#06b6d4",
  xunlei: "#38bdf8",
  tianyi: "#6366f1",
  uc: "#f59e0b",
  "123": "#22c55e",
  mobile: "#0ea5e9",
  pikpak: "#a78bfa",
  magnet: "#ef4444",
  ed2k: "#eab308",
  others: "#94a3b8",
};

/** 已本地化品牌图的网盘类型 */
export const PAN_BRAND_TYPES = new Set([
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
]);

const PAN_BRAND_ASSETS = {
  baidu: "baidu.png",
  quark: "quark.png",
  aliyun: "aliyun.png",
  tianyi: "tianyi.png",
  uc: "uc.png",
  mobile: "mobile.png",
  "115": "115.png",
  xunlei: "xunlei.png",
  "123": "123.png",
  pikpak: "pikpak.png",
};

const PAN_SEMANTIC_SIZE_SCALE = {
  magnet: 0.86,
  ed2k: 0.86,
};

export const PAN_ICON_NAME = {
  all: "layout-grid",
  baidu: "cloud-download",
  quark: "sparkles",
  aliyun: "hard-drive",
  "115": "folders",
  xunlei: "zap",
  tianyi: "cloud",
  uc: "cloud-upload",
  "123": "server",
  mobile: "smartphone",
  pikpak: "package",
  magnet: "magnet",
  ed2k: "download",
  others: "link",
};

function brandIconSrc(type) {
  const asset = PAN_BRAND_ASSETS[type] || `${type}.png`;
  const path = `icons/pan/${asset}`;
  try {
    if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
      return chrome.runtime.getURL(path);
    }
  } catch {
    // ignore
  }
  return `../${path}`;
}

function brandImgHtml(type, size, className) {
  return `<img class="${className}" src="${brandIconSrc(type)}" width="${size}" height="${size}" alt="" draggable="false" loading="lazy" decoding="async" />`;
}

export function panIconHtml(type, opts = {}) {
  const size = opts.size ?? 16;
  const className = opts.className || "pan-icon";

  if (PAN_BRAND_TYPES.has(type)) {
    return brandImgHtml(type, size, `${className} pan-brand-icon`);
  }

  const color = PAN_COLORS[type] || PAN_COLORS.others;
  const name = PAN_ICON_NAME[type] || PAN_ICON_NAME.others;
  const iconSize = Math.max(
    12,
    Math.round(size * (PAN_SEMANTIC_SIZE_SCALE[type] || 1))
  );
  return iconHtml(name, {
    size: iconSize,
    color,
    strokeWidth: 2.65,
    className,
  });
}

export function panIconBadgeHtml(type, opts = {}) {
  const size = opts.size ?? 22;
  const className = opts.className || "pan-icon-badge";

  if (PAN_BRAND_TYPES.has(type)) {
    const img = brandImgHtml(type, size, "pan-brand-icon pan-icon-inner");
    return `<span class="${className} pan-icon-badge--brand" data-type="${type}" style="width:${size}px;height:${size}px" aria-hidden="true">${img}</span>`;
  }

  const color = PAN_COLORS[type] || PAN_COLORS.others;
  const name = PAN_ICON_NAME[type] || PAN_ICON_NAME.others;
  const iconSize = Math.max(
    12,
    Math.round(
      size * 0.76 * (PAN_SEMANTIC_SIZE_SCALE[type] || 1)
    )
  );
  const svg = iconHtml(name, {
    size: iconSize,
    color,
    strokeWidth: 2.55,
    className: "pan-icon-inner",
  });

  return `<span class="${className} pan-icon-badge--semantic" data-type="${type}" style="--pan-color:${color};--pan-icon-size:${iconSize}px;width:${size}px;height:${size}px" aria-hidden="true">${svg}</span>`;
}
