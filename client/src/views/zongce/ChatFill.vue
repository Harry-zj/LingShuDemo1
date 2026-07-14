<template>
<div class="chatfill-page">
  <header class="cf-header">
    <div class="header-left">
      <h2 class="page-title">对话填表</h2>
      <p class="page-desc">上传 Word 报名表，AI 智能识别字段，对话生成文案</p>
    </div>
  </header>

  <div class="tab-bar">
    <button class="tab" :class="{ active: view === 'history' }" @click="switchToHistory">
      <VIcon icon="mdi:history" /><span>历史记录</span>
      <span v-if="totalSessions > 0" class="tab-count">{{ totalSessions }}</span>
    </button>
    <button class="tab" :class="{ active: view === 'new' }" @click="view = 'new'">
      <VIcon icon="mdi:plus-circle-outline" /><span>新建对话</span>
    </button>
  </div>

  <!-- ========== HISTORY ========== -->
  <div v-if="view === 'history'" class="history-view">
    <div v-if="sessionsLoading" class="skeleton-list">
      <div v-for="i in 3" :key="i" class="skeleton-card"></div>
    </div>
    <div v-else-if="sessions.length === 0" class="empty-state">
      <div class="empty-icon-wrap"><VIcon icon="mdi:chat-outline" class="empty-icon" /></div>
      <h3>暂无对话填表记录</h3>
      <p>上传 Word 报名表，AI 自动识别字段，对话式填写叙述文案</p>
      <button class="btn primary" @click="view = 'new'"><VIcon icon="mdi:plus" /> 创建第一个对话</button>
    </div>
    <div v-else class="session-grid">
      <div v-for="s in sessions" :key="s.id" class="session-card" @click="openSession(s)">
        <div class="sc-top">
          <span class="sc-status" :class="s.status"><span class="sc-dot"></span>{{ statusLabel(s.status) }}</span>
          <span class="sc-time">{{ formatTime(s.created_at) }}</span>
        </div>
        <div class="sc-body">
          <div class="sc-name"><VIcon icon="mdi:file-document-outline" /><span>{{ s.template_name || '报名表' }}</span></div>
          <div class="sc-meta"><span><VIcon icon="mdi:form-select" /> {{ s.fieldCount || 0 }} 个字段</span></div>
        </div>
        <div class="sc-actions" @click.stop>
          <button v-if="s.status === 'completed'" class="icon-btn" title="下载" @click="downloadResult(s)"><VIcon icon="mdi:download" /></button>
          <button class="icon-btn danger" title="删除" @click="confirmDeleteSession(s)"><VIcon icon="mdi:delete-outline" /></button>
        </div>
      </div>
    </div>
    <div v-if="totalPages > 1" class="pagination">
      <button class="page-btn" :disabled="currentPage <= 1" @click="changePage(-1)"><VIcon icon="mdi:chevron-left" /></button>
      <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
      <button class="page-btn" :disabled="currentPage >= totalPages" @click="changePage(1)"><VIcon icon="mdi:chevron-right" /></button>
    </div>
  </div>

  <!-- ========== NEW SESSION ========== -->
  <div v-if="view === 'new'" class="new-view">
    <!-- Step 1: Upload -->
    <div v-if="!session" class="card upload-card">
      <div class="upload-zone" @click="$refs.fileInput.click()" @dragover.prevent @drop.prevent="onFileDrop">
        <div class="upload-icon-wrap"><VIcon icon="mdi:cloud-upload-outline" class="upload-icon" /></div>
        <strong>上传 Word 报名表</strong>
        <p>拖拽或点击上传 .docx 文件，AI 将自动识别表单字段</p>
        <input ref="fileInput" type="file" hidden accept=".docx" @change="onFileSelect" />
      </div>
      <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>
      <button class="btn primary large full" :disabled="!file || creating" @click="doCreate">
        <span v-if="creating" class="spinner"></span>{{ creating ? 'AI 分析中...' : '上传并智能分析' }}
      </button>
    </div>

    <!-- Step 2: Fill -->
    <div v-else class="fill-layout">
      <!-- Left: Field Panel -->
      <aside class="field-panel">
        <div class="panel-header">
          <h4>{{ session.templateName }}</h4>
          <button class="btn-back" @click="backToHistory"><VIcon icon="mdi:arrow-left" /></button>
        </div>
        <div class="field-list">
          <div v-for="f in fields" :key="f.key" class="field-item"
            :class="{ active: currentField?.key === f.key, done: !!f.value }"
            @click="selectField(f)">
            <span class="field-type-icon"><VIcon :icon="f.type==='narrative'?'mdi:robot':f.type==='image'?'mdi:image':'mdi:form-textbox'" /></span>
            <span class="field-label">{{ f.label || f.key }}</span>
            <VIcon v-if="f.value" icon="mdi:check-circle" class="field-done-icon" />
          </div>
        </div>
        <div class="panel-footer">
          <button class="btn success full" :disabled="!allFieldsDone || filling" @click="doFill">
            <span v-if="filling" class="spinner"></span>{{ filling ? '生成中...' : '生成文档' }}
          </button>
        </div>
      </aside>

      <!-- Right: Content Area -->
      <main class="content-area">
        <!-- 基本信息表单：未选中字段时，显示所有 simple 字段 -->
        <div v-if="!currentField" class="info-form card">
          <div class="form-header"><VIcon icon="mdi:form-select" /><span>基本信息</span></div>
          <p class="form-hint">请填写以下基本字段，这些信息将帮助 AI 生成更准确的文案。</p>
          <div v-if="simpleFields.length === 0" class="form-empty">暂无基本字段。点击左侧 <span class="narrative-color">紫色机器人</span> 字段与 AI 对话。</div>
          <div v-for="f in simpleFields" :key="f.key" class="form-row">
            <label class="form-label">{{ f.label || f.key }}</label>
            <div class="form-input-row">
              <input
                v-model="simpleFieldValues[f.key]"
                :placeholder="f.hint || '请输入' + (f.label || f.key)"
                class="simple-input"
                @blur="saveSingleField(f.key)"
              />
              <VIcon v-if="fieldSavedFlags[f.key]" icon="mdi:check-circle" class="saved-icon" />
            </div>
          </div>
          <button class="btn primary" @click="saveAllSimple" :disabled="!hasSimpleChanges">
            保存基本信息
          </button>
        </div>

        <!-- 单个 Simple 字段详情（点击侧栏时） -->
        <div v-else-if="currentField.type === 'simple' || currentField.type === 'image'" class="simple-form card">
          <div class="form-header">
            <VIcon :icon="'mdi:form-textbox'" />
            <span>{{ currentField.label || currentField.key }}</span>
            <span class="field-type-badge">{{ currentField.type === 'image' ? '图片' : '输入' }}</span>
          </div>
          <p class="form-hint" v-if="currentField.hint">{{ currentField.hint }}</p>
          <textarea v-model="simpleValue" rows="2" class="simple-input" :placeholder="'请输入'+(currentField.label||currentField.key)"></textarea>
          <button class="btn primary" @click="saveSimple" :disabled="!simpleValue.trim()">保存</button>
        </div>

        <!-- Narrative 字段：AI 对话 -->
        <div v-else class="chat-panel">
          <div class="chat-header">
            <VIcon icon="mdi:robot" /><span>{{ currentField.label || currentField.key }}</span>
            <span class="field-type-badge narrative">AI 对话</span>
            <button v-if="streamDone && streamText" class="btn accept-btn" @click="doAccept">采纳并填入</button>
          </div>
          <div class="chat-messages" ref="chatMsgs">
            <div v-if="currentMessages.length === 0 && !streaming && !streamDone" class="chat-init">
              <p>AI 将基于你已填写的信息，主动引导你完成「{{ currentField.label || currentField.key }}」字段。</p>
              <button class="btn primary" @click="startChat">开始对话</button>
            </div>
            <div v-for="(msg, i) in currentMessages" :key="'msg'+i" :class="['msg-row', msg.role]">
              <div class="msg-avatar"><VIcon :icon="msg.role==='user'?'mdi:account-circle':'mdi:robot-outline'" /></div>
              <div class="msg-bubble"><div class="msg-text" v-html="renderMsg(msg.content)"></div></div>
            </div>
            <!-- 流式进行中 -->
            <div v-if="streaming" class="msg-row assistant">
              <div class="msg-avatar"><VIcon icon="mdi:robot-outline" /></div>
              <div class="msg-bubble"><div class="msg-text">{{ streamText }}<span class="cursor">|</span></div></div>
            </div>
            <!-- 流式完成后，仍然显示 AI 消息（未被采纳前） -->
            <div v-if="!streaming && streamDone && streamText" class="msg-row assistant">
              <div class="msg-avatar"><VIcon icon="mdi:robot-outline" /></div>
              <div class="msg-bubble"><div class="msg-text" v-html="renderMsg(streamText)"></div></div>
            </div>
          </div>
          <div class="chat-input-area">
            <div v-if="!streaming && streamDone && streamText" class="modify-row">
              <input v-model="modifyInput" placeholder="需要修改什么？按 Enter 发送" @keyup.enter="requestModify" class="modify-input" />
              <button class="btn outline" @click="requestModify" :disabled="!modifyInput.trim()"><VIcon icon="mdi:send" /></button>
            </div>
            <div v-else-if="!streaming" class="input-row">
              <textarea v-model="userInput" :placeholder="'描述你的相关经历...'" rows="2" @keyup.ctrl.enter="sendMessage"></textarea>
              <button class="btn primary" @click="sendMessage" :disabled="!userInput.trim()||streaming"><VIcon icon="mdi:send" /></button>
            </div>
            <div v-if="streaming" class="streaming-hint">AI 正在生成...</div>
          </div>
        </div>
      </main>
    </div>
  </div>

  <!-- Delete Modal -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="deleteTarget" class="modal-overlay" @click.self="deleteTarget = null">
        <div class="modal-card">
          <div class="modal-icon-wrap"><VIcon icon="mdi:alert-circle-outline" class="modal-icon" /></div>
          <h3>确认删除对话</h3>
          <p>将删除「<strong>{{ deleteTarget.template_name || '未命名' }}</strong>」的对话记录和生成文件，不可撤销。</p>
          <div class="modal-actions">
            <button class="btn outline" @click="deleteTarget = null">取消</button>
            <button class="btn danger" :disabled="deleting" @click="doDeleteSession">
              <span v-if="deleting" class="spinner"></span>{{ deleting ? '删除中...' : '确认删除' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, nextTick } from 'vue'
import * as api from '../../api/zongce'
import { useUserStore } from '../../stores/user'

const userStore = useUserStore()

// ---- View ----
const view = ref('history')

// ---- History ----
const sessions = ref([])
const sessionsLoading = ref(false)
const currentPage = ref(1)
const pageSize = ref(10)
const totalSessions = ref(0)
const totalPages = ref(0)
const deleteTarget = ref(null)
const deleting = ref(false)

// ---- New Session ----
const file = ref(null)
const creating = ref(false)
const errorMsg = ref('')
const session = ref(null)
const fields = ref([])
const currentField = ref(null)
const simpleValue = ref('')
const currentMessages = ref([])
const userInput = ref('')
const modifyInput = ref('')
const streamText = ref('')
const streaming = ref(false)
const streamDone = ref(false)
const filling = ref(false)
const chatMsgs = ref(null)

// Bug 2 修复：统一基本信息表单
const simpleFieldValues = reactive({})
const fieldSavedFlags = reactive({})

// ---- Computed ----
const simpleFields = computed(() => fields.value.filter(f => f.type === 'simple'))

const allFieldsDone = computed(() => {
  const f = fields.value
  return f.length > 0 && f.every(x => x.value)
})

const hasSimpleChanges = computed(() => {
  return simpleFields.value.some(f => {
    const currentVal = simpleFieldValues[f.key] || ''
    return currentVal !== (f.value || '')
  })
})

// ---- Helpers ----
const statusLabels = { analyzed: '已分析', filling: '填写中', completed: '已完成' }
function statusLabel(s) { return statusLabels[s] || s }
function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts), now = new Date(), diff = now - d
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}
function renderMsg(t) { return (t || '').replace(/\n/g, '<br>') }

