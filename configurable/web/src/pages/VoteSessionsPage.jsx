import { Alert, App, Button, Form, Input, Modal, Select, Space, Switch, Table, Typography, Upload } from "antd";
import { MinusOutlined, PlusOutlined } from "@ant-design/icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildScoreStandardStored,
  clearVoteBallots,
  createVoteSession,
  deleteVoteSession,
  getVoteSessionConfig,
  listVoteSessions,
  parseScoreStandardStored,
  postVoteLock,
  putVoteScoreStandard,
  updateVoteSession,
  uploadVoteScoreStandard,
} from "../voteApi.js";
import { voteAbsoluteUrl, voteDisplayAbsoluteUrl } from "../siteOrigin.js";

const LS_SESS = "vote_session_admin_secrets";

function loadSessionSecrets() {
  try {
    const raw = localStorage.getItem(LS_SESS);
    if (!raw) return {};
    const j = JSON.parse(raw);
    return j && typeof j === "object" ? j : {};
  } catch {
    return {};
  }
}

function saveSessionSecrets(map) {
  try {
    localStorage.setItem(LS_SESS, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/** 非 HTTPS 下 clipboard API 常不可用，用隐藏 textarea + execCommand 兜底 */
async function writeClipboard(text) {
  const str = String(text ?? "");
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(str);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = str;
    ta.setAttribute("readonly", "readonly");
    ta.style.cssText =
      "position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:none;opacity:0;z-index:-1;";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, str.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function fileListFromUrl(stored) {
  const { imageUrl } = parseScoreStandardStored(stored);
  const u = String(imageUrl || "").trim();
  if (!u) return [];
  return [{ uid: "-1", name: "standard", status: "done", url: u, thumbUrl: u }];
}

/** 从 Upload file 项解析可展示的图地址（接口 response、url、thumbUrl） */
function scoreImageUrlFromFileItem(f) {
  if (!f) return "";
  const r = f.response;
  const fromApi = r && typeof r.url === "string" ? r.url.trim() : "";
  if (fromApi) return fromApi;
  const u = String(f.url || f.thumbUrl || "").trim();
  if (u && !u.startsWith("blob:")) return u;
  return "";
}

/** Ant Design Upload 在 customRequest onSuccess 后会把 fileList 同步为「无 url、仅有 response」项，需把接口返回的地址写回 url/thumbUrl 才能 picture-card 回显 */
function mergeUploadFileListForImage(fileList) {
  return (fileList || []).map((f) => {
    const resolved = scoreImageUrlFromFileItem(f);
    if (resolved) return { ...f, url: resolved, thumbUrl: resolved };
    return f;
  });
}

function buildVoteSessionPayloadFromForm(v, voteMode) {
  const pageTitle = String(v.pageTitle ?? "").trim();
  if (!pageTitle) throw new Error("请填写页面标题");
  const rawSecs = Array.isArray(v.sections) ? v.sections : [];
  const sections = [];
  for (let i = 0; i < rawSecs.length; i++) {
    const sec = rawSecs[i] || {};
    const heading = String(sec.heading ?? "").trim();
    const opts = Array.isArray(sec.options) ? sec.options : [];
    const filled = opts
      .map((r) => ({ label: String(r?.label ?? "").trim() }))
      .filter((r) => r.label);
    if (filled.length < 2) {
      throw new Error(`第 ${i + 1} 段须至少填写 2 个选项文案`);
    }
    if ((voteMode === "single" || voteMode === "multi") && !heading) {
      throw new Error(`第 ${i + 1} 段请填写题面`);
    }
    sections.push({ heading, options: filled.map((r) => ({ label: r.label })) });
  }
  if (sections.length === 0) {
    throw new Error("请至少添加一段题面与选项");
  }
  const aspects = String(v.aspects ?? "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  return { pageTitle, sections, aspects };
}

export default function VoteSessionsPage() {
  const { message, modal } = App.useApp();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createStdFile, setCreateStdFile] = useState(null);
  const [createStdList, setCreateStdList] = useState([]);
  const [stdOpen, setStdOpen] = useState(false);
  const [stdSessionId, setStdSessionId] = useState("");
  const [stdFileList, setStdFileList] = useState([]);
  const [stdText, setStdText] = useState("");
  const [editStdFile, setEditStdFile] = useState(null);
  const [editStdList, setEditStdList] = useState([]);
  const [sessionSecrets, setSessionSecrets] = useState(loadSessionSecrets);
  const [form] = Form.useForm();
  const createVoteMode = Form.useWatch("voteMode", form);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [editHasVotes, setEditHasVotes] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editOpeningId, setEditOpeningId] = useState("");
  const [editForm] = Form.useForm();
  const editVoteMode = Form.useWatch("voteMode", editForm);

  const clearCreateStd = useCallback(() => {
    setCreateStdList((prev) => {
      prev.forEach((f) => {
        if (f.url?.startsWith("blob:")) URL.revokeObjectURL(f.url);
      });
      return [];
    });
    setCreateStdFile(null);
  }, []);

  const clearEditStd = useCallback(() => {
    setEditStdList((prev) => {
      prev.forEach((f) => {
        if (f.url?.startsWith("blob:")) URL.revokeObjectURL(f.url);
      });
      return [];
    });
    setEditStdFile(null);
  }, []);

  const openCreateModal = () => {
    clearCreateStd();
    form.resetFields();
    setCreateOpen(true);
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listVoteSessions();
      setSessions(Array.isArray(list) ? list : []);
    } catch (e) {
      message.error(e.message || "加载会场失败");
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setSecretFor = (id, secret) => {
    setSessionSecrets((prev) => {
      const next = { ...prev, [id]: secret };
      saveSessionSecrets(next);
      return next;
    });
  };

  const removeSecretFor = (id) => {
    setSessionSecrets((prev) => {
      const next = { ...prev };
      delete next[id];
      saveSessionSecrets(next);
      return next;
    });
  };

  /** 已保存在本地的密钥直接返回，否则弹窗输入（仍写入 localStorage 供下次使用） */
  const ensureSessionSecret = useCallback(
    (sessionId) => {
      const hit = String(sessionSecrets[sessionId] ?? "").trim();
      if (hit) return Promise.resolve(hit);
      return new Promise((resolve, reject) => {
        const ref = { pwd: "" };
        modal.confirm({
          title: `请输入会场「${sessionId}」的管理密钥`,
          width: 400,
          content: (
            <Input.Password
              autoComplete="new-password"
              placeholder="创建会场时给出的密钥"
              onChange={(e) => {
                ref.pwd = e.target.value;
              }}
            />
          ),
          onOk: () => {
            const s = String(ref.pwd).trim();
            if (!s) {
              message.warning("请输入密钥");
              return Promise.reject();
            }
            setSecretFor(sessionId, s);
            resolve(s);
          },
          onCancel: () => reject(new Error("cancel")),
        });
      });
    },
    [sessionSecrets, modal, message],
  );

  const onCreate = async (v) => {
    try {
      const voteMode = String(v.voteMode ?? form.getFieldValue("voteMode") ?? "stars").trim() || "stars";
      let payload;
      try {
        payload = buildVoteSessionPayloadFromForm(v, voteMode);
      } catch (err) {
        message.error(err.message || "请检查表单");
        return;
      }
      const textStd = String(v.scoreStandardText ?? "").trim();
      const scoreFromText = buildScoreStandardStored(textStd, "");
      const body = {
        id: v.id?.trim() || undefined,
        ...payload,
        voteMode,
        scoreStandardUrl: !textStd && createStdFile ? "" : scoreFromText,
      };
      const res = await createVoteSession(body);
      setSecretFor(res.id, res.adminSecret);

      if (!textStd && createStdFile) {
        try {
          await uploadVoteScoreStandard(createStdFile, res.adminSecret, res.id);
        } catch (upErr) {
          message.error(upErr.message || "会场已创建，但评分标准图上传失败，可在列表中点击「评分标准」补传");
        }
      }

      clearCreateStd();
      form.resetFields();
      setCreateOpen(false);
      await refresh();

      modal.success({
        title: "会场已创建",
        width: 520,
        content: (
          <div>
            <Typography.Paragraph style={{ marginBottom: 8 }}>
              请妥善保存以下<strong>会场管理密钥</strong>。进行锁定、清空、删除或评分标准等操作时，若本机尚未保存过该密钥，将提示您输入；也可复制后自行保管。
            </Typography.Paragraph>
            <Typography.Paragraph copyable={{ text: res.adminSecret }} style={{ marginBottom: 0 }}>
              密钥：{res.adminSecret}
            </Typography.Paragraph>
          </div>
        ),
      });
    } catch (e) {
      message.error(e.message || "创建失败");
    }
  };

  const openEdit = useCallback(
    async (row) => {
      let k;
      try {
        k = await ensureSessionSecret(row.id);
      } catch {
        return;
      }
      setEditOpeningId(row.id);
      setEditLoading(true);
      try {
        const cfg = await getVoteSessionConfig(k, row.id);
        setEditingId(row.id);
        setEditHasVotes(!!cfg.hasVotes);
        const { text: stText } = parseScoreStandardStored(cfg.scoreStandardUrl);
        editForm.setFieldsValue({
          pageTitle: cfg.pageTitle || "",
          voteMode: cfg.voteMode || "stars",
          aspects: (cfg.aspects || []).join("\n"),
          sections: (cfg.sections || []).map((sec) => ({
            heading: sec.heading || "",
            options: (sec.options || []).map((o) => ({
              label:
                typeof o === "object" && o != null
                  ? String(o.label ?? o.title ?? "").trim()
                  : String(o ?? "").trim(),
            })),
          })),
          scoreStandardText: stText,
        });
        setEditStdFile(null);
        setEditStdList(fileListFromUrl(cfg.scoreStandardUrl));
        setEditOpen(true);
      } catch (e) {
        message.error(e.message || "加载会场失败");
      } finally {
        setEditLoading(false);
        setEditOpeningId("");
      }
    },
    [ensureSessionSecret, message, editForm],
  );

  const onEditFinish = async (v) => {
    let k;
    try {
      k = await ensureSessionSecret(editingId);
    } catch {
      return;
    }
    const resolveScoreStored = async () => {
      const text = String(v.scoreStandardText ?? "").trim();
      if (text) return buildScoreStandardStored(text, "");
      if (editStdFile) {
        const j = await uploadVoteScoreStandard(editStdFile, k, editingId);
        return String(j.url || "").trim();
      }
      const kept = scoreImageUrlFromFileItem(editStdList[0]);
      if (kept) return kept;
      return "";
    };

    if (editHasVotes) {
      const pageTitle = String(v.pageTitle ?? "").trim();
      if (!pageTitle) {
        message.error("请填写页面标题");
        return;
      }
      let scoreStandardUrl;
      try {
        scoreStandardUrl = await resolveScoreStored();
      } catch (e) {
        message.error(e.message || "评分标准处理失败");
        return;
      }
      try {
        await updateVoteSession(
          {
            pageTitle,
            scoreStandardUrl,
          },
          k,
          editingId,
        );
        message.success("已保存");
        clearEditStd();
        setEditOpen(false);
        editForm.resetFields();
        setEditingId("");
        await refresh();
      } catch (e) {
        message.error(e.message || "保存失败");
      }
      return;
    }
    try {
      const voteMode = String(v.voteMode ?? editForm.getFieldValue("voteMode") ?? "stars").trim() || "stars";
      let payload;
      try {
        payload = buildVoteSessionPayloadFromForm(v, voteMode);
      } catch (err) {
        message.error(err.message || "请检查表单");
        return;
      }
      let scoreStandardUrl;
      try {
        scoreStandardUrl = await resolveScoreStored();
      } catch (e) {
        message.error(e.message || "评分标准处理失败");
        return;
      }
      await updateVoteSession(
        {
          ...payload,
          voteMode,
          scoreStandardUrl,
        },
        k,
        editingId,
      );
      message.success("已保存");
      clearEditStd();
      setEditOpen(false);
      editForm.resetFields();
      setEditingId("");
      await refresh();
    } catch (e) {
      message.error(e.message || "保存失败");
    }
  };

  const copy = async (text) => {
    const ok = await writeClipboard(text);
    if (ok) {
      message.success("已复制");
      return;
    }
    modal.info({
      title: "无法写入剪贴板",
      width: 560,
      content: (
        <div>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
            常见于非 HTTPS 页面。请在下框内全选（⌘A / Ctrl+A）后复制。
          </Typography.Paragraph>
          <Input.TextArea
            readOnly
            defaultValue={text}
            autoSize={{ minRows: 2, maxRows: 10 }}
            style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}
            onFocus={(e) => e.target.select()}
          />
        </div>
      ),
    });
  };

  const openStdModal = (row) => {
    const { text } = parseScoreStandardStored(row.scoreStandardUrl);
    setStdSessionId(row.id);
    setStdText(text);
    setStdFileList(fileListFromUrl(row.scoreStandardUrl));
    setStdOpen(true);
  };

  const clearScoreStandard = async () => {
    let k;
    try {
      k = await ensureSessionSecret(stdSessionId);
    } catch {
      return;
    }
    try {
      await putVoteScoreStandard("", k, stdSessionId);
      setStdFileList([]);
      setStdText("");
      message.success("已清除，评分页将不再展示评分标准");
      await refresh();
    } catch (e) {
      message.error(e.message || "操作失败");
    }
  };

  const saveStdText = async () => {
    let k;
    try {
      k = await ensureSessionSecret(stdSessionId);
    } catch {
      return;
    }
    try {
      await putVoteScoreStandard(buildScoreStandardStored(stdText, ""), k, stdSessionId);
      message.success("文字说明已保存");
      setStdFileList([]);
      await refresh();
    } catch (e) {
      message.error(e.message || "保存失败");
    }
  };

  const columns = useMemo(
    () => [
      { title: "会场 ID", dataIndex: "id", key: "id", width: 140, ellipsis: true },
      {
        title: "页面标题",
        dataIndex: "pageTitle",
        key: "pageTitle",
        width: 140,
        ellipsis: true,
        render: (t) => (t ? String(t) : "—"),
      },
      {
        title: "题面段数",
        dataIndex: "sectionCount",
        key: "secn",
        width: 88,
        render: (n) => (typeof n === "number" ? n : 0),
      },
      {
        title: "模式",
        dataIndex: "voteMode",
        key: "voteMode",
        width: 88,
        render: (m) =>
          m === "single" ? "单选" : m === "multi" ? "多选" : "星级",
      },
      {
        title: "组别数 / 维度",
        key: "cnt",
        width: 130,
        render: (_, r) => `${r.optionCount} / ${r.aspectCount}`,
      },
      {
        title: "状态",
        dataIndex: "locked",
        key: "locked",
        width: 88,
        render: (locked) => (locked ? "已锁定" : "开放"),
      },
      {
        title: "创建时间",
        dataIndex: "createdAt",
        key: "createdAt",
        width: 200,
        render: (t) => (t ? new Date(t).toLocaleString() : "—"),
      },
      {
        title: "链接",
        key: "links",
        width: 124,
        render: (_, r) => (
          <Space direction="vertical" size={4} style={{ width: "100%" }}>
            <Button size="small" block style={{ paddingInline: 6 }} onClick={() => copy(voteAbsoluteUrl(r.id))}>
              复制评分页
            </Button>
            <Button size="small" block style={{ paddingInline: 6 }} onClick={() => copy(voteDisplayAbsoluteUrl(r.id))}>
              复制大屏
            </Button>
          </Space>
        ),
      },
      {
        title: "管理",
        key: "adm",
        width: 500,
        render: (_, r) => (
          <Space wrap size="small">
            <Button
              size="small"
              loading={editOpeningId === r.id && editLoading}
              onClick={() => openEdit(r)}
            >
              编辑
            </Button>
            <Button size="small" onClick={() => openStdModal(r)}>
              评分标准
            </Button>
            <Switch
              checkedChildren="锁定"
              unCheckedChildren="开放"
              checked={!!r.locked}
              onChange={async (locked) => {
                let k;
                try {
                  k = await ensureSessionSecret(r.id);
                } catch {
                  return;
                }
                try {
                  await postVoteLock(locked, k, r.id);
                  message.success(locked ? "已锁定" : "已开放");
                  await refresh();
                } catch (e) {
                  message.error(e.message || "操作失败");
                }
              }}
            />
            <Button
              size="small"
              danger
              onClick={async () => {
                let k;
                try {
                  k = await ensureSessionSecret(r.id);
                } catch {
                  return;
                }
                modal.confirm({
                  title: "清空本场全部投票记录？",
                  onOk: async () => {
                    try {
                      await clearVoteBallots(k, r.id);
                      message.success("已清空");
                      await refresh();
                    } catch (e) {
                      message.error(e.message || "清空失败");
                    }
                  },
                });
              }}
            >
              清空票数
            </Button>
            {r.id !== "default" ? (
              <Button
                type="primary"
                danger
                size="small"
                onClick={async () => {
                  let k;
                  try {
                    k = await ensureSessionSecret(r.id);
                  } catch {
                    return;
                  }
                  modal.confirm({
                    title: "删除该投票会场？",
                    content: "将永久删除本场配置及全部投票数据，且不可恢复。",
                    okText: "删除",
                    okButtonProps: { danger: true },
                    onOk: async () => {
                      try {
                        await deleteVoteSession(k, r.id);
                        removeSecretFor(r.id);
                        message.success("已删除");
                        await refresh();
                      } catch (e) {
                        message.error(e.message || "删除失败");
                      }
                    },
                  });
                }}
              >
                删除会场
              </Button>
            ) : null}
          </Space>
        ),
      },
    ],
    [message, modal, refresh, ensureSessionSecret, editOpeningId, editLoading, openEdit],
  );

  return (
    <div>
      <Space style={{ marginBottom: 16 }} wrap align="start">
        <Button onClick={refresh} loading={loading}>
          刷新列表
        </Button>
        <Button type="primary" onClick={openCreateModal}>
          新建会场
        </Button>
      </Space>

      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={sessions}
        pagination={{ pageSize: 12 }}
        scroll={{ x: 1560 }}
        tableLayout="fixed"
      />

      <Modal
        title="新建投票会场"
        open={createOpen}
        onCancel={() => {
          clearCreateStd();
          setCreateOpen(false);
        }}
        destroyOnClose
        footer={null}
        width={560}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            aspects: "旋律\n节奏\n表现",
            voteMode: "stars",
            pageTitle: "",
            scoreStandardText: "",
            sections: [{ heading: "", options: [{ label: "" }, { label: "" }] }],
          }}
          onFinish={onCreate}
        >
          <Form.Item name="id" label="会场 ID（可选，留空自动生成）">
            <Input placeholder="小写字母、数字、连字符" />
          </Form.Item>
          <Form.Item
            name="pageTitle"
            label="页面标题"
            rules={[
              { required: true, message: "请填写页面标题" },
              { max: 120, message: "标题不超过 120 字" },
            ]}
          >
            <Input placeholder="显示在投票页与大屏浏览器标题" maxLength={120} showCount />
          </Form.Item>
          <Form.Item name="voteMode" label="投票模式" rules={[{ required: true, message: "请选择投票模式" }]}>
            <Select
              options={[
                { value: "stars", label: "星级打分（多维度）" },
                { value: "single", label: "勾选 · 单选（选一个候选项）" },
                { value: "multi", label: "勾选 · 多选（选多个候选项）" },
              ]}
            />
          </Form.Item>
          <Form.Item label="题面与选项（可多段）" required>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 8, fontSize: 13 }}>
              每一段包含本段题面与本段的候选项（至少 2 项）。单选、多选模式下每段题面必填；星级模式下题面选填（留空将显示为「第 N 部分」）。每段题面最多 500 字。
            </Typography.Paragraph>
            <Form.List name="sections">
              {(secFields, { add: addSec, remove: removeSec }) => (
                <>
                  {secFields.map(({ key, name, ...restField }) => (
                    <div
                      key={key}
                      style={{
                        border: "1px solid var(--ant-color-border-secondary, #f0f0f0)",
                        borderRadius: 8,
                        padding: 12,
                        marginBottom: 12,
                      }}
                    >
                      <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 8 }} wrap>
                        <Typography.Text strong>第 {name + 1} 段</Typography.Text>
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<MinusOutlined />}
                          disabled={secFields.length <= 1}
                          onClick={() => removeSec(name)}
                        >
                          删除本段
                        </Button>
                      </Space>
                      <Form.Item
                        {...restField}
                        name={[name, "heading"]}
                        label="题面"
                        rules={
                          createVoteMode === "single" || createVoteMode === "multi"
                            ? [{ required: true, message: "请填写本段题面" }]
                            : []
                        }
                      >
                        <Input.TextArea rows={2} maxLength={500} showCount placeholder="本段题面…" />
                      </Form.Item>
                      <Form.Item label="本段候选项（至少 2 项填写文案）" required style={{ marginBottom: 0 }}>
                        <Form.List name={[name, "options"]}>
                          {(optFields, { add: addOpt, remove: removeOpt }) => (
                            <>
                              {optFields.map((of) => (
                                <Space key={of.key} align="start" style={{ display: "flex", marginBottom: 8 }} wrap>
                                  <Form.Item
                                    {...of}
                                    name={[of.name, "label"]}
                                    style={{ flex: "1 1 240px", marginBottom: 0 }}
                                  >
                                    <Input placeholder="选项文案" maxLength={200} />
                                  </Form.Item>
                                  <Button
                                    type="text"
                                    danger
                                    icon={<MinusOutlined />}
                                    disabled={optFields.length <= 2}
                                    onClick={() => removeOpt(of.name)}
                                    aria-label="删除本选项"
                                  />
                                </Space>
                              ))}
                              <Button type="dashed" onClick={() => addOpt({ label: "" })} icon={<PlusOutlined />} block>
                                添加本段选项
                              </Button>
                            </>
                          )}
                        </Form.List>
                      </Form.Item>
                    </div>
                  ))}
                  <Button
                    type="dashed"
                    onClick={() => addSec({ heading: "", options: [{ label: "" }, { label: "" }] })}
                    icon={<PlusOutlined />}
                    block
                  >
                    添加题面（含本段选项）
                  </Button>
                </>
              )}
            </Form.List>
          </Form.Item>
          {createVoteMode === "stars" || createVoteMode == null ? (
            <Form.Item name="aspects" label="评分维度（每行一项，1～8 项）">
              <Input.TextArea rows={4} />
            </Form.Item>
          ) : (
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              勾选模式下无需填写评分维度，投票页为单选或多选候选项。
            </Typography.Paragraph>
          )}
          <div className="vote-session-score-block">
            <span className="vote-session-score-block__hint">
              可选。填写文字与上传图片二选一：<strong>保存时以文字为准</strong>；仅图片会在创建成功后随密钥上传。
            </span>
            <Form.Item name="scoreStandardText" label="评分标准 · 文字说明" style={{ marginBottom: 12 }}>
              <Input.TextArea rows={4} maxLength={4000} showCount placeholder="投票页以纯文本展示，可换行。" />
            </Form.Item>
            <Typography.Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
              评分标准 · 图片
            </Typography.Text>
            <Upload
              listType="picture-card"
              maxCount={1}
              fileList={createStdList}
              accept="image/jpeg,image/png,image/webp,image/gif"
              beforeUpload={(file) => {
                const t = file.type || "";
                if (!t.startsWith("image/")) {
                  message.error("只能上传图片");
                  return Upload.LIST_IGNORE;
                }
                setCreateStdList((prev) => {
                  prev.forEach((f) => {
                    if (f.url?.startsWith("blob:")) URL.revokeObjectURL(f.url);
                  });
                  const url = URL.createObjectURL(file);
                  return [{ uid: "pending", name: file.name, status: "done", url, thumbUrl: url }];
                });
                setCreateStdFile(file);
                return false;
              }}
              onChange={({ fileList }) => {
                setCreateStdList(mergeUploadFileListForImage(fileList));
              }}
              onRemove={() => {
                clearCreateStd();
                return true;
              }}
            >
              {createStdList.length < 1 ? (
                <button type="button" style={{ border: 0, background: "none" }}>
                  <PlusOutlined />
                  <div style={{ marginTop: 8 }}>上传</div>
                </button>
              ) : null}
            </Upload>
          </div>
          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button type="primary" htmlType="submit">
                创建
              </Button>
              <Button
                onClick={() => {
                  clearCreateStd();
                  setCreateOpen(false);
                }}
              >
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingId ? `编辑会场 — ${editingId}` : "编辑会场"}
        open={editOpen}
        onCancel={() => {
          clearEditStd();
          setEditOpen(false);
          editForm.resetFields();
          setEditingId("");
        }}
        destroyOnClose
        footer={null}
        width={600}
      >
        <Form form={editForm} layout="vertical" onFinish={onEditFinish}>
          {editHasVotes ? (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              message="本场已有投票记录，仅可修改页面标题与评分标准（文字或图片）。如需修改题面或选项，请先清空全部票数。"
            />
          ) : null}
          <Form.Item
            name="pageTitle"
            label="页面标题"
            rules={[
              { required: true, message: "请填写页面标题" },
              { max: 120, message: "标题不超过 120 字" },
            ]}
          >
            <Input placeholder="显示在投票页与大屏浏览器标题" maxLength={120} showCount />
          </Form.Item>
          <div className="vote-session-score-block">
            <span className="vote-session-score-block__hint">
              文字与图片二选一保存时<strong>以文字为准</strong>。新图在点击「保存」时与密钥一并上传；也可仅用本页文字覆盖为纯文本评分标准。
            </span>
            <Form.Item name="scoreStandardText" label="评分标准 · 文字说明" style={{ marginBottom: 12 }}>
              <Input.TextArea rows={4} maxLength={4000} showCount placeholder="投票页以纯文本展示，可换行。" />
            </Form.Item>
            <Typography.Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
              评分标准 · 图片
            </Typography.Text>
            <Upload
              listType="picture-card"
              maxCount={1}
              fileList={editStdList}
              accept="image/jpeg,image/png,image/webp,image/gif"
              beforeUpload={(file) => {
                const t = file.type || "";
                if (!t.startsWith("image/")) {
                  message.error("只能上传图片");
                  return Upload.LIST_IGNORE;
                }
                setEditStdList((prev) => {
                  prev.forEach((f) => {
                    if (f.url?.startsWith("blob:")) URL.revokeObjectURL(f.url);
                  });
                  const url = URL.createObjectURL(file);
                  return [{ uid: "pending", name: file.name, status: "done", url, thumbUrl: url }];
                });
                setEditStdFile(file);
                return false;
              }}
              onChange={({ fileList }) => {
                setEditStdList(mergeUploadFileListForImage(fileList));
              }}
              onRemove={() => {
                clearEditStd();
                return true;
              }}
            >
              {editStdList.length < 1 ? (
                <button type="button" style={{ border: 0, background: "none" }}>
                  <PlusOutlined />
                  <div style={{ marginTop: 8 }}>上传</div>
                </button>
              ) : null}
            </Upload>
          </div>
          <fieldset disabled={editHasVotes} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
            <Form.Item name="voteMode" label="投票模式" rules={[{ required: true, message: "请选择投票模式" }]}>
              <Select
                options={[
                  { value: "stars", label: "星级打分（多维度）" },
                  { value: "single", label: "勾选 · 单选（选一个候选项）" },
                  { value: "multi", label: "勾选 · 多选（选多个候选项）" },
                ]}
              />
            </Form.Item>
            <Form.Item label="题面与选项（可多段）" required>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 8, fontSize: 13 }}>
                每一段包含本段题面与本段的候选项（至少 2 项）。单选、多选模式下每段题面必填；星级模式下题面选填（留空将显示为「第 N 部分」）。每段题面最多 500 字。
              </Typography.Paragraph>
              <Form.List name="sections">
                {(secFields, { add: addSec, remove: removeSec }) => (
                  <>
                    {secFields.map(({ key, name, ...restField }) => (
                      <div
                        key={key}
                        style={{
                          border: "1px solid var(--ant-color-border-secondary, #f0f0f0)",
                          borderRadius: 8,
                          padding: 12,
                          marginBottom: 12,
                        }}
                      >
                        <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 8 }} wrap>
                          <Typography.Text strong>第 {name + 1} 段</Typography.Text>
                          <Button
                            type="text"
                            danger
                            size="small"
                            icon={<MinusOutlined />}
                            disabled={secFields.length <= 1}
                            onClick={() => removeSec(name)}
                          >
                            删除本段
                          </Button>
                        </Space>
                        <Form.Item
                          {...restField}
                          name={[name, "heading"]}
                          label="题面"
                          rules={
                            editVoteMode === "single" || editVoteMode === "multi"
                              ? [{ required: true, message: "请填写本段题面" }]
                              : []
                          }
                        >
                          <Input.TextArea rows={2} maxLength={500} showCount placeholder="本段题面…" />
                        </Form.Item>
                        <Form.Item label="本段候选项（至少 2 项填写文案）" required style={{ marginBottom: 0 }}>
                          <Form.List name={[name, "options"]}>
                            {(optFields, { add: addOpt, remove: removeOpt }) => (
                              <>
                                {optFields.map((of) => (
                                  <Space key={of.key} align="start" style={{ display: "flex", marginBottom: 8 }} wrap>
                                    <Form.Item
                                      {...of}
                                      name={[of.name, "label"]}
                                      style={{ flex: "1 1 240px", marginBottom: 0 }}
                                    >
                                      <Input placeholder="选项文案" maxLength={200} />
                                    </Form.Item>
                                    <Button
                                      type="text"
                                      danger
                                      icon={<MinusOutlined />}
                                      disabled={optFields.length <= 2}
                                      onClick={() => removeOpt(of.name)}
                                      aria-label="删除本选项"
                                    />
                                  </Space>
                                ))}
                                <Button type="dashed" onClick={() => addOpt({ label: "" })} icon={<PlusOutlined />} block>
                                  添加本段选项
                                </Button>
                              </>
                            )}
                          </Form.List>
                        </Form.Item>
                      </div>
                    ))}
                    <Button
                      type="dashed"
                      onClick={() => addSec({ heading: "", options: [{ label: "" }, { label: "" }] })}
                      icon={<PlusOutlined />}
                      block
                    >
                      添加题面（含本段选项）
                    </Button>
                  </>
                )}
              </Form.List>
            </Form.Item>
            {editVoteMode === "stars" || editVoteMode == null ? (
              <Form.Item name="aspects" label="评分维度（每行一项，1～8 项）">
                <Input.TextArea rows={4} />
              </Form.Item>
            ) : (
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                勾选模式下无需填写评分维度，投票页为单选或多选候选项。
              </Typography.Paragraph>
            )}
          </fieldset>
          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button type="primary" htmlType="submit">
                保存
              </Button>
              <Button
                onClick={() => {
                  clearEditStd();
                  setEditOpen(false);
                  editForm.resetFields();
                  setEditingId("");
                }}
              >
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`评分标准 — ${stdSessionId}`}
        open={stdOpen}
        onCancel={() => {
          setStdOpen(false);
          setStdText("");
        }}
        destroyOnClose
        footer={[
          <Button key="saveTxt" type="primary" onClick={saveStdText}>
            保存文字说明
          </Button>,
          <Button key="clear" onClick={clearScoreStandard}>
            清除全部
          </Button>,
          <Button key="close" onClick={() => setStdOpen(false)}>
            关闭
          </Button>,
        ]}
      >
        <div className="vote-session-score-block" style={{ marginBottom: 16 }}>
          <span className="vote-session-score-block__hint">
            文字与图片二选一展示在投票页：<strong>保存文字后</strong>会覆盖当前图片；<strong>上传图片成功</strong>后会清空下方文字框（以图为准）。
          </span>
          <Typography.Text type="secondary" style={{ display: "block", marginBottom: 6 }}>
            文字说明
          </Typography.Text>
          <Input.TextArea
            value={stdText}
            onChange={(e) => setStdText(e.target.value)}
            rows={5}
            maxLength={4000}
            showCount
            placeholder="纯文本，可换行。点「保存文字说明」写入服务器。"
            style={{ marginBottom: 12 }}
          />
          <Typography.Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
            图片（JPEG / PNG / GIF / WebP，最大 8MB）
          </Typography.Text>
          <Upload
            name="file"
            listType="picture-card"
            maxCount={1}
            fileList={stdFileList}
            accept="image/jpeg,image/png,image/webp,image/gif"
            beforeUpload={(file) => {
              const t = file.type || "";
              if (!t.startsWith("image/")) {
                message.error("只能上传图片");
                return Upload.LIST_IGNORE;
              }
              return true;
            }}
            customRequest={async ({ file, onSuccess, onError }) => {
              let k;
              try {
                k = await ensureSessionSecret(stdSessionId);
              } catch {
                onError?.(new Error("cancel"));
                return;
              }
              try {
                const j = await uploadVoteScoreStandard(file, k, stdSessionId);
                const url = String(j.url || "").trim();
                setStdText("");
                const item = {
                  uid: "-1",
                  name: (file.name || "standard").toString(),
                  status: "done",
                  url,
                  thumbUrl: url,
                  response: j,
                };
                setStdFileList([item]);
                message.success("已上传");
                await refresh();
                onSuccess?.(j, file);
              } catch (e) {
                message.error(e.message || "上传失败");
                onError?.(e);
              }
            }}
            onChange={({ fileList }) => {
              setStdFileList(mergeUploadFileListForImage(fileList));
            }}
            onRemove={async () => {
              let k;
              try {
                k = await ensureSessionSecret(stdSessionId);
              } catch {
                return false;
              }
              try {
                await putVoteScoreStandard("", k, stdSessionId);
                setStdText("");
                setStdFileList([]);
                message.success("已清除，评分页将不再展示评分标准");
                await refresh();
              } catch (e) {
                message.error(e.message || "清除失败");
                return false;
              }
              return true;
            }}
          >
            {stdFileList.length < 1 ? (
              <button type="button" style={{ border: 0, background: "none" }}>
                <PlusOutlined />
                <div style={{ marginTop: 8 }}>上传</div>
              </button>
            ) : null}
          </Upload>
        </div>
      </Modal>
    </div>
  );
}
