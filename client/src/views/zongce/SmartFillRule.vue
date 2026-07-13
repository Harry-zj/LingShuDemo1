<template>
  <div class="rule-page">
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
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: parsePercent + '%' }"></div>
      </div>
      <span class="progress-text">{{ progressLabel }}</span><button class="btn-text danger sm" @click="cancelCurrentParse">取消</button>
    </div>

    <!-- 已上传的文件 -->
    <div v-if="ruleSources.length" class="source-list">
      <h4>已上传的规则文件</h4>
      <div v-for="src in ruleSources" :key="src.id" class="source-row">
        <span>📄 {{ src.file_name || truncate(src.original_text, 40) }}</span>
        <span class="badge" :class="src.status">
          {{ parsingId === src.id ? (phaseLabels[parseProgress.phase] || '解析中') : (src.status === 'parsed' ? '已解析' : '待解析') }}
        </span>
        <button class="btn-text primary" :disabled="!!parsingId" @click="doParse(src.id)">
          {{ parsingId === src.id ? '解析中...' : '解析' }}
        </button>
        <button class="btn-text danger" @click="$emit('remove-source', src.id)">删除</button>
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
      <div class="ruleset-list-header">
        <h4>已解析的规则集 ({{ ruleSets.length }})</h4>
        <button v-if="draftCount > 0" class="btn-text danger" @click="batchDelete">🗑 批量删除草稿 ({{ draftCount }})</button>
      </div>
      <div v-for="rs in ruleSets" :key="rs.id" class="ruleset-card">
        <div class="ruleset-header" @click="toggleDetail(rs)">
          <input v-if="rs.status === 'draft'" type="checkbox" :checked="selected.has(rs.id)" @change="toggleSelect(rs.id)" @click.stop class="ruleset-check" />
          <span class="ruleset-arrow">{{ rs._open ? '▼' : '▶' }}</span>
          <span class="ruleset-label">{{ rs.version_label || '规则集' }}</span>
          <span class="badge" :class="rs.status">{{ rs.status === 'published' ? '已发布' : '草稿' }}</span>
          <span class="ruleset-meta">
            {{ rs.f3_rule_count || 0 }} 条F3规则
          </span>
          <button v-if="rs.status !== 'published'" class="btn primary sm" @click.stop="publishSet(rs)">✅ 确认发布</button>
          <button class="btn-text sm" @click.stop="toggleDetail(rs)">🔍 {{ rs._open && rs._detail ? '收起' : '查看详情' }}</button>
          <button v-if="rs.status === 'draft'" class="btn-text danger sm" @click.stop="deleteSet(rs)">🗑</button>
        </div>

        <!-- 展开详情 -->
        <div v-if="rs._open && rs._detail" class="ruleset-body">
          <div class="detail-section">
            <h5>F3 评分规则 ({{ (rs._detail.f3_rules || []).length }} 条)</h5>
            <div class="rule-table-wrap" v-if="rs._detail.f3_rules?.length">
              <table class="rule-table">
                <thead><tr><th>编号</th><th>名称</th><th>等级</th><th>分值</th><th>上限</th></tr></thead>
                <tbody>
                  <tr v-for="r in rs._detail.f3_rules" :key="r.id">
                    <td class="code-cell">{{ r.item_key }}</td>
                    <td class="name-cell">{{ r.item_name }}</td>
                    <td>{{ r.score_level || '-' }}</td>
                    <td class="score-cell">{{ r.score }}</td>
                    <td>{{ r.max_score || '-' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-else class="text-muted">暂无F3规则</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useUserStore } from '../../stores/user'
import * as api from '../../api/zongce'

const props = defineProps({ ruleSources: Array, ruleSets: Array, batchId: { type: [Number, String], default: '' } })
const emit = defineEmits(['remove-source', 'refresh', 'parse-start', 'parse-end'])

const ruleText = ref('')
const fileInput = ref(null)
const uploading = ref(false)
const uploadingFiles = ref([])
const parsingId = ref(null)
const parsingTaskId = ref(null)
const parseProgress = ref({ completed: 0, total: 0 })

const parsePercent = computed(() => {
  if (!parseProgress.value.total) return 0
  return Math.round((parseProgress.value.completed / parseProgress.value.total) * 100)
})
const phaseLabels = {
  extracting: '正在提取文档…',
  chapter_tree: '正在识别章节…',
  task_split: '正在拆分任务…',
  executing: 'AI 解析中',
  merging: '正在合并去重…',
  validating: '正在校验…',
  writing: '正在写入…',
}
const progressLabel = computed(() => {
  const p = parseProgress.value
  const phase = phaseLabels[p.phase] || p.phase || '处理中'
  const count = p.total ? `${p.completed || 0}/${p.total}` : ''
  return count ? `${phase} (${count})` : phase
})

// 扁平化指标树
function flatIndicators(nodes, depth = 0) {
  if (!nodes) return []
  const result = []
  for (const n of nodes) {
    result.push({ ...n, _depth: depth })
    if (n.children?.length) result.push(...flatIndicators(n.children, depth + 1))
  }
  return result
}

// 切换详情面板：加载+展开 / 收起
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

// 多选
const selected = ref(new Set())
const draftCount = computed(() => props.ruleSets.filter(r => r.status === 'draft').length)
function toggleSelect(id) {
  const s = new Set(selected.value)
  s.has(id) ? s.delete(id) : s.add(id)
  selected.value = s
}
async function batchDelete() {
  const ids = [...selected.value]
  if (!ids.length) return alert('请先勾选要删除的草稿')
  if (!confirm(`确定删除 ${ids.length} 个草稿规则集？`)) return
  let ok = 0
  for (const id of ids) {
    try { const r = await api.deleteRuleSet(id); if (r.code === 200) ok++ }
    catch (_) {}
  }
  selected.value = new Set()
  emit('refresh'); emit('parse-end')
  alert(`已删除 ${ok}/${ids.length} 个`)
}

// 删除单个草稿
async function deleteSet(rs) {
  if (!confirm('确定删除该规则集？')) return
  try {
    const res = await api.deleteRuleSet(rs.id)
    if (res.code === 200) {emit('refresh'); emit('parse-end')}
    else{
      alert(res.msg)
   } 
  } catch (e) { alert('删除失败: ' + (e.response?.data?.msg || e.message)) }
}

// 确认发布
async function publishSet(rs) {
  try {
    const res = await api.publishRuleSet(rs.id)
    if (res.code === 200) {
      rs.status = 'published'
      emit('refresh'); emit('parse-end')
    } else {
      alert(res.msg)
    }
  } catch (e) { alert('发布失败: ' + (e.response?.data?.msg || e.message)) }
}

// 上传
function onDrop(e) { onFiles({ target: { files: e.dataTransfer.files } }) }
async function onFiles(e) {
  const files = [...(e.target.files || [])]
  if (!files.length) return
  uploadingFiles.value = files.map(f => f.name)
  uploading.value = true
  const fd = new FormData()
  for (const f of files) fd.append('files', f)
  const res = await api.uploadRuleFiles(fd, props.batchId || undefined)
  alert(res.msg)
  if (res.code === 200) emit('refresh'); emit('parse-end')
  uploading.value = false
  uploadingFiles.value = []
}
async function sendText() {
  if (!ruleText.value.trim()) return
  const res = await api.addRuleText(ruleText.value)
  alert(res.msg)
  if (res.code === 200) emit('refresh'); emit('parse-end')
  ruleText.value = ''
}

// 重新解析确认弹窗
const reparseDialog = ref({ show: false, sourceId: null })

// 解析 - 如果已解析则弹窗，否则直接解析
async function doParse(sourceId) {
  const src = props.ruleSources.find(s => s.id === sourceId)
  if (src && src.status === 'parsed') {
    reparseDialog.value = { show: true, sourceId }
    return
  }
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
    const startRes = await api.parseRuleSource(sourceId, props.batchId || undefined, forceNew)
    if (startRes.code !== 200) { alert(startRes.msg); parsingId.value = null; return }
    emit('parse-start')

    const taskId = startRes.data.taskId; parsingTaskId.value = taskId
    const token = useUserStore().token
    const es = new EventSource(`/api/zongce/rules/tasks/${taskId}/stream?token=${encodeURIComponent(token)}`)
    es.addEventListener('progress', (e) => {
      try { const p = JSON.parse(e.data); parseProgress.value = p } catch (_) {}
    })
    es.addEventListener('done', async (e) => {
      es.close()
      try { const p = JSON.parse(e.data); parseProgress.value = { ...p, completed: p.total || p.task_count || 1 } } catch (_) {}
      emit('refresh'); emit('parse-end')
      parsingId.value = null
      emit('parse-end')
    })
    es.addEventListener('error', () => {
      es.close()
      alert('解析失败')
      parsingId.value = null
      emit('parse-end')
    })
  } catch (e) {
    alert('启动解析失败: ' + (e.response?.data?.msg || e.message))
    parsingId.value = null
  }
}

