/**
 * 豆瓣电影 subject 页注入脚本 v1.1.5
 * 经典 IIFE，音效模块通过动态 import 加载
 */
(function () {
  "use strict";

  if (window.__dbPansoDouban) return;
  window.__dbPansoDouban = true;
  document.documentElement.setAttribute("data-dbp", "1.1.5");

  var contentSound = null;
  var contentSoundReady = null;

  function initContentSound() {
    if (contentSoundReady) return contentSoundReady;

    try {
      var soundUrl = chrome.runtime.getURL(
        "lib/sound.js?content=20260806-search-button-1"
      );
      contentSoundReady = import(soundUrl)
        .then(function (module) {
          return module.initSound();
        })
        .then(function (controller) {
          contentSound = controller;
          return controller;
        })
        .catch(function () {
          // 页面音效是增强项，模块加载失败不应影响豆瓣按钮本身。
          return null;
        });
    } catch (e) {
      contentSoundReady = Promise.resolve(null);
    }

    return contentSoundReady;
  }

  function playContentSound(name, options) {
    if (contentSound) {
      contentSound.play(name, options);
      return;
    }

    initContentSound().then(function (controller) {
      if (controller) controller.play(name, options);
    });
  }

  // 让 Cuelume 尽早绑定到页面文档，确保按钮首次悬停也能响应。
  initContentSound();

  /** 内联 DBP Round Icons 路径（豆瓣按钮使用，本地内联图标路径） */
  var ICON_PATHS = {
    search:
      '<circle cx="10.5" cy="10.5" r="6.75" /><path d="m16 16 4.5 4.5" />',
    "chevron-down": '<path d="m6 9 6 6 6-6" />',
  };

  function iconHtml(name, opts) {
    opts = opts || {};
    var size = opts.size != null ? opts.size : 16;
    var color = opts.color || "currentColor";
    var strokeWidth = opts.strokeWidth != null ? opts.strokeWidth : 2.6;
    var className = opts.className ? " " + opts.className : "";
    var paths = ICON_PATHS[name] || ICON_PATHS.search;
    return (
      '<svg class="dbp-icon dbp-icon--round' +
      className +
      '" xmlns="http://www.w3.org/2000/svg" width="' +
      size +
      '" height="' +
      size +
      '" viewBox="0 0 24 24" fill="none" stroke="' +
      color +
      '" stroke-width="' +
      strokeWidth +
      '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      paths +
      "</svg>"
    );
  }

  function getFullTitle() {
    var titleSpan =
      document.querySelector('#content h1 span[property="v:itemreviewed"]') ||
      document.querySelector("h1 span[property='v:itemreviewed']");
    if (titleSpan) return (titleSpan.textContent || "").trim();

    var h1 = document.querySelector("#content h1") || document.querySelector("h1");
    if (!h1) return "";

    // 按钮现在和标题处于同一行，兜底取标题时先移除插件自己的节点。
    var clone = h1.cloneNode(true);
    var injectedBar = clone.querySelector("#dbpanso-bar");
    if (injectedBar) injectedBar.remove();
    return (clone.textContent || "").trim().replace(/\(\d{4}\)\s*$/, "").trim();
  }

  function getYear() {
    var y = document.querySelector("#content h1 span.year");
    var m = ((y && y.textContent) || "").match(/(\d{4})/);
    if (m) return m[1];
    // 兜底：从 h1 文本提取
    var h1 = document.querySelector("#content h1");
    var m2 = ((h1 && h1.textContent) || "").match(/\((\d{4})\)/);
    return m2 ? m2[1] : "";
  }

  // 默认搜索只取最前面的主标题，避免把繁体别名、韩文或其他语言副标题一起带入。
  // “完整片名”选项仍然使用 getFullTitle() 的原始文本，保证需要时可以全称搜索。
  var TITLE_SCRIPT_PATTERNS = [
    { kind: "han", re: /\p{Script=Han}/u },
    { kind: "hiragana", re: /\p{Script=Hiragana}/u },
    { kind: "katakana", re: /\p{Script=Katakana}/u },
    { kind: "hangul", re: /\p{Script=Hangul}/u },
    { kind: "latin", re: /\p{Script=Latin}/u },
    { kind: "thai", re: /\p{Script=Thai}/u },
    { kind: "cyrillic", re: /\p{Script=Cyrillic}/u },
    { kind: "greek", re: /\p{Script=Greek}/u },
    { kind: "arabic", re: /\p{Script=Arabic}/u },
    { kind: "hebrew", re: /\p{Script=Hebrew}/u },
    { kind: "devanagari", re: /\p{Script=Devanagari}/u },
    { kind: "bengali", re: /\p{Script=Bengali}/u },
    { kind: "myanmar", re: /\p{Script=Myanmar}/u },
    { kind: "khmer", re: /\p{Script=Khmer}/u },
    { kind: "lao", re: /\p{Script=Lao}/u },
  ];

  function titleScriptOf(ch) {
    for (var i = 0; i < TITLE_SCRIPT_PATTERNS.length; i += 1) {
      if (TITLE_SCRIPT_PATTERNS[i].re.test(ch)) return TITLE_SCRIPT_PATTERNS[i].kind;
    }
    return "";
  }

  function isTitleSeparator(ch) {
    return /[:：·•|｜/／\\\-—–_、,，;；&＆+＋()[\]（）【】]/.test(ch || "");
  }

  // 这里只用于判断“简体主名 + 繁体别名”是否是同一个片名，不改变完整片名搜索的内容。
  var TRADITIONAL_TO_SIMPLIFIED = {
    戰: "战",
    臺: "台",
    灣: "湾",
    與: "与",
    國: "国",
    學: "学",
    電: "电",
    門: "门",
    車: "车",
    體: "体",
    發: "发",
    現: "现",
    後: "后",
    來: "来",
    語: "语",
    華: "华",
    龍: "龙",
    風: "风",
    雲: "云",
    麗: "丽",
    劇: "剧",
    邊: "边",
    萬: "万",
    歲: "岁",
    這: "这",
    個: "个",
    們: "们",
    為: "为",
    時: "时",
    機: "机",
    報: "报",
    書: "书",
    頭: "头",
    見: "见",
    長: "长",
    東: "东",
    號: "号",
    經: "经",
    線: "线",
    過: "过",
    從: "从",
    開: "开",
    關: "关",
    難: "难",
    對: "对",
    實: "实",
    氣: "气",
    製: "制",
    標: "标",
    題: "题",
    簡: "简",
    單: "单",
    網: "网",
    絡: "络",
    歡: "欢",
    樂: "乐",
    復: "复",
    習: "习",
    環: "环",
    廣: "广",
    場: "场",
    張: "张",
    強: "强",
    傷: "伤",
    雙: "双",
    傳: "传",
    統: "统",
    總: "总",
    組: "组",
    織: "织",
    紀: "纪",
    錄: "录",
    將: "将",
    讓: "让",
    變: "变",
    動: "动",
    輸: "输",
    讀: "读",
    寫: "写",
    視: "视",
    訊: "讯",
    節: "节",
    點: "点",
    續: "续",
    錯: "错",
    誤: "误",
    還: "还",
    沒: "没",
    進: "进",
    選: "选",
    擇: "择",
    優: "优",
    質: "质",
    資: "资",
    預: "预",
    覽: "览",
    譯: "译",
    畫: "画",
    夢: "梦",
    觀: "观",
    聽: "听",
    聲: "声",
    戲: "戏",
    戀: "恋",
    愛: "爱",
    會: "会",
    說: "说",
    話: "话",
    誰: "谁",
    別: "别",
    異: "异",
    種: "种",
    問: "问",
    檢: "检",
    測: "测",
    確: "确",
    認: "认",
    義: "义",
    頻: "频",
    頁: "页",
    專: "专",
    業: "业",
    級: "级",
    無: "无",
    內: "内",
    漢: "汉",
    紅: "红",
    藍: "蓝",
    綠: "绿",
    黃: "黄",
    殺: "杀",
    導: "导",
    叢: "丛",
  };

  function normalizeTitleForCompare(value) {
    return Array.from(value || "")
      .map(function (ch) {
        return TRADITIONAL_TO_SIMPLIFIED[ch] || ch;
      })
      .join("")
      .replace(/[\s\p{P}\p{S}]/gu, "")
      .toLowerCase();
  }

  function leadingTitlePart(value) {
    return (value || "")
      .trim()
      .split(/\s+/)[0]
      .split(/[/／|｜:：·•—–-]/)[0]
      .trim();
  }

  function hasTraditionalChinese(value) {
    return Array.from(value || "").some(function (ch) {
      return Object.prototype.hasOwnProperty.call(TRADITIONAL_TO_SIMPLIFIED, ch);
    });
  }

  function isSameTitleAlias(main, remainder) {
    var mainKey = normalizeTitleForCompare(main);
    var aliasKey = normalizeTitleForCompare(leadingTitlePart(remainder));
    return mainKey.length >= 2 && mainKey === aliasKey;
  }

  function extractChineseTitle(full) {
    var s = (full || "")
      .trim()
      .replace(/\s*[（(]\s*\d{4}\s*[）)]\s*$/, "")
      .trim();
    if (!s) return "";

    var chars = Array.from(s);
    var firstScript = "";
    for (var i = 0; i < chars.length; i += 1) {
      firstScript = titleScriptOf(chars[i]);
      if (firstScript) break;
    }
    if (!firstScript) return s.replace(/\s+/g, " ");

    for (var j = 1; j < chars.length; j += 1) {
      var script = titleScriptOf(chars[j]);
      if (!script) continue;

      var previous = j - 1;
      var separated = false;
      while (previous >= 0 && /\s/.test(chars[previous])) {
        separated = true;
        previous -= 1;
      }
      if (previous >= 0 && isTitleSeparator(chars[previous])) separated = true;
      if (!separated) continue;

      var end = j;
      while (end > 0 && /\s/.test(chars[end - 1])) end -= 1;
      while (end > 0 && isTitleSeparator(chars[end - 1])) end -= 1;
      var main = chars.slice(0, end).join("").trim();
      if (!main) continue;

      if (script !== firstScript) {
        return main.replace(/\s+/g, " ");
      }

      // Han 脚本本身不区分简繁：遇到重复片名、明显的繁体别名，或“片名 + 年份”的别名时截断。
      if (
        firstScript === "han" &&
        script === "han" &&
        (isSameTitleAlias(main, chars.slice(j).join("")) ||
          (!hasTraditionalChinese(main) && hasTraditionalChinese(chars.slice(j).join(""))) ||
          /\d{4}$/.test(main))
      ) {
        return main.replace(/\s+/g, " ");
      }
    }

    return s.replace(/\s+/g, " ");
  }

  function getOriginalTitle() {
    var info = document.querySelector("#info");
    if (!info) return "";
    var text = info.innerText || "";
    var m = text.match(/又名[：:]\s*(.+)/);
    if (m && m[1]) return m[1].split("/")[0].trim();
    return "";
  }

  function buildPayload() {
    var full = getFullTitle();
    var cn = extractChineseTitle(full);
    var year = getYear();
    return {
      kw: cn || full,
      fullTitle: full,
      year: year,
      original: getOriginalTitle(),
      source: "douban",
      doubanUrl: location.href,
    };
  }

  function showToast(text, isError) {
    var el = document.getElementById("dbpanso-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "dbpanso-toast";
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.className = "dbp-toast" + (isError ? " error" : "");
    el.classList.add("show");
    clearTimeout(el.__timer);
    el.__timer = setTimeout(function () {
      el.classList.remove("show");
    }, 2600);
  }

  function setButtonsBusy(busy) {
    document
      .querySelectorAll("#dbpanso-bar .dbp-btn, #dbpanso-fab")
      .forEach(function (btn) {
        btn.disabled = !!busy;
      });
  }

  function isExtensionAlive() {
    try {
      return Boolean(chrome.runtime && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  }

  function isContextInvalidated(err) {
    var msg = err && err.message ? err.message : String(err || "");
    return /context invalidated|Extension context/i.test(msg);
  }

  function toastReloadPage() {
    showToast("插件已更新，请刷新本页后再试 (⌘R / F5)", true);
  }

  function search(payload) {
    if (!payload || !payload.kw) {
      showToast("未能识别影片标题", true);
      return;
    }

    if (!isExtensionAlive()) {
      toastReloadPage();
      return;
    }

    playContentSound("searchStart", { force: true });
    showToast("正在搜索「" + payload.kw + "」…");
    setButtonsBusy(true);

    try {
      chrome.runtime.sendMessage({ type: "OPEN_SEARCH", payload: payload }, function (res) {
        setButtonsBusy(false);
        try {
          if (!isExtensionAlive()) {
            toastReloadPage();
            return;
          }
          var err = chrome.runtime.lastError;
          if (err) {
            if (isContextInvalidated(err.message)) {
              toastReloadPage();
              return;
            }
            showToast("扩展无响应，请刷新页面后重试", true);
            return;
          }
          if (!res || !res.ok) {
            showToast(
              res && res.error ? "打开失败: " + res.error : "无法打开搜索面板",
              true
            );
            return;
          }
          showToast(res.mode === "popup" ? "已打开搜索窗口" : "已打开侧边栏");
        } catch (e) {
          if (isContextInvalidated(e)) toastReloadPage();
          else showToast("扩展通信失败，请刷新页面", true);
        }
      });
    } catch (e) {
      setButtonsBusy(false);
      if (isContextInvalidated(e)) toastReloadPage();
      else showToast("扩展通信失败，请刷新页面", true);
    }
  }

  function makeBtn(label, iconName, className, onClick) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dbp-btn" + (className ? " " + className : "");
    var iconColor =
      className && className.indexOf("primary") !== -1
        ? "currentColor"
        : "#10b981";
    btn.innerHTML = iconHtml(iconName, {
      size: 14,
      color: iconColor,
      strokeWidth: 2.7,
      className: "dbp-btn-icon",
    });
    var labelEl = document.createElement("span");
    labelEl.className = "dbp-btn-label";
    labelEl.textContent = label || "";
    btn.appendChild(labelEl);
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });
    return btn;
  }

  function injectBar() {
    if (document.getElementById("dbpanso-bar")) return;
    if (document.getElementById("dbpanso-fab")) return;

    var payload = buildPayload();
    if (!payload.kw) {
      // 标题尚未渲染时稍后重试，不立刻放弃
      return;
    }

    var bar = document.createElement("span");
    bar.id = "dbpanso-bar";

    var searchMenu = document.createElement("span");
    searchMenu.className = "dbp-search-menu";

    var primaryLabel = payload.kw || payload.fullTitle || "搜索资源";
    var primaryBtn = makeBtn(primaryLabel, "search", "primary", function () {
      search(buildPayload());
    });
    primaryBtn.setAttribute("data-cuelume-hover", "chime");
    primaryBtn.title = "搜索「" + primaryLabel + "」相关网盘资源";
    primaryBtn.setAttribute("aria-haspopup", "menu");
    primaryBtn.setAttribute("aria-expanded", "false");
    searchMenu.appendChild(primaryBtn);

    var searchOptions = document.createElement("span");
    searchOptions.className = "dbp-search-options";
    searchOptions.setAttribute("role", "menu");
    var hasOptions = false;

    function addSearchOption(btn) {
      btn.classList.add("dbp-option");
      btn.setAttribute("role", "menuitem");
      searchOptions.appendChild(btn);
      hasOptions = true;
    }

    if (payload.year) {
      var yearLabel = [payload.kw, payload.year].filter(Boolean).join(" ");
      var yearBtn = makeBtn(yearLabel, "search", "", function () {
        var p = buildPayload();
        search({ kw: p.kw + " " + p.year, fullTitle: p.fullTitle, year: p.year, source: "douban", doubanUrl: p.doubanUrl });
      });
      yearBtn.title = "搜索「" + yearLabel + "」";
      addSearchOption(yearBtn);
    }

    if (payload.fullTitle && payload.fullTitle !== payload.kw) {
      var fullTitleBtn = makeBtn(payload.fullTitle, "search", "", function () {
        var p = buildPayload();
        search({
          kw: p.fullTitle,
          fullTitle: p.fullTitle,
          year: p.year,
          source: "douban",
          doubanUrl: p.doubanUrl,
        });
      });
      fullTitleBtn.title = "搜索完整片名「" + payload.fullTitle + "」";
      addSearchOption(fullTitleBtn);
    }

    if (hasOptions) {
      searchMenu.classList.add("has-options");
      primaryBtn.insertAdjacentHTML(
        "beforeend",
        iconHtml("chevron-down", {
          size: 12,
          color: "currentColor",
          strokeWidth: 2.5,
          className: "dbp-menu-chevron",
        })
      );
      searchMenu.appendChild(searchOptions);

      function syncSearchMenuState() {
        var open = searchMenu.matches(":hover") || searchMenu.contains(document.activeElement);
        searchMenu.classList.toggle("is-open", open);
        primaryBtn.setAttribute("aria-expanded", open ? "true" : "false");
      }

      searchMenu.addEventListener("mouseenter", syncSearchMenuState);
      searchMenu.addEventListener("mouseleave", syncSearchMenuState);
      searchMenu.addEventListener("focusin", syncSearchMenuState);
      searchMenu.addEventListener("focusout", function () {
        window.requestAnimationFrame(syncSearchMenuState);
      });
    }

    bar.appendChild(searchMenu);

    var h1 = document.querySelector("#content h1") || document.querySelector("h1");
    if (h1 && h1.parentElement) {
      h1.appendChild(bar);
    } else if (document.body) {
      // 找不到标题时用浮动按钮兜底
      injectFab(payload);
    }
  }

  function injectFab(payload) {
    if (document.getElementById("dbpanso-fab")) return;
    payload = payload || buildPayload();
    if (!payload.kw) return;

    var fab = document.createElement("button");
    fab.id = "dbpanso-fab";
    fab.type = "button";
    fab.innerHTML = iconHtml("search", {
      size: 15,
      color: "currentColor",
      strokeWidth: 2.7,
    });
    var fabLabel = document.createElement("span");
    fabLabel.textContent = payload.kw || payload.fullTitle || "搜索资源";
    fab.appendChild(fabLabel);
    fab.title = "搜索「" + payload.kw + "」相关网盘资源";
    fab.setAttribute("data-cuelume-hover", "chime");
    fab.addEventListener("click", function () {
      search(buildPayload());
    });
    document.body.appendChild(fab);
  }

  function tryInject() {
    try {
      injectBar();
      // 仍没有按钮且已有标题 → 浮动按钮
      if (
        !document.getElementById("dbpanso-bar") &&
        !document.getElementById("dbpanso-fab")
      ) {
        var p = buildPayload();
        if (p.kw) injectFab(p);
      }
    } catch (e) {
      // 不向上抛，避免 content script 中断
    }
  }

  function boot() {
    tryInject();

    // 标题延迟渲染时多次尝试
    var tries = 0;
    var timer = setInterval(function () {
      tries += 1;
      if (
        document.getElementById("dbpanso-bar") ||
        document.getElementById("dbpanso-fab")
      ) {
        clearInterval(timer);
        return;
      }
      tryInject();
      if (tries >= 20) clearInterval(timer);
    }, 500);

    var obs = new MutationObserver(function () {
      if (
        !document.getElementById("dbpanso-bar") &&
        !document.getElementById("dbpanso-fab")
      ) {
        tryInject();
      }
    });
    if (document.documentElement) {
      obs.observe(document.documentElement, { childList: true, subtree: true });
    }

    try {
      chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
        try {
          if (!isExtensionAlive()) return false;
          if (msg && msg.type === "GET_MOVIE_INFO") {
            sendResponse({ ok: true, payload: buildPayload() });
            return true;
          }
        } catch (e) {
          /* 扩展上下文失效 */
        }
        return false;
      });
    } catch (e) {
      /* ignore */
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
