import { flushSync } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { preloadAllNoteBuffers } from "../audioPlayback.js";
import { LYRIC_CHARS_PER_PHRASE, SCENES } from "../data/scenes.js";
import { useCompositionPlayback } from "../hooks/useCompositionPlayback.js";
import { useNotationStroke } from "../hooks/useNotationStroke.js";
import { useToast } from "../hooks/useToast.js";
import {
  cloneNotationTrails,
  createInitialSceneStates,
  isPageComplete,
} from "../lib/notationState.js";
import { findEntry } from "../lib/notePalette.js";
import { FullSheetModal } from "../components/fullSheet/FullSheetModal.jsx";
import { LyricStrip } from "../components/lyric/LyricStrip.jsx";
import { NotationPairRows } from "../components/notation/NotationPairRows.jsx";
import { NotationTrailSvg } from "../components/notation/NotationTrailSvg.jsx";
import { FlyChipOverlay } from "../components/overlays/FlyChipOverlay.jsx";
import { ParticleBurstOverlay } from "../components/overlays/ParticleBurstOverlay.jsx";
import "../App.css";

/**
 * 满 2 个音符后不再追加，需先删除。
 * pairLadders：左右两列按音高对齐同行；pick 大号青色、hint 小号灰色，均可点；id 可省略，由 resolveNoteId 推断。
 */
