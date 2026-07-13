<template>
  <div class="dashboard">
    <!-- ★ 当前批次（自动匹配，只读展示） -->
    <div v-if="currentBatch" class="batch-info-bar">
      <span class="batch-icon">📋</span>
      <span class="batch-title">{{ currentBatch.title }}</span>
      <span class="batch-meta">{{ currentBatch.school_year }} · {{ currentBatch.college }} · {{ currentBatch.grade }}</span>
      <span class="batch-status-tag" :class="'status-' + currentBatch.status">{{ batchStatusLabel }}</span>
    </div>
    <div v-else-if="batchError" class="batch-error-bar">
      <span class="batch-error-icon">⚠</span>
      <span>{{ batchError }}</span>
    </div>
    <div v-else class="batch-info-bar batch-loading">
      <span>加载批次信息...</span>
    </div>

    <h2 class="page-title">智能填表</h2>

    <div class="status-bar">
      <div class="status-item" :class="{ ready: ruleReady }">
        <span class="status-num">{{ publishedRuleSetCount }}</span>
        <span class="status-label">已发布规则集</span>
      </div>
      <div class="status-item" :class="{ ready: materialCount > 0 }">
        <span class="status-num">{{ materialCount }}</span>
        <span class="status-label">已上传材料</span>
      </div>
      <div class="status-item" :class="{ ready: confirmedRecCount > 0 }">
        <span class="status-num">{{ confirmedRecCount }}</span>
        <span class="status-label">已确认识别</span>
      </div>
      <div class="status-item" :class="{ ready: totalScore !== null }">
        <span class="status-num">{{ totalScore !== null ? totalScore : '-' }}</span>
        <span class="status-label">总分</span>
      </div>
    </div>

    <div class="card-grid">
      <div class="func-card" :class="{ active: activeCard === 'rule' }" @click="openCard('rule')">
        <div class="card-icon">①</div><div class="card-content"><h3>规则管理</h3><p>上传规则，AI解析</p><span class="card-status done">{{ ruleReady ? '已发布' : '待发布' }}</span></div>
      </div>
      <div class="func-card" :class="{ active: activeCard === 'material' }" @click="openCard('material')">
        <div class="card-icon">②</div><div class="card-content"><h3>材料上传与识别</h3><p>上传证明，AI识别加分</p><span class="card-status" :class="ruleReady?'ready':'locked'">{{ ruleReady ? materialCount+'份' : '请先发布规则集' }}</span></div>
      </div>
      <div class="func-card" :class="{ active: activeCard === 'score' }" @click="openCard('score')">
        <div class="card-icon">③</div><div class="card-content"><h3>F3 评分清单</h3><p>B1-B8加分明细</p><span class="card-status" :class="confirmedRecCount>0?'ready':'locked'">{{ confirmedRecCount>0 ? confirmedRecCount+'条确认' : '请先确认' }}</span></div>
      </div>
      <div class="func-card" :class="{ active: activeCard === 'f1' }" @click="openCard('f1')">
        <div class="card-icon">④</div><div class="card-content"><h3>F1 基本素质</h3><p>思想政治、道德品质评分</p><span class="card-status" :class="ruleReady?'ready':'locked'">{{ ruleReady?'填写评分':'请先发布规则集' }}</span></div>
      </div>
      <div class="func-card" :class="{ active: activeCard === 'f2' }" @click="openCard('f2')">
        <div class="card-icon">⑤</div><div class="card-content"><h3>F2 课程成绩</h3><p>录入课程学分和成绩</p><span class="card-status" :class="ruleReady?'ready':'locked'">{{ ruleReady?'录入成绩':'请先发布规则集' }}</span></div>
      </div>
      <div class="func-card" :class="{ active: activeCard === 'form' }" @click="openCard('form')">
        <div class="card-icon">⑥</div><div class="card-content"><h3>自动填表</h3><p>上传模板，一键填充下载</p><span class="card-status" :class="confirmedRecCount>0?'ready':'locked'">自动填表</span></div>
      </div>
    </div>

    <div v-if="activeCard" class="section-panel">
      <div class="section-header">
        <button class="btn-back" @click="activeCard = null">返回</button>
        <h3>{{ sectionTitle }}</h3>
        <span v-if="currentBatch" class="section-batch-label">当前批次：{{ currentBatch.title }}</span>
      </div>
      <SmartFillF1 v-if="activeCard === 'f1'" />
      <SmartFillF2 v-if="activeCard === 'f2'" @saved="onF1F2Saved" />
      <SmartFillRule v-if="activeCard === 'rule'" :currentBatch="currentBatch" :publishedRules="publishedRules" @refresh="loadPublishedRules" />
      <SmartFillMaterial v-if="activeCard === 'material'" :materials="materials" @create="createMaterial" @upload="uploadFiles" @remove="removeMaterial" @score-recalc="onMaterialConfirmed" />
      <SmartFillScore v-if="activeCard === 'score'" :materials="materials" :evaluation="evaluation" :scoreList="scoreList" @calculate="onCalculate" />
      <SmartFillForm v-if="activeCard === 'form'" :templates="templates" :uploadedTemplate="uploadedTemplate" :scoreList="scoreList" :ruleSetId="publishedRuleSetId" :batchId="currentBatch?.id" @upload="onUploadTemplate" @fill="doFill" @download="downloadFill" @remove-template="removeTemplate" @score-changed="onScoreChanged" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import SmartFillF1 from './SmartFillF1.vue'
