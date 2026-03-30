import { flushSync } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import "./App.css";

/**
 * 满 2 个音符后不再追加，需先删除。
 * pairLadders：左右两列按音高对齐同行；pick 大号青色、hint 小号灰色，均可点；id 可省略，由 resolveNoteId 推断。
 */
/** 每句字数，用于歌词行两句之间的视觉分隔 */
const LYRIC_CHARS_PER_PHRASE = 4;

/** 第一页 = 清晨阳光洒在田野，第二页 = 微风轻拂叶尖摇（与原顺序对调） */
const SCENES = [
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
        { role: "hint", id: "L7", t: "7", low: true },
        { role: "pick", id: "L6", t: "6", low: true },
      ],
      right: [
        { role: "pick", id: "4", t: "4" },
        { role: "hint", id: "3", t: "3" },
        { role: "hint", id: "2", t: "2" },
        { role: "pick", id: "1", t: "1" },
        { role: "hint", id: "L7", t: "7", low: true },
        { role: "pick", id: "L6", t: "6", low: true },
      ],
    },
  },
];

function emptySelections(len) {
  return Array.from({ length: len }, () => []);
}

function emptyLineRhythm(len) {
  return Array.from({ length: len }, () => false);
}

/** 左右同音高共用 data-note-id，划线需用 data-stroke-key 区分格位 */
function pickLadderHitFromPoint(clientX, clientY) {
  /* 优先矩形命中：不依赖 elementsFromPoint 穿透轨迹 SVG / 触屏栈不完整，避免选不中 */
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

/** 简谱纵轴：高音 → 低音（与 SCENES 中自上而下书写顺序一致） */
const PITCH_ROW_ORDER = ["5", "4", "3", "2", "1", "7", "L7", "L6"];

function pitchRowIdsFromSides(left, right) {
  const ids = new Set();
  for (const seg of left) ids.add(resolveNoteId(seg));
  for (const seg of right) ids.add(resolveNoteId(seg));
  return Array.from(ids).sort((a, b) => {
    const ia = PITCH_ROW_ORDER.indexOf(a);
    const ib = PITCH_ROW_ORDER.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
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

function isPageComplete(st, lyricsLen) {
  return st.selections.length === lyricsLen && st.selections.every((a) => a.length > 0);
}

/** 总谱 / 预览：与主界面相同的双音/节奏/低音点布局（无飞入） */
function LyricPickedDisplay({ sel, lineRhythm, palette }) {
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
  if (pair) {
    return (
      <div className="lyric-cell__picked lyric-cell__picked--pair">
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
  return (
    <div className="lyric-cell__picked">
      {sel.map((nid, j) => (
        <span key={j + "-" + nid} className="picked__n">
          <NoteGlyph entry={findEntry(palette, nid)} />
        </span>
      ))}
    </div>
  );
}

function LadderRow({ seg, onPick, side }) {
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

/** 按音高分行：同一音级（如 3）左右必在同一水平线；缺的一侧占位 */
function NotationPairRows({ left, right, onPick }) {
  const rowIds = pitchRowIdsFromSides(left, right);
  return rowIds.map((id) => {
    const leftSeg = left.find((s) => resolveNoteId(s) === id) ?? null;
    const rightSeg = right.find((s) => resolveNoteId(s) === id) ?? null;
    return (
      <div key={id} className="notation-pair__row">
        <div className="notation-pair__cell">
          {leftSeg ? <LadderRow seg={leftSeg} side="left" onPick={onPick} /> : <div className="notation-pair__cell--empty" aria-hidden />}
        </div>
        <div className="notation-pair__cell">
          {rightSeg ? <LadderRow seg={rightSeg} side="right" onPick={onPick} /> : <div className="notation-pair__cell--empty" aria-hidden />}
        </div>
      </div>
    );
  });
}

export default function App() {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [states, setStates] = useState(() =>
    SCENES.map((s) => ({
      currentIndex: 0,
      selections: emptySelections(s.lyrics.length),
      lineRhythm: emptyLineRhythm(s.lyrics.length),
    }))
  );
  const [toast, setToast] = useState({ show: false, msg: "" });
  const toastTimerRef = useRef(0);
  const lyricPickedRefs = useRef([]);
  const notationAreaRef = useRef(null);
  const strokeRef = useRef(null);
  const suppressClickRef = useRef(false);
  const deleteTimerRef = useRef(0);
  const [flyChip, setFlyChip] = useState(null);
  const [particleBurst, setParticleBurst] = useState(null);
  /** 简谱区划线轨迹（相对 notation-area 的局部坐标） */
  const [strokeTrail, setStrokeTrail] = useState(null);
  const [fullSheetOpen, setFullSheetOpen] = useState(false);

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
          lineRhythm: [...x.lineRhythm],
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
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        return;
      }
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
          st.lineRhythm[i] = false;
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

  const applyLineStroke = useCallback(
    (firstId, lastId, fromClientX, fromClientY, lastStrokeKey) => {
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
        if (a.length < 2) st.lineRhythm[i] = false;
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

  useEffect(() => {
    if (!fullSheetOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setFullSheetOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullSheetOpen]);

  /** 触控长按：contextmenu / 文本选中 / 拖拽 在部分系统仍会出菜单或选区 */
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

  /** 不在父级 setPointerCapture，否则按钮收不到 click。划线用 document 捕获阶段跟踪整段手势。 */
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
        areaRect != null
          ? { x: e.clientX - areaRect.left, y: e.clientY - areaRect.top }
          : null;
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

      /* 整行（含数字后虚线）捕获指针；仅在按钮上捕获时，点在虚线上会失败 */
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
            applyLineStroke(firstId, lastId, s.lastClientX, s.lastClientY, lastKey);
          }
          return;
        }
        if (s.visitedKeys.length === 1 && moved) {
          ev.preventDefault();
          ev.stopPropagation();
          addNote(s.startNoteId, { currentTarget: s.startButton });
          suppressClickRef.current = true;
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
    [applyLineStroke, addNote]
  );

  const palette = useMemo(() => scene.palette, [scene]);
  const { left: ladderLeft, right: ladderRight } = scene.pairLadders;
  const flyEntry = flyChip ? findEntry(palette, flyChip.noteId) : null;

  const allPagesComplete = useMemo(
    () => states.every((st, idx) => isPageComplete(st, SCENES[idx].lyrics.length)),
    [states]
  );

  return (
    <div
      className="app"
      style={{
        "--app-bg": `url(${import.meta.env.BASE_URL}imgs/imgs.png)`,
      }}
    >
      <div className="stage">
        <section className="scene-card" aria-label="作曲">
          <h1 className="scene-card__title">作曲</h1>

          <div className="scene-card__middle">
            <div ref={notationAreaRef} className="notation-area" onPointerDown={onNotationPointerDown}>
              {strokeTrail &&
                strokeTrail.points.length > 0 &&
                strokeTrail.w > 0 &&
                strokeTrail.h > 0 && (
                  <svg
                    className="notation-trail"
                    aria-hidden
                    fill="none"
                    viewBox={"0 0 " + strokeTrail.w + " " + strokeTrail.h}
                    preserveAspectRatio="none"
                  >
                    {strokeTrail.points.length === 1 ? (
                      <circle
                        cx={strokeTrail.points[0].x}
                        cy={strokeTrail.points[0].y}
                        r="5"
                        fill="var(--demo-cyan)"
                        fillOpacity="0.75"
                      />
                    ) : (
                      <polyline
                        fill="none"
                        stroke="var(--demo-cyan)"
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeOpacity="0.88"
                        points={strokeTrail.points.map((p) => p.x + "," + p.y).join(" ")}
                      />
                    )}
                  </svg>
                )}
              <div className="notation-pair" aria-label="简谱两列">
                <NotationPairRows left={ladderLeft} right={ladderRight} onPick={addNote} />
              </div>
            </div>
            <div className="lyric-strip">
              <div className="lyric-row">
                {scene.lyrics.map((ch, i) => {
                  const sel = state.selections[i];
                  const showRhythm = state.lineRhythm[i] && sel.length === 2;
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
                        className="lyric-cell__picked-wrap"
                        ref={(el) => {
                          lyricPickedRefs.current[i] = el;
                        }}
                      >
                        {(() => {
                          const pair = sel.length === 2;
                          const stacked = pair && showRhythm;
                          const hide = (j) =>
                            flyChip &&
                            flyChip.lyricRowIndex === i &&
                            flyChip.pickedSlotIndex === j;
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
                                            "picked__n picked__n--sheet" +
                                            (hide(j) ? " picked__n--fly-hidden" : "")
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
                                          className={
                                            "picked__n" + (hide(j) ? " picked__n--fly-hidden" : "")
                                          }
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
                                    className={
                                      "picked__n" + (hide(j) ? " picked__n--fly-hidden" : "")
                                    }
                                  >
                                    <NoteGlyph entry={entry} />
                                  </span>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                      <span className="lyric-cell__char">{ch}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <footer className="actions">
            {allPagesComplete && (
              <button type="button" className="btn-secondary" onClick={() => setFullSheetOpen(true)}>
                生成总谱
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
        <div
          className="full-sheet-overlay"
          role="presentation"
          onClick={() => setFullSheetOpen(false)}
        >
          <div
            className="full-sheet-modal"
            role="dialog"
            aria-modal="true"
            aria-label="完整歌谱"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="full-sheet-head">
              <h2 className="full-sheet-title">完整歌谱</h2>
              <button type="button" className="full-sheet-close" onClick={() => setFullSheetOpen(false)}>
                关闭
              </button>
            </div>
            <div className="full-sheet-body">
              {SCENES.map((pg, pi) => {
                const st = states[pi];
                return (
                  <section key={pg.id} className="full-sheet-page">
                    <h3 className="full-sheet-page-title">第 {pi + 1} 页</h3>
                    <div className="full-sheet-lyric-row">
                      {pg.lyrics.map((ch, i) => {
                        const sel = st.selections[i];
                        const lr = st.lineRhythm[i];
                        return (
                          <div
                            key={i}
                            className={
                              "full-sheet-cell" +
                              (i > 0 && i % LYRIC_CHARS_PER_PHRASE === 0
                                ? " full-sheet-cell--bar"
                                : "")
                            }
                          >
                            <div className="lyric-cell__picked-wrap">
                              <LyricPickedDisplay sel={sel} lineRhythm={lr} palette={pg.palette} />
                            </div>
                            <span className="lyric-cell__char">{ch}</span>
                          </div>
                        );
                      })}
                      {pi === 1 ? (
                        <div className="full-sheet-cell full-sheet-cell--tail-zero" aria-hidden>
                          <div className="lyric-cell__picked-wrap">
                            <span className="full-sheet-trailing-zero">0</span>
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
