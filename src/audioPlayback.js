/**
 * 简谱 id 与 public/audio 下文件对应：长音3.mp3、短音3.mp3（无空格）
 * 带低音点的 L6/L7 与素材「6」「7」对应，文件名用数字 6、7
 *
 * 串接试听使用 Tone.js：淡入淡出 + 微小时间/音量随机 + 字间随机间隔，减轻机械感。
 */

import * as Tone from "tone";

let pagePlayToken = 0;
let previewToken = 0;

/** @type {Set<Tone.Player>} */
const activePlayers = new Set();

const HUMAN = {
  fadeIn: 0.028,
  fadeOut: 0.036,
  gapNormalMin: 10,
  gapNormalMax: 32,
  gapTightMin: 4,
  gapTightMax: 14,
  volumeJitterDb: 1.4,
  timingJitterSec: 0.01,
};

function baseUrl() {
  const b = import.meta.env.BASE_URL || "/";
  return b.endsWith("/") ? b : b + "/";
}

/** 音频文件名中的音级：L6→6、L7→7，其余与 palette id 一致 */
export function audioFileKeyForNoteId(noteId) {
  if (noteId === "L6") return "6";
  if (noteId === "L7") return "7";
  return noteId;
}

export function audioUrlForNote(noteId, variant) {
  const prefix = variant === "long" ? "长音" : "短音";
  const key = audioFileKeyForNoteId(noteId);
  return baseUrl() + "audio/" + encodeURIComponent(prefix + key) + ".mp3";
}

let toneStarted = false;

async function ensureToneStarted() {
  if (!toneStarted) {
    await Tone.start();
    toneStarted = true;
  }
}

/** 同一 URL 只解码一次，避免每次试听重新 fetch/decode 导致首遍迟滞与卡顿 */
/** @type {Map<string, Promise<Tone.ToneAudioBuffer>>} */
const bufferByUrl = new Map();

function loadBufferCached(url) {
  let p = bufferByUrl.get(url);
  if (!p) {
    p = Tone.ToneAudioBuffer.fromUrl(url);
    bufferByUrl.set(url, p);
  }
  return p;
}

/** 简谱 1–7 长音/短音共 14 个文件；L6/L7 与 6、7 同文件 */
const PRELOAD_NOTE_IDS = ["1", "2", "3", "4", "5", "6", "7"];

let preloadAllPromise = null;

/**
 * 预加载全部试听素材并启动 AudioContext；可重复 await，并发只跑一趟。
 * 宜在用户手势内尽早调用（如首次点按界面），也可在试听前 await。
 */
export function preloadAllNoteBuffers() {
  if (preloadAllPromise) return preloadAllPromise;
  preloadAllPromise = (async () => {
    await ensureToneStarted();
    const urls = [];
    for (const id of PRELOAD_NOTE_IDS) {
      urls.push(audioUrlForNote(id, "long"), audioUrlForNote(id, "short"));
    }
    await Promise.all(urls.map((u) => loadBufferCached(u)));
  })();
  return preloadAllPromise;
}

function disposeAllTonePlayers() {
  for (const p of activePlayers) {
    try {
      p.stop();
      p.dispose();
    } catch (_) {}
  }
  activePlayers.clear();
}

/**
 * @param {"none" | "normal" | "tight"} gapKind
 */
async function sleepGapKind(gapKind, isCancelled) {
  let ms = 0;
  if (gapKind === "normal") {
    ms = HUMAN.gapNormalMin + Math.random() * (HUMAN.gapNormalMax - HUMAN.gapNormalMin);
  } else if (gapKind === "tight") {
    ms = HUMAN.gapTightMin + Math.random() * (HUMAN.gapTightMax - HUMAN.gapTightMin);
  }
  if (ms <= 0) return !isCancelled();
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (isCancelled()) return false;
    await new Promise((r) => setTimeout(r, Math.min(24, end - Date.now())));
  }
  return !isCancelled();
}

/**
 * @param {() => boolean} isCancelled 返回 true 表示应中止
 */
