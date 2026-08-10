import { formatRelativeTime } from "../lib/format.js";
import { extractChannelSlug } from "../lib/patterns.js";
import { mapPool } from "../lib/pool.js";
import {
  loadChannels,
  loadConcurrency,
  saveChannels,
  saveConcurrency,
} from "../lib/storage.js";
import { validateChannel } from "../lib/telegram.js";
import { DEFAULT_CHANNELS } from "../lib/types.js";
import {
  CHANNEL_SOURCE_CACHE_KEY,
  CHANNEL_SOURCE_REFRESH_MS,
  fetchPansouChannelSource,
} from "../lib/channel-source.js";
import { iconHtml } from "../lib/icon-library.js?v=20260809-dbpanso-1";
import { initSound } from "../lib/sound.js";

const $ = (s) => document.querySelector(s);

const els = {
  form: $("#add-form"),
  input: $("#channel-input"),
  searchIcon: $("#channel-search-icon"),
  msg: $("#add-msg"),
  checkMsg: $("#check-msg"),
  checkMsgText: $("#check-msg-text"),
  list: $("#channel-list"),
  stats: $("#stats"),
  actions: $(".actions"),
  concurrency: $("#concurrency"),
  check: $("#btn-check"),
  disableDead: $("#btn-disable-dead"),
  cancelCheck: $("#btn-cancel-check"),
  selectAll: $("#btn-select-all"),
  enableSelected: $("#btn-enable-selected"),
  disableSelected: $("#btn-disable-selected"),
  deleteSelected: $("#btn-delete-selected"),
  reset: $("#btn-reset"),
  sound: $("#btn-sound"),
  confirmDialog: $("#confirm-dialog"),
  confirmBackdrop: $("#confirm-backdrop"),
  confirmTitle: $("#confirm-title"),
  confirmMessage: $("#confirm-message"),
  confirmCancel: $("#confirm-cancel"),
  confirmCancelIcon: $("#confirm-cancel-icon"),
  confirmAccept: $("#confirm-accept"),
  confirmAcceptIcon: $("#confirm-accept-icon"),
  confirmAcceptLabel: $("#confirm-accept-label"),
  sourceIcon: $("#source-icon"),
  sourceStatus: $("#source-status"),
  sourceLinkIcon: $("#source-link-icon"),
  sourceFeedback: $("#source-feedback"),
  sourceRefresh: $("#btn-source-refresh"),
  sourceRefreshIcon: $("#source-refresh-icon"),
};

const ACTION_ICONS = new Map([
  ["btn-check", "radio"],
  ["btn-disable-dead", "close"],
  ["btn-select-all", "check"],
  ["btn-enable-selected", "check"],
  ["btn-disable-selected", "minus"],
  ["btn-delete-selected", "close"],
  ["btn-reset", "rotate-ccw"],
]);

/** @type {import('../lib/types.js').ChannelConfig[]} */
let channels = [];
let sound = null;

/** slug（小写）-> validateChannel 的返回值 */
const checkResults = new Map();
/** slug（小写）-> 该频道的行元素，检测过程中就地刷新，不整表重绘 */
const rowsBySlug = new Map();
let checking = false;
let adding = false;
let sourceSyncPromise = null;
let sourceFeedbackTimer = 0;
const selectedSlugs = new Set();
let confirmResolver = null;
let confirmPreviousFocus = null;

const keyOf = (slug) => String(slug).toLowerCase();

function setButtonLabel(button, label) {
  const labelEl = button?.querySelector(".btn-label");
  if (labelEl) labelEl.textContent = label;
  else if (button) button.textContent = label;
  if (button) {
    button.setAttribute("aria-label", label);
    button.title = label;
  }
}

function pruneSelectedSlugs() {
  const available = new Set(channels.map((channel) => keyOf(channel?.slug)));
  for (const slug of selectedSlugs) {
    if (!available.has(slug)) selectedSlugs.delete(slug);
  }
}

function syncRowSelections() {
  els.list.querySelectorAll(".row").forEach((row) => {
    const slug = row.dataset.slug;
    const target = row.querySelector(".row-select-target");
    if (!target) return;
    const selected = selectedSlugs.has(slug);
    target.setAttribute("aria-pressed", String(selected));
    row.classList.toggle("is-selected", selected);
  });
}

