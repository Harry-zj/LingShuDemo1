<template>
  <div class="material-page">
    <div class="add-bar">
      <button class="btn primary" @click="$emit('create')">+ 新建材料项</button>
      <span class="hint">上传证书/证明文件，AI 自动识别并计算分数</span>
    </div>

    <div v-if="!materials.length" class="empty">暂无材料，点击上方按钮创建</div>

    <div v-for="mat in materials" :key="mat.id" class="material-item">
      <div class="mat-top">
        <div class="mat-left">
          <span class="mat-title">{{ mat.title || '未命名材料' }}</span>
          <span v-if="mat.attachments?.length" class="file-count">{{ mat.attachments.length }} 文件</span>
          <template v-if="mat.preview_summary">
            <span v-if="mat._bestCat" class="tag-cat">{{ mat._bestCat }}</span>
            <template v-if="mat.preview_summary.scored_fact_count > 0 && mat.preview_summary.candidate_fact_count === 0">
              <span v-if="mat.preview_summary.confirmed_score > 0" class="tag-score plus">+{{ mat.preview_summary.confirmed_score }}</span>
              <span v-else class="tag-score zero">0</span>
            </template>
            <template v-else-if="mat.preview_summary.candidate_fact_count > 0">
              <span v-if="mat.preview_summary.scored_fact_count > 0" class="tag-score plus">+{{ mat.preview_summary.confirmed_score }}</span>
              <span class="tag-score candidate">+{{ mat.preview_summary.candidate_score }}待确认</span>
            </template>
            <span v-else-if="mat.preview_summary.total_fact_count > 0 && mat.preview_summary.scored_fact_count === 0" class="tag-score na-label">
              {{ mat.preview_summary.failed_fact_count > 0 ? '维度待映射' : '待计算' }}
            </span>
            <span v-else-if="!mat.preview_summary.total_fact_count" class="tag-score na-label">待提取</span>
          </template>
          <span v-else-if="mat.facts?.length" class="tag-score na-label">待计算</span>
        </div>
        <div class="mat-right">
          <template v-if="!mat.facts?.length">
            <button class="btn-text" @click="fileInputs[mat.id]?.click()">+ 上传证明</button>
            <input :ref="el => fileInputs[mat.id] = el" type="file" hidden multiple accept=".png,.jpg,.jpeg,.pdf,.docx" @change="e => onFiles(mat.id, e)" />
            <button v-if="!extractingIds.has(mat.id)" class="btn primary sm" @click="doExtract(mat)" :disabled="!mat.attachments?.length">AI 识别</button>
            <button v-else class="btn primary sm" disabled>识别中...</button>
          </template>
          <button class="btn-text danger" @click="$emit('remove', mat.id)">删除</button>
        </div>
      </div>

      <div v-if="mat.attachments?.length" class="attach-row">
        <span v-for="att in mat.attachments" :key="att.id" class="attach-tag">{{ att.file_name }}</span>
      </div>

      <template v-if="mat.facts?.length">
        <div class="extract-card">
          <div class="extract-header clickable" @click="toggleCollapse(mat.id)">
            <span class="eh-left">
              <span class="eh-arrow">{{ collapsedMap[mat.id] ? '▶' : '▼' }}</span>
              <span class="eh-title">识别结果</span>
              <span class="eh-status" :class="statusLabel(mat)">{{ statusLabel(mat) }}</span>
              <span v-if="matchedCount(mat) < mat.facts.length" class="match-progress">
                <span class="spinner-sm"></span> 匹配规则 {{ matchedCount(mat) }}/{{ mat.facts.length }}
              </span>
            </span>
            <button class="btn-text sm" @click.stop="doExtract(mat)">🔄 重新识别</button>
          </div>

          <div v-show="!collapsedMap[mat.id]" class="extract-body">
          <!-- V3 简化匹配卡片 -->
          <template v-if="mat.score_previews && mat.score_previews.length">
            <div v-for="(sp, spi) in mat.score_previews" :key="spi"
              class="match-card-v3"
              :class="{ confirmed: sp._confirmed, 'needs-review': sp.needs_review }">

              <!-- 卡片头部：维度标签 + 匹配度 -->
              <div class="match-header-v3">
                <div class="mh-left">
                  <span class="cat-badge">{{ sp.indicator_code || sp.matched_rule?.category || '?' }}</span>
                  <span class="cat-name">{{ sp.matched_rule?.name || sp.indicator_name || '未识别' }}</span>
                </div>
                <div class="mh-right">
                  <span class="sim-badge" :class="sp.needs_review ? 'sim-low' : 'sim-ok'">
                    <svg width="12" height="12" viewBox="0 0 12 12" style="vertical-align:-2px;margin-right:2px">
                      <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" stroke-width="1.2"/>
                      <path d="M6 3.5v3.5M6 8.2v.3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                    </svg>
                    匹配 {{ Math.round((sp.similarity_score||0)*100) }}%
                  </span>
                  <span v-if="sp._confirmed" class="confirmed-badge">✓ 已确认</span>
                </div>
              </div>

              <!-- 卡片主体：得分 + 加分描述 -->
              <div class="match-body-v3">
                <!-- 得分行 -->
                <div class="score-row-v3">
                  <div class="sr-label">
                    <svg width="14" height="14" viewBox="0 0 14 14" style="vertical-align:-2px">
                      <polygon points="7,1 9.5,5 14,5.8 10.5,9.5 11.3,14 7,11.5 2.7,14 3.5,9.5 0,5.8 4.5,5" fill="currentColor" opacity="0.8"/>
                    </svg>
                    <span>加分数</span>
                  </div>
                  <div class="sr-input-group">
                    <input v-model.number="sp.score_preview" type="number" class="score-inp-v3"
                      :disabled="sp._confirmed" :min="0" />
                    <span class="sr-unit">分</span>
                  </div>
                </div>

                <!-- 描述行 -->
                <div class="desc-row-v3">
                  <div class="sr-label">
                    <svg width="14" height="14" viewBox="0 0 14 14" style="vertical-align:-2px">
                      <rect x="1" y="3" width="12" height="9" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.2"/>
                      <line x1="3.5" y1="6.5" x2="10.5" y2="6.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                      <line x1="3.5" y1="9" x2="8.5" y2="9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                    </svg>
                    <span>加分描述</span>
                    <button v-if="!sp._genDescLoading && !sp._confirmed" class="btn-ai-sm" @click.stop="generateDescription(mat, sp, spi)" title="AI 生成描述">
                      🤖 生成
                    </button>
                    <span v-if="sp._genDescLoading" class="gen-desc-loading">⏳ 生成中...</span>
                  </div>
                  <div class="desc-input-wrap">
                    <textarea v-model="sp.ai_description" rows="2" class="desc-input-v3"
                      :placeholder="sp._confirmed ? '' : '输入加分描述或点击 AI 生成...'"
                      :disabled="sp._confirmed"></textarea>
                  </div>
                </div>
              </div>

              <!-- 卡片底部：确认按钮 -->
              <div class="match-footer-v3">
                <div v-if="sp._confirmed" class="confirmed-info">
                  <svg width="16" height="16" viewBox="0 0 16 16" style="vertical-align:-3px">
                    <circle cx="8" cy="8" r="7" fill="#34A853"/>
                    <polyline points="5,8.5 7.5,11 11,5.5" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <span>已确认</span>
                </div>
                <div v-else class="footer-actions">
                  <div class="footer-score-summary">
                    <span class="fss-label">规则建议:</span>
                    <span class="fss-value">+{{ sp.score_preview || 0 }} 分</span>
                  </div>
                  <button class="btn-confirm" @click="doConfirmV3(mat, sp, spi)"
                    :disabled="sp._confirming">
                    <svg v-if="sp._confirming" class="spinning" width="14" height="14" viewBox="0 0 14 14">
                      <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="20" stroke-dashoffset="5"/>
                    </svg>
                    <span v-else>✓</span>
                    {{ sp._confirming ? '确认中...' : '确认加分' }}
                  </button>
                </div>
              </div>
            </div>
          </template>
          <div v-else class="no-match-v3">
            <div class="no-match-icon">📋</div>
            <div class="no-match-title">暂未匹配到计分规则</div>
            <div class="no-match-desc">请确认已有已发布的规则集，且规则数据正常</div>
          </div>
          </div>
        </div>
      </template>

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
const collapsedMap = ref({})
function toggleCollapse(matId) { collapsedMap.value[matId] = !collapsedMap.value[matId] }

