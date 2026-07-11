<template>
  <div class="dashboard">
    <h2 class="page-title">智能填表</h2>

    <!-- 状态概览条 -->
    <div class="status-bar">
      <div class="status-item" :class="{ ready: ruleReady }">
        <span class="status-num">{{ confirmedRuleCount }}</span>
        <span class="status-label">已确认规则</span>
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

    <!-- 四个功能卡片 -->
    <div class="card-grid">
      <div class="func-card" :class="{ active: activeCard === 'rule' }" @click="openCard('rule')">
        <div class="card-icon">①</div>
        <div class="card-content">
          <h3>规则管理</h3>
          <p>上传规则文件或输入文字，AI 自动解析为结构化规则</p>
          <span class="card-status done">✅ {{ confirmedRuleCount }} 条已确认</span>
        </div>
      </div>

      <div class="func-card" :class="{ active: activeCard === 'material' }" @click="openCard('material')">
        <div class="card-icon">②</div>
        <div class="card-content">
          <h3>材料上传与识别</h3>
          <p>上传证明材料，AI 自动识别归类并给出加分建议</p>
          <span class="card-status" :class="ruleReady ? 'ready' : 'locked'">
            {{ ruleReady ? `📋 ${materialCount} 份材料` : '🔒 请先确认至少一条规则' }}
          </span>
        </div>
      </div>

      <div class="func-card" :class="{ active: activeCard === 'score' }" @click="openCard('score')">
        <div class="card-icon">③</div>
        <div class="card-content">
          <h3>评分清单</h3>
          <p>查看所有加分项明细，按维度汇总</p>
          <span class="card-status" :class="ruleReady ? 'ready' : 'locked'">
            {{ ruleReady ? (totalScore !== null ? `📊 总分 ${totalScore}` : '待计算') : '🔒 请先确认至少一条规则' }}
          </span>
        </div>
      </div>

      <div class="func-card" :class="{ active: activeCard === 'form' }" @click="openCard('form')">
        <div class="card-icon">④</div>
        <div class="card-content">
          <h3>自动填表</h3>
          <p>上传 Word 模板，一键自动填充并下载</p>
          <span class="card-status" :class="totalScore !== null ? 'ready' : 'locked'">
            📝 自动填表
          </span>
        </div>
      </div>
    </div>

    <!-- 展开的功能区 -->
    <div v-if="activeCard" class="section-panel">
      <div class="section-header">
        <button class="btn-back" @click="activeCard = null">← 返回</button>
        <h3>{{ sectionTitle }}</h3>
      </div>

      <SmartFillRule
        v-if="activeCard === 'rule'"
        :ruleSources="ruleSources"
        :ruleItems="ruleItems"
        @remove-source="removeRuleSource"
        @toggle-item="toggleRuleItem"
        @remove-item="removeRuleItem"
        @refresh="refreshRules"
      />

      <SmartFillMaterial
        v-if="activeCard === 'material'"
        :materials="materials"
        :ruleItems="ruleItems"
        @create="createMaterial"
        @upload="uploadFiles"
        @analyze="analyzeMaterial"
        @confirm="confirmRecognition"
        @dismiss="dismissRecognition"
        @remove="removeMaterial"
      />

      <SmartFillScore
        v-if="activeCard === 'score'"
        :materials="materials"
        :ruleItems="ruleItems"
        :evaluation="evaluation"
        @calculate="calculateScore"
      />

      <SmartFillForm
        v-if="activeCard === 'form'"
        :evaluation="evaluation"
        :templates="templates"
        :fillResults="fillResults"
        @upload-template="uploadTemplate"
        @fill="doFill"
        @download="downloadFill"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, defineAsyncComponent } from 'vue'

const SmartFillRule = defineAsyncComponent(() => import('./SmartFillRule.vue'))
const SmartFillMaterial = defineAsyncComponent(() => import('./SmartFillMaterial.vue'))
const SmartFillScore = defineAsyncComponent(() => import('./SmartFillScore.vue'))
const SmartFillForm = defineAsyncComponent(() => import('./SmartFillForm.vue'))
import * as api from '../../api/zongce'

