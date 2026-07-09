<template>
  <div class="report-page">
    <div class="bg-atmosphere">
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
    </div>

    <div class="page-header">
      <div>
        <h2>个性化评定报告</h2>
        <p class="page-desc">德智体美劳 · 五维分析 · 发展建议</p>
      </div>
      <div class="header-right">
        <router-link to="/module2/evaluation" class="nav-link-btn glass-card">
          <VIcon icon="mdi:chart-bell-curve" /> 评定结果
        </router-link>
        <select v-model="currentBatch" @change="loadData" class="batch-select glass-card">
          <option value="">选择批次</option>
          <option v-for="b in batches" :key="b.id" :value="b.id">{{ b.title }}</option>
        </select>
      </div>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="skeleton skeleton-card" style="height:100px"></div>
      <div class="sk-grid"><div class="skeleton skeleton-card" v-for="i in 3" :key="i" style="height:160px"></div></div>
    </div>

    <div v-else-if="!evalData" class="empty-state glass-card">
      <div class="empty-icon"><VIcon icon="mdi:file-document-outline" /></div>
      <p>暂无评定数据，无法生成报告</p>
      <span>请等待老师完成评定后再生成报告</span>
    </div>

    <div v-else class="report-content" ref="reportRef" :class="{ 'export-mode': exporting }">
      <!-- 报告头部 -->
      <div class="export-card reveal" style="animation-delay: 0.1s;">
        <div class="card-accent" style="background: var(--color-primary-gradient-bright)"></div>
        <div class="report-header">
          <div class="rh-left">
            <h3><span class="export-icon">◆</span> 综合评定报告</h3>
            <div class="rh-meta">
              <span>{{ evalData.student?.name || "--" }}</span>
              <span>{{ evalData.student?.grade }}</span>
              <span>{{ evalData.student?.major }}</span>
              <span>{{ evalData.student?.semester }}</span>
            </div>
          </div>
          <div class="rh-right">
            <div class="rh-score-wrap">
              <div class="rh-score">{{ evalData.scores?.F ?? "--" }}</div>
              <div class="rh-unit">/ 100 分</div>
            </div>
            <div class="rh-formula">F = F1×10% + F2×65% + F3×25%</div>
            <div class="rh-rank" v-if="evalData.rank">班级第 {{ evalData.rank }} / {{ evalData.totalStudents }} 名</div>
          </div>
        </div>
      </div>

      <!-- 五维分析 -->
      <div class="export-card reveal" style="animation-delay: 0.2s;">
        <div class="card-accent" style="background: var(--color-meiyu)"></div>
        <h3><span class="export-icon">◆</span> 五维维度分析</h3>
        <div class="dim-grid">
          <div class="dim-card" v-for="d in dimensionAnalysis" :key="d.key"
            :style="{ borderTopColor: d.color }">
            <div class="dc-head">
              <span class="dc-dot" :style="{ background: d.color }"></span>
              <span class="dc-name">{{ d.name }}</span>
              <span class="dc-badge" :style="{ background: d.level.bg, color: d.level.color }">{{ d.level.label }}</span>
            </div>
            <div class="dc-score">{{ d.score }}<span class="dc-unit">分</span></div>
            <p class="dc-desc">{{ d.desc }}</p>
          </div>
        </div>
      </div>

      <!-- 综合评语 -->
      <div class="export-card reveal" style="animation-delay: 0.3s;">
        <div class="card-accent" style="background: var(--color-primary)"></div>
        <h3><span class="export-icon">◆</span> 综合评语</h3>
        <div class="report-text" v-html="formattedReport"></div>
      </div>

      <!-- 发展建议 -->
      <div class="export-card reveal" style="animation-delay: 0.4s;">
        <div class="card-accent" style="background: var(--color-success)"></div>
        <h3><span class="export-icon">◆</span> 发展建议</h3>
        <div class="advice-list" v-if="adviceItems.length">
          <div class="advice-card" v-for="(item, i) in adviceItems" :key="i">
            <div class="ac-badge" :class="item.type === 'strength' ? 'ac-strength' : 'ac-weakness'">
              {{ item.type === "strength" ? "优势" : "提升" }}
            </div>
            <div class="ac-body">
              <div class="ac-title">{{ item.title }}</div>
              <div class="ac-content">{{ item.content }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 导出按钮 -->
    <div class="bottom-actions" v-if="hasReport && evalData">
      <button class="btn-outline" @click="handleGenerate" :disabled="generating">
        <VIcon icon="mdi:refresh" /> 重新生成
      </button>
      <div class="export-group">
        <select v-model="exportFormat" class="export-select glass-card">
          <option value="pdf">PDF 文档</option>
          <option value="png">PNG 图片</option>
          <option value="jpeg">JPEG 图片</option>
        </select>
        <button class="btn-export" @click="handleExport" :disabled="exporting">
          <VIcon icon="mdi:download" /> {{ exporting ? "导出中..." : "导出 " + exportLabel }}
        </button>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, computed, onMounted } from "vue"
