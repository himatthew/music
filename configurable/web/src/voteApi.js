const API = "/api/v1";

/** 与后端 repository 中 scoreStandardInlinePrefix 一致 */
export const SCORE_STANDARD_INLINE_PREFIX = "inline:";

/** 解析库存的评分标准：文字（inline:）或图片 URL */
export function parseScoreStandardStored(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return { text: "", imageUrl: "" };
  if (s.startsWith(SCORE_STANDARD_INLINE_PREFIX)) {
    return { text: s.slice(SCORE_STANDARD_INLINE_PREFIX.length), imageUrl: "" };
  }
  return { text: "", imageUrl: s };
}

/** 文字优先；无文字时用图片 URL（站内路径或 http(s)） */
export function buildScoreStandardStored(text, imageUrl) {
  const t = String(text ?? "").trim();
  if (t) return SCORE_STANDARD_INLINE_PREFIX + t;
  return String(imageUrl ?? "").trim();
}

/** 与后端 repository.VoteAspectPick 一致，勾选模式提交用 */
export const VOTE_ASPECT_PICK = "__pick__";

/** 各段 options 长度前缀和，用于将全局 groupIndex 映射到段内 */
export function cumulativeSectionEnds(sections) {
  if (!Array.isArray(sections) || sections.length === 0) return [];
  let n = 0;
  return sections.map((s) => {
    const c = Array.isArray(s.options) ? s.options.length : 0;
    n += c;
    return n;
  });
}

/** 从投票状态对象解析段列表（新接口 sections；否则由扁平 options + optionsHeadings 合成一段） */
export function voteSectionsFromPayload(payload) {
  if (!payload) return [];
  if (Array.isArray(payload.sections) && payload.sections.length > 0) {
    const arr = Array.isArray(payload.optionsHeadings) ? payload.optionsHeadings : [];
    const texts = arr.map((h) => String(h ?? "").trim()).filter(Boolean);
    const fallbackSingle =
      texts.length > 1 ? texts.join("\n\n") : texts[0] || String(payload.optionsHeading ?? "").trim();
    return payload.sections.map((s) => {
      let heading = String(s.heading ?? "").trim();
      // 单段且段内未存题面时，用旧版顶栏题面（与星级「仅一段」时管理员填的文案一致）
      if (!heading && payload.sections.length === 1 && fallbackSingle) heading = fallbackSingle;
      return {
        heading,
        options: Array.isArray(s.options) ? s.options : [],
      };
    });
  }
  const opts = Array.isArray(payload.options) ? payload.options : [];
  const arr = Array.isArray(payload.optionsHeadings) ? payload.optionsHeadings : [];
  const texts = arr.map((h) => String(h ?? "").trim()).filter(Boolean);
  const heading =
    texts.length > 1 ? texts.join("\n\n") : texts[0] || String(payload.optionsHeading ?? "").trim() || "";
  return [{ heading, options: opts }];
}

function attachDerivedVoteFields(j) {
  if (!j || typeof j !== "object") return j;
  if (
    j &&
    typeof j.optionsHeading === "string" &&
    j.optionsHeading.trim() &&
    !(Array.isArray(j.optionsHeadings) && j.optionsHeadings.length)
  ) {
    j.optionsHeadings = [j.optionsHeading.trim()];
  }
  if (!Array.isArray(j.sections) || j.sections.length === 0) {
    j.sections = voteSectionsFromPayload(j);
  }
  return j;
}

/** 候选项展示文案：优先 label，与后端一致；旧数据仅有 title 时回退到 title */
export function voteOptionLabel(opt) {
  if (opt == null) return "";
  if (typeof opt === "string") return String(opt).trim();
  const lab = String(opt.label ?? "").trim();
  if (lab) return lab;
  return String(opt.title ?? "").trim();
}

/** 兼容旧数据：有 title 且无 label 时退回 title */
export function voteOptionTitle(opt) {
  if (opt == null) return "";
  if (typeof opt === "string") return String(opt).trim();
  const t = String(opt.title ?? "").trim();
  return t || voteOptionLabel(opt);
}

function normSessionId(sessionId) {
  const s = String(sessionId ?? "default").trim().toLowerCase();
  return s || "default";
}

export async function getVoteState(deviceId, sessionId = "default") {
  const q = new URLSearchParams();
  if (deviceId) q.set("deviceId", deviceId);
  const sid = normSessionId(sessionId);
  if (sid !== "default") q.set("sessionId", sid);
  const qs = q.toString();
  const r = await fetch(`${API}/vote${qs ? `?${qs}` : ""}`);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg =
      j.error ||
      (r.status === 404
        ? "接口 404：请确认已启动投票 API（cd configurable/server && go run ./cmd/api，默认 :8080），前端在 configurable/web 执行 npm run dev 以代理 /api"
        : r.statusText || "load failed");
    const err = new Error(msg);
    err.status = r.status;
    throw err;
  }
  return attachDerivedVoteFields(j);
}

