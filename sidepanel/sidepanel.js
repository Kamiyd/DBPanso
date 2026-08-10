import {
  formatLinkDisplay,
  formatRelativeTime,
  highlightKeyword,
} from "../lib/format.js";
import { iconHtml } from "../lib/icon-library.js?v=20260809-dbpanso-1";
import { panIconBadgeHtml, panIconHtml } from "../lib/icons.js?v=20260809-dbpanso-1";
import { sortResults } from "../lib/merge.js";
import {
  extractQualityFromItem,
  qualityBadgesHtml,
  qualityHighlight,
} from "../lib/quality.js?v=20260806-cuelume-1";
import { runSearch } from "../lib/search.js";
import { loadDoubanHotMovies } from "../lib/douban-hot.js?v=20260804-hot-recommendations-3";
import {
  consumePendingSearch,
  loadSort,
  saveSort,
} from "../lib/storage.js";
import { initSound } from "../lib/sound.js";
import { PAN_TAB_ORDER } from "../lib/types.js";
import {
  LINK_CHECK_STATUS_META,
  getLinkCheckSupport,
  linkCheckKey,
  runLinkChecks,
  selectLinkCheckCandidates,
} from "../lib/link-check.js?v=20260807-result-candidates-1";

const $ = (sel) => document.querySelector(sel);

const state = {
  kw: "",
  results: [],
  loading: false,
  activeTab: "all",
  sortMode: "time",
  qualityFilters: [],
  abortToken: 0,
  linkCheckController: null,
  linkChecks: new Map(),
};

let sound = null;

const PROGRESS_LEAVE_MS = 360;
const SEARCH_PROGRESS_CUE_DELAY_MS = 1800;
const SEARCH_PROGRESS_CUE_VOLUME = 0.28;

const els = {
  progress: $("#progress"),
  progressFill: $("#progress-fill"),
  progressText: $("#progress-text"),
  toolbar: $("#toolbar"),
  tabs: $("#type-tabs"),
  sortGroup: $(".sort-group"),
  qualityFilter: $("#quality-filter"),
  qualityFilterChips: $("#quality-filter-chips"),
  qualityFilterClear: $("#quality-filter-clear"),
  results: $("#results"),
  empty: $("#empty"),
  error: $("#error"),
  panelTitle: $("#panel-title"),
  panelHeadline: $("#panel-headline"),
  inlineSearch: $("#panel-inline-search"),
  inlineSearchInput: $("#panel-inline-search-input"),
  inlineSearchClear: $("#panel-inline-search-clear"),
  inlineSearchToggle: $("#btn-inline-search"),
  settings: $("#btn-settings"),
  sound: $("#btn-sound"),
  recommendations: $("#recommendations"),
  recommendationsStatus: $("#recommendations-status"),
  recommendationList: $("#recommendation-list"),
};

function cancelLinkChecks() {
  state.linkCheckController?.abort();
  state.linkCheckController = null;
}

function resetLinkChecks() {
  cancelLinkChecks();
  state.linkChecks = new Map();
}

function prepareLinkChecks(results, keyword) {
  const candidates = selectLinkCheckCandidates(results, keyword);
  const pending = [];

  state.linkChecks = new Map();

  for (const candidate of candidates) {
    const support = getLinkCheckSupport(candidate.link);
    if (support.supported) {
      state.linkChecks.set(candidate.key, {
        status: "checking",
        reason: "正在检测链接页面",
      });
      pending.push(candidate);
    } else {
      state.linkChecks.set(candidate.key, {
        status: support.status || "unknown",
        reason: support.reason || "暂不支持",
      });
    }
  }

  return { candidates, pending };
}

function renderLinkStatus(record) {
  if (!record) return "";
  const status = LINK_CHECK_STATUS_META[record.status]
    ? record.status
    : "unknown";
  const meta = LINK_CHECK_STATUS_META[status];
  const title = record.reason ? `${meta.title} · ${record.reason}` : meta.title;
  return `<span class="link-status link-status--${status}" role="img" title="${escapeAttr(title)}" aria-label="${escapeAttr(meta.label)}"></span>`;
}

