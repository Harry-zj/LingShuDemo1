<template>
  <div class="history-section" v-if="history">
    <!-- 0个学期：空 -->
    <template v-if="semesters.length === 0">
      <div class="card glass-card empty-state">
        <div class="empty-icon">🎉</div>
        <p>欢迎来到你的第一次综测评定！</p>
        <span>完成首次评定后，这里将展示你的成长轨迹</span>
      </div>
    </template>

    <!-- 1个学期：首次评定引导 -->
    <div class="card glass-card reveal" v-else-if="semesters.length === 1">
      <div class="card-accent" style="background: var(--color-primary)"></div>
      <h3><VIcon icon="mdi:chart-line-variant" /> 历史发展</h3>
      <div class="first-time-guide">
        <div class="ft-emoji-wrap">
          <span class="ft-emoji ft-float">🎉</span>
          <span class="ft-spark ft-s1">✨</span>
          <span class="ft-spark ft-s2">⭐</span>
          <span class="ft-spark ft-s3">💫</span>
        </div>
        <p class="ft-title">欢迎来到你的第一次综测评定！</p>
        <p class="ft-subtitle">这是你成长旅程的起点，每个维度都值得被记录</p>
        <div class="ft-dims">
          <div class="ft-dim-card" v-for="(d, i) in DIM_CONFIG" :key="d.key"
            :style="{ animationDelay: (0.3 + i * 0.1) + 's', borderColor: d.color }">
            <div class="ftd-dot" :style="{ background: d.color }"></div>
            <span class="ftd-name">{{ d.name }}</span>
            <span class="ftd-score" :style="{ color: d.color }">{{ currentScores[d.key] || "--" }}</span>
            <span class="ftd-unit">分</span>
          </div>
        </div>
        <div class="ft-footer">
          <span class="ft-arrow ft-bounce">👇</span>
          <p class="ft-hint">下个学年回来看你的成长轨迹！</p>
        </div>
      </div>
    </div>

    <!-- ≥2个学期：完整展示 -->
    <template v-else>
      <!-- 模块1：统计摘要卡片 -->
      <div class="stats-row">
        <div class="stat-card glass-card reveal" v-for="(s, i) in summaryCards" :key="s.label"
          :style="{ animationDelay: (0.1 + i * 0.07) + 's' }">
          <div class="stat-icon">{{ s.icon }}</div>
          <div class="stat-num" :style="{ color: s.color }">{{ s.value }}</div>
          <div class="stat-lbl">{{ s.label }}</div>
        </div>
      </div>

      <!-- 模块2+3：五维发展折线图 + 总分排名变化（左右布局） -->
      <div class="card glass-card reveal" style="animation-delay: 0.3s;">
        <div class="card-accent" style="background: var(--color-primary)"></div>
        <h3><VIcon icon="mdi:chart-line-variant" /> 五维发展与排名变化</h3>
        <div class="charts-grid">
          <div class="charts-left">
            <div class="chart-subtitle">五维发展</div>
            <div ref="dimLineRef" class="chart-box"></div>
          </div>
          <div class="charts-right">
            <div class="chart-subtitle">总分与排名</div>
            <div ref="scoreRankRef" class="chart-box"></div>
            <div class="chart-note" v-if="trendNote">{{ trendNote }}</div>
          </div>
        </div>
      </div>

      <!-- 模块4：各维度变化明细表 -->
      <div class="card glass-card reveal" style="animation-delay: 0.4s;">
        <div class="card-accent" style="background: var(--color-meiyu)"></div>
        <h3><VIcon icon="mdi:table-large" /> 各维度变化明细</h3>
        <div class="detail-table-wrap">
          <table class="detail-table">
            <thead>
              <tr>
                <th>维度</th>
                <th v-for="s in semesters" :key="s.year">{{ s.year }}</th>
                <th>总变化</th>
                <th>趋势</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="d in dimDetailRows" :key="d.key">
                <td><span class="td-dot" :style="{ background: d.color }"></span>{{ d.icon }} {{ d.name }}</td>
                <td v-for="(v, idx) in d.values" :key="idx">
                  {{ v.score }}
                  <span v-if="idx > 0" :class="v.change > 0 ? 'arrow-up' : v.change < 0 ? 'arrow-down' : 'arrow-flat'">
                    {{ v.change > 0 ? '↑' + v.change : v.change < 0 ? '↓' + Math.abs(v.change) : '→' }}
                  </span>
                </td>
                <td :class="d.totalChange > 0 ? 'text-green' : d.totalChange < 0 ? 'text-red' : 'text-gray'">
                  {{ d.totalChange > 0 ? '+' : '' }}{{ d.totalChange }}
                </td>
                <td>{{ d.trend }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 模块5：趋势总结 -->
      <div class="card glass-card reveal trend-summary" style="animation-delay: 0.5s;">
        <div class="card-accent" style="background: var(--color-primary-gradient-bright)"></div>
        <h3><VIcon icon="mdi:text-box-check-outline" /> 趋势总结</h3>
        <div class="ts-section" v-for="(part, i) in trendParts" :key="i">
          <p>{{ part }}</p>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from "vue"
import * as echarts from "echarts"
import { getHistory } from "../api/module2"
import { DIMENSION_CONFIG } from "../utils/scoreHelper"

const props = defineProps({
  currentDimensions: { type: Object, default: () => ({}) },
  selectedYear: { type: String, default: null },  // "大一" | "大二" | "大三"
})

const yearOrder = ["大一", "大二", "大三"]

// 常量
const DIM_CONFIG = DIMENSION_CONFIG
const dimLineColors = { de: "#EF4444", zhi: "#3B82F6", ti: "#10B981", mei: "#8B5CF6", lao: "#F59E0B" }
const dimIcons = { de: "⭐", zhi: "📚", ti: "🏃", mei: "🎨", lao: "🔧" }

// 数据
const history = ref(null)
const dimLineRef = ref(null)
const scoreRankRef = ref(null)
let dimChart = null, scoreRankChart = null
const currentScores = computed(() => props.currentDimensions || {})

const semesters = computed(() => {
  const all = history.value?.semesters || []
  if (!props.selectedYear) return all
  const idx = yearOrder.indexOf(props.selectedYear)
  return idx >= 0 ? all.filter(s => yearOrder.indexOf(s.year) <= idx) : all
})

// ---- 模块1：统计摘要 ----
const summaryCards = computed(() => {
  const ss = semesters.value
  if (ss.length < 2) return []
  const first = ss[0], last = ss[ss.length - 1]
  const totalChange = last.scores.total - first.scores.total
  const dimChanges = DIM_CONFIG.map(d => ({ ...d, change: (last.scores[d.key] || 0) - (first.scores[d.key] || 0) })).sort((a, b) => b.change - a.change)
  const best = dimChanges[0], worst = dimChanges[dimChanges.length - 1]
  return [
    { label: "总趋势", value: totalChange > 3 ? "📈 上升" : totalChange < -3 ? "📉 下降" : "➡️ 稳定", color: totalChange > 3 ? "#059669" : totalChange < -3 ? "#DC2626" : "#9CA3AF", icon: totalChange > 3 ? "📈" : totalChange < -3 ? "📉" : "➡️" },
    { label: "总分变化", value: `${first.scores.total} → ${last.scores.total} (${totalChange >= 0 ? '+' : ''}${totalChange.toFixed(1)})`, color: totalChange >= 0 ? "#059669" : "#DC2626", icon: totalChange >= 0 ? "📈" : "📉" },
    { label: "最快进步", value: `${dimIcons[best?.key] || ""}${best?.name} (+${best?.change || 0}分)`, color: "#059669", icon: "🚀" },
    { label: "最快下降", value: worst?.change < -3 ? `${dimIcons[worst?.key] || ""}${worst?.name} (${worst?.change}分)` : "暂无下降维度", color: worst?.change < -3 ? "#DC2626" : "#9CA3AF", icon: worst?.change < -3 ? "📉" : "✅" },
    { label: "数据跨度", value: `${ss.length} 个学年`, color: "var(--color-primary)", icon: "📅" },
  ]
})

// ---- 模块2：五维折线图 ----
function buildDimLineChart() {
  if (!dimLineRef.value || semesters.value.length < 2) return
  if (!dimChart) dimChart = echarts.init(dimLineRef.value)
  dimChart.setOption({
    tooltip: { trigger: "axis" },
    legend: { data: DIM_CONFIG.map(d => d.name), bottom: 0, textStyle: { fontSize: 12 } },
    grid: { left: 12, right: 24, top: 16, bottom: 50 },
    xAxis: { type: "category", data: semesters.value.map(s => s.year), axisLabel: { fontSize: 12 } },
    yAxis: { type: "value", min: 40, max: 100, axisLabel: { fontSize: 11 } },
    series: DIM_CONFIG.map(d => ({
      name: d.name, type: "line",
      data: semesters.value.map(s => s.scores[d.key] || 0),
      itemStyle: { color: dimLineColors[d.key] || d.color },
      lineStyle: { color: dimLineColors[d.key] || d.color, width: 2 },
      symbol: "circle", symbolSize: 6,
    }))
  })
}

// ---- 模块3：总分排名图 ----
const trendNote = computed(() => {
  const ss = semesters.value
  if (ss.length < 2) return ""
  const f = ss[ss.length - 1].scores.total - ss[0].scores.total
  const r = ss[0].ranking.majorRank - ss[ss.length - 1].ranking.majorRank
  if (f > 0 && r > 0) return "📈 总分和排名同步上升"
  if (f < 0 && r > 0) return "⚠️ 排名进步但总分下降，可能是整体难度增加"
  return ""
})

function buildScoreRankChart() {
  if (!scoreRankRef.value || semesters.value.length < 2) return
  if (!scoreRankChart) scoreRankChart = echarts.init(scoreRankRef.value)
  scoreRankChart.setOption({
    tooltip: { trigger: "axis" },
    legend: { data: ["总分", "专业排名"], bottom: 0, textStyle: { fontSize: 12 } },
    grid: { left: 12, right: 50, top: 16, bottom: 50 },
    xAxis: { type: "category", data: semesters.value.map(s => s.year), axisLabel: { fontSize: 12 } },
    yAxis: [
      { type: "value", name: "总分", min: 60, max: 100, axisLabel: { fontSize: 11 } },
      { type: "value", name: "排名", min: 1, inverse: true, axisLabel: { fontSize: 11 } }
    ],
    series: [
      { name: "总分", type: "line", data: semesters.value.map(s => s.scores.total), yAxisIndex: 0, itemStyle: { color: "#4F46E5" }, lineStyle: { color: "#4F46E5", width: 2 }, symbol: "circle", symbolSize: 6 },
      { name: "专业排名", type: "line", data: semesters.value.map(s => s.ranking.majorRank), yAxisIndex: 1, itemStyle: { color: "#F59E0B" }, lineStyle: { color: "#F59E0B", width: 2, type: "dashed" }, symbol: "diamond", symbolSize: 8 },
    ]
  })
}

// ---- 模块4：维度变化明细表 ----
const dimDetailRows = computed(() => {
  const ss = semesters.value
  return DIM_CONFIG.map(d => {
    const values = ss.map((s, idx) => {
      const score = s.scores[d.key] || 0
      const prev = idx > 0 ? (ss[idx - 1].scores[d.key] || 0) : null
      return { score, change: prev != null ? score - prev : 0 }
    })
    const totalChange = values.length > 1 ? values[values.length - 1].score - values[0].score : 0
    const allUp = values.slice(1).every(v => v.change > 0)
    const allDown = values.slice(1).every(v => v.change < 0)
    const trend = allUp ? "📈持续上升" : allDown ? "📉持续下降" : totalChange > 5 ? "📈显著进步" : totalChange < -5 ? "📉明显下滑" : "➡️波动"
    return { ...d, icon: dimIcons[d.key] || "", values, totalChange, trend }
  })
})

// ---- 模块5：趋势总结 ----
const trendParts = computed(() => {
  const ss = semesters.value
  if (ss.length < 2) return ["🎉 这是你的首次评定，期待未来的成长！"]
  const first = ss[0], last = ss[ss.length - 1]
  const totalChange = last.scores.total - first.scores.total
  const rankChange = first.ranking.majorRank - last.ranking.majorRank
  const dimChanges = DIM_CONFIG.map(d => ({
    ...d,
    icon: dimIcons[d.key],
    change: (last.scores[d.key] || 0) - (first.scores[d.key] || 0)
  })).sort((a, b) => b.change - a.change)

  const best = dimChanges[0], worst = dimChanges[dimChanges.length - 1]

  const trendWord = totalChange > 5 ? "显著上升趋势" : totalChange >= 2 ? "稳中有进" : totalChange >= -3 ? "保持稳定" : "有所下降，需要关注"
  const rankWord = rankChange > 5 ? "表现突出！" : rankChange >= 1 ? "有所进步" : rankChange > -5 ? "略有下滑" : "需引起重视"
  const bestRating = Math.max(...ss.map(s => ({ "待提升": 0, "合格": 1, "中等": 2, "良好": 3, "优秀": 4 })[s.rating] || 0))
  const outlook = bestRating >= 4 ? "继续保持，你是班级中的标杆！" : bestRating >= 3 ? "距离'优秀'只有一步之遥，继续加油！" : bestRating >= 2 ? "建议针对短板制定提升计划，争取下学年冲击'良好'。" : "建议与辅导员沟通，制定个性化改进方案。"

  const parts = []
  parts.push(`【整体趋势】你的综合素质呈${trendWord}，总分从 ${first.scores.total} 分提升至 ${last.scores.total} 分，${totalChange >= 0 ? '提升' : '下降'}了 ${Math.abs(totalChange).toFixed(1)} 分。`)
  parts.push(`【排名变化】你在同年级同专业中的排名从第 ${first.ranking.majorRank} 名变为第 ${last.ranking.majorRank} 名，${rankChange > 0 ? '进步' : '后退'}了 ${Math.abs(rankChange)} 名，${rankWord}`)
  if (best && best.change >= 3) parts.push(`【最大亮点】你的"${best.icon}${best.name}"从 ${first.scores[best.key] || "?"} 分提升至 ${last.scores[best.key] || "?"} 分，提升了 ${best.change} 分，进步显著！`)
  if (worst && worst.change <= -3) parts.push(`【需要关注】你的"${worst.icon}${worst.name}"从 ${first.scores[worst.key] || "?"} 分降至 ${last.scores[worst.key] || "?"} 分，下降了 ${Math.abs(worst.change)} 分，建议本学期重点突破。`)
  parts.push(`【展望】${outlook}`)
  return parts
})

// 初始化图表
function initCharts() {
  nextTick(() => { buildDimLineChart(); buildScoreRankChart() })
}

function handleResize() { dimChart?.resize(); scoreRankChart?.resize() }

async function loadHistory() {
  try {
    const res = await getHistory()
    if (res.code === 200) history.value = res.data
    else history.value = null
    initCharts()
  } catch { history.value = null }
}

watch(() => history.value, initCharts)
onMounted(() => { window.addEventListener("resize", handleResize); loadHistory() })
onUnmounted(() => { window.removeEventListener("resize", handleResize); dimChart?.dispose(); scoreRankChart?.dispose() })
</script>

<style scoped>
.history-section { display: flex; flex-direction: column; gap: 24px; }
.card { position: relative; overflow: hidden; padding: 24px; }
.card-accent { position: absolute; top: 0; left: 0; right: 0; height: 3px; opacity: 0.6; border-radius: 3px 3px 0 0; }
.card h3 { font-size: 16px; font-weight: var(--font-weight-semibold); margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
.reveal { animation: fadeInUp 0.6s var(--easing-spring) both; }

/* 空状态 */
.empty-state { text-align: center; padding: 80px 24px; }
.empty-icon { font-size: 48px; color: var(--color-primary); margin-bottom: 16px; opacity: 0.5; }
.empty-state p { font-size: 18px; color: var(--color-text); margin-bottom: 8px; }
.empty-state span { font-size: 14px; color: var(--color-text-secondary); }

/* 首次评定引导 */
.first-time-guide { text-align: center; padding: 40px 16px 24px; }

.ft-emoji-wrap { position: relative; display: inline-block; margin-bottom: 20px; }
.ft-emoji { font-size: 56px; display: block; }
.ft-float { animation: float 3s ease-in-out infinite; }
.ft-spark { position: absolute; font-size: 22px; animation: sparkFloat 2s ease-in-out infinite; }
.ft-s1 { top: -10px; right: -20px; animation-delay: 0s; }
.ft-s2 { bottom: 5px; left: -25px; animation-delay: 0.7s; }
.ft-s3 { top: 10px; left: -10px; animation-delay: 1.4s; }
@keyframes sparkFloat {
  0%, 100% { opacity: 0; transform: translateY(0) scale(0.5); }
  50% { opacity: 1; transform: translateY(-12px) scale(1.1); }
}
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.ft-title { font-size: 22px; font-weight: var(--font-weight-bold); color: var(--color-text); margin-bottom: 8px; }
.ft-subtitle { font-size: 14px; color: var(--color-text-secondary); margin-bottom: 28px; }

.ft-dims { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-bottom: 28px; }
.ft-dim-card { display: flex; align-items: center; gap: 8px; padding: 16px 20px; border: 2px solid; border-radius: var(--radius-lg); background: var(--color-white); opacity: 0; animation: scaleIn 0.5s var(--easing-spring) forwards; min-width: 100px; }
.ftd-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.ftd-name { font-size: 14px; color: var(--color-text-secondary); }
.ftd-score { font-size: 28px; font-weight: var(--font-weight-bold); }
.ftd-unit { font-size: 13px; color: var(--color-text-secondary); }

.ft-footer { margin-top: 8px; }
.ft-arrow { font-size: 24px; display: block; }
.ft-bounce { animation: bounce 1.5s ease-in-out infinite; }
@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(8px); }
}
.ft-hint { font-size: 14px; color: var(--color-text-secondary); margin-top: 8px; }

