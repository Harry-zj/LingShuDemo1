<template>
  <div class="dashboard">
    <!-- ★ 批次选择器 -->
    <div v-if="batches.length > 0" class="batch-info-bar">
      <span class="batch-icon">📋</span>
      <select v-model="selectedBatchId" class="batch-select" @change="onBatchChange">
        <option v-for="b in sortedBatches" :key="b.id" :value="b.id">
          {{ b.title }} ({{ b.school_year }}) {{ b.status === 'closed' ? '[已结束]' : b.status === 'archived' ? '[已归档]' : b.status === 'draft' ? '[草稿]' : '' }}
        </option>
      </select>
      <span v-if="currentBatch" class="batch-status-tag" :class="'status-' + currentBatch.status">{{ batchStatusLabel }}</span>
    </div>
    <div v-else-if="batchError" class="batch-error-bar">
      <span class="batch-error-icon">⚠</span>
      <span>{{ batchError }}</span>
    </div>
    <div v-else class="batch-info-bar batch-loading">
      <span>加载批次信息...</span>
    </div>

    <!-- ★ 已结束批次提示横幅 -->
    <div v-if="currentBatch && currentBatch.status !== 'published' && currentBatch.status !== 'draft'" class="closed-batch-banner">
      <span>📦</span>
      <span>此批次已{{ currentBatch.status === 'closed' ? '结束' : '归档' }}，仅可查看历史填写信息，不可编辑</span>
    </div>

    <!-- 标题 + 总分 -->
    <div class="page-top">
      <div>
        <h2 class="page-title">智能填表</h2>
        <p class="page-sub">完成 6 个步骤，生成综测登记表</p>
      </div>
      <div class="total-chip" v-if="totalScore !== null">
        <span class="total-num">{{ totalScore }}</span>
        <span class="total-label">总分</span>
      </div>
    </div>

    <!-- 水平步进条 -->
    <div class="stepper">
      <div v-for="(step, idx) in steps" :key="step.key"
        class="step-item"
        :class="{ done: step.ready, active: activeCard === step.key, locked: step.locked && !step.ready }"
        @click="!step.locked && openCard(step.key)">
        <div class="step-indicator">
          <span v-if="step.ready" class="step-check">✓</span>
          <span v-else class="step-num">{{ idx + 1 }}</span>
        </div>
        <div class="step-text">
          <div class="step-title">{{ step.title }}</div>
          <div class="step-hint">
            <template v-if="step.ready">{{ step.doneLabel }}</template>
            <template v-else-if="step.locked && !step.ready">🔒</template>
            <template v-else>{{ step.pendingLabel }}</template>
          </div>
        </div>
        <div v-if="idx < steps.length - 1" class="step-connector" :class="{ done: step.ready }"></div>
      </div>
    </div>

    <div v-if="activeCard" class="section-panel">
      <div class="section-header">
        <button class="btn-back" @click="activeCard = null">返回</button>
        <h3>{{ sectionTitle }}</h3>
        <span v-if="currentBatch" class="section-batch-label">当前批次：{{ currentBatch.title }}</span>
      </div>
      <!-- ★ 审核锁定提示 -->
      <div v-if="!formCanEdit" class="readonly-banner">
        <span>🔒</span>
        <span>{{ formReadonlyReason || '当前不可编辑' }}</span>
        <span class="hint">如需更改请联系评审人员驳回</span>
      </div>
      <Transition name="step" mode="out-in">
        <SmartFillF1 v-if="activeCard === 'f1'" key="f1" :score-policy="scorePolicy" :rule-set-id="publishedRuleSetId" :batch-id="currentBatch?.id" :readonly="!formCanEdit" :readonly-reason="formReadonlyReason" @complete="onF1Complete" />
        <SmartFillF2 v-else-if="activeCard === 'f2'" key="f2" :score-policy="scorePolicy" :rule-set-id="publishedRuleSetId" :batch-id="currentBatch?.id" :readonly="!formCanEdit" :readonly-reason="formReadonlyReason" @saved="onF1F2Saved" @complete="onF2Complete" />
        <SmartFillRule v-else-if="activeCard === 'rule'" key="rule" :currentBatch="currentBatch" :publishedRules="publishedRules" @refresh="loadPublishedRules" />
        <SmartFillMaterial v-else-if="activeCard === 'material'" key="material" :materials="materials" :readonly="!formCanEdit" :readonly-reason="formReadonlyReason" @create="createMaterial" @upload="uploadFiles" @remove="removeMaterial" @score-recalc="onMaterialConfirmed" />
        <SmartFillScore v-else-if="activeCard === 'score'" key="score" :materials="materials" :evaluation="evaluation" :scoreList="scoreList" :score-policy="scorePolicy" :readonly="!formCanEdit" @calculate="onCalculate" />
        <SmartFillForm v-else-if="activeCard === 'form'" key="form" :templates="templates" :uploadedTemplate="uploadedTemplate" :scoreList="scoreList" :ruleSetId="publishedRuleSetId" :batchId="currentBatch?.id" :score-policy="scorePolicy" :readonly="!formCanEdit" :readonly-reason="formReadonlyReason" @upload="onUploadTemplate" @fill="doFill" @download="downloadFill" @remove-template="removeTemplate" @score-changed="onScoreChanged" @submit="onFormSubmitted" />
      </Transition>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import SmartFillF1 from './SmartFillF1.vue'
