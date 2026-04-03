import { NoteGlyph } from "./NoteGlyph.jsx";
import { resolveNoteId } from "../../lib/notePalette.js";

export function LadderRow({ seg, onPick, side }) {
  const noteId = resolveNoteId(seg);
  const strokeKey = `${side}-${noteId}`;
  const entry = { id: noteId, t: seg.t, low: !!seg.low };
  const isPick = seg.role === "pick";
  return (
    <div
      className={"ladder-line " + (isPick ? "ladder-line--pick" : "ladder-line--hint")}
      data-note-id={noteId}
      data-stroke-key={strokeKey}
      onClick={(e) => {
        if (e.target.closest?.("button")) return;
        onPick(noteId, e);
      }}
    >
      <div className="ladder-line__num-wrap">
        <button
          type="button"
          data-note-id={noteId}
          className={isPick ? "ladder__pick" : "ladder__hint-btn"}
          onClick={(e) => onPick(noteId, e)}
          aria-label={"选择音符 " + seg.t + (seg.low ? " 低音" : "")}
        >
          <NoteGlyph entry={entry} />
        </button>
      </div>
      <span className="ladder-dash" aria-hidden />
    </div>
  );
}
