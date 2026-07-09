<template>
  <div class="profile-page">
    <div class="page-header">
      <h2>个人发展画像</h2>
      <select v-model="currentBatch" @change="loadData" class="batch-select">
        <option value="">选择批次</option>
        <option v-for="b in batches" :key="b.id" :value="b.id">{{ b.title }}</option>
      </select>
    </div>

    <!-- 加载态 -->
    <div v-if="loading" class="skeleton">
      <div class="sk-row"></div>
      <div class="sk-grid"><div class="sk-box"></div><div class="sk-box"></div></div>
    </div>

    <!-- 空状态 -->
    <div v-else-if="!evalData" class="empty-state">
      <div class="empty-icon">📊</div>
      <p>暂无评定数据</p>
      <span>请等待老师完成评定后查看个人画像</span>
    </div>

    <template v-else>
      <!-- 统计卡片行 -->
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-num primary">{{ evalData.total_score ?? "--" }}</div>
          <div class="stat-lbl">综测总分</div>
        </div>
        <div class="stat-card">
          <div class="stat-num success">{{ evalData.class_rank ?? "--" }}<span class="stat-unit" v-if="evalData.class_size">/{{ evalData.class_size }}</span></div>
          <div class="stat-lbl">班级排名</div>
        </div>
        <div class="stat-card">
          <div class="stat-num warning">{{ strengths.length }}</div>
          <div class="stat-lbl">优势维度</div>
        </div>
        <div class="stat-card">
          <div class="stat-num error">{{ weaknesses.length }}</div>
          <div class="stat-lbl">待提升</div>
        </div>
      </div>

      <!-- 雷达图 + 班级对比 -->
      <div class="overview-grid">
        <div class="card">
          <h3>五维能力雷达</h3>
          <RadarChart :dimensions="evalData.dimension_scores" :size="320" />
        </div>
        <div class="card">
          <h3>班级对比</h3>
          <div ref="compareChartRef" class="echart-box"></div>
          <p v-if="!hasClassData" class="no-data-hint">暂无班级对比数据</p>
        </div>
      </div>

      <!-- 历史趋势 -->
      <div class="card" v-if="historyData.length > 1">
        <h3>历史趋势</h3>
        <div ref="trendChartRef" class="echart-box" style="height:300px"></div>
      </div>
    </template>
  </div>
</template>
<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from "vue"
import * as echarts from "echarts"
import { getEvaluation } from "../../api/module2"
import { getClassStats } from "../../api/module2"
import { getBatches } from "../../api/module3"
import RadarChart from "../../components/RadarChart.vue"

const dimConfig = [
  { key: "zhiyu", name: "智育", color: "#1A73E8" },
  { key: "deyu", name: "德育", color: "#EA8600" },
  { key: "tiyu", name: "体育", color: "#34A853" },
  { key: "meiyu", name: "美育", color: "#9C27B0" },
  { key: "laoyu", name: "劳育", color: "#FF6D00" },
]

const loading = ref(true)
const evalData = ref(null)
const classStats = ref(null)
const batches = ref([])
const currentBatch = ref("")
const compareChartRef = ref(null)
const trendChartRef = ref(null)
const historyData = ref([])
let compareChart = null
let trendChart = null

const hasClassData = computed(() => classStats.value?.avg_score > 0 || classStats.value?.rankings?.length > 0)

const strengths = computed(() => {
  if (!evalData.value?.dimension_scores) return []
  return dimConfig.filter(d => (evalData.value.dimension_scores[d.key] ?? 0) >= 80).map(d => d.name)
})

const weaknesses = computed(() => {
  if (!evalData.value?.dimension_scores) return []
  return dimConfig.filter(d => (evalData.value.dimension_scores[d.key] ?? 0) < 60).map(d => d.name)
})

function buildCompareChart() {
  if (!compareChartRef.value) return
  if (!compareChart) compareChart = echarts.init(compareChartRef.value)
  const myScores = dimConfig.map(d => evalData.value?.dimension_scores?.[d.key] ?? 0)
  const avgScores = classStats.value?.dimension_averages
    ? dimConfig.map(d => classStats.value.dimension_averages[d.key] ?? 0)
    : dimConfig.map(() => 0)
  compareChart.setOption({
    tooltip: { trigger: "axis" },
    legend: { data: ["我的得分", "班级均分"], bottom: 0, textStyle: { fontSize: 12 } },
    grid: { left: 12, right: 24, top: 16, bottom: 36 },
    xAxis: { type: "category", data: dimConfig.map(d => d.name), axisLabel: { fontSize: 12 } },
    yAxis: { type: "value", max: 100, axisLabel: { fontSize: 11 } },
    series: [
      { name: "我的得分", type: "bar", data: myScores, itemStyle: { color: "#1A73E8", borderRadius: [6, 6, 0, 0] }, barMaxWidth: 28 },
      { name: "班级均分", type: "bar", data: avgScores, itemStyle: { color: "#DADCE0", borderRadius: [6, 6, 0, 0] }, barMaxWidth: 28 },
    ]
  })
}

