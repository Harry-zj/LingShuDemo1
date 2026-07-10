<template>
  <div class="evaluation-page">
    <div class="bg-atmosphere">
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
    </div>

    <div class="page-header">
      <div>
        <h2>评定结果分析</h2>
        <p class="page-desc">德智体美劳 · 五维综合素质</p>
      </div>
      <div class="header-right">
        <router-link to="/module2/report" class="nav-link-btn glass-card">
          <VIcon icon="mdi:file-document-outline" /> 评定报告
        </router-link>
        <select v-model="currentBatch" @change="loadData" class="batch-select glass-card">
          <option value="">选择批次</option>
          <option v-for="b in batches" :key="b.id" :value="b.id">{{ b.title }}</option>
        </select>
      </div>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="skeleton skeleton-card" style="height:100px"></div>
      <div class="sk-grid">
        <div class="skeleton skeleton-card" style="height:340px"></div>
        <div class="skeleton skeleton-card" style="height:340px"></div>
      </div>
    </div>

    <div v-else-if="!result" class="empty-state glass-card">
      <div class="empty-icon"><VIcon icon="mdi:chart-line-variant" /></div>
      <p>暂无评定数据</p>
      <span>请等待老师完成评定后查看</span>
    </div>

    <template v-else>
      <!-- 学生信息条 -->
      <div class="student-bar glass-card reveal">
        <div class="sb-item"><VIcon icon="mdi:account" /> {{ result.student?.name || "--" }}</div>
        <div class="sb-divider"></div>
        <div class="sb-item">{{ result.student?.grade || "--" }}</div>
        <div class="sb-divider"></div>
        <div class="sb-item">{{ result.student?.major || "--" }}</div>
        <div class="sb-divider"></div>
        <div class="sb-item">{{ result.student?.class || "--" }}</div>
        <div class="sb-divider"></div>
        <div class="sb-item">{{ result.student?.semester || "--" }}</div>
      </div>

      <div class="overview-grid">
        <!-- 雷达图 -->
        <div class="card glass-card radar-card reveal" style="animation-delay: 0.1s;">
          <div class="card-accent" style="background: var(--color-primary)"></div>
          <h3><VIcon icon="mdi:chart-bell-curve" /> 五维能力雷达</h3>
          <RadarChart :data="dimensionScores" :dimensions="DIMENSION_CONFIG" :size="320" />
        </div>

        <!-- 总分 + 排名 -->
        <div class="card glass-card rank-card reveal" style="animation-delay: 0.2s;">
          <div class="card-accent" style="background: var(--color-primary-gradient-bright)"></div>
          <h3><VIcon icon="mdi:trophy-outline" /> 综测成绩</h3>

          <div class="score-ring">
            <svg viewBox="0 0 160 160" class="score-svg">
              <circle cx="80" cy="80" r="72" fill="none" stroke="var(--color-border)" stroke-width="3" />
              <circle cx="80" cy="80" r="72" fill="none" stroke="var(--color-primary)" stroke-width="3"
                stroke-linecap="round" :stroke-dasharray="452" :stroke-dashoffset="452 - 452 * displayPercent / 100"
                class="score-progress" />
            </svg>
            <div class="score-inner">
              <span class="total-score">{{ displayScore }}</span>
              <span class="score-unit">分</span>
            </div>
          </div>

          <div class="score-formula">F = F1×10% + F2×65% + F3×25%</div>

          <div class="rank-info" v-if="result.rank">
            班级排名 <strong>第 {{ result.rank }} 名</strong> / 共 {{ result.totalStudents }} 人
          </div>
          <div class="rank-info" v-else>暂无排名信息</div>
        </div>
      </div>

      <!-- 五维概览卡片（点击展开计算明细） -->
      <div class="card glass-card dim-overview reveal" style="animation-delay: 0.35s;">
        <div class="card-accent" style="background: var(--color-meiyu)"></div>
        <h3><VIcon icon="mdi:layers-triple-outline" /> 五维评级</h3>
        <div class="dim-row">
          <div class="dim-chip" v-for="d in dimensionList" :key="d.key"
            :class="{ 'chip-active': expandedDim === d.key }"
            :style="{ borderColor: expandedDim === d.key ? d.color : 'var(--color-border)', background: expandedDim === d.key ? d.color + '08' : '' }"
            @click="toggleDimDetail(d.key)">
            <span class="chip-dot" :style="{ background: d.color }"></span>
            <span class="chip-name">{{ d.name }}</span>
            <span class="chip-score">{{ d.score }}</span>
            <span class="chip-level" :style="{ background: d.level.bg, color: d.level.color }">{{ d.level.label }}</span>
            <VIcon icon="mdi:chevron-down" class="chip-arrow" :class="{ rotated: expandedDim === d.key }" />
          </div>
        </div>

        <!-- 展开的计算明细 -->
        <div class="dim-detail" v-if="expandedDim && dimDetail" :style="{ borderColor: dimDetail.color }">
          <div class="dd-header">
            <span class="dd-dot" :style="{ background: dimDetail.color }"></span>
            <span class="dd-name">{{ dimDetail.name }} · {{ dimDetail.score }} 分</span>
            <span class="dd-level" :style="{ background: dimDetail.level.bg, color: dimDetail.level.color }">{{ dimDetail.level.label }}</span>
          </div>
          <div class="dd-formula">
            <div class="dd-row" v-for="item in dimDetail.items" :key="item.label">
              <span class="dd-label">{{ item.label }}</span>
              <span class="dd-calc">{{ item.value }}{{ item.weight ? ' × ' + item.weight : '' }}</span>
              <span class="dd-result" v-if="item.result != null">= {{ item.result }}</span>
            </div>
            <div class="dd-total">
              原始得分 {{ dimDetail.rawTotal }} / {{ dimDetail.maxRaw }} → 归一化 × 100 = <strong>{{ dimDetail.score }}</strong> 分
            </div>
          </div>
        </div>
      </div>

      <!-- B1-B8 分项柱状图 -->
      <div class="card glass-card b-chart-card reveal" style="animation-delay: 0.45s;">
        <div class="card-accent" style="background: var(--color-deyu)"></div>
        <h3><VIcon icon="mdi:chart-bar" /> 素质拓展分项得分（B类）</h3>
        <div ref="bChartRef" class="b-chart-box"></div>
      </div>

      <!-- 历史发展与发展趋势 -->
      <HistoryTrend :currentDimensions="dimensionScores" :selectedYear="result?.year || null" />
    </template>
  </div>
