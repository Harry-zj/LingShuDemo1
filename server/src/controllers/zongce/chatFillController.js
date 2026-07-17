const { pool } = require("../../config/database");
const Res = require("../../utils/response");
const { detectFormFields, chatAboutField, fillTemplate } = require("../../services/zongce/chatFillService");
const { uploadBuffer, downloadBuffer, deleteMultiple, isOssUrl, extractKeyFromUrl, generateKey } = require("../../services/oss");

const KEY_PREFIX = "chat-fill/";

// ========== 创建会话（上传 + AI 分析，一步完成） ==========
exports.createSession = async (req, res) => {
  try {
    if (!req.file) return res.json(Res.error("请选择文件"));

    // Multer memoryStorage 文件名是 Latin-1 编码，转为 UTF-8
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    const ext = require("path").extname(originalName).toLowerCase();
    if (ext !== ".docx") return res.json(Res.error("仅支持 .docx 格式"));

    const buf = req.file.buffer;
    if (buf[0] !== 0x50 || buf[1] !== 0x4b) return res.json(Res.error("文件格式无效，请上传 .docx 文件"));

    // 上传模板到 OSS
    const ossKey = KEY_PREFIX + generateKey(originalName);
    let templateUrl;
    try {
      templateUrl = await uploadBuffer(buf, ossKey, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    } catch (e) {
      console.error("[对话填表] OSS上传失败:", e.message);
      return res.json(Res.error("文件上传失败，请稍后重试"));
    }

    // AI 分析字段
    let fields = [];
    try {
      fields = await detectFormFields(buf);
    } catch (e) {
      console.error("[对话填表] 字段检测失败:", e.message);
    }

    // 创建 DB 会话
    const sessionId = "cs_" + Date.now();
    await pool.execute(
      "INSERT INTO chat_fill_sessions (id, user_id, template_id, template_name, template_oss_url, fields_json, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [sessionId, req.user.id, 0, originalName, templateUrl, JSON.stringify(fields), "analyzed"]
    );

    res.json(Res.success({ sessionId, templateName: originalName, fields }, "模板上传并分析完成"));
  } catch (e) {
    console.error("[对话填表-创建]", e);
    res.json(Res.error(e.message));
  }
};

// ========== 历史会话列表 ==========
exports.listSessions = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 10;
    const offset = (page - 1) * pageSize;

    const [rows] = await pool.execute(
      `SELECT id, template_name, fields_json, status, created_at, updated_at
       FROM chat_fill_sessions WHERE user_id = ? AND is_deleted = 0
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [req.user.id, pageSize, offset]
    );
    const [[{ total }]] = await pool.execute(
      "SELECT COUNT(*) as total FROM chat_fill_sessions WHERE user_id = ? AND is_deleted = 0",
      [req.user.id]
    );

    // 解析 fields_json 字段数
    const list = rows.map(r => {
      let fieldCount = 0;
      try { fieldCount = JSON.parse(r.fields_json || "[]").length; } catch (e) {}
      return { ...r, fieldCount };
    });

    res.json(Res.list(list, total, page, pageSize));
  } catch (e) {
    console.error("[对话填表-列表]", e);
    res.json(Res.error(e.message));
  }
};

// ========== 会话详情 ==========
exports.getSession = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT * FROM chat_fill_sessions WHERE id = ? AND user_id = ? AND is_deleted = 0",
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.json(Res.error("会话不存在"));

    const session = rows[0];
    if (session.fields_json && typeof session.fields_json === "string") {
      try { session.fields = JSON.parse(session.fields_json); } catch (e) { session.fields = []; }
    }
    res.json(Res.success(session));
  } catch (e) {
    console.error("[对话填表-详情]", e);
    res.json(Res.error(e.message));
  }
};

// ========== 保存 simple 字段值 ==========
exports.saveSimpleField = async (req, res) => {
  try {
    const { id } = req.params;
    const { values } = req.body; // { name: "张三", phone: "138..." }

    // 更新 fields_json 中的值
    const [rows] = await pool.execute(
      "SELECT fields_json FROM chat_fill_sessions WHERE id = ? AND user_id = ? AND is_deleted = 0",
      [id, req.user.id]
    );
    if (!rows.length) return res.json(Res.error("会话不存在"));

    let fields = [];
    try { fields = JSON.parse(rows[0].fields_json || "[]"); } catch (e) {}

    for (const f of fields) {
      if (values[f.key] !== undefined) f.value = values[f.key];
    }

    await pool.execute(
      "UPDATE chat_fill_sessions SET fields_json = ?, status = 'filling' WHERE id = ?",
      [JSON.stringify(fields), id]
    );

    res.json(Res.success(fields, "保存成功"));
  } catch (e) {
    console.error("[对话填表-保存]", e);
    res.json(Res.error(e.message));
  }
};

// ========== 获取某字段的聊天记录 ==========
exports.getMessages = async (req, res) => {
  try {
    const { id, fieldKey } = req.params;
    const [rows] = await pool.execute(
      "SELECT role, content, created_at FROM chat_fill_messages WHERE session_id = ? AND field_key = ? ORDER BY created_at ASC",
      [id, fieldKey]
    );
    res.json(Res.success(rows));
  } catch (e) {
    console.error("[对话填表-消息]", e);
    res.json(Res.error(e.message));
  }
};

// ========== AI 对话（SSE 流式 + 消息持久化） ==========
exports.chatField = async (req, res) => {
  try {
    const { sessionId, fieldKey, fieldLabel, fieldHint, messages, simpleFields } = req.body;

    if (!sessionId || !fieldKey) return res.json(Res.error("缺少必要参数"));

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    const fieldInfo = { key: fieldKey, label: fieldLabel || fieldKey, hint: fieldHint || "" };
    const stream = chatAboutField(fieldInfo, messages || [], simpleFields || {});

    let fullContent = "";
    for await (const token of stream) {
      fullContent += token;
      res.write(`data: ${JSON.stringify({ token })}\n\n`);
    }
    res.write("data: [DONE]\n\n");
    res.end();

    // 异步保存消息到 DB（不阻塞响应）
    if (fullContent.trim()) {
      try {
        // 保存用户最后一条消息
        const lastUserMsg = [...(messages || [])].reverse().find(m => m.role === "user");
        if (lastUserMsg) {
          await pool.execute(
            "INSERT INTO chat_fill_messages (session_id, field_key, role, content) VALUES (?, ?, ?, ?)",
            [sessionId, fieldKey, "user", lastUserMsg.content]
          );
        }
        // 保存 AI 回复
        await pool.execute(
          "INSERT INTO chat_fill_messages (session_id, field_key, role, content) VALUES (?, ?, ?, ?)",
          [sessionId, fieldKey, "assistant", fullContent.trim()]
        );
      } catch (dbErr) {
        console.error("[对话填表] 消息保存失败:", dbErr.message);
      }
    }
  } catch (e) {
    console.error("[对话填表-对话]", e);
    if (!res.headersSent) {
      res.json(Res.error(e.message));
    } else {
      res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    }
  }
};

// ========== 接受 AI 生成的文案 ==========
exports.acceptContent = async (req, res) => {
  try {
    const { sessionId, fieldKey, content } = req.body;

    const [rows] = await pool.execute(
      "SELECT fields_json FROM chat_fill_sessions WHERE id = ? AND user_id = ? AND is_deleted = 0",
      [sessionId, req.user.id]
    );
    if (!rows.length) return res.json(Res.error("会话不存在"));

    let fields = [];
    try { fields = JSON.parse(rows[0].fields_json || "[]"); } catch (e) {}

    const field = fields.find(f => f.key === fieldKey);
    if (field) field.value = content;

    await pool.execute(
      "UPDATE chat_fill_sessions SET fields_json = ? WHERE id = ?",
      [JSON.stringify(fields), sessionId]
    );

    res.json(Res.success(fields, "已填入"));
  } catch (e) {
    console.error("[对话填表-接受]", e);
    res.json(Res.error(e.message));
  }
};

// ========== 生成文档 ==========
exports.fillSession = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.execute(
      "SELECT * FROM chat_fill_sessions WHERE id = ? AND user_id = ? AND is_deleted = 0",
      [id, req.user.id]
    );
    if (!rows.length) return res.json(Res.error("会话不存在"));

    const session = rows[0];
    if (!session.template_oss_url) return res.json(Res.error("模板文件丢失"));

    // 从 OSS 下载模板
    let templateBuffer;
    try {
      templateBuffer = await downloadBuffer(session.template_oss_url);
    } catch (e) {
      return res.json(Res.error("模板文件无法访问"));
    }

    // 构建填充数据
    let fields = [];
    try { fields = JSON.parse(session.fields_json || "[]"); } catch (e) {}
    const fillData = {};
    for (const f of fields) {
      if (f.value) fillData[f.key] = f.value;
    }

    // 生成文档
    const outputBuffer = fillTemplate(templateBuffer, fillData);

    // 上传结果到 OSS
    const resultKey = KEY_PREFIX + "result_" + id + ".docx";
    let resultUrl;
    try {
      resultUrl = await uploadBuffer(outputBuffer, resultKey, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    } catch (e) {
      return res.json(Res.error("生成文件上传失败"));
    }

    // 更新会话
    await pool.execute(
      "UPDATE chat_fill_sessions SET result_oss_url = ?, status = 'completed' WHERE id = ?",
      [resultUrl, id]
    );

    res.json(Res.success({ resultUrl, fileName: (session.template_name || "结果").replace(/\.docx$/i, "") + "_已填写.docx" }, "文档生成完成"));
  } catch (e) {
    console.error("[对话填表-生成]", e);
    res.json(Res.error(e.message));
  }
};

// ========== 下载结果 ==========
exports.downloadResult = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.execute(
      "SELECT * FROM chat_fill_sessions WHERE id = ? AND user_id = ? AND is_deleted = 0",
      [id, req.user.id]
    );
    if (!rows.length) return res.json(Res.error("会话不存在"));

    const session = rows[0];
    if (!session.result_oss_url) return res.json(Res.error("请先生成文档"));

    const buf = await downloadBuffer(session.result_oss_url);
    const fileName = encodeURIComponent((session.template_name || "结果").replace(/\.docx$/i, "") + "_已填写.docx");

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", "attachment; filename*=UTF-8''" + fileName);
    res.send(buf);
  } catch (e) {
    console.error("[对话填表-下载]", e);
    if (!res.headersSent) res.json(Res.error("下载失败：" + e.message));
  }
};

// ========== 删除会话 ==========
exports.deleteSession = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT * FROM chat_fill_sessions WHERE id = ? AND user_id = ? AND is_deleted = 0",
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.json(Res.error("会话不存在"));

    const session = rows[0];

    // 收集 OSS 文件
    const keysToDelete = [];
    if (session.template_oss_url && isOssUrl(session.template_oss_url)) {
      keysToDelete.push(session.template_oss_url);
    }
    if (session.result_oss_url && isOssUrl(session.result_oss_url)) {
      keysToDelete.push(session.result_oss_url);
    }

    if (keysToDelete.length > 0) {
      try { await deleteMultiple(keysToDelete); } catch (e) {
        console.error("[对话填表] OSS删除失败:", e.message);
      }
    }

    // 删除消息和会话

    try { await pool.execute("DELETE FROM chat_fill_messages WHERE session_id = ?", [req.params.id]); } catch (e) {}
    await pool.execute("DELETE FROM chat_fill_sessions WHERE id = ?", [req.params.id]);

    res.json(Res.success(null, "已删除"));
  } catch (e) {
    console.error("[对话填表-删除]", e);
    res.json(Res.error("删除失败：" + e.message));
  }
};
