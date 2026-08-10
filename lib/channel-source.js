/**
 * pansou Issue #4 的远程 TG 频道来源。
 *
 * Issue 正文维护当前频道清单；评论区是临时反馈，不作为自动导入来源。
 */

export const CHANNEL_SOURCE_API_URL =
  "https://api.github.com/repos/fish2018/pansou/issues/4";
export const CHANNEL_SOURCE_ISSUE_URL =
  "https://github.com/fish2018/pansou/issues/4";
export const CHANNEL_SOURCE_CACHE_KEY = "pansouChannelSource";
export const CHANNEL_SOURCE_REFRESH_MS = 6 * 60 * 60 * 1000;

const CHANNEL_SLUG_PATTERN = /^[a-zA-Z0-9_]+$/;

/**
 * 从 Issue 正文中提取 TG频道 段落里的 CHANNELS 列表。
 * 只接受 Telegram 用户名允许的字符，避免 Markdown 文本被误识别。
 *
 * @param {string} body
 * @returns {string[]}
 */
export function parsePansouChannelBody(body) {
  const text = String(body || "");
  const sectionMatch = text.match(
    /(?:^|\n)\s*TG频道[^\n]*\n([\s\S]*?)(?=\n\s*(?:QQ频道|微博UID)\b|$)/i
  );
  if (!sectionMatch?.[1]) return [];

  const section = sectionMatch[1];
  const codeBlock = section.match(/```([\s\S]*?)```/);
  const code = codeBlock?.[1] || section;
  const assignment = code.match(/(?:export\s+)?CHANNELS\s*=\s*([^\r\n`]+)/i);
  const raw = assignment?.[1] || code;
  const seen = new Set();
  const slugs = [];

  for (const token of raw.split(/[\s,，]+/)) {
    const slug = token.trim().replace(/^['"`]+|['"`]+$/g, "");
    const key = slug.toLowerCase();
    if (!CHANNEL_SLUG_PATTERN.test(slug) || seen.has(key)) continue;
    seen.add(key);
    slugs.push(slug);
  }

  return slugs;
}

/**
 * @param {{ etag?: string }} [options]
 * @returns {Promise<{
 *   notModified?: boolean,
 *   etag?: string,
 *   issueUpdatedAt?: string,
 *   issueUrl?: string,
 *   slugs?: string[],
 *   fetchedAt?: number,
 * }>}
 */
export async function fetchPansouChannelSource({ etag = "" } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const headers = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (etag) headers["If-None-Match"] = etag;

    const response = await fetch(CHANNEL_SOURCE_API_URL, {
      cache: "no-store",
      headers,
      signal: controller.signal,
    });

    if (response.status === 304) {
      return { notModified: true, fetchedAt: Date.now() };
    }

    if (!response.ok) {
      throw new Error(`远程频道来源请求失败（${response.status}）`);
    }

    const payload = await response.json();
    const slugs = parsePansouChannelBody(payload.body);
    if (slugs.length < 5) {
      throw new Error("远程频道来源格式异常");
    }

    return {
      etag: response.headers.get("etag") || "",
      issueUpdatedAt: payload.updated_at || "",
      issueUrl: payload.html_url || CHANNEL_SOURCE_ISSUE_URL,
      slugs,
      fetchedAt: Date.now(),
    };
  } finally {
    clearTimeout(timeout);
  }
}