const activeCard = ref(null)
const sectionTitle = computed(() => ({
  rule: '规则管理', material: '材料上传与识别', score: '评分清单', form: '自动填表',
}[activeCard.value] || ''))

function openCard(name) {
  if (name === 'rule') {
    activeCard.value = 'rule'
    return
  }
  if (!ruleReady.value) return
  if (name === 'form' && totalScore.value === null) return
  activeCard.value = name
  if (name === 'form' && !templatesLoaded.value) refreshTemplates()
}

// ========== 共享状态 ==========
const ruleSources = ref([])
const ruleItems = ref([])
const materials = ref([])
const evaluation = ref(null)
const templates = ref([])
const fillResults = ref([])
const templatesLoaded = ref(false)

const confirmedRuleCount = computed(() => ruleItems.value.filter(r => r.status === 'confirmed').length)
const ruleReady = computed(() => confirmedRuleCount.value > 0)
const materialCount = computed(() => materials.value.length)
const confirmedRecCount = computed(() =>
  materials.value.filter(m => m.recognition?.confirm_status === 'confirmed').length
)
const totalScore = computed(() => evaluation.value?.total_score ?? null)

// ========== 按需刷新（只拉变了的） ==========
async function refreshRules() {
  const [s, i] = await Promise.all([api.getRuleSources(), api.getRuleItems()]);
  if (s.code === 200) ruleSources.value = s.data || [];
  if (i.code === 200) ruleItems.value = i.data || [];
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
  if (r.code === 200) {
    templates.value = r.data || [];
    templatesLoaded.value = true;
  }
}
onMounted(async () => {
  await Promise.all([refreshRules(), refreshMaterials(), refreshEval()]);
});

// ========== 规则 ==========
async function removeRuleSource(id) {
  if (!confirm('删除规则来源将同时删除其所有规则项，确定？')) return
  const res = await api.deleteRuleSource(id)
  if (res.code === 200) refreshRules()
  else alert(res.msg)
}
async function toggleRuleItem(item) {
  const prev = item.status
  // 乐观更新：先切状态，失败再回滚
  item.status = item.status === 'confirmed' ? 'pending_confirm' : 'confirmed'
  try {
    const res = await api.toggleRuleItem(item.id)
    if (res.code === 200) {
      item.status = res.data.status  // 以后端返回为准
    } else {
      item.status = prev
      alert(res.msg)
    }
  } catch (e) {
    item.status = prev
    alert('操作失败: ' + (e.response?.data?.msg || e.message))
  }
}
async function removeRuleItem(id) {
  const res = await api.deleteRuleItem(id)
  if (res.code === 200) refreshRules()
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
async function analyzeMaterial(matId) {
  const res = await api.analyzeMaterial(matId)
  if (res.code === 200) { alert(res.msg); refreshMaterials() }
  else alert(res.msg)
}
async function confirmRecognition(recId) {
  const res = await api.confirmRecognition(recId)
  if (res.code === 200) refreshMaterials()
}
async function dismissRecognition(recId) {
  const res = await api.dismissRecognition(recId)
  if (res.code === 200) refreshMaterials()
}
async function removeMaterial(id) {
  if (!confirm('确定删除该材料及其附件？')) return
  const res = await api.deleteMaterial(id)
  if (res.code === 200) refreshMaterials()
}

// ========== 评分 ==========
async function calculateScore() {
  const res = await api.calculateScore()
  if (res.code === 200) { alert(res.msg); refreshEval() }
  else alert(res.msg)
}

// ========== 填表 ==========
async function uploadTemplate(file) {
  const fd = new FormData(); fd.append('file', file)
  const res = await api.uploadTemplate(fd)
  if (res.code === 200) { alert(res.msg); refreshTemplates() }
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