async function cancelCurrentParse() {
  if (!parsingId.value) return
  const taskId = parsingTaskId.value
  if (!taskId) return
  try {
    await api.cancelParse(taskId)
    parsingId.value = null
    parsingTaskId.value = null
    emit('parse-end')
  } catch (e) { alert(e.response?.data?.msg || '取消失败') }
}

function truncate(s, n) { return s?.length > n ? s.slice(0, n) + '...' : s }
</script>

<style scoped>
.rule-page { display: flex; flex-direction: column; gap: 20px; }
.upload-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 768px) { .upload-row { grid-template-columns: 1fr; } }
.upload-zone {
  border: 2px dashed var(--color-border); border-radius: var(--radius-md);
  padding: 28px; display: flex; flex-direction: column; align-items: center; gap: 8px;
  cursor: pointer; color: var(--color-gray); font-size: 14px; transition: border-color 0.2s;
}
.upload-zone:hover { border-color: var(--color-primary); }
.upload-icon { font-size: 32px; }
.hint { font-size: 12px; color: var(--color-text-tertiary); }

.progress-bar-wrap { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; } .progress-bar-wrap { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
.progress-bar { flex: 1; height: 8px; background: var(--color-bg); border-radius: 4px; overflow: hidden; }
.progress-fill { height: 100%; background: var(--color-primary); border-radius: 4px; transition: width 0.3s; }
.progress-text { font-size: 13px; color: var(--color-primary); white-space: nowrap; }
.upload-right { display: flex; flex-direction: column; gap: 8px; }
.upload-right textarea {
  flex: 1; border: 1px solid var(--color-border); border-radius: var(--radius-sm);
  padding: 12px; font-size: 14px; font-family: inherit; resize: vertical;
}
.upload-right textarea:focus { outline: none; border-color: var(--color-primary); }

.source-list { display: flex; flex-direction: column; gap: 6px; }
.source-row {
  display: flex; align-items: center; gap: 12px; padding: 8px 12px;
  border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 14px;
}
.source-row span:first-child { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.rule-summary { }
.rule-table-wrap { overflow-x: auto; }
.rule-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.rule-table th { text-align: left; padding: 8px 6px; border-bottom: 2px solid var(--color-border); color: var(--color-text-secondary); font-weight: 500; white-space: nowrap; }
.rule-table td { padding: 8px 6px; border-bottom: 1px solid var(--color-border); }
.rule-table tr.dimmed { opacity: 0.35; }
.desc-cell { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.cat-tag { font-size: 12px; padding: 2px 8px; border-radius: var(--radius-tag); font-weight: 500; }

.btn { padding: 8px 18px; border: none; border-radius: var(--radius-btn); cursor: pointer; font-size: 14px; font-family: inherit; }
.btn.primary { background: var(--color-primary); color: #fff; }
.btn-text { padding: 4px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-btn); background: var(--color-surface); cursor: pointer; font-size: 12px; font-family: inherit; }
.btn-text.primary { color: var(--color-primary); border-color: var(--color-primary); }
.btn-text.danger { color: #D93025; border-color: transparent; }
.badge { font-size: 12px; padding: 2px 8px; border-radius: var(--radius-tag); background: #FEF7E0; color: #E37400; }
.badge.parsed { background: #E6F4EA; color: #34A853; }

.rule-summary-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.rule-group { border: 1px solid var(--color-border); border-radius: var(--radius-sm); margin-bottom: 10px; overflow: hidden; }
.group-header {
  display: flex; align-items: center; gap: 10px; padding: 12px 16px;
  background: var(--color-surface-variant); cursor: pointer; user-select: none;
}
.group-header:hover { background: var(--color-surface-variant); }
.group-arrow { font-size: 12px; color: var(--color-text-tertiary); width: 16px; }
.group-name { font-weight: 600; font-size: 15px; }
.group-count { font-size: 13px; color: var(--color-text-tertiary); margin-right: auto; }
.group-body { padding: 0 16px 12px; }
.sub-group { margin-top: 12px; }
.sub-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.sub-label { font-size: 13px; font-weight: 500; color: var(--color-text-secondary); }
.sub-count { font-size: 12px; color: var(--color-text-tertiary); }
.btn-text.sm { padding: 2px 10px; font-size: 12px; }
.modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.4); display:flex; align-items:center; justify-content:center; z-index:100; }
.modal-card { background:var(--color-surface); border-radius:var(--radius-xl); padding:28px; min-width:340px; text-align:center; box-shadow:var(--shadow-level-3); }
.modal-card h4 { margin-bottom:8px; font-size:17px; }
.modal-card p { color:var(--color-text-secondary); margin-bottom:20px; font-size:14px; }
.modal-actions { display:flex; flex-direction:column; gap:10px; }
.modal-actions .btn { width:100%; }
.text-muted { color:var(--color-text-tertiary); font-size:13px; }
.detail-section { margin-bottom:20px; }
.detail-section h5 { font-size:14px; margin-bottom:8px; color:var(--color-text-secondary); }

</style>