import { getEvaluation, generateReport, getAdvice } from "../../api/module2"
import { getBatches } from "../../api/module3"
import { exportPDF, exportImage } from "../../utils/exportReport"
import { rawToDimensions, DIMENSION_CONFIG, getGradeLevel } from "../../utils/scoreHelper"

const loading = ref(true); const generating = ref(false); const exporting = ref(false)
const reportRef = ref(null); const exportFormat = ref("pdf")
const formatLabelMap = { pdf: "PDF", png: "PNG", jpeg: "JPEG" }
const exportLabel = computed(() => formatLabelMap[exportFormat.value] || "PDF")
const evalData = ref(null)
const reportData = ref({})
const adviceData = ref([])
const batches = ref([])
const currentBatch = ref("")

// 五维分析（直接从 evalData 计算，无需等待后端生成）
const dimensionScores = computed(() => rawToDimensions(evalData.value))
const dimensionAnalysis = computed(() =>
  DIMENSION_CONFIG.map(d => {
    const score = Math.round(dimensionScores.value[d.key] || 0)
    return { ...d, score, level: getGradeLevel(score) }
  })
)
const adviceItems = computed(() => {
  if (adviceData.value?.length) return adviceData.value
  const sorted = [...dimensionAnalysis.value].sort((a, b) => b.score - a.score)
  const items = []
  if (sorted[0]) items.push({ type: "strength", title: `继续保持「${sorted[0].name}」优势`, content: `${sorted[0].desc}方面得分最高（${sorted[0].score}分），是你综测的核心优势。` })
  if (sorted[4]) items.push({ type: "weakness", title: `重点提升「${sorted[4].name}」维度`, content: `${sorted[4].desc}方面得分较低（${sorted[4].score}分），建议积极参与相关活动，争取突破。` })
  return items
})

// 前端直接生成评语文本
const generatedReport = computed(() => {
  if (!evalData.value) return ""
  const dims = dimensionAnalysis.value
  const sorted = [...dims].sort((a, b) => b.score - a.score)
  const best = sorted[0], worst = sorted[4]
  const F = evalData.value.scores?.F ?? "--"
  return [
    `综测总分：${F} 分  |  班级排名：第 ${evalData.value.rank || "--"} / ${evalData.value.totalStudents || "--"} 名`,
    `计算公式：F = F1×10% + F2×65% + F3×25% = ${evalData.value.scores?.F1}×10% + ${evalData.value.scores?.F2}×65% + ${evalData.value.scores?.F3}×25%`,
    "",
    "【五维得分明细】",
    ...sorted.map(d => `  ${d.name}（${d.desc}）：${d.score} 分  [${d.level.label}]`),
    "",
    `【优势分析】你在「${best?.name}」维度表现最为突出（${best?.score}分），展现了该领域的扎实基础。`,
    `【提升方向】「${worst?.name}」维度有较大提升空间（${worst?.score}分），建议下阶段重点突破。`,
    "",
    "【综合评价】",
    parseFloat(F) >= 90 ? "整体表现卓越，德智体美劳全面发展，望再接再厉。" :
    parseFloat(F) >= 80 ? "整体表现优秀，各维度发展较为均衡，继续保持。" :
    parseFloat(F) >= 70 ? "整体表现良好，建议重点补齐短板以实现全面进步。" :
    parseFloat(F) >= 60 ? "整体表现合格，建议制定系统的提升计划。" :
    "整体表现需重点提升，建议加强课程学习与创新实践能力培养。"
  ].join("\n")
})
const formattedReport = computed(() => generatedReport.value.replace(/\n/g, "<br>"))

