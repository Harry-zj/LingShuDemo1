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

    <!-- 1个学期：方案B空白引导视图 -->
    <div class="single-guide" v-else-if="semesters.length === 1">
      <div class="sg-icon-wrap">
        <svg class="sg-chart-icon" viewBox="0 0 80 64" fill="none">
          <polyline points="4,52 24,36 44,44 64,20 76,28" stroke="#C4C7CC" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          <line x1="4" y1="56" x2="76" y2="56" stroke="#DDE0E4" stroke-width="1"/>
          <line x1="4" y1="4" x2="4" y2="56" stroke="#DDE0E4" stroke-width="1"/>
          <circle cx="4" cy="52" r="2.5" fill="#DDE0E4" class="sg-node" style="animation-delay:0s"/>
          <circle cx="24" cy="36" r="2.5" fill="#DDE0E4" class="sg-node" style="animation-delay:0.6s"/>
          <circle cx="44" cy="44" r="2.5" fill="#DDE0E4" class="sg-node" style="animation-delay:1.2s"/>
          <circle cx="64" cy="20" r="2.5" fill="#DDE0E4" class="sg-node" style="animation-delay:1.8s"/>
          <circle cx="76" cy="28" r="2.5" fill="#DDE0E4" class="sg-node" style="animation-delay:2.4s"/>
        </svg>
      </div>
      <p class="sg-title">暂无可对比的历年综测数据</p>
      <p class="sg-desc">当前仅存在本学年测评记录，无法生成跨学年趋势分析</p>
      <div class="sg-preview">
        <span class="sg-preview-label">下一学年将自动解锁：</span>
        <span class="sg-preview-item">总分变化</span>
        <span class="sg-preview-div">/</span>
        <span class="sg-preview-item">五维升降幅</span>
        <span class="sg-preview-div">/</span>
        <span class="sg-preview-item">排名走势</span>
      </div>
    </div>

    <!-- ≥2个学期：摘要卡片始终可见 + 详情折叠 -->
    <template v-else>
      <!-- 模块1：统计摘要卡片（始终可见） -->
      <div class="stats-row">
        <div class="stat-card glass-card reveal" v-for="(s, i) in summaryCards" :key="s.label"
          :style="{ animationDelay: (0.1 + i * 0.07) + 's' }">
          <div class="stat-icon">{{ s.icon }}</div>
          <div class="stat-num" :style="{ color: s.color }">{{ s.value }}</div>
          <div class="stat-lbl">{{ s.label }}</div>
        </div>
      </div>

      <!-- 详情折叠区 -->
      <div class="history-fold" :class="{ expanded: showDetail }">
        <div class="history-fold-bar" @click="showDetail = !showDetail">
          <span>查看详细历史数据</span>
          <VIcon icon="mdi:chevron-down" class="hf-arrow" :class="{ rotated: showDetail }" />
        </div>
        <div class="history-fold-body" v-show="showDetail">
          <!-- 模块2+3：五维发展折线图 + 总分排名变化 -->
          <div class="card glass-card reveal" style="animation-delay: 0.1s;">
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
          <div class="card glass-card reveal" style="animation-delay: 0.2s;">
            <div class="card-accent" style="background: var(--color-meiyu)"></div>
            <h3><VIcon icon="mdi:table-large" /> 各维度变化明细</h3>
            <div class="detail-table-wrap">
              <table class="detail-table">
                <thead>
                  <tr><th>维度</th><th v-for="s in semesters" :key="s.year">{{ shortYear(s.year) }}</th><th>总变化</th><th>趋势</th></tr>
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
          <div class="card glass-card reveal trend-summary" style="animation-delay: 0.3s;">
            <div class="card-accent" style="background: var(--color-primary-gradient-bright)"></div>
            <h3><VIcon icon="mdi:text-box-check-outline" /> 趋势总结</h3>
            <div class="ts-section" v-for="(part, i) in trendParts" :key="i"><p>{{ part }}</p></div>
          </div>
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
  activeBatchTitle: { type: String, default: null },
})

// 常量
const DIM_CONFIG = DIMENSION_CONFIG
const dimLineColors = { de: "#D97706", zhi: "#4F46E5", ti: "#059669", mei: "#7C3AED", lao: "#EA580C" }
const dimIcons = { de: "⭐", zhi: "📚", ti: "🏃", mei: "🎨", lao: "🔧" }
function shortYear(title) { const m = (title || '').match(/(\d{4}-\d{4})/); return m ? m[1] : title }

// 数据
const history = ref(null)
const dimLineRef = ref(null)
const scoreRankRef = ref(null)
const showDetail = ref(false)
let dimChart = null, scoreRankChart = null
const currentScores = computed(() => props.currentDimensions || {})

// 所有学期数据，按学年升序排列（大一在前）
const allSemesters = computed(() => {
  const raw = history.value?.semesters || []
  return [...raw].sort((a, b) => {
    const ya = parseInt(a.year) || 0
    const yb = parseInt(b.year) || 0
    return ya - yb
  })
})

