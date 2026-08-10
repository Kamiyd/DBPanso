/**
 * 从资源标题/正文解析高品质参数标签（4K、HDR、REMUX…）
 */

/**
 * @typedef {'res'|'hdr'|'src'|'audio'|'codec'|'extra'} QualityCat
 * @typedef {{ id: string, label: string, cat: QualityCat, rank: number }} QualityTag
 * @typedef {{ id: string, label: string, cat: QualityCat, rank: number, re: RegExp, exclusiveGroup?: string }} QualityRule
 */

/** @type {QualityRule[]} 按优先级排列；同组只保留更优项 */
const RULES = [
  // —— 分辨率 ——
  {
    id: "8k",
    label: "8K",
    cat: "res",
    rank: 100,
    exclusiveGroup: "res",
    re: /(?:^|[^a-z0-9])(8\s*k|4320\s*p|8k\s*uhd)(?![a-z0-9])/i,
  },
  {
    id: "4k",
    label: "4K",
    cat: "res",
    rank: 90,
    exclusiveGroup: "res",
    re: /(?:^|[^a-z0-9])(4\s*k|2160\s*p|uhd|ultra\s*hd|四[kＫ]|超高清)(?![a-z0-9])/i,
  },
  {
    id: "1080p",
    label: "1080p",
    cat: "res",
    rank: 70,
    exclusiveGroup: "res",
    re: /(?:^|[^a-z0-9])(1080\s*p|fhd|1920\s*[x×]\s*1080|全高清)(?![a-z0-9])/i,
  },
  {
    id: "720p",
    label: "720p",
    cat: "res",
    rank: 50,
    exclusiveGroup: "res",
    re: /(?:^|[^a-z0-9])(720\s*p|hd(?![a-z])|准高清)(?![a-z0-9])/i,
  },

  // —— HDR / 动态范围 ——
  {
    id: "dovi",
    label: "Dolby Vision",
    cat: "hdr",
    rank: 95,
    exclusiveGroup: "hdr",
    re: /(?:dolby\s*vision|杜比视界|\bdovi\b|(?:^|[^a-z0-9])dv(?:\b|[^a-z0-9])(?!\s*d))/i,
  },
  {
    id: "hdr10plus",
    label: "HDR10+",
    cat: "hdr",
    rank: 88,
    exclusiveGroup: "hdr",
    re: /hdr\s*10\s*\+|hdr10\s*plus|hdr10\+/i,
  },
  {
    id: "hdr10",
    label: "HDR10",
    cat: "hdr",
    rank: 82,
    exclusiveGroup: "hdr",
    re: /hdr\s*10(?!\s*\+)/i,
  },
  {
    id: "hdr",
    label: "HDR",
    cat: "hdr",
    rank: 78,
    exclusiveGroup: "hdr",
    re: /(?:^|[^a-z0-9])hdr(?![a-z0-9+])|高动态/i,
  },

  // —— 片源 ——
  {
    id: "remux",
    label: "REMUX",
    cat: "src",
    rank: 92,
    exclusiveGroup: "src",
    re: /remux|原盘\s*remux|无损原盘/i,
  },
  {
    id: "bluray",
    label: "Blu-ray",
    cat: "src",
    rank: 80,
    exclusiveGroup: "src",
    re: /blu-?\s*ray|bd\s*remux|bdrip|bdmv|蓝光|原盘(?!\s*remux)/i,
  },
  {
    id: "webdl",
    label: "WEB-DL",
    cat: "src",
    rank: 72,
    exclusiveGroup: "src",
    re: /web-?\s*dl|webdl/i,
  },
  {
    id: "webrip",
    label: "WEBRip",
    cat: "src",
    rank: 65,
    exclusiveGroup: "src",
    re: /web-?\s*rip|webrip/i,
  },
  {
    id: "hdtv",
    label: "HDTV",
    cat: "src",
    rank: 55,
    exclusiveGroup: "src",
    re: /hdtv/i,
  },

  // —— 音轨 ——
  {
    id: "atmos",
    label: "Atmos",
    cat: "audio",
    rank: 86,
    re: /atmos|dolby\s*atmos|杜比全景声/i,
  },
  {
    id: "dtsx",
    label: "DTS:X",
    cat: "audio",
    rank: 84,
    re: /dts[\s.:-]*x\b/i,
  },
  {
    id: "truehd",
    label: "TrueHD",
    cat: "audio",
    rank: 80,
    re: /true\s*hd|truehd/i,
  },
  {
    id: "dtshd",
    label: "DTS-HD",
    cat: "audio",
    rank: 76,
    re: /dts-?\s*hd(?:\s*ma)?/i,
  },
  {
    id: "flac",
    label: "FLAC",
    cat: "audio",
    rank: 70,
    re: /(?:^|[^a-z0-9])flac(?![a-z0-9])/i,
  },

  // —— 编码 ——
  {
    id: "av1",
    label: "AV1",
    cat: "codec",
    rank: 74,
    exclusiveGroup: "codec",
    re: /(?:^|[^a-z0-9])av1(?![a-z0-9])/i,
  },
  {
    id: "hevc",
    label: "HEVC",
    cat: "codec",
    rank: 70,
    exclusiveGroup: "codec",
    re: /hevc|h\.?\s*265|x265/i,
  },
  {
    id: "h264",
    label: "H.264",
    cat: "codec",
    rank: 55,
    exclusiveGroup: "codec",
    re: /h\.?\s*264|x264|avc(?![a-z])/i,
  },

  // —— 其它加分项 ——
  {
    id: "imax",
    label: "IMAX",
    cat: "extra",
    rank: 75,
    re: /(?:^|[^a-z0-9])imax(?![a-z0-9])/i,
  },
  {
    id: "60fps",
    label: "60fps",
    cat: "extra",
    rank: 68,
    // 避免 2160p 中的「60p」误匹配
    re: /(?:^|[^0-9a-z])60\s*fps(?:[^0-9a-z]|$)|(?:^|[^0-9a-z])(?:p60|60p)(?:[^0-9a-z]|$)/i,
  },
  {
    id: "10bit",
    label: "10bit",
    cat: "extra",
    rank: 62,
    re: /10[\s-]*bit|10bit/i,
  },
  {
    id: "atmos_cn",
    label: "全景声",
    cat: "audio",
    rank: 85,
    re: /全景声/,
  },
];

