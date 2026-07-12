// ============================================================
//  DOCX 确定性结构提取 → doc_blocks
//  使用 mammoth HTML 模式 + 解析，不依赖 AI
//  内建 OOXML styles.xml 读取器（免外部 ZIP 依赖）
// ============================================================
const mammoth = require("mammoth");
const fs = require("fs");
const zlib = require("zlib");
const crypto = require("crypto");

// ============================================================
//  静态标题样式映射（作为 fallback）
// ============================================================
const STATIC_HEADING_MAP = {
  // 英文标准（有空格）
  "Heading 1":1,"Heading 2":2,"Heading 3":3,"Heading 4":4,"Heading 5":5,"Heading 6":6,
  // 英文无空格（常见变体）
  "Heading1":1,"Heading2":2,"Heading3":3,"Heading4":4,"Heading5":5,"Heading6":6,
  // 小写有空格
  "heading 1":1,"heading 2":2,"heading 3":3,"heading 4":4,"heading 5":5,"heading 6":6,
  // 小写无空格
  "heading1":1,"heading2":2,"heading3":3,"heading4":4,"heading5":5,"heading6":6,
  // 中文标准（有空格）
  "标题 1":1,"标题 2":2,"标题 3":3,"标题 4":4,
  // 中文无空格
  "标题1":1,"标题2":2,"标题3":3,"标题4":4,
  // 编号前缀
  "1. Heading 1":1,"1. Heading 2":2,"1. Heading 3":3,
  "1. Heading1":1,"1. Heading2":2,"1. Heading3":3,
  "1. heading 1":1,"1. heading 2":2,"1. heading 3":3,
  // TOC
  "TOC 1":1,"TOC 2":2,"TOC 3":3,
  "TOC1":1,"TOC2":2,"TOC3":3,
  "toc 1":1,"toc 2":2,"toc 3":3,
};

// ============================================================
//  内建 DOCX ZIP 读取器（零外部依赖）
//  从 word/styles.xml 中发现文档实际使用的标题样式
// ============================================================
function readDocxStylesXml(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    if (buffer.length < 22) return null;

    // 1. 查找 End of Central Directory Record (签名 0x06054b50)
    let eocdOffset = -1;
    const searchStart = Math.max(0, buffer.length - 65557);
    for (let i = buffer.length - 22; i >= searchStart; i--) {
      if (buffer.readUInt32LE(i) === 0x06054b50) { eocdOffset = i; break; }
    }
    if (eocdOffset === -1) return null;

    // 2. 读取中央目录
    const cdOffset = buffer.readUInt32LE(eocdOffset + 16);
    let pos = cdOffset;
    const cdEnd = eocdOffset;

    while (pos < cdEnd) {
      if (buffer.readUInt32LE(pos) !== 0x02014b50) break;

      const nameLen = buffer.readUInt16LE(pos + 28);
      const extraLen = buffer.readUInt16LE(pos + 30);
      const commentLen = buffer.readUInt16LE(pos + 32);
      const localHeaderOffset = buffer.readUInt32LE(pos + 42);
      const compressedSize = buffer.readUInt32LE(pos + 20);
      const compressionMethod = buffer.readUInt16LE(pos + 10);

      const name = buffer.toString('utf8', pos + 46, pos + 46 + nameLen).toLowerCase();

      if (name === 'word/styles.xml') {
        // 3. 读取本地文件头
        const localPos = localHeaderOffset;
        const localNameLen = buffer.readUInt16LE(localPos + 26);
        const localExtraLen = buffer.readUInt16LE(localPos + 28);
        const dataOffset = localPos + 30 + localNameLen + localExtraLen;
        const data = buffer.slice(dataOffset, dataOffset + compressedSize);

        // 4. 解压
        if (compressionMethod === 0) {
          return data.toString('utf8');
        } else if (compressionMethod === 8) {
          return zlib.inflateRawSync(data).toString('utf8');
        }
        // 不支持的压缩方法
        return null;
      }

      pos += 46 + nameLen + extraLen + commentLen;
    }
    return null;
  } catch (e) {
    console.warn('[DocStruct] 读取 styles.xml 失败:', e.message);
    return null;
  }
}

/**
 * 从 styles.xml 中发现标题样式
 * 判断依据：
 *   1. w:outlineLvl 存在 → 标题，层级 = outlineLvl + 1
 *   2. w:name 匹配 heading/标题/TOC 模式 → 标题
 *   3. w:basedOn 指向已知标题样式 → 递归继承
 */
