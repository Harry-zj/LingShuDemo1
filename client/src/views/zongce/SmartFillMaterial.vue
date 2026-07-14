<template>
  <div class="material-page">
    <div class="add-bar">
      <button class="btn-create" @click="$emit('create')">
        <svg width="18" height="18" viewBox="0 0 18 18"><path d="M9 3v12M3 9h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        新建材料项
      </button>
      <span class="hint">上传证书/证明文件，AI 自动识别并计算分数</span>
    </div>

    <div v-if="!materials.length" class="empty-state">
      <span class="empty-icon">📂</span>
      <p>暂无材料，点击上方按钮创建第一个材料项</p>
    </div>

    <div class="card-grid">
      <div v-for="mat in materials" :key="mat.id" class="mat-card" :class="{ hasResult: mat.score_previews?.length }">
        <!-- 图片预览区 -->
        <div class="card-media" @click="toggleExpand(mat)">
          <template v-if="getImages(mat).length">
            <div class="media-scroll">
              <img v-for="(img, i) in getImages(mat)" :key="i" :src="img.url" :alt="img.name" class="media-img" loading="lazy" />
            </div>
            <span class="media-count" v-if="getImages(mat).length > 1">{{ getImages(mat).length }} 张</span>
          </template>
          <div v-else class="media-placeholder">
            <svg width="40" height="40" viewBox="0 0 40 40"><rect x="6" y="8" width="28" height="24" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6 26l8-8 6 6 4-4 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="14" cy="16" r="2.5" fill="currentColor"/></svg>
            <span>点击上传证明材料</span>
          </div>
          <div class="media-overlay" v-if="mat.score_previews?.length">
            <span class="overlay-badge" v-if="mat._bestCat">{{ mat._bestCat }}</span>
            <span class="overlay-score" v-if="mat.preview_summary?.confirmed_score > 0">+{{ mat.preview_summary.confirmed_score }}</span>
          </div>
        </div>

        <!-- 信息区 -->
        <div class="card-info">
          <div class="card-title-row">
            <span class="card-title">{{ mat.title || '未命名材料' }}</span>
            <span class="card-file-count" v-if="mat.attachments?.length">{{ mat.attachments.length }} 个文件</span>
          </div>
          <div class="card-tags" v-if="mat.attachments?.length">
            <span v-for="att in mat.attachments" :key="att.id" class="file-tag">
              {{ att.file_name }}
              <button class="tag-del" @click.stop="deleteAttach(mat.id, att.id)">×</button>
            </span>
          </div>
          <div class="card-actions">
            <button class="act-upload" @click="fileInputs[mat.id]?.click()">
              <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 2v8M3 6l4-4 4 4M2 10v1.5c0 .28.22.5.5.5h9a.5.5 0 00.5-.5V10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              上传
            </button>
            <input :ref="el => fileInputs[mat.id] = el" type="file" hidden multiple accept=".png,.jpg,.jpeg,.pdf,.docx" @change="e => onFiles(mat.id, e)" />
            <button v-if="!extractingIds.has(mat.id)" class="act-extract" :disabled="!mat.attachments?.length" @click="doExtract(mat)">AI 识别</button>
            <button v-else class="act-extract loading" disabled>识别中…</button>
            <button class="act-delete" @click="$emit('remove', mat.id)">删除</button>
          </div>

          <!-- ★ 识别结果（保留） -->
          <div v-if="mat.score_previews?.length" class="results-section">
            <div class="results-header">
              <span class="results-title">识别结果</span>
              <span class="results-count">{{ mat.score_previews.length }} 条匹配</span>
            </div>
            <div v-for="(sp, spi) in mat.score_previews" :key="spi" class="result-card" :class="{ confirmed: sp._confirmed }">
              <div class="res-top">
                <span class="res-indicator">{{ sp.indicator_code || sp.matched_rule?.category || '?' }}</span>
                <span class="res-name">{{ sp.matched_rule?.name || sp.indicator_name || '未识别' }}</span>
                <span class="res-sim" :class="sp.needs_review ? 'low' : 'ok'">{{ Math.round((sp.similarity_score||0)*100) }}%</span>
                <span v-if="sp._confirmed" class="res-done">✓ 已确认</span>
              </div>
              <div class="res-body">
                <div class="res-score-row">
                  <label>加分数</label>
                  <input v-model.number="sp.score_preview" type="number" class="res-score-inp" :disabled="sp._confirmed" min="0" />
                  <span>分</span>
                </div>
                <div class="res-desc-row">
                  <label>加分描述</label>
                  <button v-if="!sp._genDescLoading && !sp._confirmed" class="btn-ai-mini" @click.stop="genDesc(mat, sp, spi)">🤖 AI生成</button>
                  <span v-if="sp._genDescLoading">⏳ 生成中…</span>
                  <textarea v-model="sp.ai_description" rows="2" class="res-desc-inp" :placeholder="sp._confirmed ? '' : '输入或AI生成…'" :disabled="sp._confirmed"></textarea>
                </div>
              </div>
              <div class="res-footer" v-if="!sp._confirmed">
                <span class="res-score-hint">建议 +{{ sp.score_preview || 0 }} 分</span>
                <button class="btn-confirm" @click="doConfirmV3(mat, sp, spi)" :disabled="sp._confirming">{{ sp._confirming ? '确认中…' : '✓ 确认加分' }}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { watch, ref } from 'vue'
