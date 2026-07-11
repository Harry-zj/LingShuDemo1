const fs = require("fs");
const path = require("path");
const { pool } = require("../../config/database");
const Res = require("../../utils/response");
const { parseExcel, scanPlaceholders, autoMapColumns, batchFill } = require("../../services/zongce/batchFillService");

exports.uploadFiles = async (req, res) => {
  try {
    const excelFile = req.files?.excel?.[0];
    const templateFile = req.files?.template?.[0];
    if (!excelFile || !templateFile) return res.json(Res.error("请同时上传 Excel 数据文件和 Word 模板"));

    const excelExt = path.extname(excelFile.originalname).toLowerCase();
    if (![".xlsx", ".xls"].includes(excelExt)) {
      [excelFile, templateFile].forEach(f => f && fs.unlink(f.path, () => {}));
      return res.json(Res.error("数据文件仅支持 .xlsx / .xls 格式"));
    }

    const tplBuf = fs.readFileSync(templateFile.path);
    if (tplBuf[0] !== 0x50 || tplBuf[1] !== 0x4b) {
      [excelFile, templateFile].forEach(f => f && fs.unlink(f.path, () => {}));
      return res.json(Res.error("模板文件格式无效，请上传 .docx 文件"));
    }

    const { columns, rows, totalRows } = parseExcel(excelFile.path);
    const placeholders = scanPlaceholders(templateFile.path);
    const mappings = await autoMapColumns(columns, placeholders);

    let taskId;
    try {
      const [r] = await pool.execute(
        "INSERT INTO batch_fill_tasks (user_id, excel_path, template_path, excel_name, template_name, total_rows, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [req.user.id, excelFile.filename, templateFile.filename, excelFile.originalname, templateFile.originalname, totalRows, "uploaded"]
      );
      taskId = r.insertId;
    } catch (e) { taskId = Date.now(); }

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


exports.updateMapping = async (req, res) => {
  try {
    const { taskId, mappings } = req.body;
    try {
      await pool.execute("UPDATE batch_fill_tasks SET mappings = ?, status = 'mapped' WHERE id = ? AND user_id = ?",
        [JSON.stringify(mappings), taskId, req.user.id]);
    } catch (e) {}
    res.json(Res.success(null, "映射已更新"));
  } catch (e) { res.json(Res.error(e.message)); }
};

exports.executeBatchFill = async (req, res) => {
  try {
    const { mappings } = req.body;
    const { taskId } = req.params;

    let task;
    try {
      const [rows] = await pool.execute("SELECT * FROM batch_fill_tasks WHERE id = ? AND user_id = ?", [taskId, req.user.id]);
      if (rows.length > 0) task = rows[0];
    } catch (e) { console.error("[批量填表] 查询任务失败:", e.message); }

    if (!task) return res.json(Res.error("任务不存在"));

    const excelPath = path.join(__dirname, "../../../uploads", task.excel_path);
    const templatePath = path.join(__dirname, "../../../uploads", task.template_path);
    if (!fs.existsSync(excelPath)) return res.json(Res.error("数据文件丢失，请重新上传"));
    if (!fs.existsSync(templatePath)) return res.json(Res.error("模板文件丢失，请重新上传"));

    const { rows } = parseExcel(excelPath);
    const actualMappings = mappings || (task.mappings ? JSON.parse(task.mappings) : []);

    try { await pool.execute("UPDATE batch_fill_tasks SET status = 'processing' WHERE id = ?", [taskId]); } catch (e) { console.error("[批量填表] 更新状态失败:", e.message); }

    const results = batchFill(templatePath, rows, actualMappings);
    const successCount = results.filter(r => r.success).length;
    console.log("[批量填表] 完成:", successCount, "/", results.length, "成功");

    // 写入磁盘，清理 buffer
    const outputDir = path.join(__dirname, "../../../uploads", "batch_" + taskId);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const fileList = [];
    for (const r of results) {
      if (r.success) {
        const outPath = path.join(outputDir, r.fileName);
        fs.writeFileSync(outPath, r.buffer);
        fileList.push({ name: r.fileName, path: outPath });
        delete r.buffer;
        r.filePath = outPath;
      }
    }

    // 保存文件列表供下载时打包
    const listPath = path.join(outputDir, "_filelist.json");
    fs.writeFileSync(listPath, JSON.stringify(fileList), "utf-8");

    try {
      await pool.execute(
        "UPDATE batch_fill_tasks SET status='completed', result_path=?, success_count=?, fail_count=? WHERE id=?",
        ["batch_" + taskId, successCount, results.length - successCount, taskId]
      );
    } catch (e) { console.error("[批量填表] DB更新失败:", e.message); }

    res.json(Res.success({
      taskId, total: results.length, successCount, failCount: results.length - successCount,
      results: results.map(r => ({ index: r.index, success: r.success, rowName: r.rowName, error: r.error })),
      downloadReady: successCount > 0,
    }, `完成 ${successCount}/${results.length}`));
  } catch (e) {
    console.error("[批量填表-执行] 错误:", e.message, e.stack);
    res.json(Res.error("批量填表出错：" + e.message));
  }
};

exports.downloadResult = async (req, res) => {
  try {
    const { id } = req.params;
    let batchDir = null;

    // 尝试从 DB 查找（如果有 user 信息则加上 user_id 过滤）
    try {
      let rows;
      // console.log("11111111")
      if (req.user?.id) {
        // console.log("22222")
        [rows] = await pool.execute("SELECT * FROM batch_fill_tasks WHERE id=? AND user_id=?", [id, req.user.id]);
      } else {
        [rows] = await pool.execute("SELECT * FROM batch_fill_tasks WHERE id=?", [id]);
      }
      if (rows.length > 0 && rows[0].result_path) batchDir = rows[0].result_path;
    } catch (e) { console.error("[批量填表-下载] DB查询失败:", e.message); }

    if (!batchDir) {
      const uploadsDir = path.join(__dirname, "../../../uploads");
      const dirs = fs.readdirSync(uploadsDir).filter(f => f === "batch_" + id);
      if (dirs.length === 0) return res.json(Res.error("未找到批量填表结果"));
      batchDir = dirs[0];
    }

    const fullDir = path.join(__dirname, "../../../uploads", batchDir);
    if (!fs.existsSync(fullDir)) return res.json(Res.error("结果文件丢失"));

    // 用 JSZip 打包（兼容 Node.js v24）
    const JSZip = require("jszip");
    const zip = new JSZip();
    const files = fs.readdirSync(fullDir).filter(f => f.endsWith(".docx"));
    for (const f of files) {
      zip.file(f, fs.readFileSync(path.join(fullDir, f)));
    }
    const zipBuf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", "attachment; filename*=UTF-8''" + encodeURIComponent("批量填表结果.zip"));
    res.send(zipBuf);
  } catch (e) {
    console.error("[批量填表-下载]", e);
    if (!res.headersSent) res.json(Res.error("下载失败：" + e.message));
  }
};