const PREMIUM_IDS = new Set([
  "8k",
  "4k",
  "dovi",
  "hdr10plus",
  "hdr10",
  "hdr",
  "remux",
  "atmos",
  "dtsx",
  "truehd",
  "imax",
]);

const FEATURED_RESOLUTION_IDS = new Set(["8k", "4k"]);
const FEATURED_HDR_IDS = new Set(["dovi", "hdr10plus"]);
const FEATURED_SOURCE_IDS = new Set(["remux", "bluray"]);
const FEATURED_AUDIO_IDS = new Set(["atmos", "dtsx", "truehd"]);

/**
 * 为高规格组合生成一条简短的资源亮点总结。
 * @param {QualityTag[]} tags
 * @returns {{ summary: string, title: string, topTier: boolean } | null}
 */
export function qualityHighlight(tags) {
  if (!tags?.length) return null;
  const ids = new Set(tags.map((tag) => tag.id));
  const hasResolution = [...FEATURED_RESOLUTION_IDS].some((id) => ids.has(id));
  const hasHdr = [...FEATURED_HDR_IDS].some((id) => ids.has(id));
  const hasSource = [...FEATURED_SOURCE_IDS].some((id) => ids.has(id));
  const hasAudio = [...FEATURED_AUDIO_IDS].some((id) => ids.has(id));
  const hasPicture = hasResolution || hasHdr || hasSource;
  const hasCinema = ids.has("imax");

  const dimensions = [hasResolution, hasHdr, hasSource, hasAudio].filter(Boolean).length;
  const topTier =
    (hasResolution && hasHdr && hasSource) ||
    (ids.has("dovi") && ids.has("remux")) ||
    (ids.has("8k") && (hasHdr || hasSource)) ||
    (hasResolution && dimensions >= 3);
  const highTier =
    (hasResolution && hasHdr) ||
    (hasResolution && hasSource) ||
    (hasHdr && hasSource && hasAudio) ||
    dimensions >= 3 ||
    hasHdr ||
    hasSource ||
    hasAudio ||
    ids.has("8k") ||
    (hasCinema && (hasPicture || hasAudio));

  if (!topTier && !highTier) return null;

  const summary =
    hasPicture && hasAudio
      ? "音画俱佳"
      : hasCinema && hasPicture
        ? "影院级画质"
      : hasSource && hasPicture
        ? "原盘级画质"
        : hasPicture
          ? "高画质"
          : hasAudio
            ? "高音质"
            : "";

  if (!summary) return null;

  return {
    summary,
    title: `资源亮点：${summary}`,
    topTier,
  };
}

/**
 * @param {string} text
 * @returns {QualityTag[]}
 */