function discoverHeadingStyles(xml) {
  if (!xml) return {};

  const discovered = {};

  // 提取所有 w:style 块（段落类型）
  const styleBlockRe = /<w:style[\s\S]*?<\/w:style>/gi;
  const styleBlocks = xml.match(styleBlockRe) || [];

  for (const block of styleBlocks) {
    // 必须是段落类型（或未指定 type，默认段落）
    const typeMatch = block.match(/w:type="([^"]*)"/);
    if (typeMatch && typeMatch[1] !== 'paragraph') continue;

    // 提取 styleId
    const idMatch = block.match(/w:styleId="([^"]*)"/);
    if (!idMatch) continue;
    const styleId = idMatch[1];

    // 提取名称
    const nameMatch = block.match(/<w:name[^>]*w:val="([^"]*)"/);
    const styleName = nameMatch ? nameMatch[1] : '';

    // 检查 outlineLvl（最可靠的标题指示器，0-based → 1-based）
    const outlineMatch = block.match(/<w:outlineLvl[^>]*w:val="(\d+)"/);
    if (outlineMatch) {
      const level = parseInt(outlineMatch[1]) + 1;
      if (level >= 1 && level <= 6) {
        // 使用 styleName 作为 key（mammoth styleMap 用名称匹配）
        if (styleName) discovered[styleName] = level;
        // 也尝试用 styleId 作为名称（有些文档 styleName == styleId）
        if (styleId && styleId !== styleName) discovered[styleId] = level;
        continue;
      }
    }

    // 按名称模式匹配（处理没有 outlineLvl 但有标准名称的样式）
    if (styleName) {
      const level = matchHeadingName(styleName);
      if (level) {
        discovered[styleName] = level;
        if (styleId && styleId !== styleName) discovered[styleId] = level;
      }
    } else if (styleId) {
      // 有些样式没有 w:name（极少见），直接用 styleId
      const level = matchHeadingName(styleId);
      if (level) discovered[styleId] = level;
    }
  }

  // 第二遍：基于 w:basedOn 继承的标题样式
  for (const block of styleBlocks) {
    const basedOnMatch = block.match(/<w:basedOn[^>]*w:val="([^"]*)"/);
    if (!basedOnMatch) continue;

    const parentId = basedOnMatch[1];
    if (!discovered[parentId]) continue; // 父样式不是标题

    const typeMatch = block.match(/w:type="([^"]*)"/);
    if (typeMatch && typeMatch[1] !== 'paragraph') continue;

    const nameMatch = block.match(/<w:name[^>]*w:val="([^"]*)"/);
    const styleName = nameMatch ? nameMatch[1] : '';
    const idMatch = block.match(/w:styleId="([^"]*)"/);
    const styleId = idMatch ? idMatch[1] : '';

    const parentLevel = discovered[parentId];
    if (styleName && !discovered[styleName]) discovered[styleName] = parentLevel;
    if (styleId && styleId !== styleName && !discovered[styleId]) discovered[styleId] = parentLevel;
  }

  return discovered;
}

/** 从样式名称推断标题层级，返回 0 表示不是标题 */
function matchHeadingName(name) {
  if (!name) return 0;
  // 匹配 "Heading N" / "heading N" / "标题 N" / "TOC N" 等模式
  const m = name.match(/^(?:heading|标题|title|toc)\s*(\d)$/i);
  if (m) {
    const level = parseInt(m[1]);
    return (level >= 1 && level <= 6) ? level : 0;
  }
  return 0;
}

