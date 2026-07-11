/**
 * 五维评分转换工具
 * 将综测原始数据（F类/A类/B类分数）映射为"德智体美劳"五维
 * 
 * 本文件是项目中公式定义的唯一来源（Single Source of Truth）
 */

export const DIMENSION_KEYS = ["de", "zhi", "ti", "mei", "lao"]

export const DIMENSION_CONFIG = [
  { key: "de",  name: "德", color: "#D97706", desc: "思想政治 · 道德品质 · 纪律观念" },
  { key: "zhi", name: "智", color: "#4F46E5", desc: "课程成绩 · 学术竞赛 · 科技学术" },
  { key: "ti",  name: "体", color: "#059669", desc: "身心健康 · 文体竞赛" },
  { key: "mei", name: "美", color: "#7C3AED", desc: "宣传报道" },
  { key: "lao", name: "劳", color: "#EA580C", desc: "社会实践 · 劳动教育 · 社会工作" },
]

export function getGradeLevel(score) {
  if (score >= 90) return { label: "优秀", color: "#059669", bg: "#ECFDF5" }
  if (score >= 80) return { label: "良好", color: "#4F46E5", bg: "#EEF2FF" }
  if (score >= 70) return { label: "中等", color: "#D97706", bg: "#FFFBEB" }
  if (score >= 60) return { label: "合格", color: "#DC2626", bg: "#FEF2F2" }
  return { label: "待提升", color: "#9CA3AF", bg: "#F3F4F6" }
}

// ============================================================
// 原始加权和（未归一化，供 UI 展示明细用）
// ============================================================

export function calcDeRaw(a = {}) {
  return (a.A1 || 0) * 0.4 + (a.A2 || 0) * 0.3 + (a.A4 || 0) * 0.3
}
export function calcZhiRaw(s = {}, b = {}) {
  return (s.F2 || 0) * 0.4 + (b.B1 || 0) * 0.2 + (b.B2 || 0) * 0.2 + (b.B3 || 0) * 0.2
}
export function calcTiRaw(a = {}, b = {}) {
  return (a.A5 || 0) * 0.4 + (b.B7 || 0) * 0.6
}
export function calcMeiRaw(_a = {}, b = {}) {
  return (b.B4 || 0)
}
export function calcLaoRaw(_a = {}, b = {}) {
  return (b.B6 || 0) * 0.5 + (b.B8 || 0) * 0.3 + (b.B5 || 0) * 0.2
}

export const DIM_MAX_RAW = { de: 20, zhi: 58, ti: 26, mei: 30, lao: 30 }

// ============================================================
// 归一化计算（0-100 分）
// ============================================================

function clamp(val, min = 0, max = 100) {
  const n = Number(val)
  if (isNaN(n)) return 0
  return Math.max(min, Math.min(max, parseFloat(n.toFixed(1))))
}

function calcDe(a) { return clamp(calcDeRaw(a) / 20 * 100) }
function calcZhi(s, b) { return clamp(calcZhiRaw(s, b) / 58 * 100) }
function calcTi(a, b) { return clamp(calcTiRaw(a, b) / 26 * 100) }
function calcMei(a, b) { return clamp(calcMeiRaw(a, b) / 30 * 100) }
function calcLao(a, b) { return clamp(calcLaoRaw(a, b) / 30 * 100) }

export function rawToDimensions(data) {
  if (!data) return Object.fromEntries(DIMENSION_KEYS.map(k => [k, 0]))
  const { aScores = {}, bScores = {}, scores = {} } = data
  return {
    de:  calcDe(aScores),
    zhi: calcZhi(scores, bScores),
    ti:  calcTi(aScores, bScores),
    mei: calcMei(aScores, bScores),
    lao: calcLao(aScores, bScores),
  }
}

export function calcTotalScore(scores = {}) {
  const { F1 = 0, F2 = 0, F3 = 0 } = scores
  return parseFloat((F1 * 0.1 + F2 * 0.65 + F3 * 0.25).toFixed(2))
}
