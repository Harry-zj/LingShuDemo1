<template>
  <div class="smart-fill">
    <div class="top-bar">
      <h2>智能填表</h2>
      <div class="actions">
        <button class="btn-upload" @click="triggerUpload">+ 上传材料</button>
        <input type="file" ref="fileInput" multiple hidden @change="handleUpload" />
        <button class="btn-ai" @click="handleAiMatch">AI 智能匹配</button>
      </div>
    </div>
    <div class="workspace">
      <section class="material-panel">
        <h3>材料库</h3>
        <div class="material-grid">
          <div class="material-card" v-for="item in materials" :key="item.id">
            <span class="card-label">{{ getLabel(item) }}</span>
            <span class="card-badge" :style="getBadgeStyle(item.status)">{{ getStatusLabel(item.status) }}</span>
          </div>
          <div class="material-card empty" v-if="materials.length === 0">
            <span>暂无材料，点击上方按钮上传</span>
          </div>
        </div>
      </section>
      <section class="preview-panel">
        <h3>填报预览</h3>
        <div class="preview-placeholder">
          <p>AI 完成匹配后，表格填写结果将在这里实时显示</p>
        </div>
      </section>
    </div>
  </div>
</template>
<script setup>
import { ref, onMounted } from "vue"
import { getMaterials, uploadFile, aiMatch } from "../../api/module1"
import { STATUS_MAP } from "../../utils/constants"
const materials = ref([])
const fileInput = ref(null)
function getLabel(item) { return item.ai_label || item.title || "未标注" }
function getStatusLabel(s) { return STATUS_MAP[s]?.label || s }
function getBadgeStyle(s) { const m = STATUS_MAP[s]; return m ? { background: m.bg, color: m.color } : {} }
async function loadMaterials() { const res = await getMaterials(); if (res.code === 200) materials.value = res.data || [] }
function triggerUpload() { fileInput.value?.click() }
async function handleUpload(e) { const files = e.target.files; if (!files.length) return; const fd = new FormData(); fd.append("file", files[0]); fd.append("material_id", "1"); await uploadFile(fd); loadMaterials() }
async function handleAiMatch() { await aiMatch({ material_id: materials.value[0]?.id }); alert("AI智能匹配功能由组员实现") }
onMounted(loadMaterials)
</script>
<style scoped>
.smart-fill { display: flex; flex-direction: column; gap: 24px }
.top-bar { display: flex; justify-content: space-between; align-items: center }
.top-bar h2 { font-size: 24px }
.actions { display: flex; gap: 12px }
.btn-upload { padding: 10px 24px; border: 1px solid var(--color-primary); border-radius: var(--radius-btn); background: var(--color-white); color: var(--color-primary); cursor: pointer }
.btn-ai { padding: 10px 24px; border: none; border-radius: var(--radius-btn); background: var(--color-primary); color: #fff; cursor: pointer }
.workspace { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; flex: 1 }
.material-panel, .preview-panel { background: var(--color-white); border-radius: var(--radius-card); border: 1px solid var(--color-border); padding: 24px }
.material-panel h3, .preview-panel h3 { font-size: 16px; margin-bottom: 16px }
.material-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px }
.material-card { padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--color-border); display: flex; flex-direction: column; gap: 8px }
.material-card.empty { text-align: center; color: var(--color-gray); font-size: 14px }
.card-label { font-size: 14px; color: var(--color-text) }
.card-badge { font-size: 12px; padding: 2px 8px; border-radius: var(--radius-tag); align-self: flex-start }
.preview-placeholder { display: flex; align-items: center; justify-content: center; height: 300px; border: 2px dashed var(--color-border); border-radius: var(--radius-md); color: var(--color-gray); font-size: 14px }
@media (max-width: 768px) { .workspace { grid-template-columns: 1fr } }
</style>