import * as api from '../../api/zongce'

const props = defineProps({ materials: Array })
const emit = defineEmits(['create', 'upload', 'remove', 'score-recalc'])
const fileInputs = {}
const extractingIds = ref(new Set())

function getImages(mat) {
  const imgs = []
  if (!mat.attachments) return imgs
  for (const att of mat.attachments) {
    const ext = (att.file_name || '').split('.').pop().toLowerCase()
    if (['png','jpg','jpeg','gif','webp','bmp'].includes(ext)) {
      // ★ OSS 完整 URL 直接使用，旧裸文件名走 /uploads/ 代理
      let url;
      if (att.file_path?.startsWith('http://') || att.file_path?.startsWith('https://')) {
        url = att.file_path;
      } else {
        url = `/uploads/${att.file_path || att.file_name}`;
      }
      imgs.push({ url, name: att.file_name })
    }
  }
  return imgs
}

function toggleExpand(mat) { /* future use */ }
function onFiles(matId, e) { const files = Array.from(e.target.files); if (files.length) emit('upload', matId, files) }

async function deleteAttach(matId, attId) {
  if (!confirm('确定删除该附件？')) return
  try {
    const res = await api.deleteAttachment(matId, attId)
    if (res.code === 200) {
      const mat = (props.materials || []).find(m => m.id === matId)
      if (mat && mat.attachments) mat.attachments = mat.attachments.filter(a => a.id !== attId)
    } else alert(res.msg || '删除失败')
  } catch (e) { alert('删除异常: ' + (e.response?.data?.msg || e.message)) }
}

async function doExtract(mat) {
  extractingIds.value.add(mat.id)
  try {
    const res = await api.extractMaterial(mat.id)
    if (res.code === 200) {
      mat.facts = (res.data.facts || []).map(f => ({ fact_id: f.fact_id || null, fact_data: f.fact_data || f }))
      mat.score_previews = (res.data.score_previews || []).map(sp => ({ ...sp, _confirmed: false, _confirming: false, _genDescLoading: false, ai_description: sp.ai_description || '' }))
    } else alert(res.msg)
  } catch (e) { alert('识别失败: ' + e.message) }
  extractingIds.value.delete(mat.id)
}

async function doConfirmV3(mat, sp, spi) {
  sp._confirming = true
  try {
    const res = await api.confirmMatchMaterial(mat.id, { material_id: mat.id, ef_id: sp._ef_id || 0, item_key: sp.indicator_code || sp.matched_rule?.category || '', score: sp.score_preview, description: sp.ai_description })
    if (res.code === 200) { sp._confirmed = true; emit('score-recalc') }
    else alert(res.msg || '确认失败')
  } catch (e) { alert('确认异常: ' + (e.response?.data?.msg || e.message)) }
  sp._confirming = false
}

