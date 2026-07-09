<template>
  <div class="profile-page">
    <div class="bg-atmosphere">
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
    </div>

    <div class="page-header">
      <div>
        <h2>个人发展画像</h2>
        <p class="page-desc">班级对比 · 趋势分析 · 综合画像</p>
      </div>
      <select v-model="currentBatch" @change="loadData" class="batch-select glass-card">
        <option value="">选择批次</option>
        <option v-for="b in batches" :key="b.id" :value="b.id">{{ b.title }}</option>
      </select>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="sk-stats"><div class="skeleton skeleton-card" v-for="i in 4" :key="i" style="height:100px"></div></div>
      <div class="sk-grid"><div class="skeleton skeleton-card" style="height:340px"></div><div class="skeleton skeleton-card" style="height:340px"></div></div>
    </div>

    <div v-else-if="!evalData" class="empty-state glass-card">
      <div class="empty-icon"><VIcon icon="mdi:account-details-outline" /></div>
      <p>暂无评定数据</p>
      <span>请等待老师完成评定后查看个人画像</span>
    </div>

    <template v-else>
      <div class="stats-row">
        <div class="stat-card glass-card reveal" v-for="(s, i) in statCards" :key="s.label"
          :style="{ animationDelay: (0.1 + i * 0.08) + 's' }">
          <div class="stat-num" :style="{ color: s.color }">{{ s.display }}</div>
          <div class="stat-lbl">{{ s.label }}</div>
          <div class="stat-glow" :style="{ background: s.color }"></div>
        </div>
      </div>

      <div class="overview-grid">
        <div class="card glass-card reveal" style="animation-delay: 0.15s;">
          <div class="card-accent" style="background: var(--color-primary)"></div>
          <h3><VIcon icon="mdi:chart-bell-curve" /> 五维能力雷达</h3>
          <RadarChart :dimensions="evalData.dimension_scores" :size="320" />
        </div>
        <div class="card glass-card reveal" style="animation-delay: 0.25s;">
          <div class="card-accent" style="background: var(--color-tiyu)"></div>
          <h3><VIcon icon="mdi:chart-bar" /> 班级对比</h3>
          <div ref="compareChartRef" class="echart-box"></div>
          <p v-if="!hasClassData" class="no-data-hint">暂无班级对比数据</p>
        </div>
      </div>

      <div class="card glass-card reveal" v-if="historyData.length > 1" style="animation-delay: 0.35s;">
        <div class="card-accent" style="background: var(--color-cyan-accent)"></div>
        <h3><VIcon icon="mdi:chart-timeline-variant" /> 历史趋势</h3>
        <div ref="trendChartRef" class="echart-box" style="height:300px"></div>
      </div>
    </template>
  </div>
</template>
<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from "vue"
import * as echarts from "echarts"
import { getEvaluation, getClassStats } from "../../api/module2"
import { getBatches } from "../../api/module3"
import RadarChart from "../../components/RadarChart.vue"

const dimConfig = [
  { key: "zhiyu", name: "智育", color: "#4F46E5" },
  { key: "deyu", name: "德育", color: "#D97706" },
  { key: "tiyu", name: "体育", color: "#059669" },
  { key: "meiyu", name: "美育", color: "#7C3AED" },
  { key: "laoyu", name: "劳育", color: "#EA580C" },
]
const loading = ref(true)
const evalData = ref(null); const classStats = ref(null)
const batches = ref([]); const currentBatch = ref("")
const compareChartRef = ref(null); const trendChartRef = ref(null)
const historyData = ref([])
let compareChart = null; let trendChart = null