export async function postVoteRatings({ deviceId, ratings }, sessionId = "default") {
  const q = new URLSearchParams();
  const sid = normSessionId(sessionId);
  if (sid !== "default") q.set("sessionId", sid);
  const qs = q.toString();
  const r = await fetch(`${API}/vote/ballots${qs ? `?${qs}` : ""}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId, ratings }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || r.statusText || "vote failed");
  return j;
}

export async function postVoteLock(locked, adminSecret, sessionId = "default") {
  const q = new URLSearchParams();
  const sid = normSessionId(sessionId);
  if (sid !== "default") q.set("sessionId", sid);
  const qs = q.toString();
  const r = await fetch(`${API}/vote/lock${qs ? `?${qs}` : ""}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Vote-Admin": adminSecret,
    },
    body: JSON.stringify({ locked }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || r.statusText || "lock failed");
  return j;
}

export async function clearVoteBallots(adminSecret, sessionId = "default") {
  const q = new URLSearchParams();
  const sid = normSessionId(sessionId);
  if (sid !== "default") q.set("sessionId", sid);
  const qs = q.toString();
  const r = await fetch(`${API}/vote/ballots${qs ? `?${qs}` : ""}`, {
    method: "DELETE",
    headers: { "X-Vote-Admin": adminSecret },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || r.statusText || "clear failed");
  return j;
}

/** 大屏端锁定/解锁，无需管理密钥 */
export async function postVoteDisplayLock(locked, sessionId = "default") {
  const q = new URLSearchParams();
  const sid = normSessionId(sessionId);
  if (sid !== "default") q.set("sessionId", sid);
  const qs = q.toString();
  const r = await fetch(`${API}/vote/display/lock${qs ? `?${qs}` : ""}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locked }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || r.statusText || "lock failed");
  return j;
}

/** 大屏端清空投票，无需管理密钥 */
export async function clearVoteDisplayBallots(sessionId = "default") {
  const q = new URLSearchParams();
  const sid = normSessionId(sessionId);
  if (sid !== "default") q.set("sessionId", sid);
  const qs = q.toString();
  const r = await fetch(`${API}/vote/display/ballots${qs ? `?${qs}` : ""}`, {
    method: "DELETE",
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || r.statusText || "clear failed");
  return j;
}

export function voteWebSocketUrl(sessionId = "default") {
  const proto = typeof location !== "undefined" && location.protocol === "https:" ? "wss:" : "ws:";
  const host = typeof location !== "undefined" ? location.host : "";
  const q = new URLSearchParams();
  const sid = normSessionId(sessionId);
  if (sid !== "default") q.set("sessionId", sid);
  const qs = q.toString();
  return `${proto}//${host}/api/v1/vote/ws${qs ? `?${qs}` : ""}`;
}

export async function listVoteSessions() {
  const r = await fetch(`${API}/vote/sessions`);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || r.statusText || "list failed");
  return j.sessions ?? [];
}

/** 获取可编辑配置（需会场管理密钥） */
export async function getVoteSessionConfig(adminSecret, sessionId = "default") {
  const q = new URLSearchParams();
  const sid = normSessionId(sessionId);
  if (sid !== "default") q.set("sessionId", sid);
  const qs = q.toString();
  const r = await fetch(`${API}/vote/session-config${qs ? `?${qs}` : ""}`, {
    headers: { "X-Vote-Admin": adminSecret },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || r.statusText || "load failed");
  return j;
}

/** 更新会场（需管理密钥）；已有投票时仅服务端应用标题与评分标准 URL */
export async function updateVoteSession(body, adminSecret, sessionId = "default") {
  const q = new URLSearchParams();
  const sid = normSessionId(sessionId);
  if (sid !== "default") q.set("sessionId", sid);
  const qs = q.toString();
  const r = await fetch(`${API}/vote/sessions${qs ? `?${qs}` : ""}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Vote-Admin": adminSecret },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || r.statusText || "update failed");
  return j;
}

export async function uploadVoteScoreStandard(file, adminSecret, sessionId = "default") {
  const fd = new FormData();
  const raw = file?.originFileObj ?? file;
  fd.append("file", raw);
  const q = new URLSearchParams();
  const sid = normSessionId(sessionId);
  if (sid !== "default") q.set("sessionId", sid);
  const qs = q.toString();
  const r = await fetch(`${API}/vote/score-standard/upload${qs ? `?${qs}` : ""}`, {
    method: "POST",
    headers: { "X-Vote-Admin": adminSecret },
    body: fd,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || r.statusText || "upload failed");
  return j;
}

export async function putVoteScoreStandard(scoreStandardUrl, adminSecret, sessionId = "default") {
  const q = new URLSearchParams();
  const sid = normSessionId(sessionId);
  if (sid !== "default") q.set("sessionId", sid);
  const qs = q.toString();
  const r = await fetch(`${API}/vote/score-standard${qs ? `?${qs}` : ""}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Vote-Admin": adminSecret,
    },
    body: JSON.stringify({ scoreStandardUrl: scoreStandardUrl ?? "" }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || r.statusText || "update failed");
  return j;
}

export async function createVoteSession(body) {
  const r = await fetch(`${API}/vote/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || r.statusText || "create failed");
  return j;
}

export async function deleteVoteSession(adminSecret, sessionId) {
  const q = new URLSearchParams();
  const sid = normSessionId(sessionId);
  if (sid === "default") throw new Error("不可删除默认会场");
  q.set("sessionId", sid);
  const r = await fetch(`${API}/vote/sessions?${q.toString()}`, {
    method: "DELETE",
    headers: { "X-Vote-Admin": adminSecret },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || r.statusText || "delete failed");
  return j;
}