async function genDesc(mat, sp, spi) {
  sp._genDescLoading = true
  try {
    const res = await api.generateMatchDescription(mat.id, { ef_id: sp._ef_id || 0, indicator_code: sp.indicator_code || sp.matched_rule?.category || '', score: sp.score_preview, fact_data: sp.fact_data || {} })
    if (res.code === 200 && res.data?.description) sp.ai_description = res.data.description
    else sp.ai_description = `获得${sp.matched_rule?.name || sp.indicator_name || '该维度'}加分${sp.score_preview}分`
  } catch (e) { sp.ai_description = `获得${sp.matched_rule?.name || sp.indicator_name || '该维度'}加分${sp.score_preview}分` }
  sp._genDescLoading = false
}

watch(() => props.materials, (mats) => {
  for (const mat of (mats || [])) {
    if (!mat._bestCat && mat.score_previews?.length) mat._bestCat = mat.score_previews[0].indicator_code || mat.score_previews[0].matched_rule?.category || ''
    if (mat.score_previews) mat.score_previews.forEach(sp => { sp._confirmed = sp._confirmed || !!sp.confirmed || false; sp._confirming = false })
  }
}, { deep: true, immediate: true })
</script>

<style scoped>
.material-page { display: flex; flex-direction: column; gap: 22px; }
.add-bar { display: flex; align-items: center; gap: 14px; }
.hint { font-size: 13px; color: var(--color-text-tertiary); }
.btn-create { display: inline-flex; align-items: center; gap: 6px; padding: 9px 18px; border: 1.5px dashed rgba(196,168,130,0.35); border-radius: 12px; background: rgba(196,168,130,0.06); color: #c4a882; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.2s; }
.btn-create:hover { background: rgba(196,168,130,0.14); border-color: rgba(196,168,130,0.55); }
.empty-state { text-align: center; padding: 56px 20px; color: var(--color-text-tertiary); }
.empty-icon { font-size: 40px; display: block; margin-bottom: 10px; }

.card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 18px; }

.mat-card { border-radius: 18px; overflow: hidden; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); backdrop-filter: blur(14px); transition: all 0.3s ease; display: flex; flex-direction: column; }
.mat-card:hover { border-color: rgba(196,168,130,0.20); box-shadow: 0 8px 32px rgba(0,0,0,0.18); }