import SmartFillF2 from './SmartFillF2.vue'
import SmartFillRule from './SmartFillRule.vue'
import SmartFillMaterial from './SmartFillMaterial.vue'
import SmartFillScore from './SmartFillScore.vue'
import SmartFillForm from './SmartFillForm.vue'
import * as api from '../../api/zongce'

// ========== 批次自动匹配 ==========
const currentBatch = ref(null)
const batchError = ref('')
const batchStatusLabel = computed(() => {
  const s = currentBatch.value?.status
  if (s === 'draft') return '草稿'
  if (s === 'published') return '进行中'
  if (s === 'closed') return '已结束'
  if (s === 'archived') return '已归档'
  return s || ''
})

async function loadStudentBatch() {
  try {
    const r = await api.getStudentBatch()
    if (r.code === 200 && r.data) {
      currentBatch.value = r.data
      batchError.value = ''
    } else {
      batchError.value = r.msg || '未找到匹配的测评批次'
    }
  } catch (e) {
    batchError.value = '获取批次信息失败: ' + (e.message || e)
  }
}

// ========== 导航 ==========
const activeCard = ref(null)
const sectionTitle = computed(() => ({
  rule: '规则管理', material: '材料上传与识别', score: 'F3 评分清单',
  f1: 'F1 基本素质', f2: 'F2 课程成绩', form: '自动填表',
}[activeCard.value] || ''))

function openCard(name) {
  if (!currentBatch.value) { alert(batchError.value || '未找到测评批次，请联系管理员'); return }
  if (name === 'rule') { activeCard.value = 'rule'; loadPublishedRules(); return }
  if (!ruleReady.value) { alert('该批次尚无已发布的规则集，请等待管理员上传'); return }
  if (name === 'f1' || name === 'f2') { if (!ruleReady.value) { alert('请先发布规则集'); return }; activeCard.value = name; return }
  if (name === 'form' && confirmedRecCount.value === 0) { alert('暂无已确认的识别结果'); return }
  activeCard.value = name
  if (name === 'form' && !templatesLoaded.value) refreshTemplates()
}

// ========== 共享状态 ==========
const publishedRules = ref([])
const ruleSets = ref([])  // 保留给其他逻辑（如 smart_fill_data 中的 rule_set_id）
const materials = ref([])
const evaluation = ref(null)
const scoreList = ref(null)
const templates = ref([])
const templatesLoaded = ref(false)
const uploadedTemplate = ref(null)

const publishedRuleSetCount = computed(() => ruleSets.value.filter(r => r.status === 'published').length)
const publishedRuleSetId = computed(() => {
  const pub = ruleSets.value.find(r => r.status === 'published' && (!currentBatch.value?.id || r.batch_id === currentBatch.value?.id))
  return pub ? pub.id : 0
})
// ★ ruleReady 现在基于已发布规则（不再基于 ruleSets）
const ruleReady = computed(() => publishedRules.value.length > 0)
const materialCount = computed(() => materials.value.length)
const confirmedRecCount = computed(() =>
  materials.value.reduce((sum, m) => sum + (m.facts || []).filter(f => f.match?.review_status === 'confirmed').length, 0)
)
const totalScore = computed(() => evaluation.value?.total_score ?? null)

// ========== 刷新 ==========
async function refreshAll() {
  await Promise.all([loadPublishedRules(), loadRuleSets(), refreshMaterials(), refreshEval(), refreshTemplates()])
  await restoreStoreFromPreview()
  if (templates.value.length > 0) {
    const latest = templates.value[0]
    uploadedTemplate.value = { id: latest.id, name: latest.name, size: 0 }
  }
  refreshScoreList()
}

