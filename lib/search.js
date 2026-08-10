import { dedupeResults, sortResults } from "./merge.js";
import { mapPool } from "./pool.js";
import { filterByKeyword } from "./relevance.js";
import { loadChannels, loadConcurrency } from "./storage.js";
import { searchChannel } from "./telegram.js";

/**
 * @param {string} kw
 * @param {{ refresh?: boolean, onProgress?: Function }} [opts]
 */
export async function runSearch(kw, opts = {}) {
  const q = (kw || "").trim();
  if (!q) throw new Error("关键词不能为空");

  const channels = (await loadChannels()).filter((c) => c.enabled);
  if (channels.length === 0) {
    return {
      total: 0,
      results: [],
      channelStats: [],
      noChannels: true,
    };
  }

  const concurrency = await loadConcurrency();
  const slugs = channels.map((c) => c.slug);

  const tasks = slugs.map(
    (slug) => () => searchChannel(slug, q)
  );

  const settled = await mapPool(tasks, concurrency, (done, total, last) => {
    opts.onProgress?.({
      done,
      total,
      lastChannel: last?.channel,
      lastStatus: last?.status,
      lastCount: last?.count,
    });
  });

  const channelStats = [];
  const allResults = [];

  for (const r of settled) {
    channelStats.push({
      channel: r.channel,
      status: r.status,
      count: r.count,
      elapsedMs: r.elapsedMs,
      error: r.error,
    });
    allResults.push(...r.results);
  }

  const filtered = filterByKeyword(allResults, q);
  const deduped = dedupeResults(filtered);
  const sorted = sortResults(deduped, "time", q);

  return {
    total: sorted.length,
    results: sorted,
    channelStats,
    noChannels: false,
  };
}