function updateLinkStatusDom(key) {
  const record = state.linkChecks.get(key);
  if (!record) return;
  els.results.querySelectorAll(".link-row[data-link-check-key]").forEach((row) => {
    if (row.dataset.linkCheckKey !== key) return;
    const status = row.querySelector(".link-status");
    if (status) status.outerHTML = renderLinkStatus(record);
  });
}

function startLinkChecks(pending, token) {
  if (!pending.length) return;

  const controller = new AbortController();
  state.linkCheckController = controller;

  void runLinkChecks(pending, {
    signal: controller.signal,
    onResult: (candidate, result) => {
      if (token !== state.abortToken || controller.signal.aborted) return;
      state.linkChecks.set(candidate.key, result);
      updateLinkStatusDom(candidate.key);
    },
  })
    .catch(() => {
      // 单条链接的异常已在 checkLink 内转为状态；这里只保护检测池。
    })
    .finally(() => {
      if (state.linkCheckController === controller) {
        state.linkCheckController = null;
      }
    });
}

function setPanelTitle(title) {
  if (els.panelTitle.textContent === title) return;
  els.panelTitle.textContent = title;
}

function updateInlineSearchClear() {
  const isOpen = els.panelHeadline.classList.contains("is-searching");
  els.inlineSearchClear.classList.toggle("is-visible", isOpen);
  els.inlineSearchClear.setAttribute("aria-hidden", String(!isOpen));
}

function updateSoundButton(enabled = sound?.enabled) {
  if (!els.sound || typeof enabled !== "boolean") return;
  els.sound.innerHTML = iconHtml(enabled ? "volume-2" : "volume-off", {
    size: 15,
    color: "currentColor",
    strokeWidth: 1.9,
  });
  els.sound.title = enabled ? "关闭音效" : "开启音效";
  els.sound.setAttribute("aria-label", enabled ? "关闭音效" : "开启音效");
  els.sound.setAttribute("aria-pressed", String(enabled));
  els.sound.classList.toggle("is-muted", !enabled);
}

function setInlineSearchOpen(open, { focus = true } = {}) {
  els.panelHeadline.classList.toggle("is-searching", open);
  els.inlineSearchInput.tabIndex = open ? 0 : -1;
  els.inlineSearchToggle.setAttribute("aria-expanded", String(open));
  // Keep the search glyph as the leading mark while the circle morphs into the field.
  els.inlineSearchToggle.innerHTML = iconHtml("search", {
    size: 14,
    color: "currentColor",
    strokeWidth: 2.1,
  });
  els.inlineSearchToggle.title = open ? "收起搜索" : "搜索其他电影";
  els.inlineSearchToggle.setAttribute(
    "aria-label",
    open ? "收起搜索" : "搜索其他电影"
  );

  if (open) {
    els.inlineSearchInput.value = "";
    updateInlineSearchClear();
    if (focus) {
      window.requestAnimationFrame(() => {
        els.inlineSearchInput.focus();
        els.inlineSearchInput.select();
      });
    }
  } else {
    els.inlineSearchInput.blur();
    updateInlineSearchClear();
  }
}

function submitInlineSearch() {
  const query = els.inlineSearchInput.value.trim();
  if (!query || state.loading) return;
  setInlineSearchOpen(false, { focus: false });
  if (query === state.kw && state.results.length) return;
  doSearch(query);
}