watch(() => props.materials, (mats) => {
  for (const mat of (mats || [])) {
    // 从 facts 或 score_previews 更新 _bestCat（材料列表分类标签）
    if (!mat._bestCat) {
      if (mat.score_previews?.length) {
        mat._bestCat = mat.score_previews[0].indicator_code || mat.score_previews[0].matched_rule?.category || ''
      } else if (mat.facts?.length) {
        for (const f of mat.facts) {
          if (f.match?.indicator?.code) { mat._bestCat = f.match.indicator.code; break }
        }
      }
    }
    if (!(mat.id in collapsedMap.value)) { collapsedMap.value[mat.id] = allConfirmed(mat) }
    if (mat.score_previews) mat.score_previews.forEach(sp => {
      sp._confirmed = sp._confirmed || !!sp.confirmed || false;
      sp._confirming = false;
    })
  }
}, { deep: true, immediate: true })

function onFiles(matId, e) {
  const files = Array.from(e.target.files)
  if (files.length) emit('upload', matId, files)
}
function allConfirmed(mat) { return mat.facts?.length && mat.facts.every(f => f.match?.review_status === 'confirmed' || f.fact_data?.confirmed === true) }
function someConfirmed(mat) { return mat.facts?.some(f => f.match?.review_status === 'confirmed' || f.fact_data?.confirmed === true) }
function statusLabel(mat) {
  if (!mat.facts?.length) return '待提取'
  if (allConfirmed(mat)) return '已入库'
  if (someConfirmed(mat)) return '部分已确认'
  return '待确认'
}
function matchedCount(mat) { return (mat.facts || []).filter(f => f.match || (f.fact_data && f.fact_data.match_score != null)).length }

