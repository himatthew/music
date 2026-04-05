export function NoteGlyph({ entry, className }) {
  if (!entry) return null;
  if (entry.low) {
    return (
      <span className={"note-glyph note-glyph--low " + (className || "")}>
        <span className="note-glyph__num">
          {entry.t}
          <span className="note-glyph__dot" aria-hidden />
        </span>
      </span>
    );
  }
  return <span className={"note-glyph " + (className || "")}>{entry.t}</span>;
}