async function init() {
  sound = await initSound();
  sound.subscribe(updateSoundButton);
  setPanelTitle("等待搜索");
  setupSlidingControl(els.tabs, ".tab");
  setupSlidingControl(els.sortGroup, ".chip", { preview: false });
  state.sortMode = await loadSort();
  updateSortChips();

  els.settings.innerHTML = iconHtml("settings", {
    size: 16,
    color: "currentColor",
    strokeWidth: 1.8,
  });
  els.inlineSearchToggle.innerHTML = iconHtml("search", {
    size: 14,
    color: "currentColor",
    strokeWidth: 2.1,
  });
  els.inlineSearchClear.innerHTML = iconHtml("close", {
    size: 13,
    color: "currentColor",
    strokeWidth: 2.2,
  });
  updateInlineSearchClear();
  els.inlineSearchToggle.addEventListener("click", () => {
    const open = !els.panelHeadline.classList.contains("is-searching");
    sound.play(open ? "searchOpen" : "tap");
    setInlineSearchOpen(open);
  });
  els.inlineSearch.addEventListener("submit", (event) => {
    event.preventDefault();
    submitInlineSearch();
  });
  els.inlineSearchInput.addEventListener("input", updateInlineSearchClear);
  els.inlineSearchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submitInlineSearch();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setInlineSearchOpen(false, { focus: false });
    }
  });
  els.inlineSearchClear.addEventListener("click", () => {
    sound.play("clear");
    els.inlineSearchInput.value = "";
    updateInlineSearchClear();
    setInlineSearchOpen(false, { focus: false });
  });
  els.settings.addEventListener("click", () => {
    sound.play("settings");
    chrome.runtime.openOptionsPage();
  });
  els.sound.addEventListener("click", async () => {
    const next = await sound.toggle();
    if (next) sound.play("switchOn", { force: true });
  });

  els.recommendationList.addEventListener("click", (event) => {
    const item = event.target.closest?.("[data-recommendation-title]");
    if (!item || state.loading) return;
    const title = item.dataset.recommendationTitle?.trim();
    if (!title) return;
    setInlineSearchOpen(false, { focus: false });
    doSearch(title);
  });

  loadRecommendations();

  els.qualityFilterClear.addEventListener("click", () => {
    if (!state.qualityFilters.length) return;
    sound.play("filterOff", { force: true });
    state.qualityFilters = [];
    updateQualityFilterUi();
    renderResults({ animateCards: true, animateTabs: false });
  });

  els.qualityFilterChips.addEventListener("click", (event) => {
    const chip = event.target.closest?.("[data-filter-q]");
    if (!chip) return;
    toggleQualityFilter(
      chip.dataset.filterQ,
      chip.dataset.label || chip.textContent.trim(),
      chip.dataset.qCat,
      chip.classList.contains("q-tag--premium")
    );
  });

  document.querySelectorAll(".chip[data-sort]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const mode = btn.dataset.sort;
      if (mode !== "time" && mode !== "relevance") return;
      if (mode === state.sortMode) return;
      sound.play("sort");
      state.sortMode = mode;
      updateSortChips();
      renderResults({ animateCards: true, animateTabs: false });
      await saveSort(mode);
    });
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "PENDING_SEARCH" && msg.payload?.kw) {
      applyPending(msg.payload);
    }
  });

  // storage 变化（侧边栏已打开时再次点击豆瓣按钮）
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.pendingSearch?.newValue?.kw) {
      const p = changes.pendingSearch.newValue;
      applyPending(p);
      chrome.storage.local.set({ pendingSearch: null });
    }
  });

  // 打开时消费 pending；侧边栏冷启动可能略晚于 writePending，短轮询兜底
  let pending = await consumePendingSearch();
  if (!pending?.kw) {
    for (let i = 0; i < 8 && !pending?.kw; i++) {
      await new Promise((r) => setTimeout(r, 120));
      pending = await consumePendingSearch();
    }
  }
  if (pending?.kw) {
    applyPending(pending);
  }
}

async function loadRecommendations() {
  els.recommendations.classList.remove("hidden");
  els.recommendationsStatus.textContent = "同步中";
  els.recommendationList.innerHTML =
    '<span class="recommendations-loading">正在读取豆瓣热门…</span>';

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  try {
    const result = await loadDoubanHotMovies({ signal: controller.signal });
    renderRecommendations(result.movies, result);
  } catch {
    els.recommendationsStatus.textContent = "暂不可用";
    els.recommendationList.innerHTML =
      '<span class="recommendations-loading">豆瓣热门暂时无法同步</span>';
  } finally {
    window.clearTimeout(timeout);
  }
}

