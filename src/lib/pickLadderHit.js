/** 左右同音高共用 data-note-id，划线需用 data-stroke-key 区分格位 */
export function pickLadderHitFromPoint(clientX, clientY) {
  const lines = document.querySelectorAll(".notation-area .ladder-line[data-stroke-key]");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    const r = line.getBoundingClientRect();
    if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
      const strokeKey = line.getAttribute("data-stroke-key");
      const noteId = line.getAttribute("data-note-id");
      if (strokeKey && noteId) return { strokeKey, noteId };
    }
  }
  const els = document.elementsFromPoint(clientX, clientY);
  for (let k = 0; k < els.length; k++) {
    const el = els[k];
    if (el.closest?.(".notation-trail") || el.closest?.(".fly-chip") || el.closest?.(".particle-burst")) continue;
    const line = el.closest?.(".ladder-line[data-stroke-key]");
    if (line) {
      const strokeKey = line.getAttribute("data-stroke-key");
      const noteId = line.getAttribute("data-note-id");
      if (strokeKey && noteId) return { strokeKey, noteId };
    }
  }
  return null;
}