function updateSelectionUI() {
  pruneSelectedSlugs();
  const selectedCount = selectedSlugs.size;
  const total = channels.length;
  const allSelected = total > 0 && selectedCount === total;
  const resultsMode = checkResults.size > 0 && selectedCount === 0;

  els.actions.classList.toggle("is-selection-mode", selectedCount > 0);
  els.actions.classList.toggle("is-results-mode", resultsMode);
  if (els.cancelCheck) els.cancelCheck.hidden = !resultsMode;
  setButtonLabel(els.selectAll, allSelected ? "取消全选" : "全选");
  els.selectAll.disabled = total === 0;
  [els.enableSelected, els.disableSelected, els.deleteSelected].forEach(
    (button) => {
      if (button) button.hidden = selectedCount === 0;
    }
  );
  syncRowSelections();
}

function setupActionIcons() {
  ACTION_ICONS.forEach((name, id) => {
    const iconEl = document.querySelector(`#${id} .btn-icon`);
    if (!iconEl) return;
    iconEl.innerHTML = iconHtml(name, {
      size: 13,
      color: "currentColor",
      strokeWidth: 2.25,
    });
  });
}

function closeConfirm(result = false) {
  if (!confirmResolver) return;

  const resolve = confirmResolver;
  const previousFocus = confirmPreviousFocus;
  confirmResolver = null;
  confirmPreviousFocus = null;

  els.confirmDialog.hidden = true;
  els.confirmDialog.setAttribute("aria-hidden", "true");
  document.body.classList.remove("is-confirm-open");
  document.removeEventListener("keydown", onConfirmKeydown);
  resolve(result);

  if (previousFocus instanceof HTMLElement) {
    previousFocus.focus({ preventScroll: true });
  }
}

function onConfirmKeydown(event) {
  if (event.key === "Escape") {
    event.preventDefault();
    closeConfirm(false);
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    closeConfirm(event.target !== els.confirmCancel);
    return;
  }

  if (event.key !== "Tab") return;

  const focusables = [els.confirmCancel, els.confirmAccept].filter(
    (button) => button && !button.disabled
  );
  if (focusables.length < 2) return;

  const currentIndex = focusables.indexOf(document.activeElement);
  const nextIndex = event.shiftKey
    ? currentIndex <= 0
      ? focusables.length - 1
      : currentIndex - 1
    : currentIndex === focusables.length - 1
      ? 0
      : currentIndex + 1;
  event.preventDefault();
  focusables[nextIndex].focus();
}

