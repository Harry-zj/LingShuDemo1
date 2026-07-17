<template>
<div class="batch-page">
  <!-- 页面头部 -->
  <header class="batch-header">
    <div class="header-left">
      <h2 class="page-title">批量填表</h2>
      <p class="page-desc">上传 Excel 和 Word 模板，AI 自动映射，一键批量生成</p>
    </div>
  </header>

  <!-- Tab 切换 -->
  <div class="tab-bar">
    <button class="tab" :class="{ active: activeTab === 'history' }" @click="switchTab('history')">
      <VIcon icon="mdi:history" />
      <span>历史记录</span>
      <span v-if="total > 0" class="tab-count">{{ total }}</span>
    </button>
    <button class="tab" :class="{ active: activeTab === 'new' }" @click="switchTab('new')">
      <VIcon icon="mdi:plus-circle-outline" />
      <span>新建任务</span>
    </button>
  </div>

  <!-- ====================== 历史记录 Tab ====================== -->
  <div v-if="activeTab === 'history'" class="history-view">
    <!-- 加载中 -->
    <div v-if="loading" class="skeleton-list">
      <div v-for="i in 3" :key="i" class="skeleton-card"></div>
    </div>

    <!-- 空状态 -->
    <div v-else-if="tasks.length === 0" class="empty-state">
      <div class="empty-icon-wrap">
        <VIcon icon="mdi:file-document-outline" class="empty-icon" />
      </div>
      <h3>暂无批量填表记录</h3>
      <p>上传 Excel 和 Word 模板，AI 自动映射列，一键批量生成每个人的文档</p>
      <button class="btn primary" @click="switchTab('new')">
        <VIcon icon="mdi:plus" /> 创建第一个任务
      </button>
    </div>

    <!-- 任务卡片列表 -->
    <div v-else class="task-grid">
      <div v-for="task in tasks" :key="task.id" class="task-card" @click="viewTask(task)">
        <!-- 状态标签 -->
        <div class="task-top">
          <span class="status-badge" :class="task.status">
            <span class="status-dot"></span>
            {{ statusLabel(task.status) }}
          </span>
          <span class="task-time">{{ formatTime(task.created_at) }}</span>
        </div>

        <!-- 文件信息 -->
        <div class="task-body">
          <div class="file-tags">
            <span class="file-tag">
              <VIcon icon="mdi:file-excel-outline" />
              <span class="file-name">{{ task.excel_name || '数据文件' }}</span>
            </span>
            <span class="file-tag">
              <VIcon icon="mdi:file-word-outline" />
              <span class="file-name">{{ task.template_name || '模板文件' }}</span>
            </span>
          </div>

          <!-- 统计数据 -->
          <div class="task-stats">
            <span class="stat-item">
              <VIcon icon="mdi:table-rows" />
              {{ task.total_rows || 0 }} 行
            </span>
            <template v-if="task.status === 'completed'">
              <span class="stat-divider"></span>
              <span class="stat-item success">
                <VIcon icon="mdi:check-circle-outline" />
                {{ task.success_count || 0 }}
              </span>
              <span v-if="task.fail_count > 0" class="stat-item fail">
                <VIcon icon="mdi:close-circle-outline" />
                {{ task.fail_count }}
              </span>
            </template>
          </div>
        </div>

        <!-- 操作区 -->
        <div class="task-actions" @click.stop>
          <button
            v-if="task.status === 'completed'"
            class="icon-btn"
            title="下载结果"
            @click="downloadTask(task)"
          >
            <VIcon icon="mdi:download" />
          </button>
          <button
            class="icon-btn danger"
            title="删除任务"
            @click="confirmDelete(task)"
          >
            <VIcon icon="mdi:delete-outline" />
          </button>
        </div>
      </div>
    </div>

    <!-- 分页 -->
    <div v-if="totalPages > 1" class="pagination">
      <button
        class="page-btn"
        :disabled="currentPage <= 1"
        @click="changePage(-1)"
      >
        <VIcon icon="mdi:chevron-left" />
      </button>
      <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
      <button
        class="page-btn"
        :disabled="currentPage >= totalPages"
        @click="changePage(1)"
      >
        <VIcon icon="mdi:chevron-right" />
      </button>
    </div>
  </div>

  <!-- ====================== 新建任务 Tab ====================== -->
  <div v-if="activeTab === 'new'" class="wizard-view">
    <!-- 步骤条 -->
    <div class="step-bar">
      <div class="step" :class="{ active: step >= 1, done: step > 1 }">
        <span class="step-num">
          <VIcon v-if="step > 1" icon="mdi:check" />
          <span v-else>1</span>
        </span>
        <span class="step-label">上传文件</span>
      </div>
      <div class="step-line" :class="{ active: step > 1 }"></div>
      <div class="step" :class="{ active: step >= 2, done: step > 2 }">
        <span class="step-num">
          <VIcon v-if="step > 2" icon="mdi:check" />
          <span v-else>2</span>
        </span>
        <span class="step-label">AI 映射</span>
      </div>
      <div class="step-line" :class="{ active: step > 2 }"></div>
      <div class="step" :class="{ active: step >= 3 }">
        <span class="step-num">3</span>
        <span class="step-label">下载结果</span>
      </div>
    </div>

    <!-- Step 1: 上传 -->
    <div v-if="step === 1" class="card upload-card">
      <div class="upload-grid">
        <div
          class="upload-zone"
          :class="{ done: excelFile }"
          @click="$refs.excelInput.click()"
          @dragover.prevent
          @drop.prevent="onExcelDrop"
        >
          <div class="upload-icon-wrap">
            <VIcon :icon="excelFile ? 'mdi:file-excel' : 'mdi:cloud-upload-outline'" class="upload-icon" />
          </div>
          <div v-if="!excelFile">
            <strong>上传 Excel 数据文件</strong>
            <p>拖拽或点击上传 .xlsx / .xls</p>
          </div>
          <div v-else>
            <strong>{{ excelFile.name }}</strong>
            <p>{{ formatSize(excelFile.size) }}</p>
          </div>
          <input ref="excelInput" type="file" hidden accept=".xlsx,.xls" @change="onExcelSelect">
        </div>

        <div
          class="upload-zone"
          :class="{ done: templateFile }"
          @click="$refs.tplInput.click()"
          @dragover.prevent
          @drop.prevent="onTplDrop"
        >
          <div class="upload-icon-wrap">
            <VIcon :icon="templateFile ? 'mdi:file-word' : 'mdi:cloud-upload-outline'" class="upload-icon" />
          </div>
          <div v-if="!templateFile">
            <strong>上传 Word 模板</strong>
            <p>拖拽或点击上传 .docx</p>
          </div>
          <div v-else>
            <strong>{{ templateFile.name }}</strong>
            <p>{{ formatSize(templateFile.size) }}</p>
          </div>
          <input ref="tplInput" type="file" hidden accept=".docx" @change="onTplSelect">
        </div>
      </div>

      <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>

      <button
        class="btn primary large full"
        :disabled="!excelFile || !templateFile || uploading"
        @click="doUpload"
      >
        <span v-if="uploading" class="spinner"></span>
        {{ uploading ? '解析中...' : '开始解析' }}
      </button>
    </div>

    <!-- Step 2: AI 列映射 -->
    <div v-if="step === 2" class="card mapping-card">
      <div class="mapping-header">
        <h3>AI 列映射</h3>
        <p class="hint">共 {{ taskData?.totalRows || 0 }} 行数据，请确认或调整以下映射</p>
      </div>

      <div class="mapping-table">
        <div class="map-row map-head">
          <span>Excel 列名</span>
          <span class="map-arrow"></span>
          <span>Word 占位符</span>
          <span class="map-confidence">置信度</span>
        </div>
        <div v-for="(m, i) in mappings" :key="i" class="map-row">
          <span class="excel-col" :title="m.excelCol">{{ m.excelCol }}</span>
          <span class="map-arrow">
            <VIcon icon="mdi:arrow-right" />
          </span>
          <select v-model="m.placeholder" class="ph-select">
            <option :value="null">— 不映射 —</option>
            <option v-for="ph in taskData?.placeholders" :key="ph" :value="ph">
              {{ '{' + ph + '}' }}
            </option>
          </select>
          <span class="map-confidence">
            <span
              class="confidence-badge"
              :class="m.confidence >= 0.8 ? 'high' : m.confidence >= 0.5 ? 'mid' : 'low'"
            >
              {{ (m.confidence * 100).toFixed(0) }}%
            </span>
          </span>
        </div>
      </div>

      <div class="btn-row">
        <button class="btn outline" @click="step = 1">返回修改文件</button>
        <button
          class="btn primary large"
          :disabled="executing"
          @click="doExecute"
        >
          <span v-if="executing" class="spinner"></span>
          {{ executing ? '正在生成...' : '生成 ' + (taskData?.totalRows || 0) + ' 份文档' }}
        </button>
      </div>
    </div>

    <!-- Step 3: 下载结果 -->
    <div v-if="step === 3" class="card result-card">
      <div v-if="result" class="result-content">
        <div class="result-summary" :class="result.successCount === result.total ? 'all-ok' : 'partial'">
          <div class="result-icon-wrap">
            <VIcon :icon="result.successCount === result.total ? 'mdi:check-circle' : 'mdi:alert-circle'" class="result-icon" />
          </div>
          <div class="result-info">
            <h3>{{ result.successCount === result.total ? '全部生成成功' : '部分生成成功' }}</h3>
            <p>
              成功 <strong>{{ result.successCount }}</strong> /
              共 <strong>{{ result.total }}</strong> 份
              <span v-if="result.failCount > 0">，失败 {{ result.failCount }} 份</span>
            </p>
          </div>
        </div>

        <div class="btn-row">
          <button class="btn outline" @click="resetWizard">重新开始</button>
          <button
            v-if="result.downloadReady"
            class="btn success large"
            @click="doDownload"
          >
            <VIcon icon="mdi:download" />
            下载 ZIP
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- ====================== 删除确认弹窗 ====================== -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="deleteTarget" class="modal-overlay" @click.self="deleteTarget = null">
        <div class="modal-card">
          <div class="modal-icon-wrap">
            <VIcon icon="mdi:alert-circle-outline" class="modal-icon" />
          </div>
          <h3 class="modal-title">确认删除任务</h3>
          <p class="modal-desc">
            将删除任务"<strong>{{ deleteTarget.excel_name || '未命名' }}</strong>"及其所有生成文件，此操作不可撤销。
          </p>
          <div class="modal-meta" v-if="deleteTarget.created_at">
            <span>
              <VIcon icon="mdi:calendar-blank-outline" />
              {{ formatTime(deleteTarget.created_at) }}
            </span>
            <span>
              <VIcon icon="mdi:table-rows" />
              {{ deleteTarget.total_rows || 0 }} 行
            </span>
          </div>
          <div class="modal-actions">
            <button class="btn outline" @click="deleteTarget = null">取消</button>
            <button class="btn danger" :disabled="deleting" @click="doDelete">
              <span v-if="deleting" class="spinner"></span>
              {{ deleting ? '删除中...' : '确认删除' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import * as api from '../../api/zongce'

// ---- Tab & View ----
const activeTab = ref('history')

// ---- History State ----
const tasks = ref([])
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)
const totalPages = ref(0)

// ---- Delete State ----
const deleteTarget = ref(null)
const deleting = ref(false)

// ---- Wizard State ----
const step = ref(1)
const excelFile = ref(null)
const templateFile = ref(null)
const uploading = ref(false)
const executing = ref(false)
const errorMsg = ref('')
const taskData = ref(null)
const result = ref(null)
const mappings = ref([])

// ============ Computed ============
const statusLabels = {
  uploaded: '已上传',
  mapped: '已映射',
  processing: '处理中',
  completed: '已完成',
}

function statusLabel(s) {
  return statusLabels[s] || s
}

function formatSize(b) {
  if (!b) return ''
  if (b < 1024) return b + ' B'
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'
  return (b / 1048576).toFixed(1) + ' MB'
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前'
  if (diff < 2592000000) return Math.floor(diff / 86400000) + ' 天前'
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

// ============ History ============
async function fetchTasks() {
  loading.value = true
  try {
    const res = await api.batchListTasks(currentPage.value, pageSize.value)
    if (res.code === 200) {
      tasks.value = res.data.list || []
      total.value = res.data.pagination?.total || 0
      totalPages.value = res.data.pagination?.totalPages || 0
    }
  } catch (e) {
    console.error('获取历史列表失败:', e)
  } finally {
    loading.value = false
  }
}

function switchTab(tab) {
  activeTab.value = tab
  if (tab === 'history') {
    fetchTasks()
  }
}

function changePage(dir) {
  currentPage.value += dir
  fetchTasks()
}

function confirmDelete(task) {
  deleteTarget.value = { ...task }
}

async function doDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    const res = await api.batchDeleteTask(deleteTarget.value.id)
    if (res.code === 200) {
      deleteTarget.value = null
      fetchTasks()
    } else {
      alert('删除失败：' + res.msg)
    }
  } catch (e) {
    alert('删除失败：' + (e?.response?._data?.msg || e.message))
  } finally {
    deleting.value = false
  }
}

