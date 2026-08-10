/**
 * Service worker: 侧边栏开关 + 消息路由
 *
 * 重要: chrome.sidePanel.open() 必须在用户手势的同步调用栈中触发。
 * 不能在 await storage / dynamic import 之后再 open，否则会静默失败。
 */

const PENDING_KEY = "pendingSearch";

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: false })
    .catch(() => {});
});

/** 写入待搜索关键词（返回 Promise，调用方勿在 open 前 await） */
function writePending(payload) {
  return chrome.storage.local.set({
    [PENDING_KEY]: { ...payload, ts: Date.now() },
  });
}

/**
 * 在用户手势栈内立刻打开侧边栏；失败则回退为扩展弹窗页
 * @returns {Promise<{ ok: boolean, mode: 'sidepanel' | 'popup', error?: string }>}
 */
function openPanelNow(tabId, windowId) {
  // 1) 优先 side panel（与点击同一次同步调用链）
  if (typeof tabId === "number") {
    // setOptions 不要 await，直接 fire + open
    chrome.sidePanel
      .setOptions({
        tabId,
        path: "sidepanel/index.html",
        enabled: true,
      })
      .catch(() => {});

    return chrome.sidePanel
      .open({ tabId })
      .then(() => ({ ok: true, mode: "sidepanel" }))
      .catch((err) => openFallbackPopup(err));
  }

  if (typeof windowId === "number") {
    return chrome.sidePanel
      .open({ windowId })
      .then(() => ({ ok: true, mode: "sidepanel" }))
      .catch((err) => openFallbackPopup(err));
  }

  return openFallbackPopup(new Error("no tabId/windowId"));
}

function openFallbackPopup(prevErr) {
  const url = chrome.runtime.getURL("sidepanel/index.html");
  return chrome.windows
    .create({
      url,
      type: "popup",
      width: 420,
      height: 760,
      focused: true,
    })
    .then(() => ({
      ok: true,
      mode: "popup",
      error: prevErr ? String(prevErr?.message || prevErr) : undefined,
    }))
    .catch((err) => ({
      ok: false,
      mode: "popup",
      error: String(err?.message || err),
    }));
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "OPEN_SEARCH") {
    const payload = msg.payload || { kw: msg.kw };
    const tabId = sender.tab?.id ?? msg.tabId ?? null;
    const windowId = sender.tab?.windowId ?? msg.windowId ?? null;

    // ① 立刻启动 open（同一同步栈，保留用户手势）—— 禁止在此之前 await
    const openPromise = openPanelNow(tabId, windowId);
    // ② 并行写 pending（勿 await 在 open 之前）
    const writePromise = writePending(payload);

    Promise.all([openPromise, writePromise])
      .then(([result]) => {
        // 通知已存在的侧边栏；冷启动时靠 storage + 短轮询
        chrome.runtime.sendMessage(
          { type: "PENDING_SEARCH", payload },
          () => void chrome.runtime.lastError
        );
        sendResponse(result);
      })
      .catch((e) => {
        sendResponse({ ok: false, error: String(e) });
      });

    return true; // async sendResponse
  }

  if (msg?.type === "OPEN_SIDE_PANEL") {
    const tabId = sender.tab?.id ?? null;
    openPanelNow(tabId, sender.tab?.windowId)
      .then((r) => sendResponse(r))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }

  sendResponse({ ok: false, error: "unknown message" });
  return false;
});
