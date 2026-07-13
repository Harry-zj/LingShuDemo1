<template>
  <div>
    <label class="upload-btn" v-if="editable"><VIcon icon="mdi:file-upload-outline" />上传 .docx 规则文件<input type="file" hidden accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" @change="handleUpload($event)" /></label>

    <div v-if="parsingId" class="parse-progress">
      <div class="progress-bar"><div class="progress-fill" :style="{width: parsePercent+'%'}"></div></div>
      <span class="progress-label">{{ phaseLabel }} ({{ progress.completed }}/{{ progress.total }})</span>
      <button class="btn-text danger sm" @click="cancelParse">取消</button>
    </div>

    <div class="rule-file-list" v-if="sources.length">
      <div class="rule-file-row" v-for="src in sources" :key="src.id">
        <div class="rule-file-info">
          <span class="rule-file-name">📄 {{ src.file_name || '未命名文件' }}</span>
          <span class="rule-file-status" :class="src.status === 'parsed' ? 'parsed' : 'pending'">{{ src.status === 'parsed' ? '已解析' : '未解析' }}</span>
        </div>
        <div class="rule-file-actions" v-if="editable">
          <button class="btn-text" :disabled="!!parsingId" @click="doParse(src)">{{ parsingId === src.id ? '解析中...' : '解析' }}</button>
          <button class="btn-text danger" @click="doDelete(src.id)">删除</button>
        </div>
      </div>
    </div>

    <div class="rule-sets-section" v-if="ruleSets.length">
      <h4>规则集 ({{ ruleSets.length }})</h4>
      <div class="ruleset-card" v-for="rs in ruleSets" :key="rs.id">
        <div class="ruleset-header" @click="toggleDetail(rs)">
          <span class="ruleset-arrow">{{ rs._open ? '▼' : '▶' }}</span>
          <span class="ruleset-label">{{ rs.version_label || '规则集' }}</span>
          <span class="badge" :class="rs.status">{{ rs.status === 'published' ? '已发布' : '草稿' }}</span>
          <span class="ruleset-meta">{{ rs.f3_rule_count || 0 }} 条F3规则</span>
          <button v-if="editable" class="btn-text danger sm" @click.stop="doDeleteSet(rs)">删除</button>
        </div>
        <div v-if="rs._open && rs._detail" class="ruleset-body">
          <div class="rule-items" v-if="rs._detail.f3_rules?.length">
            <div class="rule-item" v-for="(r, i) in rs._detail.f3_rules" :key="r.id">
              <span class="rule-item-num">{{ i + 1 }}</span>
              <span class="rule-item-key">{{ r.section || 'F3' }}</span>
              <span class="rule-item-key">{{ r.item_key }}</span>
              <span class="rule-item-desc">{{ r.description || r.item_name }}</span>
              <span class="rule-item-score">+{{ r.score }}分</span>
              <span class="rule-item-level" v-if="r.score_level || r.score_rank">{{ r.score_level || '' }} {{ r.score_rank || '' }}</span>
            </div>
          </div>
          <p v-else class="text-muted">暂无F3规则</p>
        </div>
      </div>
    </div>

    <div class="empty-line" v-if="!loading && !sources.length && !ruleSets.length">暂无规则文件</div>

    <div v-if="reparseDialog.show" class="modal-overlay" @click.self="confirmReparse('cancel')">
      <div class="modal-card">
        <h4>该文件已有解析记录</h4>
        <p>请选择操作方式：</p>
        <div class="modal-actions">
          <button class="btn primary" @click="confirmReparse('overwrite')">覆盖现有规则集</button>
          <button class="btn" @click="confirmReparse('new')">新增规则集</button>
          <button class="btn-text" @click="confirmReparse('cancel')">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { uploadRuleFiles, getRuleSources, getRuleSets, getRuleSet, publishRuleSet, deleteRuleSource, deleteRuleSet } from '../../api/zongce'
import { useUserStore } from '../../stores/user'
import request from '../../api/request'

const props = defineProps({ batch: { type: Object, required: true }, editable: { type: Boolean, default: true } })

const sources = ref([])
const ruleSets = ref([])
const loading = ref(false)
const parsingId = ref(null)
const parsingTaskId = ref(null)
const progress = ref({ completed: 0, total: 0 })
const phase = ref('')
const phaseLabels = { extracting:'提取文档', chapter_tree:'识别章节', task_split:'拆分任务', executing:'AI解析中', merging:'合并', validating:'校验', writing:'写入' }
const phaseLabel = computed(() => phaseLabels[phase.value] || phase.value || '处理中')
const parsePercent = computed(() => progress.value.total ? Math.round(progress.value.completed / progress.value.total * 100) : 0)
const reparseDialog = ref({ show: false, sourceId: null })