function renderRecommendations(movies, { source = "豆瓣热门", cached = false } = {}) {
  if (!Array.isArray(movies) || !movies.length) {
    els.recommendations.classList.add("hidden");
    return;
  }

  els.recommendations.classList.remove("hidden");
  els.recommendationsStatus.textContent = cached ? "使用缓存" : "刚刚同步";
  els.recommendationsStatus.title = source;
  els.recommendationList.innerHTML = movies
    .slice(0, 10)
    .map((movie, index) => {
      const rank = String(movie.rank || index + 1).padStart(2, "0");
      const meta = movie.score ? `豆瓣 ${movie.score}` : "";
      return `
        <button type="button" class="recommendation-item" data-recommendation-title="${escapeAttr(movie.title)}" title="搜索「${escapeAttr(movie.title)}」">
          <span class="recommendation-rank">${rank}</span>
          <span class="recommendation-name">${escapeHtml(movie.title)}</span>
          <span class="recommendation-meta">${escapeHtml(meta)}${iconHtml("search", { size: 12, color: "currentColor", strokeWidth: 2.1 })}</span>
        </button>
      `;
    })
    .join("");
}

function applyPending(payload) {
  const kw = (payload.kw || "").trim();
  if (!kw) return;

  // 豆瓣网页主按钮已经在点击时播放 loading；侧边栏只负责继续流程，避免重复。
  doSearch(kw, { skipStartSound: payload.source === "douban" });
}

function updateSortChips() {
  document.querySelectorAll(".chip[data-sort]").forEach((btn) => {
    const active = btn.dataset.sort === state.sortMode;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", String(active));
  });
  syncSlidingControl(els.sortGroup);
}

const slidingControls = new WeakMap();

function setupSlidingControl(group, itemSelector, { preview = true } = {}) {
  if (!group || slidingControls.has(group)) return;

  const control = {
    itemSelector,
    pointerTarget: null,
    focusTarget: null,
    frame: 0,
  };
  slidingControls.set(group, control);
  group.classList.add("has-control-slider");
  ensureControlSlider(group);

  const refreshPreview = () => {
    const target =
      control.pointerTarget ||
      control.focusTarget ||
      group.querySelector(`${itemSelector}.active`);
    const isPreviewing = Boolean(target && !target.classList.contains("active"));
    group.classList.toggle("is-previewing", isPreviewing);
    syncSlidingControl(group, target);
  };

  if (preview) {
    group.addEventListener("pointerover", (event) => {
      const target = event.target.closest?.(itemSelector);
      if (!target || !group.contains(target) || control.pointerTarget === target) return;
      control.pointerTarget = target;
      refreshPreview();
    });

    group.addEventListener("pointerleave", () => {
      control.pointerTarget = null;
      refreshPreview();
    });

    group.addEventListener("focusin", (event) => {
      const target = event.target.closest?.(itemSelector);
      if (!target || !group.contains(target)) return;
      control.focusTarget = target;
      refreshPreview();
    });

    group.addEventListener("focusout", () => {
      window.setTimeout(() => {
        const target = document.activeElement?.closest?.(itemSelector);
        control.focusTarget = target && group.contains(target) ? target : null;
        refreshPreview();
      });
    });
  }

  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(() => scheduleSlidingControlSync(group));
    observer.observe(group);
    control.observer = observer;
  }
}

function ensureControlSlider(group) {
  let slider = group.querySelector(":scope > .control-slider");
  if (slider) return slider;
  slider = document.createElement("span");
  slider.className = "control-slider";
  slider.setAttribute("aria-hidden", "true");
  group.prepend(slider);
  return slider;
}

function syncSlidingControl(group, preferredTarget = null, instant = false) {
  const control = slidingControls.get(group);
  if (!control) return;
  let target =
    preferredTarget ||
    control.pointerTarget ||
    control.focusTarget ||
    group.querySelector(`${control.itemSelector}.active`);
  if (target && !group.contains(target)) {
    control.pointerTarget = null;
    control.focusTarget = null;
    target = group.querySelector(`${control.itemSelector}.active`);
  }
  if (!target || target.offsetWidth <= 0) return;

  const slider = ensureControlSlider(group);
  if (instant) group.classList.remove("is-slider-ready");
  slider.style.setProperty("--slider-x", `${target.offsetLeft}px`);
  slider.style.setProperty("--slider-width", `${target.offsetWidth}px`);

  if (!group.classList.contains("is-slider-ready")) {
    window.requestAnimationFrame(() => group.classList.add("is-slider-ready"));
  }
}

