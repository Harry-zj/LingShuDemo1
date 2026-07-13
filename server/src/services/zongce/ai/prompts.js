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
const V3_RULE_PARSE_SYSTEM = `Extract ONLY F3 (innovation & practice) scoring rules.
Ignore F1/F2. Only extract "level + rank = score" rules.

Output:
{ "f3_rules": [
    { "item_key":"B2", "item_name":"discipline competition", "score_level":"national",
      "score_rank":"first prize", "score":10, "keywords":"math modeling challenge cup",
      "description":"National discipline competition first prize" }
  ], "notes": [] }

Fields: item_key(B1~B8), score_level(national/provincial/school/college),
score_rank(original text), score(integer), keywords(space-separated), description
Only extract rules with explicit scores. Split lookup tables by cell.
Only output JSON.`;

module.exports = {
  VERSION,
  V3_RULE_PARSE_SYSTEM,
  FACT_EXTRACT_SYSTEM, MATERIAL_EXTRACT_SYSTEM,
};