async function loadAll() {
  if (!props.batch.id) return
  loading.value = true
  try {
    const [srcRes, setRes] = await Promise.all([getRuleSources(props.batch.id), getRuleSets(props.batch.id)])
    if (srcRes.code === 200) sources.value = srcRes.data || []
    if (setRes.code === 200) ruleSets.value = (setRes.data || []).map(rs => ({ ...rs, _open: false, _detail: null }))
  } catch (_) {}
  finally { loading.value = false }
}

async function handleUpload(e) {
  const files = e.target.files; if (!files || !files.length) return
  const fd = new FormData(); for (const f of files) fd.append('files', f)
  try { const r = await uploadRuleFiles(fd, props.batch.id); if (r.code === 200) loadAll(); else alert(r.msg) } catch (_) { alert('上传失败') }
  e.target.value = ''
}

function doParse(src) {
  if (src.status === 'parsed') { reparseDialog.value = { show: true, sourceId: src.id }; return }
  startParse(src.id, false)
}
function confirmReparse(action) {
  const sid = reparseDialog.value.sourceId
  reparseDialog.value = { show: false, sourceId: null }
  if (action === 'cancel') return
  startParse(sid, action === 'new')
}

async function startParse(sourceId, forceNew) {
  parsingId.value = sourceId; phase.value = 'starting'; progress.value = { completed: 0, total: 0 }
  try {
    const params = { batch_id: props.batch.id || undefined }
    if (forceNew) params.force_new = '1'
    const r = await request.post(`/zongce/rules/sources/${sourceId}/parse`, null, { params, timeout: 30000 })
    if (r.code !== 200) { alert(r.data?.msg || r.msg); parsingId.value = null; return }
    const taskId = r.data.taskId; parsingTaskId.value = taskId
    const token = useUserStore().token
    const es = new EventSource(`/api/zongce/rules/tasks/${taskId}/stream?token=${encodeURIComponent(token)}`)
    es.addEventListener('progress', e => { try { const p = JSON.parse(e.data); phase.value = p.phase || phase.value; progress.value = { completed: p.completed || 0, total: p.total || 0 } } catch (_) {} })
    es.addEventListener('done', async () => { es.close(); parsingId.value = null; parsingTaskId.value = null; await loadAll(); await autoPublish() })
    es.addEventListener('error', () => { es.close(); parsingId.value = null; parsingTaskId.value = null; alert('解析失败') })
  } catch (_) { alert('解析请求失败'); parsingId.value = null }
}

async function cancelParse() {
  if (!parsingTaskId.value) return
  try { await request.post(`/zongce/rules/parse/${parsingTaskId.value}/cancel`); parsingId.value = null; parsingTaskId.value = null } catch (_) { alert('取消失败') }
}

async function autoPublish() {
  for (const rs of ruleSets.value) {
    if (rs.status === 'draft') {
      try { await publishRuleSet(rs.id); rs.status = 'published' } catch (_) {}
    }
  }
}

async function doDelete(id) {
  if (!window.confirm('确定删除该规则文件？相关规则集和计分规则将一并删除。')) return
  try { const r = await deleteRuleSource(id); if (r.code === 200) loadAll(); else alert(r.msg) } catch (_) { alert('删除失败') }
}

async function doDeleteSet(rs) {
  if (!confirm('确定删除该规则集？其中的所有计分规则将一并删除。')) return
  try { const r = await deleteRuleSet(rs.id); if (r.code === 200) loadAll(); else alert(r.msg) } catch (_) { alert('删除失败') }
}

async function toggleDetail(rs) {
  if (rs._open) { rs._open = false; return }
  if (!rs._detail) {
    try { const r = await getRuleSet(rs.id); if (r.code === 200) rs._detail = r.data; else { alert(r.msg); return } } catch (_) { alert('加载失败'); return }
  }
  rs._open = true
}

watch(() => props.batch.id, () => { if (props.batch.id) loadAll() }, { immediate: true })
</script>

