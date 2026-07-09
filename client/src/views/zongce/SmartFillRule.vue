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
        <textarea v-model="ruleText" rows="3" placeholder="文字补充约束：如'志愿服务归德育，学科竞赛归智育...'"></textarea>
        <button class="btn primary" @click="sendText" :disabled="!ruleText.trim()">发送 → AI 解析</button>
      </div>
    </div>

    <!-- 解析进度条 -->
    <div v-if="parsingId" class="progress-bar-wrap">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: parsePercent + '%' }"></div>
      </div>
      <span class="progress-text">{{ parseProgress.completed || 0 }}/{{ parseProgress.total || '?' }} 段已完成</span>
    </div>

    <!-- 已上传的来源 -->
    <div v-if="ruleSources.length" class="source-list">
      <h4>已上传的规则来源</h4>
      <div v-for="src in ruleSources" :key="src.id" class="source-row">
        <span>{{ src.source_type === 'file' ? '📄' : '💬' }} {{ src.file_name || truncate(src.original_text, 40) }}</span>
        <span class="badge" :class="src.status">
          {{ parsingId === src.id ? `解析中 ${parseProgress.completed || 0}/${parseProgress.total || '?'}` : (src.status === 'parsed' ? '已解析' : '待解析') }}
        </span>
        <button v-if="src.status !== 'parsed'" class="btn-text primary" :disabled="!!parsingId" @click="doParse(src.id)">
          {{ parsingId === src.id ? '⏳ AI解析中...' : '🔍 解析' }}
        </button>
        <button class="btn-text danger" @click="$emit('remove-source', src.id)">删除</button>
      </div>
    </div>

    <!-- 规则清单（规则单） -->
    <div v-if="ruleItems.length" class="rule-summary">
      <h4>规则清单（{{ ruleItems.filter(r => r.status === 'confirmed').length }}/{{ ruleItems.length }} 已确认）</h4>
      <p class="hint">这是 AI 解析出的规则摘要，请逐条审核。勾选 = 确认，取消 = 暂不使用。</p>
      <div class="rule-table-wrap">
        <table class="rule-table">
          <thead>
            <tr>
              <th>确认</th>
              <th>类别</th>
              <th>类型</th>
              <th>描述</th>
              <th>级别</th>
              <th>分值</th>
              <th>互斥组</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in ruleItems" :key="item.id" :class="{ dimmed: item.status !== 'confirmed' }">
              <td><input type="checkbox" :checked="item.status === 'confirmed'" @change="$emit('toggle-item', item)" /></td>
              <td><span class="cat-tag" :style="catStyle(item.category)">{{ catLabel(item.category) }}</span></td>
              <td>{{ typeLabel(item.rule_type) }}</td>
              <td class="desc-cell">{{ item.description }}</td>
              <td>{{ levelLabel(item.level) }}</td>
              <td>{{ item.score != null ? (item.rule_type === 'scoring' ? '+' : '') + item.score : '-' }}</td>
              <td>{{ item.conflict_group || '-' }}</td>
              <td><button class="btn-text danger" @click="$emit('remove-item', item.id)">删除</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import * as api from '../../api/zongce'

const props = defineProps({ ruleSources: Array, ruleItems: Array })
const emit = defineEmits(['remove-source','remove-item','toggle-item','refresh'])

const ruleText = ref('')
const fileInput = ref(null)
const uploading = ref(false)
const uploadingFiles = ref([])
const parsingId = ref(null)
const parseProgress = ref({ completed: 0, total: 0 })
const parsePercent = computed(() => {
  if (!parseProgress.value.total) return 0
  return Math.round((parseProgress.value.completed / parseProgress.value.total) * 100)
})

