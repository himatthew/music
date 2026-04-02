/**
 * 简谱 id 与 public/audio 下文件对应：长音3.mp3、短音3.mp3（无空格）
 * 带低音点的 L6/L7 与素材「6」「7」对应，文件名用数字 6、7
 */

let lastPreviewAudio = null;
let currentPageAudio = null;
let pagePlayToken = 0;

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

function playUrl(url) {
  return new Promise((resolve) => {
    if (currentPageAudio) {
      try {
        currentPageAudio.pause();
      } catch (_) {}
    }
    const a = new Audio(url);
    currentPageAudio = a;
    a.onended = () => {
      if (currentPageAudio === a) currentPageAudio = null;
      resolve();
    };
    a.onerror = () => {
      console.warn("[audio] missing or failed:", url);
      if (currentPageAudio === a) currentPageAudio = null;
      resolve();
    };
    a.play().catch(() => {
      if (currentPageAudio === a) currentPageAudio = null;
      resolve();
    });
  });
}

export function stopPreviewPlayback() {
  if (lastPreviewAudio) {
    try {
      lastPreviewAudio.pause();
    } catch (_) {}
    lastPreviewAudio = null;
  }
}

/** 中止整页串行播放（不切 token 时无法打断链式 Promise） */
export function cancelPageMelody() {
  if (currentPageAudio) {
    try {
      currentPageAudio.pause();
    } catch (_) {}
    currentPageAudio = null;
  }
  pagePlayToken += 1;
}

/**
 * 单字试听：1 个音长音；2 个音按顺序短音。会中止当前整页播放。
 */
export async function playSelectionPreview(noteIds) {
  if (!noteIds?.length) return;
  cancelPageMelody();
  stopPreviewPlayback();
  if (noteIds.length === 1) {
    const a = new Audio(audioUrlForNote(noteIds[0], "long"));
    lastPreviewAudio = a;
    await new Promise((resolve) => {
      a.onended = () => resolve();
      a.onerror = () => {
        console.warn("[audio] missing or failed:", audioUrlForNote(noteIds[0], "long"));
        resolve();
      };
      a.play().catch(() => resolve());
    });
    lastPreviewAudio = null;
    return;
  }
  for (let i = 0; i < noteIds.length; i++) {
    const a = new Audio(audioUrlForNote(noteIds[i], "short"));
    lastPreviewAudio = a;
    await new Promise((resolve) => {
      a.onended = () => resolve();
      a.onerror = () => {
        console.warn("[audio] missing or failed:", audioUrlForNote(noteIds[i], "short"));
        resolve();
      };
      a.play().catch(() => resolve());
    });
  }
  lastPreviewAudio = null;
}

/**
 * 开始一段新的整页试听，返回本次 token；并中止上一段整页播放与单字试听。
 */
export function beginPagePlayback() {
  stopPreviewPlayback();
  if (currentPageAudio) {
    try {
      currentPageAudio.pause();
    } catch (_) {}
    currentPageAudio = null;
  }
  pagePlayToken += 1;
  return pagePlayToken;
}

/**
 * 整页串行试听；若 token 与 beginPagePlayback 时不一致则中止。
 */
export async function playPageMelody(selections, token) {
  for (let i = 0; i < selections.length; i++) {
    if (token !== pagePlayToken) return;
    const sel = selections[i];
    if (!sel?.length) continue;
    if (sel.length === 1) {
      await playUrl(audioUrlForNote(sel[0], "long"));
    } else {
      if (token !== pagePlayToken) return;
      await playUrl(audioUrlForNote(sel[0], "short"));
      if (token !== pagePlayToken) return;
      await playUrl(audioUrlForNote(sel[1], "short"));
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
  stopPreviewPlayback();
  if (currentPageAudio) {
    try {
      currentPageAudio.pause();
    } catch (_) {}
    currentPageAudio = null;
  }
  pagePlayToken += 1;
}