function scheduleSlidingControlSync(group, instant = false) {
  const control = slidingControls.get(group);
  if (!control) return;
  window.cancelAnimationFrame(control.frame);
  control.frame = window.requestAnimationFrame(() => {
    control.frame = 0;
    syncSlidingControl(group, null, instant);
  });
}

function showProgress() {
  document.body.classList.add("is-searching");
  document.body.classList.remove("is-searching-leaving");
  els.progress.classList.remove("is-leaving", "hidden");
  // 重触发进场动画
  void els.progress.offsetWidth;
}

function hideProgress(delayMs = 0) {
  const token = state.abortToken;
  const run = () => {
    if (token !== state.abortToken) return;
    if (els.progress.classList.contains("hidden")) {
      document.body.classList.remove("is-searching", "is-searching-leaving");
      return;
    }
    document.body.classList.add("is-searching-leaving");
    els.progress.classList.add("is-leaving");
    window.setTimeout(() => {
      if (token !== state.abortToken) return;
      els.progress.classList.add("hidden");
      els.progress.classList.remove("is-leaving");
      document.body.classList.remove("is-searching", "is-searching-leaving");
    }, PROGRESS_LEAVE_MS);
  };
  if (delayMs > 0) window.setTimeout(run, delayMs);
  else run();
}

async function doSearch(kw, { skipStartSound = false } = {}) {
  const q = kw.trim();
  if (!q || state.loading) return;

  if (!skipStartSound) sound?.play("searchStart", { force: true });

  const token = ++state.abortToken;
  state.loading = true;
  resetLinkChecks();
  state.kw = q;
  state.activeTab = "all";
  state.qualityFilters = [];
  state.results = [];
  updateQualityFilterUi();
  setPanelTitle("搜索中");

  els.error.classList.add("hidden");
  els.empty.classList.add("hidden");
  els.toolbar.classList.add("hidden");
  els.results.innerHTML = `
    <div class="skeleton"></div>
    <div class="skeleton"></div>
    <div class="skeleton"></div>
  `;
  showProgress();
  els.progressFill.style.width = "0%";
  els.progressText.textContent = "准备搜索…";

  // 长搜索只补一次极轻的空间感提示，不跟随每个频道进度反复发声。
  let progressCueTimer = window.setTimeout(() => {
    progressCueTimer = 0;
    if (token !== state.abortToken || !state.loading) return;
    sound?.play("whisper", {
      force: true,
      volume: SEARCH_PROGRESS_CUE_VOLUME,
    });
  }, SEARCH_PROGRESS_CUE_DELAY_MS);

  try {
    const data = await runSearch(q, {
      onProgress: ({ done, total, lastChannel, lastStatus, lastCount }) => {
        if (token !== state.abortToken) return;
        const pct = total ? Math.round((done / total) * 100) : 0;
        els.progressFill.style.width = `${pct}%`;
        els.progressText.textContent = `${done}/${total} · ${lastChannel || ""} ${lastStatus || ""}${
          lastCount ? ` +${lastCount}` : ""
        }`;
      },
    });

    if (token !== state.abortToken) return;

    if (data.noChannels) {
      sound?.play("error", { force: true });
      setPanelTitle("未配置频道");
      showError("尚未配置启用频道，请先在设置中添加频道。");
      els.results.innerHTML = "";
      els.empty.classList.remove("hidden");
      els.empty.querySelector(".empty-title").textContent = "未配置频道";
      els.empty.querySelector(".empty-desc").textContent =
        "打开设置页添加并启用至少一个公开 TG 频道。";
      resetLinkChecks();
      hideProgress(400);
      return;
    }

    state.results = data.results || [];
    const { pending: pendingLinkChecks } = prepareLinkChecks(
      state.results,
      state.kw
    );
    setPanelTitle(state.results.length ? "搜索结果" : "未找到结果");
    // 进度先满，再渲染结果，过渡更顺
    els.progressFill.style.width = "100%";
    renderResults({ revealSticker: true });
    startLinkChecks(pendingLinkChecks, token);
    sound?.play(state.results.length ? "searchEnd" : "empty", { force: true });

    const ok = (data.channelStats || []).filter((s) => s.status === "ok").length;
    const limited = (data.channelStats || []).filter(
      (s) => s.status === "rate_limited"
    ).length;
    els.progressText.textContent = `完成 · ${state.results.length} 条 · ${ok} 频道命中${
      limited ? ` · ${limited} 限流` : ""
    }`;
    hideProgress(1400);
  } catch (e) {
    if (token !== state.abortToken) return;
    sound?.play("error", { force: true });
    setPanelTitle("搜索失败");
    showError(e instanceof Error ? e.message : String(e));
    els.results.innerHTML = "";
    els.empty.classList.remove("hidden");
    els.empty.querySelector(".empty-title").textContent = "搜索失败";
    els.empty.querySelector(".empty-desc").textContent =
      "请稍后重试，或检查频道列表是否可用。";
    resetLinkChecks();
    hideProgress(400);
  } finally {
    if (progressCueTimer) {
      window.clearTimeout(progressCueTimer);
      progressCueTimer = 0;
    }
    if (token === state.abortToken) {
      state.loading = false;
    }
  }
}

