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
          <div class="extract-header" @click="toggleCollapse(mat.id)" style="cursor:pointer">
            <span>{{ collapsedMap[mat.id] ? '▶' : '▼' }} 识别结果 — {{ statusLabel(mat) }}
              <span v-if="matchedCount(mat) < mat.facts.length" class="match-progress">
                ⏳ 正在匹配规则 {{ matchedCount(mat) }}/{{ mat.facts.length }}...
              </span>
            </span>
            <button class="btn-text sm" @click.stop="doExtract(mat)">重新识别</button>
          </div>

          <div v-show="!collapsedMap[mat.id]">
          <div v-for="f in mat.facts" :key="f.fact_id || f.legacy_fact_key" class="fact-editor">
            <div class="fact-header">事实 #{{ f.fact_id || f.legacy_fact_key }}</div>
            <div class="edit-grid">
              <div class="edit-field">
                <label>规则分类</label>
                <select v-model="f.fact_data.suggested_rule_block" @change="doPreview(mat, f)">
                  <option value="">-- 不确定 --</option>
                  <option v-for="b in ruleBlocks" :key="b" :value="b">{{ b }}</option>
                </select>
              </div>
              <div class="edit-field"><label>赛事/活动</label><input v-model="f.fact_data.competition_name" @change="doPreview(mat, f)" /></div>
              <div class="edit-field"><label>获奖名称</label><input v-model="f.fact_data.award_name" @change="doPreview(mat, f)" /></div>
              <div class="edit-field">
                <label>获奖等级</label>
                <select v-model="f.fact_data.award_rank" @change="doPreview(mat, f)">
                  <option value="">-- 未知 --</option>
                  <option value="special">特等奖</option><option value="first">一等奖</option><option value="second">二等奖</option>
                  <option value="third">三等奖</option><option value="encouragement">鼓励奖/纪念奖/入围奖</option>
                  <option value="excellence">优秀奖</option><option value="participation">参与奖</option>
                  <option value="优胜奖">优胜奖（保持原文）</option>
                </select>
              </div>
              <div class="edit-field"><label>主办单位</label><input v-model="f.fact_data.organizer" @change="doPreview(mat, f)" /></div>
              <div class="edit-field">
                <label>建议级别</label>
                <select v-model="f.fact_data.inferred_level" @change="doPreview(mat, f)">
                  <option value="">-- 不确定 --</option>
                  <option value="national">国家级</option><option value="provincial">省级</option>
                  <option value="school">校级</option><option value="college">院级</option>
                </select>
              </div>
              <div class="edit-field"><label>日期</label><input v-model="f.fact_data.award_date" @change="doPreview(mat, f)" /></div>
              <div class="edit-field">
                <label>团队/个人</label>
                <select v-model="f.fact_data.is_team" @change="doPreview(mat, f)">
                  <option :value="false">个人</option><option :value="true">团队</option>
                </select>
              </div>
              <div class="edit-field"><label>角色</label><input v-model="f.fact_data.my_role" @change="doPreview(mat, f)" placeholder="队长/队员/个人" /></div>
              <div class="edit-field">
                <label>重复获奖</label>
                <select v-model="f.fact_data.is_duplicate_project" @change="doPreview(mat, f)">
                  <option :value="false">否</option><option :value="true">是</option>
                </select>
              </div>
            </div>

            <!-- ⏳ 匹配中 -->
            <div v-if="!f.match && isPreviewing(f)" class="preview-block matching-block">
              <div class="preview-status">
                <span class="badge matching">⏳ 正在匹配规则…</span>
              </div>
              <div class="preview-body">
                <div class="matching-hint">AI 正在查找匹配的加分规则，请稍候…</div>
              </div>
            </div>
            <!-- 匹配结果 -->
            <div v-else-if="f.match" class="preview-block">
              <div class="preview-status">
                <span v-if="f.match.error_type === 'ambiguous_lookup_table'" class="badge review">多表歧义</span>
                <span v-else-if="f.match.review_status === 'confirmed'" class="badge ok">已确认</span>
                <span v-else-if="f.match.score_status === 'candidate_pending_review'" class="badge review">待查分确认</span>
                <span v-else-if="f.match.score_status === 'lookup_failed'" class="badge conflict">查分未命中</span>
                <span v-else-if="f.match.score_preview !== null" class="badge ok">已匹配</span>
                <span v-else-if="f.match.error_type" class="badge review">{{ f.match.error_type }}</span>
                <span v-else class="badge review">无法计分</span>
              </div>
              <div class="preview-body">
                <div class="preview-row" v-if="f.match.indicator?.code"><label>指标</label><b>{{ f.match.indicator.code }}</b><span v-if="f.match.indicator.name"> — {{ f.match.indicator.name }}</span></div>
                <div class="preview-row" v-if="f.match.rule?.name"><label>规则</label>{{ f.match.rule.name }} <span class="rule-type-tag">{{ f.match.rule.rule_type }}</span></div>
                <div class="preview-row" v-if="f.match.lookup_table?.name"><label>查分表</label>{{ f.match.lookup_table.name }}</div>
                <div class="preview-row" v-if="hasDimEntries(f.match.raw_dimensions)"><label>维度</label>{{ formatDims(f.match.raw_dimensions) }}</div>
                <div class="preview-score">
                  <template v-if="f.match.score_preview !== null">
                    <span class="score-num" :class="{ plus: f.match.score_preview > 0, zero: f.match.score_preview === 0 }">{{ f.match.score_preview > 0 ? '+' + f.match.score_preview : String(f.match.score_preview) }}</span>
                    <span class="score-unit">分</span>
                    <span v-if="f.match.review_status === 'pending' && f.match.score_preview !== null" class="score-hint">待确认</span>
                  </template>
                  <template v-else>
                    <span class="score-num na">—</span>
                    <span class="score-unit na-text">{{ f.match.error_type || '无法计分' }}</span>
                  </template>
                </div>
              </div>
            </div>

            <!-- ★ 单条确认 -->
            <div style="margin-top:10px; display:flex; align-items:center; gap:8px">
              <button
                v-if="f.match && f.match.fact_rule_match_id && f.match.review_status !== 'confirmed' && f.match.score_status !== 'candidate_pending_review' && f.match.score_status !== 'lookup_failed'"
                class="btn primary sm"
                @click="confirmMatch(mat.id, f)"
              >确认该条</button>
              <span v-if="f.match?.review_status === 'confirmed'" class="badge ok">已确认</span>
            </div>
          </div>
          </div>  <!-- v-show -->
        </div>
      </template>

    </div>
  </div>
