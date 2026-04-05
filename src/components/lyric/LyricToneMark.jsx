/** 普通话声调示意（1–4 声 + 5 轻声实心圆），描色用 currentColor */

export function LyricToneLine({ tone }) {
  const t = Number(tone);
  if (t < 1 || t > 5) return null;
  const common = {
    className: "lyric-tone-line__svg",
    viewBox: "0 0 40 18",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    "aria-hidden": true,
  };
  const stroke = "currentColor";

  if (t === 1) {
    return (
      <svg {...common}>
        <path d="M 3 10 L 37 10" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }
  if (t === 2) {
    return (
      <svg {...common}>
        <path d="M 3 14 L 37 4" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }
  if (t === 3) {
    return (
      <svg {...common}>
        <path
          d="M 3 3 L 20 15 L 37 3"
          stroke={stroke}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (t === 4) {
    return (
      <svg {...common}>
        <path d="M 3 4 L 37 14" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg className="lyric-tone-line__svg" viewBox="0 0 40 18" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="20" cy="9" r="5.5" fill="currentColor" />
    </svg>
  );
}
