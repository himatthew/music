import { useMemo } from "react";

export function ParticleBurstOverlay({ rect, burstKey }) {
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
