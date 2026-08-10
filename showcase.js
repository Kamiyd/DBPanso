import { iconHtml } from "./lib/icon-library.js?v=20260809-dbpanso-1";
import { panIconBadgeHtml } from "./lib/icons.js?v=20260809-dbpanso-1";

function renderIcon(element, name = element.dataset.icon) {
  element.innerHTML = iconHtml(name, {
    size: 16,
    color: "currentColor",
    strokeWidth: 2.2,
  });
}

document.querySelectorAll("[data-icon]").forEach((element) => renderIcon(element));

document.querySelectorAll("[data-pan-icon]").forEach((element) => {
  const type = element.dataset.panIcon;
  element.innerHTML = panIconBadgeHtml(type, { size: 18 });
  const brandImage = element.querySelector("img");
  if (brandImage) brandImage.src = `icons/pan/${type}.png`;
});

const pageNavTabs = [...document.querySelectorAll(".header-tabs .tab")];

function syncPageNav() {
  const currentHash = window.location.hash;
  pageNavTabs.forEach((tab) => {
    const isCurrent = currentHash && tab.getAttribute("href") === currentHash;
    tab.classList.toggle("is-active", Boolean(isCurrent));
    if (isCurrent) tab.setAttribute("aria-current", "location");
    else tab.removeAttribute("aria-current");
  });
}

window.addEventListener("hashchange", syncPageNav);
syncPageNav();

const searchDemo = document.querySelector("#search-demo");
const demoQuery = document.querySelector("#demo-query");
const demoPhase = document.querySelector("#demo-phase");
const demoStatus = document.querySelector("#demo-status");
const demoCount = document.querySelector("#demo-count");
const demoStateIcon = document.querySelector("#demo-search-state-icon");
const demoReplay = document.querySelector("#demo-replay");
const demoScanView = document.querySelector("#demo-scan-view");
const demoResultView = document.querySelector("#demo-result-view");
const demoChannels = [...document.querySelectorAll("[data-demo-channel]")];
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const demoWaits = new Map();
const demoMovie = "流浪地球 2";
let demoToken = 0;

const demoStates = {
  typing: { label: "输入片名", icon: "search" },
  searching: { label: "搜索频道", icon: "refresh-cw" },
  results: { label: "找到资源", icon: "check" },
};

function cancelDemoRun() {
  demoToken += 1;
  demoWaits.forEach((resolve, timer) => {
    window.clearTimeout(timer);
    resolve(false);
  });
  demoWaits.clear();
  return demoToken;
}

function waitForDemo(ms, token) {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      demoWaits.delete(timer);
      resolve(token === demoToken);
    }, ms);
    demoWaits.set(timer, resolve);
  });
}

function setDemoState(state) {
  const config = demoStates[state];
  if (!searchDemo || !config) return;
  searchDemo.dataset.demoState = state;
  if (demoPhase) demoPhase.textContent = config.label;
  if (demoStateIcon) renderIcon(demoStateIcon, config.icon);
  demoScanView?.setAttribute("aria-hidden", String(state === "results"));
  demoResultView?.setAttribute("aria-hidden", String(state !== "results"));
}

function showFinalDemo() {
  cancelDemoRun();
  if (demoQuery) demoQuery.textContent = demoMovie;
  if (demoStatus) demoStatus.textContent = "已找到 3 条资源链接";
  if (demoCount) demoCount.textContent = "3 / 3";
  demoChannels.forEach((channel) => channel.classList.add("is-active"));
  setDemoState("results");
}

async function playSearchDemo() {
  if (!searchDemo) return;
  if (reduceMotion.matches) {
    showFinalDemo();
    return;
  }

  const token = cancelDemoRun();
  demoChannels.forEach((channel) => channel.classList.remove("is-active"));
  if (demoQuery) demoQuery.textContent = "";
  if (demoStatus) demoStatus.textContent = "准备搜索公开频道";
  if (demoCount) demoCount.textContent = `0 / ${demoChannels.length}`;
  setDemoState("typing");

  if (!(await waitForDemo(480, token))) return;
  for (const character of demoMovie) {
    if (demoQuery) demoQuery.textContent += character;
    if (!(await waitForDemo(105, token))) return;
  }

  if (!(await waitForDemo(420, token))) return;
  setDemoState("searching");
  if (demoStatus) demoStatus.textContent = "正在搜索公开频道";

  for (let index = 0; index < demoChannels.length; index += 1) {
    if (!(await waitForDemo(380, token))) return;
    demoChannels[index].classList.add("is-active");
    if (demoCount) demoCount.textContent = `${index + 1} / ${demoChannels.length}`;
  }

  if (!(await waitForDemo(520, token))) return;
  setDemoState("results");
  if (demoStatus) demoStatus.textContent = "已找到 3 条资源链接";

  if (!(await waitForDemo(4000, token))) return;
  if (!document.hidden) playSearchDemo();
}

demoReplay?.addEventListener("click", playSearchDemo);
reduceMotion.addEventListener?.("change", () => {
  if (reduceMotion.matches) showFinalDemo();
  else playSearchDemo();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) cancelDemoRun();
  else playSearchDemo();
});

playSearchDemo();

const copyButton = document.querySelector("#copy-address");
const copyIcon = copyButton?.querySelector(".copy-icon");
const copyLabel = copyButton?.querySelector(".copy-label");
const copyStatus = document.querySelector("#copy-status");
const address = document.querySelector("#extensions-address")?.textContent || "";
let resetTimer = 0;

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.append(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("copy failed");
}

copyButton?.addEventListener("click", async () => {
  window.clearTimeout(resetTimer);
  try {
    await copyText(address);
    copyButton.classList.add("is-copied");
    if (copyIcon) renderIcon(copyIcon, "check");
    if (copyLabel) copyLabel.textContent = "已复制";
    if (copyStatus) copyStatus.textContent = "地址已复制，可粘贴到浏览器地址栏。";
  } catch {
    if (copyStatus) copyStatus.textContent = "复制失败，请手动选择上方地址。";
  }

  resetTimer = window.setTimeout(() => {
    copyButton.classList.remove("is-copied");
    if (copyIcon) renderIcon(copyIcon, "copy");
    if (copyLabel) copyLabel.textContent = "复制";
    if (copyStatus) copyStatus.textContent = "";
  }, 2600);
});
