<template>
  <div class="smart-fill">
    <div class="top-bar">
      <div class="top-bar-left">
        <h2>智能填表</h2>
        <p class="top-bar-desc">上传材料，AI 自动识别并匹配填表</p>
      </div>
      <div class="actions">
        <button class="btn-upload" @click="triggerUpload">
          <VIcon icon="mdi:upload-outline" />
          上传材料
        </button>
        <input type="file" ref="fileInput" multiple hidden @change="handleUpload" />
        <button class="btn-ai" @click="handleAiMatch" :disabled="!materials.length">
          <VIcon icon="mdi:lightning-bolt-outline" />
          AI 智能匹配
        </button>
      </div>
    </div>
    <div class="workspace">
      <section class="panel glass-panel material-panel">
        <div class="panel-header">
          <h3><VIcon icon="mdi:archive-outline" />材料库</h3>
          <span class="panel-count">{{ materials.length }} 项</span>
        </div>
        <div class="material-grid">
          <div class="material-card" v-for="(item, index) in materials" :key="item.id"
            :style="{ animationDelay: (index * 0.06) + 's' }">
            <div class="card-top">
              <VIcon icon="mdi:file-document-outline" class="file-icon" />
              <span class="card-label">{{ getLabel(item) }}</span>
            </div>
            <span class="card-badge" :style="getBadgeStyle(item.status)">{{ getStatusLabel(item.status) }}</span>
          </div>
          <div class="material-card empty-state" v-if="materials.length === 0">
            <VIcon icon="mdi:inbox-outline" class="empty-icon" />
            <p>暂无材料</p>
            <span>点击上方「上传材料」按钮添加</span>
          </div>
        </div>
      </section>
      <section class="panel glass-panel preview-panel">
        <div class="panel-header">
          <h3><VIcon icon="mdi:table-eye" />填报预览</h3>
        </div>
        <div class="preview-placeholder">
          <VIcon icon="mdi:table-large" class="placeholder-icon" />
          <p>AI 完成匹配后，表格填写结果将在这里实时显示</p>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getMaterials, uploadFile, aiMatch } from '../../api/module1'
import { STATUS_MAP } from '../../utils/constants'
const materials = ref([])
const fileInput = ref(null)
function getLabel(item) { return item.ai_label || item.title || '未标注' }
function getStatusLabel(s) { return STATUS_MAP[s]?.label || s }
function getBadgeStyle(s) { const m = STATUS_MAP[s]; return m ? { background: m.bg, color: m.color } : {} }
async function loadMaterials() { const res = await getMaterials(); if (res.code === 200) materials.value = res.data || [] }
function triggerUpload() { fileInput.value?.click() }
async function handleUpload(e) { const files = e.target.files; if (!files.length) return; const fd = new FormData(); fd.append('file', files[0]); fd.append('material_id', '1'); await uploadFile(fd); loadMaterials() }
async function handleAiMatch() { await aiMatch({ material_id: materials.value[0]?.id }); alert('AI智能匹配功能由组员实现') }
onMounted(loadMaterials)
</script>

<style scoped>
.smart-fill { display: flex; flex-direction: column; gap: 24px; animation: fadeIn 0.4s var(--easing-decelerate); }
.top-bar { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
.top-bar-left h2 { font-size: 22px; font-weight: var(--font-weight-semibold); color: var(--color-text); }
.top-bar-desc { font-size: 14px; color: var(--color-text-secondary); margin-top: 2px; }

.actions { display: flex; gap: 10px; }
.btn-upload, .btn-ai {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 10px 20px; border-radius: var(--radius-full);
  font-size: 14px; font-weight: var(--font-weight-medium);
  cursor: pointer; transition: all var(--duration-fast) var(--easing-spring);
}
.btn-upload { border: 1px solid var(--color-border); background: var(--color-white); color: var(--color-text); }
.btn-upload:hover { border-color: var(--color-primary); color: var(--color-primary); box-shadow: var(--shadow-level-2); transform: translateY(-1px); }
.btn-ai { border: none; background: var(--color-primary-gradient); color: white; box-shadow: var(--shadow-level-1); }
.btn-ai:hover:not(:disabled) { box-shadow: var(--shadow-elevated); transform: translateY(-1px); }
.btn-ai:active:not(:disabled) { transform: translateY(0) scale(0.98); }
.btn-ai:disabled { opacity: 0.5; cursor: not-allowed; }

.workspace { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; flex: 1; }

/* ---- 玻璃质感面板 ---- */
.glass-panel {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  padding: 24px;
  box-shadow: var(--glass-shadow);
  transition: all var(--duration-normal) var(--easing-standard);
  animation: fadeInUp 0.5s var(--easing-spring) both;
}
.glass-panel:nth-child(2) { animation-delay: 0.1s; }
.glass-panel:hover { box-shadow: var(--glass-shadow-hover); }

.panel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.panel-header h3 { font-size: 16px; font-weight: var(--font-weight-semibold); color: var(--color-text); display: flex; align-items: center; gap: 8px; }
.panel-header h3 VIcon { font-size: 20px; color: var(--color-primary); }
.panel-count { font-size: 13px; color: var(--color-text-secondary); background: var(--color-gray-bg); padding: 2px 10px; border-radius: var(--radius-full); }

.material-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
.material-card {
  padding: 16px; border-radius: var(--radius-md);
  border: 1px solid var(--color-border); display: flex; flex-direction: column; gap: 10px;
  opacity: 0; animation: fadeInUp 0.4s var(--easing-spring) forwards;
  transition: all var(--duration-fast) var(--easing-spring); cursor: default;
}
.material-card:hover { border-color: transparent; box-shadow: var(--shadow-level-2); transform: translateY(-2px); }
.card-top { display: flex; align-items: flex-start; gap: 8px; }
.file-icon { font-size: 18px; color: var(--color-primary); flex-shrink: 0; margin-top: 1px; }
.card-label { font-size: 14px; color: var(--color-text); line-height: var(--line-height-normal); word-break: break-all; }
.card-badge { font-size: 11px; padding: 2px 8px; border-radius: var(--radius-sm); align-self: flex-start; font-weight: var(--font-weight-medium); }

.empty-state { text-align: center; padding: 32px 16px; border-style: dashed; display: flex; flex-direction: column; align-items: center; gap: 8px; opacity: 1 !important; animation: none !important; }
.empty-icon { font-size: 36px; color: var(--color-text-tertiary); margin-bottom: 4px; }
.empty-state p { font-size: 14px; font-weight: var(--font-weight-medium); color: var(--color-text-secondary); }
.empty-state span { font-size: 12px; color: var(--color-text-tertiary); }

.preview-placeholder {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; height: 300px;
  border: 2px dashed var(--color-border); border-radius: var(--radius-lg);
  color: var(--color-gray); transition: all var(--duration-normal) var(--easing-standard);
}
.preview-placeholder:hover { border-color: var(--color-primary-light); background: var(--gradient-primary-subtle); }
.placeholder-icon { font-size: 48px; color: var(--color-text-tertiary); }

@media (max-width: 768px) { .workspace { grid-template-columns: 1fr; } .top-bar { flex-direction: column; } }
</style>
