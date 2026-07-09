<template>
  <div class="report-page">
    <div class="page-header">
      <h2>个性化评定报告</h2>
      <select v-model="currentBatch" @change="loadData" class="batch-select">
        <option value="">选择批次</option>
        <option v-for="b in batches" :key="b.id" :value="b.id">{{ b.title }}</option>
      </select>
    </div>

    <!-- 加载态 -->
    <div v-if="loading" class="skeleton">
      <div class="sk-header"></div>
      <div class="sk-grid"><div class="sk-card"></div><div class="sk-card"></div><div class="sk-card"></div></div>
    </div>

    <!-- 无评定数据 -->
    <div v-else-if="!evalData" class="empty-state">
      <div class="empty-icon">📄</div>
      <p>暂无评定数据，无法生成报告</p>
      <span>请等待老师完成评定后再生成报告</span>
    </div>

    <!-- 报告未生成 -->
    <div v-else-if="!hasReport" class="generate-card card">
      <div class="gen-icon">📝</div>
      <h3>评定报告尚未生成</h3>
      <p>基于您的五维评分数据，系统将自动生成个性化评定报告与发展建议</p>
      <button class="gen-btn" @click="handleGenerate" :disabled="generating">
        {{ generating ? "正在生成报告..." : "生成评定报告" }}
      </button>
    </div>

    <!-- 报告已生成 -->
    <template v-else>
      <div class="report-header card">
        <div class="rh-left">
          <h3>综合评定报告</h3>
          <div class="rh-meta">
            <span v-if="evalData.batch_title">批次：{{ evalData.batch_title }}</span>
            <span v-if="evalData.updated_at">生成时间：{{ evalData.updated_at?.slice(0, 10) }}</span>
          </div>
        </div>
        <div class="rh-right">
          <div class="rh-score">{{ evalData.total_score ?? "--" }}</div>
          <div class="rh-unit">总分</div>
          <div class="rh-rank" v-if="evalData.class_rank">
            班级第 {{ evalData.class_rank }} / {{ evalData.class_size }} 名
          </div>
        </div>
      </div>

      <!-- 维度分析卡片 -->
      <div class="card">
        <h3>五维维度分析</h3>
        <div class="dim-grid">
          <div class="dim-card" v-for="d in dimensionAnalysis" :key="d.key" :style="{ borderTopColor: d.color }">
            <div class="dc-head">
              <span class="dc-dot" :style="{ background: d.color }"></span>
              <span class="dc-name">{{ d.name }}</span>
              <span class="dc-badge" :style="{ background: d.levelBg, color: d.levelColor }">{{ d.levelLabel }}</span>
            </div>
            <div class="dc-score">{{ d.score }}<span class="dc-unit">分</span></div>
            <p class="dc-desc">{{ d.summary }}</p>
          </div>
        </div>
      </div>

      <!-- 综合评语 -->
      <div class="card" v-if="evalData.report_content">
        <h3>综合评语</h3>
        <div class="report-text" v-html="formattedReport"></div>
      </div>

      <!-- 发展建议 -->
      <div class="card">
        <h3>发展建议</h3>
        <div class="advice-list" v-if="adviceItems.length">
          <div class="advice-card" v-for="(item, i) in adviceItems" :key="i">
            <div class="ac-icon">{{ item.type === "strength" ? "🌟" : "🎯" }}</div>
            <div class="ac-body">
              <div class="ac-title">{{ item.title }}</div>
              <div class="ac-content">{{ item.content }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部操作 -->
      <div class="bottom-actions">
        <button class="btn-outline" @click="handleGenerate" :disabled="generating">重新生成</button>
        <button class="btn-export" disabled title="功能待实现">导出 PDF</button>
      </div>
    </template>
  </div>
</template>
<script setup>
import { ref, computed, onMounted } from "vue"
import { getEvaluation, generateReport, getAdvice } from "../../api/module2"
import { getBatches } from "../../api/module3"

const dimConfig = [
  { key: "zhiyu", name: "智育", color: "#1A73E8" },
  { key: "deyu", name: "德育", color: "#EA8600" },
  { key: "tiyu", name: "体育", color: "#34A853" },
  { key: "meiyu", name: "美育", color: "#9C27B0" },
  { key: "laoyu", name: "劳育", color: "#FF6D00" },
]

const levelMap = {
  excellent: { label: "优秀", color: "#34A853", bg: "#E6F4EA" },
  good: { label: "良好", color: "#1A73E8", bg: "#E8F0FE" },
  average: { label: "一般", color: "#E37400", bg: "#FEF7E0" },
  weak: { label: "需提升", color: "#D93025", bg: "#FCE8E6" },
}

function getLevel(score) {
  if (score >= 85) return "excellent"
  if (score >= 70) return "good"
  if (score >= 60) return "average"
  return "weak"
}

const summaryTemplates = {
  excellent: (name, score) => `${name}维度表现优异（${score}分），展现了突出的能力与素养，继续保持！`,
  good: (name, score) => `${name}维度表现良好（${score}分），已达到较高水平，可进一步提升。`,
  average: (name, score) => `${name}维度处于中等水平（${score}分），建议投入更多精力进行提升。`,
  weak: (name, score) => `${name}维度得分偏低（${score}分），需要重点关注并制定专项提升计划。`,
}

const loading = ref(true)
const generating = ref(false)
const evalData = ref(null)
const adviceData = ref([])
const batches = ref([])
const currentBatch = ref("")

const hasReport = computed(() => !!evalData.value?.report_content)

const dimensionAnalysis = computed(() =>
  dimConfig.map(d => {
    const score = evalData.value?.dimension_scores?.[d.key] ?? 0
    const level = getLevel(score)
    return {
      ...d, score,
      level,
      levelLabel: levelMap[level].label,
      levelColor: levelMap[level].color,
      levelBg: levelMap[level].bg,
      summary: summaryTemplates[level](d.name, score),
    }
  })
)

const adviceItems = computed(() => {
  if (adviceData.value?.length) return adviceData.value
  // 前端兜底：基于维度分数自动生成建议
  const items = []
  const scores = dimensionAnalysis.value
  const sorted = [...scores].sort((a, b) => b.score - a.score)
  if (sorted[0]) items.push({ type: "strength", title: `继续保持「${sorted[0].name}」优势`, content: `${sorted[0].name}维度得分最高（${sorted[0].score}分），是你综测的核心优势，建议继续巩固加强。` })
  if (sorted[4]) items.push({ type: "weakness", title: `重点提升「${sorted[4].name}」维度`, content: `${sorted[4].name}维度得分较低（${sorted[4].score}分），建议分析原因，积极参与相关活动，争取下次评定时有所突破。` })
  return items
})

const formattedReport = computed(() => {
  const text = evalData.value?.report_content || ""
  return text.replace(/\n/g, "<br>")
})

async function loadData() {
  loading.value = true
  try {
    const r1 = await getBatches()
    if (r1.code === 200) batches.value = r1.data || []
    const params = currentBatch.value ? { batch_id: currentBatch.value } : {}
    const [r2, r3] = await Promise.all([getEvaluation(params), getAdvice(params)])
    if (r2.code === 200 && r2.data) evalData.value = r2.data
    else evalData.value = null
    if (r3.code === 200) adviceData.value = r3.data || []
  } catch { evalData.value = null; adviceData.value = [] }
  finally { loading.value = false }
}

async function handleGenerate() {
  generating.value = true
  try {
    const params = currentBatch.value ? { batch_id: currentBatch.value } : {}
    const res = await generateReport(params)
    if (res.code === 200) await loadData()
    else alert(res.msg || "生成失败，请重试")
  } catch { alert("网络错误，请重试") }
  finally { generating.value = false }
}

onMounted(loadData)
</script>
<style scoped>
.report-page { display: flex; flex-direction: column; gap: 24px; }
.page-header { display: flex; justify-content: space-between; align-items: center; }
.page-header h2 { font-size: 24px; }
.batch-select { padding: 8px 16px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 14px; background: var(--color-white); outline: none; }
.batch-select:focus { border-color: var(--color-primary); }

.skeleton { display: flex; flex-direction: column; gap: 24px; }
.sk-header { height: 120px; background: linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: var(--radius-card); }
.sk-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.sk-card { height: 160px; background: linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: var(--radius-card); }
@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }

