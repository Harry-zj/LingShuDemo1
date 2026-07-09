/**
 * 五维评分转换工具（后端版）
 * 与前端 client/src/utils/scoreHelper.js 保持同步
 */

const DIM_KEYS = ["zhiyu", "deyu", "tiyu", "meiyu", "laoyu"];
const DIM_NAMES = { zhiyu: "智育", deyu: "德育", tiyu: "体育", meiyu: "美育", laoyu: "劳育" };

function clamp(val, min = 0, max = 100) {
  const n = Number(val);
  if (isNaN(n)) return 0;
  return Math.max(min, Math.min(max, n));
}

/**
 * 将原始数据转为五维评分（各维度计算器待组员根据实际数据格式填充）
 * @param {Object} raw - 原始数据
 * @returns {{ zhiyu, deyu, tiyu, meiyu, laoyu }}
 */
function rawToDimensions(raw) {
  if (!raw) return Object.fromEntries(DIM_KEYS.map(k => [k, 0]));
  return {
    zhiyu: calcZhiyu(raw),
    deyu: calcDeyu(raw),
    tiyu: calcTiyu(raw),
    meiyu: calcMeiyu(raw),
    laoyu: calcLaoyu(raw),
  };
}

// ---------- 各维度计算器（TODO: 组员根据实际数据源实现） ----------

function calcZhiyu(raw) {
  if (raw.zhiyu != null) return clamp(raw.zhiyu);
  if (raw.gpa != null) return clamp(raw.gpa * 20);
  return 0;
}
function calcDeyu(raw) {
  if (raw.deyu != null) return clamp(raw.deyu);
  return 0;
}
function calcTiyu(raw) {
  if (raw.tiyu != null) return clamp(raw.tiyu);
  return 0;
}
function calcMeiyu(raw) {
  if (raw.meiyu != null) return clamp(raw.meiyu);
  return 0;
}
function calcLaoyu(raw) {
  if (raw.laoyu != null) return clamp(raw.laoyu);
  return 0;
}

/**
 * 计算五维总分（可加权，默认均权 0.2）
 */
function calcTotalScore(dims, weights = {}) {
  return parseFloat(
    DIM_KEYS.reduce((sum, k) => sum + (dims[k] || 0) * (weights[k] ?? 0.2), 0).toFixed(2)
  );
}

module.exports = { rawToDimensions, calcTotalScore, DIM_KEYS, DIM_NAMES, clamp };
