<template>
  <div class="admin-rule-page">
    <div class="page-header">
      <h2>批次规则管理</h2>
      <p>选择批次后上传规则文件，AI 解析后发布供学生使用</p>
    </div>

    <!-- 批次选择器 -->
    <div class="batch-select-bar">
      <label>选择测评批次</label>
      <select v-model="selectedBatchId" @change="onBatchChange" class="batch-select">
        <option value="">-- 请选择批次 --</option>
        <option v-for="b in batches" :key="b.id" :value="b.id">{{ b.title }} ({{ b.school_year }} · {{ b.college }} · {{ b.grade }})</option>
      </select>
      <span v-if="selectedBatch" class="batch-status-tag" :class="'status-' + selectedBatch.status">
        {{ selectedBatch.status === 'published' ? '进行中' : selectedBatch.status === 'draft' ? '草稿' : selectedBatch.status }}
      </span>
    </div>

    <div v-if="!selectedBatchId" class="empty-hint">请先选择一个批次，再进行规则操作</div>

    <template v-else>
      <!-- 上传区 -->
      <div class="upload-row">
        <div class="upload-left">
          <div class="upload-zone" @click="$refs.fileInput.click()" @dragover.prevent @drop.prevent="onDrop">
            <span class="upload-icon">📁</span>
            <span v-if="uploading">{{ uploadingFiles.length }} 个文件上传中...</span>
            <span v-else>拖拽或点击上传规则文件</span>
            <span class="hint">支持 .docx .xlsx .pdf .png .jpg，可多选</span>
          </div>
          <input type="file" ref="fileInput" multiple hidden accept=".docx,.xlsx,.pdf,.png,.jpg,.jpeg" @change="onFiles" />
        </div>
        <div class="upload-right">
          <textarea v-model="ruleText" rows="3" placeholder="补充说明文字..."></textarea>
          <button class="btn primary" @click="sendText" :disabled="!ruleText.trim()">发送 → AI 解析</button>
        </div>
      </div>

      <!-- 解析进度条 -->
      <div v-if="parsingId" class="progress-bar-wrap">
        <div class="progress-bar"><div class="progress-fill" :style="{ width: parsePercent + '%' }"></div></div>
        <span class="progress-text">{{ progressLabel }}</span>
        <button class="btn-text danger sm" @click="cancelCurrentParse">取消</button>
      </div>

      <!-- 已上传的文件 -->
      <div v-if="ruleSources.length" class="source-list">
        <h4>已上传的规则文件</h4>
        <div v-for="src in ruleSources" :key="src.id" class="source-row">
          <span>📄 {{ src.file_name || truncate(src.original_text, 40) }}</span>
          <span class="badge" :class="src.status">{{ src.status === 'parsed' ? '已解析' : '待解析' }}</span>
          <button class="btn-text primary" :disabled="!!parsingId" @click="doParse(src.id)">
            {{ parsingId === src.id ? '解析中...' : '解析' }}
          </button>
          <button class="btn-text danger" @click="deleteSource(src.id)">删除</button>
        </div>
      </div>

      <!-- 重新解析确认弹窗 -->
      <div v-if="reparseDialog.show" class="modal-overlay" @click.self="confirmReparse('cancel')">
        <div class="modal-card">
          <h4>该文件已有解析记录</h4>
          <p>请选择操作方式：</p>
          <div class="modal-actions">
            <button class="btn primary" @click="confirmReparse('overwrite')">🔄 覆盖现有规则集</button>
            <button class="btn" @click="confirmReparse('new')">➕ 新增规则集</button>
            <button class="btn-text" @click="confirmReparse('cancel')">取消</button>
          </div>
        </div>
      </div>

      <!-- 已解析的规则集 -->
      <div v-if="ruleSets.length" class="rule-sets-list">
        <div class="section-header-row">
          <h4>已解析的规则集 ({{ ruleSets.length }})</h4>
          <button class="btn-text" @click="showAddForm = !showAddForm">
            {{ showAddForm ? '收起' : '+ 手动添加规则' }}
          </button>
        </div>

        <!-- ★ 手动添加规则表单 -->
        <div v-if="showAddForm" class="add-rule-form">
          <h5>手动添加规则</h5>
          <div class="form-grid">
            <select v-model="addForm.rule_set_id" required>
              <option value="">-- 选择目标规则集 --</option>
              <option v-for="rs in editableRuleSets" :key="rs.id" :value="rs.id">
                {{ rs.version_label || '规则集' }} ({{ rs.status === 'published' ? '已发布' : '草稿' }})
              </option>
            </select>
            <select v-model="addForm.item_key" required>
              <option value="">-- 类别 --</option>
              <option v-for="k in B_KEYS" :key="k" :value="k">{{ k }} {{ B_LABELS[k] }}</option>
            </select>
            <input v-model="addForm.item_name" placeholder="规则名称" required />
            <select v-model="addForm.score_level">
              <option value="">-- 等级 --</option>
              <option value="国家级">国家级</option><option value="省级">省级</option>
              <option value="校级">校级</option><option value="院级">院级</option>
            </select>
            <input v-model="addForm.score_rank" placeholder="奖项等次（如一等奖）" />
            <input v-model.number="addForm.score" type="number" placeholder="分值" required min="0" />
            <input v-model="addForm.keywords" placeholder="关键词（用空格分隔）" />
            <textarea v-model="addForm.description" placeholder="规则说明" rows="2"></textarea>
          </div>
          <div class="form-actions">
            <button class="btn primary" :disabled="!canAddRule" @click="submitAddRule">添加规则</button>
            <button class="btn-text" @click="showAddForm = false; resetAddForm()">取消</button>
            <span v-if="addMsg" class="add-msg" :class="addMsgType">{{ addMsg }}</span>
          </div>
        </div>

        <div v-for="rs in ruleSets" :key="rs.id" class="ruleset-card">
          <div class="ruleset-header" @click="toggleDetail(rs)">
            <span class="ruleset-arrow">{{ rs._open ? '▼' : '▶' }}</span>
            <span class="ruleset-label">{{ rs.version_label || '规则集' }}</span>
            <span class="ruleset-time">{{ formatTime(rs.created_at) }}</span>
            <span class="badge" :class="rs.status">{{ statusText(rs.status) }}</span>
            <span class="ruleset-meta">{{ rs.f3_rule_count || 0 }} 条F3规则</span>
            <button v-if="rs.status === 'draft'" class="btn primary sm" @click.stop="publishSet(rs)">✅ 确认发布</button>
            <button v-if="rs.status === 'archived'" class="btn sm" style="background:#f0ad4e;color:#fff" @click.stop="publishSet(rs)">🔄 重新发布</button>
            <button class="btn-text sm" @click.stop="toggleDetail(rs)">🔍 {{ rs._open && rs._detail ? '收起' : '查看详情' }}</button>
            <button v-if="rs.status === 'draft'" class="btn-text danger sm" @click.stop="deleteSet(rs)">🗑</button>
          </div>

          <div v-if="rs._open && rs._detail" class="ruleset-body">
            <h5>F3 评分规则 ({{ (rs._detail.f3_rules || []).length }} 条)</h5>
            <div class="rule-table-wrap" v-if="rs._detail.f3_rules?.length">
              <table class="rule-table">
                <thead><tr><th>编号</th><th>名称</th><th>等级</th><th>分值</th></tr></thead>
                <tbody>
                  <tr v-for="r in rs._detail.f3_rules" :key="r.id">
                    <td class="code-cell">{{ r.item_key }}</td>
                    <td class="name-cell">{{ r.item_name }}</td>
                    <td>{{ r.score_level || '-' }}</td>
                    <td class="score-cell">{{ r.score }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-else class="text-muted">暂无F3规则</p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '../../stores/user'
import * as api from '../../api/zongce'

// ===== 批次选择 =====
const batches = ref([])
const selectedBatchId = ref('')
const selectedBatch = computed(() => batches.value.find(b => b.id === selectedBatchId.value) || null)

async function loadBatches() {
  const r = await api.getBatches()
  if (r.code === 200) batches.value = r.data || []
}

async function onBatchChange() {
  ruleSources.value = []
  ruleSets.value = []
  if (selectedBatchId.value) await refreshData()
}

async function refreshData() {
  if (!selectedBatchId.value) return
  const [s, rs] = await Promise.all([
    api.getRuleSources(selectedBatchId.value),
    api.getRuleSets(selectedBatchId.value),
  ])
  if (s.code === 200) ruleSources.value = s.data || []
  if (rs.code === 200) ruleSets.value = rs.data || []
}

// ===== 规则管理（复用原 SmartFillRule 逻辑） =====
const B_KEYS = ['B1','B2','B3','B4','B5','B6','B7','B8']
const B_LABELS = { B1:'职业技能', B2:'学科竞赛', B3:'科研学术', B4:'宣传报道', B5:'社会工作', B6:'社会实践', B7:'文体竞赛', B8:'劳动教育' }

const ruleSources = ref([])
const ruleSets = ref([])
const ruleText = ref('')
const uploading = ref(false)
const uploadingFiles = ref([])
const parsingId = ref(null)
const parsingTaskId = ref(null)
const parseProgress = ref({ completed: 0, total: 0 })

// ★ 手动添加规则
const showAddForm = ref(false)
const addForm = ref({ rule_set_id: '', item_key: '', item_name: '', score_level: '', score_rank: '', score: 0, keywords: '', description: '' })
const addMsg = ref('')
const addMsgType = ref('')

function resetAddForm() {
  addForm.value = { rule_set_id: '', item_key: '', item_name: '', score_level: '', score_rank: '', score: 0, keywords: '', description: '' }
  addMsg.value = ''
}

const editableRuleSets = computed(() => ruleSets.value.filter(rs => rs.status === 'draft' || rs.status === 'published'))
const canAddRule = computed(() => addForm.value.rule_set_id && addForm.value.item_key && addForm.value.item_name && addForm.value.score > 0)

async function submitAddRule() {
  if (!canAddRule.value) return
  try {
    const res = await api.addRuleToSet(addForm.value.rule_set_id, addForm.value)
    if (res.code === 200) {
      addMsg.value = '规则已添加'
      addMsgType.value = 'success'
      resetAddForm()
      refreshData()
    } else {
      addMsg.value = res.msg || '添加失败'
      addMsgType.value = 'error'
    }
  } catch (e) {
    addMsg.value = '添加失败: ' + (e.response?.data?.msg || e.message)
    addMsgType.value = 'error'
  }
}

function statusText(s) {
  if (s === 'published') return '已发布'
  if (s === 'draft') return '草稿'
  if (s === 'archived') return '已归档'
  return s || ''
}

function formatTime(t) {
  if (!t) return ''
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

const parsePercent = computed(() => {
  if (!parseProgress.value.total) return 0
  return Math.round((parseProgress.value.completed / parseProgress.value.total) * 100)
})
const phaseLabels = {
  extracting: '正在提取文档…', chapter_tree: '正在识别章节…', task_split: '正在拆分任务…',
  executing: 'AI 解析中', merging: '正在合并去重…', validating: '正在校验…', writing: '正在写入…',
}
const progressLabel = computed(() => {
  const p = parseProgress.value
  const phase = phaseLabels[p.phase] || p.phase || '处理中'
  const count = p.total ? `${p.completed || 0}/${p.total}` : ''
  return count ? `${phase} (${count})` : phase
})

async function toggleDetail(rs) {
  if (rs._open) { rs._open = false; return }
  if (!rs._detail) {
    try {
      const res = await api.getRuleSet(rs.id)
      if (res.code === 200) rs._detail = res.data
      else { alert(res.msg); return }
    } catch (e) { alert('加载失败: ' + (e.response?.data?.msg || e.message)); return }
  }
  rs._open = true
}

async function deleteSet(rs) {
  if (!confirm('确定删除该规则集？')) return
  try {
    const res = await api.deleteRuleSet(rs.id)
    if (res.code === 200) refreshData()
    else alert(res.msg)
  } catch (e) { alert('删除失败: ' + (e.response?.data?.msg || e.message)) }
}

async function publishSet(rs) {
  try {
    const res = await api.publishRuleSet(rs.id)
    if (res.code === 200) { rs.status = 'published'; refreshData() }
    else alert(res.msg)
  } catch (e) { alert('发布失败: ' + (e.response?.data?.msg || e.message)) }
}

function onDrop(e) { onFiles({ target: { files: e.dataTransfer.files } }) }
async function onFiles(e) {
  const files = [...(e.target.files || [])]
  if (!files.length) return
  uploadingFiles.value = files.map(f => f.name)
  uploading.value = true
  const fd = new FormData()
  for (const f of files) fd.append('files', f)
  const res = await api.uploadRuleFiles(fd, selectedBatchId.value || undefined)
  alert(res.msg)
  if (res.code === 200) refreshData()
  uploading.value = false; uploadingFiles.value = []
}
async function sendText() {
  if (!ruleText.value.trim()) return
  const res = await api.addRuleText(ruleText.value, selectedBatchId.value || undefined)
  alert(res.msg)
  if (res.code === 200) refreshData()
  ruleText.value = ''
}

const reparseDialog = ref({ show: false, sourceId: null })
async function doParse(sourceId) {
  const src = ruleSources.value.find(s => s.id === sourceId)
  if (src && src.status === 'parsed') { reparseDialog.value = { show: true, sourceId }; return }
  startParse(sourceId, false)
}
function confirmReparse(action) {
  const sid = reparseDialog.value.sourceId
  reparseDialog.value = { show: false, sourceId: null }
  if (action === 'cancel') return
  startParse(sid, action === 'new')
}

async function startParse(sourceId, forceNew) {
  parsingId.value = sourceId
  parseProgress.value = { completed: 0, total: 1 }
  try {
    const startRes = await api.parseRuleSource(sourceId, selectedBatchId.value || undefined, forceNew)
    if (startRes.code !== 200) { alert(startRes.msg); parsingId.value = null; return }
    const taskId = startRes.data.taskId; parsingTaskId.value = taskId
    const token = useUserStore().token
    const es = new EventSource(`/api/zongce/rules/tasks/${taskId}/stream?token=${encodeURIComponent(token)}`)
    es.addEventListener('progress', (e) => {
      try { const p = JSON.parse(e.data); parseProgress.value = p } catch (_) {}
    })
    es.addEventListener('done', async (e) => {
      es.close()
      try { const p = JSON.parse(e.data); parseProgress.value = { ...p, completed: p.total || p.task_count || 1 } } catch (_) {}
      refreshData(); parsingId.value = null
    })
    es.addEventListener('error', () => { es.close(); alert('解析失败'); parsingId.value = null })
  } catch (e) {
    alert('启动解析失败: ' + (e.response?.data?.msg || e.message))
    parsingId.value = null
  }
}

async function cancelCurrentParse() {
  if (!parsingId.value || !parsingTaskId.value) return
  try { await api.cancelParse(parsingTaskId.value) }
  catch (e) { alert(e.response?.data?.msg || '取消失败') }
  parsingId.value = null; parsingTaskId.value = null
}

async function deleteSource(id) {
  if (!confirm('确定删除该规则文件及关联的解析记录？')) return
  try {
    const res = await api.deleteRuleSource(id)
    if (res.code === 200) refreshData()
    else alert(res.msg)
  } catch (e) { alert('删除失败: ' + (e.response?.data?.msg || e.message)) }
}

function truncate(s, n) { return s?.length > n ? s.slice(0, n) + '...' : s }

onMounted(() => { loadBatches() })
</script>

<style scoped>
.admin-rule-page { display: flex; flex-direction: column; gap: 20px; padding: 20px; }
.page-header h2 { font-size: 20px; margin: 0; }
.page-header p { font-size: 14px; color: var(--color-text-tertiary); margin: 4px 0 0; }

.batch-select-bar { display: flex; align-items: center; gap: 12px; padding: 14px 18px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 10px; }
.batch-select-bar label { font-size: 14px; font-weight: 600; white-space: nowrap; }
.batch-select { padding: 8px 14px; border: 1.5px solid var(--color-border); border-radius: 6px; font-size: 14px; font-family: inherit; min-width: 300px; }
.batch-select:focus { outline: none; border-color: var(--color-primary); }

.batch-status-tag { font-size: 12px; padding: 2px 10px; border-radius: 12px; font-weight: 500; }
.status-published { background: #e6f4ea; color: #34A853; }
.status-draft { background: #fef7e0; color: #E37400; }

.empty-hint { text-align: center; padding: 40px; color: var(--color-text-tertiary); font-size: 15px; }

.upload-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 768px) { .upload-row { grid-template-columns: 1fr; } }
.upload-zone { border: 2px dashed var(--color-border); border-radius: 8px; padding: 28px; display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer; color: var(--color-gray); font-size: 14px; transition: border-color 0.2s; }
.upload-zone:hover { border-color: var(--color-primary); }
.upload-icon { font-size: 32px; }
.hint { font-size: 12px; color: var(--color-text-tertiary); }

.progress-bar-wrap { display: flex; align-items: center; gap: 12px; }
.progress-bar { flex: 1; height: 8px; background: var(--color-bg); border-radius: 4px; overflow: hidden; }
.progress-fill { height: 100%; background: var(--color-primary); border-radius: 4px; transition: width 0.3s; }
.progress-text { font-size: 13px; color: var(--color-primary); white-space: nowrap; }
.upload-right { display: flex; flex-direction: column; gap: 8px; }
.upload-right textarea { flex: 1; border: 1px solid var(--color-border); border-radius: 6px; padding: 12px; font-size: 14px; font-family: inherit; resize: vertical; }
.upload-right textarea:focus { outline: none; border-color: var(--color-primary); }

.source-list { display: flex; flex-direction: column; gap: 6px; }
.source-row { display: flex; align-items: center; gap: 12px; padding: 8px 12px; border: 1px solid var(--color-border); border-radius: 6px; font-size: 14px; }
.source-row span:first-child { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.rule-sets-list { display: flex; flex-direction: column; gap: 10px; }
.ruleset-card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 10px; overflow: hidden; }
.ruleset-header { display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: var(--color-surface-variant); cursor: pointer; user-select: none; font-size: 14px; }
.ruleset-header:hover { background: var(--color-surface-variant); }
.ruleset-arrow { font-size: 12px; color: var(--color-text-tertiary); width: 16px; }
.ruleset-label { font-weight: 600; flex: 1; }
.ruleset-meta { font-size: 13px; color: var(--color-text-tertiary); }
.ruleset-body { padding: 12px 16px; }

.rule-table-wrap { overflow-x: auto; }
.rule-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.rule-table th { text-align: left; padding: 8px 6px; border-bottom: 2px solid var(--color-border); color: var(--color-text-secondary); font-weight: 500; }
.rule-table td { padding: 7px 6px; border-bottom: 1px solid var(--color-border); }
.code-cell { font-weight: 600; }
.score-cell { font-weight: 700; color: #34A853; }

.btn { padding: 8px 18px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-family: inherit; }
.btn.primary { background: var(--color-primary); color: #fff; }
.btn.sm { padding: 6px 14px; font-size: 13px; }
.btn-text { padding: 4px 12px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); cursor: pointer; font-size: 12px; font-family: inherit; }
.btn-text.primary { color: var(--color-primary); border-color: var(--color-primary); }
.btn-text.danger { color: #D93025; border-color: transparent; }
.badge { font-size: 12px; padding: 2px 8px; border-radius: 10px; background: #FEF7E0; color: #E37400; }
.badge.parsed { background: #E6F4EA; color: #34A853; }
.badge.published { background: #E6F4EA; color: #34A853; }
.text-muted { color: var(--color-text-tertiary); font-size: 13px; }

.modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.4); display:flex; align-items:center; justify-content:center; z-index:100; }
.modal-card { background:var(--color-surface); border-radius:12px; padding:28px; min-width:340px; text-align:center; box-shadow:0 4px 20px rgba(0,0,0,.15); }
.modal-card h4 { margin-bottom:8px; font-size:17px; }
.modal-card p { color:var(--color-text-secondary); margin-bottom:20px; font-size:14px; }
.modal-actions { display:flex; flex-direction:column; gap:10px; }
.modal-actions .btn { width:100%; }

/* ===== 手动添加规则 ===== */
.section-header-row { display: flex; justify-content: space-between; align-items: center; }
.section-header-row h4 { margin: 0; }
.add-rule-form {
  background: var(--color-surface-variant); border: 1px solid var(--color-border);
  border-radius: 10px; padding: 16px 20px; display: flex; flex-direction: column; gap: 12px;
}
.add-rule-form h5 { font-size: 15px; margin: 0; }
.form-grid {
  display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;
}
@media (max-width: 768px) { .form-grid { grid-template-columns: 1fr 1fr; } }
.form-grid select, .form-grid input, .form-grid textarea {
  padding: 8px 10px; border: 1.5px solid var(--color-border); border-radius: 6px;
  font-size: 13px; font-family: inherit;
}
.form-grid select:focus, .form-grid input:focus, .form-grid textarea:focus {
  outline: none; border-color: var(--color-primary);
}
.form-grid textarea { grid-column: 1 / -1; resize: vertical; min-height: 50px; }
.form-actions { display: flex; align-items: center; gap: 10px; }
.add-msg { font-size: 13px; }
.add-msg.success { color: #34A853; }
.add-msg.error { color: #D93025; }

.ruleset-time { font-size: 12px; color: var(--color-text-tertiary); min-width: 100px; }
</style>