// ============================================================
//  构建动态 styleMap（static + discovered）
// ============================================================
function buildStyleMap(discoveredStyles) {
  // 合并：discovered 优先（文档实际定义），static 作为 fallback
  const merged = { ...STATIC_HEADING_MAP };
  for (const [name, level] of Object.entries(discoveredStyles || {})) {
    merged[name] = level;
  }

  const lines = [];
  for (const [name, lv] of Object.entries(merged)) {
    // 样式名转换为安全的 CSS class（保留中文）
    const cls = name.toLowerCase().replace(/[^a-z0-9一-鿿]+/g, '-').replace(/^-|-$/g, '');
    // 转义样式名中的单引号
    const escapedName = name.replace(/'/g, "\\'");
    lines.push(`p[style-name='${escapedName}'] => h${lv}.${cls}:fresh`);
  }
  lines.push(`table => table:fresh`);
  lines.push(`r[style-name='Strong'] => strong`);
  return lines.join("\n");
}

// ============================================================
//  主入口
// ============================================================
async function extractStructure(filePath) {
  const buffer = fs.readFileSync(filePath);
  const inputHash = crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 16);

  // 从 DOCX 内部 styles.xml 发现标题样式
  const stylesXml = readDocxStylesXml(filePath);
  const discovered = discoverHeadingStyles(stylesXml);
  if (Object.keys(discovered).length > 0) {
    console.log(`[DocStruct] 从 styles.xml 发现 ${Object.keys(discovered).length} 个标题样式:`, discovered);
  } else {
    console.log('[DocStruct] styles.xml 未发现额外标题样式，使用静态映射');
  }

  const { value: html } = await mammoth.convertToHtml({ buffer }, {
    styleMap: buildStyleMap(discovered),
    includeEmbeddedStyleMap: true,
  });

  const blocks = parseHtml(html);
  console.log(`[DocStruct] ${blocks.length} blocks (${blocks.filter(b=>b.block_type==='heading').length}h, ${blocks.filter(b=>b.block_type==='table').length}t)`);

  // ===== 调试：打印所有包含"章"的 block =====
  logChapterBlocks(blocks);

  return { blocks, inputHash, discoveredStyles: discovered };
}

/** 调试：打印所有文本含"章"的 block */
function logChapterBlocks(blocks) {
  const chapterBlocks = blocks.filter(b => {
    const t = (b.title || b.content || '');
    return t.includes('章');
  });
  if (chapterBlocks.length === 0) {
    console.log('[DocStruct] ⚠ 没有任何 block 的文本包含"章"字！');
    return;
  }
  console.log(`[DocStruct] ========== 含"章"的 block（共 ${chapterBlocks.length} 个）==========`);
  chapterBlocks.forEach((b, i) => {
    const text = (b.title || b.content || '').slice(0, 80);
    console.log(
      `  [${String(i).padStart(3)}] ` +
      `text="${text}" ` +
      `block_type="${b.block_type}" ` +
      `level=${b.structured_content?.level ?? 'null'} ` +
      `style_id="${b.style_info?.style_id || 'none'}" ` +
      `style_name="${b.style_info?.style_name || 'none'}" ` +
      `confidence=${b.structure_confidence}`
    );
  });
  console.log('[DocStruct] ==========================================');
}

// ============================================================
//  HTML → doc_blocks
//  (h[1-6]) + attrs + inner  →  groups 1,2,3
//  table … /table             →  no groups
//  (p) + attrs + inner        →  groups 4,5,6
// ============================================================
function parseHtml(html) {
  const blocks = [];
  let order = 0;
  const body = html.replace(/<html[\s\S]*?<body>/i,"").replace(/<\/body>[\s\S]*?<\/html>/i,"");

  const re = /<(h[1-6])([^>]*)>([\s\S]*?)<\/\1>|<table[\s\S]*?<\/table>|<(p)([^>]*)>([\s\S]*?)<\/\4>/gi;
  let m;
  while ((m = re.exec(body)) !== null) {
    // ---- heading ----
    if (m[1]) {
      const tag = m[1];
      const attrs = m[2] || "";
      const inner = m[3] || "";
      const level = parseInt(tag[1]);
      const text = stripHtml(inner).trim();
      if (!text) continue;

      const clsMatch = attrs.match(/class=["']([^"']*)["']/);
      const styleId = clsMatch ? clsMatch[1] : tag;

      blocks.push({
        block_type: "heading",
        title: text,
        content: text,
        structured_content: { level, numbering_hint: extractNum(text) },
        source_location: "",
        order_index: order++,
        style_info: { heading_level: level, style_id: styleId, style_name: styleIdToName(styleId) },
        numbering_info: extractNum(text),
        structure_confidence: 0.95,
      });
      continue;
    }

    // ---- table ----
    if (m[0].startsWith("<table")) {
      const { rows, headerRows } = parseTable(m[0]);
      blocks.push({
        block_type: "table", title: "", content: rows.map(r=>r.join("\t")).join("\n"),
        structured_content: { rows, header_rows: headerRows, source_metadata: {} },
        source_location: "", order_index: order++, style_info: {}, numbering_info: null, structure_confidence: 0.95,
      });
      continue;
    }

    // ---- paragraph ----
    if (m[4]) {
      const attrs = m[5] || "";
      const inner = m[6] || "";
      const text = stripHtml(inner).trim();
      if (!text) continue;
      const bold = /<strong>|<b>/i.test(inner);
      const isHeadingCandidate = bold && text.length < 60;

      const clsMatch = attrs.match(/class=["']([^"']*)["']/);
      const styleId = clsMatch ? clsMatch[1] : null;

      blocks.push({
        block_type: isHeadingCandidate ? "heading" : "paragraph",
        title: isHeadingCandidate ? text : "",
        content: text,
        structured_content: isHeadingCandidate ? { level: null, numbering_hint: extractNum(text) } : null,
        source_location: "", order_index: order++,
        style_info: { bold, style_id: styleId, style_name: styleIdToName(styleId) },
        numbering_info: extractNum(text),
        structure_confidence: isHeadingCandidate ? 0.45 : 0.9,
      });
    }
  }
  return blocks;
}