async function downloadTask(task) {
  try {
    const blob = await api.batchDownloadResult(task.id)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '批量填表结果_' + (task.excel_name || task.id) + '.zip'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (e) {
    const msg = e?.response?._data?.msg || e?.message || '下载失败'
    alert('下载失败：' + msg)
  }
}

// ============ Wizard (New Task) ============
function onExcelSelect(e) { excelFile.value = e.target.files[0] || null }
function onTplSelect(e) { templateFile.value = e.target.files[0] || null }
function onExcelDrop(e) { excelFile.value = e.dataTransfer.files[0] || null }
function onTplDrop(e) { templateFile.value = e.dataTransfer.files[0] || null }

async function doUpload() {
  if (!excelFile.value || !templateFile.value) return
  uploading.value = true
  errorMsg.value = ''
  const fd = new FormData()
  fd.append('excel', excelFile.value)
  fd.append('template', templateFile.value)
  try {
    const res = await api.batchUploadFiles(fd)
    if (res.code === 200) {
      taskData.value = res.data
      mappings.value = res.data.mappings.map(m => ({ ...m }))
      step.value = 2
    } else {
      errorMsg.value = res.msg
    }
  } catch (e) {
    errorMsg.value = e.message || '上传失败'
  } finally {
    uploading.value = false
  }
}

async function doExecute() {
  executing.value = true
  errorMsg.value = ''
  try {
    const res = await api.batchExecuteFill(taskData.value.taskId, mappings.value)
    if (res.code === 200) {
      result.value = res.data
      step.value = 3
    } else {
      errorMsg.value = res.msg
    }
  } catch (e) {
    errorMsg.value = e.message || '执行失败'
  } finally {
    executing.value = false
  }
}

async function doDownload() {
  try {
    const blob = await api.batchDownloadResult(taskData.value.taskId)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '批量填表结果.zip'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (e) {
    const msg = e?.response?._data?.msg || e?.message || '下载失败'
    alert('下载失败：' + msg)
  }
}

function resetWizard() {
  step.value = 1
  excelFile.value = null
  templateFile.value = null
  taskData.value = null
  result.value = null
  mappings.value = []
  errorMsg.value = ''
}

function viewTask(task) {
  // 切换到新建 tab 查看详情（可扩展为打开详情模态框）
  activeTab.value = 'new'
  resetWizard()
}

// ============ Lifecycle ============
onMounted(() => {
  fetchTasks()
})
</script>

<style scoped>
/* ---- Layout ---- */
.batch-page {
  max-width: 960px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* ---- Header ---- */
.batch-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}
.page-title {
  font-size: 26px;
  font-weight: 700;
  margin: 0;
  color: var(--color-text);
  letter-spacing: -0.02em;
}
.page-desc {
  font-size: 14px;
  color: var(--color-text-tertiary);
  margin: 4px 0 0;
}

/* ---- Tab Bar ---- */
.tab-bar {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: var(--color-surface-variant);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  width: fit-content;
}
.tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 20px;
  border: none;
  border-radius: 9px;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 14px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s ease;
}
.tab:hover {
  color: var(--color-text);
  background: var(--color-surface);
}
.tab.active {
  background: var(--color-surface);
  color: #4F46E5;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  font-weight: 600;
}
.tab-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 700;
  background: #4F46E5;
  color: #fff;
}

