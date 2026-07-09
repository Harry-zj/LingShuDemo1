<template>
  <div class="smart-fill">
    <!-- ========== 顶部步骤条 ========== -->
    <div class="step-bar">
      <div
        v-for="(step, i) in steps"
        :key="i"
        class="step-item"
        :class="{ active: currentStep === i, done: currentStep > i }"
        @click="currentStep = i"
      >
        <span class="step-num">{{ currentStep > i ? '✓' : i + 1 }}</span>
        <span class="step-label">{{ step }}</span>
      </div>
    </div>

    <!-- ========== Tab 1: 规则管理 ========== -->
    <div v-show="currentStep === 0" class="tab-content">
      <div class="tab-grid">
        <!-- 左：上传区 -->
        <div class="panel">
          <h3>上传规则文件</h3>
          <p class="panel-desc">支持 Word / Excel / PDF / 图片，可一次选多个文件</p>
          <div
            class="upload-zone"
            @click="triggerRuleFile"
            @dragover.prevent
            @drop.prevent="handleRuleDrop"
          >
            <span class="upload-icon">📁</span>
            <span>拖拽文件到此处，或点击选择</span>
            <span class="upload-hint">.docx .xlsx .pdf .png .jpg</span>
          </div>
          <input
            type="file"
            ref="ruleFileInput"
            multiple
            hidden
            accept=".docx,.xlsx,.pdf,.png,.jpg,.jpeg"
            @change="handleRuleFiles"
          />

          <!-- 文字约束对话框 -->
          <div class="text-rule-box">
            <h4>文字补充约束（可选）</h4>
            <p class="panel-desc">用自然语言描述分类约束，AI 解析规则时会参考</p>
            <textarea
              v-model="ruleText"
              rows="4"
              placeholder="例如：志愿服务只能在德育里加分，不能算到劳育。学科竞赛归智育，文艺比赛归美育。同类奖项只取最高级别。"
            ></textarea>
            <button class="btn btn-primary" @click="submitRuleText" :disabled="!ruleText.trim()">
              发送 → AI 解析
            </button>
          </div>
        </div>

        <!-- 右：已上传的规则来源 + 解析后的规则表 -->
        <div class="panel">
          <h3>规则来源</h3>
          <div v-if="ruleSources.length === 0" class="empty-hint">暂无规则，请上传</div>
          <div v-for="src in ruleSources" :key="src.id" class="source-card">
            <span class="source-icon">{{ src.source_type === 'file' ? '📄' : '💬' }}</span>
            <span class="source-name">{{ src.file_name || '文字输入' }}</span>
            <span class="badge" :class="src.status">{{ src.status === 'parsed' ? '已解析' : '解析中...' }}</span>
            <button class="btn-text danger" @click="removeSource(src.id)">删除</button>
          </div>

          <!-- 解析后的规则表 -->
          <div v-if="ruleItems.length > 0" style="margin-top:20px">
            <h3>解析出的规则项（{{ ruleItems.filter(r => r.status === 'confirmed').length }}/{{ ruleItems.length }} 已确认）</h3>
            <div class="rule-table-wrap">
              <table class="rule-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>类别</th>
                    <th>类型</th>
                    <th>描述</th>
                    <th>级别</th>
                    <th>分值</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="item in ruleItems"
                    :key="item.id"
                    :class="{ dimmed: item.status !== 'confirmed' }"
                  >
                    <td>
                      <input
                        type="checkbox"
                        :checked="item.status === 'confirmed'"
                        @change="toggleRuleItem(item)"
                      />
                    </td>
                    <td>
                      <span class="cat-tag" :style="catStyle(item.category)">
                        {{ catLabel(item.category) }}
                      </span>
                    </td>
                    <td>{{ ruleTypeLabel(item.rule_type) }}</td>
                    <td class="desc-cell">{{ item.description }}</td>
                    <td>{{ levelLabel(item.level) }}</td>
                    <td>{{ item.score != null ? (item.rule_type === 'scoring' ? '+' : '') + item.score : '-' }}</td>
                    <td><button class="btn-text danger" @click="removeRuleItem(item.id)">删</button></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ========== Tab 2: 材料上传 ========== -->
    <div v-show="currentStep === 1" class="tab-content">
      <div class="tab-grid">
        <!-- 左：创建材料 -->
        <div class="panel">
          <h3>创建材料</h3>
          <div class="create-material">
            <input
              v-model="newMaterialTitle"
              class="input"
              placeholder="材料名称，如'全国优秀共青团员证书'"
              @keyup.enter="createMaterial"
            />
            <button class="btn btn-primary" @click="createMaterial" :disabled="!newMaterialTitle.trim()">
              + 创建
            </button>
          </div>

          <!-- 材料列表 -->
          <div v-if="materials.length === 0" class="empty-hint" style="margin-top:16px">暂无材料</div>
          <div v-for="mat in materials" :key="mat.id" class="material-card" @click="selectMaterial(mat)">
            <div class="mat-header">
              <span class="mat-title">{{ mat.title }}</span>
              <span class="badge" :class="mat.status">{{ mat.status === 'submitted' ? '已提交' : '草稿' }}</span>
            </div>
            <div class="mat-meta" v-if="mat.recognition">
              <span class="cat-tag" :style="catStyle(mat.recognition.category)">{{ catLabel(mat.recognition.category) }}</span>
              <span class="confidence-dot" :class="confidenceLevel(mat.recognition.confidence)"></span>
              <span>{{ (mat.recognition.confidence * 100).toFixed(0) }}%</span>
            </div>
            <div class="mat-actions" @click.stop>
              <input
                type="file"
                :ref="el => matFileInputs[mat.id] = el"
                hidden
                multiple
                accept=".png,.jpg,.jpeg,.pdf,.docx"
                @change="e => handleMatFiles(mat.id, e)"
              />
              <button class="btn-text" @click="matFileInputs[mat.id]?.click()">+ 上传证明</button>
              <button class="btn-text primary" @click="analyzeMaterial(mat.id)" v-if="mat.hasFiles && !mat.recognition">
                AI 分析
              </button>
            </div>
            <!-- 附件列表 -->
            <div v-if="mat.attachments?.length" class="attach-list">
              <span v-for="att in mat.attachments" :key="att.id" class="attach-item">
                📎 {{ att.file_name }}
                <span v-if="att.ai_label" class="ai-label">{{ att.ai_label }}</span>
              </span>
            </div>
          </div>
        </div>

        <!-- 右：提示区 -->
        <div class="panel">
          <h3>操作提示</h3>
          <div class="hint-box">
            <p>1. 输入材料名称并创建</p>
            <p>2. 点击"+ 上传证明"上传证书/证明文件</p>
            <p>3. 点击"AI 分析"让 AI 自动识别归类</p>
            <p>4. 分析完成后到"识别确认"标签页查看结果</p>
          </div>
        </div>
      </div>
    </div>

    <!-- ========== Tab 3: 识别确认 ========== -->
    <div v-show="currentStep === 2" class="tab-content">
      <div class="recognition-list">
        <div v-if="pendingRecognitions.length === 0" class="empty-hint">没有待确认的识别结果</div>
        <div
          v-for="rec in pendingRecognitions"
          :key="rec.id"
          class="recognition-card"
          :class="{ warning: rec.confidence < 0.5 }"
        >
          <div class="rec-header">
            <span class="rec-material-name">{{ rec.material_title }}</span>
            <span class="cat-tag large" :style="catStyle(rec.category)">{{ catLabel(rec.category) }}</span>
          </div>
          <p class="rec-explanation">{{ rec.explanation }}</p>
          <div class="rec-footer">
            <div class="confidence-bar-wrap">
              <div class="confidence-bar">
                <div
                  class="confidence-fill"
                  :class="confidenceLevel(rec.confidence)"
                  :style="{ width: (rec.confidence * 100) + '%' }"
                ></div>
              </div>
              <span class="confidence-text" :class="confidenceLevel(rec.confidence)">
                {{ (rec.confidence * 100).toFixed(0) }}%
              </span>
              <span v-if="rec.confidence < 0.5" class="warning-tag">⚠️ 低置信度预警</span>
            </div>
            <div class="rec-buttons">
              <button class="btn btn-success" @click="confirmRecognition(rec.id)">✓ 确认</button>
              <button class="btn btn-outline-danger" @click="dismissRecognition(rec.id)">✗ 舍弃</button>
            </div>
          </div>
          <!-- 匹配到的规则 -->
          <div v-if="rec.matched_rules?.length" class="matched-rules">
            <span class="muted">匹配规则：</span>
            <span v-for="r in rec.matched_rules" :key="r.id" class="rule-chip">{{ r.description }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ========== Tab 4: 评分结果 ========== -->
    <div v-show="currentStep === 3" class="tab-content">
      <div class="score-area">
        <button class="btn btn-primary btn-large" @click="calculateScore" :disabled="!canCalculate">
          🔢 计算评分
        </button>
        <p v-if="!canCalculate" class="muted" style="margin-top:8px">
          需要至少确认 1 条规则和 1 条材料识别结果才能计算
        </p>

        <div v-if="evaluation" class="score-result">
          <!-- 总分 -->
          <div class="total-score-card">
            <span class="total-label">总分</span>
            <span class="total-number">{{ evaluation.total_score }}</span>
          </div>

          <!-- 五维 -->
          <div class="dim-cards">
            <div v-for="dim in dimensions" :key="dim.key" class="dim-card">
              <div class="dim-header">
                <span class="dim-name">{{ dim.label }}</span>
                <span class="dim-score">{{ evaluation[dim.key]?.score || 0 }} / {{ evaluation[dim.key]?.max || 0 }}</span>
              </div>
              <div class="dim-bar-bg">
                <div
                  class="dim-bar-fill"
                  :style="{ width: dimPercent(dim.key) + '%', background: dim.color }"
                ></div>
              </div>
              <div class="dim-detail" v-if="evaluation[dim.key]?.detail_text">
                {{ evaluation[dim.key].detail_text }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ========== Tab 5: 自动填表 ========== -->
    <div v-show="currentStep === 4" class="tab-content">
      <div class="tab-grid">
        <div class="panel">
          <h3>上传填表模板</h3>
          <p class="panel-desc">上传 .docx 模板文件，使用占位符标记需要填充的位置</p>
          <div class="upload-zone small" @click="triggerTemplate" @dragover.prevent @drop.prevent="handleTemplateDrop">
            <span>📄 点击上传 Word 模板（.docx）</span>
          </div>
          <input type="file" ref="templateInput" hidden accept=".docx" @change="handleTemplate" />

          <div v-if="templates.length > 0" style="margin-top:16px">
            <h4>已上传的模板</h4>
            <div v-for="tpl in templates" :key="tpl.id" class="source-card">
              <span>📄 {{ tpl.name }}</span>
              <button class="btn btn-primary btn-sm" @click="doFill(tpl.id)" :disabled="!evaluation">
                一键填表
              </button>
            </div>
          </div>

          <!-- 占位符说明 -->
          <div class="placeholder-guide" style="margin-top:20px">
            <h4>可用的占位符</h4>
            <p class="panel-desc">在 Word 模板中插入以下 {xxx} 标记，系统会自动替换为对应数据</p>
            <div class="placeholder-grid">
              <code v-for="ph in placeholders" :key="ph.key">{ {{ ph.key }} }<span> — {{ ph.label }}</span></code>
            </div>
          </div>
        </div>

        <div class="panel">
          <h3>生成的表格</h3>
          <div v-if="fillResults.length === 0" class="empty-hint">还未生成填表文件</div>
          <div v-for="fr in fillResults" :key="fr.id" class="source-card">
            <span>📝 {{ fr.name }}</span>
            <button class="btn-text primary" @click="downloadFill(fr.id)">⬇ 下载</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

// ========== 步骤 ==========
const steps = ['规则管理', '材料上传', '识别确认', '评分结果', '自动填表']
const currentStep = ref(0)

// ========== 维度配置 ==========
const dimensions = [
  { key: 'moral',        label: '德育', color: '#EA8600' },
  { key: 'intellectual', label: '智育', color: '#1A73E8' },
  { key: 'physical',     label: '体育', color: '#34A853' },
  { key: 'aesthetic',    label: '美育', color: '#9C27B0' },
  { key: 'labor',        label: '劳育', color: '#FF6D00' },
]

const catMap = {
  moral: '德育', intellectual: '智育', physical: '体育',
  aesthetic: '美育', labor: '劳育', '': '未归类'
}
const catColors = {
  moral: '#EA8600', intellectual: '#1A73E8', physical: '#34A853',
  aesthetic: '#9C27B0', labor: '#FF6D00', '': '#9AA0A6'
}
function catLabel(c) { return catMap[c] || c || '全局' }
function catStyle(c) { return { background: (catColors[c] || '#9AA0A6') + '20', color: catColors[c] || '#9AA0A6', border: '1px solid ' + (catColors[c] || '#9AA0A6') + '40' } }
function ruleTypeLabel(t) { return { scoring: '加分', limit: '上限', conflict: '冲突' }[t] || t }
function levelLabel(l) { return { national: '国家级', provincial: '省级', school: '校级', college: '院级' }[l] || l || '-' }
function confidenceLevel(c) {
  if (c == null) return ''
  if (c > 0.8) return 'high'
  if (c >= 0.5) return 'mid'
  return 'low'
}

// ========== Tab 1: 规则 ==========
const ruleFileInput = ref(null)
const ruleText = ref('')
const ruleSources = ref([])
const ruleItems = ref([])

function triggerRuleFile() { ruleFileInput.value?.click() }
function handleRuleFiles(e) {
  const files = e.target.files
  if (!files.length) return
  for (const f of files) {
    ruleSources.value.push({
      id: Date.now() + Math.random(),
      source_type: 'file',
      file_name: f.name,
      file_path: '',
      status: 'pending',
      original_text: '',
    })
  }
  // TODO: 实际上传 + 触发AI解析
}
function handleRuleDrop(e) {
  const files = e.dataTransfer.files
  if (!files.length) return
  for (const f of files) {
    ruleSources.value.push({
      id: Date.now() + Math.random(),
      source_type: 'file',
      file_name: f.name,
      file_path: '',
      status: 'pending',
      original_text: '',
    })
  }
}
function submitRuleText() {
  if (!ruleText.value.trim()) return
  ruleSources.value.push({
    id: Date.now() + Math.random(),
    source_type: 'text',
    file_name: '',
    file_path: '',
    status: 'pending',
    original_text: ruleText.value,
  })
  ruleText.value = ''
  // TODO: 触发AI解析
}
function removeSource(id) {
  ruleSources.value = ruleSources.value.filter(s => s.id !== id)
}
function toggleRuleItem(item) {
  item.status = item.status === 'confirmed' ? 'pending_confirm' : 'confirmed'
}
function removeRuleItem(id) {
  ruleItems.value = ruleItems.value.filter(r => r.id !== id)
}

// ========== Tab 2: 材料 ==========
const newMaterialTitle = ref('')
const materials = ref([])
const matFileInputs = ref({})

function createMaterial() {
  if (!newMaterialTitle.value.trim()) return
  materials.value.push({
    id: Date.now() + Math.random(),
    title: newMaterialTitle.value,
    status: 'draft',
    hasFiles: false,
    attachments: [],
    recognition: null,
  })
  newMaterialTitle.value = ''
}
function selectMaterial(mat) { /* 可扩展 */ }
function handleMatFiles(matId, e) {
  const files = e.target.files
  if (!files.length) return
  const mat = materials.value.find(m => m.id === matId)
  if (!mat) return
  for (const f of files) {
    mat.attachments.push({
      id: Date.now() + Math.random(),
      file_name: f.name,
      file_path: '',
      file_type: f.type,
      file_size: f.size,
      ai_label: '',
    })
  }
  mat.hasFiles = true
}
function analyzeMaterial(matId) {
  // TODO: 触发AI分析
  // 模拟：给材料加一个recognition
  const mat = materials.value.find(m => m.id === matId)
  if (!mat) return
  mat.recognition = {
    id: Date.now(),
    category: 'moral',
    explanation: '该证书为共青团中央颁发的"全国优秀共青团员"，属于国家级荣誉称号，符合德育加分规则。',
    confidence: 0.92,
    matched_rule_ids: [],
    matched_rules: [],
    confirm_status: 'pending',
    material_title: mat.title,
  }
}

// ========== Tab 3: 识别确认 ==========
const pendingRecognitions = computed(() =>
  materials.value
    .filter(m => m.recognition && m.recognition.confirm_status === 'pending')
    .map(m => m.recognition)
)
function confirmRecognition(recId) {
  const mat = materials.value.find(m => m.recognition?.id === recId)
  if (mat) mat.recognition.confirm_status = 'confirmed'
}
function dismissRecognition(recId) {
  const mat = materials.value.find(m => m.recognition?.id === recId)
  if (mat) mat.recognition.confirm_status = 'dismissed'
}

// ========== Tab 4: 评分 ==========
const evaluation = ref(null)
const canCalculate = computed(() => {
  const confirmedRules = ruleItems.value.filter(r => r.status === 'confirmed').length
  const confirmedRecs = materials.value.filter(m => m.recognition?.confirm_status === 'confirmed').length
  return confirmedRules > 0 && confirmedRecs > 0
})
function calculateScore() {
  // TODO: 真正的评分计算
  evaluation.value = {
    total_score: 60.0,
    moral:        { score: 15.0, max: 20.0, detail_text: '国家级荣誉称号+5（全国优秀共青团员），志愿服务+10（40小时）' },
    intellectual: { score: 22.0, max: 30.0, detail_text: 'SCI一区论文+10，数学建模国赛一等奖+12' },
    physical:     { score: 8.0,  max: 10.0, detail_text: '校运会100米冠军+5，体育课优秀+3' },
    aesthetic:    { score: 5.0,  max: 10.0, detail_text: '校园歌手大赛二等奖+5' },
    labor:        { score: 10.0, max: 10.0, detail_text: '暑期社会实践先进个人+10' },
  }
}
function dimPercent(key) {
  if (!evaluation.value) return 0
  const dim = evaluation.value[key]
  if (!dim || dim.max === 0) return 0
  return Math.min((dim.score / dim.max) * 100, 100)
}

// ========== Tab 5: 填表 ==========
const templateInput = ref(null)
const templates = ref([])
const fillResults = ref([])
const placeholders = [
  { key: 'real_name', label: '姓名' },
  { key: 'student_id', label: '学号' },
  { key: 'total_score', label: '总分' },
  { key: 'moral_score', label: '德育得分' },
  { key: 'moral_max', label: '德育满分' },
  { key: 'moral_detail', label: '德育明细（材料概括文本）' },
  { key: 'intellectual_score', label: '智育得分' },
  { key: 'intellectual_max', label: '智育满分' },
  { key: 'intellectual_detail', label: '智育明细' },
  { key: 'physical_score', label: '体育得分' },
  { key: 'physical_max', label: '体育满分' },
  { key: 'physical_detail', label: '体育明细' },
  { key: 'aesthetic_score', label: '美育得分' },
  { key: 'aesthetic_max', label: '美育满分' },
  { key: 'aesthetic_detail', label: '美育明细' },
  { key: 'labor_score', label: '劳育得分' },
  { key: 'labor_max', label: '劳育满分' },
  { key: 'labor_detail', label: '劳育明细' },
]

function triggerTemplate() { templateInput.value?.click() }
function handleTemplate(e) {
  const file = e.target.files[0]
  if (!file) return
  templates.value.push({ id: Date.now(), name: file.name, file_path: '' })
  // TODO: 实际上传
}
function handleTemplateDrop(e) {
  const file = e.dataTransfer.files[0]
  if (!file || !file.name.endsWith('.docx')) return
  templates.value.push({ id: Date.now(), name: file.name, file_path: '' })
}
function doFill(tplId) {
  // TODO: 实际填表
  fillResults.value.push({ id: Date.now(), name: '填好的综测表_' + new Date().toLocaleDateString() + '.docx' })
}
function downloadFill(id) {
  // TODO: 实际下载
  alert('下载功能待实现')
}
</script>

<style scoped>
.smart-fill { display: flex; flex-direction: column; gap: 24px; }

/* ===== 步骤条 ===== */
.step-bar {
  display: flex; gap: 0;
  background: var(--color-white); border-radius: var(--radius-card);
  border: 1px solid var(--color-border); overflow: hidden;
}
.step-item {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 14px 16px; cursor: pointer; font-size: 14px; color: var(--color-gray);
  border-bottom: 3px solid transparent; transition: all 0.2s;
}
.step-item:hover { background: #f5f5f5; }
.step-item.active { color: var(--color-primary); border-bottom-color: var(--color-primary); font-weight: 600; }
.step-item.done { color: var(--color-success); }
.step-num {
  width: 24px; height: 24px; border-radius: 50%; display: flex;
  align-items: center; justify-content: center; font-size: 12px; font-weight: 700;
  background: #e0e0e0; color: #666;
}
.step-item.active .step-num { background: var(--color-primary); color: #fff; }
.step-item.done .step-num { background: var(--color-success); color: #fff; }

/* ===== 通用 ===== */
.tab-content { animation: fadeIn 0.2s; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
.tab-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
@media (max-width: 768px) { .tab-grid { grid-template-columns: 1fr; } }
.panel {
  background: var(--color-white); border-radius: var(--radius-card);
  border: 1px solid var(--color-border); padding: 24px;
}
.panel h3 { font-size: 16px; margin-bottom: 8px; }
.panel h4 { font-size: 14px; margin: 16px 0 8px; }
.panel-desc { font-size: 13px; color: var(--color-gray); margin-bottom: 12px; }

/* ===== 上传区 ===== */
.upload-zone {
  border: 2px dashed var(--color-border); border-radius: var(--radius-md);
  padding: 32px; display: flex; flex-direction: column; align-items: center;
  gap: 8px; cursor: pointer; transition: border-color 0.2s;
  color: var(--color-gray); font-size: 14px;
}
.upload-zone:hover { border-color: var(--color-primary); }
.upload-zone.small { padding: 20px; font-size: 13px; }
.upload-icon { font-size: 32px; }
.upload-hint { font-size: 12px; color: #999; }

/* ===== 文字规则 ===== */
.text-rule-box { margin-top: 20px; }
.text-rule-box textarea {
  width: 100%; border: 1px solid var(--color-border); border-radius: var(--radius-sm);
  padding: 12px; font-size: 14px; resize: vertical; font-family: inherit;
  box-sizing: border-box;
}
.text-rule-box textarea:focus { outline: none; border-color: var(--color-primary); }

/* ===== 规则来源卡片 ===== */
.source-card {
  display: flex; align-items: center; gap: 12px; padding: 10px 12px;
  border: 1px solid var(--color-border); border-radius: var(--radius-sm); margin-top: 8px;
}
.source-icon { font-size: 18px; }
.source-name { flex: 1; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ===== 规则表格 ===== */
.rule-table-wrap { overflow-x: auto; }
.rule-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.rule-table th { text-align: left; padding: 8px 6px; border-bottom: 1px solid var(--color-border); color: var(--color-gray); font-weight: 500; white-space: nowrap; }
.rule-table td { padding: 8px 6px; border-bottom: 1px solid #f0f0f0; }
.rule-table tr.dimmed { opacity: 0.4; }
.desc-cell { max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ===== 材料区 ===== */
.create-material { display: flex; gap: 8px; }
.input {
  flex: 1; padding: 10px 14px; border: 1px solid var(--color-border);
  border-radius: var(--radius-sm); font-size: 14px; font-family: inherit;
}
.input:focus { outline: none; border-color: var(--color-primary); }
.material-card {
  border: 1px solid var(--color-border); border-radius: var(--radius-sm);
  padding: 14px; margin-top: 10px; cursor: pointer; transition: border-color 0.15s;
}
.material-card:hover { border-color: var(--color-primary); }
.mat-header { display: flex; justify-content: space-between; align-items: center; }
.mat-title { font-size: 14px; font-weight: 500; }
.mat-meta { display: flex; align-items: center; gap: 8px; margin-top: 8px; font-size: 13px; }
.mat-actions { display: flex; gap: 8px; margin-top: 10px; }
.attach-list { margin-top: 8px; display: flex; flex-direction: column; gap: 2px; }
.attach-item { font-size: 12px; color: #666; }
.ai-label { color: var(--color-primary); margin-left: 6px; }

/* ===== 识别确认 ===== */
.recognition-list { display: flex; flex-direction: column; gap: 16px; }
.recognition-card {
  background: var(--color-white); border: 1px solid var(--color-border);
  border-radius: var(--radius-md); padding: 20px;
}
.recognition-card.warning { border-color: #D93025; background: #FFF5F5; }
.rec-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.rec-material-name { font-weight: 600; font-size: 15px; }
.rec-explanation { font-size: 14px; line-height: 1.6; color: #333; margin-bottom: 14px; }
.rec-footer { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
.confidence-bar-wrap { display: flex; align-items: center; gap: 8px; }
.confidence-bar { width: 120px; height: 6px; background: #e0e0e0; border-radius: 3px; overflow: hidden; }
.confidence-fill { height: 100%; border-radius: 3px; }
.confidence-fill.high { background: #34A853; }
.confidence-fill.mid { background: #E37400; }
.confidence-fill.low { background: #D93025; }
.confidence-text { font-size: 13px; font-weight: 600; }
.confidence-text.high { color: #34A853; }
.confidence-text.mid { color: #E37400; }
.confidence-text.low { color: #D93025; }
.warning-tag { font-size: 12px; color: #D93025; font-weight: 600; }
.rec-buttons { display: flex; gap: 8px; }
.matched-rules { margin-top: 12px; font-size: 13px; display: flex; align-items: center; flex-wrap: wrap; gap: 4px; }
.rule-chip {
  padding: 2px 8px; background: #f0f0f0; border-radius: var(--radius-tag); font-size: 12px;
}

/* ===== 评分 ===== */
.score-area { display: flex; flex-direction: column; align-items: center; gap: 24px; }
.score-result { width: 100%; }
.total-score-card {
  text-align: center; padding: 24px;
  background: linear-gradient(135deg, var(--color-primary), #4a90d9);
  border-radius: var(--radius-card); color: #fff; margin-bottom: 20px;
}
.total-label { display: block; font-size: 14px; opacity: 0.85; }
.total-number { font-size: 48px; font-weight: 700; }
.dim-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
.dim-card {
  background: var(--color-white); border: 1px solid var(--color-border);
  border-radius: var(--radius-md); padding: 16px;
}
.dim-header { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
.dim-name { font-weight: 600; }
.dim-bar-bg { height: 8px; background: #e0e0e0; border-radius: 4px; overflow: hidden; margin-bottom: 8px; }
.dim-bar-fill { height: 100%; border-radius: 4px; transition: width 0.5s; }
.dim-detail { font-size: 12px; color: #666; line-height: 1.5; }

/* ===== 填表 ===== */
.placeholder-guide { background: #f8f9fa; border-radius: var(--radius-sm); padding: 16px; }
.placeholder-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 10px; }
.placeholder-grid code { font-size: 12px; color: #555; }
.placeholder-grid code span { color: #999; }

/* ===== 通用组件 ===== */
.btn {
  padding: 10px 24px; border: none; border-radius: var(--radius-btn);
  cursor: pointer; font-size: 14px; font-family: inherit; transition: opacity 0.15s;
}
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: var(--color-primary); color: #fff; }
.btn-success { background: #34A853; color: #fff; }
.btn-outline-danger { background: #fff; color: #D93025; border: 1px solid #D93025; }
.btn-large { padding: 14px 48px; font-size: 16px; }
.btn-sm { padding: 6px 16px; font-size: 13px; }
.btn-text { padding: 6px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-btn); background: #fff; cursor: pointer; font-size: 13px; font-family: inherit; }
.btn-text.primary { color: var(--color-primary); border-color: var(--color-primary); }
.btn-text.danger { color: #D93025; border-color: transparent; }

.badge {
  font-size: 12px; padding: 2px 10px; border-radius: var(--radius-tag);
  background: #FEF7E0; color: #E37400;
}
.badge.parsed { background: #E6F4EA; color: #34A853; }
.badge.submitted { background: #E8F0FE; color: #1A73E8; }

.cat-tag {
  font-size: 12px; padding: 2px 10px; border-radius: var(--radius-tag); font-weight: 500;
}
.cat-tag.large { font-size: 14px; padding: 4px 14px; }

.confidence-dot {
  width: 8px; height: 8px; border-radius: 50%; display: inline-block;
}
.confidence-dot.high { background: #34A853; }
.confidence-dot.mid { background: #E37400; }
.confidence-dot.low { background: #D93025; }

.empty-hint { text-align: center; color: var(--color-gray); padding: 40px 0; font-size: 14px; }
.hint-box { font-size: 13px; color: #666; line-height: 2; }
.muted { color: var(--color-gray); font-size: 13px; }
</style>