export function extractQualityTags(text) {
  const raw = String(text || "");
  if (!raw.trim()) return [];

  /** @type {Map<string, QualityTag>} */
  const byGroup = new Map();
  /** @type {QualityTag[]} */
  const ungrouped = [];
  const seenIds = new Set();

  for (const rule of RULES) {
    if (seenIds.has(rule.id)) continue;
    // 全景声 与 Atmos 合并
    if (rule.id === "atmos_cn" && seenIds.has("atmos")) continue;
    if (!rule.re.test(raw)) continue;

    // reset lastIndex for global-less re — fine for non-global
    const tag = {
      id: rule.id === "atmos_cn" ? "atmos" : rule.id,
      label: rule.id === "atmos_cn" ? "Atmos" : rule.label,
      cat: rule.cat,
      rank: rule.rank,
    };
    seenIds.add(tag.id);

    if (rule.exclusiveGroup) {
      const prev = byGroup.get(rule.exclusiveGroup);
      if (!prev || tag.rank > prev.rank) {
        byGroup.set(rule.exclusiveGroup, tag);
      }
    } else {
      ungrouped.push(tag);
    }
  }

  const tags = [...byGroup.values(), ...ungrouped];
  tags.sort((a, b) => b.rank - a.rank || a.label.localeCompare(b.label));
  return tags;
}

/**
 * 从搜索结果项抽取标签（标题 + 正文 + 频道名）
 * @param {{ title?: string, content?: string, channel?: string, tags?: string[] }} item
 * @returns {QualityTag[]}
 */
export function extractQualityFromItem(item) {
  const parts = [
    item?.title || "",
    item?.content || "",
    item?.channel || "",
    ...(item?.tags || []),
  ];
  return extractQualityTags(parts.join("\n"));
}

/** @param {QualityTag[]} tags */
export function isPremiumQuality(tags) {
  return tags.some((t) => PREMIUM_IDS.has(t.id));
}

/** 综合品质分，可用于排序加权 */
export function qualityScore(tags) {
  if (!tags?.length) return 0;
  // 取 top3 加权，避免堆砌标签刷分
  return tags
    .slice(0, 3)
    .reduce((sum, t, i) => sum + t.rank * (1 - i * 0.12), 0);
}

/**
 * 渲染标签 HTML
 * @param {QualityTag[]} tags
 * @param {{ max?: number, activeId?: string, activeIds?: string[] }} [opts]
 */
export function qualityBadgesHtml(tags, opts = {}) {
  const max = opts.max ?? 6;
  if (!tags?.length) return "";
  const list = tags.slice(0, max);
  const more = tags.length - list.length;
  const highlight = qualityHighlight(tags);
  const activeIds = new Set(
    opts.activeIds || (opts.activeId ? [opts.activeId] : [])
  );

  const stickerTilt = (Math.random() * 2.4 - 1.2).toFixed(2);
  const featured = highlight
    ? `<span class="q-featured${highlight.topTier ? " q-featured--top" : ""}" data-cuelume-hover="sparkle" style="--sticker-tilt:${stickerTilt}deg" title="${escapeAttr(highlight.title)}"><span class="q-featured-label">${escapeHtml(highlight.summary)}</span></span>`
    : "";

  const pills = list
    .map((t, i) => {
      const premium = PREMIUM_IDS.has(t.id) ? " q-tag--premium" : "";
      const active = activeIds.has(t.id) ? " is-active" : "";
      const pressed = activeIds.has(t.id) ? "true" : "false";
      const removeHint = active
        ? '<span class="q-tag-remove" aria-hidden="true">×</span>'
        : "";
      const title = active
        ? `点击 × 取消筛选 ${t.label}`
        : `筛选 ${t.label}`;
      const ariaLabel = active ? `取消筛选 ${t.label}` : `筛选 ${t.label}`;
      return `<button type="button" class="q-tag q-tag--${t.cat}${premium}${active}" data-q="${t.id}" data-q-cat="${t.cat}" data-label="${escapeAttr(t.label)}" style="--q-i:${i}" title="${escapeAttr(title)}" aria-label="${escapeAttr(ariaLabel)}" aria-pressed="${pressed}"><span class="q-tag-label">${escapeHtml(t.label)}</span>${removeHint}</button>`;
    })
    .join("");

  const extra =
    more > 0
      ? `<span class="q-tag q-tag--more" title="另有 ${more} 项品质信息">+${more}</span>`
      : "";

  return `<div class="q-tags" role="list" aria-label="画质与规格">${featured}${pills}${extra}</div>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s) {
  return escapeHtml(s);
}