function requestConfirmation({
  title,
  message,
  confirmLabel = "确定",
  tone = "danger",
}) {
  if (!els.confirmDialog) return Promise.resolve(false);

  return new Promise((resolve) => {
    confirmResolver = resolve;
    confirmPreviousFocus = document.activeElement;
    els.confirmCancelIcon.innerHTML = iconHtml("close", {
      size: 13,
      color: "currentColor",
      strokeWidth: 2.2,
    });
    els.confirmAcceptIcon.innerHTML = iconHtml("check", {
      size: 13,
      color: "currentColor",
      strokeWidth: 2.2,
    });
    els.confirmTitle.textContent = title;
    els.confirmMessage.textContent = message;
    els.confirmAcceptLabel.textContent = confirmLabel;
    els.confirmAccept.classList.toggle("is-danger", tone === "danger");
    els.confirmDialog.hidden = false;
    els.confirmDialog.setAttribute("aria-hidden", "false");
    document.body.classList.add("is-confirm-open");
    document.addEventListener("keydown", onConfirmKeydown);
    els.confirmCancel.focus({ preventScroll: true });
  });
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

function setSourceStatus(text, type = "") {
  if (!els.sourceStatus) return;
  els.sourceStatus.textContent = text;
  els.sourceStatus.className = "source-status" + (type ? ` ${type}` : "");
}

function setSourceFeedback(text, type = "") {
  if (!els.sourceFeedback) return;
  window.clearTimeout(sourceFeedbackTimer);
  els.sourceFeedback.textContent = text;
  els.sourceFeedback.className = "source-feedback" + (type ? ` ${type}` : "");
  if (!text) return;

  void els.sourceFeedback.offsetWidth;
  els.sourceFeedback.classList.add("is-visible");
  sourceFeedbackTimer = window.setTimeout(() => {
    els.sourceFeedback.classList.remove("is-visible");
  }, 3600);
}

function setSourceBusy(busy) {
  if (!els.sourceRefresh) return;
  els.sourceRefresh.disabled = busy;
  els.sourceRefresh.classList.toggle("is-loading", busy);
}

function sourceTimeLabel(cache) {
  const value = cache?.issueUpdatedAt || cache?.fetchedAt;
  if (!value) return "尚未同步";
  const iso = typeof value === "number" ? new Date(value).toISOString() : value;
  return formatRelativeTime(iso);
}

function sourceCacheLabel(cache) {
  const count = Array.isArray(cache?.slugs) ? cache.slugs.length : 0;
  return `${count} 个 · ${sourceTimeLabel(cache)}`;
}

function mergeRemoteChannels(slugs) {
  const existing = new Set(
    channels.map((channel) => keyOf(channel?.slug)).filter(Boolean)
  );
  const additions = [];

  for (const slug of slugs) {
    const key = keyOf(slug);
    if (!key || existing.has(key)) continue;
    existing.add(key);
    additions.push({
      slug,
      title: slug,
      enabled: true,
      source: "pansou",
    });
  }

  if (additions.length > 0) channels = [...channels, ...additions];
  return additions.length;
}

async function loadSourceCache() {
  const data = await chrome.storage.local.get([CHANNEL_SOURCE_CACHE_KEY]);
  const cache = data[CHANNEL_SOURCE_CACHE_KEY];
  if (!cache || !Array.isArray(cache.slugs) || cache.slugs.length === 0) {
    return null;
  }
  return cache;
}

async function saveSourceCache(cache) {
  await chrome.storage.local.set({ [CHANNEL_SOURCE_CACHE_KEY]: cache });
}

async function syncRemoteChannels({ force = false } = {}) {
  if (sourceSyncPromise) return sourceSyncPromise;

  sourceSyncPromise = (async () => {
    let cache = null;
    setSourceBusy(true);
    setSourceStatus(force ? "正在更新…" : "正在检查…");

    try {
      cache = await loadSourceCache();
      const cacheFresh =
        cache &&
        Date.now() - Number(cache.fetchedAt || 0) < CHANNEL_SOURCE_REFRESH_MS;

      if (!force && cacheFresh) {
        const added = mergeRemoteChannels(cache.slugs);
        if (added > 0) {
          await saveChannels(channels);
          render();
        }
        setSourceStatus(sourceCacheLabel(cache), "ok");
        return { added, cached: true };
      }

      const result = await fetchPansouChannelSource({ etag: cache?.etag || "" });
      if (result.notModified && cache) {
        cache = { ...cache, fetchedAt: Date.now() };
      } else {
        cache = result;
      }

      const added = mergeRemoteChannels(cache.slugs || []);
      await saveSourceCache(cache);
      if (added > 0) {
        await saveChannels(channels);
        render();
      }
      setSourceStatus(sourceCacheLabel(cache), "ok");
      return { added, cached: false };
    } catch (error) {
      if (cache?.slugs?.length) {
        const added = mergeRemoteChannels(cache.slugs);
        if (added > 0) {
          await saveChannels(channels);
          render();
        }
        setSourceStatus(`同步失败 · ${sourceCacheLabel(cache)}`, "err");
        return { added, cached: true, error };
      }

      setSourceStatus("同步失败 · 保留当前列表", "err");
      return { added: 0, cached: false, error };
    } finally {
      setSourceBusy(false);
    }
  })();

  try {
    return await sourceSyncPromise;
  } finally {
    sourceSyncPromise = null;
  }
}

async function init() {
  sound = await initSound();
  sound.subscribe(updateSoundButton);
  setupActionIcons();
  els.sourceIcon.innerHTML = iconHtml("database", {
    size: 15,
    color: "currentColor",
    strokeWidth: 2.1,
  });
  els.sourceLinkIcon.innerHTML = iconHtml("external-link", {
    size: 12,
    color: "currentColor",
    strokeWidth: 2.2,
  });
  els.sourceRefreshIcon.innerHTML = iconHtml("refresh-cw", {
    size: 12,
    color: "currentColor",
    strokeWidth: 2.2,
  });
  els.searchIcon.innerHTML = iconHtml("search", {
    size: 18,
    color: "currentColor",
    strokeWidth: 2.2,
  });
  channels = await loadChannels();
  els.concurrency.value = String(await loadConcurrency());
  render({ animateRows: true });

  els.sound.addEventListener("click", async () => {
    const next = await sound.toggle();
    if (next) sound.play("switchOn", { force: true });
  });

  els.confirmBackdrop.addEventListener("click", () => closeConfirm(false));
  els.confirmCancel.addEventListener("click", () => closeConfirm(false));
  els.confirmAccept.addEventListener("click", () => closeConfirm(true));
  els.sourceRefresh.addEventListener("click", async () => {
    sound?.play("tap");
    setSourceFeedback("正在更新…");
    let result;
    try {
      result = await syncRemoteChannels({ force: true });
    } catch {
      setSourceFeedback("更新失败 · 保留当前列表", "err");
      return;
    }
    if (result?.error) {
      setSourceFeedback(
        result.cached ? "更新失败 · 已保留缓存" : "更新失败 · 保留当前列表",
        "err"
      );
      return;
    }
    setSourceFeedback(
      result?.added > 0
        ? `已更新 · 新增 ${result.added} 个频道`
        : "已更新 · 暂无新增频道",
      "ok"
    );
  });

  els.form.addEventListener("submit", onAdd);
  els.input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.isComposing) return;
    event.preventDefault();
    els.form.requestSubmit();
  });
  els.check.addEventListener("click", onCheckAll);
  els.disableDead.addEventListener("click", onDisableDead);
  els.cancelCheck.addEventListener("click", onCancelCheck);
  els.selectAll.addEventListener("click", onToggleSelectAll);
  els.enableSelected.addEventListener("click", () => onSetSelectedEnabled(true));
  els.disableSelected.addEventListener("click", () => onSetSelectedEnabled(false));
  els.deleteSelected.addEventListener("click", onDeleteSelected);
  els.reset.addEventListener("click", async () => {
    if (
      !(await requestConfirmation({
        title: "恢复默认频道？",
        message: "当前自定义频道将被覆盖，已有检测状态也会清空。",
        confirmLabel: "恢复默认",
      }))
    ) {
      return;
    }
    sound.play("tap");
    channels = DEFAULT_CHANNELS.map((c) => ({ ...c }));
    checkResults.clear();
    selectedSlugs.clear();
    await persist();
    setMsg("已恢复默认频道", "ok");
    sound.play("success");
  });
  els.concurrency.addEventListener("change", async () => {
    let n = Number(els.concurrency.value);
    if (!Number.isFinite(n)) n = 8;
    n = Math.min(20, Math.max(2, Math.floor(n)));
    els.concurrency.value = String(n);
    await saveConcurrency(n);
    sound.play("tap");
  });

  // 设置页打开时自动同步；如果页面一直开着，按缓存周期再次检查。
  void syncRemoteChannels();
  window.setInterval(() => {
    if (!document.hidden) void syncRemoteChannels();
  }, CHANNEL_SOURCE_REFRESH_MS);
}

