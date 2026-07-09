/**
 * 五维评分转换工具
 * ------------------------------------------------
 * 用途：将各种原始数据（GPA、活动记录、体测成绩等）统一转换成五维格式：
 *   { zhiyu: 0-100, deyu: 0-100, tiyu: 0-100, meiyu: 0-100, laoyu: 0-100 }
 *
 * 使用方式：
 *   import { rawToDimensions } from "@/utils/scoreHelper"
 *   const dims = rawToDimensions(rawData)
 *
 * 扩展方式：
 *   当你知道每个维度的原始数据字段后，修改下面五个 calcXxx 函数即可。
 *   每个函数入参是原始数据对象，返回值是 0-100 的数值。
 */

// ============================================================
// 维度计算器（每个维度一个函数，组员各自实现具体规则）
// ============================================================

/**
 * 智育（学业成绩）
 * @param {Object} raw - 原始数据，字段待定
 * @returns {number} 0-100
 */
function calcZhiyu(raw) {
  // TODO: 替换为真实计算逻辑
  // 示例：GPA * 20 + 竞赛加分
  if (raw.zhiyu != null) return clamp(raw.zhiyu, 0, 100)
  if (raw.gpa != null) return clamp(raw.gpa * 20, 0, 100)
  return 0
}

/**
 * 德育（思想品德）
 * @param {Object} raw - 原始数据，字段待定
 * @returns {number} 0-100
 */
function calcDeyu(raw) {
  if (raw.deyu != null) return clamp(raw.deyu, 0, 100)
  // TODO: 示例：志愿时长(h) * 2 + 思政课成绩 * 0.4
  return 0
}

/**
 * 体育（体育锻炼）
 * @param {Object} raw - 原始数据，字段待定
 * @returns {number} 0-100
 */
function calcTiyu(raw) {
  if (raw.tiyu != null) return clamp(raw.tiyu, 0, 100)
  // TODO: 示例：体测成绩 * 0.6 + 体育课成绩 * 0.4
  return 0
}

/**
 * 美育（审美与艺术）
 * @param {Object} raw - 原始数据，字段待定
 * @returns {number} 0-100
 */
function calcMeiyu(raw) {
  if (raw.meiyu != null) return clamp(raw.meiyu, 0, 100)
  // TODO: 替换为真实计算逻辑
  return 0
}

/**
 * 劳育（劳动实践）
 * @param {Object} raw - 原始数据，字段待定
 * @returns {number} 0-100
 */
function calcLaoyu(raw) {
  if (raw.laoyu != null) return clamp(raw.laoyu, 0, 100)
  // TODO: 替换为真实计算逻辑
  return 0
}

// ============================================================
// 工具函数
// ============================================================

/** 将数值限制在 [min, max] 范围 */
function clamp(val, min, max) {
  const n = Number(val)
  if (isNaN(n)) return 0
  return Math.max(min, Math.min(max, n))
}

/** 归一化：将原始分数映射到 0-100 */
function normalize(value, maxValue) {
  if (!maxValue || maxValue === 0) return 0
  return clamp((Number(value) || 0) / maxValue * 100, 0, 100)
}

// ============================================================
// 主入口
// ============================================================

/** 计算器注册表 */
const calculators = {
  zhiyu: calcZhiyu,
  deyu: calcDeyu,
  tiyu: calcTiyu,
  meiyu: calcMeiyu,
  laoyu: calcLaoyu,
}

/**
 * 将原始数据转换为五维评分
 * @param {Object} raw - 原始数据对象（字段格式不限）
 * @returns {{ zhiyu: number, deyu: number, tiyu: number, meiyu: number, laoyu: number }}
 */
export function rawToDimensions(raw) {
  if (!raw) return { zhiyu: 0, deyu: 0, tiyu: 0, meiyu: 0, laoyu: 0 }
  return {
    zhiyu: calculators.zhiyu(raw),
    deyu: calculators.deyu(raw),
    tiyu: calculators.tiyu(raw),
    meiyu: calculators.meiyu(raw),
    laoyu: calculators.laoyu(raw),
  }
}

/**
 * 计算五维总分（可加权）
 * @param {Object} dims - { zhiyu, deyu, tiyu, meiyu, laoyu }
 * @param {Object} weights - 各维度权重，默认均等
 * @returns {number}
 */
export function calcTotalScore(dims, weights = {}) {
  const keys = ["zhiyu", "deyu", "tiyu", "meiyu", "laoyu"]
  const w = keys.map(k => weights[k] ?? 0.2)
  return parseFloat(keys.reduce((sum, k, i) => sum + (dims[k] || 0) * w[i], 0).toFixed(2))
}

/**
 * 替换某个维度的计算器（运行时动态注入）
 * @param {string} key - zhiyu | deyu | tiyu | meiyu | laoyu
 * @param {Function} fn - (raw) => number
 */
export function registerCalculator(key, fn) {
  if (calculators[key]) calculators[key] = fn
}

// ============================================================
// 常量
// ============================================================

export const DIMENSION_NAMES = {
  zhiyu: "智育",
  deyu: "德育",
  tiyu: "体育",
  meiyu: "美育",
  laoyu: "劳育",
}

export const DIMENSION_COLORS = {
  zhiyu: "#1A73E8",
  deyu: "#EA8600",
  tiyu: "#34A853",
  meiyu: "#9C27B0",
  laoyu: "#FF6D00",
}

export { normalize, clamp }
