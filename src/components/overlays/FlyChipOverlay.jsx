import { useLayoutEffect, useRef } from "react";
import { NoteGlyph } from "../notation/NoteGlyph.jsx";

export function FlyChipOverlay({ fromRect, toRect, entry, onDone }) {
  const ref = useRef(null);
  const dx = toRect.left - fromRect.left;
  const dy = toRect.top - fromRect.top;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transition = "none";
    el.style.transform = "translate(0px, 0px)";
    el.style.opacity = "1";
    void el.offsetHeight;
    const id = requestAnimationFrame(() => {
      el.style.transition =
        "transform 0.56s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.22s ease 0.52s";
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      el.style.opacity = "0";
    });
    const t = window.setTimeout(onDone, 720);
    return () => {
      window.clearTimeout(t);
      cancelAnimationFrame(id);
    };
  }, [dx, dy, onDone]);

  return (
    <div
      ref={ref}
      className="fly-chip"
      style={{
        left: fromRect.left,
        top: fromRect.top,
        width: Math.max(fromRect.width, 8),
        height: Math.max(fromRect.height, 8),
      }}
      aria-hidden
    >
      <span className="fly-chip__inner picked__n">
        <NoteGlyph entry={entry} />
      </span>
    </div>
  );
}