async function loadData() {
  loading.value = true
  try {
    const r1 = await getBatches(); if (r1.code === 200) batches.value = r1.data || []
    const p = currentBatch.value ? { batch_id: currentBatch.value } : {}
    const [r2, r3] = await Promise.all([getEvaluation(p), getAdvice(p)])
    if (r2.code === 200 && r2.data) evalData.value = r2.data; else evalData.value = null
    if (r3.code === 200) adviceData.value = r3.data || []
    // 自动调后端生成报告以获取更完整的建议
    const r4 = await generateReport(p)
    if (r4.code === 200) reportData.value = r4.data
  } catch { evalData.value = null; adviceData.value = [] } finally { loading.value = false }
}

async function handleGenerate() {
  generating.value = true
  try {
    const p = currentBatch.value ? { batch_id: currentBatch.value } : {}
    const res = await generateReport(p)
    if (res.code === 200) { reportData.value = res.data; adviceData.value = res.data.advice || [] }
    else alert(res.msg || "生成失败")
  } catch { alert("网络错误，请重试") } finally { generating.value = false }
}

async function handleExport() {
  if (!reportRef.value || exporting.value) return
  exporting.value = true
  try {
    await new Promise(r => setTimeout(r, 100))
    const name = (evalData.value?.student?.name || "报告").replace(/\s/g, "_")
    const filename = `评定报告_${name}_${new Date().toLocaleDateString("zh-CN").replace(/\//g, "-")}`
    if (exportFormat.value === "pdf") await exportPDF(reportRef.value, filename + ".pdf")
    else await exportImage(reportRef.value, filename + "." + exportFormat.value, exportFormat.value)
  } catch (e) { alert("导出失败：" + e.message) } finally { exporting.value = false }
}

onMounted(loadData)
</script>
<style scoped>
.report-page { display: flex; flex-direction: column; gap: 24px; animation: fadeIn 0.4s var(--easing-decelerate); position: relative; }

.bg-atmosphere { position: fixed; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; z-index: 0; overflow: hidden; }
.orb { position: absolute; border-radius: 50%; opacity: 0.06; filter: blur(80px); }
.orb-1 { width: 380px; height: 380px; background: var(--color-primary); top: -80px; right: -80px; animation: orbDrift1 16s ease-in-out infinite; }
.orb-2 { width: 260px; height: 260px; background: var(--color-warning); bottom: -60px; left: -60px; animation: orbDrift2 20s ease-in-out infinite; }

