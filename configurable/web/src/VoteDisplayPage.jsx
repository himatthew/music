import { App, Alert, Button, Space, Spin, Typography } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  clearVoteDisplayBallots,
  cumulativeSectionEnds,
  getVoteState,
  postVoteDisplayLock,
  voteOptionLabel,
  voteSectionsFromPayload,
  voteWebSocketUrl,
  VOTE_ASPECT_PICK,
} from "./voteApi.js";
import { useVotePageBranding } from "./hooks/useVotePageBranding.js";

const BAR_COLORS = ["#00838f", "#7b61ff", "#ff7043", "#43a047", "#5c6bc0", "#ab47bc", "#ef5350", "#29b6f6"];

function aspectChartName(a) {
  return a === VOTE_ASPECT_PICK ? "得票" : a;
}

function sumRowScores(row, aspects) {
  return aspects.reduce((s, a) => s + (Number(row[a]) || 0), 0);
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const rows = [...payload].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
  const sum = rows.reduce((s, r) => s + (Number(r.value) || 0), 0);
  return (
    <div className="vote-chart-tooltip">
      <div className="vote-chart-tooltip__title">{label}</div>
      {rows.map((r) => (
        <div key={r.dataKey} className="vote-chart-tooltip__row">
          <span className="vote-chart-tooltip__dot" style={{ background: r.color }} />
          <span>{r.name}</span>
          <strong>{r.value}</strong>
        </div>
      ))}
      <div className="vote-chart-tooltip__summary">合计：{sum}</div>
    </div>
  );
}

export default function VoteDisplayPage() {
  const { sessionId: sessionParam } = useParams();
  const sessionId = sessionParam ?? "default";
  const { message, modal } = App.useApp();

  const [loading, setLoading] = useState(true);
  const [state, setState] = useState(null);

  const displayTitle = `${((state?.pageTitle || "").trim() || "投票")} · 大屏`;
  useVotePageBranding({ pageTitle: displayTitle, appName: "实时投票" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const st = await getVoteState("", sessionId);
      setState(st);
    } catch (e) {
      message.error(e.message || "加载失败");
      setState(null);
    } finally {
      setLoading(false);
    }
  }, [sessionId, message]);

  useEffect(() => {
    load();
  }, [load]);

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
          setState(msg.payload);
        }
      } catch {
        /* ignore */
      }
    };
    return () => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    };
  }, [sessionId]);

  const displaySections = useMemo(() => voteSectionsFromPayload(state), [state]);
  const sectionEnds = useMemo(() => cumulativeSectionEnds(displaySections), [displaySections]);

  const chartSections = useMemo(() => {
    if (!state?.options?.length) return [];
    const aspects = state.aspects || [];
    let lo = 0;
    return displaySections.map((sec, si) => {
      const hi = sectionEnds[si];
      const rows = state.options.slice(lo, hi).map((opt, j) => {
        const gi = lo + j;
        const row = { name: voteOptionLabel(opt), __gi: gi };
        aspects.forEach((a, ai) => {
          row[a] = state.aspectScores?.[gi]?.[ai] ?? 0;
        });
        return row;
      });
      rows.sort((a, b) => sumRowScores(b, aspects) - sumRowScores(a, aspects));
      lo = hi;
      return { heading: sec.heading, rows };
    });
  }, [state, displaySections, sectionEnds]);

  /** 按题面分段：每段题面描述 + 本段内选项总分降序（与柱状图分段一致；各维度明细见下方堆叠图） */
  const sectionRankings = useMemo(() => {
    if (!state?.options?.length || !state.aspectScores?.length) return [];
    let lo = 0;
    return displaySections.map((sec, si) => {
      const hi = sectionEnds[si];
      const slice = state.options.slice(lo, hi);
      const totalRows = slice
        .map((opt, j) => {
          const gi = lo + j;
          const total = (state.aspectScores[gi] || []).reduce((s, x) => s + (x || 0), 0);
          return { gi, name: voteOptionLabel(opt), total };
        })
        .sort((a, b) => b.total - a.total);
      lo = hi;
      const heading = String(sec.heading ?? "").trim() || `第 ${si + 1} 部分`;
      return { heading, totalRows };
    });
  }, [state, displaySections, sectionEnds]);

  const displayToolbar = !loading ? (
    <Space style={{ marginBottom: 12 }} wrap>
      <Button
        type={state?.locked ? "default" : "primary"}
        onClick={async () => {
          const next = !state?.locked;
          try {
            await postVoteDisplayLock(next, sessionId);
            message.success(next ? "已锁定" : "已解锁");
            await load();
          } catch (e) {
            message.error(e.message || "操作失败");
          }
        }}
      >
        {state?.locked ? "解除锁定" : "锁定投票"}
      </Button>
      <Button
        danger
        onClick={() => {
          modal.confirm({
            title: "确认清空本会场全部投票记录？",
            okText: "清空",
            okType: "danger",
            cancelText: "取消",
            onOk: async () => {
              try {
                await clearVoteDisplayBallots(sessionId);
                message.success("已清空");
                await load();
              } catch (e) {
                message.error(e.message || "清空失败");
                throw e;
              }
            },
          });
        }}
      >
        清空投票
      </Button>
    </Space>
  ) : null;

  if (loading && !state) {
    return (
      <div className="vote-display-page" style={{ textAlign: "center", paddingTop: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!state?.options?.length) {
    return (
      <div className="vote-display-page">
        {displayToolbar}
        <Typography.Title level={3}>{displayTitle}</Typography.Title>
        <Alert type="error" message="暂无数据" showIcon />
      </div>
    );
  }

  const aspects = state.aspects || [];

  return (
    <div className="vote-display-page">
      {displayToolbar}
      <Typography.Title level={3}>{displayTitle}</Typography.Title>
      <Typography.Text type="secondary">
        参与设备数（至少提交过一组）：{state.totalBallots ?? 0}
        {state.locked ? " · 已锁定" : ""}
      </Typography.Text>

      {sectionRankings.length > 0 ? (
        <div className="vote-star-highlights">
          <Typography.Title level={5} className="vote-star-highlights__title">
            实时排行（按题面分组，段内选项降序）
          </Typography.Title>
          {sectionRankings.map((sec, sidx) => (
            <div key={sidx} className="vote-star-highlights__section-card">
              <div className="vote-star-highlights__section-heading">{sec.heading}</div>
              <div className="vote-star-highlights__section-subtitle">本段总分（选项合计 · 降序）</div>
              {sec.totalRows.map((r, i) => (
                <div key={r.gi} className="vote-star-highlights__row">
                  <span className="vote-star-highlights__rank">{i + 1}</span>
                  <span className="vote-star-highlights__label">{r.name}</span>
                  <span className="vote-star-highlights__value">合计 {r.total}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : null}

      {chartSections.map((block, idx) => (
        <div key={idx} style={{ marginBottom: 24 }}>
          {block.heading ? (
            <Typography.Paragraph style={{ marginBottom: 8 }}>{block.heading}</Typography.Paragraph>
          ) : null}
          <div className="vote-chart-wrap" style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={block.rows.map(({ __gi, ...rest }) => rest)}
                margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-18} textAnchor="end" height={64} />
                <YAxis allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend />
                {aspects.map((a, i) => (
                  <Bar
                    key={a}
                    dataKey={a}
                    name={aspectChartName(a)}
                    stackId={`tot-${idx}`}
                    fill={BAR_COLORS[i % BAR_COLORS.length]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ))}
    </div>
  );
}
