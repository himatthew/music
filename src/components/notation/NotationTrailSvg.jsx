export function NotationTrailSvg({ trail, className }) {
  if (!trail?.points?.length || trail.w <= 0 || trail.h <= 0) return null;
  return (
    <svg
      className={className || "notation-trail"}
      aria-hidden
      fill="none"
      viewBox={"0 0 " + trail.w + " " + trail.h}
      preserveAspectRatio="none"
    >
      {trail.points.length === 1 ? (
        <circle
          cx={trail.points[0].x}
          cy={trail.points[0].y}
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
          points={trail.points.map((p) => p.x + "," + p.y).join(" ")}
        />
      )}
    </svg>
  );
}
