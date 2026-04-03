import { flushSync } from "react-dom";
import { useCallback, useRef } from "react";
import { playSelectionPreview } from "../audioPlayback.js";
import { pickLadderHitFromPoint } from "../lib/pickLadderHit.js";
import { trailSnapshotFromStroke } from "../lib/notationState.js";

/**
 * 简谱区划线：document 捕获 pointer，与点击选音解耦（suppressClickRef）
 */
export function useNotationStroke({
  state,
  setCurrent,
  addNote,
  applyLineStroke,
  notationAreaRef,
  suppressClickRef,
  setStrokeTrail,
}) {
  const strokeRef = useRef(null);

  const onNotationPointerDown = useCallback(
    (e) => {
      const row = e.target.closest?.(".ladder-line[data-note-id]");
      if (!row) return;
      const id = row.getAttribute("data-note-id");
      const strokeKey = row.getAttribute("data-stroke-key");
      if (!id || !strokeKey) return;
      const btn = row.querySelector?.("button[data-note-id]");
      if (!btn) return;
      const pointerId = e.pointerId;
      const areaEl = notationAreaRef.current;
      const areaRect = areaEl?.getBoundingClientRect();
      const trailPt =
        areaRect != null ? { x: e.clientX - areaRect.left, y: e.clientY - areaRect.top } : null;
      strokeRef.current = {
        pointerId,
        visitedKeys: [strokeKey],
        lastHitKey: strokeKey,
        startNoteId: id,
        lastClientX: e.clientX,
        lastClientY: e.clientY,
        startX: e.clientX,
        startY: e.clientY,
        startButton: btn,
        maxDist: 0,
        trailPoints: trailPt ? [trailPt] : [],
        trailW: areaRect?.width ?? 0,
        trailH: areaRect?.height ?? 0,
      };
      if (trailPt && areaRect) {
        setStrokeTrail({
          points: [trailPt],
          w: areaRect.width,
          h: areaRect.height,
        });
      }

      try {
        row.setPointerCapture(e.pointerId);
      } catch (_) {}

      const docOpts = { capture: true, passive: false };

      function onDocMove(ev) {
        if (ev.pointerId !== pointerId) return;
        const s = strokeRef.current;
        if (!s) return;
        s.lastClientX = ev.clientX;
        s.lastClientY = ev.clientY;
        const d = Math.hypot(ev.clientX - s.startX, ev.clientY - s.startY);
        s.maxDist = Math.max(s.maxDist, d);
        if (d > 6) ev.preventDefault();
        const ar = notationAreaRef.current?.getBoundingClientRect();
        if (ar && s.trailPoints) {
          s.trailPoints.push({
            x: ev.clientX - ar.left,
            y: ev.clientY - ar.top,
          });
          s.trailW = ar.width;
          s.trailH = ar.height;
          setStrokeTrail({
            points: s.trailPoints.slice(),
            w: ar.width,
            h: ar.height,
          });
        }
        const hit = pickLadderHitFromPoint(ev.clientX, ev.clientY);
        if (hit && hit.strokeKey !== s.lastHitKey) {
          s.visitedKeys.push(hit.strokeKey);
          s.lastHitKey = hit.strokeKey;
        }
      }

      function cleanup() {
        setStrokeTrail(null);
        try {
          row.releasePointerCapture(pointerId);
        } catch (_) {}
        document.removeEventListener("pointermove", onDocMove, docOpts);
        document.removeEventListener("pointerup", onDocUp, docOpts);
        document.removeEventListener("pointercancel", onDocCancel, docOpts);
      }

      function onDocUp(ev) {
        if (ev.pointerId !== pointerId) return;
        cleanup();
        const s = strokeRef.current;
        strokeRef.current = null;
        if (!s) return;

        const TAP_MOVE = 12;
        const moved = (s.maxDist || 0) > TAP_MOVE;

        if (s.visitedKeys.length >= 2) {
          ev.preventDefault();
          ev.stopPropagation();
          suppressClickRef.current = true;
          const firstKey = s.visitedKeys[0];
          const lastKey = s.visitedKeys[s.visitedKeys.length - 1];
          const firstEl = document.querySelector(`[data-stroke-key="${CSS.escape(firstKey)}"]`);
          const lastEl = document.querySelector(`[data-stroke-key="${CSS.escape(lastKey)}"]`);
          const firstId = firstEl?.getAttribute("data-note-id");
          const lastId = lastEl?.getAttribute("data-note-id");
          if (firstId && lastId) {
            applyLineStroke(firstId, lastId, s.lastClientX, s.lastClientY, lastKey, {
              skipPreview: true,
            });
            const tr = trailSnapshotFromStroke(s);
            if (tr?.points?.length) {
              flushSync(() => {
                setCurrent((st) => {
                  const i = st.currentIndex;
                  st.notationTrails[i][0] = tr;
                  st.notationTrails[i][1] = tr;
                });
              });
            }
            queueMicrotask(() => {
              void playSelectionPreview([firstId, lastId]);
            });
          }
          return;
        }
        if (s.visitedKeys.length === 1 && moved) {
          ev.preventDefault();
          ev.stopPropagation();
          const idx = state.currentIndex;
          const slotBefore = state.selections[idx].length;
          const beforeSel = [...state.selections[idx]];
          addNote(s.startNoteId, { currentTarget: s.startButton }, {
            fromStroke: true,
            skipPreview: true,
          });
          suppressClickRef.current = true;
          if (slotBefore < 2) {
            const tr = trailSnapshotFromStroke(s);
            if (tr?.points?.length) {
              flushSync(() => {
                setCurrent((st) => {
                  st.notationTrails[st.currentIndex][slotBefore] = tr;
                });
              });
            }
            queueMicrotask(() => {
              void playSelectionPreview([...beforeSel, s.startNoteId]);
            });
          }
        }
      }

      function onDocCancel(ev) {
        if (ev.pointerId !== pointerId) return;
        cleanup();
        strokeRef.current = null;
      }

      document.addEventListener("pointermove", onDocMove, docOpts);
      document.addEventListener("pointerup", onDocUp, docOpts);
      document.addEventListener("pointercancel", onDocCancel, docOpts);
    },
    [applyLineStroke, addNote, setCurrent, state.currentIndex, state.selections, notationAreaRef, suppressClickRef, setStrokeTrail]
  );

  return { onNotationPointerDown };
}