function buildTrendChart() {
  if (!trendChartRef.value || historyData.value.length < 2) return
  if (!trendChart) trendChart = echarts.init(trendChartRef.value)
  const batches2 = historyData.value.map(h => h.batch_title || `批次${h.batch_id}`)
  trendChart.setOption({
    tooltip: { trigger: "axis" },
    legend: { data: dimConfig.map(d => d.name), bottom: 0, textStyle: { fontSize: 11 } },
    grid: { left: 12, right: 24, top: 16, bottom: 36 },
    xAxis: { type: "category", data: batches2, axisLabel: { fontSize: 12 } },
    yAxis: { type: "value", max: 100, axisLabel: { fontSize: 11 } },
    series: dimConfig.map(d => ({
      name: d.name, type: "line", data: historyData.value.map(h => h.dimension_scores?.[d.key] ?? 0),
      itemStyle: { color: d.color }, lineStyle: { color: d.color, width: 2 },
      symbol: "circle", symbolSize: 6,
    }))
  })
}

function handleResize() { compareChart?.resize(); trendChart?.resize() }

async function loadData() {
  loading.value = true
  try {
    const r1 = await getBatches()
    if (r1.code === 200) batches.value = r1.data || []
    const params = currentBatch.value ? { batch_id: currentBatch.value } : {}
    const [r2, r3] = await Promise.all([getEvaluation(params), getClassStats(params)])
    if (r2.code === 200 && r2.data) evalData.value = r2.data
    else evalData.value = null
    if (r3.code === 200) classStats.value = r3.data
    else classStats.value = null
    // 模拟历史数据 (TODO: 待后端 history 接口)
    if (evalData.value) historyData.value = [evalData.value]
    await nextTick()
    buildCompareChart()
    buildTrendChart()
  } catch { evalData.value = null; classStats.value = null }
  finally { loading.value = false }
}

watch(() => evalData.value, async () => { await nextTick(); buildCompareChart(); buildTrendChart() })

onMounted(() => { window.addEventListener("resize", handleResize); loadData() })
onUnmounted(() => { window.removeEventListener("resize", handleResize); compareChart?.dispose(); trendChart?.dispose() })
</script>
<style scoped>
.profile-page { display: flex; flex-direction: column; gap: 24px; }
.page-header { display: flex; justify-content: space-between; align-items: center; }
.page-header h2 { font-size: 24px; }
.batch-select { padding: 8px 16px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 14px; background: var(--color-white); outline: none; }
.batch-select:focus { border-color: var(--color-primary); }

.skeleton { display: flex; flex-direction: column; gap: 24px; }
.sk-row { height: 100px; background: linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: var(--radius-card); }
.sk-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.sk-box { height: 340px; background: linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: var(--radius-card); }
@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }

.empty-state { text-align: center; padding: 80px 24px; background: var(--color-white); border-radius: var(--radius-card); border: 1px solid var(--color-border); }
.empty-icon { font-size: 48px; margin-bottom: 16px; }
.empty-state p { font-size: 18px; color: var(--color-text); margin-bottom: 8px; }
.empty-state span { font-size: 14px; color: var(--color-text-secondary); }

.stats-row { display: flex; gap: 16px; }
.stat-card { flex: 1; padding: 24px; background: var(--color-white); border-radius: var(--radius-md); border: 1px solid var(--color-border); text-align: center; }
.stat-num { font-size: 32px; font-weight: 700; }
.stat-num.primary { color: var(--color-primary); }
.stat-num.success { color: var(--color-success); }
.stat-num.warning { color: var(--color-warning); }
.stat-num.error { color: var(--color-error); }
.stat-unit { font-size: 16px; font-weight: 400; color: var(--color-text-secondary); }
.stat-lbl { font-size: 14px; color: var(--color-text-secondary); margin-top: 4px; }

.overview-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.card { background: var(--color-white); border-radius: var(--radius-card); border: 1px solid var(--color-border); padding: 24px; }
.card h3 { font-size: 16px; margin-bottom: 16px; }
.echart-box { width: 100%; height: 280px; }
.no-data-hint { text-align: center; color: var(--color-gray); font-size: 14px; padding: 40px 0; }

@media (max-width: 768px) { .overview-grid, .stats-row { grid-template-columns: 1fr; } .stats-row { flex-wrap: wrap; } .stat-card { flex: 1 1 45%; } }
</style>
