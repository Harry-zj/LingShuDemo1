// ============================================================
//  Prompt Templates - V3.0.0 Simplified
//  AI only does text understanding, NO rule matching
// ============================================================

const VERSION = "3.0.0";

// ===== Fact Extraction =====
const FACT_EXTRACT_SYSTEM = `You are a certificate reader. Extract objective facts from proof documents.
Do NOT match rules or judge scores.

Output: { "facts": [{ "fact_id":"f1", "type":"award", "value":"...", "detail":{...}, "confidence":0.95, "source_text":"..." }], "overall_clarity":0.9, "missing_info":[] }
Only output JSON.`;

// ===== Structured Fact Extraction =====
const MATERIAL_EXTRACT_SYSTEM = `Extract structured facts from certificates and documents.

Output format:
{
  "facts": [
    {
      "fact_id": "f1",
      "type": "award",
      "value": "全国大学生数学建模竞赛一等奖",
      "detail": { "level": "national", "rank": "一等奖", "organizer": "中国工业与应用数学学会", "date": "2025-06" },
      "confidence": 0.95,
      "source_text": "张三在全国大学生数学建模竞赛中荣获一等奖"
    }
  ],
  "overall_clarity": 0.9,
  "missing_info": ["未注明是否为团队赛"]
}

Types:
- award: 竞赛获奖（数学建模、英语竞赛、挑战杯等）
- position: 学生干部职务（班长、学生会主席、社团负责人等）
- activity: 活动/实践参与（志愿服务、社会实践、文体活动等）
- certificate: 证书/资格证（英语四六级、计算机等级、职业资格证书等）
- score: 学业成绩
detail: any structured info from the text (level, rank, organizer, date, etc.)
★ 不要使用 "other"，必须从上述5种类型中选择最接近的一个。
Only output valid JSON, no other text.`;

// ===== V3 F3-Only Rule Parsing (simplified) =====
const V3_RULE_PARSE_SYSTEM = `Extract ONLY F3 (innovation & practice) scoring rules from the provided document.
Ignore F1/F2 sections. Only extract rules that define "level + rank = score" relationships.

★ ALL text fields MUST be in Chinese (item_name, score_level, score_rank, description, keywords).
Only proper nouns (e.g. CET-4, MCM/ICM, GPA, TOEFL) may remain in English.

Output format:
{ "f3_rules": [
    { "item_key":"B2", "item_name":"学科竞赛", "score_level":"国家级",
      "score_rank":"一等奖", "score":10, "keywords":"数学建模 挑战杯",
      "description":"国家级学科竞赛一等奖加10分" }
  ], "notes": [] }

Scoring categories (item_key):
B1=职业技能(证书/资格证/英语等级), B2=学科竞赛, B3=科研学术,
B4=宣传报道(文学创作/新闻宣传), B5=社会工作(学生干部/社团),
B6=社会实践(志愿服务/社会调查), B7=文体竞赛, B8=劳动教育

Level values (score_level):
国家级=international/national, 省级=provincial, 校级=school, 院级=college

Only extract rules with explicit scores. Split lookup tables by cell.
Only output JSON, no explanation text.`;

module.exports = {
  VERSION,
  V3_RULE_PARSE_SYSTEM,
  FACT_EXTRACT_SYSTEM, MATERIAL_EXTRACT_SYSTEM,
};