async function persist({ animateSlug = "" } = {}) {
  await saveChannels(channels);
  render({ animateSlug });
}

function setMsg(text, type = "") {
  setMessage(els.msg, text, type);
}

function setCheckMsg(text, type = "") {
  const element = els.checkMsg;
  const textElement = els.checkMsgText;
  if (!element || !textElement) return;
  textElement.textContent = text;
  element.className = "msg check-msg" + (type ? ` ${type}` : "");
  element.hidden = !text;
  if (text) {
    void element.offsetWidth;
    element.classList.add("is-pop");
  }
}

function onCancelCheck() {
  if (checking) return;
  checkResults.clear();
  channels.forEach((channel) => paintRow(channel.slug));
  setCheckMsg("");
  updateStats();
  sound?.play("tap");
}

function setMessage(element, text, type = "") {
  if (!element) return;
  element.textContent = text;
  element.className = "msg" + (type ? ` ${type}` : "");
  if (text) {
    void element.offsetWidth;
    element.classList.add("is-pop");
  }
}

async function onAdd(e) {
  e.preventDefault();
  if (adding) return;
  const slug = extractChannelSlug(els.input.value);
  if (!slug) {
    sound?.play("error");
    setMsg("无法解析频道名，请输入 @slug 或 t.me 链接", "err");
    return;
  }
  if (channels.some((c) => c.slug.toLowerCase() === slug.toLowerCase())) {
    sound?.play("error");
    setMsg(`频道 ${slug} 已存在`, "err");
    return;
  }

  adding = true;
  els.input.disabled = true;
  setMsg(`正在校验 t.me/s/${slug} …`);

  try {
    const res = await validateChannel(slug);
    if (!res.valid) {
      sound?.play("error");
      setMsg(res.reason || "校验失败", "err");
      return;
    }
    channels = [
      {
        slug,
        title: res.title || slug,
        enabled: true,
        lastPostAt: res.lastPostAt,
      },
      ...channels,
    ];
    // 刚校验过，直接带上状态，省得让用户再点一次检测
    checkResults.set(keyOf(slug), res);
    await persist({ animateSlug: slug });
    els.input.value = "";
    setMsg(`已添加：${res.title || slug}`, "ok");
    sound?.play("success", { force: true });
  } catch (err) {
    sound?.play("error", { force: true });
    setMsg(err instanceof Error ? err.message : String(err), "err");
  } finally {
    adding = false;
    els.input.disabled = false;
  }
}

