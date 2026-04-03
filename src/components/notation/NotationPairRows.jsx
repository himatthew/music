import { LadderRow } from "./LadderRow.jsx";
import { pitchRowIdsFromSides, resolveNoteId } from "../../lib/notePalette.js";

/** 按音高分行：同一音级（如 3）左右必在同一水平线；缺的一侧占位 */
export function NotationPairRows({ left, right, onPick }) {
  const rowIds = pitchRowIdsFromSides(left, right);
  return rowIds.map((id) => {
    const leftSeg = left.find((s) => resolveNoteId(s) === id) ?? null;
    const rightSeg = right.find((s) => resolveNoteId(s) === id) ?? null;
    return (
      <div key={id} className="notation-pair__row">
        <div className="notation-pair__cell">
          {leftSeg ? (
            <LadderRow seg={leftSeg} side="left" onPick={onPick} />
          ) : (
            <div className="notation-pair__cell--empty" aria-hidden />
          )}
        </div>
        <div className="notation-pair__cell">
          {rightSeg ? (
            <LadderRow seg={rightSeg} side="right" onPick={onPick} />
          ) : (
            <div className="notation-pair__cell--empty" aria-hidden />
          )}
        </div>
      </div>
    );
  });
}