// ====== HISTORY ======
function switchToHistory() { view.value = 'history'; fetchSessions() }
function backToHistory() { resetAll(); switchToHistory() }

async function fetchSessions() {
  sessionsLoading.value = true
  try {
    const res = await api.chatFillList(currentPage.value, pageSize.value)
    if (res.code === 200) {
      sessions.value = res.data.list || []
      totalSessions.value = res.data.pagination?.total || 0
      totalPages.value = res.data.pagination?.totalPages || 0
    }
  } catch (e) { console.error('加载历史失败:', e) }
  finally { sessionsLoading.value = false }
}

function changePage(dir) { currentPage.value += dir; fetchSessions() }

function openSession(s) {
  resetAll()
  session.value = { id: s.id, templateName: s.template_name }
  view.value = 'new'
  loadSession(s.id)
}

async function loadSession(sid) {
  try {
    const res = await api.chatFillGetSession(sid)
    if (res.code === 200) {
      const data = res.data
      // data 是 session 对象，fields 可能在 data.fields 或需要从 fields_json 解析
      let loaded = data.fields || []
      if (!loaded.length && data.fields_json) {
        try { loaded = JSON.parse(data.fields_json); } catch (e) {}
      }
      fields.value = loaded
      // 初始化 simple 字段值到表单
      for (const f of loaded) {
        if (f.type === 'simple') {
          simpleFieldValues[f.key] = f.value || ''
          fieldSavedFlags[f.key] = !!f.value
        }
      }
    }
  } catch (e) { console.error('加载会话失败:', e) }
}

