import { LYRIC_CHARS_PER_PHRASE, SCENES } from "../../data/scenes.js";
import { isPageComplete } from "../../lib/notationState.js";
import { LyricPickedDisplay } from "../lyric/LyricPickedDisplay.jsx";

export function FullSheetModal({
  onClose,
  states,
  allPagesComplete,
  audioPlaybackBusy,
  pagePreviewPlaying,
  allMelodyPlaying,
  fullSheetPlayingPage,
  onPlayAll,
  onPlayPage,
}) {
  return (
    <div className="full-sheet-overlay" role="presentation" onClick={onClose}>
      <div
        className="full-sheet-modal"
        role="dialog"
        aria-modal="true"
        aria-label="完整歌谱"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="full-sheet-head">
          <h2 className="full-sheet-title">完整歌谱</h2>
          <div className="full-sheet-head-actions">
            {allPagesComplete && (
              <button
                type="button"
                className="btn-secondary"
                disabled={audioPlaybackBusy && !allMelodyPlaying}
                onClick={() => void onPlayAll()}
              >
                {allMelodyPlaying ? "播放中…" : "试听全曲"}
              </button>
            )}
            <button type="button" className="full-sheet-close" onClick={onClose}>
              关闭
            </button>
          </div>
        </div>
        <div className="full-sheet-body">
          {SCENES.map((pg, pi) => {
            const st = states[pi];
            const sheetPageDone = isPageComplete(st, pg.lyrics.length);
            return (
              <section key={pg.id} className="full-sheet-page">
                <div className="full-sheet-page-head">
                  <h3 className="full-sheet-page-title">第 {pi + 1} 页</h3>
                  {sheetPageDone && (
                    <button
                      type="button"
                      className="btn-secondary full-sheet-play-btn"
                      disabled={audioPlaybackBusy && fullSheetPlayingPage !== pi}
                      onClick={() => void onPlayPage(pi)}
                    >
                      {fullSheetPlayingPage === pi ? "播放中…" : "试听本页"}
                    </button>
                  )}
                </div>
                <div className="full-sheet-lyric-row">
                  {pg.lyrics.map((ch, i) => {
                    const sel = st.selections[i];
                    const lr = st.lineRhythm[i];
                    return (
                      <div
                        key={i}
                        className={
                          "full-sheet-cell" +
                          (i > 0 && i % LYRIC_CHARS_PER_PHRASE === 0 ? " full-sheet-cell--bar" : "")
                        }
                      >
                        <div className="lyric-cell__picked-wrap">
                          <LyricPickedDisplay sel={sel} lineRhythm={lr} palette={pg.palette} />
                        </div>
                        <span className="lyric-cell__char">{ch}</span>
                      </div>
                    );
                  })}
                  {pi === SCENES.length - 1 ? (
                    <div className="full-sheet-cell full-sheet-cell--tail-zero" aria-hidden>
                      <div className="lyric-cell__picked-wrap">
                        <div className="lyric-cell__picked lyric-cell__picked--pair lyric-cell__picked--single">
                          <div className="lyric-cell__picked-notes">
                            <div className="lyric-cell__picked-numbers">
                              <span className="picked__n">
                                <span className="note-glyph full-sheet-trailing-zero">0</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <span className="lyric-cell__char full-sheet-tail-zero__lyric">&nbsp;</span>
                    </div>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
