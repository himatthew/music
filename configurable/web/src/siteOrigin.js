export function siteOrigin() {
  if (typeof window === "undefined") return "";
  return window.location.origin.replace(/\/$/, "");
}

export function votePath(sessionId) {
  const sid = String(sessionId ?? "default").trim().toLowerCase();
  if (!sid || sid === "default") return "/vote";
  return `/vote/${encodeURIComponent(sid)}`;
}

export function voteDisplayPath(sessionId) {
  const sid = String(sessionId ?? "default").trim().toLowerCase();
  if (!sid || sid === "default") return "/vote-display";
  return `/vote-display/${encodeURIComponent(sid)}`;
}

export function voteAbsoluteUrl(sessionId) {
  return `${siteOrigin()}${votePath(sessionId)}`;
}

export function voteDisplayAbsoluteUrl(sessionId) {
  return `${siteOrigin()}${voteDisplayPath(sessionId)}`;
}