async function doExtract(mat) {
  extractingIds.value.add(mat.id)
  try {
    const res = await api.extractMaterial(mat.id)
    if (res.code === 200) {
      mat.facts = (res.data.facts || []).map(f => ({
        fact_id: f.fact_id || null,
        fact_data: f.fact_data || f,
      }))
      mat.score_previews = (res.data.score_previews || []).map(sp => ({
        ...sp,
        _confirmed: false,
        _confirming: false,
        _genDescLoading: false,
        ai_description: sp.ai_description || '',
      }))
      collapsedMap.value[mat.id] = false
    } else { alert(res.msg) }
  } catch (e) { alert('识别失败: ' + e.message) }
  extractingIds.value.delete(mat.id)
}

// ★ 使用 API 模块（携带 auth token）代替 raw fetch，修复 401 错误
async function doConfirmV3(mat, sp, spi) {
  sp._confirming = true
  try {
    const res = await api.confirmMatchMaterial(mat.id, {
      material_id: mat.id,
      ef_id: sp._ef_id || 0,
      item_key: sp.indicator_code || sp.matched_rule?.category || '',
      score: sp.score_preview,
      description: sp.ai_description
    })
    if (res.code === 200) { sp._confirmed = true; sp._confirmedAt = new Date().toLocaleString(); if (mat.facts) mat.facts.forEach(f => { if (f.fact_data && (f.fact_data._ef_id === sp._ef_id || f.fact_id === sp._ef_id)) { f.fact_data.confirmed = true; if (f.match) f.match.review_status = 'confirmed'; } }); collapsedMap.value[mat.id] = allConfirmed(mat); emit('score-recalc')
    } else {
      alert(res.msg || '确认失败')
    }
  } catch(e) {
    alert('确认异常: ' + (e.response?.data?.msg || e.message))
  }
  sp._confirming = false
}

