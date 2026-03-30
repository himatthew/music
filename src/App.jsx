import { flushSync } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import "./App.css";

/**
 * 满 2 个音符后不再追加，需先删除。
 * pairLadders：左右两列均分；pick 大号青色、hint 小号灰色，均可点；id 可省略，由 resolveNoteId 推断。
 */
/** 每句字数，用于歌词行两句之间的视觉分隔 */
const LYRIC_CHARS_PER_PHRASE = 4;

const SCENES = [
  {
    id: "s1",
    lyrics: ["微", "风", "轻", "拂", "叶", "尖", "摇"],
    palette: [
      { id: "1", t: "1" },
      { id: "2", t: "2" },
      { id: "3", t: "3" },
      { id: "4", t: "4" },
      { id: "5", t: "5" },
      { id: "6", t: "6" },
      { id: "7", t: "7" },
      { id: "L7", t: "7", low: true },
      { id: "L6", t: "6", low: true },
    ],
    pairLadders: {
      left: [
        { role: "pick", id: "3", t: "3" },
        { role: "hint", id: "2", t: "2" },
        { role: "pick", id: "1", t: "1" },
        { role: "hint", id: "7", t: "7" },
        { role: "pick", id: "L6", t: "6", low: true },
      ],
      right: [
        { role: "pick", id: "4", t: "4" },
        { role: "hint", id: "3", t: "3" },
        { role: "hint", id: "2", t: "2" },
        { role: "pick", id: "1", t: "1" },
        { role: "hint", id: "7", t: "7" },
        { role: "pick", id: "L6", t: "6", low: true },
      ],
    },
  },
  {
    id: "s2",
    lyrics: ["清", "晨", "阳", "光", "洒", "在", "田", "野"],
    palette: [
      { id: "1", t: "1" },
      { id: "2", t: "2" },
      { id: "3", t: "3" },
      { id: "4", t: "4" },
      { id: "5", t: "5" },
      { id: "6", t: "6" },
      { id: "7", t: "7" },
      { id: "L7", t: "7", low: true },
      { id: "L6", t: "6", low: true },
    ],
    pairLadders: {
      left: [
        { role: "pick", id: "5", t: "5" },
        { role: "hint", id: "4", t: "4" },
        { role: "pick", id: "3", t: "3" },
        { role: "hint", id: "2", t: "2" },
        { role: "pick", id: "1", t: "1" },
      ],
      right: [
        { role: "pick", id: "5", t: "5" },
        { role: "hint", id: "4", t: "4" },
        { role: "hint", id: "3", t: "3" },
        { role: "pick", id: "2", t: "2" },
        { role: "hint", id: "1", t: "1" },
        { role: "pick", id: "L7", t: "7", low: true },
      ],
    },
  },
];

function emptySelections(len) {
  return Array.from({ length: len }, () => []);
}

function findEntry(palette, id) {
  return palette.find((p) => p.id === id) ?? null;
}

/** 保证每条简谱都能映射到 palette id；灰色 hint 未写 id 时按音高自动推断 */
function resolveNoteId(seg) {
  if (seg.id != null && seg.id !== "") return seg.id;
  const t = String(seg.t);
  if (seg.low) {
    if (t === "7") return "L7";
    if (t === "6") return "L6";
  }
  return t;
}

function NoteGlyph({ entry, className }) {
  if (!entry) return null;
  if (entry.low) {
    return (
      <span className={"note-glyph note-glyph--low " + (className || "")}>
        <span className="note-glyph__num">{entry.t}</span>
        <span className="note-glyph__dot" aria-hidden />
      </span>
    );
  }
  return <span className={"note-glyph " + (className || "")}>{entry.t}</span>;
}

