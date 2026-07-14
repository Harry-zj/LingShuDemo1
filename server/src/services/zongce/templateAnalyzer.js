const PizZip = require("pizzip");

function norm(t){return t.replace(/\s+/g,"").trim();}
function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function scanCells(xml){const cells=[];let pos=0,ri=0,ci=0;while(pos<xml.length){const ts=xml.indexOf("<w:tc",pos);if(ts===-1)break;const trE=xml.indexOf("</w:tr>",pos);if(trE!==-1&&ts>trE){ri++;ci=0;pos=trE+7;continue;}const te=xml.indexOf("</w:tc>",ts);if(te===-1)break;const cx=xml.substring(ts,te+7);const ms=cx.match(/<w:t[^>]*>([^<]*)<\/w:t>/g);const ts2=[];if(ms)ms.forEach(m=>{const mx=m.match(/<w:t[^>]*>([^<]*)<\/w:t>/);if(mx)ts2.push(mx[1]);});cells.push({seqId:cells.length,text:ts2.join(""),xmlStart:ts,xmlEnd:te+7,rowIdx:ri,cellIdx:ci++,xmlContent:cx});pos=te+7;}return cells;}

function analyzeAndFill(tplBuf, data) {
  console.log("[SmartFill] 开始填表...");
  const zip = new PizZip(tplBuf);
  let xml = zip.files["word/document.xml"].asText();
  let count = 0;

  // ============ 辅助函数 ============
  function fillLabel(label, val) {
    if (!val && val !== 0) return;
    const re = new RegExp(
      "<w:t[^>]*>" + label + "<\\/w:t>\\s*<\\/w:r>\\s*<w:r[^>]*>\\s*<w:rPr[^>]*>.*?<w:u\\s[^\\/]*\\/>.*?<\\/w:rPr>\\s*<w:t[^>]*>([\\s]*)<\\/w:t>", "g");
    const prev = xml.length;
    xml = xml.replace(re, (full, spaces) => full.replace(spaces, String(val)));
    if (xml.length !== prev) { count++; console.log("[SmartFill] " + label + " = " + val); }
  }

// ============ NEW STRATEGY: pre-scan + reverse fill ============
  // ===== NEW: Direct fill - find empty <w:p> after label cell and inject <w:r> =====
  function fillCellsAfter(labelPos, fields, subField) {
    // Start scanning AFTER the label's parent cell (skip past </w:tc>)
    const tcEnd = xml.indexOf("</w:tc>", labelPos);
    let currentPos = tcEnd !== -1 ? tcEnd + 7 : labelPos;
    let filled = 0;

    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      let v = null;
      if (subField === "detail") v = data[field + "_detail"] != null ? data[field + "_detail"] : "";
      else v = data[field + "_score"] != null ? String(data[field + "_score"]) : "";

      // ★ 找到下一个空 <w:p>（无论值是否为空都要定位，否则字段错位）
      const reEmptyP = /<w:p[\s>](?:(?!<w:r>).)*?<\/w:p>/g;
      reEmptyP.lastIndex = currentPos;
      const match = reEmptyP.exec(xml);
      if (!match) break;

      const insPos = match.index + match[0].length - 6; // before </w:p>
      // ★ 先推进位置（跳过该单元格），再决定是否填入
      currentPos = insPos;

      if (v === null || v === "") continue;  // 空值跳过但位置已推进

      const insert = '<w:r><w:rPr><w:rFonts w:hint="eastAsia" w:eastAsia="楷体_GB2312"/><w:sz w:val="18"/></w:rPr><w:t xml:space="preserve">' + esc(String(v)) + '</w:t></w:r>';
      xml = xml.substring(0, insPos) + insert + xml.substring(insPos);
      count++;
      filled++;
      currentPos += insert.length;
    }
    return filled;
  }

  // ===== 头信息 =====
  fillLabel("学号", data.student_id);
  fillLabel("姓名", data.real_name);
  fillLabel("学院", data.college || "信息科学与工程学院");
  fillLabel("专业", data.major || "计算机科学与技术");
  fillLabel("年级", data.grade_name || "2024级");
  fillLabel("班级", data.class_name);

  const f1f = ["F1_A1","F1_A2","F1_A3","F1_A4","F1_A5"];
  const f3f = ["F3_B1","F3_B2","F3_B3","F3_B4","F3_B5","F3_B6","F3_B7","F3_B8"];

  // ===== F1 表格 =====
  const a1p = xml.indexOf("思想政治表现A");
  if (a1p !== -1) {
    const d1 = xml.indexOf("计分理由", a1p);
    const reSelf = /<w:t[^>]*>自评<\/w:t>/g;
    let s1 = -1, m;
    while ((m = reSelf.exec(xml)) !== null) { if (m.index > d1) { s1 = m.index; break; } }
    console.log("[SmartFill] F1 detail: " + fillCellsAfter(d1, f1f, "detail") + "/5");
    console.log("[SmartFill] F1 self:   " + fillCellsAfter(s1 !== -1 ? s1 : d1, f1f, "self_score") + "/5");
  }

  // ===== F3 表格 =====
  const b1p = xml.indexOf("职业技能类");
  if (b1p !== -1) {
    let d3 = xml.indexOf("计分理由", b1p);
    const reSelf3 = /<w:t[^>]*>自评<\/w:t>/g;
    let s3 = -1, m3;
    while ((m3 = reSelf3.exec(xml)) !== null) { if (m3.index > d3) { s3 = m3.index; break; } }
    console.log("[SmartFill] F3 detail: " + fillCellsAfter(d3, f3f, "detail") + "/8");
    console.log("[SmartFill] F3 self:   " + fillCellsAfter(s3 !== -1 ? s3 : d3, f3f, "self_score") + "/8");
  }

  // ===== F2 课程表 =====
  if (data.F2_courses && data.F2_courses.length > 0) {
    const courses = data.F2_courses;
    const f2f = courses.map((_, i) => "course_" + i);
    // Subject names
    let subjPos = xml.indexOf("科  目"); if (subjPos === -1) subjPos = xml.indexOf("科目");
    if (subjPos !== -1) { courses.forEach((c,i)=>data["course_"+i+"_score"]=c.name); console.log("[SmartFill] F2 subject: "+fillCellsAfter(subjPos,f2f,"score")+"/"+courses.length); }
    // Credits
    let credPos = xml.indexOf("学  分"); if (credPos === -1) credPos = xml.indexOf("学分");
    if (credPos !== -1) { courses.forEach((c,i)=>data["course_"+i+"_score"]=c.credit); console.log("[SmartFill] F2 credit: "+fillCellsAfter(credPos,f2f,"score")+"/"+courses.length); }
    // Scores
    let scorPos = xml.indexOf("成  绩"); if (scorPos === -1) scorPos = xml.indexOf("成绩");
    if (scorPos !== -1) { courses.forEach((c,i)=>data["course_"+i+"_score"]=c.score); console.log("[SmartFill] F2 score:  "+fillCellsAfter(scorPos,f2f,"score")+"/"+courses.length); }
  }

  // ===== 总分 =====
  const totalPos = xml.indexOf("综合素质最后得分");
  if ((data.total_score || data.total_score === 0) && totalPos !== -1) {
    const re = new RegExp("(<w:t[^>]*>综合素质最后得分\\s*)(<\\/w:t>)", "g");
    const prev = xml.length;
    xml = xml.replace(re, (_m, pfx, close) => pfx + " " + String(data.total_score) + close);
    if (xml.length !== prev) { count++; console.log("[SmartFill] total_score = " + data.total_score); }
  }

  console.log("[SmartFill] 完成: " + count + " 处填充");
  zip.file("word/document.xml", xml);
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}

function analyzeOnly(tplBuf){
  const PizZip = require("pizzip");
  const zip = new PizZip(tplBuf);
  const xml = zip.files["word/document.xml"].asText();
  return { cellCount: scanCells(xml).length };
}

module.exports = { analyzeAndFill, analyzeOnly, scanCells };