// ★ AI 生成加分描述
async function generateDescription(mat, sp, spi) {
  sp._genDescLoading = true
  try {
    const res = await api.generateMatchDescription(mat.id, {
      ef_id: sp._ef_id || 0,
      indicator_code: sp.indicator_code || sp.matched_rule?.category || '',
      score: sp.score_preview,
      fact_data: sp.fact_data || {}
    })
    if (res.code === 200 && res.data?.description) {
      sp.ai_description = res.data.description
    } else {
      // 后端未返回时自动生成一条默认描述
      sp.ai_description = `获得${sp.matched_rule?.name || sp.indicator_name || '该维度'}加分${sp.score_preview}分`
    }
  } catch(e) {
    // 网络失败时也使用本地默认描述
    sp.ai_description = `获得${sp.matched_rule?.name || sp.indicator_name || '该维度'}加分${sp.score_preview}分`
  }
  sp._genDescLoading = false
}
</script>

<style scoped>
.material-page { display: flex; flex-direction: column; gap: 16px; }

/* ===== 顶部栏 ===== */
.add-bar { display: flex; align-items: center; gap: 16px; }
.add-bar .hint { font-size: 13px; color: var(--color-text-tertiary); }

/* ===== 按钮 ===== */
.btn { padding: 8px 20px; border: none; border-radius: var(--radius-btn); cursor: pointer; font-size: 14px; font-family: inherit; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn.primary { background: var(--color-primary); color: #fff; }
.btn.sm { padding: 6px 16px; font-size: 13px; }
.btn-text { padding: 6px 14px; border: 1px solid var(--color-border); border-radius: var(--radius-btn); background: var(--color-surface); cursor: pointer; font-size: 13px; font-family: inherit; color: var(--color-text); }
.btn-text.danger { color: #D93025; border-color: transparent; }
.btn-text.sm { font-size: 12px; padding: 2px 8px; }

/* ===== 材料项 ===== */
.material-item { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-card); padding: 16px; }
.mat-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.mat-left { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; flex: 1; }
.mat-title { font-size: 15px; font-weight: 600; color: var(--color-text); }
.mat-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.file-count { font-size: 12px; color: var(--color-text-tertiary); background: var(--color-surface-variant); padding: 2px 8px; border-radius: var(--radius-tag); }
.attach-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.attach-tag { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; padding: 3px 8px; background: var(--color-surface-variant); border-radius: var(--radius-tag); }
.empty { text-align: center; color: var(--color-gray); padding: 40px 0; }
.tag-cat { font-size: 12px; padding: 3px 10px; border-radius: 12px; background: #e8f0fe; color: #1a73e8; font-weight: 500; }
.tag-score { font-size: 12px; padding: 2px 8px; border-radius: 10px; font-weight: 600; }
.tag-score.plus { background: #e6f4ea; color: #34A853; }
.tag-score.zero { background: #f1f3f4; color: #888; }
.tag-score.candidate { background: #fef7e0; color: #E37400; }
.tag-score.na-label { background: #f1f3f4; color: #888; }

/* ===== 识别结果卡片 ===== */
.extract-card { margin-top: 12px; border: 1px solid var(--color-border); border-radius: 10px; overflow: hidden; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.04); }
.extract-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: linear-gradient(135deg, #f8faff, #f0f4ff); border-bottom: 1px solid #e8edf2; font-size: 14px; }
.extract-header.clickable { cursor: pointer; }
.extract-header.clickable:hover { background: linear-gradient(135deg, #f0f4ff, #e8f0fe); }
.eh-left { display: flex; align-items: center; gap: 8px; }
.eh-arrow { font-size: 11px; color: #8892a0; width: 14px; flex-shrink: 0; }
.eh-title { font-weight: 600; color: #1a1a2e; }
.eh-status { font-size: 11px; padding: 2px 10px; border-radius: 20px; background: #f1f3f4; color: #888; font-weight: 500; }
.eh-status.已入库 { background: #e6f4ea; color: #34A853; }
.eh-status.部分已确认 { background: #fef7e0; color: #E37400; }
.eh-status.待确认 { background: #fef7e0; color: #E37400; }
.eh-status.待提取 { background: #e8f0fe; color: #1a73e8; }
.match-progress { font-size: 12px; color: #E37400; font-weight: 400; display: inline-flex; align-items: center; gap: 4px; }
.spinner-sm { display: inline-block; width: 12px; height: 12px; border: 2px solid #f0c040; border-top-color: transparent; border-radius: 50%; animation: spin-sm .8s linear infinite; }
@keyframes spin-sm { to { transform: rotate(360deg); } }

.extract-body { padding: 4px 16px 16px; }

/* ===== V3 匹配卡片 - 全新美化样式 ===== */
.match-card-v3 {
  border: 1px solid #e4e8ef;
  border-radius: 12px;
  padding: 16px;
  margin: 12px 0;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,.04);
  transition: all .2s ease;
}
.match-card-v3:hover {
  box-shadow: 0 4px 16px rgba(0,0,0,.08);
  border-color: #c8d0dd;
}
.match-card-v3.confirmed {
  background: #f6faf8;
  border-color: #b8d8c8;
  box-shadow: 0 1px 4px rgba(52,168,83,.08);
}
.match-card-v3.needs-review {
  border-left: 3px solid #E37400;
}

/* 卡片头部 */
.match-header-v3 {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f2f5;
}
.mh-left { display: flex; align-items: center; gap: 10px; }
.mh-right { display: flex; align-items: center; gap: 8px; }
.cat-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  height: 26px;
  padding: 0 10px;
  border-radius: 6px;
  font-weight: 700;
  font-size: 13px;
  background: linear-gradient(135deg, #4A90D9, #357ABD);
  color: #fff;
  letter-spacing: .5px;
}
.cat-name { font-weight: 600; font-size: 14px; color: #2c3e50; }
.sim-badge {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 20px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
}
.sim-ok { background: #e6f4ea; color: #34A853; }
.sim-low { background: #fef7e0; color: #E37400; }
.confirmed-badge {
  font-size: 11px;
  padding: 2px 10px;
  border-radius: 20px;
  background: #34A853;
  color: #fff;
  font-weight: 600;
}

/* 卡片主体 */
.match-body-v3 { display: flex; flex-direction: column; gap: 10px; }
.sr-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #5a6a7a;
  margin-bottom: 6px;
}
.sr-label svg { color: #8892a0; flex-shrink: 0; }

/* 得分行 */
.score-row-v3 {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: #f8faff;
  border-radius: 8px;
  border: 1px solid #e8edf5;
}
.sr-input-group {
  display: flex;
  align-items: center;
  gap: 4px;
}
.score-inp-v3 {
  width: 64px;
  padding: 7px 10px;
  border: 1.5px solid #d0d8e5;
  border-radius: 8px;
  font-size: 18px;
  font-weight: 700;
  text-align: center;
  color: #1a73e8;
  background: #fff;
  transition: all .2s;
}
.score-inp-v3:focus {
  outline: none;
  border-color: #1a73e8;
  box-shadow: 0 0 0 3px rgba(26,115,232,.1);
}
.score-inp-v3:disabled {
  background: #f0f2f5;
  color: #34A853;
  border-color: #b8d8c8;
}
.sr-unit { font-size: 14px; color: #8892a0; font-weight: 500; }

/* 描述行 */
.desc-row-v3 {
  padding: 10px 14px;
  background: #fafbfc;
  border-radius: 8px;
  border: 1px solid #eef0f4;
}
.desc-input-wrap { position: relative; }
.desc-input-v3 {
  width: 100%;
  padding: 10px 12px;
  border: 1.5px solid #e0e4ea;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.5;
  font-family: inherit;
  resize: vertical;
  transition: all .2s;
  background: #fff;
  box-sizing: border-box;
  min-height: 48px;
  color: #333;
}
.desc-input-v3:focus {
  outline: none;
  border-color: #4A90D9;
  box-shadow: 0 0 0 3px rgba(74,144,217,.08);
}
.desc-input-v3:disabled {
  background: #f5f6f8;
  color: #555;
  border-color: #e0e4ea;
}
.desc-input-v3::placeholder { color: #b0b8c4; font-size: 12px; }

.btn-ai-sm {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 10px;
  font-size: 12px;
  font-family: inherit;
  border: 1px solid #c8d8f0;
  border-radius: 12px;
  background: linear-gradient(135deg, #f0f6ff, #e8f0fe);
  color: #4A90D9;
  cursor: pointer;
  transition: all .2s;
  margin-left: 4px;
}
.btn-ai-sm:hover { background: linear-gradient(135deg, #d6e4ff, #c8d8f0); border-color: #4A90D9; }
.gen-desc-loading { font-size: 11px; color: #E37400; margin-left: 4px; }

/* 卡片底部 */
.match-footer-v3 {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid #f0f2f5;
}
.confirmed-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #34A853;
  font-weight: 500;
  padding: 6px 12px;
  background: #f0faf4;
  border-radius: 8px;
}
.footer-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.footer-score-summary {
  display: flex;
  align-items: center;
  gap: 4px;
}
.fss-label { font-size: 12px; color: #8892a0; }
.fss-value { font-size: 16px; font-weight: 700; color: #E37400; }

.btn-confirm {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 20px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  background: linear-gradient(135deg, #34A853, #2d9249);
  color: #fff;
  cursor: pointer;
  transition: all .2s;
  box-shadow: 0 2px 6px rgba(52,168,83,.2);
}
.btn-confirm:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(52,168,83,.3);
}
.btn-confirm:disabled {
  opacity: .6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}
.spinning { animation: spin-btn .8s linear infinite; }
@keyframes spin-btn { to { transform: rotate(360deg); } }

/* 无匹配提示 */
.no-match-v3 {
  padding: 30px 20px;
  text-align: center;
}
.no-match-icon { font-size: 36px; margin-bottom: 8px; }
.no-match-title { font-size: 15px; font-weight: 600; color: #666; margin-bottom: 4px; }
.no-match-desc { font-size: 13px; color: #999; }

/* 老版预览样式（保留兼容） */
.preview-block { margin-top: 10px; padding: 12px; background: #fff; border: 1px solid #e8e8e8; border-radius: 6px; }
.preview-block.matching-block { background: #fef9e7; border-color: #f0c040; }
.preview-status { margin-bottom: 8px; display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.badge { display: inline-block; font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 500; }
.badge.ok { background: #e6f4ea; color: #34A853; }
.badge.review { background: #fef7e0; color: #E37400; }
.badge.conflict { background: #fce8e6; color: #D93025; }
.badge.matching { background: #e8f0fe; color: #1a73e8; animation: pulse 1.5s infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
.preview-body { display: flex; flex-direction: column; gap: 6px; }
.preview-row { display: flex; align-items: baseline; gap: 8px; font-size: 13px; padding: 4px 0; }
.preview-row label { font-size: 11px; color: var(--color-text-tertiary); min-width: 48px; text-align: right; }
.preview-row b { color: var(--color-primary); }
.reason-text { color: var(--color-text); line-height: 1.5; font-style: italic; background: #f8f9fa; padding: 4px 8px; border-radius: 4px; border-left: 3px solid #1a73e8; }
.rule-type-tag { font-size: 10px; background: #e8f0fe; color: #1a73e8; padding: 1px 6px; border-radius: 8px; }
.preview-score { display: flex; align-items: center; gap: 6px; margin-top: 6px; padding-top: 8px; border-top: 1px dashed #e0e0e0; }
.score-num { font-size: 20px; font-weight: 700; }
.score-num.plus { color: #34A853; }
.score-num.zero { color: #999; }
.score-num.na { color: #ccc; }
.score-unit { font-size: 13px; color: var(--color-text-secondary); }
.score-unit.na-text { color: #D93025; font-size: 12px; }
.score-hint { font-size: 11px; color: #E37400; background: #fef7e0; padding: 2px 6px; border-radius: 4px; }
.matching-hint { font-size: 13px; color: #888; font-style: italic; }
</style>
