<template>
  <div class="form-page">
    <div class="form-grid">
      <!-- 左：上传模板 -->
      <div class="form-panel">
        <h4>上传 Word 模板</h4>
        <p class="hint">在模板中插入占位符，系统自动替换</p>
        <div class="upload-zone" @click="$refs.tplInput.click()" @dragover.prevent @drop.prevent="onDrop">
          <span>📄 点击或拖拽上传 .docx 模板</span>
        </div>
        <input type="file" ref="tplInput" hidden accept=".docx" @change="onFile" />

        <div v-if="templates.length" class="tpl-list">
          <div v-for="tpl in templates" :key="tpl.id" class="tpl-row">
            <span>📄 {{ tpl.name }}</span>
            <button class="btn primary sm" @click="$emit('fill', tpl.id)">一键填表</button>
          </div>
        </div>
      </div>

      <!-- 右：生成的表格 -->
      <div class="form-panel">
        <h4>生成的表格</h4>
        <div v-if="!fillResults.length" class="empty">还未生成，请上传模板后点击"一键填表"</div>
        <div v-for="fr in fillResults" :key="fr.id" class="tpl-row">
          <span>📝 {{ fr.name }}</span>
          <button class="btn primary sm" @click="$emit('download', fr.id)">⬇ 下载</button>
        </div>
      </div>
    </div>

    <!-- 占位符说明 -->
    <details class="placeholder-guide">
      <summary>可用占位符清单（点击展开）</summary>
      <div class="ph-grid">
        <code v-for="ph in placeholders" :key="ph.key">{ {{ ph.key }} }<span> — {{ ph.label }}</span></code>
      </div>
    </details>
  </div>
</template>

<script setup>
defineProps({ evaluation: Object, templates: Array, fillResults: Array })
const emit = defineEmits(['upload-template','fill','download'])

function onFile(e) {
  const f = e.target.files[0]
  if (f) emit('upload-template', f)
}
function onDrop(e) {
  const f = e.dataTransfer.files[0]
  if (f && f.name.endsWith('.docx')) emit('upload-template', f)
}

const placeholders = [
  { key:'real_name', label:'姓名' }, { key:'student_id', label:'学号' },
  { key:'total_score', label:'总分' },
  { key:'moral_score', label:'德育得分' }, { key:'moral_max', label:'德育满分' }, { key:'moral_detail', label:'德育明细' },
  { key:'intellectual_score', label:'智育得分' }, { key:'intellectual_max', label:'智育满分' }, { key:'intellectual_detail', label:'智育明细' },
  { key:'physical_score', label:'体育得分' }, { key:'physical_max', label:'体育满分' }, { key:'physical_detail', label:'体育明细' },
  { key:'aesthetic_score', label:'美育得分' }, { key:'aesthetic_max', label:'美育满分' }, { key:'aesthetic_detail', label:'美育明细' },
  { key:'labor_score', label:'劳育得分' }, { key:'labor_max', label:'劳育满分' }, { key:'labor_detail', label:'劳育明细' },
]
</script>

<style scoped>
.form-page { display: flex; flex-direction: column; gap: 20px; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
@media (max-width: 768px) { .form-grid { grid-template-columns: 1fr; } }
.form-panel { padding: 0; }

.upload-zone {
  border: 2px dashed var(--color-border); border-radius: var(--radius-md);
  padding: 24px; text-align: center; cursor: pointer; color: var(--color-gray);
  font-size: 14px; transition: border-color 0.2s;
}
.upload-zone:hover { border-color: var(--color-primary); }

.tpl-list { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
.tpl-row {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 10px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-sm);
}

.placeholder-guide { margin-top: 8px; }
.placeholder-guide summary { cursor: pointer; font-size: 14px; color: var(--color-primary); }
.ph-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 12px; padding: 12px; background: #f8f9fa; border-radius: var(--radius-sm); }
.ph-grid code { font-size: 12px; }
.ph-grid code span { color: #999; }

.hint { font-size: 13px; color: #999; margin-bottom: 12px; }
.empty { text-align: center; color: var(--color-gray); padding: 30px 0; font-size: 14px; }

.btn { padding: 8px 20px; border: none; border-radius: var(--radius-btn); cursor: pointer; font-size: 14px; font-family: inherit; }
.btn.primary { background: var(--color-primary); color: #fff; }
.btn.sm { padding: 6px 16px; font-size: 13px; }
</style>
