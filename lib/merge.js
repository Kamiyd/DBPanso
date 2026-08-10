import { normalizeUrlKey } from "./patterns.js";
import { scoreRelevance, sortByRelevance } from "./relevance.js";

export function dedupeResults(results) {
  const urlToIndex = new Map();
  const kept = [];

  const sorted = [...results].sort(
    (a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime()
  );

  for (const item of sorted) {
    const keys = item.links.map((l) => normalizeUrlKey(l.url));
    if (keys.length === 0) {
      kept.push({ ...item, mergedFromChannels: [item.channel] });
      continue;
    }

    let existingIdx = null;
    for (const k of keys) {
      if (urlToIndex.has(k)) {
        existingIdx = urlToIndex.get(k);
        break;
      }
    }

    if (existingIdx === null) {
      const copy = {
        ...item,
        mergedFromChannels: [item.channel],
      };
      const idx = kept.length;
      kept.push(copy);
      for (const k of keys) urlToIndex.set(k, idx);
    } else {
      const existing = kept[existingIdx];
      if (!existing.mergedFromChannels.includes(item.channel)) {
        existing.mergedFromChannels.push(item.channel);
      }
      for (const k of keys) {
        if (!urlToIndex.has(k)) urlToIndex.set(k, existingIdx);
      }
      for (const link of item.links) {
        const nk = normalizeUrlKey(link.url);
        if (!existing.links.some((l) => normalizeUrlKey(l.url) === nk)) {
          existing.links.push(link);
        }
      }
    }
  }

  return kept;
}

export function sortResults(results, mode, kw) {
  if (mode === "relevance") {
    return sortByRelevance(results, kw);
  }

  return [...results].sort((a, b) => {
    const sa = scoreRelevance(a, kw);
    const sb = scoreRelevance(b, kw);
    if (sa.titleHit !== sb.titleHit) return sa.titleHit ? -1 : 1;
    return new Date(b.datetime).getTime() - new Date(a.datetime).getTime();
  });
}