import SmartFillF2 from './SmartFillF2.vue'
import SmartFillRule from './SmartFillRule.vue'
import SmartFillMaterial from './SmartFillMaterial.vue'
import SmartFillScore from './SmartFillScore.vue'
import SmartFillForm from './SmartFillForm.vue'
import * as api from '../../api/zongce'
import { getScorePolicy, getStudentForm } from '../../api/module3'
import { DEFAULT_GRADE_RULES, DEFAULT_SCORE_LIMITS } from '../../utils/scorePolicy'

const scorePolicy = ref({ scoreLimits: { ...DEFAULT_SCORE_LIMITS }, gradeRules: [...DEFAULT_GRADE_RULES] })

// ========== 批次选择 ==========
const batches = ref([])
const selectedBatchId = ref(null)
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
// 排序后的批次列表（进行中 > 草稿 > 已结束 > 已归档，同状态下按学年降序）
const sortedBatches = computed(() => {
  const rank = { published: 0, draft: 1, closed: 2, archived: 3 }
  return [...batches.value].sort((a, b) => {
    const ra = rank[a.status] ?? 4
    const rb = rank[b.status] ?? 4
    if (ra !== rb) return ra - rb
    return (b.school_year || '').localeCompare(a.school_year || '')
  })
})

async function loadBatches() {
  try {
    const r = await api.getBatches()
    if (r.code === 200 && r.data?.length) {
      batches.value = r.data
      // 默认选中最新批次（优先进行中的，按学年降序）
      const preferred = sortedBatches.value[0]
      selectedBatchId.value = preferred.id
      setCurrentBatch(preferred)
      batchError.value = ''
    } else {
      batchError.value = '未找到匹配的测评批次'
    }
  } catch (e) {
    batchError.value = '获取批次信息失败: ' + (e.message || e)
  }
}

function setCurrentBatch(batch) {
  currentBatch.value = batch
}

// ★ 批次切换处理
async function onBatchChange() {
  const batch = batches.value.find(b => b.id === selectedBatchId.value)
  if (!batch) return
  setCurrentBatch(batch)
  // 清空本地状态
  materials.value = []
  evaluation.value = null
  scoreList.value = null
  templates.value = []
  templatesLoaded.value = false
  uploadedTemplate.value = null
  publishedRules.value = []
  ruleSets.value = []
  f1Done.value = false
  f2Done.value = false
  formDone.value = false
  // 重置 Pinia store
  resetStoreForBatch()
  // 关闭当前卡片回到 stepper 视图
  activeCard.value = null
  // 重新加载所有数据
  await refreshAll()
  await loadFormStatus()
}

// ========== 表单审核状态 ==========
const formStatus = ref(null)
const formReadonlyReason = ref('')
const formCanEdit = ref(true)  // 默认无表单=可编辑，但在 loadFormStatus 中会根据批次状态修正