</template>

<script setup>
import { watch, ref } from 'vue'
import * as api from '../../api/zongce'

const props = defineProps({ materials: Array })
const emit = defineEmits(['create','upload','remove'])
const fileInputs = {}
const ruleBlocks = ['B1','B2','B3','B4','B5','B6','B7','B8']
const extractingIds = ref(new Set())
const previewingKeys = ref(new Set())
const collapsedMap = ref({})
function toggleCollapse(matId) { collapsedMap.value[matId] = !collapsedMap.value[matId] }

watch(() => props.materials, (mats) => {
  for (const mat of (mats || [])) {
    if (!mat._bestCat && mat.facts?.length) {
      for (const f of mat.facts) {
        if (f.match?.indicator?.code) { mat._bestCat = f.match.indicator.code; break }
      }
    }
    // 默认折叠：已全部确认 → 收起；未确认 → 展开
    if (!(mat.id in collapsedMap.value)) {
      collapsedMap.value[mat.id] = allConfirmed(mat)
    }
  }
}, { immediate: true })

function onFiles(matId, e) {
  const files = Array.from(e.target.files)
  if (files.length) emit('upload', matId, files)
}
function hasDimEntries(dims) { return dims && typeof dims === 'object' && Object.keys(dims).length > 0 }
function formatDims(dims) { return Object.entries(dims || {}).map(([k, v]) => k + '=' + v).join(', ') }
function allConfirmed(mat) { return mat.facts?.length && mat.facts.every(f => f.match?.review_status === 'confirmed') }
function someConfirmed(mat) { return mat.facts?.some(f => f.match?.review_status === 'confirmed') }
function statusLabel(mat) {
  if (!mat.facts?.length) return '待提取'
  if (allConfirmed(mat)) return '已入库'
  if (someConfirmed(mat)) return '部分已确认'
  return '待确认'
}
function factKey(f) { return f.fact_id || f.legacy_fact_key }
function matchedCount(mat) { return (mat.facts || []).filter(f => f.match).length }
function isPreviewing(f) { return previewingKeys.value.has(factKey(f)) }