async function loadPublishedRules() {
  if (!currentBatch.value?.id) { publishedRules.value = []; return }
  try {
    const r = await api.getPublishedRules(currentBatch.value.id)
    if (r.code === 200 && r.data) {
      publishedRules.value = r.data.rules || []
      // 同时更新 ruleSets（供其他逻辑使用 publishedRuleSetId）
      if (r.data.rule_set) {
        const existing = ruleSets.value.find(rs => rs.id === r.data.rule_set.id)
        if (!existing) ruleSets.value = [r.data.rule_set]
      }
    }
  } catch (e) { console.error('[SmartFill] loadPublishedRules error:', e.message) }
}

async function loadRuleSets() {
  if (!currentBatch.value?.id) return
  try {
    const r = await api.getRuleSets(currentBatch.value.id)
    if (r.code === 200) ruleSets.value = r.data || []
  } catch (_) {}
}

// ★ 从服务端 fill-preview 数据恢复到 Pinia Store（仅在 Store 为默认值时覆盖）
async function restoreStoreFromPreview() {
  try {
    const r = await api.getFillPreview(currentBatch.value?.id)
    if (r.code !== 200 || !r.data) return
    const d = r.data
    // 恢复 F1
    for (const a of store.f1Items) {
      const score = d['F1_' + a.key + '_score']
      const detail = d['F1_' + a.key + '_detail']
      // 仅当 Store 仍为默认值时才覆盖
      if (a.score === a.base && !a.detail && score !== undefined && score !== null) {
        a.score = score
        a.detail = detail || ''
      }
    }
    // 恢复 F2 课程：仅当 Store 中无有效课程时才恢复
    const hasValidCourses = store.f2Courses.some(c => c.name)
    if (!hasValidCourses && d.F2_courses && d.F2_courses.length > 0 && d.F2_courses.some(c => c.name)) {
      store.f2Courses = JSON.parse(JSON.stringify(d.F2_courses))
    }
  } catch (_) {}
}

async function refreshMaterials() {
  const r = await api.getMaterials()
  if (r.code === 200) materials.value = r.data || []
}
async function refreshEval() {
  const r = await api.getEvaluation()
  if (r.code === 200 && r.data) evaluation.value = r.data
}
async function refreshTemplates() {
  const r = await api.getTemplates()
  if (r.code === 200) {
    templates.value = r.data || []
    templatesLoaded.value = true
  }
}

onMounted(async () => {
  await loadStudentBatch()
  if (currentBatch.value) {
    await refreshAll()
  }
})

async function createMaterial() {
  const res = await api.createMaterial('')
  if (res.code === 200) materials.value.unshift(res.data)
  else alert(res.msg)
}
async function uploadFiles(materialId, files) {
  const fd = new FormData()
  for (const f of files) fd.append('files', f)
  const res = await api.uploadAttachments(materialId, fd)
  if (res.code === 200) { alert(res.msg); refreshMaterials() }
  else alert(res.msg)
}
async function removeMaterial(id) {
  if (!confirm('删除该材料及其所有附件？')) return
  const res = await api.deleteMaterial(id)
  if (res.code === 200) { materials.value = materials.value.filter(m => m.id !== id); refreshEval() }
  else alert(res.msg)
}
async function onMaterialConfirmed() {
  refreshMaterials(); refreshEval(); refreshScoreList()
}
async function onCalculate(ruleSetId) {
  const mids = materials.value.filter(m =>
    (m.facts || []).some(f => f.match?.review_status === 'confirmed')
  ).map(m => m.id)
  const res = await api.calculateScore(ruleSetId, mids, currentBatch.value?.id)
  if (res.code === 200) alert(res.msg)
  else alert(res.msg)
  refreshEval()
  refreshScoreList()
}

async function refreshScoreList() {
  try {
    const publishedRs = ruleSets.value.find(r =>
      r.status === 'published' && (!currentBatch.value?.id || r.batch_id === currentBatch.value?.id)
    )
    if (!publishedRs) return
    const sl = await api.getScoreList(publishedRs.id, currentBatch.value?.id)
    if (sl.code === 200) scoreList.value = sl.data
  } catch (e) { console.error('[SmartFill] refreshScoreList error:', e.message) }
}