/** 将 mammoth CSS class 转换回可读的样式名 */
function styleIdToName(styleId) {
  if (!styleId) return null;
  // 已知映射
  const KNOWN = {
    'heading-1':'Heading 1','heading-2':'Heading 2','heading-3':'Heading 3',
    'heading-4':'Heading 4','heading-5':'Heading 5','heading-6':'Heading 6',
    'heading1':'Heading1','heading2':'Heading2','heading3':'Heading3',
    'heading4':'Heading4','heading5':'Heading5','heading6':'Heading6',
  };
  if (KNOWN[styleId]) return KNOWN[styleId];
  // 尝试从 kebab-case 还原：heading-3 → Heading 3, 标题-3 → 标题 3
  const restored = styleId.replace(/-(\d)$/g, ' $1');
  if (restored !== styleId) return restored;
  return styleId;
}

// ============================================================
//  辅助
// ============================================================
function stripHtml(s) {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#160;/gi, " ")
    .replace(/&#x0*[aA]0;/g, " ")
    .replace(/&quot;/g, '"')
    .trim();
}

function extractNum(text) {
  const m = text.match(/^[\s]*([\d一二三四五六七八九十]+[\.\、\)）]|（[一二三四五六七八九十]+）|[第][\d一二三四五六七八九十]+[章节条款])/);
  return m ? m[0] : null;
}

function parseTable(html) {
  const rows = [];
  const headerRows = [];
  const trs = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  trs.forEach((tr, i) => {
    const cells = (tr.match(/<t[hd][\s\S]*?<\/t[hd]>/gi) || []).map(c => stripHtml(c));
    if (cells.length) rows.push(cells);
    if (i === 0 || /<th/i.test(tr)) headerRows.push(i);
  });
  return { rows, headerRows };
}

// ============================================================
//  文本归一化
//  去除全角空格、NBSP、零宽字符、连续空白归一化
// ============================================================
function normalizeText(text) {
  if (!text) return "";
  return text
    // Unicode 空白字符 → 普通空格
    .replace(/[\u00A0\u1680\u2000-\u200F\u2028\u2029\u202F\u205F\u3000\uFEFF]/g, " ")
    // 零宽字符直接删除
    .replace(/[\u200B\u200C\u200D\u2060\uFE00-\uFE0F]/g, "")
    // 连续空白（含全角空格）归一为单个空格
    .replace(/[\s\u3000]+/g, " ")
    .trim();
}

// ============================================================
//  章节识别
// ============================================================

/**
 * 严格判断一段文本是否是"第X章"标题
 * 排除：第X条、表N、注：、说明：、B1-B8、（一）（二）、数字编号项、空文本
 */
function isStrictChapterTitle(text) {
  const s = normalizeText(text);
  if (!s) return false;

  if (!/^第[一二三四五六七八九十百零〇\d]+章/.test(s)) return false;

  // ----- 排除列表 -----
  if (/^第[一二三四五六七八九十百零〇\d]+条/.test(s)) return false;
  if (/^表\d/.test(s)) return false;
  if (/^注[：:]/.test(s)) return false;
  if (/^说明[：:]/.test(s)) return false;
  if (/^[A-H]\d/.test(s)) return false;
  if (/^[（(][一二三四五六七八九十\d]+[）)]/.test(s)) return false;
  if (/^\d+[\.\、]/.test(s)) return false;

  return true;
}

/**
 * 判断一个 block 是否应被视为顶层 chapter
 * - Text 匹配 isStrictChapterTitle → 是（不要求必须是 heading block_type）
 * - Heading 1（level === 1）→ 是
 */
