<template>
  <div class="dashboard">
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
      </div>
      <SmartFillF1 v-if="activeCard === 'f1'" />
      <SmartFillF2 v-if="activeCard === 'f2'" @saved="onF1F2Saved" />
      <SmartFillRule v-if="activeCard === 'rule'" :ruleSources="ruleSources" :ruleSets="ruleSets" @remove-source="removeRuleSource" @refresh="refreshRules" />
      <SmartFillMaterial v-if="activeCard === 'material'" :materials="materials" @create="createMaterial" @upload="uploadFiles" @remove="removeMaterial" @score-recalc="onMaterialConfirmed" />
      <SmartFillScore v-if="activeCard === 'score'" :materials="materials" :evaluation="evaluation" :scoreList="scoreList" @calculate="calculateScore" />
      <SmartFillForm @score-changed="calculateScoreSilent" v-if="activeCard === 'form'" :evaluation="evaluation" :templates="templates" :fillResults="fillResults" :ruleSetId="publishedRuleSetId" :uploadedTemplate="uploadedTemplate" :scoreList="scoreList" :materials="materials" @upload-template="onUploadTemplate" @fill="doFill" @download="downloadFill" @update:uploadedTemplate="uploadedTemplate = $event" />
    </div>
  </div>
</template>
<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import SmartFillRule from './SmartFillRule.vue'
import SmartFillF1 from './SmartFillF1.vue'
import SmartFillF2 from './SmartFillF2.vue'
import SmartFillMaterial from './SmartFillMaterial.vue'
import SmartFillScore from './SmartFillScore.vue'
import SmartFillForm from './SmartFillForm.vue'
import * as api from '../../api/zongce'

const activeCard = ref(null)
const sectionTitle = computed(() => ({
  rule: '规则管理', material: '材料上传与识别', score: 'F3 评分清单', f1: 'F1 基本素质', f2: 'F2 课程成绩', form: '自动填表',
}[activeCard.value] || ''))

function openCard(name) {
  if (name === 'rule') { activeCard.value = 'rule'; return }
  if (!ruleReady.value) { alert('请先发布规则集后再操作'); return }
  if (name === 'f1' || name === 'f2') { if (!ruleReady.value) { alert('请先发布规则集'); return }; activeCard.value = name; return }
  if (name === 'form' && confirmedRecCount.value === 0) { alert('暂无已确认的识别结果，请先在材料识别中完成 AI 识别并逐条确认后再使用自动填表'); return }
  activeCard.value = name
}

// ========== 共享状态 ==========
const ruleSources = ref([])
const ruleSets = ref([])
const materials = ref([])
const evaluation = ref(null)
const scoreList = ref(null)
const templates = ref([])
const fillResults = ref([]); const uploadedTemplate = ref(null)

const publishedRuleSetCount = computed(() => ruleSets.value.filter(r => r.status === 'published').length)
const ruleReady = computed(() => publishedRuleSetCount.value > 0)
const materialCount = computed(() => materials.value.length)
const confirmedRecCount = computed(() =>
  materials.value.reduce((sum, m) => sum + (m.facts || []).filter(f => f.match?.review_status === 'confirmed').length, 0)
)
const totalScore = computed(() => evaluation.value?.total_score ?? null)

// ========== 刷新 ==========
async function refreshRules() {
  const [s, rs] = await Promise.all([api.getRuleSources(), api.getRuleSets()]);
  if (s.code === 200) ruleSources.value = s.data || [];
  if (rs.code === 200) ruleSets.value = rs.data || [];
}
async function refreshMaterials() {
  const r = await api.getMaterials();
  if (r.code === 200) materials.value = r.data || [];
}
async function refreshEval() {
  const r = await api.getEvaluation();
  if (r.code === 200 && r.data) evaluation.value = r.data;
}
async function refreshTemplates() {
  const r = await api.getTemplates();
  if (r.code === 200) templates.value = r.data || [];
}
onMounted(async () => {
  await Promise.all([refreshRules(), refreshMaterials(), refreshEval(), refreshTemplates()]); if (templates.value.length > 0) { const latest = templates.value[0]; uploadedTemplate.value = { id: latest.id, name: latest.name, size: 0 }; }
  refreshScoreList();
});

// ========== 规则 ==========
async function removeRuleSource(id) {
  if (!confirm('删除该规则来源？')) return
  const res = await api.deleteRuleSource(id)
  if (res.code === 200) refreshRules()
  else alert(res.msg)
}

// ========== 材料 ==========
async function createMaterial() {
  const res = await api.createMaterial('')
  if (res.code === 200) materials.value.unshift(res.data)
  else alert(res.msg)
}
async function uploadFiles(matId, files) {
  const fd = new FormData()
  for (const f of files) fd.append('files', f)
  const res = await api.uploadAttachments(matId, fd)
  if (res.code === 200) refreshMaterials()
  else alert(res.msg)
}
async function removeMaterial(id) {
  if (!confirm('确定删除该材料及其附件？')) return
  const res = await api.deleteMaterial(id)
  if (res.code === 200) refreshMaterials()
}