.page-header { display: flex; justify-content: space-between; align-items: flex-start; position: relative; z-index: 1; }
.header-right { display: flex; align-items: center; gap: 10px; }
.nav-link-btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 18px; border: 1px solid var(--color-border); border-radius: var(--radius-full); font-size: 13px; color: var(--color-primary); cursor: pointer; text-decoration: none; transition: all var(--duration-fast); }
.nav-link-btn:hover { border-color: var(--color-primary); background: var(--color-primary-light); }
.page-header h2 { font-size: var(--font-scale-h2); font-weight: var(--font-weight-semibold); }
.page-desc { font-size: var(--font-scale-body-sm); color: var(--color-text-secondary); margin-top: 2px; }
.batch-select { padding: 9px 32px 9px 16px; border: 1px solid var(--color-border); border-radius: var(--radius-full); font-size: 13px; background: var(--glass-bg); backdrop-filter: var(--glass-blur); color: var(--color-text); cursor: pointer; outline: none; appearance: none; -webkit-appearance: none; background-image: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'%3E%3Cpath fill='%235F6368' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E\"); background-repeat: no-repeat; background-position: right 12px center; transition: all var(--duration-fast); }
.batch-select:hover { border-color: var(--color-primary); }
.batch-select:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
.loading-state { display: flex; flex-direction: column; gap: 24px; position: relative; z-index: 1; }
.sk-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.empty-state { text-align: center; padding: 80px 24px; position: relative; z-index: 1; }
.empty-icon { font-size: 48px; color: var(--color-primary); margin-bottom: 16px; opacity: 0.5; }
.empty-state p { font-size: 18px; color: var(--color-text); margin-bottom: 8px; }
.empty-state span { font-size: 14px; color: var(--color-text-secondary); }
.generate-card h3 { font-size: 20px; margin-bottom: 12px; }
.generate-card p { font-size: 14px; color: var(--color-text-secondary); margin-bottom: 28px; max-width: 400px; margin-inline: auto; }
.gen-icon { font-size: 48px; color: var(--color-primary); margin-bottom: 16px; opacity: 0.6; }
.gen-btn { display: inline-flex; align-items: center; gap: 8px; padding: 12px 40px; background: var(--color-primary-gradient-bright); color: #fff; border: none; border-radius: var(--radius-full); font-size: 16px; font-weight: var(--font-weight-semibold); cursor: pointer; box-shadow: 0 4px 20px rgba(99,102,241,0.3); transition: all var(--duration-normal) var(--easing-spring); }
.gen-btn:hover:not(:disabled) { box-shadow: 0 8px 32px rgba(99,102,241,0.4); transform: translateY(-2px); }
.gen-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

/* 报告内容 */
.report-content { display: flex; flex-direction: column; gap: 24px; position: relative; z-index: 1; }
.reveal { animation: fadeInUp 0.6s var(--easing-spring) both; }
.export-card { position: relative; overflow: hidden; padding: 24px; background: var(--glass-bg); backdrop-filter: var(--glass-blur); -webkit-backdrop-filter: var(--glass-blur); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); box-shadow: var(--glass-shadow); transition: all var(--duration-normal) var(--easing-spring); }
.export-card:hover { transform: translateY(-3px); box-shadow: var(--glass-shadow-hover); }
.export-card:hover .card-accent { opacity: 1; }
.card-accent { position: absolute; top: 0; left: 0; right: 0; height: 3px; opacity: 0.6; border-radius: 3px 3px 0 0; transition: opacity var(--duration-normal); }
.export-card h3 { font-size: 16px; font-weight: var(--font-weight-semibold); margin-bottom: 20px; display: flex; align-items: center; gap: 8px; }
.export-icon { font-size: 12px; opacity: 0.7; }

.report-header { display: flex; justify-content: space-between; align-items: center; }
.rh-left h3 { font-size: 20px; margin-bottom: 8px; }
.rh-meta { display: flex; gap: 16px; font-size: 13px; color: var(--color-text-secondary); flex-wrap: wrap; }
.rh-right { text-align: center; flex-shrink: 0; }
.rh-score-wrap { display: flex; align-items: baseline; gap: 4px; justify-content: center; }
.rh-score { font-size: 52px; font-weight: var(--font-weight-bold); line-height: 1; color: var(--color-primary); }
.rh-unit { font-size: 14px; color: var(--color-text-secondary); }
.rh-formula { font-size: 11px; color: var(--color-text-tertiary); margin-top: 4px; }
.rh-rank { font-size: 14px; color: var(--color-text-secondary); margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--color-border); }

