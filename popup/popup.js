import { iconHtml } from "../lib/icon-library.js?v=20260809-dbpanso-1";
import { initSound } from "../lib/sound.js";

const $ = (s) => document.querySelector(s);

const els = {
  form: $("#form"),
  kw: $("#kw"),
  searchIcon: $("#search-icon"),
  clear: $("#btn-clear"),
  clearIcon: $("#clear-icon"),
  btnPanel: $("#btn-panel"),
  btnAbout: $("#btn-about"),
  btnOptions: $("#btn-options"),
  panelIcon: $("#panel-icon"),
  aboutIcon: $("#about-icon"),
  optionsIcon: $("#options-icon"),
  sound: $("#btn-sound"),
};

let moviePayload = null;
let sound = null;
const PANEL_EXIT_MS = 170;
const soundReady = initSound().then((controller) => {
  sound = controller;
  controller.subscribe(updateSoundButton);
  return controller;
});

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

function playSound(name, options) {
  sound?.play(name, options);
}

els.searchIcon.innerHTML = iconHtml("search", {
  size: 18,
  color: "currentColor",
  strokeWidth: 2.55,
});

els.clearIcon.innerHTML = iconHtml("close", {
  size: 16,
  color: "currentColor",
  strokeWidth: 2.35,
});

els.panelIcon.innerHTML = iconHtml("panel-right-open", {
  size: 13,
  color: "currentColor",
  strokeWidth: 2.15,
});

els.aboutIcon.innerHTML = iconHtml("sparkles", {
  size: 13,
  color: "currentColor",
  strokeWidth: 2.15,
});

els.optionsIcon.innerHTML = iconHtml("settings", {
  size: 13,
  color: "currentColor",
  strokeWidth: 2.15,
});

function syncClearButton() {
  els.clear.hidden = !els.kw.value;
}

els.kw.addEventListener("input", syncClearButton);

els.clear.addEventListener("click", () => {
  playSound("clear");
  els.kw.value = "";
  moviePayload = null;
  syncClearButton();
  els.kw.focus();
});

async function openSearch(payload) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  // popup 自身具备用户手势，直接 open 更稳
  try {
    chrome.storage.local.set({
      pendingSearch: { ...payload, ts: Date.now() },
    });
    if (tab?.id != null) {
      await chrome.sidePanel.setOptions({
        tabId: tab.id,
        path: "sidepanel/index.html",
        enabled: true,
      });
      await chrome.sidePanel.open({ tabId: tab.id });
    } else {
      await chrome.runtime.sendMessage({ type: "OPEN_SEARCH", payload });
    }
  } catch (e) {
    // 回退：消息 + 或独立窗口
    try {
      await chrome.runtime.sendMessage({
        type: "OPEN_SEARCH",
        payload,
        tabId: tab?.id,
        windowId: tab?.windowId,
      });
    } catch {
      const url = chrome.runtime.getURL("sidepanel/index.html");
      await chrome.windows.create({
        url,
        type: "popup",
        width: 420,
        height: 760,
      });
    }
  }
  window.close();
}

els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const kw = els.kw.value.trim();
  if (!kw) return;
  const controller = sound || (await soundReady);
  controller.play("searchStart", { force: true });
  const payload = moviePayload?.kw === kw ? moviePayload : { kw, source: "popup" };
  await openSearch(payload);
});

els.btnPanel.addEventListener("click", () => {
  if (els.btnPanel.classList.contains("is-opening")) return;
  playSound("tap");
  els.btnPanel.classList.add("is-opening");
  els.btnPanel.disabled = true;

  void (async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      try {
        await chrome.sidePanel.open({ tabId: tab.id });
      } catch (e) {
        console.warn(e);
      }
    }
  })().catch((e) => console.warn(e));

  window.setTimeout(() => window.close(), PANEL_EXIT_MS);
});

els.btnOptions.addEventListener("click", () => {
  playSound("settings");
  chrome.runtime.openOptionsPage();
});

els.btnAbout.addEventListener("click", () => {
  playSound("tap");
  const url = chrome.runtime.getURL("index.html");
  if (chrome.tabs?.create) chrome.tabs.create({ url });
  else window.open(url, "_blank", "noopener,noreferrer");
  window.close();
});

els.sound.addEventListener("click", async () => {
  const controller = sound || (await soundReady);
  const next = await controller.toggle();
  if (next) controller.play("switchOn", { force: true });
});

async function detectMovie() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !/https:\/\/(?:movie|www)\.douban\.com\/subject\//.test(tab.url || "")) return;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await chrome.tabs.sendMessage(tab.id, {
        type: "GET_MOVIE_INFO",
      });
      if (res?.ok && res.payload?.kw) {
        moviePayload = { ...res.payload };
        els.kw.value = moviePayload.kw;
        syncClearButton();
        els.kw.setAttribute("aria-label", `已识别电影：${moviePayload.kw}`);
        els.form.classList.add("is-detected");
        requestAnimationFrame(() => {
          els.kw.focus();
          els.kw.select();
        });
        return;
      }
    } catch {
      // content script 可能还在注入，短暂重试
    }
    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  }
}

detectMovie();