export default function ComposerApp() {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [states, setStates] = useState(() => createInitialSceneStates(SCENES));
  const { toast, showToast } = useToast();
  const lyricPickedRefs = useRef([]);
  const notationAreaRef = useRef(null);
  const suppressClickRef = useRef(false);
  const deleteTimerRef = useRef(0);
  const [flyChip, setFlyChip] = useState(null);
  const [particleBurst, setParticleBurst] = useState(null);
  const [strokeTrail, setStrokeTrail] = useState(null);
  const [fullSheetOpen, setFullSheetOpen] = useState(false);
  const audioWarmRef = useRef(false);
  const onScenePointerDownCapture = useCallback(() => {
    if (audioWarmRef.current) return;
    audioWarmRef.current = true;
    void preloadAllNoteBuffers();
  }, []);

  const {
    pagePreviewPlaying,
    allMelodyPlaying,
    fullSheetPlayingPage,
    audioPlaybackBusy,
    playCurrentPageMelody,
    playAllMelody,
    playFullSheetPageAt,
    stopAllPlaybackAndResetUI,
  } = useCompositionPlayback({ sceneIndex, states });

  const scene = SCENES[sceneIndex];
  const state = states[sceneIndex];

  const pageComplete = useMemo(
    () => isPageComplete(state, scene.lyrics.length),
    [state, scene.lyrics.length]
  );

  /** 当前页所有字都选完音后预加载试听素材，点「试听本页」时更顺滑 */
  useEffect(() => {
    if (!pageComplete) return;
    void preloadAllNoteBuffers();
  }, [pageComplete, sceneIndex]);

  const setCurrent = useCallback((updater) => {
    setStates((prev) => {
      const next = prev.map((x, i) => {
        if (i !== sceneIndex) return x;
        return {
          currentIndex: x.currentIndex,
          selections: x.selections.map((a) => [...a]),
          lineRhythm: [...x.lineRhythm],
          notationTrails: cloneNotationTrails(x.notationTrails),
        };
      });
      const st = { ...next[sceneIndex] };
      updater(st);
      next[sceneIndex] = st;
      return next;
    });
  }, [sceneIndex]);

  const addNote = useCallback(
    (id, e, opts) => {
      if (!opts?.fromStroke && suppressClickRef.current) {
        suppressClickRef.current = false;
        return;
      }
      const idx = state.currentIndex;
      /** 单音点击/滑动：始终覆盖本格为一个音，不叠成双音；双音仅由跨两音划线产生 */
      const pickedSlotIndex = 0;
      const fromRect = e?.currentTarget?.getBoundingClientRect?.();
      flushSync(() => {
        setCurrent((st) => {
          const i = st.currentIndex;
          st.selections[i] = [id];
          st.lineRhythm[i] = false;
          st.notationTrails[i] = [null, null];
        });
      });
      if (!fromRect) return;
      requestAnimationFrame(() => {
        const wrap = lyricPickedRefs.current[idx];
        const node = wrap?.querySelector(".picked__n:last-child");
        const toRect = node?.getBoundingClientRect();
        if (!toRect) return;
        setFlyChip({
          key: Date.now(),
          fromRect,
          toRect,
          noteId: id,
          lyricRowIndex: idx,
          pickedSlotIndex,
        });
      });
    },
    [setCurrent, state.currentIndex]
  );

  const applyLineStroke = useCallback(
    (firstId, lastId, fromClientX, fromClientY, lastStrokeKey, opts) => {
      const idx = state.currentIndex;
      const pickedSlotIndex = 1;
      flushSync(() => {
        setCurrent((st) => {
          const i = st.currentIndex;
          st.selections[i] = [firstId, lastId];
          st.lineRhythm[i] = true;
        });
      });
      const line =
        lastStrokeKey != null
          ? document.querySelector(`[data-stroke-key="${CSS.escape(lastStrokeKey)}"]`)
          : null;
      const hitLine =
        line ??
        document.elementFromPoint(fromClientX, fromClientY)?.closest?.(".ladder-line[data-note-id]");
      const fromBtn = hitLine?.querySelector?.("button[data-note-id]");
      const fromRect = fromBtn?.getBoundingClientRect() ?? hitLine?.getBoundingClientRect();
      if (!fromRect) return;
      requestAnimationFrame(() => {
        const wrap = lyricPickedRefs.current[idx];
        const node = wrap?.querySelector(".picked__n:last-child");
        const toRect = node?.getBoundingClientRect();
        if (!toRect) return;
        setFlyChip({
          key: Date.now(),
          fromRect,
          toRect,
          noteId: lastId,
          lyricRowIndex: idx,
          pickedSlotIndex,
        });
      });
    },
    [setCurrent, state.currentIndex]
  );

  const { onNotationPointerDown } = useNotationStroke({
    state,
    setCurrent,
    addNote,
    applyLineStroke,
    notationAreaRef,
    suppressClickRef,
    setStrokeTrail,
  });

  const clearFlyChip = useCallback(() => {
    setFlyChip(null);
  }, []);

  const focusLyricIndex = useCallback(
    (i) => {
      if (i === state.currentIndex) return;
      setFlyChip(null);
      setCurrent((st) => {
        st.currentIndex = i;
      });
    },
    [setCurrent, state.currentIndex]
  );

  const deleteLast = useCallback(() => {
    const idx = state.currentIndex;
    const arr = state.selections[idx];
    if (arr.length === 0) return;
    stopAllPlaybackAndResetUI();
    window.clearTimeout(deleteTimerRef.current);
    const container = lyricPickedRefs.current[idx];
    const rect = container?.getBoundingClientRect();
    flushSync(() => {
      setCurrent((st) => {
        const i = st.currentIndex;
        st.selections[i] = [];
        st.lineRhythm[i] = false;
        st.notationTrails[i] = [null, null];
      });
    });
    if (rect && rect.width >= 1 && rect.height >= 1) {
      requestAnimationFrame(() => {
        setParticleBurst({ key: Date.now(), rect });
      });
    }
    deleteTimerRef.current = window.setTimeout(() => {
      setParticleBurst(null);
    }, 520);
  }, [setCurrent, state.currentIndex, state.selections, stopAllPlaybackAndResetUI]);

  const confirm = useCallback(() => {
    const idx = state.currentIndex;
    if (idx >= scene.lyrics.length - 1) {
      showToast("本页已完成");
      return;
    }
    setCurrent((st) => {
      st.currentIndex = idx + 1;
    });
  }, [scene.lyrics.length, state.currentIndex, setCurrent, showToast]);

  const goScene = useCallback((delta) => {
    setSceneIndex((i) => {
      const n = i + delta;
      if (n < 0 || n >= SCENES.length) return i;
      return n;
    });
  }, []);

  useEffect(() => {
    setFlyChip(null);
    setParticleBurst(null);
  }, [sceneIndex]);

  const allPagesComplete = useMemo(
    () => states.every((st, idx) => isPageComplete(st, SCENES[idx].lyrics.length)),
    [states]
  );

  const persistedTrailsDeduped = useMemo(() => {
    const seen = new Set();
    const list = [];
    for (const row of state.notationTrails) {
      for (const t of row) {
        if (t && !seen.has(t)) {
          seen.add(t);
          list.push(t);
        }
      }
    }
    return list;
  }, [state.notationTrails]);

  const closeFullSheet = useCallback(() => {
    stopAllPlaybackAndResetUI();
    setFullSheetOpen(false);
  }, [stopAllPlaybackAndResetUI]);

  useEffect(() => {
    if (!fullSheetOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeFullSheet();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullSheetOpen, closeFullSheet]);

  useEffect(() => {
    const stop = (e) => e.preventDefault();
    document.addEventListener("contextmenu", stop, { capture: true });
    document.addEventListener("selectstart", stop, { capture: true });
    document.addEventListener("dragstart", stop, { capture: true });
    return () => {
      document.removeEventListener("contextmenu", stop, { capture: true });
      document.removeEventListener("selectstart", stop, { capture: true });
      document.removeEventListener("dragstart", stop, { capture: true });
    };
  }, []);

  const palette = useMemo(() => scene.palette, [scene]);
  const { left: ladderLeft, right: ladderRight } = scene.pairLadders;
  const flyEntry = flyChip ? findEntry(palette, flyChip.noteId) : null;

  return (
    <div
      className="app"
      style={{
        "--app-bg": `url(${import.meta.env.BASE_URL}imgs/imgs.png)`,
      }}
    >
      <div className="stage">
        <section
          className="scene-card"
          aria-label="作曲"
          onPointerDownCapture={onScenePointerDownCapture}
        >
          <h1 className="scene-card__title">作曲</h1>

          <div className="scene-card__middle">
            <div ref={notationAreaRef} className="notation-area" onPointerDown={onNotationPointerDown}>
              {persistedTrailsDeduped.map((tr, i) => (
                <NotationTrailSvg
                  key={"pt-" + i + "-" + tr.w + "-" + tr.h + "-" + tr.points.length + "-" + (tr.points[0]?.x ?? 0)}
                  trail={tr}
                  className="notation-trail notation-trail--persisted"
                />
              ))}
              {strokeTrail && (
                <NotationTrailSvg trail={strokeTrail} className="notation-trail notation-trail--live" />
              )}
              <div className="notation-pair" aria-label="简谱两列">
                <NotationPairRows left={ladderLeft} right={ladderRight} onPick={addNote} />
              </div>
            </div>
            <LyricStrip
              lyrics={scene.lyrics}
              lyricTones={scene.lyricTones ?? []}
              selections={state.selections}
              lineRhythm={state.lineRhythm}
              currentIndex={state.currentIndex}
              palette={palette}
              flyChip={flyChip}
              lyricPickedRefs={lyricPickedRefs}
              phraseCharsPerLine={LYRIC_CHARS_PER_PHRASE}
              onFocusLyricIndex={focusLyricIndex}
            />
          </div>

          <footer className="actions">
            {allPagesComplete && (
              <button type="button" className="btn-secondary" onClick={() => setFullSheetOpen(true)}>
                生成总谱
              </button>
            )}
            {pageComplete && (
              <button
                type="button"
                className="btn-secondary"
                disabled={audioPlaybackBusy && !pagePreviewPlaying}
                onClick={() => void playCurrentPageMelody()}
              >
                {pagePreviewPlaying ? "播放中…" : "试听本页"}
              </button>
            )}
            <button type="button" className="btn-secondary" onClick={deleteLast}>
              删除
            </button>
            <button type="button" className="btn-primary" onClick={confirm}>
              选择完成
            </button>
          </footer>
        </section>

        <nav className="scene-nav scene-nav--below" aria-label="页切换">
          <button type="button" className="btn-ghost" onClick={() => goScene(-1)}>
            上一页
          </button>
          <span className="scene-nav__label">
            第 {sceneIndex + 1} 页 / 共 {SCENES.length} 页
          </span>
          <button type="button" className="btn-ghost" onClick={() => goScene(1)}>
            下一页
          </button>
        </nav>
      </div>

      {fullSheetOpen && (
        <FullSheetModal
          onClose={closeFullSheet}
          states={states}
          allPagesComplete={allPagesComplete}
          audioPlaybackBusy={audioPlaybackBusy}
          allMelodyPlaying={allMelodyPlaying}
          fullSheetPlayingPage={fullSheetPlayingPage}
          onPlayAll={playAllMelody}
          onPlayPage={playFullSheetPageAt}
        />
      )}

      <div
        className={"toast" + (toast.show ? " toast--show" : "")}
        role="status"
        aria-live="polite"
      >
        {toast.msg}
      </div>

      {flyChip && flyEntry && (
        <FlyChipOverlay
          key={flyChip.key}
          fromRect={flyChip.fromRect}
          toRect={flyChip.toRect}
          entry={flyEntry}
          onDone={clearFlyChip}
        />
      )}
      {particleBurst && (
        <ParticleBurstOverlay key={particleBurst.key} rect={particleBurst.rect} burstKey={particleBurst.key} />
      )}
    </div>
  );
}