/* 统计卡片 */
.stats-row { display: flex; gap: 12px; }
.stat-card { flex: 1; padding: 18px 12px; text-align: center; }
.stat-icon { font-size: 22px; margin-bottom: 4px; }
.stat-num { font-size: 16px; font-weight: var(--font-weight-bold); }
.stat-lbl { font-size: 12px; color: var(--color-text-secondary); margin-top: 4px; }

/* 图表左右布局 */
.charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.charts-left, .charts-right { min-width: 0; }
.chart-subtitle { font-size: 13px; color: var(--color-text-secondary); margin-bottom: 4px; text-align: center; }
.chart-box { width: 100%; height: 300px; }
.chart-note { font-size: 12px; color: var(--color-text-secondary); margin-top: 6px; text-align: center; }

/* 明细表 */
.detail-table-wrap { overflow-x: auto; }
.detail-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.detail-table th, .detail-table td { padding: 12px 10px; text-align: center; border-bottom: 1px solid var(--color-border); }
.detail-table th { font-weight: var(--font-weight-semibold); color: var(--color-text-secondary); font-size: 13px; }
.detail-table td:first-child { text-align: left; font-weight: var(--font-weight-medium); }
.td-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }
.arrow-up { color: #059669; font-size: 12px; margin-left: 3px; }
.arrow-down { color: #DC2626; font-size: 12px; margin-left: 3px; }
.arrow-flat { color: #9CA3AF; font-size: 12px; margin-left: 3px; }
.text-green { color: #059669; font-weight: var(--font-weight-bold); }
.text-red { color: #DC2626; font-weight: var(--font-weight-bold); }
.text-gray { color: #9CA3AF; }

/* 趋势总结 */
.trend-summary .ts-section { padding: 8px 0; font-size: 14px; line-height: 1.8; color: var(--color-text); }
.trend-summary .ts-section p { margin: 0; }

@media (max-width: 768px) { .stats-row { flex-wrap: wrap; } .stat-card { flex: 1 1 45%; } .charts-grid { grid-template-columns: 1fr; } }
</style>
