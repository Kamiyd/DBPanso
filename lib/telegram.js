/**
 * 抓取 + 解析 t.me 公开频道搜索页
 * 使用 DOMParser（扩展页面 / 侧边栏可用；扩展 host_permissions 绕过 CORS）
 */
import {
  detectPanType,
  ensureBaiduPwd,
  extractLinksFromText,
  extractPassword,
  normalizeUrlKey,
} from "./patterns.js";
import { filterByKeyword } from "./relevance.js";

export const SELECTORS = {
  messageWrap: ".tgme_widget_message_wrap",
  message: ".tgme_widget_message",
  date: ".tgme_widget_message_date time",
  text: ".tgme_widget_message_text",
  photoWrap: ".tgme_widget_message_photo_wrap",
  bubble: ".tgme_widget_message_bubble",
  channelTitle: ".tgme_channel_info_header_title",
  tagLink: "a[href^='?q=%23']",
  contextLink: ".tgme_page_context_link",
};

export const TG_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.5",
};

const FETCH_TIMEOUT_MS = 6000;

export async function fetchTelegramHtml(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: TG_HEADERS,
      signal: ctrl.signal,
      credentials: "omit",
      cache: "no-store",
    });
    const html = await res.text();
    return { html, status: res.status };
  } finally {
    clearTimeout(timer);
  }
}

function stripTags(html) {
  const doc = new DOMParser().parseFromString(
    `<div id="__r">${html}</div>`,
    "text/html"
  );
  return doc.getElementById("__r")?.textContent?.trim() || "";
}

export function extractTitle(htmlContent, plainText) {
  let firstLineHtml = htmlContent;
  const brIdx = htmlContent.search(/<br\s*\/?>/i);
  if (brIdx !== -1) firstLineHtml = htmlContent.slice(0, brIdx);

  let firstLine = stripTags(firstLineHtml);

  const nameMatch = firstLine.match(/^名称[：:]\s*(.+)$/);
  if (nameMatch?.[1]) firstLine = nameMatch[1].trim();

  if (firstLine.startsWith("#") || firstLine === "") {
    const lines = plainText
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const nameLine = lines.find((l) => /^名称[：:]/.test(l));
    if (nameLine) {
      firstLine = nameLine.replace(/^名称[：:]\s*/, "").trim();
    } else if (lines.length >= 2) {
      const second = lines.find((l, i) => i > 0 && !l.startsWith("#"));
      if (second) firstLine = second;
      else if (lines[1]) firstLine = lines[1];
    } else if (lines[0] && !lines[0].startsWith("#")) {
      firstLine = lines[0];
    }
  }

  firstLine = firstLine.replace(/(简介|描述)[：:][\s\S]*$/, "").trim();

  if (!firstLine) {
    firstLine =
      plainText
        .split(/\n/)
        .map((l) => l.trim())
        .find(Boolean) || "无标题";
  }

  if (firstLine.length > 200) firstLine = firstLine.slice(0, 200) + "…";
  return firstLine;
}

