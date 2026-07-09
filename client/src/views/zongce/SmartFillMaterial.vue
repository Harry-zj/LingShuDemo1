<template>
  <div class="material-page">
    <!-- 添加入口 -->
    <div class="add-bar">
      <button class="btn primary" @click="$emit('create')">+ 新建材料项</button>
      <span class="hint">材料无需名称，可直接上传证明文件</span>
    </div>

    <!-- 材料列表 -->
    <div v-if="!materials.length" class="empty">暂无材料，点击上方按钮创建</div>

    <div v-for="mat in materials" :key="mat.id" class="material-item">
      <div class="mat-top">
        <div class="mat-left">
          <span class="mat-title">{{ mat.title || '未命名材料' }}</span>
          <span class="file-count" v-if="mat.attachments.length">{{ mat.attachments.length }} 个文件</span>
        </div>
        <div class="mat-right">
          <!-- 未识别时显示上传和AI分析按钮 -->
          <template v-if="!mat.recognition">
            <button class="btn-text" @click="fileInputs[mat.id]?.click()">+ 上传证明</button>
            <input :ref="el => fileInputs[mat.id] = el" type="file" hidden multiple accept=".png,.jpg,.jpeg,.pdf,.docx" @change="e => onFiles(mat.id, e)" />
            <button class="btn primary sm" @click="$emit('analyze', mat.id)" :disabled="!mat.attachments.length">AI 分析</button>
          </template>
          <button class="btn-text danger" @click="$emit('remove', mat.id)">删除</button>
        </div>
      </div>

      <!-- 附件列表 -->
      <div v-if="mat.attachments.length" class="attach-row">
        <span v-for="(att, i) in mat.attachments" :key="att.id" class="attach-tag">
          📎 {{ att.file_name }}
          <button class="attach-del" @click="mat.attachments.splice(i, 1)">×</button>
        </span>
      </div>

      <!-- 识别结果卡片 -->
      <div v-if="mat.recognition" class="recognition-card" :class="{ dismissed: mat.recognition.confirm_status === 'dismissed' }">
        <div class="rec-top">
          <span class="cat-tag large" :style="catStyle(mat.recognition.category)">
            {{ catLabel(mat.recognition.category) }}
          </span>
          <span class="rec-score">+{{ mat.recognition.suggested_score }} 分</span>
          <span class="rec-confidence" :class="confLevel(mat.recognition.confidence)">
            {{ (mat.recognition.confidence * 100).toFixed(0) }}%
          </span>
        </div>
        <p class="rec-explanation">{{ mat.recognition.explanation }}</p>
        <div class="rec-actions" v-if="mat.recognition.confirm_status === 'pending'">
          <button class="btn success sm" @click="$emit('confirm', mat.recognition.id)">✓ 确认</button>
          <button class="btn outline-danger sm" @click="$emit('dismiss', mat.recognition.id)">✗ 舍弃</button>
        </div>
        <div class="rec-status" v-else>
          <span v-if="mat.recognition.confirm_status === 'confirmed'" class="tag-confirmed">✅ 已确认</span>
          <span v-else class="tag-dismissed">❌ 已舍弃</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({ materials: Array, ruleItems: Array })
const emit = defineEmits(['create','upload','analyze','confirm','dismiss','remove'])
const fileInputs = {}

function onFiles(matId, e) {
  const files = Array.from(e.target.files)
  if (files.length) emit('upload', matId, files)
}

const catMap = { moral:'德育', intellectual:'智育', physical:'体育', aesthetic:'美育', labor:'劳育' }
const catColors = { moral:'#EA8600', intellectual:'#1A73E8', physical:'#34A853', aesthetic:'#9C27B0', labor:'#FF6D00' }
function catLabel(c) { return catMap[c] || c || '未归类' }
function catStyle(c) { return { background: (catColors[c]||'#9AA0A6')+'20', color: catColors[c]||'#9AA0A6' } }
function confLevel(c) { return c > 0.8 ? 'high' : c >= 0.5 ? 'mid' : 'low' }
</script>

<style scoped>
.material-page { display: flex; flex-direction: column; gap: 16px; }
.add-bar { display: flex; align-items: center; gap: 16px; }
.hint { font-size: 13px; color: #999; }

.material-item {
  border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 16px;
}
.mat-top { display: flex; justify-content: space-between; align-items: center; }
.mat-left { display: flex; align-items: center; gap: 10px; }
.mat-title { font-weight: 600; font-size: 15px; }
.file-count { font-size: 12px; color: #999; background: #f0f0f0; padding: 2px 8px; border-radius: var(--radius-tag); }
.mat-right { display: flex; gap: 8px; }

.attach-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.attach-tag {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 12px; padding: 3px 8px; background: #f5f5f5; border-radius: var(--radius-tag);
}
.attach-del { border: none; background: none; cursor: pointer; color: #999; font-size: 14px; padding: 0 2px; }

.recognition-card {
  margin-top: 14px; padding: 16px; background: #f8fafb; border-radius: var(--radius-sm);
  border: 1px solid #e0e0e0;
}
.recognition-card.dismissed { opacity: 0.4; }
.rec-top { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
.rec-score { font-size: 20px; font-weight: 700; color: var(--color-primary); }
.rec-confidence { font-size: 14px; font-weight: 600; }
.rec-confidence.high { color: #34A853; }
.rec-confidence.mid { color: #E37400; }
.rec-confidence.low { color: #D93025; }
.rec-explanation { font-size: 14px; line-height: 1.6; color: #333; margin-bottom: 12px; }
.rec-actions { display: flex; gap: 8px; }
.rec-status { font-size: 14px; }
.tag-confirmed { color: #34A853; font-weight: 600; }
.tag-dismissed { color: #D93025; }

.cat-tag { font-size: 12px; padding: 2px 10px; border-radius: var(--radius-tag); font-weight: 500; }
.cat-tag.large { font-size: 14px; padding: 4px 14px; }

.empty { text-align: center; color: var(--color-gray); padding: 40px 0; }

.btn { padding: 8px 20px; border: none; border-radius: var(--radius-btn); cursor: pointer; font-size: 14px; font-family: inherit; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn.primary { background: var(--color-primary); color: #fff; }
.btn.sm { padding: 6px 16px; font-size: 13px; }
.btn.success { background: #34A853; color: #fff; }
.btn.outline-danger { background: #fff; color: #D93025; border: 1px solid #D93025; }
.btn-text { padding: 6px 14px; border: 1px solid var(--color-border); border-radius: var(--radius-btn); background: #fff; cursor: pointer; font-size: 13px; font-family: inherit; }
.btn-text.danger { color: #D93025; border-color: transparent; }
</style>