</template>
<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from "vue"
import * as echarts from "echarts"
import { getEvaluation } from "../../api/module2"
import { getBatches } from "../../api/module3"
import RadarChart from "../../components/RadarChart.vue"
import HistoryTrend from "../../components/HistoryTrend.vue"
import { rawToDimensions, calcTotalScore, DIMENSION_CONFIG, getGradeLevel } from "../../utils/scoreHelper"

const loading = ref(true)
const result = ref(null)
const batches = ref([])
const currentBatch = ref("")
const displayScore = ref(0)
const displayPercent = ref(0)
const bChartRef = ref(null)
let bChart = null
const expandedDim = ref(null)

function toggleDimDetail(key) {
  expandedDim.value = expandedDim.value === key ? null : key
}

// 每个维度的原始分计算明细
const dimCalcMap = {
  de: {
    items: [
      { label: "思想政治 A1", value: "A1/20", weight: "×0.4" },
      { label: "道德品质 A2", value: "A2/20", weight: "×0.3" },
      { label: "纪律观念 A4", value: "A4/20", weight: "×0.3" },
    ],
    maxRaw: 20, calc: (a) => (a.A1||0)*0.4 + (a.A2||0)*0.3 + (a.A4||0)*0.3
  },
  zhi: {
    items: [
      { label: "课程成绩 F2", value: "F2/100", weight: "×0.4" },
      { label: "职业技能 B1", value: "B1/30", weight: "×0.2" },
      { label: "学术竞赛 B2", value: "B2/30", weight: "×0.2" },
      { label: "科技学术 B3", value: "B3/30", weight: "×0.2" },
    ],
    maxRaw: 58, calc: (s, b) => (s.F2||0)*0.4 + (b.B1||0)*0.2 + (b.B2||0)*0.2 + (b.B3||0)*0.2
  },
  ti: {
    items: [
      { label: "身心健康 A5", value: "A5/20", weight: "×0.4" },
      { label: "文体竞赛 B7", value: "B7/30", weight: "×0.6" },
    ],
    maxRaw: 26, calc: (a, b) => (a.A5||0)*0.4 + (b.B7||0)*0.6
  },
  mei: {
    items: [
      { label: "宣传报道 B4", value: "B4/30", weight: "×1.0" },
    ],
    maxRaw: 30, calc: (a, b) => (b.B4||0)
  },
  lao: {
    items: [
      { label: "社会实践 B6", value: "B6/30", weight: "×0.5" },
      { label: "劳动教育 B8", value: "B8/30", weight: "×0.3" },
      { label: "社会工作 B5", value: "B5/30", weight: "×0.2" },
    ],
    maxRaw: 30, calc: (a, b) => (b.B6||0)*0.5 + (b.B8||0)*0.3 + (b.B5||0)*0.2
  },
}