function extractImage(bubble) {
  const photo = bubble.querySelector(SELECTORS.photoWrap);
  if (!photo) return "";
  const style = photo.getAttribute("style") || "";
  const m = style.match(/background-image:\s*url\(['"]?(.*?)['"]?\)/i);
  return m?.[1] || "";
}

const LINK_LABEL_ONLY_RE =
  /^(链接|地址|资源地址|网盘|网盘地址|夸克网盘|百度网盘|阿里云盘|天翼云盘|迅雷网盘|115网盘|123网盘|uc网盘|移动云盘|pikpak)[：:]?$/i;

function cleanLinkTitleCandidate(raw) {
  let s = raw.trim();
  if (!s) return "";
  s = s.replace(/^[\d]+[.、)]\s*/, "").replace(/^[-•*]\s*/, "");
  s = s.replace(/^(名称|标题|片名)[：:]\s*/, "");
  if (LINK_LABEL_ONLY_RE.test(s)) return "";
  if (/^#/.test(s) && !s.replace(/#\S+/g, "").trim()) return "";
  s = s.replace(/(简介|描述)[：:][\s\S]*$/, "").trim();
  if (s.length > 100) s = s.slice(0, 100);
  return s;
}

function extractLinkTitle(plainText, url) {
  const short = url.replace(/^https?:\/\//, "");
  let idx = plainText.indexOf(url);
  if (idx === -1) idx = plainText.indexOf(short);
  if (idx === -1) return "";

  const lineStart = plainText.lastIndexOf("\n", idx) + 1;
  const sameLineBefore = plainText.slice(lineStart, idx).trim();
  const fromSameLine = cleanLinkTitleCandidate(sameLineBefore);
  if (fromSameLine) return fromSameLine;

  const prevLines = plainText
    .slice(0, lineStart)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  for (let i = prevLines.length - 1; i >= 0; i--) {
    const candidate = cleanLinkTitleCandidate(prevLines[i]);
    if (candidate) return candidate;
  }
  return "";
}

function getLinesAround(text, index) {
  const before = text.lastIndexOf("\n", index);
  const start = before === -1 ? 0 : before + 1;
  const afterFirst = text.indexOf("\n", index);
  let end = afterFirst === -1 ? text.length : afterFirst;
  if (afterFirst !== -1) {
    const afterSecond = text.indexOf("\n", afterFirst + 1);
    end = afterSecond === -1 ? text.length : afterSecond;
  }
  return text.slice(start, end);
}

function getNearbyText(fullText, url) {
  const idx = fullText.indexOf(url);
  if (idx === -1) {
    const short = url.replace(/^https?:\/\//, "");
    const idx2 = fullText.indexOf(short);
    if (idx2 === -1) return "";
    return getLinesAround(fullText, idx2);
  }
  return getLinesAround(fullText, idx);
}

function buildLinks(hrefs, textUrls, plainText) {
  const candidates = [...hrefs, ...textUrls];
  const seen = new Set();
  const links = [];

  for (let url of candidates) {
    url = url.trim();
    if (!url) continue;
    if (/t\.me\//i.test(url) || /telegram\.me\//i.test(url)) continue;

    const type = detectPanType(url);
    if (type === "others") continue;

    const key = normalizeUrlKey(url);
    if (seen.has(key)) continue;
    seen.add(key);

    const nearby = getNearbyText(plainText, url);
    const password = extractPassword(url, nearby, plainText);
    const workTitle = extractLinkTitle(plainText, url);

    if (type === "baidu" && password) {
      url = ensureBaiduPwd(url, password);
    }

    links.push({ type, url, password, workTitle: workTitle || undefined });
  }

  return links;
}

export function parseSearchHtml(html, channel) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const results = [];
  const wraps = doc.querySelectorAll(SELECTORS.messageWrap);

  wraps.forEach((wrap) => {
    const msg = wrap.querySelector(SELECTORS.message);
    if (!msg) return;

    const dataPost = msg.getAttribute("data-post") || "";
    const parts = dataPost.split("/");
    const messageId = parts[parts.length - 1] || "";
    if (!messageId) return;

    const dateEl = msg.querySelector(SELECTORS.date);
    const datetime = dateEl?.getAttribute("datetime") || new Date().toISOString();

    const textEl = msg.querySelector(SELECTORS.text);
    const htmlContent = textEl?.innerHTML || "";
    const plainText = textEl?.textContent || "";

    const tags = [];
    textEl?.querySelectorAll(SELECTORS.tagLink).forEach((a) => {
      const t = (a.textContent || "").replace(/^#/, "").trim();
      if (t) tags.push(t);
    });

    const bubble = msg.querySelector(SELECTORS.bubble) || msg;
    const image = extractImage(bubble);

    const hrefs = [];
    textEl?.querySelectorAll("a[href]").forEach((a) => {
      const href = a.getAttribute("href") || "";
      if (
        href.startsWith("http") ||
        href.startsWith("magnet:") ||
        href.startsWith("ed2k:")
      ) {
        hrefs.push(href);
      }
    });

    const textUrls = extractLinksFromText(
      plainText + "\n" + htmlContent.replace(/<[^>]+>/g, " ")
    );
    const wrapText = wrap.textContent || "";
    const wrapUrls = extractLinksFromText(wrapText);
    for (const u of wrapUrls) {
      if (!textUrls.includes(u)) textUrls.push(u);
    }

    wrap.querySelectorAll("a[href]").forEach((a) => {
      const href = a.getAttribute("href") || "";
      if (
        (href.startsWith("http") ||
          href.startsWith("magnet:") ||
          href.startsWith("ed2k:")) &&
        !hrefs.includes(href)
      ) {
        hrefs.push(href);
      }
    });

    const links = buildLinks(hrefs, textUrls, plainText || wrapText);
    if (links.length === 0) return;

    const title = extractTitle(htmlContent, plainText);

    results.push({
      uniqueId: `${channel}_${messageId}`,
      channel,
      messageId,
      messageUrl: `https://t.me/${channel}/${messageId}`,
      datetime,
      title,
      content: plainText,
      tags,
      image,
      links,
      mergedFromChannels: [channel],
    });
  });

  return results;
}

export async function searchChannel(channel, kw) {
  const start = Date.now();
  const url = `https://t.me/s/${channel}?q=${encodeURIComponent(kw)}`;

  try {
    const { html, status } = await fetchTelegramHtml(url);

    if (status === 429) {
      return {
        channel,
        status: "rate_limited",
        count: 0,
        elapsedMs: Date.now() - start,
        results: [],
        error: "rate limited",
      };
    }

    if (!html.includes("tgme_widget_message")) {
      return {
        channel,
        status: "error",
        count: 0,
        elapsedMs: Date.now() - start,
        results: [],
        error: "no messages (private or empty)",
      };
    }

    const parsed = parseSearchHtml(html, channel);
    const results = filterByKeyword(parsed, kw);
    return {
      channel,
      status: results.length > 0 ? "ok" : "empty",
      count: results.length,
      elapsedMs: Date.now() - start,
      results,
    };
  } catch (err) {
    const elapsedMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout =
      msg.includes("Timeout") ||
      msg.includes("timeout") ||
      msg.includes("aborted") ||
      err?.name === "TimeoutError" ||
      err?.name === "AbortError";

    return {
      channel,
      status: isTimeout ? "timeout" : "error",
      count: 0,
      elapsedMs,
      results: [],
      error: isTimeout ? "timeout" : msg,
    };
  }
}

/**
 * 校验单个频道是否还能抓
 * state: ok=正常 / no-preview=关了网页预览 / gone=不存在或已注销 /
 *        limited=被限流 / error=网络异常。后两者是暂时的，不能当失效处理。
 * @param {string} channel
 */
export async function validateChannel(channel) {
  const url = `https://t.me/s/${channel}`;
  try {
    const { html, status } = await fetchTelegramHtml(url);
    if (status === 429) {
      return { valid: false, state: "limited", reason: "被限流，请稍后重试" };
    }

    const doc = new DOMParser().parseFromString(html, "text/html");
    const messages = doc.querySelectorAll(SELECTORS.message);
    if (messages.length === 0) {
      // 关了网页预览的频道会落到「在 Telegram 中查看」页；已注销 / 不存在的
      // 只给一个通讯录页。两者都抓不到内容，但一个能靠改设置救回来，一个不能。
      const hasPreviewPage = Boolean(doc.querySelector(SELECTORS.contextLink));
      return {
        valid: false,
        state: hasPreviewPage ? "no-preview" : "gone",
        reason: hasPreviewPage
          ? "已关闭网页预览，无法抓取"
          : "频道不存在或已注销",
      };
    }

    const titleEl = doc.querySelector(SELECTORS.channelTitle);
    const title = titleEl?.textContent?.trim() || channel;

    const allDts = [];
    messages.forEach((el) => {
      const dt = el.querySelector(SELECTORS.date)?.getAttribute("datetime");
      if (dt) allDts.push(dt);
    });
    allDts.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    return { valid: true, state: "ok", title, lastPostAt: allDts[0] || "" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout =
      msg.includes("Timeout") ||
      msg.includes("timeout") ||
      msg.includes("aborted") ||
      err?.name === "TimeoutError" ||
      err?.name === "AbortError";
    return {
      valid: false,
      state: "error",
      reason: isTimeout ? "请求超时，请稍后重试" : msg,
    };
  }
}
