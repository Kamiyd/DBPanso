/**
 * DBP sound preferences + Cuelume adapter.
 *
 * Cuelume owns the sound palette and Web Audio graph. This small adapter keeps
 * the extension's existing storage preference and semantic cue names stable.
 */
import {
  bind as bindCuelume,
  play as playCuelume,
  setEnabled as setCuelumeEnabled,
  setVolume as setCuelumeVolume,
} from "../vendor/cuelume/index.js";

const SOUND_KEY = "soundEnabled";
const SOUND_VOLUME = 1;

// Keep page code expressive while routing every cue through Cuelume's palette.
const SOUND_ALIASES = Object.freeze({
  hover: "chime",
  tap: "pulse",
  tab: "toggle",
  sort: "scan",
  filterOn: "pulse",
  filterOff: "droplet",
  switchOn: "toggle",
  switchOff: "toggle",
  searchOpen: "bloom",
  searchSubmit: "loading",
  searchStart: "loading",
  searchSuccess: "ready",
  searchEnd: "ready",
  empty: "droplet",
  link: "release",
  sticker: "sparkle",
  settings: "page",
  clear: "droplet",
  success: "success",
  error: "error",
});

let enabled = true;
let preferenceLoaded = false;
let preferencePromise = null;
let storageBound = false;
const subscribers = new Set();

function hasChromeStorage() {
  return Boolean(globalThis.chrome?.storage?.local);
}

async function readPreference() {
  if (!hasChromeStorage()) return true;
  try {
    const data = await chrome.storage.local.get([SOUND_KEY]);
    return data[SOUND_KEY] !== false;
  } catch {
    return true;
  }
}

async function writePreference(value) {
  if (!hasChromeStorage()) return;
  try {
    await chrome.storage.local.set({ [SOUND_KEY]: Boolean(value) });
  } catch {
    // 音效是增强项，存储失败不应打断主流程。
  }
}

function notify() {
  for (const subscriber of subscribers) {
    try {
      subscriber(enabled);
    } catch {
      // 一个页面的 UI 更新失败不影响其他订阅者。
    }
  }
}

function bindStorageListener() {
  if (storageBound || !globalThis.chrome?.storage?.onChanged) return;
  storageBound = true;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !(SOUND_KEY in changes)) return;
    enabled = changes[SOUND_KEY].newValue !== false;
    setCuelumeEnabled(enabled);
    preferenceLoaded = true;
    notify();
  });
}

export async function initSound() {
  if (!preferencePromise) {
    preferencePromise = readPreference().then((value) => {
      enabled = value;
      preferenceLoaded = true;
      setCuelumeEnabled(enabled);
      setCuelumeVolume(SOUND_VOLUME);
      bindCuelume();
      bindStorageListener();
      return enabled;
    });
  }
  await preferencePromise;
  return sound;
}

const sound = {
  get enabled() {
    return enabled;
  },

  subscribe(listener) {
    if (typeof listener !== "function") return () => {};
    subscribers.add(listener);
    listener(enabled);
    return () => subscribers.delete(listener);
  },

  async setEnabled(value) {
    enabled = Boolean(value);
    preferenceLoaded = true;
    setCuelumeEnabled(enabled);
    await writePreference(enabled);
    notify();
    return enabled;
  },

  async toggle() {
    return this.setEnabled(!enabled);
  },

  play(name, options = {}) {
    if (!preferenceLoaded || !enabled) return false;
    const cue = SOUND_ALIASES[name] || name;
    playCuelume(cue, options);
    return true;
  },
};