/* ---- Skeleton ---- */
.skeleton-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 16px;
}
.skeleton-card {
  height: 160px;
  border-radius: 14px;
  background: var(--color-surface-variant);
  animation: shimmer 1.5s infinite;
}
@keyframes shimmer {
  0% { opacity: 0.5; }
  50% { opacity: 0.8; }
  100% { opacity: 0.5; }
}

/* ---- Empty State ---- */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 24px;
  text-align: center;
  gap: 16px;
}
.empty-icon-wrap {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: var(--color-surface-variant);
  display: flex;
  align-items: center;
  justify-content: center;
}
.empty-icon {
  font-size: 40px;
  color: var(--color-text-tertiary);
}
.empty-state h3 {
  margin: 0;
  font-size: 18px;
  color: var(--color-text);
  font-weight: 600;
}
.empty-state p {
  margin: 0;
  font-size: 14px;
  color: var(--color-text-tertiary);
  max-width: 400px;
  line-height: 1.6;
}

/* ---- Task Grid ---- */
.task-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

/* ---- Task Card ---- */
.task-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 14px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.22, 1, 0.36, 1);
  display: flex;
  flex-direction: column;
  gap: 14px;
  position: relative;
}
.task-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 25px rgba(0,0,0,0.1);
  border-color: var(--color-text-tertiary);
}
.task-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* ---- Status Badge ---- */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 12px;
  border-radius: 100px;
  font-size: 12px;
  font-weight: 600;
}
.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
.status-badge.uploaded,
.status-badge.mapped {
  background: #eef2ff;
  color: #4F46E5;
}
.status-badge.uploaded .status-dot,
.status-badge.mapped .status-dot {
  background: #4F46E5;
}
.status-badge.processing {
  background: #fff3e0;
  color: #E37400;
}
.status-badge.processing .status-dot {
  background: #E37400;
  animation: pulse 1.5s infinite;
}
.status-badge.completed {
  background: #e8f5e9;
  color: #34A853;
}
.status-badge.completed .status-dot {
  background: #34A853;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.task-time {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

/* ---- File Tags ---- */
.task-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.file-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.file-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 100px;
  background: var(--color-surface-variant);
  font-size: 12px;
  color: var(--color-text-secondary);
}
.file-tag .file-name {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ---- Stats ---- */
.task-stats {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--color-text-secondary);
}
.stat-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.stat-item.success { color: #34A853; }
.stat-item.fail { color: #D93025; }
.stat-divider {
  width: 1px;
  height: 14px;
  background: var(--color-border);
}

/* ---- Actions ---- */
.task-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: auto;
  padding-top: 8px;
  border-top: 1px solid var(--color-border);
}
.icon-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 18px;
  transition: all 0.15s ease;
}
.icon-btn:hover {
  background: var(--color-surface-variant);
  color: var(--color-text);
  border-color: var(--color-text-tertiary);
}
.icon-btn.danger:hover {
  background: #fce8e6;
  color: #D93025;
  border-color: #f5c6cb;
}

