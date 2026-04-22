import { App, Alert, Button, Checkbox, Radio, Rate, Spin, Table, Typography } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  cumulativeSectionEnds,
  getVoteState,
  parseScoreStandardStored,
  postVoteRatings,
  voteOptionLabel,
  voteSectionsFromPayload,
  voteWebSocketUrl,
  VOTE_ASPECT_PICK,
} from "./voteApi.js";
import { useVotePageBranding } from "./hooks/useVotePageBranding.js";

const DEVICE_KEY = "vote_device_id";

function partitionPickedBySections(picked, ends) {
  const buckets = ends.map(() => []);
  for (let si = 0; si < ends.length; si++) {
    const lo = si === 0 ? 0 : ends[si - 1];
    const hi = ends[si];
    for (const gi of picked) {
      if (typeof gi === "number" && gi >= lo && gi < hi) buckets[si].push(gi);
    }
    buckets[si].sort((a, b) => a - b);
  }
  return buckets;
}

function useVoteCompactLayout() {
  const [compact, setCompact] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 768px)").matches : false,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const on = () => setCompact(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return compact;
}

function ensureDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `d-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return `d-${Date.now()}`;
  }
}

export default function VotePage() {
  const { sessionId: sessionParam } = useParams();
  const sessionId = sessionParam ?? "default";
  const { message } = App.useApp();
  const compactStarsLayout = useVoteCompactLayout();

  const deviceId = useMemo(() => ensureDeviceId(), []);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState(null);
  const [starsByGroup, setStarsByGroup] = useState(() => ({}));
  const [submitting, setSubmitting] = useState({});
  const [pickSingleBySec, setPickSingleBySec] = useState(() => []);
  const [pickMultiBySec, setPickMultiBySec] = useState(() => []);

  const displayTitle = ((state?.pageTitle || "").trim() || "投票");
  useVotePageBranding({ pageTitle: displayTitle, appName: "实时投票" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const st = await getVoteState(deviceId, sessionId);
      setState(st);
      const next = {};
      const asp = st.aspects || [];
      (st.options || []).forEach((_, gi) => {
        asp.forEach((a) => {
          const k = `${gi}:${a}`;
          const v = st.deviceRatings?.[k];
          if (typeof v === "number") next[k] = v;
        });
      });
      setStarsByGroup((prev) => ({ ...prev, ...next }));
    } catch (e) {
      message.error(e.message || "加载失败");
      setState(null);
    } finally {
      setLoading(false);
    }
  }, [deviceId, sessionId, message]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!state?.options) return;
    const mode = state.voteMode || "stars";
    const secs = voteSectionsFromPayload(state);
    const ends = cumulativeSectionEnds(secs);
    const picked = Array.isArray(state.pickedGroups) ? state.pickedGroups : [];
    const buckets = partitionPickedBySections(picked, ends);
    if (mode === "single") {
      setPickSingleBySec(secs.map((_, i) => buckets[i]?.[0] ?? null));
      setPickMultiBySec([]);
    } else if (mode === "multi") {
      setPickMultiBySec(buckets.map((arr) => new Set(arr)));
      setPickSingleBySec([]);
    } else {
      setPickSingleBySec([]);
      setPickMultiBySec([]);
    }
  }, [state]);

  useEffect(() => {
    const url = voteWebSocketUrl(sessionId);
    let ws;
    try {
      ws = new WebSocket(url);
    } catch {
      return;
    }
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg?.type === "vote_state" && msg.payload) {
          const p = msg.payload;
          setState((prev) => {
            if (!prev) return p;
            return {
              ...p,
              options: p.options !== undefined ? p.options : prev.options,
              submittedGroups:
                p.submittedGroups !== undefined ? p.submittedGroups : prev.submittedGroups,
              votesUsed: p.votesUsed !== undefined ? p.votesUsed : prev.votesUsed,
              deviceRatings: p.deviceRatings !== undefined ? p.deviceRatings : prev.deviceRatings,
              pickedGroups: p.pickedGroups !== undefined ? p.pickedGroups : prev.pickedGroups,
              voteMode: p.voteMode && p.voteMode !== "" ? p.voteMode : prev.voteMode,
              pageTitle: p.pageTitle !== undefined && p.pageTitle !== "" ? p.pageTitle : prev.pageTitle,
              sections: p.sections !== undefined ? p.sections : prev.sections,
              optionsHeadings:
                p.optionsHeadings !== undefined ? p.optionsHeadings : prev.optionsHeadings,
              scoreStandardUrl:
                p.scoreStandardUrl !== undefined ? p.scoreStandardUrl : prev.scoreStandardUrl,
            };
          });
        }
      } catch {
        /* ignore */
      }
    };
    ws.onerror = () => {};
    return () => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    };
  }, [sessionId]);

  const voteMode = state?.voteMode || "stars";
  const isStars = voteMode === "stars";
  const isSingle = voteMode === "single";
  const isMulti = voteMode === "multi";
  const pickDone = (isSingle || isMulti) && (state?.votesUsed ?? 0) >= 1;

  const secs = useMemo(() => voteSectionsFromPayload(state), [state]);
  const sectionEnds = useMemo(() => cumulativeSectionEnds(secs), [secs]);

  const onStarChange = (groupIndex, aspect, value) => {
    const k = `${groupIndex}:${aspect}`;
    setStarsByGroup((prev) => ({ ...prev, [k]: value }));
  };

  const submitGroup = async (groupIndex) => {
    if (!state?.aspects?.length) return;
    const ratings = state.aspects.map((aspect) => ({
      groupIndex,
      aspect,
      stars: starsByGroup[`${groupIndex}:${aspect}`] ?? 0,
    }));
    if (ratings.some((r) => !r.stars || r.stars < 1 || r.stars > 3)) {
      message.warning("请为该组每个维度选择 1～3 星后再提交");
      return;
    }
    setSubmitting((s) => ({ ...s, [groupIndex]: true }));
    try {
      await postVoteRatings({ deviceId, ratings }, sessionId);
      message.success("已提交该组评分");
      await load();
    } catch (e) {
      message.error(e.message || "提交失败");
    } finally {
      setSubmitting((s) => ({ ...s, [groupIndex]: false }));
    }
  };

  const submitPick = async () => {
    const secs = voteSectionsFromPayload(state);
    const ends = cumulativeSectionEnds(secs);
    let indices = [];
    if (isSingle) {
      if (pickSingleBySec.length !== secs.length || pickSingleBySec.some((x) => x == null)) {
        message.warning(`请为全部 ${secs.length} 段题面各选一项`);
        return;
      }
      indices = [...pickSingleBySec];
    } else {
      for (let si = 0; si < secs.length; si++) {
        const s = pickMultiBySec[si] || new Set();
        if (s.size < 1) {
          message.warning(`第 ${si + 1} 段请至少选择一项`);
          return;
        }
        const lo = si === 0 ? 0 : ends[si - 1];
        const hi = ends[si];
        if (s.size > hi - lo) {
          message.warning(`第 ${si + 1} 段勾选数超过该段选项数`);
          return;
        }
      }
      indices = pickMultiBySec.flatMap((s) => [...(s || new Set())]);
    }
    const ratings = indices.map((gi) => ({
      groupIndex: gi,
      aspect: VOTE_ASPECT_PICK,
      stars: 1,
    }));
    setSubmitting((s) => ({ ...s, __pick: true }));
    try {
      await postVoteRatings({ deviceId, ratings }, sessionId);
      message.success("投票已提交");
      await load();
    } catch (e) {
      message.error(e.message || "提交失败");
    } finally {
      setSubmitting((s) => ({ ...s, __pick: false }));
    }
  };

  if (loading && !state) {
    return (
      <div className="vote-page" style={{ textAlign: "center", paddingTop: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!state?.options?.length) {
    return (
      <div className="vote-page">
        <Typography.Title level={3}>{displayTitle}</Typography.Title>
        <Alert type="error" message="暂无会场数据" showIcon />
      </div>
    );
  }

  const submitted = new Set(state.submittedGroups || []);
  const locked = !!state.locked;

  const aspectCount = (state.aspects || []).length;
  const aspectColPct = aspectCount > 0 ? `${(100 - 22 - 16) / aspectCount}%` : "50%";

  const columns = [
    {
      title: "组别",
      dataIndex: "group",
      key: "group",
      className: "vote-score-table__group",
      width: "22%",
    },
    ...(state.aspects || []).map((a) => ({
      title: a,
      key: `asp-${a}`,
      width: aspectColPct,
      render: (_, row) => (
        <Rate
          count={3}
          value={starsByGroup[`${row.groupIndex}:${a}`] ?? 0}
          onChange={(v) => onStarChange(row.groupIndex, a, v)}
          disabled={locked || submitted.has(row.groupIndex)}
        />
      ),
    })),
    {
      title: "操作",
      key: "go",
      className: "vote-score-table__submit",
      width: "16%",
      render: (_, row) => (
        <Button
          type="primary"
          loading={!!submitting[row.groupIndex]}
          disabled={locked || submitted.has(row.groupIndex)}
          onClick={() => submitGroup(row.groupIndex)}
        >
          {submitted.has(row.groupIndex) ? "已提交" : "提交本组"}
        </Button>
      ),
    },
  ];

  const rawStd =
    typeof state.scoreStandardUrl === "string" && state.scoreStandardUrl.trim()
      ? state.scoreStandardUrl.trim()
      : "";
  const { text: scoreStandardText, imageUrl: scoreStandardImage } = parseScoreStandardStored(rawStd);

  return (
    <div className="vote-page">
      <Typography.Title level={3}>{displayTitle}</Typography.Title>
      {locked ? (
        <Alert style={{ marginBottom: 12 }} type="warning" message="本场投票已锁定，仅可查看已填分数。" showIcon />
      ) : null}
      {isStars ? (
        secs.map((sec, si) => {
          const baseGi = si === 0 ? 0 : sectionEnds[si - 1];
          const end = sectionEnds[si];
          const sliceDs = state.options.slice(baseGi, end).map((opt, j) => ({
            key: String(baseGi + j),
            groupIndex: baseGi + j,
            group: voteOptionLabel(opt),
          }));
          return (
            <div key={si} className="vote-score-table-wrap" style={{ marginBottom: 24 }}>
              {sec.heading ? (
                <Typography.Paragraph style={{ marginBottom: 8 }}>{sec.heading}</Typography.Paragraph>
              ) : null}
              {compactStarsLayout ? (
                <div className="vote-score-cards">
                  {sliceDs.map((row) => (
                    <div key={row.key} className="vote-score-card">
                      <div className="vote-score-card__group">{row.group}</div>
                      <div className="vote-score-card__aspects">
                        {(state.aspects || []).map((a) => (
                          <div key={a} className="vote-score-card__row">
                            <span className="vote-score-card__aspect">{a}</span>
                            <Rate
                              count={3}
                              value={starsByGroup[`${row.groupIndex}:${a}`] ?? 0}
                              onChange={(v) => onStarChange(row.groupIndex, a, v)}
                              disabled={locked || submitted.has(row.groupIndex)}
                            />
                          </div>
                        ))}
                      </div>
                      <Button
                        type="primary"
                        block
                        loading={!!submitting[row.groupIndex]}
                        disabled={locked || submitted.has(row.groupIndex)}
                        onClick={() => submitGroup(row.groupIndex)}
                      >
                        {submitted.has(row.groupIndex) ? "已提交" : "提交本组"}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <Table
                  className="vote-score-table"
                  tableLayout="fixed"
                  pagination={false}
                  size="middle"
                  columns={columns}
                  dataSource={sliceDs}
                />
              )}
            </div>
          );
        })
      ) : (
        <div style={{ marginBottom: 24 }}>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
            {isSingle ? "请为每一段题面各选一项后提交。" : "每一段题面至少选一项；可多选。"}
          </Typography.Paragraph>
          {isSingle ? (
            secs.map((sec, si) => {
              const baseGi = si === 0 ? 0 : sectionEnds[si - 1];
              const end = sectionEnds[si];
              const sliceOpts = state.options.slice(baseGi, end);
              return (
                <div key={si} style={{ marginBottom: 20 }}>
                  {sec.heading ? (
                    <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
                      {sec.heading}
                    </Typography.Title>
                  ) : null}
                  <Radio.Group
                    value={pickSingleBySec[si] ?? null}
                    onChange={(e) => {
                      const v = e.target.value;
                      setPickSingleBySec((prev) => {
                        const next = secs.map((_, i) => (i < prev.length ? prev[i] : null));
                        next[si] = v;
                        return next;
                      });
                    }}
                    disabled={locked || pickDone}
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    {sliceOpts.map((opt, j) => {
                      const gi = baseGi + j;
                      return (
                        <Radio key={gi} value={gi}>
                          {voteOptionLabel(opt)}
                        </Radio>
                      );
                    })}
                  </Radio.Group>
                </div>
              );
            })
          ) : (
            secs.map((sec, si) => {
              const baseGi = si === 0 ? 0 : sectionEnds[si - 1];
              const end = sectionEnds[si];
              const sliceOpts = state.options.slice(baseGi, end);
              const setVal = pickMultiBySec[si] || new Set();
              return (
                <div key={si} style={{ marginBottom: 20 }}>
                  {sec.heading ? (
                    <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
                      {sec.heading}
                    </Typography.Title>
                  ) : null}
                  <Checkbox.Group
                    value={[...setVal]}
                    onChange={(vals) => {
                      setPickMultiBySec((prev) => {
                        const next = secs.map((_, i) => prev[i] || new Set());
                        next[si] = new Set(vals);
                        return next;
                      });
                    }}
                    disabled={locked || pickDone}
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    {sliceOpts.map((opt, j) => {
                      const gi = baseGi + j;
                      return (
                        <Checkbox key={gi} value={gi}>
                          {voteOptionLabel(opt)}
                        </Checkbox>
                      );
                    })}
                  </Checkbox.Group>
                </div>
              );
            })
          )}
          <Button
            type="primary"
            style={{ marginTop: 16 }}
            loading={!!submitting.__pick}
            disabled={locked || pickDone}
            onClick={submitPick}
          >
            {pickDone ? "已提交" : "提交投票"}
          </Button>
        </div>
      )}
      {scoreStandardText ? (
        <div className="vote-score-standard">
          <Typography.Title level={5} className="vote-score-standard__title">
            评分标准
          </Typography.Title>
          <div className="vote-score-standard__text">{scoreStandardText}</div>
        </div>
      ) : scoreStandardImage ? (
        <div className="vote-score-standard">
          <Typography.Title level={5} className="vote-score-standard__title">
            评分标准
          </Typography.Title>
          <img
            className="vote-score-standard__image"
            key={rawStd}
            src={scoreStandardImage}
            alt="评分标准"
          />
        </div>
      ) : null}
    </div>
  );
}