const dimDetail = computed(() => {
  const key = expandedDim.value
  if (!key || !result.value || !dimCalcMap[key]) return null
  const cfg = dimCalcMap[key]
  const raw = cfg.calc(result.value.aScores || {}, result.value.bScores || {})
  const dimCfg = DIMENSION_CONFIG.find(d => d.key === key)
  const score = Math.round(raw / cfg.maxRaw * 100)

  // 用实际值填充明细
  const filledItems = cfg.items.map(item => {
    const parts = item.value.split("/")
    const cat = parts[0]
    const max = parseInt(parts[1])
    // 从 aScores 或 bScores 或 scores 中取值
    let val = result.value.aScores?.[cat] ?? result.value.bScores?.[cat] ?? result.value.scores?.[cat] ?? 0
    const resultVal = parseFloat((val * parseFloat(item.weight?.replace("×","") || 1)).toFixed(1))
    return {
      label: item.label,
      value: `${val} / ${max}`,
      weight: item.weight,
      result: resultVal,
    }
  })

  return {
    key, name: dimCfg?.name, score,
    color: dimCfg?.color,
    level: getGradeLevel(score),
    items: filledItems,
    rawTotal: raw.toFixed(1),
    maxRaw: cfg.maxRaw,
  }
})

// B1-B8 配置：名称、满分、配色
const bConfig = [
  { key: "B1", name: "职业技能", color: "#6366F1" },
  { key: "B2", name: "学术竞赛", color: "#6366F1" },
  { key: "B3", name: "科技学术", color: "#4F46E5" },
  { key: "B4", name: "宣传报道", color: "#A78BFA" },
  { key: "B5", name: "社会工作", color: "#FB923C" },
  { key: "B6", name: "社会实践", color: "#F97316" },
  { key: "B7", name: "文体竞赛", color: "#34D399" },
  { key: "B8", name: "劳动教育", color: "#FBBF24" },
]

// 五维映射
const dimensionScores = computed(() => rawToDimensions(result.value))
const dimensionList = computed(() =>
  DIMENSION_CONFIG.map(d => {
    const score = Math.round(dimensionScores.value[d.key] || 0)
    return { ...d, score, level: getGradeLevel(score) }
  })
)

// 总分（F 体系）
const totalScore = computed(() => calcTotalScore(result.value?.scores))

