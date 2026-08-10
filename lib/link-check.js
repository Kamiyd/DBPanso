import { normalizeUrlKey } from "./patterns.js";
import { scoreRelevance } from "./relevance.js";

/**
 * 链接检测是“页面可达性”检测，不把一次 HTTP 200 误称为资源一定有效。
 * 磁力和电驴没有可供扩展探测的网页状态，因此会明确显示为“不检测”。
 */
export const LINK_CHECK_CONCURRENCY = 5;
export const LINK_CHECK_TIMEOUT_MS = 4500;
export const LINK_CHECK_PER_RANK = 5;

const CHECKABLE_TYPES = new Set([
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

export const LINK_CHECK_STATUS_META = {
  checking: {
    label: "检测中",
    title: "正在检测链接页面",
  },
  reachable: {
    label: "可达",
    title: "链接页面可以响应，但不代表资源一定未过期",
  },
  dead: {
    label: "疑似失效",
    title: "链接页面返回 404/410，可能已经失效",
  },
  restricted: {
    label: "需验证",
    title: "网盘需要登录或拒绝匿名请求，暂时无法判断",
  },
  unavailable: {
    label: "暂不可用",
    title: "网盘服务暂时不可访问、限流或返回服务器错误",
  },
  unknown: {
    label: "无法判断",
    title: "网络、跨域或网盘页面没有提供可判定的状态",
  },
  unsupported: {
    label: "不检测",
    title: "磁力和电驴链接没有可供扩展探测的网页状态",
  },
};

/** @param {{ type?: string, url?: string }} link */
export function linkCheckKey(link) {
  return `${link?.type || "unknown"}|${normalizeUrlKey(link?.url || "")}`;
}

/**
 * @param {{ type?: string, url?: string }} link
 * @returns {{ supported: boolean, status?: string, reason?: string }}
 */
export function getLinkCheckSupport(link) {
  if (!link?.url) {
    return { supported: false, status: "unknown", reason: "链接地址为空" };
  }

  if (link.type === "magnet" || link.type === "ed2k") {
    return {
      supported: false,
      status: "unsupported",
      reason: "该链接没有网页状态可检测",
    };
  }

  if (!/^https?:\/\//i.test(link.url) || !CHECKABLE_TYPES.has(link.type)) {
    return {
      supported: false,
      status: "unsupported",
      reason: "暂不支持该链接类型",
    };
  }

  return { supported: true };
}

function timestampOf(value) {
  const timestamp = new Date(value || "").getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function relevanceOf(item, link, keyword) {
  if (link.workTitle) {
    return scoreRelevance(
      { title: link.workTitle, content: "", tags: [] },
      keyword
    ).score;
  }
  return scoreRelevance(item, keyword).score;
}

/**
 * 每个网盘类型按“结果”取最新 5 条和相关度 5 条的并集。
 * 结果入选后，该结果中同一网盘的所有链接都会检测；相同 URL 仍只保留一条。
 *
 * @param {Array<Object>} results
 * @param {string} keyword
 * @param {number} [perRank]
 */
export function selectLinkCheckCandidates(
  results,
  keyword,
  perRank = LINK_CHECK_PER_RANK
) {
  /** @type {Map<string, Map<string, Object>>} */
  const grouped = new Map();

  for (const [itemIndex, item] of (Array.isArray(results) ? results : []).entries()) {
    const resultKey =
      item?.uniqueId ||
      item?.messageUrl ||
      `${item?.channel || ""}|${item?.messageId || ""}|${itemIndex}`;

    for (const link of Array.isArray(item?.links) ? item.links : []) {
      if (!link?.url || !normalizeUrlKey(link.url)) continue;

      const type = link.type || "unknown";
      if (!grouped.has(type)) grouped.set(type, new Map());

      const resultGroups = grouped.get(type);
      let resultGroup = resultGroups.get(resultKey);
      if (!resultGroup) {
        resultGroup = {
          resultKey,
          item,
          timestamp: timestampOf(item.datetime),
          relevance: 0,
          links: new Map(),
        };
        resultGroups.set(resultKey, resultGroup);
      }

      const key = linkCheckKey(link);
      const relevance = relevanceOf(item, link, keyword);
      resultGroup.relevance = Math.max(resultGroup.relevance, relevance);

      const candidate = {
        key,
        item,
        link,
        timestamp: resultGroup.timestamp,
        relevance,
      };
      const existing = resultGroup.links.get(key);
      if (
        !existing ||
        candidate.relevance > existing.relevance ||
        (candidate.relevance === existing.relevance &&
          candidate.timestamp > existing.timestamp)
      ) {
        resultGroup.links.set(key, candidate);
      }
    }
  }

  const selected = [];
  const limit = Math.max(1, Number(perRank) || LINK_CHECK_PER_RANK);

  const selectedByKey = new Map();

  for (const resultGroups of grouped.values()) {
    const list = [...resultGroups.values()];
    const byTime = [...list].sort(
      (a, b) =>
        b.timestamp - a.timestamp ||
        b.relevance - a.relevance ||
        a.resultKey.localeCompare(b.resultKey)
    );
    const byRelevance = [...list].sort(
      (a, b) =>
        b.relevance - a.relevance ||
        b.timestamp - a.timestamp ||
        a.resultKey.localeCompare(b.resultKey)
    );

    const union = new Map();
    for (const resultGroup of byTime.slice(0, limit)) {
      union.set(resultGroup.resultKey, resultGroup);
    }
    for (const resultGroup of byRelevance.slice(0, limit)) {
      union.set(resultGroup.resultKey, resultGroup);
    }

    for (const resultGroup of union.values()) {
      for (const candidate of resultGroup.links.values()) {
        const existing = selectedByKey.get(candidate.key);
        if (
          !existing ||
          candidate.timestamp > existing.timestamp ||
          (candidate.timestamp === existing.timestamp &&
            candidate.relevance > existing.relevance)
        ) {
          selectedByKey.set(candidate.key, candidate);
        }
      }
    }
  }

  selected.push(...selectedByKey.values());
  return selected;
}

function classifyResponse(status) {
  if (status >= 200 && status < 400) return "reachable";
  if (status === 401 || status === 403) return "restricted";
  if (status === 404 || status === 410) return "dead";
  if (status === 408 || status === 425 || status === 429 || status >= 500) {
    return "unavailable";
  }
  return "unknown";
}

function linkAbortSignal(parentSignal) {
  const controller = new AbortController();
  if (!parentSignal) return { controller, cleanup: () => {} };

  const abort = () => controller.abort();
  if (parentSignal.aborted) abort();
  else parentSignal.addEventListener("abort", abort, { once: true });

  return {
    controller,
    cleanup: () => parentSignal.removeEventListener("abort", abort),
  };
}

/**
 * @param {{ type?: string, url?: string }} link
 * @param {{ signal?: AbortSignal }} [opts]
 */
export async function checkLink(link, opts = {}) {
  const support = getLinkCheckSupport(link);
  if (!support.supported) {
    return {
      status: support.status || "unknown",
      reason: support.reason || "暂不支持",
    };
  }

  const { controller, cleanup } = linkAbortSignal(opts.signal);
  const timer = window.setTimeout(
    () => controller.abort(),
    LINK_CHECK_TIMEOUT_MS
  );

  try {
    const response = await fetch(link.url, {
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
      },
      signal: controller.signal,
      credentials: "omit",
      cache: "no-store",
      redirect: "follow",
    });

    // 只读响应头。取消 body，避免为了判断状态下载整页内容。
    try {
      await response.body?.cancel();
    } catch {
      // 某些网盘没有可取消的 body，不影响状态判断。
    }

    const status = classifyResponse(response.status);
    return {
      status,
      httpStatus: response.status,
      reason: `HTTP ${response.status}`,
    };
  } catch (error) {
    if (opts.signal?.aborted) return { status: "cancelled" };
    const name = error?.name || "";
    return {
      status: "unknown",
      reason:
        name === "AbortError" ? "请求超时" : "网络或跨域无法判断",
    };
  } finally {
    window.clearTimeout(timer);
    cleanup();
  }
}

/**
 * 受限并发检测。每条链接独立返回结果，单个网盘异常不会中断整轮检测。
 * @param {Array<Object>} candidates
 * @param {{ signal?: AbortSignal, concurrency?: number, onResult?: Function }} [opts]
 */
export async function runLinkChecks(candidates, opts = {}) {
  const list = Array.isArray(candidates) ? candidates : [];
  let next = 0;

  async function worker() {
    while (!opts.signal?.aborted) {
      const candidate = list[next++];
      if (!candidate) return;
      const result = await checkLink(candidate.link, { signal: opts.signal });
      if (opts.signal?.aborted || result.status === "cancelled") return;
      opts.onResult?.(candidate, result);
    }
  }

  const concurrency = Math.max(
    1,
    Math.min(Number(opts.concurrency) || LINK_CHECK_CONCURRENCY, list.length)
  );
  await Promise.all(
    Array.from({ length: concurrency }, () => worker())
  );
}