function showError(msg) {
  els.error.textContent = msg;
  els.error.classList.remove("hidden");
}

function getQualityFilteredSorted() {
  const sorted = sortResults(state.results, state.sortMode, state.kw);
  if (!state.qualityFilters.length) return sorted;
  const filterIds = new Set(state.qualityFilters.map((filter) => filter.id));
  return sorted.filter((item) => {
    const itemIds = new Set(extractQualityFromItem(item).map((tag) => tag.id));
    return [...filterIds].every((id) => itemIds.has(id));
  });
}

function getFiltered(sorted = getQualityFilteredSorted()) {
  if (state.activeTab === "all") return sorted;
  return sorted
    .map((r) => ({
      ...r,
      links: r.links.filter((l) => l.type === state.activeTab),
    }))
    .filter((r) => r.links.length > 0);
}

function renderTabs(sorted) {
  const counts = { all: sorted.length };
  for (const r of sorted) {
    for (const l of r.links) {
      counts[l.type] = (counts[l.type] || 0) + 1;
    }
  }

  els.tabs.querySelectorAll(".tab").forEach((tab) => tab.remove());
  let tabIndex = 0;
  for (const tab of PAN_TAB_ORDER) {
    const c = counts[tab.key] || 0;
    if (tab.key !== "all" && c === 0) continue;
    const count = tab.key === "all" ? counts.all || 0 : c;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.key = tab.key;
    btn.className = "tab" + (state.activeTab === tab.key ? " active" : "");
    btn.setAttribute("aria-pressed", String(state.activeTab === tab.key));
    btn.style.setProperty("--tab-i", String(tabIndex++));
    btn.innerHTML = `${panIconHtml(tab.key, {
      size: 14,
      className: "pan-icon tab-icon",
    })}<span class="tab-label">${tab.label}</span><span class="tab-count">${count}</span>`;
    btn.addEventListener("click", () => {
      if (state.activeTab === tab.key) return;
      sound?.play("tab");
      state.activeTab = tab.key;
      renderResults({ animateCards: true, animateTabs: false });
    });
    els.tabs.appendChild(btn);
  }
  scheduleSlidingControlSync(els.tabs, true);
}

/**
 * @param {{ animateCards?: boolean, animateTabs?: boolean, revealSticker?: boolean }} [opts]
 */