function animateScore(target) {
  const num = parseFloat(target) || 0
  const duration = 1000
  const start = performance.now()
  function tick(now) {
    const elapsed = now - start
    const progress = Math.min(elapsed / duration, 1)
    const eased = 1 - Math.pow(1 - progress, 3)
    displayScore.value = (num * eased).toFixed(1)
    displayPercent.value = num * eased
    if (progress < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

watch(totalScore, (v) => { if (v != null) animateScore(v) })
watch(dimensionScores, (v) => { if (v && Object.values(v).some(x => x > 0)) animateScore(totalScore.value) })

async function loadData() {
  loading.value = true
  bChart?.dispose(); bChart = null  // 切换数据时重建图表
  try {
    const r1 = await getBatches()
    if (r1.code === 200) batches.value = r1.data || []
    const params = {}
    if (currentBatch.value) params.batch_id = currentBatch.value
    const r2 = await getEvaluation(params)
    if (r2.code === 200 && r2.data) result.value = r2.data
    else result.value = null
  } catch { result.value = null }
  finally { loading.value = false; await nextTick(); buildBChart() }
}

function buildBChart() {
  if (!bChartRef.value || !result.value) return
  if (!bChart) bChart = echarts.init(bChartRef.value)
  const myScores = bConfig.map(b => result.value.bScores?.[b.key] ?? 0)
  const avgScores = bConfig.map(b => result.value.classAvg?.[b.key] ?? 0)
  bChart.setOption({
    tooltip: { trigger: "axis", formatter: (p) => `${p[0].name}<br/>我的得分：${p[0].value} / 30<br/>班级均分：${p[1].value} / 30` },
    legend: { data: ["我的得分", "班级均分"], top: 0, textStyle: { fontSize: 12, color: "#5F6368" } },
    grid: { left: 12, right: 24, top: 36, bottom: 60 },
    xAxis: { type: "category", data: bConfig.map(b => b.name), axisLabel: { fontSize: 13, rotate: 30, color: "#5F6368" }, axisTick: { alignWithLabel: true } },
    yAxis: { type: "value", max: 30, axisLabel: { fontSize: 11 }, splitLine: { lineStyle: { color: "rgba(15,10,30,0.04)" } } },
    series: [
      { name: "我的得分", type: "bar", data: myScores.map((v, i) => ({ value: v, itemStyle: { color: bConfig[i].color, borderRadius: [5, 5, 0, 0] } })), barMaxWidth: 20, barGap: "20%", animationDuration: 1200, animationEasing: "elasticOut" },
      { name: "班级均分", type: "bar", data: avgScores.map((v) => ({ value: v, itemStyle: { color: "rgba(15,10,30,0.06)", borderRadius: [5, 5, 0, 0] } })), barMaxWidth: 20, animationDuration: 1200, animationEasing: "elasticOut" },
    ]
  })
}
function handleResize() { bChart?.resize() }

onMounted(() => { window.addEventListener("resize", handleResize); loadData() })
onUnmounted(() => { window.removeEventListener("resize", handleResize); bChart?.dispose() })
</script>
<style scoped>
.evaluation-page { display: flex; flex-direction: column; gap: 24px; animation: fadeIn 0.4s var(--easing-decelerate); position: relative; }

.bg-atmosphere { position: fixed; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; z-index: 0; overflow: hidden; }
.orb { position: absolute; border-radius: 50%; opacity: 0.08; filter: blur(80px); }
.orb-1 { width: 400px; height: 400px; background: var(--color-primary); top: -100px; right: -100px; animation: orbDrift1 16s ease-in-out infinite; }
.orb-2 { width: 300px; height: 300px; background: var(--color-meiyu); bottom: -80px; left: -80px; animation: orbDrift2 20s ease-in-out infinite; }

.page-header { display: flex; justify-content: space-between; align-items: flex-start; position: relative; z-index: 1; }
.header-right { display: flex; align-items: center; gap: 10px; }
.nav-link-btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 18px; border: 1px solid var(--color-border); border-radius: var(--radius-full); font-size: 13px; color: var(--color-primary); cursor: pointer; text-decoration: none; transition: all var(--duration-fast); }
.nav-link-btn:hover { border-color: var(--color-primary); background: var(--color-primary-light); }
.page-header h2 { font-size: var(--font-scale-h2); font-weight: var(--font-weight-semibold); }
.page-desc { font-size: var(--font-scale-body-sm); color: var(--color-text-secondary); margin-top: 2px; }
.batch-select { padding: 9px 32px 9px 16px; border: 1px solid var(--color-border); border-radius: var(--radius-full); font-size: 13px; background: var(--glass-bg); backdrop-filter: var(--glass-blur); color: var(--color-text); cursor: pointer; outline: none; appearance: none; -webkit-appearance: none; background-image: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'%3E%3Cpath fill='%235F6368' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E\"); background-repeat: no-repeat; background-position: right 12px center; transition: all var(--duration-fast); }
.batch-select:hover { border-color: var(--color-primary); }
.batch-select:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }

/* 学生信息条 */
.student-bar { display: flex; align-items: center; gap: 0; padding: 14px 24px; position: relative; z-index: 1; }
.student-bar.reveal { animation: fadeInUp 0.5s var(--easing-spring) both; }
.sb-item { font-size: 14px; color: var(--color-text); display: flex; align-items: center; gap: 6px; white-space: nowrap; }
.sb-divider { width: 1px; height: 16px; background: var(--color-border); margin: 0 16px; }

.loading-state { display: flex; flex-direction: column; gap: 24px; position: relative; z-index: 1; }
.sk-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }

.empty-state { text-align: center; padding: 80px 24px; position: relative; z-index: 1; }
.empty-icon { font-size: 48px; color: var(--color-primary); margin-bottom: 16px; opacity: 0.5; }
.empty-state p { font-size: 18px; color: var(--color-text); margin-bottom: 8px; }
.empty-state span { font-size: 14px; color: var(--color-text-secondary); }

.overview-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; position: relative; z-index: 1; }

