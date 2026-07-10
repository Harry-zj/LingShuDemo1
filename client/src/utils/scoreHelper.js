/**
 * 五维评分转换工具
 * 将综测原始数据（F类/A类/B类分数）映射为"德智体美劳"五维
 */

// ============================================================
// 常量
// ============================================================

export const DIMENSION_KEYS = ["de", "zhi", "ti", "mei", "lao"]

export const DIMENSION_CONFIG = [
  { key: "de",  name: "德", color: "#D97706", desc: "思想政治 · 道德品质 · 纪律观念" },
  { key: "zhi", name: "智", color: "#4F46E5", desc: "课程成绩 · 学术竞赛 · 科技学术" },
  { key: "ti",  name: "体", color: "#059669", desc: "身心健康 · 文体竞赛" },
  { key: "mei", name: "美", color: "#7C3AED", desc: "宣传报道" },
  { key: "lao", name: "劳", color: "#EA580C", desc: "社会实践 · 劳动教育 · 社会工作" },
]

/** 等级划分 */
export function getGradeLevel(score) {
  if (score >= 90) return { label: "优秀", color: "#059669", bg: "#ECFDF5" }
  if (score >= 80) return { label: "良好", color: "#4F46E5", bg: "#EEF2FF" }
  if (score >= 70) return { label: "中等", color: "#D97706", bg: "#FFFBEB" }
  if (score >= 60) return { label: "合格", color: "#DC2626", bg: "#FEF2F2" }
  return { label: "待提升", color: "#9CA3AF", bg: "#F3F4F6" }
}

// ============================================================
// 五维计算
// ============================================================

/**
 * 将原始综测数据映射为五维（0-100）
 * @param {{ aScores: {}, bScores: {}, scores: {} }} data
 * @returns {{ de: number, zhi: number, ti: number, mei: number, lao: number }}
 */
export function rawToDimensions(data) {
  if (!data) return Object.fromEntries(DIMENSION_KEYS.map(k => [k, 0]))
  const { aScores = {}, bScores = {}, scores = {} } = data
  return {
    de:  calcDe(aScores),
    zhi: calcZhi(scores, bScores),
    ti:  calcTi(aScores, bScores),
    mei: calcMei(bScores),
    lao: calcLao(bScores),
  }
}

/**
 * 德：A1×0.4 + A2×0.3 + A4×0.3 → 满分20 → 归一化×100
 */
function calcDe(a) {
  const raw = (a.A1 || 0) * 0.4 + (a.A2 || 0) * 0.3 + (a.A4 || 0) * 0.3
  return clamp(raw / 20 * 100, 0, 100)
}

/**
 * 智：F2×0.4 + B1×0.2 + B2×0.2 + B3×0.2 → 满分58 → 归一化×100
 */
function calcZhi(s, b) {
  const raw = (s.F2 || 0) * 0.4 + (b.B1 || 0) * 0.2 + (b.B2 || 0) * 0.2 + (b.B3 || 0) * 0.2
  return clamp(raw / 58 * 100, 0, 100)
}

/**
 * 体：A5×0.4 + B7×0.6 → 满分26 → 归一化×100
 */
function calcTi(a, b) {
  const raw = (a.A5 || 0) * 0.4 + (b.B7 || 0) * 0.6
  return clamp(raw / 26 * 100, 0, 100)
}

/**
 * 美：B4 → 满分30 → 归一化×100
 */
function calcMei(b) {
  return clamp((b.B4 || 0) / 30 * 100, 0, 100)
}

/**
 * 劳：B6×0.5 + B8×0.3 + B5×0.2 → 满分30 → 归一化×100
 */
function calcLao(b) {
  const raw = (b.B6 || 0) * 0.5 + (b.B8 || 0) * 0.3 + (b.B5 || 0) * 0.2
  return clamp(raw / 30 * 100, 0, 100)
}

// ============================================================
// 总分（F 体系）
// ============================================================

/**
 * 综测总分 F = F1×10% + F2×65% + F3×25%
 */
export function calcTotalScore(scores = {}) {
  const { F1 = 0, F2 = 0, F3 = 0 } = scores
  return parseFloat((F1 * 0.1 + F2 * 0.65 + F3 * 0.25).toFixed(2))
}

// ============================================================
// 工具
// ============================================================

function clamp(val, min = 0, max = 100) {
  const n = Number(val)
  if (isNaN(n)) return 0
  return Math.max(min, Math.min(max, n.toFixed(1)))
}