<style scoped>
.upload-btn { display:inline-flex; align-items:center; gap:6px; min-height:36px; padding:0 14px; border-radius:8px; cursor:pointer; color:var(--color-text-primary); font-weight:var(--font-weight-medium); background:var(--color-surface); border:1px solid var(--color-border); margin-bottom:12px; }
.upload-btn:hover { border-color:var(--color-primary); color:var(--color-primary); }
.parse-progress { display:flex; align-items:center; gap:12px; margin-bottom:12px; }
.progress-bar { flex:1; height:8px; border-radius:4px; background:var(--color-border); overflow:hidden; }
.progress-fill { height:100%; background:var(--gradient-primary); transition:width .3s ease; }
.progress-label { font-size:13px; color:var(--color-text-secondary); white-space:nowrap; }
.rule-file-list { display:flex; flex-direction:column; gap:8px; margin-bottom:16px; }
.rule-file-row { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:12px; border-radius:8px; background:var(--color-surface); border:1px solid var(--color-border); }
.rule-file-info { display:flex; flex-direction:column; gap:2px; flex:1; min-width:0; }
.rule-file-name { font-size:14px; font-weight:var(--font-weight-medium); }
.rule-file-status { font-size:12px; color:var(--color-text-secondary); }
.rule-file-status.parsed { color:#059669; }
.rule-file-actions { display:flex; gap:4px; }
.rule-file-actions .btn-text { padding:4px 10px; font-size:12px; border-radius:6px; border:1px solid var(--color-border); background:var(--color-surface); color:var(--color-text-primary); cursor:pointer; }
.rule-file-actions .btn-text:hover { border-color:var(--color-primary); color:var(--color-primary); }
.rule-file-actions .btn-text:disabled { opacity:0.5; cursor:not-allowed; }
.rule-file-actions .btn-text.danger { border-color:rgba(239,68,68,0.35); color:#ef4444; }
.rule-file-actions .btn-text.danger:hover { background:rgba(239,68,68,0.08); }
.rule-sets-section { margin-top:8px; }
.rule-sets-section h4 { font-size:15px; font-weight:600; margin-bottom:10px; }
.ruleset-card { border:1px solid var(--color-border); border-radius:8px; margin-bottom:8px; overflow:hidden; }
.ruleset-header { display:flex; align-items:center; gap:10px; padding:12px 14px; cursor:pointer; background:var(--color-surface); user-select:none; }
.ruleset-header:hover { background:var(--color-bg); }
.ruleset-arrow { font-size:12px; color:var(--color-text-tertiary); width:16px; }
.ruleset-label { font-size:14px; font-weight:600; flex:1; }
.ruleset-meta { font-size:12px; color:var(--color-text-tertiary); }
.badge { font-size:11px; padding:2px 8px; border-radius:4px; }
.badge.published { background:rgba(5,150,105,0.12); color:#059669; }
.badge.draft { background:rgba(245,158,11,0.12); color:#b45309; }
.ruleset-body { padding:0 14px 14px; }
.rule-items { display:flex; flex-direction:column; gap:6px; margin-top:8px; }
.rule-item { display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:6px; background:var(--color-bg); border:1px solid var(--color-border); }
.rule-item-num { width:22px; height:22px; border-radius:50%; background:var(--color-primary); color:#fff; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; flex-shrink:0; }
.rule-item-key { font-family:monospace; font-size:11px; font-weight:600; color:var(--color-primary); background:var(--color-primary-light); padding:2px 8px; border-radius:4px; white-space:nowrap; }
.rule-item-desc { flex:1; font-size:13px; line-height:1.5; }
.rule-item-score { font-weight:700; color:#059669; font-size:14px; white-space:nowrap; }
.rule-item-level { font-size:11px; color:var(--color-text-tertiary); background:var(--color-surface); padding:2px 8px; border-radius:4px; white-space:nowrap; }
.text-muted { color:var(--color-text-tertiary); font-size:13px; padding:8px 0; }
.btn-text { padding:4px 10px; font-size:12px; border-radius:6px; border:1px solid var(--color-border); background:var(--color-surface); color:var(--color-text-primary); cursor:pointer; }
.btn-text:hover { border-color:var(--color-primary); color:var(--color-primary); }
.btn-text.danger { border-color:rgba(239,68,68,0.35); color:#ef4444; }
.btn-text.danger:hover { background:rgba(239,68,68,0.08); }
.btn-text.sm { font-size:11px; padding:2px 8px; }
.empty-line { padding:24px; text-align:center; color:var(--color-text-tertiary); }
.btn { padding:8px 18px; border:none; border-radius:8px; cursor:pointer; font-size:14px; }
.btn.primary { background:var(--color-primary); color:#fff; }
.modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center; z-index:1001; }
.modal-card { background:var(--color-surface); border-radius:20px; padding:28px; min-width:340px; text-align:center; box-shadow:var(--shadow-level-3); }
.modal-card h4 { margin-bottom:8px; font-size:17px; }
.modal-card p { color:var(--color-text-secondary); margin-bottom:20px; font-size:14px; }
.modal-actions { display:flex; flex-direction:column; gap:10px; }
.modal-actions .btn { width:100%; }
</style>