/* ---- Pagination ---- */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding-top: 8px;
}
.page-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}
.page-btn:hover:not(:disabled) {
  background: var(--color-surface-variant);
  border-color: #4F46E5;
}
.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.page-info {
  font-size: 14px;
  color: var(--color-text-secondary);
  font-weight: 500;
}

/* ---- Step Bar ---- */
.step-bar {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 16px 24px;
  background: var(--color-surface);
  border-radius: 12px;
  border: 1px solid var(--color-border);
}
.step {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: var(--color-text-tertiary);
  font-weight: 500;
}
.step.active { color: var(--color-text); font-weight: 600; }
.step.done { color: #34A853; }
.step-num {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  border: 2px solid var(--color-border);
  color: var(--color-text-tertiary);
  flex-shrink: 0;
}
.step.active .step-num {
  border-color: #4F46E5;
  color: #4F46E5;
  background: #eef2ff;
}
.step.done .step-num {
  border-color: #34A853;
  color: #fff;
  background: #34A853;
}
.step-line {
  flex: 1;
  height: 2px;
  background: var(--color-border);
  margin: 0 12px;
}
.step-line.active { background: #4F46E5; }

/* ---- Card ---- */
.card {
  background: var(--color-surface);
  border-radius: 14px;
  border: 1px solid var(--color-border);
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.upload-card { gap: 24px; }

/* ---- Upload Zones ---- */
.upload-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.upload-zone {
  border: 2px dashed var(--color-border);
  border-radius: 14px;
  padding: 40px 24px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.upload-zone:hover {
  border-color: #4F46E5;
  background: var(--color-surface-variant);
}
.upload-zone.done {
  border-color: #34A853;
  border-style: solid;
  background: #f6fdf7;
}
.upload-icon-wrap {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--color-surface-variant);
  display: flex;
  align-items: center;
  justify-content: center;
}
.upload-zone.done .upload-icon-wrap {
  background: #e8f5e9;
}
.upload-icon {
  font-size: 28px;
  color: var(--color-text-tertiary);
}
.upload-zone.done .upload-icon {
  color: #34A853;
}
.upload-zone strong {
  font-size: 15px;
  color: var(--color-text);
}
.upload-zone p {
  font-size: 12px;
  color: var(--color-text-tertiary);
  margin: 0;
}

/* ---- Mapping Table ---- */
.mapping-header h3 {
  margin: 0 0 4px;
  font-size: 17px;
  color: var(--color-text);
}
.hint {
  font-size: 13px;
  color: var(--color-text-tertiary);
  margin: 0;
}
.mapping-table {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  overflow: hidden;
}
.map-row {
  display: grid;
  grid-template-columns: 1fr 36px 1fr 72px;
  gap: 10px;
  padding: 11px 16px;
  align-items: center;
  font-size: 13px;
  border-bottom: 1px solid var(--color-border);
}
.map-row:last-child { border-bottom: none; }
.map-head {
  background: var(--color-surface-variant);
  font-weight: 600;
  color: var(--color-text-secondary);
  font-size: 12px;
}
.map-arrow {
  text-align: center;
  color: #4F46E5;
  display: flex;
  align-items: center;
  justify-content: center;
}
.excel-col {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-text);
}
.ph-select {
  padding: 6px 10px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 13px;
  background: var(--color-surface);
  color: var(--color-text);
  font-family: inherit;
  width: 100%;
}
.ph-select:focus {
  outline: none;
  border-color: #4F46E5;
}
.confidence-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 100px;
  font-size: 12px;
  font-weight: 600;
}
.confidence-badge.high { color: #34A853; background: #e8f5e9; }
.confidence-badge.mid { color: #E37400; background: #fff3e0; }
.confidence-badge.low { color: #D93025; background: #fce8e6; }

/* ---- Result ---- */
.result-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.result-summary {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 24px;
  border-radius: 12px;
}
.result-summary.all-ok { background: #e8f5e9; }
.result-summary.partial { background: #fff3e0; }
.result-icon-wrap {
  flex-shrink: 0;
}
.result-icon {
  font-size: 44px;
}
.result-summary.all-ok .result-icon { color: #34A853; }
.result-summary.partial .result-icon { color: #E37400; }
.result-info h3 {
  margin: 0 0 4px;
  font-size: 18px;
  color: var(--color-text);
}
.result-info p {
  margin: 0;
  font-size: 14px;
  color: var(--color-text-secondary);
}
.result-info strong { color: var(--color-text); }

/* ---- Buttons ---- */
.btn-row {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}
.btn {
  padding: 10px 22px;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-family: inherit;
  transition: all 0.15s ease;
}
.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none;
}
.btn.primary {
  background: #4F46E5;
  color: #fff;
}
.btn.primary:hover:not(:disabled) {
  background: #4338CA;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(79,70,229,0.3);
}
.btn.success {
  background: #34A853;
  color: #fff;
}
.btn.success:hover:not(:disabled) {
  background: #2E7D32;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(52,168,83,0.3);
}
.btn.danger {
  background: #D93025;
  color: #fff;
}
.btn.danger:hover:not(:disabled) {
  background: #B71C1C;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(217,48,37,0.3);
}
.btn.outline {
  background: transparent;
  color: var(--color-text);
  border: 1px solid var(--color-border);
}
.btn.outline:hover:not(:disabled) {
  background: var(--color-surface-variant);
  border-color: var(--color-text-tertiary);
}
.btn.large { padding: 12px 32px; font-size: 16px; }
.btn.full { width: 100%; justify-content: center; }

/* ---- Error ---- */
.error-msg {
  padding: 12px 16px;
  background: #fce8e6;
  border: 1px solid #f5c6cb;
  border-radius: 8px;
  color: #D93025;
  font-size: 13px;
}

/* ---- Spinner ---- */
.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255,255,255,.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ---- Modal ---- */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.45);
  backdrop-filter: blur(4px);
}
.modal-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 18px;
  padding: 32px;
  max-width: 420px;
  width: 90%;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 14px;
}
.modal-icon-wrap {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #fce8e6;
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal-icon {
  font-size: 30px;
  color: #D93025;
}
.modal-title {
  margin: 0;
  font-size: 18px;
  color: var(--color-text);
  font-weight: 700;
}
.modal-desc {
  margin: 0;
  font-size: 14px;
  color: var(--color-text-secondary);
  line-height: 1.6;
}
.modal-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--color-text-tertiary);
}
.modal-meta span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.modal-actions {
  display: flex;
  gap: 12px;
  margin-top: 4px;
}

/* ---- Modal Transition ---- */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-active .modal-card,
.modal-leave-active .modal-card {
  transition: transform 0.25s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to { opacity: 0; }
.modal-enter-from .modal-card {
  transform: scale(0.92);
  opacity: 0;
}
.modal-leave-to .modal-card {
  transform: scale(0.92);
  opacity: 0;
}

/* ---- Responsive ---- */
@media (max-width: 768px) {
  .upload-grid { grid-template-columns: 1fr; }
  .task-grid { grid-template-columns: 1fr; }
  .tab-bar { width: 100%; }
  .tab { flex: 1; justify-content: center; }
  .batch-header { flex-direction: column; }
  .map-row { grid-template-columns: 1fr 28px 1fr 56px; gap: 6px; padding: 9px 10px; font-size: 12px; }
  .card { padding: 20px; }
}
</style>
