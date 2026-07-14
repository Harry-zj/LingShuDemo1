<template>
  <div class="evaluation-page">
    <div class="bg-atmosphere">
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
    </div>

    <!-- 顶部 -->
    <div class="page-header">
      <div>
        <h2>综测数据总览</h2>
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

    <!-- 加载 / 空状态 -->
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
      <!-- ====== 学生信息条（始终可见） ====== -->
      <div class="student-bar glass-card">
        <div class="sb-avatar">{{ (result.student?.name || '?')[0] }}</div>
        <div class="sb-info">
          <span class="sb-name">{{ result.student?.name || '--' }}</span>
          <span class="sb-meta">{{ result.student?.grade || '--' }} · {{ result.student?.major || '--' }} · {{ result.student?.class || '--' }}</span>
        </div>
        <div class="sb-right">
          <span class="sb-semester">{{ result.student?.semester || '--' }}</span>
        </div>
      </div>

      <!-- ====== 核心区（始终可见）：62/38 双卡片 ====== -->
      <div class="overview-grid">
        <!-- 左侧 62%：雷达 + 五维评级 -->
        <div class="card glass-card radar-card reveal" style="animation-delay:0.1s">
          <div class="card-accent" style="background:var(--color-primary)"></div>
          <h3><VIcon icon="mdi:chart-bell-curve" /> 综合素质五维图</h3>

          <div class="radar-card-inner">
            <!-- 左侧：计算详情（始终可见，默认智维度） -->
            <div class="expand-detail" :style="{ borderColor: dimDetail.color }">
              <div class="ed-header">
                <span class="ed-dot" :style="{ background: dimDetail.color }"></span>
                <span class="ed-name">{{ dimDetail.name }} 维度</span>
                <span class="ed-score">{{ dimDetail.score }}<small> 分</small></span>
                <span class="ed-level" :style="{ background: dimDetail.level.bg, color: dimDetail.level.color }">{{ dimDetail.level.label }}</span>
              </div>
              <div class="ed-table-wrap">
                <table class="ed-table">
                  <thead><tr><th>分项</th><th>得分/满分</th><th>权重</th><th>加权</th></tr></thead>
                  <tbody>
                    <tr v-for="item in dimDetail.items" :key="item.label">
                      <td>{{ item.label }}</td>
                      <td class="td-num">{{ item.rawScore }}/{{ item.maxScore }}</td>
                      <td class="td-num">{{ item.weight }}</td>
                      <td class="td-num td-highlight">{{ item.result }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="ed-formula">
                <code class="ed-formula-text">{{ dimDetail.formulaText }}</code>
              </div>
              <div class="ed-source">
                <p>{{ dimDetail.sourceDesc }}</p>
              </div>
            </div>

            <!-- 右侧：雷达 + 围绕的维度标签 -->
            <div class="radar-side">
              <div class="dim-tags-top">
                <div class="dim-tag" v-for="d in topDimTags" :key="d.key"
                  :class="{ 'tag-active': activeDim === d.key }"
                  :style="{ borderColor: activeDim === d.key ? d.color : 'var(--color-border)' }"
                  @click="switchDim(d.key)">
                  <span class="tag-dot" :style="{ background: d.color }"></span>
                  <span class="tag-name">{{ d.name }}</span>
                  <span class="tag-score">{{ d.score }}</span>
                  <span class="tag-level" :style="{ background: d.level.bg, color: d.level.color }">{{ d.level.label }}</span>
                </div>
              </div>
              <div class="radar-chart-col">
                <RadarChart :data="dimensionScores" :dimensions="DIMENSION_CONFIG"
                  :activeDimension="activeDim" />
              </div>
              <div class="dim-tags-bottom">
                <div class="dim-tag" v-for="d in bottomDimTags" :key="d.key"
                  :class="{ 'tag-active': activeDim === d.key }"
                  :style="{ borderColor: activeDim === d.key ? d.color : 'var(--color-border)' }"
                  @click="switchDim(d.key)">
                  <span class="tag-dot" :style="{ background: d.color }"></span>
                  <span class="tag-name">{{ d.name }}</span>
                  <span class="tag-score">{{ d.score }}</span>
                  <span class="tag-level" :style="{ background: d.level.bg, color: d.level.color }">{{ d.level.label }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 右侧 38%：综测成绩 -->
        <div class="card glass-card score-card reveal" style="animation-delay:0.2s">
          <div class="card-accent" style="background:var(--color-primary-gradient-bright)"></div>
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
          <div class="f-breakdown">
            <div class="f-item"><span class="f-label">F1 基本素质</span><span class="f-calc">{{ result.scores?.F1 || 0 }} × 10%</span><span class="f-val">{{ ((result.scores?.F1||0)*0.1).toFixed(1) }}</span></div>
            <div class="f-item"><span class="f-label">F2 课程学习</span><span class="f-calc">{{ result.scores?.F2 || 0 }} × 65%</span><span class="f-val">{{ ((result.scores?.F2||0)*0.65).toFixed(1) }}</span></div>
            <div class="f-item"><span class="f-label">F3 创新实践</span><span class="f-calc">{{ result.scores?.F3 || 0 }} × 25%</span><span class="f-val">{{ ((result.scores?.F3||0)*0.25).toFixed(1) }}</span></div>
          </div>
          <div class="rank-row" v-if="result.rank">
            <div class="rank-item">
              <div class="rank-num">{{ result.rank }}<span class="rank-of">/{{ result.totalStudents }}</span></div>
              <div class="rank-label">班级排名</div>
            </div>
            <div class="rank-divider"></div>
            <div class="rank-item" v-if="result.majorRank">
              <div class="rank-num">{{ result.majorRank }}<span class="rank-of">/{{ result.majorTotal }}</span></div>
              <div class="rank-label">专业排名</div>
            </div>
          </div>
          <div class="rank-row" v-else>
            <span class="no-rank">暂无排名信息</span>
          </div>
        </div>
      </div>

      <!-- ====== 主要分项得分展示 ====== -->
      <div class="card glass-card b-chart-card reveal">
        <div class="card-accent" style="background:#6366F1"></div>
        <h3><VIcon icon="mdi:chart-bar" /> 主要分项得分展示</h3>
        <div class="b-chart-layout">
          <div class="b-chart-left card">
            <div class="b-chart-subtitle"><VIcon icon="mdi:lightbulb-outline" /> 创新实践类分项得分</div>
            <div ref="bChartRef" class="b-chart-box"></div>
          </div>
          <div class="b-chart-right card">
            <div class="f2-card-title"><VIcon icon="mdi:book-open-outline" /> 课程学习成绩</div>
            <div class="f2-score-area">
              <span class="f2-score-main">{{ result.scores?.F2 || '--' }} <small>/ 100</small></span>
              <span class="f2-diff-tag" v-if="f2Diff > 0">高出班级均分{{ f2Diff }}分</span>
              <span class="f2-diff-tag below" v-else-if="f2Diff < 0">低于班级均分{{ Math.abs(f2Diff) }}分</span>
            </div>
            <div class="f2-bar-wrap">
              <div class="f2-bar-row">
                <span class="f2-bar-tag">个人</span>
                <div class="f2-bar-track">
                  <div class="f2-bar-fill" :style="{ width: Math.min((result.scores?.F2 || 0), 100) + '%' }"></div>
                </div>
                <span class="f2-bar-num">{{ result.scores?.F2 || '--' }}</span>
              </div>
              <div class="f2-bar-row">
                <span class="f2-bar-tag avg">班级</span>
                <div class="f2-bar-track">
                  <div class="f2-bar-fill avg" :style="{ width: Math.min((result.classAvg?.F2 || 0), 100) + '%' }"></div>
                </div>
                <span class="f2-bar-num">{{ result.classAvg?.F2 || '--' }}</span>
              </div>
            </div>
            <div class="f2-meta">智育维度权重 65%</div>
          </div>
        </div>
      </div>

      <!-- ====== 历史发展：摘要始终可见 + 详情折叠 ====== -->
      <div class="card glass-card history-card reveal">
        <div class="card-accent" style="background:var(--color-primary)"></div>
        <h3><VIcon icon="mdi:chart-line-variant" /> 历史发展</h3>
        <HistoryTrend :currentDimensions="dimensionScores" :activeBatchTitle="result?.student?.semester || null" />
      </div>
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

const activeDim = ref('zhi')      // 'de' | 'zhi' | 'ti' | 'mei' | 'lao' — 默认智维度

function switchDim(key) {
  activeDim.value = key
}

// 雷达上方 2 个、下方 3 个
const topDimTags = computed(() => dimensionList.value.slice(0, 2))    // 德、智
const bottomDimTags = computed(() => dimensionList.value.slice(2, 5)) // 体、美、劳

// ---- computed ----
const dimensionScores = computed(() => rawToDimensions(result.value))
const dimensionList = computed(() =>
  DIMENSION_CONFIG.map(d => {
    const score = Math.round(dimensionScores.value[d.key] || 0)
    return { ...d, score, level: getGradeLevel(score) }
  })
)

const totalScore = computed(() => calcTotalScore(result.value?.scores))
const f2Diff = computed(() => {
  const mine = parseFloat(result.value?.scores?.F2) || 0
  const avg = parseFloat(result.value?.classAvg?.F2) || 0
  return Math.round(mine - avg)
})

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

const bScores = computed(() => {
  if (!result.value?.bScores) return []
  return bConfig.map(b => ({
    ...b,
    score: result.value.bScores[b.key] ?? 0,
    avg: result.value.classAvg?.[b.key] ?? 0,
  }))
})

// 五维计算明细
const dimCalcMap = {
  de: {
    items: [
      { label: "思想政治表现 A1", value: "A1/20", weight: "×0.25" },
      { label: "道德品质修养 A2", value: "A2/20", weight: "×0.25" },
      { label: "学习态度作风 A3", value: "A3/20", weight: "×0.25" },
      { label: "组织纪律观念 A4", value: "A4/20", weight: "×0.25" },
    ],
    maxRaw: 20,
    formulaText: "德 = (A1×0.25 + A2×0.25 + A3×0.25 + A4×0.25) / 20 × 100",
    sourceDesc: "德育维度综合考察学生的思想政治表现、道德品质修养、学习态度作风及组织纪律观念。A1-A4 各项满分均为 20 分，通过辅导员评价、班级评议及日常行为记录综合评定。",
    calc: (a) => (a.A1||0)*0.25 + (a.A2||0)*0.25 + (a.A3||0)*0.25 + (a.A4||0)*0.25
  },
  zhi: {
    items: [
      { label: "课程学习成绩 F2", value: "F2/100", weight: "×0.4" },
      { label: "职业技能 B1", value: "B1/30", weight: "×0.2" },
      { label: "学科竞赛 B2", value: "B2/30", weight: "×0.2" },
      { label: "科研学术 B3", value: "B3/30", weight: "×0.2" },
    ],
    maxRaw: 58,
    formulaText: "智 = (F2×0.4 + B1×0.2 + B2×0.2 + B3×0.2) / 58 × 100",
    sourceDesc: "智育维度由课程学习成绩（F2，满分 100）以及职业技能、学科竞赛、科研学术三项素质拓展得分（各满分 30）加权计算，综合反映学生的学业水平和学术能力。",
    calc: (s, b) => (s.F2||0)*0.4 + (b.B1||0)*0.2 + (b.B2||0)*0.2 + (b.B3||0)*0.2
  },
  ti: {
    items: [
      { label: "身心健康素质 A5", value: "A5/20", weight: "×0.4" },
      { label: "文体竞赛 B7", value: "B7/30", weight: "×0.6" },
    ],
    maxRaw: 26,
    formulaText: "体 = (A5×0.4 + B7×0.6) / 26 × 100",
    sourceDesc: "体育维度通过身心健康素质（A5，满分 20）以及文体艺术竞赛活动（B7，满分 30）综合评定，体测成绩、日常锻炼及文体竞赛获奖均为重要参考依据。",
    calc: (a, b) => (a.A5||0)*0.4 + (b.B7||0)*0.6
  },
  mei: {
    items: [{ label: "文学艺术创作与宣传报道 B4", value: "B4/30", weight: "×1.0" }],
    maxRaw: 30,
    formulaText: "美 = B4 / 30 × 100",
    sourceDesc: "美育维度以文学艺术创作与宣传报道（B4，满分 30）为核心指标，涵盖校报发表、新媒体宣传、文艺创作等成果。",
    calc: (a, b) => (b.B4||0)
  },
  lao: {
    items: [
      { label: "社会实践 B6", value: "B6/30", weight: "×0.5" },
      { label: "劳动教育 B8", value: "B8/30", weight: "×0.3" },
      { label: "社会工作 B5", value: "B5/30", weight: "×0.2" },
    ],
    maxRaw: 30,
    formulaText: "劳 = (B6×0.5 + B8×0.3 + B5×0.2) / 30 × 100",
    sourceDesc: "劳育维度从社会实践（B6）、劳动教育（B8）及社会工作（B5）三个维度综合考察，各分项满分均为 30 分，涵盖暑期实践、志愿服务、社区劳动、学生工作等。",
    calc: (a, b) => (b.B6||0)*0.5 + (b.B8||0)*0.3 + (b.B5||0)*0.2
  },
}

const dimDetail = computed(() => {
  const key = activeDim.value
  if (!result.value || !dimCalcMap[key]) return { key, name: '', score: 0, color: '#ccc', level: getGradeLevel(0), items: [], formulaText: '', sourceDesc: '', rawTotal: '0', maxRaw: 1 }
  const cfg = dimCalcMap[key]
  const raw = cfg.calc(result.value.aScores || {}, result.value.bScores || {})
  const dimCfg = DIMENSION_CONFIG.find(d => d.key === key)
  const score = Math.round(raw / cfg.maxRaw * 100)

  const filledItems = cfg.items.map(item => {
    const parts = item.value.split("/")
    const cat = parts[0]
    const maxScore = parseInt(parts[1])
    let rawScore = result.value.aScores?.[cat] ?? result.value.bScores?.[cat] ?? result.value.scores?.[cat] ?? 0
    const resultVal = parseFloat((rawScore * parseFloat(item.weight?.replace("×","") || 1)).toFixed(1))
    return { label: item.label, rawScore, maxScore, weight: item.weight, result: resultVal }
  })

  return {
    key, name: dimCfg?.name, score,
    color: dimCfg?.color,
    level: getGradeLevel(score),
    items: filledItems,
    formulaText: cfg.formulaText,
    sourceDesc: cfg.sourceDesc,
    rawTotal: raw.toFixed(1),
    maxRaw: cfg.maxRaw,
  }
})

// ---- 动画 ----
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
// 切换维度时触发雷达图 resize
watch(activeDim, () => { nextTick(() => { setTimeout(() => window.dispatchEvent(new Event('resize')), 350) }) })

// ---- 数据加载 ----
async function loadData() {
  loading.value = true
  bChart?.dispose(); bChart = null
  activeDim.value = 'zhi'
  try {
    const r1 = await getBatches()
    if (r1.code === 200) batches.value = r1.data || []
    // 默认选最新学年
    if (!currentBatch.value && batches.value.length) {
      const sorted = [...batches.value].sort((a, b) => (b.title || '').localeCompare(a.title || ''))
      currentBatch.value = String(sorted[0].id)
    }
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
    tooltip: { trigger: "axis" },
    legend: { data: ["我的得分", "班级均分"], top: 0, textStyle: { fontSize: 12, color: "#5F6368" } },
    grid: { left: 12, right: 24, top: 36, bottom: 60 },
    xAxis: { type: "category", data: bConfig.map(b => b.name), axisLabel: { fontSize: 13, rotate: 30, color: "#5F6368" }, axisTick: { alignWithLabel: true } },
    yAxis: { type: "value", max: 30, axisLabel: { fontSize: 11 }, splitLine: { lineStyle: { color: "rgba(15,10,30,0.04)" } } },
    series: [
      { name: "我的得分", type: "bar", data: myScores.map((v, i) => ({ value: v, itemStyle: { color: bConfig[i].color, borderRadius: [5,5,0,0] } })), barMaxWidth: 20, barGap: "20%", animationDuration: 1200, animationEasing: "elasticOut" },
      { name: "班级均分", type: "bar", data: avgScores.map((v) => ({ value: v, itemStyle: { color: "rgba(15,10,30,0.06)", borderRadius: [5,5,0,0] } })), barMaxWidth: 20, animationDuration: 1200, animationEasing: "elasticOut" },
    ]
  })
}

function handleResize() { bChart?.resize() }

onMounted(() => { window.addEventListener("resize", handleResize); loadData() })
onUnmounted(() => { window.removeEventListener("resize", handleResize); bChart?.dispose() })
</script>

<style scoped>
.evaluation-page { display: flex; flex-direction: column; gap: 24px; animation: fadeIn 0.4s var(--easing-decelerate); position: relative; padding: 0 20px 40px; }

/* 背景 */
.bg-atmosphere { position: fixed; top:0; left:0; right:0; bottom:0; pointer-events:none; z-index:0; overflow:hidden; }
.orb { position:absolute; border-radius:50%; opacity:0.06; filter:blur(80px); }
.orb-1 { width:400px; height:400px; background:var(--color-primary); top:-100px; right:-100px; }
.orb-2 { width:300px; height:300px; background:var(--color-meiyu); bottom:-80px; left:-80px; }

/* 顶部 */
.page-header { display:flex; justify-content:space-between; align-items:flex-start; position:relative; z-index:1; }
.header-right { display:flex; align-items:center; gap:10px; }
.nav-link-btn { display:inline-flex; align-items:center; gap:6px; padding:9px 18px; border:1px solid var(--color-border); border-radius:var(--radius-full); font-size:13px; color:var(--color-primary); cursor:pointer; text-decoration:none; transition:all var(--duration-fast); }
.nav-link-btn:hover { border-color:var(--color-primary); background:var(--color-primary-light); }
.page-header h2 { font-size:var(--font-scale-h2); font-weight:var(--font-weight-semibold); }
.page-desc { font-size:var(--font-scale-body-sm); color:var(--color-text-secondary); margin-top:6px; }
.batch-select { padding:9px 32px 9px 16px; border:1px solid var(--color-border); border-radius:var(--radius-full); font-size:13px; background:var(--glass-bg); backdrop-filter:var(--glass-blur); color:var(--color-text); cursor:pointer; outline:none; appearance:none; -webkit-appearance:none; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'%3E%3Cpath fill='%235F6368' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 12px center; }
.batch-select:focus { border-color:var(--color-primary); }

/* 学生条 */
.student-bar { display:flex; align-items:center; gap:16px; padding:16px 24px; position:relative; z-index:1; }
.sb-avatar { width:42px; height:42px; border-radius:50%; background:var(--color-primary); color:#fff; display:flex; align-items:center; justify-content:center; font-size:18px; font-weight:700; flex-shrink:0; }
.sb-info { display:flex; flex-direction:column; gap:2px; flex:1; }
.sb-name { font-size:16px; font-weight:600; color:var(--color-text); }
.sb-meta { font-size:13px; color:var(--color-text-secondary); }
.sb-right { flex-shrink:0; }
.sb-semester { font-size:13px; color:var(--color-text-tertiary); padding:4px 12px; background:var(--color-surface-variant); border-radius:var(--radius-full); }

/* 卡片 */
.card { position:relative; overflow:hidden; }
.card-accent { position:absolute; top:0; left:0; right:0; height:3px; opacity:0.6; border-radius:3px 3px 0 0; transition:opacity var(--duration-normal); }
.card:hover .card-accent { opacity:1; }
.card h3 { font-size:16px; font-weight:var(--font-weight-semibold); margin-bottom:20px; display:flex; align-items:center; gap:8px; color:var(--color-text); }

.reveal { animation: fadeInUp 0.6s var(--easing-spring) both; }

/* 综测总览双栏 */
.overview-grid { display:grid; grid-template-columns:62fr 38fr; gap:24px; position:relative; z-index:1; }
.radar-card { padding:20px 20px 16px; overflow:visible; }
.radar-card h3 { margin-bottom:6px; }

/* 卡片内部：左详情 + 右雷达 */
.radar-card-inner { display:flex; gap:12px; height:440px; }

/* 左侧详情面板 */
.expand-detail { flex:0 0 48%; min-width:0; padding:12px 16px; border:1px solid var(--color-border); border-radius:10px; background:var(--color-bg); overflow-y:auto; display:flex; flex-direction:column; gap:10px; }
.ed-header { display:flex; align-items:center; gap:8px; flex-shrink:0; }
.ed-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
.ed-name { font-size:16px; font-weight:600; color:var(--color-text); }
.ed-score { font-size:24px; font-weight:700; color:var(--color-primary); margin-left:auto; }
.ed-score small { font-size:14px; font-weight:400; color:var(--color-text-secondary); }
.ed-level { font-size:12px; padding:2px 10px; border-radius:var(--radius-full); font-weight:500; white-space:nowrap; }

.ed-table-wrap { flex-shrink:0; }
.ed-table { width:100%; border-collapse:collapse; font-size:14px; }
.ed-table th { text-align:left; padding:6px 8px; color:var(--color-text-secondary); font-weight:500; font-size:13px; border-bottom:1px solid var(--color-border); }
.ed-table td { padding:6px 8px; border-bottom:1px dashed var(--color-border); color:var(--color-text); }
.ed-table .td-num { text-align:center; font-family:monospace; font-size:13px; }
.ed-table .td-highlight { color:var(--color-primary); font-weight:600; }

.ed-formula { flex-shrink:0; }
.ed-formula-text { display:block; padding:8px 12px; background:var(--color-surface-variant); border-radius:4px; font-size:14px; color:var(--color-text); font-family:monospace; }

.ed-source { flex-shrink:0; }
.ed-source p { font-size:12px; color:var(--color-text-secondary); line-height:1.5; margin:0; }

/* 右侧：雷达 + 上下维度标签 */
.radar-side { flex:1; display:flex; flex-direction:column; align-items:center; min-width:0; }

/* 雷达上方 2 个标签 */
.dim-tags-top { display:flex; justify-content:center; gap:8px; margin-bottom:4px; flex-shrink:0; }
/* 雷达下方 3 个标签 */
.dim-tags-bottom { display:flex; justify-content:center; gap:8px; margin-top:4px; flex-shrink:0; }

/* 雷达图表 */
.radar-chart-col { flex:1; width:100%; display:flex; align-items:center; justify-content:center; min-height:0; }

/* 维度标签统一 */
.dim-tag { display:flex; align-items:center; gap:4px; padding:5px 10px; border-radius:8px; cursor:pointer; transition:all 0.2s; border:1px solid var(--color-border); user-select:none; background:var(--color-surface); }
.dim-tag:hover { border-color:var(--color-primary); background:var(--color-surface-variant); }
.dim-tag.tag-active { border-width:2px; background:var(--color-surface-variant); }
.tag-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
.tag-name { font-size:12px; font-weight:500; color:var(--color-text); }
.tag-score { font-size:15px; font-weight:700; color:var(--color-text); min-width:24px; text-align:center; }
.tag-level { font-size:10px; padding:1px 5px; border-radius:3px; font-weight:500; white-space:nowrap; }

.score-card { display:flex; flex-direction:column; align-items:center; padding:28px 20px; }
.score-card h3 { margin-bottom:4px; }
.score-ring { position:relative; width:160px; height:160px; margin:8px auto 12px; }
.score-svg { width:160px; height:160px; transform:rotate(-90deg); }
.score-progress { transition:stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1); }
.score-inner { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; }
.total-score { font-size:42px; font-weight:var(--font-weight-bold); line-height:1; color:var(--color-primary); }
.score-unit { font-size:14px; color:var(--color-text-secondary); margin-top:2px; }
.score-formula { font-size:12px; color:var(--color-text-tertiary); margin-bottom:12px; padding:4px 12px; background:var(--color-surface-variant); border-radius:var(--radius-full); }

.f-breakdown { width:100%; margin-bottom:16px; }
.f-item { display:flex; align-items:center; padding:8px 14px; font-size:15px; border-bottom:1px dashed var(--color-border); }
.f-item:last-child { border-bottom:none; }
.f-label { flex:1; color:var(--color-text); }
.f-calc { color:var(--color-text-secondary); margin:0 10px; font-family:monospace; font-size:14px; }
.f-val { color:var(--color-primary); font-weight:600; font-size:16px; }

.rank-row { display:flex; align-items:center; gap:0; }
.rank-item { text-align:center; padding:0 20px; }
.rank-divider { width:1px; height:32px; background:var(--color-border); }
.rank-num { font-size:28px; font-weight:700; color:var(--color-text); }
.rank-of { font-size:14px; color:var(--color-text-tertiary); font-weight:400; }
.rank-label { font-size:12px; color:var(--color-text-secondary); margin-top:2px; }
.no-rank { font-size:14px; color:var(--color-text-secondary); }



/* 主要分项得分展示 */
.b-chart-card { padding:24px; position:relative; z-index:1; }
.b-chart-card h3 { margin-bottom:4px; }

.section-intro { font-size:12px; color:var(--color-text-secondary); margin-bottom:4px; }
.section-intro-r { margin-bottom:16px; }

.b-chart-layout { display:flex; gap:16px; }
.b-chart-left { flex:7; min-width:0; padding:16px 20px; display:flex; flex-direction:column; }
.b-chart-right { flex:3; min-width:0; padding:20px 16px; display:flex; flex-direction:column; align-items:center; justify-content:center; }
.b-chart-subtitle { font-size:15px; font-weight:600; color:var(--color-text); margin-bottom:10px; display:flex; align-items:center; gap:6px; }
.b-chart-box { width:100%; height:360px; }

/* F2 课程学习成绩 */
.f2-card-title { font-size:15px; font-weight:600; color:var(--color-text); margin-bottom:8px; display:flex; align-items:center; gap:6px; align-self:flex-start; }

/* 顶部分数区 */
.f2-score-area { display:flex; flex-direction:column; align-items:center; gap:6px; margin-bottom:18px; }
.f2-score-main { font-size:38px; font-weight:700; color:#059669; line-height:1; }
.f2-score-main small { font-size:18px; font-weight:400; color:var(--color-text-secondary); }
.f2-diff-tag { font-size:11px; font-weight:600; color:#059669; background:#ECFDF5; padding:2px 10px; border-radius:var(--radius-full); white-space:nowrap; }
.f2-diff-tag.below { color:#DC2626; background:#FEF2F2; }

/* 双进度条 */
.f2-bar-wrap { width:100%; display:flex; flex-direction:column; gap:8px; margin-bottom:14px; }
.f2-bar-row { display:flex; align-items:center; gap:6px; }
.f2-bar-tag { font-size:10px; font-weight:600; color:#fff; background:#059669; padding:2px 6px; border-radius:3px; width:28px; text-align:center; flex-shrink:0; }
.f2-bar-tag.avg { background:var(--color-text-tertiary); }
.f2-bar-track { flex:1; height:7px; background:var(--color-surface-variant); border-radius:4px; overflow:hidden; }
.f2-bar-fill { height:100%; border-radius:4px; background:#059669; transition:width 1s ease; }
.f2-bar-fill.avg { background:var(--color-text-tertiary); }
.f2-bar-num { font-size:12px; font-weight:600; color:var(--color-text); width:28px; text-align:right; flex-shrink:0; }
.f2-meta { font-size:12px; color:var(--color-text-secondary); text-align:center; }

/* 历史发展卡片 */
.history-card { padding:24px; position:relative; z-index:1; }
.history-card h3 { margin-bottom:8px; }

/* 加载 */
.loading-state { display:flex; flex-direction:column; gap:24px; position:relative; z-index:1; }
.sk-grid { display:grid; grid-template-columns:1fr 1fr; gap:24px; }
.empty-state { text-align:center; padding:80px 24px; position:relative; z-index:1; }
.empty-icon { font-size:48px; color:var(--color-primary); margin-bottom:16px; opacity:0.5; }
.empty-state p { font-size:18px; color:var(--color-text); margin-bottom:8px; }
.empty-state span { font-size:14px; color:var(--color-text-secondary); }

@media (max-width:768px) {
  .overview-grid { grid-template-columns:1fr; }
  .student-bar { flex-wrap:wrap; }
  .fold-summary { display:none; }
  .radar-card-inner { height:auto; flex-direction:column; }
  .expand-detail { flex:0 0 auto; max-height:300px; }
  .radar-side { height:360px; }
  .dim-tag { padding:4px 8px; gap:3px; }
  .tag-score { font-size:13px; }
  .tag-name { font-size:11px; }
  .b-chart-layout { flex-direction:column; }
  .b-chart-left { flex:auto; }
  .b-chart-right { flex:auto; flex-direction:row; flex-wrap:wrap; justify-content:center; gap:20px; padding:20px; }
  .f2-score-big { margin-bottom:0; }
  .f2-bar-wrap { width:140px; }
  .b-chart-box { height:260px; }
}
@media (max-width:480px) {
  .rank-divider { display:none; }
  .rank-row { flex-direction:column; gap:8px; }
  .radar-card-inner { flex-direction:column; }
  .expand-detail { flex:0 0 auto; max-height:240px; }
  .radar-side { height:280px; }
}
</style>
