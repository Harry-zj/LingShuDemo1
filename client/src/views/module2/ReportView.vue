<template>
  <div class="report-page">
    <div class="page-header">
      <div>
        <h2>个性化评定报告</h2>
        <p class="page-desc">智能评语 · 五维分析 · 发展建议</p>
      </div>
      <select v-model="currentBatch" @change="loadData" class="batch-select glass-card">
        <option value="">选择批次</option>
        <option v-for="b in batches" :key="b.id" :value="b.id">{{ b.title }}</option>
      </select>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="skeleton skeleton-card" style="height:120px"></div>
      <div class="sk-grid"><div class="skeleton skeleton-card" v-for="i in 3" :key="i" style="height:160px"></div></div>
    </div>

    <div v-else-if="!evalData" class="empty-state glass-card">
      <div class="empty-icon"><VIcon icon="mdi:file-document-outline" /></div>
      <p>暂无评定数据，无法生成报告</p>
      <span>请等待老师完成评定后再生成报告</span>
    </div>

    <!-- 报告未生成 -->
    <div v-else-if="!hasReport" class="generate-card glass-card" style="text-align:center; padding:60px 24px;">
      <div class="gen-icon"><VIcon icon="mdi:robot-outline" /></div>
      <h3>评定报告尚未生成</h3>
      <p>基于您的五维评分数据，AI 将自动生成个性化评定报告与发展建议</p>
      <button class="gen-btn" @click="handleGenerate" :disabled="generating">
        <VIcon icon="mdi:sparkles" /> {{ generating ? "正在生成报告..." : "生成评定报告" }}
      </button>
    </div>

    <template v-else>
      <!-- 报告头部 -->
      <div class="report-header glass-card" style="animation: fadeInUp 0.5s var(--easing-spring) both;">
        <div class="card-accent" style="background: var(--color-primary-gradient-bright)"></div>
        <div class="rh-left">
          <h3>综合评定报告</h3>
          <div class="rh-meta">
            <span v-if="evalData.batch_title"><VIcon icon="mdi:calendar-text" /> {{ evalData.batch_title }}</span>
            <span v-if="evalData.updated_at"><VIcon icon="mdi:clock-outline" /> {{ evalData.updated_at?.slice(0, 10) }}</span>
          </div>
        </div>
        <div class="rh-right">
          <div class="rh-score" :style="{ background: 'var(--color-primary-gradient-bright)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }">{{ evalData.total_score ?? "--" }}</div>
          <div class="rh-unit">总分</div>
          <div class="rh-rank" v-if="evalData.class_rank">班级第 {{ evalData.class_rank }} / {{ evalData.class_size }} 名</div>
        </div>
      </div>

      <!-- 维度分析 -->
      <div class="card glass-card" style="animation: fadeInUp 0.5s var(--easing-spring) both; animation-delay: 0.1s;">
        <div class="card-accent" style="background: var(--color-meiyu)"></div>
        <h3><VIcon icon="mdi:layers-triple-outline" /> 五维维度分析</h3>
        <div class="dim-grid">
          <div class="dim-card" v-for="(d, i) in dimensionAnalysis" :key="d.key"
            :style="{ borderTopColor: d.color, animation: 'fadeInUp 0.4s var(--easing-spring) both', animationDelay: (0.1 + i * 0.08) + 's' }">
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
      <div class="card glass-card" v-if="evalData.report_content"
        style="animation: fadeInUp 0.5s var(--easing-spring) both; animation-delay: 0.2s;">
        <div class="card-accent" style="background: var(--color-primary)"></div>
        <h3><VIcon icon="mdi:text-box-outline" /> 综合评语</h3>
        <div class="report-text" v-html="formattedReport"></div>
      </div>

      <!-- 发展建议 -->
      <div class="card glass-card" style="animation: fadeInUp 0.5s var(--easing-spring) both; animation-delay: 0.3s;">
        <div class="card-accent" style="background: var(--color-success)"></div>
        <h3><VIcon icon="mdi:lightbulb-outline" /> 发展建议</h3>
        <div class="advice-list" v-if="adviceItems.length">
          <div class="advice-card" v-for="(item, i) in adviceItems" :key="i"
            :style="{ animation: 'fadeInUp 0.4s var(--easing-spring) both', animationDelay: (0.1 + i * 0.1) + 's' }">
            <div class="ac-icon"><VIcon :icon="item.type === 'strength' ? 'mdi:star-circle' : 'mdi:target'" :style="{ color: item.type === 'strength' ? 'var(--color-warning)' : 'var(--color-primary)' }" /></div>
            <div class="ac-body">
              <div class="ac-title">{{ item.title }}</div>
              <div class="ac-content">{{ item.content }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="bottom-actions">
        <button class="btn-outline" @click="handleGenerate" :disabled="generating"><VIcon icon="mdi:refresh" /> 重新生成</button>
        <button class="btn-ghost" disabled><VIcon icon="mdi:file-pdf-box" /> 导出 PDF（即将上线）</button>
      </div>
    </template>
  </div>
</template>
<script setup>
import { ref, computed, onMounted } from "vue"
import { getEvaluation, generateReport, getAdvice } from "../../api/module2"
import { getBatches } from "../../api/module3"

const dimConfig = [
  { key: "zhiyu", name: "智育", color: "#4F46E5" },
  { key: "deyu", name: "德育", color: "#D97706" },
  { key: "tiyu", name: "体育", color: "#059669" },
  { key: "meiyu", name: "美育", color: "#7C3AED" },
  { key: "laoyu", name: "劳育", color: "#EA580C" },
]
const levelMap = {
  excellent: { label: "优秀", color: "#059669", bg: "#ECFDF5" },
  good: { label: "良好", color: "#4F46E5", bg: "#EEF2FF" },
  average: { label: "一般", color: "#D97706", bg: "#FFFBEB" },
  weak: { label: "需提升", color: "#DC2626", bg: "#FEF2F2" },
}
function getLevel(s) { if (s >= 85) return "excellent"; if (s >= 70) return "good"; if (s >= 60) return "average"; return "weak" }
const summaryTemplates = {
  excellent: (n, s) => `「${n}」维度表现优异（${s}分），展现了突出的能力与素养，继续保持！`,
  good: (n, s) => `「${n}」维度表现良好（${s}分），已达到较高水平，可进一步提升。`,
  average: (n, s) => `「${n}」维度处于中等水平（${s}分），建议投入更多精力进行提升。`,
  weak: (n, s) => `「${n}」维度得分偏低（${s}分），需重点关注并制定专项提升计划。`,
}
const loading = ref(true); const generating = ref(false)
const evalData = ref(null); const adviceData = ref([])
const batches = ref([]); const currentBatch = ref("")
const hasReport = computed(() => !!evalData.value?.report_content)
const dimensionAnalysis = computed(() => dimConfig.map(d => { const score = evalData.value?.dimension_scores?.[d.key] ?? 0; const level = getLevel(score); return { ...d, score, level, levelLabel: levelMap[level].label, levelColor: levelMap[level].color, levelBg: levelMap[level].bg, summary: summaryTemplates[level](d.name, score) } }))
const adviceItems = computed(() => {
  if (adviceData.value?.length) return adviceData.value
  const items = []; const scores = dimensionAnalysis.value; const sorted = [...scores].sort((a, b) => b.score - a.score)
  if (sorted[0]) items.push({ type: "strength", title: `继续保持「${sorted[0].name}」优势`, content: `${sorted[0].name}维度得分最高（${sorted[0].score}分），是你综测的核心优势，建议继续巩固加强。` })
  if (sorted[4]) items.push({ type: "weakness", title: `重点提升「${sorted[4].name}」维度`, content: `${sorted[4].name}维度得分较低（${sorted[4].score}分），建议分析原因，积极参与相关活动，争取突破。` })
  return items
})
const formattedReport = computed(() => (evalData.value?.report_content || "").replace(/\n/g, "<br>"))
async function loadData() {
  loading.value = true
  try {
    const r1 = await getBatches(); if (r1.code === 200) batches.value = r1.data || []
    const p = currentBatch.value ? { batch_id: currentBatch.value } : {}
    const [r2, r3] = await Promise.all([getEvaluation(p), getAdvice(p)])
    if (r2.code === 200 && r2.data) evalData.value = r2.data; else evalData.value = null
    if (r3.code === 200) adviceData.value = r3.data || []
  } catch { evalData.value = null; adviceData.value = [] } finally { loading.value = false }
}
async function handleGenerate() {
  generating.value = true
  try { const p = currentBatch.value ? { batch_id: currentBatch.value } : {}; const res = await generateReport(p); if (res.code === 200) await loadData(); else alert(res.msg || "生成失败") }
  catch { alert("网络错误，请重试") } finally { generating.value = false }
}
onMounted(loadData)
</script>
<style scoped>
.report-page { display: flex; flex-direction: column; gap: 24px; animation: fadeIn 0.4s var(--easing-decelerate); }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; }
.page-header h2 { font-size: var(--font-scale-h2); font-weight: var(--font-weight-semibold); }
.page-desc { font-size: var(--font-scale-body-sm); color: var(--color-text-secondary); margin-top: 2px; }
.batch-select { padding: 8px 16px; border: none; border-radius: var(--radius-full); font-size: 14px; background: transparent; outline: none; color: var(--color-text); cursor: pointer; }
.loading-state { display: flex; flex-direction: column; gap: 24px; }
.sk-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.empty-state { text-align: center; padding: 80px 24px; }
.empty-icon { font-size: 48px; color: var(--color-primary); margin-bottom: 16px; opacity: 0.5; }
.empty-state p { font-size: 18px; color: var(--color-text); margin-bottom: 8px; }
.empty-state span { font-size: 14px; color: var(--color-text-secondary); }
.card { position: relative; overflow: hidden; padding: 24px; }
.card-accent { position: absolute; top: 0; left: 0; right: 0; height: 3px; opacity: 0.6; border-radius: 3px 3px 0 0; }
.card h3 { font-size: 16px; font-weight: var(--font-weight-semibold); margin-bottom: 20px; display: flex; align-items: center; gap: 8px; }
.generate-card h3 { font-size: 20px; color: var(--color-text); margin-bottom: 12px; justify-content: center; }
.generate-card p { font-size: 14px; color: var(--color-text-secondary); margin-bottom: 28px; max-width: 400px; margin-inline: auto; }
.gen-icon { font-size: 48px; color: var(--color-primary); margin-bottom: 16px; opacity: 0.6; }
.gen-btn { display: inline-flex; align-items: center; gap: 8px; padding: 12px 40px; background: var(--color-primary-gradient-bright); color: #fff; border: none; border-radius: var(--radius-full); font-size: 16px; font-weight: var(--font-weight-semibold); cursor: pointer; box-shadow: 0 4px 20px rgba(99,102,241,0.3); transition: all var(--duration-normal) var(--easing-spring); }
.gen-btn:hover { box-shadow: 0 8px 32px rgba(99,102,241,0.4); transform: translateY(-2px); }
.gen-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
.report-header { display: flex; justify-content: space-between; align-items: center; padding: 28px 24px; position: relative; overflow: hidden; }
.rh-left h3 { font-size: 20px; margin-bottom: 8px; }
.rh-meta { display: flex; gap: 16px; font-size: 13px; color: var(--color-text-secondary); }
.rh-meta span { display: flex; align-items: center; gap: 4px; }
.rh-right { text-align: center; }
.rh-score { font-size: 52px; font-weight: var(--font-weight-bold); line-height: 1; }
.rh-unit { font-size: 14px; color: var(--color-text-secondary); }
.rh-rank { font-size: 13px; color: var(--color-text-secondary); margin-top: 4px; }
.dim-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(175px, 1fr)); gap: 16px; }
.dim-card { padding: 20px; border-radius: var(--radius-lg); background: var(--color-surface-variant); border-top: 3px solid; }
.dc-head { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.dc-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.dc-name { font-size: 14px; font-weight: var(--font-weight-medium); flex: 1; }
.dc-badge { font-size: 11px; padding: 2px 8px; border-radius: var(--radius-full); font-weight: var(--font-weight-medium); }
.dc-score { font-size: 28px; font-weight: var(--font-weight-bold); color: var(--color-text); margin-bottom: 8px; }
.dc-unit { font-size: 14px; font-weight: var(--font-weight-regular); color: var(--color-text-secondary); }
.dc-desc { font-size: 12px; color: var(--color-text-secondary); line-height: 1.6; }
.report-text { font-size: 15px; line-height: var(--line-height-loose); color: var(--color-text); }
.advice-list { display: flex; flex-direction: column; gap: 16px; }
.advice-card { display: flex; gap: 16px; padding: 20px; background: var(--color-surface-variant); border-radius: var(--radius-lg); }
.ac-icon { font-size: 24px; flex-shrink: 0; }
.ac-title { font-size: 15px; font-weight: var(--font-weight-semibold); color: var(--color-text); margin-bottom: 6px; }
.ac-content { font-size: 14px; color: var(--color-text-secondary); line-height: 1.6; }
.bottom-actions { display: flex; gap: 12px; justify-content: center; padding-top: 8px; }
.btn-outline, .btn-ghost { display: inline-flex; align-items: center; gap: 6px; padding: 10px 28px; border-radius: var(--radius-full); font-size: 14px; font-weight: var(--font-weight-medium); cursor: pointer; transition: all var(--duration-fast) var(--easing-standard); }
.btn-outline { border: 1px solid var(--color-primary); background: transparent; color: var(--color-primary); }
.btn-outline:hover:not(:disabled) { background: var(--color-primary-light); }
.btn-ghost { border: 1px solid var(--color-border); background: transparent; color: var(--color-text-secondary); cursor: not-allowed; opacity: 0.6; }
</style>