.dim-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; }
.dim-card { padding: 18px 14px; border-radius: var(--radius-lg); background: var(--color-surface-variant); border-top: 3px solid; }
.dc-head { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.dc-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.dc-name { font-size: 15px; font-weight: var(--font-weight-semibold); flex: 1; }
.dc-badge { font-size: 11px; padding: 2px 8px; border-radius: var(--radius-full); font-weight: var(--font-weight-medium); }
.dc-score { font-size: 28px; font-weight: var(--font-weight-bold); color: var(--color-text); margin-bottom: 6px; }
.dc-unit { font-size: 14px; font-weight: var(--font-weight-regular); color: var(--color-text-secondary); }
.dc-desc { font-size: 11px; color: var(--color-text-secondary); line-height: 1.5; }

.report-text { font-size: 15px; line-height: var(--line-height-loose); color: var(--color-text); }

.advice-list { display: flex; flex-direction: column; gap: 16px; }
.advice-card { display: flex; gap: 16px; padding: 20px; background: var(--color-surface-variant); border-radius: var(--radius-lg); align-items: flex-start; }
.ac-badge { flex-shrink: 0; padding: 4px 12px; border-radius: var(--radius-full); font-size: 12px; font-weight: var(--font-weight-semibold); }
.ac-strength { background: #ECFDF5; color: #059669; }
.ac-weakness { background: #EEF2FF; color: #4F46E5; }
.ac-body { flex: 1; }
.ac-title { font-size: 15px; font-weight: var(--font-weight-semibold); color: var(--color-text); margin-bottom: 6px; }
.ac-content { font-size: 14px; color: var(--color-text-secondary); line-height: 1.6; }

.bottom-actions { display: flex; gap: 12px; justify-content: center; align-items: center; padding-top: 8px; flex-wrap: wrap; position: relative; z-index: 1; }
.btn-outline { display: inline-flex; align-items: center; gap: 6px; padding: 10px 28px; border-radius: var(--radius-full); font-size: 14px; font-weight: var(--font-weight-medium); cursor: pointer; transition: all var(--duration-fast) var(--easing-standard); border: 1px solid var(--color-primary); background: transparent; color: var(--color-primary); }
.btn-outline:hover:not(:disabled) { background: var(--color-primary-light); }
.btn-outline:disabled { opacity: 0.5; cursor: not-allowed; }
.export-group { display: flex; align-items: center; }
.export-select { padding: 9px 32px 9px 14px; border: 1px solid var(--color-border); border-right: none; border-radius: var(--radius-full) 0 0 var(--radius-full); font-size: 13px; background: var(--glass-bg); backdrop-filter: var(--glass-blur); color: var(--color-text); cursor: pointer; outline: none; appearance: none; -webkit-appearance: none; background-image: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'%3E%3Cpath fill='%235F6368' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E\"); background-repeat: no-repeat; background-position: right 10px center; transition: all var(--duration-fast); }
.export-select:hover { border-color: var(--color-primary); }
.export-select:focus { border-color: var(--color-primary); }
.btn-export { display: inline-flex; align-items: center; gap: 6px; padding: 10px 24px; border: none; border-radius: 0 var(--radius-full) var(--radius-full) 0; background: var(--color-primary-gradient-bright); color: #fff; font-size: 14px; font-weight: var(--font-weight-semibold); cursor: pointer; box-shadow: 0 4px 20px rgba(99,102,241,0.3); transition: all var(--duration-normal) var(--easing-spring); }
.btn-export:hover:not(:disabled) { box-shadow: 0 8px 32px rgba(99,102,241,0.4); transform: translateY(-2px); }
.btn-export:disabled { opacity: 0.6; cursor: not-allowed; transform: none; box-shadow: none; }

@media (max-width: 900px) { .dim-grid { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 600px) { .dim-grid { grid-template-columns: 1fr 1fr; } .report-header { flex-direction: column; text-align: center; gap: 16px; } }
</style>
