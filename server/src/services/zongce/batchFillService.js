/**
 * 批量填表引擎
 * - 解析 Excel 汇总表
 * - AI 辅助自动列映射
 * - 逐行调用 docxtemplater 批量填表
 */

const fs = require("fs");
const XLSX = require("xlsx");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const { chatStreamJson } = require("./ai/aiService");

function parseExcel(input) {
  // 支持 Buffer 或文件路径
  const workbook = Buffer.isBuffer(input)
    ? XLSX.read(input, { type: "buffer" })
    : XLSX.readFile(input);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet);
  const columns = Object.keys(rows[0] || {});
  return { columns, rows, totalRows: rows.length };
}

function scanPlaceholders(input) {
  // 支持 Buffer 或文件路径
  const content = Buffer.isBuffer(input) ? input : fs.readFileSync(input);
  const zip = new PizZip(content);
  let xml = "";
  try { xml = zip.files["word/document.xml"].asText(); } catch (e) { return []; }
  const matches = xml.match(/\{[a-zA-Z_][a-zA-Z0-9_]*\}/g) || [];
  const placeholders = [...new Set(matches)]
    .filter(p => !p.startsWith("{#") && !p.startsWith("{/"));
  return placeholders.map(p => p.slice(1, -1));
}


async function autoMapColumns(excelColumns, placeholders) {
  if (!placeholders || placeholders.length === 0) {
    return excelColumns.map(col => ({
      excelCol: col, placeholder: null, confidence: 0, reason: "模板中无占位符",
    }));
  }
  const messages = [
    { role: "system", content: `数据映射助手。将Excel列名映射到Word模板占位符。
语义匹配优先。无合适占位符时placeholder=null,confidence=0。返回JSON:
{"mappings":[{"excelCol":"","placeholder":"或null","confidence":0.9,"reason":""}]}` },
    { role: "user", content: `Excel:${JSON.stringify(excelColumns)}\n占位符:${JSON.stringify(placeholders)}` },
  ];
  try {
    const result = await chatStreamJson(messages, { temperature: 0.1, maxTokens: 2048 });
    if (result && result.mappings) {
      const mapped = new Set(result.mappings.map(m => m.excelCol));
      return [...result.mappings, ...excelColumns.filter(c=>!mapped.has(c)).map(c=>({
        excelCol:c,placeholder:null,confidence:0,reason:"AI未匹配"}))];
    }
  } catch (e) { console.warn("[BatchFill] AI映射降级:", e.message); }
  return fallbackMapping(excelColumns, placeholders);
}

function fallbackMapping(excelColumns, placeholders) {
  const keywordMap = {
    "姓名":"real_name","学号":"student_id","学年":"academic_year",
    "学院":"college","专业":"major","班级":"class_name","年级":"grade_name",
    "总分":"total_score","等级":"grade",
    "F1":"F1_total","F2":"F2_weighted_avg","F3":"F3_total",
    "总结":"personal_summary",
  };
  return excelColumns.map(col => {
    if (placeholders.includes(col)) return { excelCol:col,placeholder:col,confidence:0.9,reason:"名称完全匹配" };
    const lower = col.toLowerCase().replace(/\s+/g,"_");
    const m = placeholders.find(p=>p.toLowerCase().replace(/\s+/g,"_")===lower);
    if (m) return { excelCol:col,placeholder:m,confidence:0.85,reason:"规范化匹配" };
    for (const [kw,ph] of Object.entries(keywordMap)) {
      if (col.includes(kw) && placeholders.includes(ph))
        return { excelCol:col,placeholder:ph,confidence:0.7,reason:`关键词"${kw}"匹配` };
    }
    return { excelCol:col,placeholder:null,confidence:0,reason:"无匹配" };
  });
}

function batchFill(templateInput, rows, mappings) {
  // 支持 Buffer 或文件路径
  const templateBuf = Buffer.isBuffer(templateInput) ? templateInput : fs.readFileSync(templateInput);
  const results = [];
  const numberFields = ["F1_total","F1_weighted","F2_weighted_avg","F2_weighted",
    "F3_total","F3_weighted","total_score"];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const fillData = {};
    for (const m of mappings) {
      if (m.placeholder && row[m.excelCol] !== undefined) fillData[m.placeholder] = row[m.excelCol];
    }
    for (const nf of numberFields) {
      if (fillData[nf] !== undefined && fillData[nf] !== null) fillData[nf] = Number(fillData[nf]) || fillData[nf];
    }
    try {
      const zip = new PizZip(templateBuf);
      const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
      doc.render(fillData);
      const buf = doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
      results.push({ index:i, success:true,
        rowName: fillData.real_name || fillData.student_id || `第${i+1}行`,
        fileName: `${fillData.real_name||"person"}_${fillData.student_id||i+1}.docx`, buffer:buf });
    } catch (e) {
      results.push({ index:i, success:false,
        rowName: fillData.real_name || fillData.student_id || `第${i+1}行`, error:e.message });
    }
  }
  return results;
}

function previewRowText(templateInput, row, mappings) {
  const fillData = {};
  for (const m of mappings) {
    if (m.placeholder && row[m.excelCol] !== undefined) fillData[m.placeholder] = row[m.excelCol];
  }
  const templateBuf = Buffer.isBuffer(templateInput) ? templateInput : fs.readFileSync(templateInput);
  const zip = new PizZip(templateBuf);
  let xml; try { xml = zip.files["word/document.xml"].asText(); } catch(e){ return {error:"无法读取"}; }
  let px = xml;
  for(const [k,v] of Object.entries(fillData)){
    px = px.replace(new RegExp(`\\{${k}\\}`,"g"),`【${String(v||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}】`);
  }
  return { text: px.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim().substring(0,500), filledFields: Object.keys(fillData).length };
}

module.exports = { parseExcel, scanPlaceholders, autoMapColumns, batchFill, previewRowText };