async function onFiles(e) {
  const files = Array.from(e.target.files)
  if (!files.length) return
  uploadingFiles.value = files.map(f => f.name)
  uploading.value = true
  const fd = new FormData()
  for (const f of files) fd.append('files', f)
  const res = await api.uploadRuleFiles(fd)
  alert(res.msg)
  if (res.code === 200) emit('refresh')
  uploading.value = false
  uploadingFiles.value = []
  e.target.value = ''
}
async function onDrop(e) {
  const files = Array.from(e.dataTransfer.files)
  if (!files.length) return
  uploadingFiles.value = files.map(f => f.name)
  uploading.value = true
  const fd = new FormData()
  for (const f of files) fd.append('files', f)
  const res = await api.uploadRuleFiles(fd)
  alert(res.msg)
  if (res.code === 200) emit('refresh')
  uploading.value = false
  uploadingFiles.value = []
}
async function sendText() {
  if (!ruleText.value.trim()) return
  const res = await api.addRuleText(ruleText.value)
  alert(res.msg)
  if (res.code === 200) emit('refresh')
  ruleText.value = ''
}
async function doParse(sourceId) {
  parsingId.value = sourceId
  parseProgress.value = { completed: 0, total: 1 }
  try {
    // 启动解析
    const startRes = await api.parseRuleSource(sourceId)
    if (startRes.code !== 200) { alert(startRes.msg); return }

    const taskId = startRes.data.taskId
    // 轮询进度
    const timer = setInterval(async () => {
      try {
        const r = await api.getParseProgress(taskId)
        if (r.code !== 200) return
        const t = r.data
        if (t.status === 'completed') {
          clearInterval(timer)
          parseProgress.value = { completed: t.result?.total || 1, total: t.result?.total || 1 }
          emit('refresh')
          parsingId.value = null
        } else if (t.status === 'failed') {
          clearInterval(timer)
          alert('解析失败: ' + (t.error_msg || '未知错误'))
          parsingId.value = null
        } else if (t.result) {
          try {
            const p = typeof t.result === 'string' ? JSON.parse(t.result) : t.result
            if (p.phase === 'parsing') parseProgress.value = p
          } catch (e) { /* ignore */ }
        }
      } catch (e) { /* 轮询失败继续 */ }
    }, 1500)
  } catch (e) {
    alert('启动解析失败: ' + (e.response?.data?.msg || e.message))
    parsingId.value = null
  }
}

function truncate(s, n) { return s?.length > n ? s.slice(0, n) + '...' : s }
const catMap = { moral:'德育', intellectual:'智育', physical:'体育', aesthetic:'美育', labor:'劳育' }
const catColors = { moral:'#EA8600', intellectual:'#1A73E8', physical:'#34A853', aesthetic:'#9C27B0', labor:'#FF6D00' }
function catLabel(c) { return catMap[c] || c || '全局' }
function catStyle(c) { return { background: (catColors[c]||'#9AA0A6')+'20', color: catColors[c]||'#9AA0A6', border: '1px solid '+(catColors[c]||'#9AA0A6')+'40' } }
function typeLabel(t) { return { scoring:'加分', limit:'上限', conflict:'冲突' }[t] || t }
function levelLabel(l) { return { national:'国家级', provincial:'省级', school:'校级', college:'院级' }[l] || l || '-' }
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
.hint { font-size: 12px; color: #999; }

.progress-bar-wrap { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
.progress-bar { flex: 1; height: 8px; background: #e0e0e0; border-radius: 4px; overflow: hidden; }
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
.rule-table th { text-align: left; padding: 8px 6px; border-bottom: 2px solid var(--color-border); color: #666; font-weight: 500; white-space: nowrap; }
.rule-table td { padding: 8px 6px; border-bottom: 1px solid #f0f0f0; }
.rule-table tr.dimmed { opacity: 0.35; }
.desc-cell { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.cat-tag { font-size: 12px; padding: 2px 8px; border-radius: var(--radius-tag); font-weight: 500; }

.btn { padding: 8px 20px; border: none; border-radius: var(--radius-btn); cursor: pointer; font-size: 14px; font-family: inherit; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn.primary { background: var(--color-primary); color: #fff; }
.btn-text { padding: 4px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-btn); background: #fff; cursor: pointer; font-size: 12px; font-family: inherit; }
.btn-text.primary { color: var(--color-primary); border-color: var(--color-primary); }
.btn-text.danger { color: #D93025; border-color: transparent; }
.badge { font-size: 12px; padding: 2px 8px; border-radius: var(--radius-tag); background: #FEF7E0; color: #E37400; }
.badge.parsed { background: #E6F4EA; color: #34A853; }
</style>