function confirmDeleteSession(s) { deleteTarget.value = s }

async function doDeleteSession() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await api.chatFillDelete(deleteTarget.value.id)
    deleteTarget.value = null
    fetchSessions()
  } catch (e) {
    alert('删除失败: ' + (e?.response?._data?.msg || e.message))
  } finally { deleting.value = false }
}

async function downloadResult(s) {
  try {
    const blob = await api.chatFillDownload(s.id)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = (s.template_name || '结果').replace(/\.docx$/i, '') + '_已填写.docx'
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  } catch (e) { alert('下载失败') }
}

// ====== NEW SESSION ======
function onFileSelect(e) { file.value = e.target.files[0] || null }
function onFileDrop(e) { file.value = e.dataTransfer.files[0] || null }

async function doCreate() {
  if (!file.value) return
  creating.value = true; errorMsg.value = ''
  const fd = new FormData(); fd.append('file', file.value)
  try {
    const res = await api.chatFillCreate(fd)
    if (res.code === 200) {
      session.value = { id: res.data.sessionId, templateName: res.data.templateName }
      const loaded = res.data.fields || []
      fields.value = loaded
      for (const f of loaded) {
        if (f.type === 'simple') {
          simpleFieldValues[f.key] = f.value || ''
          fieldSavedFlags[f.key] = !!f.value
        }
      }
    } else { errorMsg.value = res.msg }
  } catch (e) { errorMsg.value = e.message || '上传失败' }
  finally { creating.value = false }
}