.card { position: relative; overflow: hidden; }
.reveal { animation: fadeInUp 0.6s var(--easing-spring) both; }
.card-accent { position: absolute; top: 0; left: 0; right: 0; height: 3px; opacity: 0.6; border-radius: 3px 3px 0 0; transition: opacity var(--duration-normal); }
.card:hover .card-accent { opacity: 1; }
.card h3 { font-size: 16px; font-weight: var(--font-weight-semibold); margin-bottom: 20px; display: flex; align-items: center; gap: 8px; color: var(--color-text); }

.radar-card { display: flex; flex-direction: column; align-items: center; padding: 24px 24px 16px; }

/* 成绩卡片 */
.rank-card { text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 28px 24px; }
.rank-card h3 { margin-bottom: 4px; }

.score-ring { position: relative; width: 160px; height: 160px; margin: 8px auto 12px; }
.score-svg { width: 160px; height: 160px; transform: rotate(-90deg); }
.score-progress { transition: stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1); }
.score-inner { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.total-score { font-size: 42px; font-weight: var(--font-weight-bold); line-height: 1; color: var(--color-primary); }
.score-unit { font-size: 14px; color: var(--color-text-secondary); margin-top: 2px; }

.score-formula { font-size: 12px; color: var(--color-text-tertiary); margin-bottom: 12px; padding: 4px 12px; background: var(--color-surface-variant); border-radius: var(--radius-full); }

.rank-info { font-size: 15px; color: var(--color-text-secondary); margin-bottom: 4px; }
.rank-info strong { color: var(--color-text); }

/* 五维评级芯片 */
.dim-overview { padding: 24px; position: relative; z-index: 1; }

.b-chart-card { padding: 24px; position: relative; z-index: 1; }
.b-chart-box { width: 100%; height: 300px; }
.dim-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; }
.dim-chip { display: flex; align-items: center; gap: 8px; padding: 14px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-lg); background: var(--color-surface); justify-content: center; cursor: pointer; transition: all var(--duration-fast); user-select: none; }
.dim-chip:hover { border-color: var(--color-primary); transform: translateY(-2px); box-shadow: var(--shadow-level-2); }
.chip-active { border-width: 2px; }
.chip-arrow { font-size: 16px; color: var(--color-text-secondary); transition: transform var(--duration-fast); }
.chip-arrow.rotated { transform: rotate(180deg); }

/* 展开明细 */
.dim-detail { margin-top: 20px; padding: 20px; border: 1px solid; border-radius: var(--radius-lg); background: var(--color-bg); animation: fadeInUp 0.3s var(--easing-spring); }
.dd-header { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
.dd-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.dd-name { font-size: 15px; font-weight: var(--font-weight-semibold); color: var(--color-text); flex: 1; }
.dd-level { font-size: 12px; padding: 2px 10px; border-radius: var(--radius-full); font-weight: var(--font-weight-medium); }
.dd-formula { font-size: 14px; }
.dd-row { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px dashed var(--color-border); }
.dd-label { width: 120px; flex-shrink: 0; color: var(--color-text); }
.dd-calc { color: var(--color-text-secondary); font-family: monospace; }
.dd-result { color: var(--color-primary); font-weight: var(--font-weight-semibold); font-family: monospace; margin-left: auto; }
.dd-total { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--color-border); color: var(--color-text-secondary); font-size: 13px; }
.dd-total strong { color: var(--color-primary); font-size: 15px; }
.chip-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.chip-name { font-size: 14px; font-weight: var(--font-weight-medium); color: var(--color-text); }
.chip-score { font-size: 18px; font-weight: var(--font-weight-bold); color: var(--color-text); }
.chip-level { font-size: 12px; padding: 2px 8px; border-radius: var(--radius-full); font-weight: var(--font-weight-medium); }

@media (max-width: 768px) { .overview-grid { grid-template-columns: 1fr; } .student-bar { flex-wrap: wrap; gap: 8px; } .sb-divider { display: none; } .dim-row { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 480px) { .dim-row { grid-template-columns: repeat(2, 1fr); } }
</style>
