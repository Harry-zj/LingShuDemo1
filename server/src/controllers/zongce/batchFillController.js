const path = require("path");
const { pool } = require("../../config/database");
const Res = require("../../utils/response");
const { parseExcel, scanPlaceholders, autoMapColumns, batchFill } = require("../../services/zongce/batchFillService");
const { uploadBuffer, downloadBuffer, deleteMultiple, isOssUrl, extractKeyFromUrl, generateKey } = require("../../services/oss");

const BATCH_KEY_PREFIX = "batch-fill/";

// ========== 上传 ==========
exports.uploadFiles = async (req, res) => {
  try {
    const excelFile = req.files?.excel?.[0];
    const templateFile = req.files?.template?.[0];
    if (!excelFile || !templateFile) return res.json(Res.error("请同时上传 Excel 数据文件和 Word 模板"));

    const excelExt = path.extname(excelFile.originalname).toLowerCase();
    if (![".xlsx", ".xls"].includes(excelExt)) {
      return res.json(Res.error("数据文件仅支持 .xlsx / .xls 格式"));
    }

    // 验证模板是有效的 .docx (ZIP magic bytes)
    if (templateFile.buffer[0] !== 0x50 || templateFile.buffer[1] !== 0x4b) {
      return res.json(Res.error("模板文件格式无效，请上传 .docx 文件"));
    }

    // 从 buffer 解析
    const { columns, rows, totalRows } = parseExcel(excelFile.buffer);
    const placeholders = scanPlaceholders(templateFile.buffer);
    const mappings = await autoMapColumns(columns, placeholders);

    // 上传到 OSS
    const excelOssKey = BATCH_KEY_PREFIX + generateKey(excelFile.originalname);
    const templateOssKey = BATCH_KEY_PREFIX + generateKey(templateFile.originalname);

    let excelUrl, templateUrl;
    try {
      excelUrl = await uploadBuffer(excelFile.buffer, excelOssKey, excelFile.mimetype || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      templateUrl = await uploadBuffer(templateFile.buffer, templateOssKey, templateFile.mimetype || "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    } catch (ossErr) {
      console.error("[批量填表] OSS 上传失败:", ossErr.message);
      return res.json(Res.error("文件上传失败，请稍后重试"));
    }

    // 写入数据库（存 OSS URL + 旧字段兼容）
    let taskId;
    try {
      const [r] = await pool.execute(
        "INSERT INTO batch_fill_tasks (user_id, excel_path, template_path, excel_name, template_name, total_rows, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [req.user.id, excelUrl, templateUrl, excelFile.originalname, templateFile.originalname, totalRows, "uploaded"]
      );
      taskId = r.insertId;
    } catch (e) {
      console.error("[批量填表] DB 插入失败:", e.message);
      taskId = Date.now();
    }

    res.json(Res.success({
      taskId, excelName: excelFile.originalname, templateName: templateFile.originalname,
      totalRows, columns, placeholders, mappings,
      previewRows: rows.slice(0, 5),
    }, "文件解析完成，AI 已自动映射列"));
  } catch (e) {
    console.error("[批量填表-上传]", e);
    res.json(Res.error(e.message));
  }
};

// ========== 更新映射 ==========
exports.updateMapping = async (req, res) => {
  try {
    const { taskId, mappings } = req.body;
    try {
      await pool.execute("UPDATE batch_fill_tasks SET mappings = ?, status = 'mapped' WHERE id = ? AND user_id = ?",
        [JSON.stringify(mappings), taskId, req.user.id]);
    } catch (e) { console.error("[批量填表] 更新映射失败:", e.message); }
    res.json(Res.success(null, "映射已更新"));
  } catch (e) { res.json(Res.error(e.message)); }
};

// ========== 执行批量填表 ==========
exports.executeBatchFill = async (req, res) => {
  try {
    const { mappings } = req.body;
    const { taskId } = req.params;

    // 查询任务
    let task;
    try {
      const [rows] = await pool.execute(
        "SELECT * FROM batch_fill_tasks WHERE id = ? AND user_id = ? AND is_deleted = 0",
        [taskId, req.user.id]
      );
      if (rows.length > 0) task = rows[0];
    } catch (e) { console.error("[批量填表] 查询任务失败:", e.message); }

    if (!task) return res.json(Res.error("任务不存在"));

    // 从 OSS 下载 Excel
    const excelBuffer = await downloadBuffer(task.excel_path);

    // 从 OSS 下载模板
    const templateBuffer = await downloadBuffer(task.template_path);

    const { rows } = parseExcel(excelBuffer);
    const actualMappings = mappings || (task.mappings ? JSON.parse(task.mappings) : []);

    // 更新状态为 processing
    try {
      await pool.execute("UPDATE batch_fill_tasks SET status = 'processing' WHERE id = ?", [taskId]);
    } catch (e) { console.error("[批量填表] 更新状态失败:", e.message); }

    // 批量生成
    const results = batchFill(templateBuffer, rows, actualMappings);
    const successCount = results.filter(r => r.success).length;
    console.log("[批量填表] 完成:", successCount, "/", results.length, "成功");

    // 上传每个生成的 .docx 到 OSS
    const resultFiles = [];
    for (const r of results) {
      if (r.success && r.buffer) {
        const ossKey = BATCH_KEY_PREFIX + "batch_" + taskId + "/" + r.fileName;
        try {
          const url = await uploadBuffer(r.buffer, ossKey, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
          resultFiles.push({ name: r.fileName, url });
          delete r.buffer;
          r.fileUrl = url;
        } catch (ossErr) {
          console.error(`[批量填表] 上传结果文件失败: ${r.fileName}`, ossErr.message);
          r.success = false;
          r.error = "文件上传失败";
          delete r.buffer;
        }
      } else {
        delete r.buffer;
      }
    }

    // 重新计算成功数（可能因 OSS 上传失败而变化）
    const finalSuccess = results.filter(r => r.success).length;
    const resultPath = "batch_" + taskId;

    try {
      await pool.execute(
        "UPDATE batch_fill_tasks SET status='completed', result_path=?, result_files=?, success_count=?, fail_count=? WHERE id=?",
        [resultPath, JSON.stringify(resultFiles), finalSuccess, results.length - finalSuccess, taskId]
      );
    } catch (e) { console.error("[批量填表] DB更新失败:", e.message); }

    res.json(Res.success({
      taskId, total: results.length, successCount: finalSuccess, failCount: results.length - finalSuccess,
      results: results.map(r => ({ index: r.index, success: r.success, rowName: r.rowName, error: r.error, fileUrl: r.fileUrl })),
      downloadReady: finalSuccess > 0,
    }, `完成 ${finalSuccess}/${results.length}`));
  } catch (e) {
    console.error("[批量填表-执行] 错误:", e.message, e.stack);
    res.json(Res.error("批量填表出错：" + e.message));
  }
};

// ========== 下载结果 ==========
exports.downloadResult = async (req, res) => {
  try {
    const { id } = req.params;

    // 查询任务（必须登录才能下载）
    let task = null;
    try {
      const [rows] = await pool.execute(
        "SELECT * FROM batch_fill_tasks WHERE id = ? AND user_id = ? AND is_deleted = 0",
        [id, req.user.id]
      );
      if (rows.length > 0) task = rows[0];
    } catch (e) { console.error("[批量填表-下载] DB查询失败:", e.message); }

    if (!task) return res.json(Res.error("任务不存在"));

    const JSZip = require("jszip");
    const zip = new JSZip();

    // 优先从 result_files (OSS) 下载
    if (task.result_files) {
      let resultFiles;
      try {
        resultFiles = typeof task.result_files === "string"
          ? JSON.parse(task.result_files)
          : task.result_files;
      } catch (e) { resultFiles = []; }

      if (resultFiles.length > 0) {
        for (const f of resultFiles) {
          try {
            const buf = await downloadBuffer(f.url);
            zip.file(f.name, buf);
          } catch (e) {
            console.error(`[批量填表] 下载结果文件失败: ${f.name}`, e.message);
          }
        }

        if (Object.keys(zip.files).length === 0) {
          return res.json(Res.error("结果文件无法访问，请尝试重新生成"));
        }

        const zipBuf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
        res.setHeader("Content-Type", "application/zip");
        res.setHeader("Content-Disposition", "attachment; filename*=UTF-8''" + encodeURIComponent("批量填表结果.zip"));
        return res.send(zipBuf);
      }
    }

    // 无结果文件
    return res.json(Res.error("结果文件丢失，请重新生成"));
  } catch (e) {
    console.error("[批量填表-下载]", e);
    if (!res.headersSent) res.json(Res.error("下载失败：" + e.message));
  }
};

// ========== 历史列表 ==========
exports.listTasks = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 10;
    const offset = (page - 1) * pageSize;

    const [rows] = await pool.execute(
      `SELECT id, excel_name, template_name, total_rows, status,
              success_count, fail_count, created_at, updated_at
       FROM batch_fill_tasks
       WHERE user_id = ? AND is_deleted = 0
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [req.user.id, pageSize, offset]
    );

    const [[{ total }]] = await pool.execute(
      "SELECT COUNT(*) as total FROM batch_fill_tasks WHERE user_id = ? AND is_deleted = 0",
      [req.user.id]
    );

    res.json(Res.list(rows, total, page, pageSize));
  } catch (e) {
    console.error("[批量填表-列表]", e);
    res.json(Res.error(e.message));
  }
};

// ========== 任务详情 ==========
exports.getTaskDetail = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT * FROM batch_fill_tasks WHERE id = ? AND user_id = ? AND is_deleted = 0",
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.json(Res.error("任务不存在"));

    const task = rows[0];
    // 解析 JSON 字段
    if (task.mappings && typeof task.mappings === "string") {
      try { task.mappings = JSON.parse(task.mappings); } catch (e) {}
    }
    if (task.result_files && typeof task.result_files === "string") {
      try { task.result_files = JSON.parse(task.result_files); } catch (e) {}
    }

    res.json(Res.success(task));
  } catch (e) {
    console.error("[批量填表-详情]", e);
    res.json(Res.error(e.message));
  }
};

// ========== 删除任务 ==========
exports.deleteTask = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT * FROM batch_fill_tasks WHERE id = ? AND user_id = ? AND is_deleted = 0",
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.json(Res.error("任务不存在"));

    const task = rows[0];

    // 收集所有需要删除的 OSS 文件
    const keysToDelete = [];

    if (task.excel_path && isOssUrl(task.excel_path)) {
      keysToDelete.push(task.excel_path);
    }
    if (task.template_path && isOssUrl(task.template_path)) {
      keysToDelete.push(task.template_path);
    }

    // result_files 中的各个文件
    if (task.result_files) {
      let resultFiles;
      try {
        resultFiles = typeof task.result_files === "string"
          ? JSON.parse(task.result_files)
          : task.result_files;
      } catch (e) { resultFiles = []; }

      for (const f of resultFiles) {
        if (f.url && isOssUrl(f.url)) {
          keysToDelete.push(f.url);
        }
      }
    }

    // 删除 OSS 文件（best-effort，出错只记日志）
    if (keysToDelete.length > 0) {
      try {
        await deleteMultiple(keysToDelete);
        console.log(`[批量填表] 已删除 ${keysToDelete.length} 个 OSS 文件`);
      } catch (ossErr) {
        console.error("[批量填表] OSS 删除失败:", ossErr.message);
      }
    }

    // 软删除数据库记录
    await pool.execute(
      "UPDATE batch_fill_tasks SET is_deleted = 1, deleted_at = NOW() WHERE id = ?",
      [req.params.id]
    );

    res.json(Res.success(null, "已删除"));
  } catch (e) {
    console.error("[批量填表-删除]", e);
    res.json(Res.error("删除失败：" + e.message));
  }
};
