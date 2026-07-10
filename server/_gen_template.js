// 生成测试用的占位符模板 .docx 文件
const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:p><w:r><w:rPr><w:b/><w:sz w:val="32"/></w:rPr><w:t>湖南师范大学本科学生综合素质测评登记表</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">姓名：{real_name}    学号：{student_id}    学年：{academic_year}</w:t></w:r></w:p>
    <w:p><w:r><w:t>═══════════════════════════════════</w:t></w:r></w:p>

    <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>一、基本素质 F1（权重10%）</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">A1 思想政治表现：{F1_A1_score} / {F1_A1_base}  说明：{F1_A1_detail}</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">A2 道德品质修养：{F1_A2_score} / {F1_A2_base}  说明：{F1_A2_detail}</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">A3 学习态度作风：{F1_A3_score} / {F1_A3_base}  说明：{F1_A3_detail}</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">A4 组织纪律观念：{F1_A4_score} / {F1_A4_base}  说明：{F1_A4_detail}</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">A5 身心健康素质：{F1_A5_score} / {F1_A5_base}  说明：{F1_A5_detail}</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">F1合计：{F1_total}  加权得分：{F1_weighted}</w:t></w:r></w:p>
    <w:p><w:r><w:t>───────────────────────────────────</w:t></w:r></w:p>

    <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>二、课程学习成绩 F2（权重65%）</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">加权平均分：{F2_weighted_avg}  加权得分：{F2_weighted}</w:t></w:r></w:p>
    <w:p><w:r><w:t>课程明细：</w:t></w:r></w:p>
    {#F2_courses}
    <w:p><w:r><w:t xml:space="preserve">  {name}（{credit}学分）：{score}分</w:t></w:r></w:p>
    {/F2_courses}
    <w:p><w:r><w:t>───────────────────────────────────</w:t></w:r></w:p>

    <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>三、创新素质与实践能力 F3（权重25%）</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">B1 职业技能类：{F3_B1_score}分 — {F3_B1_detail}</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">B2 科技学术类：{F3_B2_score}分 — {F3_B2_detail}</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">B3 社会工作类：{F3_B3_score}分 — {F3_B3_detail}</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">B4 宣传报道类：{F3_B4_score}分 — {F3_B4_detail}</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">B5 文艺创作类：{F3_B5_score}分 — {F3_B5_detail}</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">B6 文体竞赛类：{F3_B6_score}分 — {F3_B6_detail}</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">B7 其他实践类：{F3_B7_score}分 — {F3_B7_detail}</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">B8 劳育类：{F3_B8_score}分 — {F3_B8_detail}</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">F3合计：{F3_total}  加权得分：{F3_weighted}</w:t></w:r></w:p>
    <w:p><w:r><w:t>───────────────────────────────────</w:t></w:r></w:p>

    <w:p><w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t xml:space="preserve">综测总分：{total_score}  等级：{grade}</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">F = F1x10% + F2x65% + F3x25%</w:t></w:r></w:p>
  </w:body>
</w:document>`;

const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

// 生成 .docx
const zip = new PizZip();
zip.file("[Content_Types].xml", contentTypesXml);
zip.folder("_rels").file(".rels", relsXml);
zip.folder("word").file("document.xml", documentXml);

const buffer = zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
const outPath = path.join(__dirname, "uploads", "测试模板_综测登记表.docx");
fs.writeFileSync(outPath, buffer);
console.log("测试模板已生成:", outPath);
console.log("文件大小:", buffer.length, "bytes");
