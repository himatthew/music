/**
 * 划线「非直线」：路径上同一音级在出现其他音之后再次出现（排除仅左右横移同一音）。
 * 此时优先按曲线几何：波峰（clientY 最小、靠上）取该点音节；波谷（clientY 最大、靠下）取该点音节；
 * 不明显时回退为路径上音高最低的一格。
 */

/** 音高从高到低（与简谱区自上而下 + 低音点一致） */
const PITCH_LOWEST_RANK = {
  "5": 0,
  "4": 1,
  "3": 2,
  "2": 3,
  "1": 4,
  "6": 5,
  "7": 6,
  L7: 7,
  L6: 8,
};

export function pitchLowestRank(noteId) {
  if (noteId == null) return -1;
  const r = PITCH_LOWEST_RANK[noteId];
  return r === undefined ? -1 : r;
}

/**
 * 是否存在 i<j、k 满足 noteIds[i]===noteIds[j] 且中间某格与两端不同（即「绕回」同一音级）。
 * 纯 [a,a] 左右横移、[a,a,a] 同格抖动中间无别音 → false。
 */
export function hasRevisitedNoteAfterOther(noteIds) {
  const n = noteIds.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (noteIds[i] !== noteIds[j]) continue;
      for (let k = i + 1; k < j; k++) {
        if (noteIds[k] !== noteIds[i]) return true;
      }
    }
  }
  return false;
}

/** 全程同一音级（仅左右横线或同格抖动） */
export function allSameNoteId(noteIds) {
  return noteIds.length > 0 && noteIds.every((id) => id === noteIds[0]);
}

export function strokeLowestPitchNoteId(noteIds) {
  let best = noteIds[0];
  let bestR = pitchLowestRank(best);
  for (let i = 1; i < noteIds.length; i++) {
    const id = noteIds[i];
    const r = pitchLowestRank(id);
    const br = bestR === -1 ? -999 : bestR;
    const rr = r === -1 ? -999 : r;
    if (rr > br) {
      best = id;
      bestR = r;
    }
  }
  return best;
}

/**
 * clientY：屏幕坐标，越小越靠上（波峰），越大越靠下（波谷）。
 * - 仅波峰显著 → 取波峰处音节；仅波谷显著 → 取波谷处音节；
 * - 波峰与波谷同时显著（不规则路径）→ 统一取波谷音节；
 * - 否则回退为 strokeLowestPitchNoteId。
 */
function lastIndexOfNote(noteIds, noteId) {
  for (let i = noteIds.length - 1; i >= 0; i--) {
    if (noteIds[i] === noteId) return i;
  }
  return noteIds.length - 1;
}

export function pickPeakValleyOrFallbackNoteId(noteIds, visitClientYs) {
  if (!visitClientYs?.length || visitClientYs.length !== noteIds.length) {
    const id = strokeLowestPitchNoteId(noteIds);
    return {
      noteId: id,
      pickIndex: lastIndexOfNote(noteIds, id),
      mode: "fallback",
    };
  }
  const ys = visitClientYs;
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const y0 = ys[0];
  const y1 = ys[ys.length - 1];
  const peakProm = Math.min(y0, y1) - minY;
  const valleyProm = maxY - Math.max(y0, y1);
  const TH = 6;

  const peakIdx = ys.indexOf(minY);
  const valleyIdx = ys.indexOf(maxY);

  const hasPeak = peakProm > TH;
  const hasValley = valleyProm > TH;

  if (hasPeak && hasValley) {
    return { noteId: noteIds[valleyIdx], pickIndex: valleyIdx, mode: "valley" };
  }
  if (hasPeak && !hasValley) {
    return { noteId: noteIds[peakIdx], pickIndex: peakIdx, mode: "peak" };
  }
  if (hasValley && !hasPeak) {
    return { noteId: noteIds[valleyIdx], pickIndex: valleyIdx, mode: "valley" };
  }
  const id = strokeLowestPitchNoteId(noteIds);
  return {
    noteId: id,
    pickIndex: lastIndexOfNote(noteIds, id),
    mode: "fallback",
  };
}

export function noteIdForStrokeKey(strokeKey) {
  const el = document.querySelector(`[data-stroke-key="${CSS.escape(strokeKey)}"]`);
  return el?.getAttribute("data-note-id") ?? null;
}

/** 路径上最后一次落在该 noteId 的格子的按钮（用于飞入动画） */
export function buttonForLastStrokeOfNote(visitedKeys, noteId) {
  for (let i = visitedKeys.length - 1; i >= 0; i--) {
    const id = noteIdForStrokeKey(visitedKeys[i]);
    if (id === noteId) {
      const row = document.querySelector(`[data-stroke-key="${CSS.escape(visitedKeys[i])}"]`);
      return row?.querySelector?.("button[data-note-id]") ?? row ?? null;
    }
  }
  return null;
}

/** 取第 i 次经过的格的按钮（波峰/波谷对应几何位置） */
export function buttonForStrokeIndex(visitedKeys, index) {
  if (index < 0 || index >= visitedKeys.length) return null;
  const row = document.querySelector(`[data-stroke-key="${CSS.escape(visitedKeys[index])}"]`);
  return row?.querySelector?.("button[data-note-id]") ?? row ?? null;
}