async function playUrlWithTone(url, isCancelled) {
  if (isCancelled()) return;
  await ensureToneStarted();
  if (isCancelled()) return;

  const buffer = await loadBufferCached(url);
  if (isCancelled()) return;

  return new Promise((resolve) => {
    const vol = new Tone.Volume().toDestination();
    const player = new Tone.Player(buffer).connect(vol);
    player.fadeIn = HUMAN.fadeIn;
    player.fadeOut = HUMAN.fadeOut;
    vol.volume.value = (Math.random() * 2 - 1) * HUMAN.volumeJitterDb;

    const jitter = (Math.random() * 2 - 1) * HUMAN.timingJitterSec;
    const startAt = Tone.now() + 0.018 + jitter;

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      activePlayers.delete(player);
      try {
        player.dispose();
      } catch (_) {}
      try {
        vol.dispose();
      } catch (_) {}
      resolve();
    };

    player.onstop = finish;

    activePlayers.add(player);
    player.start(startAt);

    const dur = buffer.duration;
    window.setTimeout(() => {
      if (!done) finish();
    }, (dur + 0.2) * 1000);
  });
}

async function playPageNote(url, token, gapKind) {
  const cancelled = () => token !== pagePlayToken;
  const ok = await sleepGapKind(gapKind, cancelled);
  if (!ok) return;
  await playUrlWithTone(url, cancelled);
}

export function stopPreviewPlayback() {
  previewToken += 1;
  disposeAllTonePlayers();
}

/** 中止整页串行播放（不切 token 时无法打断链式 Promise） */
export function cancelPageMelody() {
  disposeAllTonePlayers();
  pagePlayToken += 1;
}

/**
 * 单字试听：1 个音长音；2 个音按顺序短音。会中止当前整页播放。
 */
export async function playSelectionPreview(noteIds) {
  if (!noteIds?.length) return;
  cancelPageMelody();
  stopPreviewPlayback();
  const my = previewToken;

  const cancelled = () => my !== previewToken;

  await ensureToneStarted();
  if (cancelled()) return;

  if (noteIds.length === 1) {
    await playUrlWithTone(audioUrlForNote(noteIds[0], "long"), cancelled);
    return;
  }
  await playUrlWithTone(audioUrlForNote(noteIds[0], "short"), cancelled);
  if (cancelled()) return;
  const ok = await sleepGapKind("tight", cancelled);
  if (!ok) return;
  await playUrlWithTone(audioUrlForNote(noteIds[1], "short"), cancelled);
}

/**
 * 开始一段新的整页试听，返回本次 token；并中止上一段整页播放与单字试听。
 */
export function beginPagePlayback() {
  previewToken += 1;
  disposeAllTonePlayers();
  pagePlayToken += 1;
  return pagePlayToken;
}

/**
 * 整页串行试听；若 token 与 beginPagePlayback 时不一致则中止。
 */
export async function playPageMelody(selections, token) {
  let firstInPage = true;
  for (let i = 0; i < selections.length; i++) {
    if (token !== pagePlayToken) return;
    const sel = selections[i];
    if (!sel?.length) continue;
    if (sel.length === 1) {
      await playPageNote(audioUrlForNote(sel[0], "long"), token, firstInPage ? "none" : "normal");
      firstInPage = false;
    } else {
      if (token !== pagePlayToken) return;
      await playPageNote(audioUrlForNote(sel[0], "short"), token, firstInPage ? "none" : "normal");
      firstInPage = false;
      if (token !== pagePlayToken) return;
      await playPageNote(audioUrlForNote(sel[1], "short"), token, "tight");
    }
  }
}

/**
 * 多页按顺序串播（如第 1～4 页）；同一 token，便于一次中止。
 * @param {string[][][]} pagesSelections 每页一份 selections（与 state.selections 同形）
 */
export async function playAllPagesMelody(pagesSelections, token) {
  for (let pi = 0; pi < pagesSelections.length; pi++) {
    if (token !== pagePlayToken) return;
    await playPageMelody(pagesSelections[pi], token);
  }
}

/** 切页等场景：停掉所有声音并作废整页 token */
export function stopAllPlayback() {
  previewToken += 1;
  disposeAllTonePlayers();
  pagePlayToken += 1;
}