// 按选中批次截断：仅展示 ≤ 选中批次学年的数据
const semesters = computed(() => {
  const all = allSemesters.value
  if (!props.activeBatchTitle) return all
  const targetYear = parseInt(props.activeBatchTitle) || 0
  if (!targetYear) return all
  return all.filter(s => (parseInt(s.year) || 0) <= targetYear)
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
  // 容器不可见时跳过（display:none 会导致零尺寸）
  if (dimLineRef.value.offsetWidth === 0 || dimLineRef.value.offsetHeight === 0) return
  if (dimChart) dimChart.dispose()
  dimChart = echarts.init(dimLineRef.value)
  dimChart.setOption({
    tooltip: { trigger: "axis" },
    legend: {
      data: DIM_CONFIG.map(d => d.name),
      bottom: 0,
      left: "center",
      textStyle: { fontSize: 11, color: "#5F6368" },
      itemWidth: 14, itemHeight: 8,
      padding: [8, 0, 0, 0],
    },
    grid: { left: 44, right: 20, top: 20, bottom: 56 },
    xAxis: {
      type: "category", data: semesters.value.map(s => s.year),
      axisLabel: { fontSize: 12, color: "#5F6368" },
      axisLine: { lineStyle: { color: "rgba(15,10,30,0.08)" } },
    },
    yAxis: {
      type: "value", min: 40, max: 100,
      axisLabel: { fontSize: 11, color: "#5F6368" },
      splitLine: { lineStyle: { color: "rgba(15,10,30,0.04)" } },
      name: "分", nameTextStyle: { fontSize: 10, color: "#9AA0A6" },
    },
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
  if (scoreRankRef.value.offsetWidth === 0 || scoreRankRef.value.offsetHeight === 0) return
  if (scoreRankChart) scoreRankChart.dispose()
  scoreRankChart = echarts.init(scoreRankRef.value)
  scoreRankChart.setOption({
    tooltip: { trigger: "axis" },
    legend: {
      data: ["总分", "专业排名"],
      bottom: 0, left: "center",
      textStyle: { fontSize: 11, color: "#5F6368" },
      itemWidth: 14, itemHeight: 8,
      padding: [8, 0, 0, 0],
    },
    grid: { left: 48, right: 56, top: 20, bottom: 56 },
    xAxis: {
      type: "category", data: semesters.value.map(s => s.year),
      axisLabel: { fontSize: 12, color: "#5F6368" },
      axisLine: { lineStyle: { color: "rgba(15,10,30,0.08)" } },
    },
    yAxis: [
      {
        type: "value", name: "总分", min: 60, max: 100,
        axisLabel: { fontSize: 11, color: "#5F6368" },
        splitLine: { lineStyle: { color: "rgba(15,10,30,0.04)" } },
        nameTextStyle: { fontSize: 10, color: "#9AA0A6" },
      },
      {
        type: "value", name: "排名", min: 1, inverse: true,
        axisLabel: { fontSize: 11, color: "#5F6368" },
        splitLine: { show: false },
        nameTextStyle: { fontSize: 10, color: "#9AA0A6" },
      }
    ],
    series: [
      {
        name: "总分", type: "line", yAxisIndex: 0,
        data: semesters.value.map(s => s.scores.total),
        itemStyle: { color: "#4F46E5" },
        lineStyle: { color: "#4F46E5", width: 2 },
        symbol: "circle", symbolSize: 7,
      },
      {
        name: "专业排名", type: "line", yAxisIndex: 1,
        data: semesters.value.map(s => s.ranking.majorRank),
        itemStyle: { color: "#F59E0B" },
        lineStyle: { color: "#F59E0B", width: 2, type: "dashed" },
        symbol: "diamond", symbolSize: 9,
      },
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
// 展开折叠时重新初始化图表（延迟确保 DOM 布局完成）
watch(showDetail, (v) => { if (v) { setTimeout(() => { buildDimLineChart(); buildScoreRankChart() }, 100) } })
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

/* 单学年空白引导视图（方案B） */
.single-guide { text-align: center; padding: 48px 24px 40px; }
.sg-icon-wrap { margin-bottom: 20px; opacity: 0; animation: sgFadeUp 0.4s ease-out forwards; }
.sg-chart-icon { width: 100px; height: 80px; }
.sg-node { animation: sgBreath 2.5s ease-in-out infinite; }
@keyframes sgBreath {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}

.sg-title { font-size: 16px; font-weight: 600; color: var(--color-text); margin: 0 0 8px 0; opacity: 0; animation: sgFadeUp 0.4s ease-out 0.15s forwards; }
.sg-desc { font-size: 13px; color: var(--color-text-secondary); margin: 0 0 24px 0; opacity: 0; animation: sgFadeUp 0.4s ease-out 0.3s forwards; }
.sg-preview { display: flex; align-items: center; justify-content: center; gap: 6px; flex-wrap: wrap; opacity: 0; animation: sgFadeUp 0.4s ease-out 0.45s forwards; }
.sg-preview-label { font-size: 12px; color: var(--color-text-tertiary); }
.sg-preview-item { font-size: 12px; color: #9AA0A6; font-weight: 500; }
.sg-preview-div { font-size: 11px; color: #DDE0E4; }

@keyframes sgFadeUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

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
.detail-table { width: 100%; border-collapse: collapse; font-size: 15px; }
.detail-table th, .detail-table td { padding: 13px 10px; text-align: center; border-bottom: 1px solid var(--color-border); }
.detail-table th { font-weight: var(--font-weight-semibold); color: var(--color-text-secondary); font-size: 14px; }
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

/* 历史详情折叠 */
.history-fold { margin-top: 16px; }
.history-fold-bar { display:flex; align-items:center; justify-content:center; gap:6px; padding:10px 0; cursor:pointer; font-size:13px; color:var(--color-primary); user-select:none; border-top:1px solid var(--color-border); transition:color 0.2s; }
.history-fold-bar:hover { color:var(--color-text); }
.hf-arrow { font-size:18px; transition:transform 0.3s; }
.hf-arrow.rotated { transform:rotate(180deg); }
.history-fold-body { display:flex; flex-direction:column; gap:24px; padding-top:4px; }
.history-fold:not(.expanded) .history-fold-body { display:none; }

@media (max-width: 768px) { .stats-row { flex-wrap: wrap; } .stat-card { flex: 1 1 45%; } .charts-grid { grid-template-columns: 1fr; } }
</style>