// Bug 2: 统一保存/单字段保存
async function saveSingleField(key) {
  const val = simpleFieldValues[key] || ''
  if (!val.trim()) return
  try {
    const res = await api.chatFillSaveSimpleField(session.value.id, { [key]: val.trim() })
    if (res.code === 200) syncFieldsFromResponse(res)
    fieldSavedFlags[key] = true
    setTimeout(() => { fieldSavedFlags[key] = false }, 2000)
  } catch (e) { console.error('保存失败:', e) }
}

async function saveAllSimple() {
  const vals = {}
  for (const f of simpleFields.value) {
    const v = (simpleFieldValues[f.key] || '').trim()
    if (v && v !== (f.value || '')) vals[f.key] = v
  }
  if (!Object.keys(vals).length) return
  try {
    const res = await api.chatFillSaveSimpleField(session.value.id, vals)
    if (res.code === 200) {
      syncFieldsFromResponse(res)
      for (const k of Object.keys(vals)) {
        fieldSavedFlags[k] = true
        setTimeout(() => { fieldSavedFlags[k] = false }, 2000)
      }
    }
  } catch (e) { alert('保存失败') }
}

function syncFieldsFromResponse(res) {
  // res.data 可能是数组（fields）或包含 fields 的对象
  const data = res.data
  if (Array.isArray(data)) {
    fields.value = data
  } else if (data && data.fields) {
    fields.value = data.fields
  } else if (data && Array.isArray(data.list)) {
    fields.value = data.list
  }
  // 同步回 simpleFieldValues
  for (const f of fields.value) {
    if (f.type === 'simple' && f.value !== undefined) {
      simpleFieldValues[f.key] = f.value
    }
  }
}

function selectField(f) {
  currentField.value = f
  if (f.type === 'simple' || f.type === 'image') {
    simpleValue.value = f.value || ''
    return
  }
  // narrative
  loadMessages(f.key)
  streamText.value = ''; streaming.value = false; streamDone.value = false
}