const hasClassData = computed(() => classStats.value?.avg_score > 0 || classStats.value?.rankings?.length > 0)
const strengths = computed(() => { if (!evalData.value?.dimension_scores) return []; return dimConfig.filter(d => (evalData.value.dimension_scores[d.key] ?? 0) >= 80).map(d => d.name) })
const weaknesses = computed(() => { if (!evalData.value?.dimension_scores) return []; return dimConfig.filter(d => (evalData.value.dimension_scores[d.key] ?? 0) < 60).map(d => d.name) })
const statCards = computed(() => [
  { label: "综测总分", value: evalData.value?.total_score ?? "--", display: evalData.value?.total_score ?? "--", color: "var(--color-primary)" },
  { label: "班级排名", value: evalData.value?.class_rank ? `${evalData.value.class_rank}/${evalData.value.class_size}` : "--", display: evalData.value?.class_rank ? `${evalData.value.class_rank}/${evalData.value.class_size}` : "--", color: "var(--color-success)" },
  { label: "优势维度", value: strengths.value.length || "--", display: strengths.value.length || "--", color: "var(--color-warning)" },
  { label: "待提升", value: weaknesses.value.length || "--", display: weaknesses.value.length || "--", color: "var(--color-error)" },
])

function buildCompareChart() {
  if (!compareChartRef.value) return
  if (!compareChart) compareChart = echarts.init(compareChartRef.value)
  const my = dimConfig.map(d => evalData.value?.dimension_scores?.[d.key] ?? 0)
  const avg = classStats.value?.dimension_averages ? dimConfig.map(d => classStats.value.dimension_averages[d.key] ?? 0) : dimConfig.map(() => 0)
  compareChart.setOption({
    tooltip: { trigger: "axis" }, legend: { data: ["我的得分", "班级均分"], bottom: 0, textStyle: { fontSize: 12, color: "#5F6368" } },
    grid: { left: 12, right: 24, top: 16, bottom: 36 }, xAxis: { type: "category", data: dimConfig.map(d => d.name), axisLabel: { fontSize: 12 } }, yAxis: { type: "value", max: 100 },
    series: [
      { name: "我的得分", type: "bar", data: my, itemStyle: { color: "#4F46E5", borderRadius: [6, 6, 0, 0] }, barMaxWidth: 28, animationDuration: 1200, animationEasing: "elasticOut" },
      { name: "班级均分", type: "bar", data: avg, itemStyle: { color: "rgba(15,10,30,0.08)", borderRadius: [6, 6, 0, 0] }, barMaxWidth: 28, animationDuration: 1200, animationEasing: "elasticOut" },
    ]
  })
}
function buildTrendChart() {
  if (!trendChartRef.value || historyData.value.length < 2) return
  if (!trendChart) trendChart = echarts.init(trendChartRef.value)
  trendChart.setOption({
    tooltip: { trigger: "axis" }, legend: { data: dimConfig.map(d => d.name), bottom: 0, textStyle: { fontSize: 11, color: "#5F6368" } },
    grid: { left: 12, right: 24, top: 16, bottom: 36 }, xAxis: { type: "category", data: historyData.value.map(h => h.batch_title || `批次${h.batch_id}`), axisLabel: { fontSize: 12 } }, yAxis: { type: "value", max: 100 },
    series: dimConfig.map(d => ({ name: d.name, type: "line", data: historyData.value.map(h => h.dimension_scores?.[d.key] ?? 0), itemStyle: { color: d.color }, lineStyle: { color: d.color, width: 2 }, symbol: "circle", symbolSize: 6, animationDuration: 1500 }))
  })
}
function handleResize() { compareChart?.resize(); trendChart?.resize() }
async function loadData() {
  loading.value = true
  try {
    const r1 = await getBatches(); if (r1.code === 200) batches.value = r1.data || []
    const p = currentBatch.value ? { batch_id: currentBatch.value } : {}
    const [r2, r3] = await Promise.all([getEvaluation(p), getClassStats(p)])
    if (r2.code === 200 && r2.data) evalData.value = r2.data; else evalData.value = null
    if (r3.code === 200) classStats.value = r3.data; else classStats.value = null
    if (evalData.value) historyData.value = [evalData.value]
    await nextTick(); buildCompareChart(); buildTrendChart()
  } catch { evalData.value = null; classStats.value = null } finally { loading.value = false }
}
watch(() => evalData.value, async () => { await nextTick(); buildCompareChart(); buildTrendChart() })
onMounted(() => { window.addEventListener("resize", handleResize); loadData() })
onUnmounted(() => { window.removeEventListener("resize", handleResize); compareChart?.dispose(); trendChart?.dispose() })
</script>
<style scoped>
.profile-page { display: flex; flex-direction: column; gap: 24px; animation: fadeIn 0.4s var(--easing-decelerate); position: relative; }