function LadderRow({ seg, onPick }) {
  const noteId = resolveNoteId(seg);
  const entry = { id: noteId, t: seg.t, low: !!seg.low };
  const isPick = seg.role === "pick";
  return (
    <div className={"ladder-line " + (isPick ? "ladder-line--pick" : "ladder-line--hint")}>
      <div className="ladder-line__num-wrap">
        <button
          type="button"
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

function FlyChipOverlay({ fromRect, toRect, entry, onDone }) {
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

function ParticleBurstOverlay({ rect, burstKey }) {
  const bits = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => {
        const angle = (Math.PI * 2 * i) / 40 + Math.random() * 0.6;
        const dist = 38 + Math.random() * 95;
        return {
          tx: Math.cos(angle) * dist,
          ty: Math.sin(angle) * dist,
          size: 3 + Math.random() * 5,
          delay: Math.random() * 0.05,
          rot: Math.random() * 360,
        };
      }),
    [burstKey]
  );

  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  return (
    <div className="particle-burst" style={{ left: cx, top: cy }} aria-hidden>
      {bits.map((b, i) => (
        <span
          key={i}
          className="particle-burst__bit"
          style={{
            "--tx": `${b.tx}px`,
            "--ty": `${b.ty}px`,
            "--rot": `${b.rot}deg`,
            width: b.size,
            height: b.size,
            animationDelay: `${b.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

function NotationColumn({ segments, onPick }) {
  return (
    <div className="notation-col">
      <div className="notation-col__stack">
        {segments.map((seg, k) => (
          <LadderRow key={k} seg={seg} onPick={onPick} />
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [states, setStates] = useState(() =>
    SCENES.map((s) => ({
      currentIndex: 0,
      selections: emptySelections(s.lyrics.length),
    }))
  );
  const [toast, setToast] = useState({ show: false, msg: "" });
  const toastTimerRef = useRef(0);
  const lyricPickedRefs = useRef([]);
  const deleteTimerRef = useRef(0);
  const [flyChip, setFlyChip] = useState(null);
  const [particleBurst, setParticleBurst] = useState(null);

  const scene = SCENES[sceneIndex];
  const state = states[sceneIndex];

  const showToast = useCallback((msg) => {
    setToast({ show: true, msg });
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast({ show: false, msg: "" }), 2200);
  }, []);

  const setCurrent = useCallback((updater) => {
    setStates((prev) => {
      const next = prev.map((x, i) => {
        if (i !== sceneIndex) return x;
        return {
          currentIndex: x.currentIndex,
          selections: x.selections.map((a) => [...a]),
        };
      });
      const st = { ...next[sceneIndex] };
      updater(st);
      next[sceneIndex] = st;
      return next;
    });
  }, [sceneIndex]);

  const addNote = useCallback(
    (id, e) => {
      const idx = state.currentIndex;
      if (state.selections[idx].length >= 2) return;
      const pickedSlotIndex = state.selections[idx].length;
      const fromRect = e?.currentTarget?.getBoundingClientRect?.();
      flushSync(() => {
        setCurrent((st) => {
          const i = st.currentIndex;
          const arr = st.selections[i];
          if (arr.length >= 2) return;
          arr.push(id);
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
    [setCurrent, state.currentIndex, state.selections]
  );

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
    window.clearTimeout(deleteTimerRef.current);
    const container = lyricPickedRefs.current[idx];
    const lastSpan = container?.querySelector(".picked__n:last-child");
    const rect = lastSpan?.getBoundingClientRect();
    flushSync(() => {
      setCurrent((st) => {
        const i = st.currentIndex;
        const a = st.selections[i];
        if (a.length) a.pop();
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
  }, [setCurrent, state.currentIndex, state.selections]);

  const confirm = useCallback(() => {
    const idx = state.currentIndex;
    if (idx >= scene.lyrics.length - 1) {
      showToast("本场景已完成");
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
        <section className="scene-card" aria-label="作曲场景">
          <h1 className="scene-card__title">作曲</h1>

          <div className="scene-card__middle">
            <div className="notation-area">
              <div className="notation-pair" aria-label="简谱两列">
                <NotationColumn segments={ladderLeft} onPick={addNote} />
                <NotationColumn segments={ladderRight} onPick={addNote} />
              </div>
            </div>
            <div className="lyric-strip">
              <div className="lyric-row">
                {scene.lyrics.map((ch, i) => {
                  const sel = state.selections[i];
                  const isCurrent = i === state.currentIndex;
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
                        (i > 0 && i % LYRIC_CHARS_PER_PHRASE === 0 ? " lyric-cell--phrase-start" : "")
                      }
                      onClick={() => focusLyricIndex(i)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          focusLyricIndex(i);
                        }
                      }}
                    >
                      <div
                        className="lyric-cell__picked"
                        ref={(el) => {
                          lyricPickedRefs.current[i] = el;
                        }}
                      >
                        {sel.map((nid, j) => {
                          const entry = findEntry(palette, nid);
                          const hideForFly =
                            flyChip &&
                            flyChip.lyricRowIndex === i &&
                            flyChip.pickedSlotIndex === j;
                          return (
                            <span
                              key={j + "-" + nid}
                              className={"picked__n" + (hideForFly ? " picked__n--fly-hidden" : "")}
                            >
                              <NoteGlyph entry={entry} />
                            </span>
                          );
                        })}
                      </div>
                      <span className="lyric-cell__char">{ch}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <footer className="actions">
            <button type="button" className="btn-secondary" onClick={deleteLast}>
              删除
            </button>
            <button type="button" className="btn-primary" onClick={confirm}>
              选择完成
            </button>
          </footer>
        </section>

        <nav className="scene-nav scene-nav--below" aria-label="场景切换">
          <button type="button" className="btn-ghost" onClick={() => goScene(-1)}>
            上一场景
          </button>
          <span className="scene-nav__label">
            场景 {sceneIndex + 1} / {SCENES.length}
          </span>
          <button type="button" className="btn-ghost" onClick={() => goScene(1)}>
            下一场景
          </button>
        </nav>
      </div>

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