.empty-state { text-align: center; padding: 80px 24px; background: var(--color-white); border-radius: var(--radius-card); border: 1px solid var(--color-border); }
.empty-icon { font-size: 48px; margin-bottom: 16px; }
.empty-state p { font-size: 18px; color: var(--color-text); margin-bottom: 8px; }
.empty-state span { font-size: 14px; color: var(--color-text-secondary); }

.card { background: var(--color-white); border-radius: var(--radius-card); border: 1px solid var(--color-border); padding: 24px; }
.card h3 { font-size: 16px; margin-bottom: 20px; }

/* 生成卡片 */
.generate-card { text-align: center; padding: 60px 24px; }
.gen-icon { font-size: 56px; margin-bottom: 16px; }
.generate-card h3 { font-size: 20px; color: var(--color-text); margin-bottom: 12px; }
.generate-card p { font-size: 14px; color: var(--color-text-secondary); margin-bottom: 28px; max-width: 400px; margin-inline: auto; }
.gen-btn { padding: 12px 40px; background: var(--color-primary); color: #fff; border: none; border-radius: var(--radius-btn); font-size: 16px; cursor: pointer; transition: opacity 0.2s; }
.gen-btn:hover { opacity: 0.9; }
.gen-btn:disabled { opacity: 0.6; cursor: not-allowed; }

/* 报告头部 */
.report-header { display: flex; justify-content: space-between; align-items: center; }
.rh-left h3 { font-size: 20px; margin-bottom: 8px; }
.rh-meta { display: flex; gap: 16px; font-size: 13px; color: var(--color-text-secondary); }
.rh-right { text-align: center; }
.rh-score { font-size: 48px; font-weight: 700; color: var(--color-primary); line-height: 1; }
.rh-unit { font-size: 14px; color: var(--color-text-secondary); }
.rh-rank { font-size: 13px; color: var(--color-text-secondary); margin-top: 4px; }

/* 维度分析 */
.dim-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; }
.dim-card { padding: 20px; border-radius: var(--radius-sm); border: 1px solid var(--color-border); border-top: 3px solid var(--color-border); }
.dc-head { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.dc-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.dc-name { font-size: 14px; font-weight: 500; flex: 1; }
.dc-badge { font-size: 11px; padding: 2px 6px; border-radius: var(--radius-tag); }
.dc-score { font-size: 28px; font-weight: 700; color: var(--color-text); margin-bottom: 8px; }
.dc-unit { font-size: 14px; font-weight: 400; color: var(--color-text-secondary); }
.dc-desc { font-size: 12px; color: var(--color-text-secondary); line-height: 1.6; }

/* 综合评语 */
.report-text { font-size: 15px; line-height: 1.8; color: var(--color-text); }

/* 发展建议 */
.advice-list { display: flex; flex-direction: column; gap: 16px; }
.advice-card { display: flex; gap: 16px; padding: 20px; background: var(--color-bg); border-radius: var(--radius-md); }
.ac-icon { font-size: 28px; flex-shrink: 0; }
.ac-title { font-size: 15px; font-weight: 600; color: var(--color-text); margin-bottom: 6px; }
.ac-content { font-size: 14px; color: var(--color-text-secondary); line-height: 1.6; }

/* 底部操作 */
.bottom-actions { display: flex; gap: 12px; justify-content: center; }
.btn-outline { padding: 10px 32px; border: 1px solid var(--color-primary); border-radius: var(--radius-btn); background: var(--color-white); color: var(--color-primary); font-size: 14px; cursor: pointer; transition: opacity 0.2s; }
.btn-outline:hover { opacity: 0.8; }
.btn-outline:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-export { padding: 10px 32px; border: none; border-radius: var(--radius-btn); background: var(--color-gray); color: #fff; font-size: 14px; cursor: not-allowed; }
</style>