.bg-atmosphere { position: fixed; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; z-index: 0; overflow: hidden; }
.orb { position: absolute; border-radius: 50%; opacity: 0.07; filter: blur(80px); }
.orb-1 { width: 350px; height: 350px; background: var(--color-tiyu); top: 10%; left: -120px; animation: orbDrift1 18s ease-in-out infinite; }
.orb-2 { width: 280px; height: 280px; background: var(--color-meiyu); bottom: 20%; right: -100px; animation: orbDrift2 22s ease-in-out infinite; }

.page-header { display: flex; justify-content: space-between; align-items: flex-start; position: relative; z-index: 1; }
.page-header h2 { font-size: var(--font-scale-h2); font-weight: var(--font-weight-semibold); }
.page-desc { font-size: var(--font-scale-body-sm); color: var(--color-text-secondary); margin-top: 2px; }
.batch-select { padding: 8px 16px; border: none; border-radius: var(--radius-full); font-size: 14px; background: transparent; outline: none; color: var(--color-text); cursor: pointer; }
.loading-state { display: flex; flex-direction: column; gap: 24px; position: relative; z-index: 1; }
.sk-stats { display: flex; gap: 16px; } .sk-stats > * { flex: 1; }
.sk-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.empty-state { text-align: center; padding: 80px 24px; position: relative; z-index: 1; }
.empty-icon { font-size: 48px; color: var(--color-primary); margin-bottom: 16px; opacity: 0.5; }
.empty-state p { font-size: 18px; color: var(--color-text); margin-bottom: 8px; }
.empty-state span { font-size: 14px; color: var(--color-text-secondary); }

.stats-row { display: flex; gap: 16px; position: relative; z-index: 1; }
.stat-card { flex: 1; padding: 24px 16px 20px; text-align: center; position: relative; overflow: hidden; }
.stat-card.reveal { animation: fadeInUp 0.5s var(--easing-spring) both; }
.stat-glow { position: absolute; bottom: 0; left: 0; right: 0; height: 3px; opacity: 0.5; transition: opacity var(--duration-normal); border-radius: 0 0 var(--radius-lg) var(--radius-lg); }
.stat-card:hover .stat-glow { opacity: 1; }
.stat-num { font-size: 30px; font-weight: var(--font-weight-bold); transition: transform var(--duration-normal) var(--easing-spring); }
.stat-card:hover .stat-num { transform: scale(1.08); }
.stat-lbl { font-size: 13px; color: var(--color-text-secondary); margin-top: 6px; }

.overview-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; position: relative; z-index: 1; }
.card { position: relative; overflow: hidden; display: flex; flex-direction: column; align-items: center; padding: 24px; }
.card.reveal { animation: fadeInUp 0.6s var(--easing-spring) both; }
.card-accent { position: absolute; top: 0; left: 0; right: 0; height: 3px; opacity: 0.6; border-radius: 3px 3px 0 0; transition: opacity var(--duration-normal); }
.card:hover .card-accent { opacity: 1; }
.card h3 { font-size: 16px; font-weight: var(--font-weight-semibold); margin-bottom: 16px; display: flex; align-items: center; gap: 8px; align-self: flex-start; }
.echart-box { width: 100%; height: 280px; }
.no-data-hint { text-align: center; color: var(--color-gray); font-size: 14px; padding: 40px 0; }

@media (max-width: 768px) { .overview-grid, .stats-row { grid-template-columns: 1fr; } .stats-row { flex-wrap: wrap; } .stat-card { flex: 1 1 45%; } }
</style>