async function doExtract(mat) {
  extractingIds.value.add(mat.id)
  try {
    const res = await api.extractMaterial(mat.id)
    if (res.code === 200) {
      mat.facts = (res.data.facts || []).map(f => ({
        fact_id: f.fact_id || null,
        legacy_fact_key: f.legacy_fact_key || ('f_' + Date.now()),
        fact_type: f.fact_type || f.type || null,
        fact_data: f.fact_data || f,
      }))
      for (const f of mat.facts) await doPreview(mat, f)
    } else { alert(res.msg) }
  } catch (e) { alert('识别失败，请稍后重试') }
  extractingIds.value.delete(mat.id)
}

async function doPreview(mat, fact) {
  const fd = fact.fact_data || fact
  if (!fd.inferred_level) {
    fact.match = { score_preview: null, error_type: 'incomplete', reason: '缺少级别信息' }
    return
  }
  const key = fact.fact_id || fact.legacy_fact_key
  previewingKeys.value.add(key)
  try {
    const res = await api.previewScore(mat.id, { fact: fd })
    if (res.code === 200) {
      fact.match = res.data.match || res.data
      if (!mat._bestCat && fact.match?.indicator?.code) mat._bestCat = fact.match.indicator.code
    } else {
      fact.match = { score_preview: null, error_type: 'match_failed', reason: res.msg }
      alert('规则匹配失败：' + (res.msg || '未知错误'))
    }
  } catch (_) {
    fact.match = { score_preview: null, error_type: 'error', reason: '预览请求失败' }
    alert('规则匹配请求失败，请检查网络或稍后重试')
  } finally { previewingKeys.value.delete(key) }
}

function recalcPreviewSummary(mat) {
  let cs = 0, cc = 0, sc = 0, cac = 0, pc = 0, fc = 0
  for (const f of (mat.facts || [])) {
    const m = f.match
    if (!m || m.score_preview == null) { if (m?.error_type) fc++; else pc++ }
    else if (m.review_status === 'pending') { cc += m.score_preview; cac++ }
    else { cs += m.score_preview; sc++ }
  }
  // ★ mutate in-place：保证 Vue Proxy 追踪到每个属性变更
  if (!mat.preview_summary) mat.preview_summary = {}
  Object.assign(mat.preview_summary, {
    confirmed_score: cs, candidate_score: cc,
    scored_fact_count: sc, candidate_fact_count: cac,
    pending_fact_count: pc, failed_fact_count: fc,
    total_fact_count: mat.facts.length,
  })
}

async function confirmMatch(matId, fact) {
  const matchId = fact.match?.fact_rule_match_id
  const efId = fact.fact_id
  if (!matchId || !efId) { alert('缺少匹配信息'); return }
  try {
    const res = await api.matchMaterial(matId, {
      fact_rule_match_id: matchId,
      extracted_fact_id: efId,
    })
    if (res.code === 200) {
      if (res.data?.fact) {
        // ★ 只更新 match + review_status，不碰 fact_data
        //    否则 Object.assign 替换 fact_data 会触发 v-model @change → doPreview → 覆盖确认结果
        fact.match = res.data.fact.match || fact.match
        fact.review_status = res.data.fact.review_status || 'confirmed'
        fact.match.review_status = fact.review_status
      } else { fact.match.review_status = 'confirmed' }
      const mat = props.materials.find(m => m.id === matId)
      if (mat) {
        recalcPreviewSummary(mat)
        collapsedMap.value[matId] = allConfirmed(mat)
      }
    } else { alert(res.msg) }
  } catch (e) { alert('确认失败，请稍后重试') }
}
</script>