function renderResults(opts = {}) {
  const animateCards = opts.animateCards !== false;
  const animateTabs = opts.animateTabs !== false;
  const revealSticker = opts.revealSticker === true;
  const sorted = getQualityFilteredSorted();
  const filtered = getFiltered(sorted);

  if (!state.results.length) {
    els.toolbar.classList.add("hidden");
    els.results.innerHTML = "";
    els.empty.classList.remove("hidden");
    els.empty.querySelector(".empty-title").textContent =
      `未找到「${state.kw}」相关资源`;
    els.empty.querySelector(".empty-desc").textContent =
      "换个关键词，或检查频道列表是否可用。";
    return;
  }

  els.empty.classList.add("hidden");
  els.toolbar.classList.remove("hidden");
  scheduleSlidingControlSync(els.sortGroup);
  updateQualityFilterUi();
  if (animateTabs) {
    renderTabs(sorted);
  } else {
    // 仅更新 tab 选中态与数量，避免切换筛选时整行重播入场
    updateTabsActive(sorted);
  }
  els.results.innerHTML = "";

  if (!filtered.length) {
    els.empty.classList.remove("hidden");
    const filterLabel = getQualityFilterLabel();
    els.empty.querySelector(".empty-title").textContent =
      `没有符合「${filterLabel || "当前条件"}」的资源`;
    els.empty.querySelector(".empty-desc").textContent =
      "点击上方「已筛选」即可清除全部条件。";
    return;
  }

  filtered.forEach((item, i) => {
    els.results.appendChild(
      renderCard(item, animateCards ? i : -1, { revealSticker })
    );
  });
}

function updateTabsActive(sorted) {
  const counts = { all: sorted.length };
  for (const r of sorted) {
    for (const l of r.links) {
      counts[l.type] = (counts[l.type] || 0) + 1;
    }
  }
  const buttons = els.tabs.querySelectorAll(".tab");
  if (!buttons.length) {
    renderTabs(sorted);
    return;
  }
  // 简化：切换排序时 tabs 结构不变，只更新 active + count 文字
  // 若结构可能变化（筛选），仍走完整 renderTabs
  const visibleKeys = PAN_TAB_ORDER.filter((tab) => {
    const c = counts[tab.key] || 0;
    return tab.key === "all" || c > 0;
  }).map((t) => t.key);

  const currentKeys = [...buttons].map((b) => {
    // tab-label 文本对应 label，用 data-key 更稳
    return b.dataset.key;
  });

  if (
    visibleKeys.length !== currentKeys.length ||
    visibleKeys.some((k, i) => k !== currentKeys[i])
  ) {
    renderTabs(sorted);
    return;
  }

  buttons.forEach((btn) => {
    const key = btn.dataset.key;
    const active = key === state.activeTab;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", String(active));
    const countEl = btn.querySelector(".tab-count");
    if (countEl && key) {
      const c = key === "all" ? counts.all || 0 : counts[key] || 0;
      countEl.textContent = String(c);
    }
  });
  syncSlidingControl(els.tabs);
}

