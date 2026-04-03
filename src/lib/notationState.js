export function emptySelections(len) {
  return Array.from({ length: len }, () => []);
}

export function emptyLineRhythm(len) {
  return Array.from({ length: len }, () => false);
}

/** 每句两个槽位对应最多两个音上的持久划轨 */
export function emptyNotationTrails(len) {
  return Array.from({ length: len }, () => [null, null]);
}

export function cloneTrail(t) {
  if (!t) return null;
  return { w: t.w, h: t.h, points: t.points.map((p) => ({ x: p.x, y: p.y })) };
}

function cloneNotationTrailsRow(row) {
  const a = cloneTrail(row[0]);
  const b = cloneTrail(row[1]);
  if (row[0] != null && row[0] === row[1]) {
    return [a, a];
  }
  return [a, b];
}

export function cloneNotationTrails(trails) {
  return trails.map(cloneNotationTrailsRow);
}

export function trailSnapshotFromStroke(s) {
  if (!s?.trailPoints?.length) return null;
  return {
    w: s.trailW,
    h: s.trailH,
    points: s.trailPoints.map((p) => ({ x: p.x, y: p.y })),
  };
}

export function isPageComplete(st, lyricsLen) {
  return st.selections.length === lyricsLen && st.selections.every((a) => a.length > 0);
}

export function createInitialSceneStates(scenes) {
  return scenes.map((s) => ({
    currentIndex: 0,
    selections: emptySelections(s.lyrics.length),
    lineRhythm: emptyLineRhythm(s.lyrics.length),
    notationTrails: emptyNotationTrails(s.lyrics.length),
  }));
}