/**
 * 把 validateChannel 的结果翻成一行状态文案
 *
 * 只分「能抓 / 不能抓」两档。实测停更时间和出货量没有相关性 —— 停更两年的
 * 存档频道靠历史消息就能排到贡献第二，天天发帖的频道反而可能一条都搜不出，
 * 所以最后发帖时间只作为信息展示，不参与任何降级判断。
 *
 * @returns {{ kind: 'ok'|'dead'|'retry', text: string } | null}
 */
function statusOf(slug) {
  const res = checkResults.get(keyOf(slug));
  if (!res) return null;

  if (res.state === "ok") {
    return {
      kind: "ok",
      text: res.lastPostAt
        ? `最后更新 ${formatRelativeTime(res.lastPostAt)}`
        : "正常",
    };
  }

  // 限流和网络异常是暂时的，不能当失效算，也不参与「停用失效」
  if (res.state === "limited" || res.state === "error") {
    return { kind: "retry", text: res.reason || "稍后重试" };
  }

  return { kind: "dead", text: res.reason || "无法抓取" };
}

function isDead(slug) {
  return statusOf(slug)?.kind === "dead";
}

/** 就地刷新一行的状态点和副标题，避免检测过程中整表重绘 */
function paintRow(slug) {
  const row = rowsBySlug.get(keyOf(slug));
  if (!row) return;

  const ch = channels.find((c) => keyOf(c.slug) === keyOf(slug));
  const status = statusOf(slug);

  const dot = row.querySelector(".dot");
  dot.className = `dot${status ? ` is-${status.kind}` : ""}`;

  const title = ch?.title && ch.title !== ch.slug ? ch.title : "";
  const sub = row.querySelector(".title");
  if (!title && !status) {
    sub.hidden = true;
    sub.innerHTML = "";
    return;
  }
  sub.hidden = false;
  sub.innerHTML = [
    title ? escapeHtml(title) : "",
    status
      ? `<span class="status is-${status.kind}">${escapeHtml(status.text)}</span>`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

async function onCheckAll() {
  if (checking) return;
  if (channels.length === 0) {
    setCheckMsg("还没有配置任何频道", "err");
    return;
  }

  checking = true;
  checkResults.clear();
  channels.forEach((c) => paintRow(c.slug));

  els.check.disabled = true;
  els.check.classList.add("is-loading");
  els.disableDead.hidden = true;
  setCheckMsg("");
  sound?.play("searchStart");

  // 沿用用户设置的并发，别一次性把 140 个请求全打出去
  const concurrency = await loadConcurrency();
  // 单个频道再怎么炸也不能让整轮检测中断在半路
  const tasks = channels.map((ch) => async () => {
    try {
      return { slug: ch.slug, res: await validateChannel(ch.slug) };
    } catch (err) {
      return {
        slug: ch.slug,
        res: {
          valid: false,
          state: "error",
          reason: err instanceof Error ? err.message : String(err),
        },
      };
    }
  });

  try {
    await mapPool(tasks, concurrency, (done, total, last) => {
      if (last) {
        checkResults.set(keyOf(last.slug), last.res);
        // 顺手把频道标题和最后发帖时间刷新到本地配置
        const ch = channels.find((c) => keyOf(c.slug) === keyOf(last.slug));
        if (ch && last.res.valid) {
          ch.title = last.res.title || ch.title;
          ch.lastPostAt = last.res.lastPostAt || ch.lastPostAt;
        }
        paintRow(last.slug);
      }
      els.stats.textContent = `检测中… ${done} / ${total}`;
    });
    await saveChannels(channels);
  } finally {
    checking = false;
    els.check.disabled = false;
    els.check.classList.remove("is-loading");
  }

  updateStats();

  const dead = channels.filter((c) => isDead(c.slug));
  const retry = channels.filter((c) => statusOf(c.slug)?.kind === "retry");
  if (retry.length) {
    setCheckMsg(
      `${retry.length} 个频道被限流或超时，未能判定，可降低并发后重试`,
      "err"
    );
  } else if (dead.length) {
    setCheckMsg(`检测完成，发现 ${dead.length} 个失效频道`, "ok");
  } else {
    setCheckMsg("检测完成，所有频道均可抓取", "ok");
  }
  sound?.play(dead.length ? "searchEnd" : "success", { force: true });
}

async function onDisableDead() {
  const targets = channels.filter((c) => isDead(c.slug) && c.enabled);
  if (targets.length === 0) return;
  if (
    !(await requestConfirmation({
      title: `停用 ${targets.length} 个失效频道？`,
      message: "这些频道会立即停止参与搜索，之后仍可手动重新开启。",
      confirmLabel: "停用频道",
    }))
  ) {
    return;
  }

  channels = channels.map((c) =>
    isDead(c.slug) ? { ...c, enabled: false } : c
  );
  sound?.play("switchOff");
  syncChannelSwitches();
  updateStats();
  await saveChannels(channels);
  setMsg(`已停用 ${targets.length} 个失效频道`, "ok");
}

function onToggleSelectAll() {
  const allSelected =
    channels.length > 0 && selectedSlugs.size === channels.length;
  if (allSelected) {
    selectedSlugs.clear();
  } else {
    channels.forEach((channel) => selectedSlugs.add(keyOf(channel.slug)));
  }
  sound?.play("tap");
  updateStats();
}

async function onSetSelectedEnabled(enabled) {
  const targets = channels.filter((channel) =>
    selectedSlugs.has(keyOf(channel.slug))
  );
  if (targets.length === 0) return;

  channels = channels.map((channel) =>
    selectedSlugs.has(keyOf(channel.slug))
      ? { ...channel, enabled }
      : channel
  );
  sound?.play(enabled ? "switchOn" : "switchOff");
  syncChannelSwitches();
  updateStats();
  await saveChannels(channels);
  setMsg(`${enabled ? "已启用" : "已停用"} ${targets.length} 个所选频道`, "ok");
}

async function onDeleteSelected() {
  const targets = channels.filter((channel) =>
    selectedSlugs.has(keyOf(channel.slug))
  );
  if (targets.length === 0) return;

  if (
    !(await requestConfirmation({
      title: `删除 ${targets.length} 个所选频道？`,
      message: "删除后不会再参与搜索，之后可以重新手动添加。",
      confirmLabel: "删除频道",
    }))
  ) {
    return;
  }

  const targetKeys = new Set(targets.map((channel) => keyOf(channel.slug)));
  channels = channels.filter((channel) => !targetKeys.has(keyOf(channel.slug)));
  targets.forEach((channel) => checkResults.delete(keyOf(channel.slug)));
  selectedSlugs.clear();
  sound?.play("clear");
  await persist();
  setMsg(`已删除 ${targets.length} 个频道`, "ok");
}

function render({ animateRows = false, animateSlug = "" } = {}) {
  updateStats();

  rowsBySlug.clear();
  els.list.innerHTML = "";
  for (const [rowIndex, ch] of channels.entries()) {
    const row = document.createElement("div");
    row.className = "row";
    row.dataset.slug = keyOf(ch.slug);
    row.classList.toggle("is-selected", selectedSlugs.has(keyOf(ch.slug)));
    if (animateRows || ch.slug === animateSlug) {
      row.classList.add("is-entering");
      row.addEventListener(
        "animationend",
        () => row.classList.remove("is-entering"),
        { once: true }
      );
    }
    row.style.setProperty("--row-i", String(Math.min(rowIndex, 10)));

    const selectTarget = document.createElement("button");
    selectTarget.type = "button";
    selectTarget.className = "slug row-select-target";
    selectTarget.title = `点击选择 ${ch.slug}`;
    selectTarget.setAttribute("aria-label", `选择 ${ch.slug}`);
    selectTarget.setAttribute(
      "aria-pressed",
      String(selectedSlugs.has(keyOf(ch.slug)))
    );
    selectTarget.innerHTML =
      `<span class="dot"></span><strong>${escapeHtml(ch.slug)}</strong>` +
      `<span class="title" hidden></span>`;
    selectTarget.addEventListener("click", () => {
      const slug = keyOf(ch.slug);
      if (selectedSlugs.has(slug)) selectedSlugs.delete(slug);
      else selectedSlugs.add(slug);
      sound?.play("tap");
      updateStats();
    });

    const sw = document.createElement("label");
    sw.className = "switch";
    sw.innerHTML = `<input type="checkbox" ${ch.enabled ? "checked" : ""} /><span></span>`;
    sw.querySelector("input").addEventListener("change", async (ev) => {
      ch.enabled = ev.target.checked;
      sound?.play(ch.enabled ? "switchOn" : "switchOff");
      updateStats();
      await saveChannels(channels);
    });

    const del = document.createElement("button");
    del.type = "button";
    del.className = "del";
    del.textContent = "删除";
    del.addEventListener("click", async () => {
      sound?.play("clear");
      selectedSlugs.delete(keyOf(ch.slug));
      channels = channels.filter((c) => c.slug !== ch.slug);
      await persist();
    });

    row.appendChild(selectTarget);
    row.appendChild(sw);
    row.appendChild(del);
    els.list.appendChild(row);
    rowsBySlug.set(keyOf(ch.slug), row);
    paintRow(ch.slug);
  }
  updateSelectionUI();
}

function updateStats() {
  pruneSelectedSlugs();
  const enabled = channels.filter((c) => c.enabled).length;
  const parts = [`共 ${channels.length} 个`, `已启用 ${enabled}`];
  if (selectedSlugs.size > 0) parts.push(`已选 ${selectedSlugs.size}`);

  if (checkResults.size > 0) {
    const tally = { ok: 0, dead: 0, retry: 0 };
    for (const c of channels) {
      const kind = statusOf(c.slug)?.kind;
      if (kind) tally[kind] += 1;
    }
    const detail = [`正常 ${tally.ok}`];
    if (tally.dead) detail.push(`失效 ${tally.dead}`);
    if (tally.retry) detail.push(`待重试 ${tally.retry}`);
    parts.push(`检测：${detail.join(" / ")}`);

    const deadEnabled = channels.filter(
      (c) => c.enabled && isDead(c.slug)
    ).length;
    els.disableDead.hidden = deadEnabled === 0;
    setButtonLabel(els.disableDead, `停用失效 ${deadEnabled}`);
  } else {
    els.disableDead.hidden = true;
  }

  els.stats.textContent = parts.join(" · ");
  updateSelectionUI();
}

function syncChannelSwitches() {
  els.list.querySelectorAll(".switch input").forEach((input, index) => {
    input.checked = Boolean(channels[index]?.enabled);
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

init();
