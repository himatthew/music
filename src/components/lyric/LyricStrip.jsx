import { NoteGlyph } from "../notation/NoteGlyph.jsx";
import { findEntry } from "../../lib/notePalette.js";
import { LyricToneLine } from "./LyricToneMark.jsx";

/**
 * 主界面歌词行：飞入隐藏槽位；未选音时显示声调线（与简谱互斥）
 */
export function LyricStrip({
  lyrics,
  lyricTones = [],
  selections,
  lineRhythm,
  currentIndex,
  palette,
  flyChip,
  lyricPickedRefs,
  phraseCharsPerLine,
  onFocusLyricIndex,
}) {
  return (
    <div className="lyric-strip">
      <div className="lyric-row">
        {lyrics.map((ch, i) => {
          const sel = selections[i];
          const showRhythm = lineRhythm[i] && sel.length === 2;
          const isCurrent = i === currentIndex;
          const tone = lyricTones[i];
          const showTone = tone != null && tone >= 1 && tone <= 5 && sel.length === 0;
          return (
            <div
              key={i}
              role="button"
              tabIndex={0}
              aria-current={isCurrent ? "step" : undefined}
              aria-label={"编辑第 " + (i + 1) + " 个字「" + ch + "」"}
              className={
                "lyric-cell" +
                (isCurrent ? " lyric-cell--current" : "") +
                (i > 0 && i % phraseCharsPerLine === 0 ? " lyric-cell--phrase-start" : "")
              }
              onClick={() => onFocusLyricIndex(i)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onFocusLyricIndex(i);
                }
              }}
            >
              <div className="lyric-cell__grow" aria-hidden />
              <div
                className={
                  "lyric-cell__picked-wrap" + (sel.length === 0 ? " lyric-cell__picked-wrap--empty" : "")
                }
                ref={(el) => {
                  lyricPickedRefs.current[i] = el;
                }}
              >
                {(() => {
                  const pair = sel.length === 2;
                  const stacked = pair && showRhythm;
                  const hide = (j) =>
                    flyChip && flyChip.lyricRowIndex === i && flyChip.pickedSlotIndex === j;
                  if (stacked) {
                    return (
                      <div className="lyric-cell__picked lyric-cell__picked--stack">
                        <div className="lyric-cell__picked-notes">
                          <svg
                            className="picked-slur"
                            viewBox="0 -3 100 26"
                            preserveAspectRatio="none"
                            aria-hidden
                          >
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
                                <span
                                  key={j + "-" + nid}
                                  className={
                                    "picked__n picked__n--sheet" + (hide(j) ? " picked__n--fly-hidden" : "")
                                  }
                                >
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
                                {entry?.low ? (
                                  <span className="note-glyph__dot note-glyph__dot--below" />
                                ) : null}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }
                  if (pair) {
                    return (
                      <div className="lyric-cell__picked lyric-cell__picked--pair">
                        <div className="lyric-cell__picked-notes">
                          <svg
                            className="picked-slur"
                            viewBox="0 -3 100 26"
                            preserveAspectRatio="none"
                            aria-hidden
                          >
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
                                <span
                                  key={j + "-" + nid}
                                  className={"picked__n" + (hide(j) ? " picked__n--fly-hidden" : "")}
                                >
                                  <NoteGlyph entry={entry} />
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div className="lyric-cell__picked">
                      {sel.map((nid, j) => {
                        const entry = findEntry(palette, nid);
                        return (
                          <span
                            key={j + "-" + nid}
                            className={"picked__n" + (hide(j) ? " picked__n--fly-hidden" : "")}
                          >
                            <NoteGlyph entry={entry} />
                          </span>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
              <div className="lyric-cell__char-wrap">
                {showTone && (
                  <div className="lyric-cell__tone-stack lyric-cell__tone-stack--on-char" aria-hidden>
                    <div className="lyric-tone-line">
                      <LyricToneLine tone={tone} />
                    </div>
                  </div>
                )}
                <span className="lyric-cell__char">{ch}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