.card-media { position: relative; width: 100%; height: 200px; overflow: hidden; background: rgba(0,0,0,0.15); cursor: pointer; display: flex; align-items: center; justify-content: center; }
.media-scroll { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; width: 100%; height: 100%; }
.media-scroll::-webkit-scrollbar { height: 3px; }
.media-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }
.media-img { scroll-snap-align: start; flex-shrink: 0; height: 100%; object-fit: cover; min-width: 100%; }
.media-count { position: absolute; bottom: 8px; right: 8px; padding: 3px 8px; border-radius: 8px; background: rgba(0,0,0,0.55); color: #fff; font-size: 11px; font-weight: 600; }
.media-placeholder { display: flex; flex-direction: column; align-items: center; gap: 8px; color: rgba(255,255,255,0.15); font-size: 12px; }
.media-overlay { position: absolute; top: 10px; left: 10px; display: flex; gap: 6px; }
.overlay-badge { padding: 3px 10px; border-radius: 8px; font-size: 11px; font-weight: 700; background: rgba(196,168,130,0.82); color: #fff; }
.overlay-score { padding: 3px 10px; border-radius: 8px; font-size: 11px; font-weight: 700; background: rgba(125,155,118,0.82); color: #fff; }

.card-info { padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
.card-title-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.card-title { font-size: 15px; font-weight: 600; color: var(--color-text); }
.card-file-count { font-size: 11px; color: var(--color-text-tertiary); }
.card-tags { display: flex; flex-wrap: wrap; gap: 4px; }
.file-tag { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 6px; font-size: 11px; background: rgba(255,255,255,0.05); color: var(--color-text-secondary); border: 1px solid rgba(255,255,255,0.06); }
.tag-del { width: 16px; height: 16px; border: none; border-radius: 50%; background: transparent; color: rgba(255,255,255,0.3); cursor: pointer; font-size: 12px; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
.tag-del:hover { background: rgba(220,80,80,0.6); color: #fff; }

.card-actions { display: flex; gap: 6px; padding-top: 4px; }
.card-actions button { padding: 6px 12px; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; font-size: 12px; font-weight: 500; cursor: pointer; font-family: inherit; background: rgba(255,255,255,0.03); color: var(--color-text-secondary); transition: all 0.15s; display: inline-flex; align-items: center; gap: 4px; }
.act-upload:hover { background: rgba(196,168,130,0.10); border-color: rgba(196,168,130,0.25); color: #c4a882; }
.act-extract { color: #7d9b76 !important; }
.act-extract:hover:not(:disabled) { background: rgba(125,155,118,0.12); border-color: rgba(125,155,118,0.25); }
.act-extract:disabled { opacity: 0.35; cursor: not-allowed; }
.act-extract.loading { opacity: 0.6; }
.act-delete:hover { background: rgba(220,80,80,0.08); border-color: rgba(220,80,80,0.25); color: #d44; }

/* ===== 识别结果 ===== */
.results-section { margin-top: 4px; display: flex; flex-direction: column; gap: 8px; }
.results-header { display: flex; align-items: center; justify-content: space-between; padding: 6px 0; }
.results-title { font-size: 13px; font-weight: 600; color: var(--color-text); }
.results-count { font-size: 11px; color: var(--color-text-tertiary); }
.results-empty { font-size: 13px; color: var(--color-text-tertiary); text-align: center; padding: 12px; }

.result-card { padding: 12px; border-radius: 12px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); }
.result-card.confirmed { background: rgba(125,155,118,0.05); border-color: rgba(125,155,118,0.12); }
.res-top { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.res-indicator { font-size: 12px; font-weight: 700; padding: 2px 8px; border-radius: 5px; background: rgba(196,168,130,0.15); color: #c4a882; }
.res-name { font-size: 13px; font-weight: 600; flex: 1; color: var(--color-text); }
.res-sim { font-size: 11px; padding: 2px 7px; border-radius: 6px; }
.res-sim.ok { background: rgba(125,155,118,0.12); color: #7d9b76; }
.res-sim.low { background: rgba(196,168,130,0.12); color: #c4a882; }
.res-done { font-size: 11px; color: #7d9b76; font-weight: 600; }

.res-body { display: flex; flex-direction: column; gap: 6px; }
.res-body label { font-size: 11px; color: var(--color-text-tertiary); display: block; margin-bottom: 2px; }
.res-score-inp { width: 64px; padding: 6px 8px; border: 1.5px solid rgba(255,255,255,0.10); border-radius: 8px; font-size: 15px; font-weight: 700; text-align: center; color: #c4a882; background: rgba(255,255,255,0.04); font-family: inherit; }
.res-score-inp:disabled { background: rgba(255,255,255,0.02); color: #7d9b76; border-color: rgba(125,155,118,0.15); }
.res-desc-inp { width: 100%; padding: 6px 10px; border: 1.5px solid rgba(255,255,255,0.08); border-radius: 8px; font-size: 12px; font-family: inherit; background: rgba(255,255,255,0.03); color: var(--color-text); resize: vertical; min-height: 44px; box-sizing: border-box; }

.btn-ai-mini { padding: 3px 10px; border: 1px solid rgba(196,168,130,0.22); border-radius: 8px; background: rgba(196,168,130,0.08); color: #c4a882; font-size: 11px; cursor: pointer; font-family: inherit; margin-left: 8px; }
.btn-ai-mini:hover { background: rgba(196,168,130,0.18); }

.res-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.04); }
.res-score-hint { font-size: 13px; font-weight: 600; color: #c4a882; }
.btn-confirm { padding: 6px 16px; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; background: rgba(125,155,118,0.20); color: #7d9b76; transition: all 0.2s; }
.btn-confirm:hover:not(:disabled) { background: rgba(125,155,118,0.35); }
.btn-confirm:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
