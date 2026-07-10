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

    <!-- 规则清单（按维度折叠分组） -->
    <div v-if="ruleItems.length" class="rule-summary">
      <div class="rule-summary-header">
        <h4>规则清单（{{ confirmedCount }}/{{ ruleItems.length }} 已确认）</h4>
        <button class="btn-text" @click="confirmAll">✅ 全部确认</button>
      </div>

      <div v-for="group in groupedRules" :key="group.key" class="rule-group">
        <div class="group-header" @click="group.open = !group.open">
          <span class="group-arrow">{{ group.open ? '▼' : '▶' }}</span>
          <span class="group-name" :style="{ color: group.color }">{{ group.label }}</span>
          <span class="group-count">{{ group.confirmed }}/{{ group.items.length }}</span>
          <button class="btn-text sm" @click.stop="confirmGroup(group)">确认本组</button>
        </div>

        <div v-show="group.open" class="group-body">
          <!-- 子分组：加分项 / 上限 / 冲突 -->
          <div v-for="sub in group.subs" :key="sub.key" class="sub-group">
            <div class="sub-header">
              <span class="sub-label">{{ sub.label }}</span>
              <span class="sub-count">{{ sub.items.length }} 条</span>
            </div>
            <div class="rule-table-wrap">
              <table class="rule-table">
                <thead>
                  <tr><th>确认</th><th>描述</th><th>级别</th><th>分值</th><th>互斥组</th><th>操作</th></tr>
                </thead>
                <tbody>
                  <tr v-for="item in sub.items" :key="item.id" :class="{ dimmed: item.status !== 'confirmed' }">
                    <td><input type="checkbox" :checked="item.status === 'confirmed'" @change="$emit('toggle-item', item)" /></td>
                    <td class="desc-cell">{{ item.description }}</td>
                    <td>{{ levelLabel(item.level) }}</td>
                    <td>{{ item.score != null ? (item.rule_type === 'scoring' ? '+' : '') + item.score : '-' }}</td>
                    <td>{{ item.conflict_group || '-' }}</td>
                    <td><button class="btn-text danger" @click="$emit('remove-item', item.id)">删</button></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
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
    const startRes = await api.parseRuleSource(sourceId)
    if (startRes.code !== 200) { alert(startRes.msg); parsingId.value = null; return }

    const taskId = startRes.data.taskId
    // SSE 流式接收进度
    const es = new EventSource(`/api/zongce/rules/tasks/${taskId}/stream`)
    es.addEventListener('progress', (e) => {
      try { parseProgress.value = JSON.parse(e.data); } catch (_) {}
    })
    es.addEventListener('done', (e) => {
      es.close()
      emit('refresh')
      parsingId.value = null
    })
    es.addEventListener('error', (e) => {
      es.close()
      try { const d = JSON.parse(e.data); alert('解析失败: ' + (d.msg || '未知错误')); } catch (_) { alert('解析连接失败'); }
      parsingId.value = null
    })
  } catch (e) {
    alert('启动解析失败: ' + (e.response?.data?.msg || e.message))
    parsingId.value = null
  }
}

function truncate(s, n) { return s?.length > n ? s.slice(0, n) + '...' : s }
const catMap = { moral:'德育', intellectual:'智育', physical:'体育', aesthetic:'美育', labor:'劳育' }
const catColors = { moral:'#EA8600', intellectual:'#1A73E8', physical:'#34A853', aesthetic:'#9C27B0', labor:'#FF6D00' }
function catLabel(c) { return catMap[c] || c || '全局' }
function typeLabel(t) { return { scoring:'加分', limit:'上限', conflict:'冲突' }[t] || t }
function levelLabel(l) { return { national:'国家级', provincial:'省级', school:'校级', college:'院级' }[l] || l || '-' }

// 动态分组
const confirmedCount = computed(() => props.ruleItems.filter(r => r.status === 'confirmed').length)
const groupedRules = computed(() => {
  const groups = {}
  for (const r of props.ruleItems) {
    const cat = r.category || '__global__'
    if (!groups[cat]) groups[cat] = { scoring: [], limit: [], conflict: [] }
    groups[cat][r.rule_type || 'scoring'].push(r)
  }
  return Object.entries(groups).map(([cat, byType]) => {
    const items = [...byType.scoring, ...byType.limit, ...byType.conflict]
    return {
      key: cat, label: catLabel(cat), color: catColors[cat] || '#9AA0A6',
      items, open: true,
      confirmed: items.filter(r => r.status === 'confirmed').length,
      subs: [
        { key: 'scoring', label: '加分项', items: byType.scoring },
        { key: 'limit', label: '上限约束', items: byType.limit },
        { key: 'conflict', label: '冲突规则', items: byType.conflict },
      ].filter(s => s.items.length),
    }
  })
})
function confirmGroup(group) {
  group.items.forEach(item => { if (item.status !== 'confirmed') emit('toggle-item', item) })
}
function confirmAll() {
  props.ruleItems.forEach(item => { if (item.status !== 'confirmed') emit('toggle-item', item) })
}
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

.rule-summary-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.rule-group { border: 1px solid var(--color-border); border-radius: var(--radius-sm); margin-bottom: 10px; overflow: hidden; }
.group-header {
  display: flex; align-items: center; gap: 10px; padding: 12px 16px;
  background: #fafafa; cursor: pointer; user-select: none;
}
.group-header:hover { background: #f0f0f0; }
.group-arrow { font-size: 12px; color: #999; width: 16px; }
.group-name { font-weight: 600; font-size: 15px; }
.group-count { font-size: 13px; color: #999; margin-right: auto; }
.group-body { padding: 0 16px 12px; }
.sub-group { margin-top: 12px; }
.sub-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.sub-label { font-size: 13px; font-weight: 500; color: #666; }
.sub-count { font-size: 12px; color: #999; }
.btn-text.sm { padding: 2px 10px; font-size: 12px; }
</style>