async function onUploadTemplate(file) {
  const fd = new FormData(); fd.append('file', file)
  const res = await api.uploadTemplate(fd)
  if (res.code === 200) { alert(res.msg); uploadedTemplate.value = res.data; refreshTemplates() }
  else alert(res.msg)
}
async function doFill(tplId) {
  const res = await api.doFill(tplId, currentBatch.value?.id)
  if (res.code === 200) alert(res.msg)
  else alert(res.msg)
}
function downloadFill(id) {
  api.downloadFill(id).then(blob => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = '综测登记表_已填写.docx'
    document.body.appendChild(a); a.click()
    document.body.removeChild(a); URL.revokeObjectURL(url)
  }).catch(e => {
    if (e.response?.data instanceof Blob) {
      e.response.data.text().then(t => {
        try { const j = JSON.parse(t); alert(j.msg || '下载失败') }
        catch (_) { alert('下载失败，请先执行填表') }
      })
    } else {
      alert('下载失败：' + (e.response?.data?.msg || e.message))
    }
  })
}
async function removeTemplate() {
  if (uploadedTemplate.value?.id) {
    try { await api.deleteTemplate(uploadedTemplate.value.id) } catch (e) { console.warn('deleteTemplate:', e.message) }
  }
  uploadedTemplate.value = null
}
function onScoreChanged() { refreshEval(); refreshScoreList() }
function onF1F2Saved() {
  const items = []
  for (const a of store.f1Items) {
    items.push({ section: 'F1', item_key: a.key, score: a.base - a.score, description: a.detail, rule_set_id: 0 })
  }
  const f2Courses = store.f2Courses.filter(c => c.name)
  if (f2Courses.length) {
    items.push({ section: 'F2', item_key: 'COURSE', score: 0, description: '', extra_data: f2Courses, rule_set_id: 0 })
  }
  if (items.length) api.saveFillData(items, currentBatch.value?.id)
}
import { useSmartFillStore } from '@/stores/smartFill'
const store = useSmartFillStore()
</script>

<style scoped>
.dashboard { display: flex; flex-direction: column; gap: 24px; }
.page-title { font-size: 24px; margin: 0; }
.batch-info-bar {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  padding: 14px 20px;
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
}
.batch-info-bar.batch-loading { color: var(--color-text-tertiary); font-size: 14px; }
.batch-icon { font-size: 18px; }
.batch-title { font-size: 15px; font-weight: 600; color: var(--color-text); }
.batch-meta { font-size: 13px; color: var(--color-text-tertiary); }
.batch-status-tag { font-size: 12px; padding: 2px 10px; border-radius: 12px; font-weight: 500; }
.batch-status-tag.status-draft { background: #fef7e0; color: #E37400; }
.batch-status-tag.status-published { background: #e6f4ea; color: #34A853; }
.batch-status-tag.status-closed { background: #fce8e6; color: #D93025; }
.batch-status-tag.status-archived { background: #f1f3f4; color: #999; }
.batch-error-bar {
  background: #fef7e0; border: 1px solid #f0c040;
  border-radius: var(--radius-card); padding: 14px 20px;
  display: flex; align-items: center; gap: 8px; font-size: 14px; color: #E37400;
}
.batch-error-icon { font-size: 16px; }
.status-bar { display: flex; gap: 16px; }
.status-item {
  flex: 1; text-align: center; padding: 14px;
  background: var(--color-surface); border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}
.status-item.ready { border-color: var(--color-primary); }
.status-num { display: block; font-size: 28px; font-weight: 700; color: var(--color-text-secondary); }
.status-item.ready .status-num { color: var(--color-primary); }
.status-label { font-size: 13px; color: var(--color-text-tertiary); margin-top: 4px; display: block; }
.card-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 768px) { .card-grid { grid-template-columns: 1fr; } }
.func-card {
  background: var(--color-surface); border: 2px solid var(--color-border);
  border-radius: var(--radius-card); padding: 24px; display: flex; gap: 16px;
  cursor: pointer; transition: all 0.2s;
}
.func-card:hover { border-color: var(--color-primary); transform: translateY(-2px); }
.func-card.active { border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(26,115,232,0.1); }
.card-icon { font-size: 32px; flex-shrink: 0; }
.card-content h3 { font-size: 16px; margin: 0 0 6px; }
.card-content p { font-size: 13px; color: var(--color-text-secondary); margin: 0 0 10px; line-height: 1.5; }
.card-status.done { color: #34A853; }
.card-status.ready { color: var(--color-primary); }
.card-status.locked { color: var(--color-text-tertiary); }
.section-panel {
  background: var(--color-surface); border: 1px solid var(--color-border);
  border-radius: var(--radius-card); padding: 24px;
}
.section-header { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
.section-header h3 { font-size: 18px; margin: 0; }
.section-batch-label { font-size: 12px; color: var(--color-text-tertiary); margin-left: auto; }
.btn-back {
  padding: 6px 14px; border: 1px solid var(--color-border); border-radius: var(--radius-btn);
  background: var(--color-bg); cursor: pointer; font-size: 13px; font-family: inherit; color: var(--color-text);
}
</style>