function renderCard(item, staggerIndex = 0, opts = {}) {
  const qualityTags = extractQualityFromItem(item);
  const qualityBadge = qualityHighlight(qualityTags);
  const revealSticker = opts.revealSticker === true;

  const card = document.createElement("article");
  card.className =
    "card" +
    (qualityBadge ? " card--featured" : "") +
    (revealSticker && qualityBadge ? " card--sticker-after-card" : "") +
    (staggerIndex >= 0 ? " card-enter" : "");
  if (staggerIndex >= 0) {
    card.style.setProperty("--i", String(Math.min(staggerIndex, 10)));
  }

  const titleHtml = highlightKeyword(item.title, state.kw);
  const qualityHtml = qualityBadgesHtml(qualityTags, {
    max: 6,
    activeIds: state.qualityFilters.map((filter) => filter.id),
  });
  const sourceLinkIcon = iconHtml("external-link", {
    size: 11,
    color: "currentColor",
    strokeWidth: 2.8,
    className: "card-meta-icon",
  });
  const metaParts = [
    `<span>${escapeAttr(item.channel)}</span>`,
    `<span>${formatRelativeTime(item.datetime)}</span>`,
  ];
  metaParts.push(
    `<a class="source-link" href="${escapeAttr(item.messageUrl)}" target="_blank" rel="noopener">${sourceLinkIcon}<span>来源</span></a>`
  );

  const linksHtml = item.links
    .map((link) => {
      // 只展示可点击链接；提取码若有则跟在后面，不展示 workTitle 等说明文字
      const pwd = link.password
        ? `<span class="link-pwd">${escapeAttr(link.password)}</span>`
        : "";
      const checkKey = linkCheckKey(link);
      const check = state.linkChecks.get(checkKey);
      const checkAttr = check
        ? ` data-link-check-key="${escapeAttr(checkKey)}"`
        : "";
      return `
        <a class="link-row"${checkAttr} href="${escapeAttr(link.url)}" target="_blank" rel="noopener noreferrer" title="${escapeAttr(link.url)}">
          ${panIconBadgeHtml(link.type, { size: 18 })}
          <span class="link-url">${escapeHtml(formatLinkDisplay(link.url, 48))}</span>
          ${pwd}
          ${renderLinkStatus(check)}
        </a>
      `;
    })
    .join("");

  card.innerHTML = `
    <h3 class="card-title">${titleHtml}</h3>
    ${qualityHtml}
    <div class="card-meta">${metaParts.join(" ")}</div>
    <div class="links">${linksHtml}</div>
  `;

  const firstRevealSticker = card.querySelector(".q-featured");
  if (revealSticker && firstRevealSticker) {
    const clearFirstReveal = (event) => {
      if (
        event?.type === "animationend" ||
        event?.type === "animationcancel"
      ) {
        if (event.animationName !== "sticker-first-reveal") return;
      }
      firstRevealSticker.removeEventListener("animationend", clearFirstReveal);
      firstRevealSticker.removeEventListener("animationcancel", clearFirstReveal);
      firstRevealSticker.removeEventListener("pointerenter", clearFirstReveal);
      firstRevealSticker.classList.add("is-first-complete");
      card.classList.remove("card--sticker-after-card");
    };
    firstRevealSticker.addEventListener("animationend", clearFirstReveal);
    firstRevealSticker.addEventListener("animationcancel", clearFirstReveal);
    firstRevealSticker.addEventListener("pointerenter", clearFirstReveal, {
      once: true,
    });
  }

  card.querySelectorAll(".q-tag[data-q]").forEach((tagButton) => {
    tagButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleQualityFilter(
        tagButton.dataset.q,
        tagButton.dataset.label || tagButton.textContent.trim(),
        tagButton.dataset.qCat,
        tagButton.classList.contains("q-tag--premium")
      );
    });
  });

  card.addEventListener("click", (event) => {
    const link = event.target.closest?.(".link-row, .source-link");
    if (link) sound?.play("link");
  });

  return card;
}

function toggleQualityFilter(id, label, cat = "extra", premium = false) {
  if (!id) return;
  const index = state.qualityFilters.findIndex((filter) => filter.id === id);
  if (index >= 0) {
    state.qualityFilters.splice(index, 1);
    sound?.play("filterOff");
  } else {
    state.qualityFilters.push({ id, label, cat, premium });
    sound?.play("filterOn");
  }
  updateQualityFilterUi();
  renderResults({ animateCards: true, animateTabs: false });
}

function updateQualityFilterUi() {
  const filters = state.qualityFilters;
  if (!filters.length) {
    els.qualityFilter.classList.add("hidden");
    els.qualityFilterChips.innerHTML = "";
    return;
  }
  els.qualityFilter.classList.remove("hidden");
  els.qualityFilterChips.innerHTML = filters
    .map((filter) => {
      const cat = /^[a-z]+$/.test(filter.cat || "") ? filter.cat : "extra";
      const premium = filter.premium ? " q-tag--premium" : "";
      return `<button type="button" class="q-tag q-tag--${cat}${premium} quality-filter-chip is-active" data-filter-q="${escapeAttr(filter.id)}" data-q="${escapeAttr(filter.id)}" data-q-cat="${cat}" data-label="${escapeAttr(filter.label)}" title="点击 × 取消筛选 ${escapeAttr(filter.label)}" aria-label="取消筛选 ${escapeAttr(filter.label)}" aria-pressed="true"><span class="q-tag-label">${escapeHtml(filter.label)}</span><span class="q-tag-remove" aria-hidden="true">×</span></button>`;
    })
    .join("");
  els.qualityFilterClear.title = "清除全部筛选";
  els.qualityFilterClear.setAttribute("aria-label", "清除全部筛选");
}

function getQualityFilterLabel() {
  return state.qualityFilters.map((filter) => filter.label).join("、");
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s) {
  return escapeHtml(String(s || ""));
}

init();
