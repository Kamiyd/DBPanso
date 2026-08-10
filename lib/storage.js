import { DEFAULT_CHANNELS } from "./types.js";

const CHANNELS_KEY = "channels";
const HISTORY_KEY = "history";
const SORT_KEY = "sort";
const CONCURRENCY_KEY = "concurrency";
const PENDING_SEARCH_KEY = "pendingSearch";

function storageGet(keys) {
  return chrome.storage.local.get(keys);
}

function storageSet(obj) {
  return chrome.storage.local.set(obj);
}

export async function loadChannels() {
  const data = await storageGet([CHANNELS_KEY]);
  const parsed = data[CHANNELS_KEY];
  if (!Array.isArray(parsed) || parsed.length === 0) {
    const fresh = DEFAULT_CHANNELS.map((c) => ({ ...c }));
    await storageSet({ [CHANNELS_KEY]: fresh });
    return fresh;
  }

  // 合并默认列表里新增的频道（不覆盖用户已改的 enabled / title）
  const have = new Set(
    parsed.map((c) => String(c?.slug || "").toLowerCase()).filter(Boolean)
  );
  const extras = DEFAULT_CHANNELS.filter(
    (c) => c.slug && !have.has(c.slug.toLowerCase())
  ).map((c) => ({ ...c }));

  if (extras.length === 0) return parsed;

  const merged = [...parsed, ...extras];
  await storageSet({ [CHANNELS_KEY]: merged });
  return merged;
}

export async function saveChannels(channels) {
  await storageSet({ [CHANNELS_KEY]: channels });
}

export async function loadHistory() {
  const data = await storageGet([HISTORY_KEY]);
  const parsed = data[HISTORY_KEY];
  return Array.isArray(parsed) ? parsed.slice(0, 12) : [];
}

export async function pushHistory(kw) {
  const list = (await loadHistory()).filter((h) => h !== kw);
  list.unshift(kw);
  const next = list.slice(0, 12);
  await storageSet({ [HISTORY_KEY]: next });
  return next;
}

export async function removeHistory(kw) {
  const next = (await loadHistory()).filter((h) => h !== kw);
  await storageSet({ [HISTORY_KEY]: next });
  return next;
}

export async function loadSort() {
  const data = await storageGet([SORT_KEY]);
  const s = data[SORT_KEY];
  // 默认按时间：网盘资源可能失效，优先展示较新的
  if (s === "relevance") return "relevance";
  return "time";
}

export async function saveSort(sort) {
  await storageSet({ [SORT_KEY]: sort });
}

export async function loadConcurrency() {
  const data = await storageGet([CONCURRENCY_KEY]);
  const n = Number(data[CONCURRENCY_KEY]);
  if (Number.isFinite(n) && n >= 2 && n <= 20) return Math.floor(n);
  return 8;
}

export async function saveConcurrency(n) {
  await storageSet({ [CONCURRENCY_KEY]: n });
}

/** 豆瓣页点击后，侧边栏读取的待搜索关键词 */
export async function setPendingSearch(payload) {
  await storageSet({
    [PENDING_SEARCH_KEY]: {
      ...payload,
      ts: Date.now(),
    },
  });
}

export async function consumePendingSearch() {
  const data = await storageGet([PENDING_SEARCH_KEY]);
  const p = data[PENDING_SEARCH_KEY];
  if (!p || !p.kw) return null;
  // 30s 内有效
  if (Date.now() - (p.ts || 0) > 30_000) {
    await storageSet({ [PENDING_SEARCH_KEY]: null });
    return null;
  }
  await storageSet({ [PENDING_SEARCH_KEY]: null });
  return p;
}

export async function peekPendingSearch() {
  const data = await storageGet([PENDING_SEARCH_KEY]);
  const p = data[PENDING_SEARCH_KEY];
  if (!p || !p.kw) return null;
  if (Date.now() - (p.ts || 0) > 30_000) return null;
  return p;
}
