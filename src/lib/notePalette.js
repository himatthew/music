export function findEntry(palette, id) {
  return palette.find((p) => p.id === id) ?? null;
}

/** 保证每条简谱都能映射到 palette id；灰色 hint 未写 id 时按音高自动推断 */
export function resolveNoteId(seg) {
  if (seg.id != null && seg.id !== "") return seg.id;
  const t = String(seg.t);
  if (seg.low) {
    if (t === "7") return "L7";
    if (t === "6") return "L6";
  }
  return t;
}

/** 简谱纵轴：高音 → 低音（与 SCENES 中自上而下书写顺序一致） */
export const PITCH_ROW_ORDER = ["5", "4", "3", "2", "1", "7", "L7", "L6"];

export function pitchRowIdsFromSides(left, right) {
  const ids = new Set();
  for (const seg of left) ids.add(resolveNoteId(seg));
  for (const seg of right) ids.add(resolveNoteId(seg));
  return Array.from(ids).sort((a, b) => {
    const ia = PITCH_ROW_ORDER.indexOf(a);
    const ib = PITCH_ROW_ORDER.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
}
