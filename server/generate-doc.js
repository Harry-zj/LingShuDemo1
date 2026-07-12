/**
 * 生成系统体系结构与概要设计文档
 */
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, PageBreak
} = require("docx");

// 辅助函数：创建正文段落（宋体小四/Times New Roman，首行缩进2字符）
function bodyPara(text, options = {}) {
  const { bold = false, alignment = AlignmentType.JUSTIFIED } = options;
  const parts = [];
  let remaining = text || "";

  while (remaining.length > 0) {
    const cnMatch = remaining.match(/^[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef，。；：！？、\u201c\u201d\u2018\u2019\u2026\u2014]+/);
    const enMatch = remaining.match(/^[^\u4e00-\u9fff\u3000-\u303f\uff00-\uffef，。；：！？、\u201c\u201d\u2018\u2019\u2026\u2014]+/);

    if (cnMatch) {
      parts.push(
        new TextRun({
          text: cnMatch[0],
          font: { name: "SimSun", eastAsia: "SimSun" },
          size: 24,
          bold,
        })
      );
      remaining = remaining.slice(cnMatch[0].length);
    } else if (enMatch) {
      parts.push(
        new TextRun({
          text: enMatch[0],
          font: { name: "Times New Roman", eastAsia: "Times New Roman" },
          size: 24,
          bold,
        })
      );
      remaining = remaining.slice(enMatch[0].length);
    } else {
      parts.push(
        new TextRun({
          text: remaining,
          font: { name: "Times New Roman", eastAsia: "SimSun" },
          size: 24,
          bold,
        })
      );
      break;
    }
  }

  return new Paragraph({
    alignment,
    indent: { firstLine: 480 },
    spacing: { after: 120, line: 360 },
    children: parts,
  });
}

// 辅助函数：创建标题
function heading(text, level = 1) {
  const sizeMap = { 1: 32, 2: 28, 3: 26 };
  const size = sizeMap[level] || 24;
  const boldMap = { 1: true, 2: true, 3: true };
  const bold = boldMap[level] !== false;

  const parts = [];
  let remaining = text;
  while (remaining.length > 0) {
    const cnMatch = remaining.match(/^[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef，。；：！？、\u201c\u201d\u2018\u2019\u2026\u2014]+/);
    const enMatch = remaining.match(/^[^\u4e00-\u9fff\u3000-\u303f\uff00-\uffef，。；：！？、\u201c\u201d\u2018\u2019\u2026\u2014]+/);
    if (cnMatch) {
      parts.push(new TextRun({ text: cnMatch[0], font: { name: "SimSun", eastAsia: "SimSun" }, size, bold }));
      remaining = remaining.slice(cnMatch[0].length);
    } else if (enMatch) {
      parts.push(new TextRun({ text: enMatch[0], font: { name: "Times New Roman", eastAsia: "Times New Roman" }, size, bold }));
      remaining = remaining.slice(enMatch[0].length);
    } else break;
  }

  return new Paragraph({
    heading: HeadingLevel[`HEADING_${level}`],
    spacing: { before: 360, after: 200 },
    children: parts,
  });
}

function emptyLine() {
  return new Paragraph({ spacing: { after: 60 }, children: [] });
}

// ---- 封面 ----
docChildren.push(emptyLine(), emptyLine(), emptyLine(), emptyLine(), emptyLine(), emptyLine());
docChildren.push(
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 240 },
    children: [
      new TextRun({ text: "灵枢系统", font: { name: "SimSun", eastAsia: "SimSun" }, size: 52, bold: true }),
    ],
  })
);
docChildren.push(
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 600 },
    children: [
      new TextRun({ text: "体系结构的建立与系统概要设计", font: { name: "SimSun", eastAsia: "SimSun" }, size: 44, bold: true }),
    ],
  })
);
docChildren.push(emptyLine(), emptyLine());
docChildren.push(
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [
      new TextRun({ text: "版本：V1.0", font: { name: "SimSun", eastAsia: "SimSun" }, size: 28 }),
    ],
  })
);
docChildren.push(
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [
      new TextRun({ text: "日期：2026年7月", font: { name: "SimSun", eastAsia: "SimSun" }, size: 28 }),
    ],
  })
);
docChildren.push(
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [
      new TextRun({ text: "项目代号：LingShuDemo1", font: { name: "SimSun", eastAsia: "SimSun" }, size: 28 }),
    ],
  })
);
docChildren.push(new Paragraph({ children: [new PageBreak()] }));

// ---- 目录 ----
docChildren.push(
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
    children: [
      new TextRun({ text: "目  录", font: { name: "SimSun", eastAsia: "SimSun" }, size: 32, bold: true }),
    ],
  })
);

const tocItems = [
  "一、引言",
  "    1.1  项目背景",
  "    1.2  系统目标",
  "    1.3  适用范围",
  "二、系统技术架构设计",
  "    2.1  整体架构概览",
  "    2.2  前端架构设计",
  "    2.3  后端架构设计",
  "    2.4  数据层架构设计",
  "    2.5  技术选型说明",
  "三、系统功能体系结构",
  "    3.1  功能模块总览",
  "    3.2  智能填表模块",
  "    3.3  个性评定模块",
  "    3.4  信息管理模块",
  "四、系统概要设计",
  "    4.1  数据库设计",
  "    4.2  接口设计规范",
  "    4.3  核心业务流程设计",
  "    4.4  角色权限体系设计",
  "    4.5  安全设计",
  "五、部署架构设计",
  "    5.1  部署环境要求",
  "    5.2  部署拓扑结构",
  "    5.3  运维方案",
  "六、总结与展望",
];

for (const item of tocItems) {
  const parts = [];
  let remaining = item;
  while (remaining.length > 0) {
    const cnMatch = remaining.match(/^[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef，。；：！？、\u201c\u201d\u2018\u2019\u2026\u2014\s]+/);
    const enMatch = remaining.match(/^[^\u4e00-\u9fff\u3000-\u303f\uff00-\uffef，。；：！？、\u201c\u201d\u2018\u2019\u2026\u2014\s]+/);
    if (cnMatch) {
      parts.push(new TextRun({ text: cnMatch[0], font: { name: "SimSun", eastAsia: "SimSun" }, size: 24 }));
      remaining = remaining.slice(cnMatch[0].length);
    } else if (enMatch) {
      parts.push(new TextRun({ text: enMatch[0], font: { name: "Times New Roman", eastAsia: "Times New Roman" }, size: 24 }));
      remaining = remaining.slice(enMatch[0].length);
    } else break;
  }
  docChildren.push(new Paragraph({ spacing: { after: 80, line: 360 }, children: parts }));
}

docChildren.push(new Paragraph({ children: [new PageBreak()] }));