async function loadMessages(fieldKey) {
  if (!session.value?.id) { currentMessages.value = []; return }
  try {
    const res = await api.chatFillGetMessages(session.value.id, fieldKey)
    if (res.code === 200) currentMessages.value = res.data || []
  } catch (e) { currentMessages.value = [] }
}

// 兼容旧的逐个字段保存
async function saveSimple() {
  if (!simpleValue.value.trim() || !currentField.value) return
  const vals = { [currentField.value.key]: simpleValue.value.trim() }
  try {
    const res = await api.chatFillSaveSimpleField(session.value.id, vals)
    if (res.code === 200) {
      syncFieldsFromResponse(res)
      currentField.value = fields.value.find(f => f.key === currentField.value.key) || currentField.value
    }
  } catch (e) { alert('保存失败') }
}

// ====== CHAT ======
async function startChat() { await sendStream() }

async function sendMessage() {
  if (!userInput.value.trim() || streaming.value) return
  currentMessages.value.push({ role: 'user', content: userInput.value.trim() })
  userInput.value = ''
  await sendStream()
}

async function requestModify() {
  if (!modifyInput.value.trim()) return
  currentMessages.value.push({ role: 'user', content: '请修改：' + modifyInput.value.trim() })
  modifyInput.value = ''
  await sendStream()
}

async function sendStream() {
  streaming.value = true; streamDone.value = false; streamText.value = ''
  try {
    const simpleFieldsObj = {}
    fields.value.filter(f => f.type === 'simple' && f.value).forEach(f => { simpleFieldsObj[f.key] = f.value })

    const res = await fetch('/api/zongce/chat-fill/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + userStore.token },
      body: JSON.stringify({
        sessionId: session.value.id, fieldKey: currentField.value.key,
        fieldLabel: currentField.value.label, fieldHint: currentField.value.hint,
        messages: currentMessages.value, simpleFields: simpleFieldsObj,
      }),
    })
    if (!res.ok) { streaming.value = false; return }
    const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      const lines = buf.split('\n'); buf = lines.pop() || ''
      for (const l of lines) {
        if (!l.startsWith('data: ')) continue
        const d = l.slice(6).trim()
        if (d === '[DONE]') {
          streaming.value = false; streamDone.value = true
          // Bug 1 修复：流式完成后自动保存到 currentMessages
          if (streamText.value.trim()) {
            currentMessages.value.push({ role: 'assistant', content: streamText.value.trim() })
          }
          await nextTick()
          if (chatMsgs.value) chatMsgs.value.scrollTop = chatMsgs.value.scrollHeight
          return
        }
        try { const p = JSON.parse(d); if (p.token) streamText.value += p.token } catch (e) {}
      }
    }
    streaming.value = false; streamDone.value = true
  } catch (e) { streaming.value = false; streamDone.value = true }
}

async function doAccept() {
  const content = streamText.value.trim()
  if (!content || !currentField.value) return
  try {
    const res = await api.chatFillAcceptContent(session.value.id, currentField.value.key, content)
    if (res.code === 200) {
      syncFieldsFromResponse(res)
      currentField.value = fields.value.find(f => f.key === currentField.value.key) || currentField.value
      streamText.value = ''; streamDone.value = false
    }
  } catch (e) { alert('填入失败') }
}