<style scoped>
.material-page { display: flex; flex-direction: column; gap: 16px; }
.add-bar { display: flex; align-items: center; gap: 16px; }
.hint { font-size: 13px; color: #999; }
.empty { text-align: center; color: var(--color-gray); padding: 40px 0; }
.material-item { border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 16px; }
.mat-top { display: flex; justify-content: space-between; align-items: center; }
.mat-left { display: flex; align-items: center; gap: 8px; }
.mat-title { font-weight: 600; font-size: 15px; }
.file-count { font-size: 11px; color: #999; background: #f0f0f0; padding: 2px 8px; border-radius: 10px; }
.mat-right { display: flex; gap: 8px; align-items: center; }
.attach-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.attach-tag { font-size: 12px; padding: 3px 8px; background: #f5f5f5; border-radius: var(--radius-tag); }

.tag-cat { font-size: 11px; padding: 2px 7px; border-radius: 4px; font-weight: 700; background: #e8f0fe; color: #1A73E8; font-family: monospace; }
.tag-score { font-size: 11px; padding: 2px 7px; border-radius: 4px; font-weight: 700; }
.tag-score.plus { background: #e6f4ea; color: #1e7e34; }
.tag-score.zero { background: #f5f5f5; color: #999; }
.tag-score.candidate { background: #fef7e0; color: #b86500; font-size: 10px; }
.na-label { font-size: 11px; padding: 2px 7px; border-radius: 4px; background: #fef7e0; color: #b86500; }

.extract-card { margin-top: 14px; padding: 16px; background: #f0f7ff; border-radius: 8px; border: 1px solid #b8d4f0; }
.extract-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-weight: 600; font-size: 14px; }
.fact-editor { background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 14px; margin-bottom: 10px; }
.fact-header { font-size: 13px; font-weight: 600; color: #666; margin-bottom: 8px; border-bottom: 1px solid #f0f0f0; padding-bottom: 6px; }
.edit-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.edit-field { display: flex; flex-direction: column; gap: 3px; }
.edit-field label { font-size: 11px; color: #999; }
.edit-field input, .edit-field select { padding: 5px 7px; border: 1px solid #d0d0d0; border-radius: 4px; font-size: 13px; font-family: inherit; }

.preview-block { margin-top: 10px; border: 1px solid #d8dce3; border-radius: 8px; overflow: hidden; }
.preview-status { padding: 8px 12px; background: #fafafa; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
.badge.ok { background: #e6f4ea; color: #1e7e34; }
.badge.review { background: #fef7e0; color: #b86500; }
.badge.conflict { background: #fce8e6; color: #c5221f; }
.badge.matching { background: #e8f0fe; color: #1A73E8; }

.match-progress { font-size: 12px; color: #1A73E8; margin-left: 8px; }
.matching-block { border-color: #b8d4f0; background: #f8fbff; }
.matching-hint { font-size: 13px; color: #666; padding: 4px 0; }
.preview-body { padding: 10px 12px; }
.preview-row { font-size: 13px; margin-bottom: 4px; }
.preview-row label { color: #999; margin-right: 6px; }
.preview-score { display: flex; align-items: baseline; gap: 4px; margin-top: 8px; padding-top: 8px; border-top: 1px solid #f0f0f0; }
.score-num { font-size: 24px; font-weight: 700; color: #999; }
.score-num.plus { color: #1e7e34; }
.score-num.zero { color: #666; }
.score-num.na { color: #999; font-size: 18px; }
.score-unit { font-size: 14px; color: #666; margin-right: 10px; }
.score-unit.na-text { color: #D93025; font-size: 13px; }
.score-hint { font-size: 12px; color: #b86500; background: #fef7e0; padding: 1px 6px; border-radius: 4px; }
.rule-type-tag { font-size: 10px; padding: 1px 5px; border-radius: 3px; background: #e8f0fe; color: #1A73E8; margin-left: 4px; }

.done-card { margin-top: 14px; border: 1px solid #ceead6; border-radius: 8px; overflow: hidden; }
.done-header { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: #e6f4ea; cursor: pointer; user-select: none; font-size: 13px; }
.done-header:hover { background: #d2ebd8; }
.done-badge { font-weight: 700; color: #1e7e34; }
.done-summary { color: #666; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.done-body { padding: 12px 14px; background: #fff; font-size: 13px; color: #333; line-height: 1.6; border-top: 1px solid #ceead6; }

.btn { padding: 8px 20px; border: none; border-radius: var(--radius-btn); cursor: pointer; font-size: 14px; font-family: inherit; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn.primary { background: var(--color-primary); color: #fff; }
.btn.sm { padding: 6px 14px; font-size: 13px; }
.btn-text { padding: 6px 14px; border: 1px solid var(--color-border); border-radius: var(--radius-btn); background: #fff; cursor: pointer; font-size: 13px; font-family: inherit; }
.btn-text.danger { color: #D93025; border-color: transparent; }
.btn-text.sm { font-size: 12px; padding: 2px 8px; }
</style>
