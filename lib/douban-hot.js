const HOT_SEARCH_URL =
  "https://movie.douban.com/j/search_subjects?type=movie&tag=%E7%83%AD%E9%97%A8&sort=recommend&page_limit=10&page_start=0";
const CHART_URL = "https://movie.douban.com/chart";
const CACHE_KEY = "doubanHotMovies";

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function parseHotSearch(payload) {
  const subjects = Array.isArray(payload?.subjects) ? payload.subjects : [];
  return subjects.slice(0, 10).reduce((movies, subject, index) => {
    const title = cleanText(subject?.title);
    const href = cleanText(subject?.url);
    if (!title || !href) return movies;
    let url = "";
    try {
      url = new URL(href, "https://movie.douban.com/").href;
    } catch {
      return movies;
    }
    movies.push({
      id: cleanText(subject?.id) || url,
      title,
      score: /^\d+(\.\d+)?$/.test(cleanText(subject?.rate))
        ? cleanText(subject.rate)
        : "",
      url,
      rank: index + 1,
    });
    return movies;
  }, []);
}

function parseWeeklyChart(html) {
  const document = new DOMParser().parseFromString(html, "text/html");
  return [...document.querySelectorAll("#listCont2 li")]
    .slice(0, 10)
    .map((node, index) => {
      const link = node.querySelector(".name a[href*='/subject/']");
      const title = cleanText(link?.textContent);
      if (!title || !link) return null;
      const href = new URL(link.getAttribute("href"), CHART_URL).href;
      const rank = Number.parseInt(cleanText(node.querySelector(".no")?.textContent), 10);
      return {
        id: href,
        title,
        score: "",
        url: href,
        rank: Number.isFinite(rank) ? rank : index + 1,
      };
    })
    .filter(Boolean);
}

async function requestHtml(url, signal) {
  const response = await fetch(url, {
    signal,
    cache: "no-store",
    credentials: "omit",
    headers: { Accept: "text/html,application/xhtml+xml" },
  });
  if (!response.ok) throw new Error(`豆瓣返回 ${response.status}`);
  return response.text();
}

async function requestJson(url, signal) {
  const response = await fetch(url, {
    signal,
    cache: "no-store",
    credentials: "omit",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`豆瓣返回 ${response.status}`);
  return response.json();
}

async function readCache() {
  try {
    const data = await chrome.storage.local.get([CACHE_KEY]);
    const cached = data[CACHE_KEY];
    if (!cached || !Array.isArray(cached.movies) || !cached.movies.length) return null;
    return {
      movies: cached.movies.slice(0, 10),
      fetchedAt: Number(cached.fetchedAt) || 0,
      source: cached.source || "豆瓣热门",
    };
  } catch {
    return null;
  }
}

async function writeCache(movies, source) {
  try {
    await chrome.storage.local.set({
      [CACHE_KEY]: {
        movies: movies.slice(0, 10),
        fetchedAt: Date.now(),
        source,
      },
    });
  } catch {
    // Recommendations are optional; storage failures should not block the sidepanel.
  }
}

/**
 * Fetches Douban's recommended "热门" list from the sidepanel itself, so it
 * works regardless of which website is currently active. The public chart is
 * a fallback for locations where the JSON endpoint is unavailable.
 */
export async function loadDoubanHotMovies({ signal } = {}) {
  const sources = [
    [HOT_SEARCH_URL, requestJson, parseHotSearch, "豆瓣热门"],
    [CHART_URL, requestHtml, parseWeeklyChart, "豆瓣口碑榜"],
  ];
  let lastError = null;
  let best = null;

  for (const [url, request, parse, label] of sources) {
    try {
      const movies = parse(await request(url, signal));
      if (movies.length > (best?.movies.length || 0)) {
        best = { movies, source: label };
      }
      if (movies.length >= 10) {
        await writeCache(movies, label);
        return { movies, source: label, cached: false };
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (best?.movies.length) {
    await writeCache(best.movies, best.source);
    return { ...best, cached: false };
  }

  const cached = await readCache();
  if (cached) return { ...cached, cached: true };
  throw lastError || new Error("暂时无法同步豆瓣热门电影");
}