const publishedRuleSetId = computed(() => {
  const pub = ruleSets.value.find(r => r.status === 'published')
  return pub ? pub.id : null
})

// ========== 评分 ==========

// ★ 材料确认后同时刷新评分和填表预览

function onF1F2Saved() {
  refreshScoreList()
  refreshEval()
  // ★ 如果自动填表当前展开，强制重载以同步 F2 课程数据
  if (activeCard.value === 'form') {
    const wasForm = activeCard.value
    activeCard.value = null
    nextTick(() => { activeCard.value = wasForm })
  }
}
async function onMaterialConfirmed() {
    await calculateScoreSilent()   // ★ 触发后端重算，内部会刷新 scoreList
  // 如果填表表单已展开，触发重新加载
  if (activeCard.value === 'form') {
    const wasForm = activeCard.value
    activeCard.value = null
    await nextTick()
    activeCard.value = wasForm
  }
}

async function calculateScore() {
  const rsId = publishedRuleSetId.value
  if (!rsId) { alert('请先发布规则集'); return }
  const res = await api.calculateScoreV2(rsId, materials.value.map(m => m.id))
  if (res.code === 200) {
    alert(res.msg)
    refreshEval()
    // ★ 同时拉取评分清单
    const sl = await api.getScoreList(rsId)
    if (sl.code === 200) scoreList.value = sl.data
  } else { alert(res.msg) }
}

async function calculateScoreSilent() {
  const rsId = publishedRuleSetId.value
  if (!rsId) return
  try {
    const res = await api.calculateScoreV2(rsId, materials.value.map(m => m.id))
    if (res.code === 200) {
      refreshEval(); 
      const sl = await api.getScoreList(rsId); 
      if (sl.code === 200) {
        scoreList.value = sl.data;
      } 
    }
  } catch (_) { /* 静默失败 */ }
}

async function refreshScoreList() {
  const rsId = publishedRuleSetId.value
  if (!rsId) { console.warn('[SmartFill] refreshScoreList: 无已发布规则集，跳过'); return }
  console.log('[SmartFill] refreshScoreList: ruleSetId=', rsId)
  try {
    const sl = await api.getScoreList(rsId)
    console.log('[SmartFill] getScoreList 返回 code=', sl.code, 'fact_count=', sl.data?.fact_count, 'indicators=', sl.data?.indicators?.length)
    if (sl.code === 200) scoreList.value = sl.data
  } catch (e) { console.error('[SmartFill] refreshScoreList 失败:', e.message) }
}

// ========== 填表 ==========
async function onUploadTemplate(file) {
  const fd = new FormData(); fd.append('file', file)
  const res = await api.uploadTemplate(fd)
  if (res.code === 200) { alert(res.msg); uploadedTemplate.value = res.data; refreshTemplates() }
  else alert(res.msg)
}
async function doFill(tplId) {
  const res = await api.doFill(tplId)
  if (res.code === 200) alert(res.msg)
  else alert(res.msg)
}
function downloadFill(id) {
  // 通过 blob 下载文件
  api.downloadFill(id).then(blob => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    // 从响应头中提取文件名，或使用默认名
    a.download = '综测登记表_已填写.docx'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }).catch(e => {
    // blob 响应的错误需要特殊处理
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
</script>

<style scoped>
.dashboard { display: flex; flex-direction: column; gap: 24px; }
.page-title { font-size: 24px; margin: 0; }

.status-bar { display: flex; gap: 16px; }
.status-item {
  flex: 1; text-align: center; padding: 14px;
  background: var(--color-surface); border-radius: var(--radius-md); border: 1px solid var(--color-border);
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
.func-card:hover:not(.locked) { border-color: var(--color-primary); transform: translateY(-2px); }
.func-card.active { border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(26,115,232,0.1); }
.func-card.locked { opacity: 0.5; cursor: not-allowed; }
.card-icon { font-size: 32px; flex-shrink: 0; }
.card-content h3 { font-size: 16px; margin: 0 0 6px; }
.card-content p { font-size: 13px; color: var(--color-text-secondary); margin: 0 0 10px; line-height: 1.5; }
.card-status { font-size: 13px; }
.card-status.done { color: #34A853; }
.card-status.ready { color: var(--color-primary); }
.card-status.locked { color: var(--color-text-tertiary); }

.section-panel {
  background: var(--color-surface); border: 1px solid var(--color-border);
  border-radius: var(--radius-card); padding: 24px;
}
.section-header { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
.section-header h3 { font-size: 18px; margin: 0; }
.btn-back {
  padding: 6px 14px; border: 1px solid var(--color-border); border-radius: var(--radius-btn);
  background: var(--color-bg); cursor: pointer; font-size: 13px; font-family: inherit; color: var(--color-text);
}
</style>