function isTopLevelChapter(block) {
  const text = block.title || block.content || "";

  // 方式1：文本模式匹配（对 paragraph 和 heading 都有效）
  if (isStrictChapterTitle(text)) return true;

  // 方式2：Heading 1 样式
  if (block.block_type === "heading" && block.structured_content?.level === 1) return true;

  return false;
}

/**
 * 返回详细判断结果（给 buildChapterTree 使用）
 */
function isTopChapter(block) {
  const text = block.title || block.content || "";

  if (isStrictChapterTitle(text)) {
    return { isChapter: true, reason: block.block_type === "heading" ? "heading+pattern" : "paragraph+pattern" };
  }

  if (block.block_type === "heading" && block.structured_content?.level === 1) {
    return { isChapter: true, reason: "Heading1" };
  }

  return { isChapter: false, reason: null };
}

function isSectionBoundary(block) {
  const text = block.title || block.content || "";
  const normalized = normalizeText(text);
  const level = block.structured_content?.level;

  // Heading 2-6
  if (level && level >= 2 && level <= 6) return true;

  // 编号子标题
  if (/^[（(][一二三四五六七八九十\d]+[）)]/.test(normalized)) return true;
  if (/^[\d]+[\.\、]/.test(normalized)) return true;
  if (/^[A-H][1-9]\d*/.test(normalized)) return true;

  // 高置信度短标题
  if (block.structure_confidence >= 0.9 && block.block_type === "heading") return true;

  return false;
}

function buildChapterTree(blocks) {
  const chapters = [];
  let currentChapter = null;
  let currentSection = null;
  let paraChapterCount = 0;

  for (const b of blocks) {
    // ★ 关键改动：不限制 block_type，paragraph 也可以成为 chapter
    if (b.block_type !== "heading" && b.block_type !== "paragraph") continue;

    const topCheck = isTopChapter(b);
    if (topCheck.isChapter) {
      // 统计从 paragraph 提升的 chapter
      if (b.block_type === "paragraph") paraChapterCount++;

      currentChapter = {
        id: `ch${chapters.length + 1}`,
        title: b.title || b.content,
        level: b.structured_content?.level || 1,
        confidence: b.structure_confidence,
        block_start: b.order_index,
        block_end: blocks[blocks.length - 1].order_index,
        sections: [],
        _from_paragraph: b.block_type === "paragraph",
      };
      chapters.push(currentChapter);
      currentSection = null;
      continue;
    }

    // section 边界仍然只对 heading 判断
    if (b.block_type !== "heading") continue;

    if (currentChapter && isSectionBoundary(b)) {
      currentSection = {
        id: `sec_${currentChapter.id}_${currentChapter.sections.length + 1}`,
        title: b.title,
        block_start: b.order_index,
        chapter_id: currentChapter.id,
      };
      currentChapter.sections.push(currentSection);
    }
  }

  if (paraChapterCount > 0) {
    console.log(`[buildChapterTree] ${paraChapterCount} 个 chapter 从 paragraph 提升`);
  }

  // 计算 block 范围
  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    const nextCh = chapters[i + 1];
    ch.block_end = nextCh ? nextCh.block_start - 1 : blocks[blocks.length - 1].order_index;

    for (let j = 0; j < ch.sections.length; j++) {
      const sec = ch.sections[j];
      const nextSec = ch.sections[j + 1];
      sec.block_end = nextSec ? nextSec.block_start - 1 : ch.block_end;
    }
  }

  return chapters;
}

function buildParseTasks(blocks, chapters) {
  const tasks = [];
  for (const ch of chapters) {
    if (ch.sections.length > 0) {
      for (const sec of ch.sections) {
        tasks.push({
          chapter_id: ch.id,
          chapter_title: ch.title,
          section_id: sec.id,
          section_title: sec.title,
          block_start: sec.block_start,
          block_end: sec.block_end,
        });
      }
    } else {
      tasks.push({
        chapter_id: ch.id,
        chapter_title: ch.title,
        section_id: null,
        section_title: null,
        block_start: ch.block_start,
        block_end: ch.block_end,
      });
    }
  }
  return tasks;
}

module.exports = {
  extractStructure,
  buildChapterTree,
  buildParseTasks,
  normalizeText,
  isStrictChapterTitle,
  isTopLevelChapter,
  // 也导出内部工具，方便调试
  readDocxStylesXml,
  discoverHeadingStyles,
};