async function loadFormStatus() {
  if (!currentBatch.value?.id) return
  // ★ 批次已关闭/归档 → 强制只读，不允许编辑
  if (currentBatch.value.status !== 'published') {
    formStatus.value = null
    formReadonlyReason.value = '该批次已结束，仅可查看历史填写信息'
    formCanEdit.value = false
    return
  }
  try {
    const res = await getStudentForm(currentBatch.value.id)
    if (res.code === 200 && res.data) {
      formStatus.value = res.data.status
      formReadonlyReason.value = res.data.readonly_reason || ''
      formCanEdit.value = !!res.data.can_student_edit
    } else {
      // 批次已发布但无表单 → 允许编辑（首次填写）
      formStatus.value = null
      formReadonlyReason.value = ''
      formCanEdit.value = true
    }
  } catch (_) {
    // 请求失败时保守处理：检查批次状态
    formStatus.value = null
    formReadonlyReason.value = currentBatch.value?.status === 'published' ? '' : '该批次已结束，仅可查看历史填写信息'
    formCanEdit.value = currentBatch.value?.status === 'published'
  }
}

function onFormSubmitted() {
  formDone.value = true
  loadFormStatus()
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

// ★ 步骤④⑤完成状态
const f1Done = ref(false)
const f2Done = ref(false)
const formDone = ref(false)
function onF1Complete() { f1Done.value = true; activeCard.value = 'f2' }
function onF2Complete() { f2Done.value = true; activeCard.value = 'form' }

// ★ 步进条步骤配置
const steps = computed(() => [
  { key: 'rule', title: '规则管理', desc: '查看当前批次的计分规则明细', ready: ruleReady.value, doneLabel: '已发布', pendingLabel: '查看规则', locked: false, lockedLabel: '' },
  { key: 'material', title: '材料上传与识别', desc: '上传证书证明，AI 自动识别并匹配加分', ready: materialCount.value > 0, doneLabel: materialCount.value + ' 份材料', pendingLabel: '上传材料', locked: !ruleReady.value, lockedLabel: '请先发布规则集' },
  { key: 'score', title: 'F3 评分清单', desc: '查看 B1-B8 加分汇总明细', ready: confirmedRecCount.value > 0, doneLabel: confirmedRecCount.value + ' 条确认', pendingLabel: '查看清单', locked: !ruleReady.value, lockedLabel: '请先确认识别结果' },
  { key: 'f1', title: 'F1 基本素质', desc: '思想政治、道德品质等评分', ready: f1Done.value, doneLabel: '已填写', pendingLabel: '填写评分', locked: !ruleReady.value, lockedLabel: '请先发布规则集' },
  { key: 'f2', title: 'F2 课程成绩', desc: '录入学期课程学分和考试成绩', ready: f2Done.value, doneLabel: '已录入', pendingLabel: '录入成绩', locked: !ruleReady.value, lockedLabel: '请先发布规则集' },
  { key: 'form', title: '自动填表', desc: '上传 Word 模板，一键填充并下载', ready: formDone.value, doneLabel: '已提交', pendingLabel: '开始填表', locked: confirmedRecCount.value === 0, lockedLabel: '暂无已确认的识别结果' },
])

// ========== 刷新 ==========
async function refreshAll() {
  await Promise.all([loadPublishedRules(), loadRuleSets(), refreshMaterials(), refreshEval(), refreshTemplates()])
  await restoreStoreFromPreview()
  f1Done.value = store.f1Items.some(a => a.score !== a.base || a.detail)
  f2Done.value = store.f2Courses.some(c => c.name && c.score > 0)
  if (evaluation.value?.total_score != null) formDone.value = true
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
  const r = await api.getMaterials(currentBatch.value?.id)
  if (r.code === 200) materials.value = r.data || []
}
async function refreshEval() {
  const r = await api.getEvaluation(currentBatch.value?.id)
  if (r.code === 200 && r.data) evaluation.value = r.data
}
async function refreshTemplates() {
  const r = await api.getTemplates()
  if (r.code === 200) {
    templates.value = r.data || []
    templatesLoaded.value = true
  }
}

// ★ 返回 stepper 时刷新表单状态
watch(activeCard, (newVal) => {
  if (newVal === null) loadFormStatus()
})

// ★ 批次切换时重置 Pinia store
function resetStoreForBatch() {
  store.resetToDefaults()
}

onMounted(async () => {
  try {
    const policyRes = await getScorePolicy()
    if (policyRes.code === 200 && policyRes.data) scorePolicy.value = policyRes.data
  } catch (_) {}
  await loadBatches()
  if (currentBatch.value) {
    await refreshAll()
    await loadFormStatus()
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
  if (res.code === 200) { materials.value = materials.value.filter(m => m.id !== id); refreshEval(); refreshScoreList() }
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
    items.push({ section: 'F1', item_key: a.key, score: a.base - a.score, description: a.detail, rule_set_id: publishedRuleSetId.value || 0 })
  }
  const f2Courses = store.f2Courses.filter(c => c.name)
  if (f2Courses.length) {
    items.push({ section: 'F2', item_key: 'COURSE', score: 0, description: '', extra_data: f2Courses, rule_set_id: publishedRuleSetId.value || 0 })
  }
  if (items.length) api.saveFillData(items, currentBatch.value?.id)
}
import { useSmartFillStore } from '@/stores/smartFill'
const store = useSmartFillStore()
</script>

<style scoped>
/* ===== 共享配色变量（暖沙 + 鼠尾草绿） ===== */
.dashboard {
  --sf-sage: #7d9b76;
  --sf-sage-soft: rgba(125,155,118,0.12);
  --sf-sage-glow: rgba(125,155,118,0.18);
  --sf-sand: #c4a882;
  --sf-sand-soft: rgba(196,168,130,0.12);
  --sf-sand-glow: rgba(196,168,130,0.18);
  --sf-card-bg: rgba(255,255,255,0.48);
  --sf-card-shadow: 0 1px 12px rgba(0,0,0,0.04);
  --sf-radius: 16px;
  --sf-gap: 28px;
  display: flex; flex-direction: column; gap: 24px;
  max-width: 100%; margin: 0 auto; padding: 4px 0 32px;
}
@media (prefers-color-scheme: dark) {
  .dashboard {
    --sf-card-bg: rgba(255,255,255,0.03);
    --sf-card-shadow: 0 1px 12px rgba(0,0,0,0.18);
  }
}

/* ===== 批次信息条 ===== */
.batch-info-bar {
  background: var(--sf-card-bg); border-radius: 12px; padding: 8px 16px;
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 12px;
  backdrop-filter: blur(10px); box-shadow: var(--sf-card-shadow);
}
.batch-info-bar.batch-loading { color: var(--color-text-tertiary); }
.batch-icon { font-size: 15px; opacity: 0.7; }
.batch-select {
  flex: 1; min-width: 180px; padding: 6px 12px; border: 1.5px solid rgba(196,168,130,0.25);
  border-radius: 8px; font-size: 13px; font-weight: 600; font-family: inherit;
  background: rgba(255,255,255,0.04); color: var(--color-text);
  cursor: pointer; outline: none; transition: border-color 0.2s;
}
.batch-select:focus { border-color: var(--sf-sand); }
.batch-title { font-weight: 600; color: var(--color-text); }
.batch-meta { color: var(--color-text-tertiary); }
.batch-status-tag { font-size: 11px; padding: 2px 10px; border-radius: 10px; font-weight: 500; white-space: nowrap; }
.batch-status-tag.status-draft { background: rgba(244,184,71,0.15); color: #c4952a; }
.batch-status-tag.status-published { background: rgba(125,155,118,0.18); color: #5a8a54; }
.batch-status-tag.status-closed { background: rgba(220,80,80,0.12); color: #c44; }
.batch-status-tag.status-archived { background: rgba(150,150,150,0.10); color: #888; }
.batch-error-bar {
  background: rgba(244,184,71,0.10); border-radius: 12px; padding: 10px 16px;
  display: flex; align-items: center; gap: 8px; font-size: 13px; color: #c4952a;
}

/* ===== 已结束批次横幅 ===== */
.closed-batch-banner {
  display: flex; align-items: center; gap: 10px; padding: 12px 16px;
  background: rgba(150,150,150,0.10); border: 1px solid rgba(150,150,150,0.20);
  border-radius: 10px; font-size: 13px; color: #888;
}

/* ===== 页头 ===== */
.page-top { display: flex; align-items: center; justify-content: space-between; }
.page-title { font-size: 24px; font-weight: 700; margin: 0; letter-spacing: -0.02em; }
.page-sub { font-size: 13px; color: var(--color-text-tertiary); margin: 2px 0 0; }
.total-chip {
  display: flex; align-items: center; gap: 8px; padding: 10px 20px;
  border-radius: 16px; background: var(--sf-sage-soft); box-shadow: var(--sf-card-shadow);
}
.total-num { font-size: 26px; font-weight: 700; color: var(--sf-sage); }
.total-label { font-size: 12px; color: var(--sf-sage); opacity: 0.7; }

/* ===== 水平步进条 ===== */
.stepper {
  display: flex; align-items: flex-start; gap: 0;
  padding: 20px 16px; border-radius: 18px;
  background: var(--sf-card-bg); box-shadow: var(--sf-card-shadow);
  backdrop-filter: blur(10px); overflow-x: auto;
}
.step-item {
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  flex: 1; min-width: 0; position: relative; cursor: pointer;
  padding: 4px 6px; border-radius: 12px; transition: background 0.2s;
}
.step-item:not(.locked):hover { background: var(--sf-sand-soft); }
.step-item.locked { cursor: not-allowed; opacity: 0.45; }

.step-indicator {
  width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center;
  justify-content: center; font-size: 13px; font-weight: 600; flex-shrink: 0;
  background: var(--color-surface); border: 2px solid #d5d1ca;
  color: var(--color-text-tertiary); transition: all 0.3s;
}
.step-item.done .step-indicator {
  background: var(--sf-sage); border-color: var(--sf-sage); color: #fff;
}
.step-item.active .step-indicator {
  border-color: var(--sf-sand); border-width: 3px; color: var(--sf-sand);
  box-shadow: 0 0 0 6px rgba(196,168,130,0.12);
}
.step-check { font-size: 11px; }
.step-num { font-size: 14px; }

.step-text { text-align: center; min-width: 0; }
.step-title { font-size: 13px; font-weight: 600; color: var(--color-text); white-space: nowrap; }
.step-item.active .step-title { color: var(--sf-sand); }
.step-item.done .step-title { color: var(--sf-sage); }
.step-hint { font-size: 11px; color: var(--color-text-tertiary); margin-top: 2px; white-space: nowrap; }

.step-connector {
  position: absolute; top: 22px; left: calc(50% + 18px);
  width: calc(100% - 36px); height: 2px; background: #e0ddd6;
}
.step-connector.done { background: var(--sf-sage); }

@media (max-width: 768px) {
  .stepper { flex-wrap: wrap; gap: 8px; justify-content: center; }
  .step-item { flex: 0 0 auto; min-width: 80px; }
  .step-connector { display: none; }
}

/* ===== 步骤切换动效 ===== */
.step-enter-active {
  transition: opacity 0.35s ease, transform 0.4s cubic-bezier(0.22,1,0.36,1);
}
.step-leave-active {
  transition: opacity 0.2s ease, transform 0.25s ease;
}
.step-enter-from {
  opacity: 0;
  transform: translateY(24px) scale(0.98);
}
.step-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}

/* ===== 审核锁定提示 ===== */
.readonly-banner {
  display: flex; align-items: center; gap: 10px; padding: 12px 16px; margin-bottom: 20px;
  background: rgba(245,158,11,0.12); border: 1px solid rgba(245,158,11,0.25);
  border-radius: 10px; font-size: 13px; color: #d97706;
}
.readonly-banner .hint { color: var(--color-text-tertiary); font-size: 12px; margin-left: auto; }

/* ===== 子面板 ===== */
.section-panel {
  background: var(--sf-card-bg); border-radius: 18px; padding: 28px;
  box-shadow: var(--sf-card-shadow); backdrop-filter: blur(10px);
}
.section-header { display: flex; align-items: center; gap: 14px; margin-bottom: 22px; }
.section-header h3 { font-size: 18px; margin: 0; font-weight: 700; }
.section-batch-label {
  font-size: 12px; color: var(--color-text-tertiary); margin-left: auto;
  background: var(--sf-sand-soft); padding: 3px 12px; border-radius: 10px;
}
.btn-back {
  padding: 5px 14px; border: none; border-radius: 10px;
  background: var(--sf-sand-soft); cursor: pointer; font-size: 13px;
  font-family: inherit; color: var(--sf-sand); font-weight: 500;
  transition: all 0.2s;
}
.btn-back:hover { background: rgba(196,168,130,0.22); }
</style>