// ====== FILL ======
async function doFill() {
  filling.value = true
  try {
    const fillRes = await api.chatFillDoFill(session.value.id)
    if (fillRes.code === 200) {
      const blob = await api.chatFillDownload(session.value.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = (session.value.templateName || '结果').replace(/\.docx$/i, '') + '_已填写.docx'
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
    }
  } catch (e) { alert('生成失败: ' + (e?.response?._data?.msg || e.message)) }
  finally { filling.value = false }
}

function resetAll() {
  session.value = null; fields.value = []; currentField.value = null
  file.value = null; errorMsg.value = ''
  simpleValue.value = ''; currentMessages.value = []
  streamText.value = ''; streaming.value = false; streamDone.value = false
  Object.keys(simpleFieldValues).forEach(k => delete simpleFieldValues[k])
  Object.keys(fieldSavedFlags).forEach(k => delete fieldSavedFlags[k])
}

onMounted(() => { fetchSessions() })
</script>

<style scoped>
.chatfill-page { max-width: 1000px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; }
.page-title { font-size: 26px; font-weight: 700; margin: 0; color: var(--color-text); letter-spacing: -0.02em; }
.page-desc { font-size: 14px; color: var(--color-text-tertiary); margin: 4px 0 0; }

.tab-bar { display: flex; gap: 4px; padding: 4px; background: var(--color-surface-variant); border: 1px solid var(--color-border); border-radius: 12px; width: fit-content; }
.tab { display: inline-flex; align-items: center; gap: 8px; padding: 9px 20px; border: none; border-radius: 9px; background: transparent; color: var(--color-text-secondary); font-size: 14px; font-weight: 500; font-family: inherit; cursor: pointer; transition: all 0.2s ease; }
.tab:hover { color: var(--color-text); background: var(--color-surface); }
.tab.active { background: var(--color-surface); color: #4F46E5; box-shadow: 0 1px 3px rgba(0,0,0,0.08); font-weight: 600; }
.tab-count { min-width: 20px; height: 20px; padding: 0 6px; border-radius: 10px; font-size: 11px; font-weight: 700; background: #4F46E5; color: #fff; display: inline-flex; align-items: center; justify-content: center; }

.skeleton-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
.skeleton-card { height: 150px; border-radius: 14px; background: var(--color-surface-variant); animation: shimmer 1.5s infinite; }
@keyframes shimmer { 0%{opacity:0.5} 50%{opacity:0.8} 100%{opacity:0.5} }

.empty-state { display: flex; flex-direction: column; align-items: center; padding: 64px 24px; text-align: center; gap: 16px; }
.empty-icon-wrap { width: 80px; height: 80px; border-radius: 50%; background: var(--color-surface-variant); display: flex; align-items: center; justify-content: center; }
.empty-icon { font-size: 40px; color: var(--color-text-tertiary); }
.empty-state h3 { margin: 0; font-size: 18px; color: var(--color-text); font-weight: 600; }
.empty-state p { margin: 0; font-size: 14px; color: var(--color-text-tertiary); max-width: 400px; line-height: 1.6; }

.session-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
.session-card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 14px; padding: 18px; cursor: pointer; display: flex; flex-direction: column; gap: 12px; transition: all 0.2s cubic-bezier(0.22, 1, 0.36, 1); }
.session-card:hover { transform: translateY(-3px); box-shadow: 0 8px 25px rgba(0,0,0,0.1); }
.sc-top { display: flex; justify-content: space-between; align-items: center; }
.sc-status { display: inline-flex; align-items: center; gap: 6px; padding: 3px 12px; border-radius: 100px; font-size: 12px; font-weight: 600; }
.sc-dot { width: 7px; height: 7px; border-radius: 50%; }
.sc-status.analyzed { background: #eef2ff; color: #4F46E5; } .sc-status.analyzed .sc-dot { background: #4F46E5; }
.sc-status.filling { background: #fff3e0; color: #E37400; } .sc-status.filling .sc-dot { background: #E37400; animation: pulse 1.5s infinite; }
.sc-status.completed { background: #e8f5e9; color: #34A853; } .sc-status.completed .sc-dot { background: #34A853; }
@keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.3} }
.sc-time { font-size: 12px; color: var(--color-text-tertiary); }
.sc-body { display: flex; flex-direction: column; gap: 6px; }
.sc-name { display: flex; align-items: center; gap: 6px; font-size: 15px; font-weight: 600; color: var(--color-text); }
.sc-meta { font-size: 13px; color: var(--color-text-tertiary); display: flex; gap: 12px; }
.sc-meta span { display: inline-flex; align-items: center; gap: 4px; }
.sc-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: auto; padding-top: 8px; border-top: 1px solid var(--color-border); }
.icon-btn { width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-secondary); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; font-size: 18px; transition: all 0.15s ease; }
.icon-btn:hover { background: var(--color-surface-variant); color: var(--color-text); }
.icon-btn.danger:hover { background: #fce8e6; color: #D93025; border-color: #f5c6cb; }

.pagination { display: flex; align-items: center; justify-content: center; gap: 16px; padding-top: 8px; }
.page-btn { width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
.page-btn:hover:not(:disabled) { background: var(--color-surface-variant); border-color: #4F46E5; }
.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.page-info { font-size: 14px; color: var(--color-text-secondary); font-weight: 500; }

.card { background: var(--color-surface); border-radius: 14px; border: 1px solid var(--color-border); padding: 24px; display: flex; flex-direction: column; gap: 16px; }
.upload-card { max-width: 560px; margin: 20px auto; }
.upload-zone { border: 2px dashed var(--color-border); border-radius: 14px; padding: 48px 24px; text-align: center; cursor: pointer; transition: all 0.2s ease; display: flex; flex-direction: column; align-items: center; gap: 12px; }
.upload-zone:hover { border-color: #4F46E5; background: var(--color-surface-variant); }
.upload-icon-wrap { width: 64px; height: 64px; border-radius: 50%; background: var(--color-surface-variant); display: flex; align-items: center; justify-content: center; }
.upload-icon { font-size: 32px; color: var(--color-text-tertiary); }
.upload-zone strong { font-size: 16px; color: var(--color-text); }
.upload-zone p { font-size: 13px; color: var(--color-text-tertiary); margin: 0; max-width: 360px; }

.fill-layout { display: grid; grid-template-columns: 260px 1fr; gap: 20px; min-height: 520px; }
.field-panel { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 14px; display: flex; flex-direction: column; overflow: hidden; }
.panel-header { display: flex; align-items: center; justify-content: space-between; padding: 16px; border-bottom: 1px solid var(--color-border); }
.panel-header h4 { margin: 0; font-size: 14px; color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.btn-back { width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-secondary); cursor: pointer; display: flex; align-items: center; justify-content: center; }
.btn-back:hover { background: var(--color-surface-variant); }
.field-list { flex: 1; overflow-y: auto; padding: 8px; }
.field-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; cursor: pointer; font-size: 13px; transition: all 0.15s ease; }
.field-item:hover { background: var(--color-surface-variant); }
.field-item.active { background: #eef2ff; color: #4F46E5; font-weight: 600; }
.field-item.done { opacity: 0.6; }
.field-type-icon { width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px; color: var(--color-text-tertiary); flex-shrink: 0; }
.field-item.active .field-type-icon { color: #4F46E5; }
.field-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.field-done-icon { font-size: 18px; color: #34A853; flex-shrink: 0; }
.panel-footer { padding: 12px; border-top: 1px solid var(--color-border); }

.content-area { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 14px; overflow: hidden; display: flex; flex-direction: column; }

/* Bug 2: 基本信息统一表单 */
.info-form { margin: 0; border: none; border-radius: 0; }
.form-header { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 600; color: var(--color-text); }
.form-hint { margin: 0; font-size: 13px; color: var(--color-text-tertiary); }
.form-empty { font-size: 13px; color: var(--color-text-tertiary); padding: 20px 0; }
.narrative-color { color: #7B1FA2; font-weight: 600; }
.form-row { display: flex; flex-direction: column; gap: 6px; }
.form-label { font-size: 13px; font-weight: 500; color: var(--color-text-secondary); }
.form-input-row { display: flex; align-items: center; gap: 8px; }
.saved-icon { color: #34A853; font-size: 20px; flex-shrink: 0; transition: opacity 0.3s; }

.simple-form { margin: 0; border: none; border-radius: 0; }
.field-type-badge { padding: 2px 10px; border-radius: 100px; font-size: 11px; font-weight: 600; background: #eef2ff; color: #4F46E5; }
.field-type-badge.narrative { background: #f3e5f5; color: #7B1FA2; }
.simple-input { width: 100%; padding: 10px 14px; border: 1px solid var(--color-border); border-radius: 10px; font-size: 14px; font-family: inherit; background: var(--color-surface); color: var(--color-text); box-sizing: border-box; }
.simple-input:focus { outline: none; border-color: #4F46E5; }

.chat-panel { display: flex; flex-direction: column; height: 100%; min-height: 450px; }
.chat-header { display: flex; align-items: center; gap: 8px; padding: 14px 16px; border-bottom: 1px solid var(--color-border); font-size: 15px; font-weight: 600; color: var(--color-text); }
.accept-btn { padding: 5px 14px !important; font-size: 12px !important; background: #34A853; color: #fff; margin-left: auto; }
.chat-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 14px; max-height: 400px; }
.chat-init { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 20px; text-align: center; }
.chat-init p { font-size: 14px; color: var(--color-text-secondary); max-width: 400px; line-height: 1.6; margin: 0; }
.msg-row { display: flex; gap: 10px; max-width: 82%; }
.msg-row.user { align-self: flex-end; flex-direction: row-reverse; }
.msg-row.assistant { align-self: flex-start; }
.msg-avatar { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; background: var(--color-surface-variant); flex-shrink: 0; color: var(--color-text-tertiary); }
.msg-row.user .msg-avatar { background: #eef2ff; color: #4F46E5; }
.msg-bubble { padding: 10px 14px; border-radius: 14px; font-size: 14px; line-height: 1.6; }
.msg-row.user .msg-bubble { background: #4F46E5; color: #fff; border-bottom-right-radius: 4px; }
.msg-row.assistant .msg-bubble { background: var(--color-surface-variant); color: var(--color-text); border-bottom-left-radius: 4px; }
.cursor { animation: blink 1s infinite; color: #4F46E5; font-weight: 700; }
@keyframes blink { 0%,100%{opacity:1}50%{opacity:0} }

.chat-input-area { border-top: 1px solid var(--color-border); padding: 12px 16px; }
.modify-row { display: flex; gap: 8px; }
.modify-input { flex: 1; padding: 9px 14px; border: 1px solid var(--color-border); border-radius: 10px; font-size: 13px; font-family: inherit; background: var(--color-surface); color: var(--color-text); }
.input-row { display: flex; gap: 8px; align-items: flex-end; }
.input-row textarea { flex: 1; padding: 9px 14px; border: 1px solid var(--color-border); border-radius: 10px; font-size: 14px; resize: none; font-family: inherit; background: var(--color-surface); color: var(--color-text); }
.streaming-hint { font-size: 12px; color: var(--color-text-tertiary); text-align: center; padding: 8px; }

.btn { padding: 10px 22px; border: none; border-radius: 10px; cursor: pointer; font-size: 14px; font-weight: 600; display: inline-flex; align-items: center; gap: 7px; font-family: inherit; transition: all 0.15s ease; }
.btn:disabled { opacity: 0.55; cursor: not-allowed; }
.btn.primary { background: #4F46E5; color: #fff; }
.btn.primary:hover:not(:disabled) { background: #4338CA; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(79,70,229,0.3); }
.btn.success { background: #34A853; color: #fff; }
.btn.success:hover:not(:disabled) { background: #2E7D32; }
.btn.danger { background: #D93025; color: #fff; }
.btn.outline { background: transparent; color: var(--color-text); border: 1px solid var(--color-border); }
.btn.outline:hover:not(:disabled) { background: var(--color-surface-variant); }
.btn.large { padding: 12px 32px; font-size: 16px; }
.btn.full { width: 100%; justify-content: center; }

.error-msg { padding: 10px 14px; background: #fce8e6; border: 1px solid #f5c6cb; border-radius: 8px; color: #D93025; font-size: 13px; }
.spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to{transform:rotate(360deg)} }

.modal-overlay { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.45); backdrop-filter: blur(4px); }
.modal-card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 18px; padding: 32px; max-width: 420px; width: 90%; display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
.modal-icon-wrap { width: 56px; height: 56px; border-radius: 50%; background: #fce8e6; display: flex; align-items: center; justify-content: center; }
.modal-icon { font-size: 30px; color: #D93025; }
.modal-card h3 { margin: 0; font-size: 18px; color: var(--color-text); }
.modal-card p { margin: 0; font-size: 14px; color: var(--color-text-secondary); line-height: 1.6; }
.modal-actions { display: flex; gap: 12px; margin-top: 4px; }
.modal-enter-active,.modal-leave-active { transition: opacity 0.2s ease; }
.modal-enter-active .modal-card,.modal-leave-active .modal-card { transition: transform 0.25s cubic-bezier(0.22,1,0.36,1),opacity 0.2s ease; }
.modal-enter-from,.modal-leave-to { opacity: 0; }
.modal-enter-from .modal-card,.modal-leave-to .modal-card { transform: scale(0.92); opacity: 0; }

@media (max-width: 768px) {
  .fill-layout { grid-template-columns: 1fr; }
  .session-grid { grid-template-columns: 1fr; }
  .tab-bar { width: 100%; }
  .tab { flex: 1; justify-content: center; }
  .upload-card { max-width: 100%; }
}
</style>
