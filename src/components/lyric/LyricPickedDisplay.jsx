import { NoteGlyph } from "../notation/NoteGlyph.jsx";
import { findEntry } from "../../lib/notePalette.js";

/** 总谱 / 预览：与主界面相同的双音/节奏/低音点布局（无飞入） */
export function LyricPickedDisplay({ sel, lineRhythm, palette }) {
  const showRhythm = lineRhythm && sel.length === 2;
  const pair = sel.length === 2;
  if (showRhythm) {
    return (
      <div className="lyric-cell__picked lyric-cell__picked--stack">
        <div className="lyric-cell__picked-notes">
          <svg className="picked-slur" viewBox="0 -3 100 26" preserveAspectRatio="none" aria-hidden>
            <path
              d="M 30 18 Q 50 -2 70 18"
              fill="none"
              stroke="var(--demo-cyan)"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </svg>
          <div className="lyric-cell__picked-numbers">
            {sel.map((nid, j) => {
              const entry = findEntry(palette, nid);
              return (
                <span key={j + "-" + nid} className="picked__n picked__n--sheet">
                  <span className="note-glyph__num">{entry?.t}</span>
                </span>
              );
            })}
          </div>
        </div>
        <div className="lyric-cell__rhythm-line" aria-hidden />
        <div className="lyric-cell__low-dots">
          {sel.map((nid, j) => {
            const entry = findEntry(palette, nid);
            return (
              <span key={"d-" + j} className="lyric-dot-slot">
                {entry?.low ? <span className="note-glyph__dot note-glyph__dot--below" /> : null}
              </span>
            );
          })}
        </div>
      </div>
    );
  }
  const showSlur = pair;
  const isSingle = sel.length === 1;
  return (
    <div
      className={
        "lyric-cell__picked lyric-cell__picked--pair" + (isSingle ? " lyric-cell__picked--single" : "")
      }
    >
      <div className="lyric-cell__picked-notes">
        {showSlur ? (
          <svg className="picked-slur" viewBox="0 -3 100 26" preserveAspectRatio="none" aria-hidden>
            <path
              d="M 30 18 Q 50 -2 70 18"
              fill="none"
              stroke="var(--demo-cyan)"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </svg>
        ) : null}
        <div className="lyric-cell__picked-numbers">
          {sel.map((nid, j) => (
            <span key={j + "-" + nid} className="picked__n">
              <NoteGlyph entry={findEntry(palette, nid)} />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
