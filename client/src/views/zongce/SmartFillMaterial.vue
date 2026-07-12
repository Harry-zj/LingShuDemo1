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
            <div v-if="f.match" style="margin-top:10px; display:flex; align-items:center; gap:8px">
              <!-- 已确认：显示状态 -->
              <span v-if="f.match.review_status === 'confirmed'" class="badge ok">已确认</span>
              <!-- 可确认：显示确认按钮 -->
              <button
                v-else-if="canConfirm(f)"
                class="btn primary sm"
                @click="confirmMatch(mat.id, f)"
              >确认该条</button>
              <!-- 不可确认：显示禁用按钮 + 原因提示 -->
              <template v-else>
                <button class="btn sm btn-disabled" disabled>{{ confirmBlockLabel(f) }}</button>
                <span class="block-hint">{{ confirmBlockReason(f) }}</span>
              </template>
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

function canConfirm(f) {
  const m = f.match
  if (!m || !m.fact_rule_match_id) return false
  if (m.review_status === 'confirmed') return false
  if (m.score_preview === null || m.score_preview === undefined) return false
  if (m.match_condition === 'fail') return false
  if (m.error_type === 'ambiguous_lookup_table') return false
  if (m.score_status === 'lookup_failed') return false
  return true
}
function confirmBlockReason(f) {
  const m = f.match
  if (!m || !m.fact_rule_match_id) return '缺少匹配记录，请重新执行识别'
  if (m.score_preview === null || m.score_preview === undefined) {
    if (m.error_type) return '无法计分：' + m.error_type
    return '无法计分，请补充必要信息后重新匹配'
  }
  if (m.error_type === 'ambiguous_lookup_table') return '存在查分表歧义，请明确选择规则分类后重新匹配'
  if (m.match_condition === 'fail') return '匹配验证未通过，请调整信息后重新匹配'
  if (m.score_status === 'lookup_failed') return '查分未命中，请调整信息后重新匹配'
  return '暂不可确认'
}
function confirmBlockLabel(f) {
  const m = f.match
  if (!m || !m.fact_rule_match_id) return '不可确认'
  if (m.score_preview === null || m.score_preview === undefined) return '不可确认'
  if (m.error_type === 'ambiguous_lookup_table') return '需解决歧义'
  if (m.match_condition === 'fail') return '验证未过'
  if (m.score_status === 'lookup_failed') return '查分失败'
  return '不可确认'
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
      // ★ 乐观更新：立即标记为已确认
      if (res.data?.fact) {
        fact.match = res.data.fact.match || fact.match
        fact.review_status = res.data.fact.review_status || 'confirmed'
        if (fact.match) fact.match.review_status = fact.review_status
      } else {
        if (fact.match) fact.match.review_status = 'confirmed'
        fact.review_status = 'confirmed'
      }
      const mat = props.materials.find(m => m.id === matId)
      if (mat) {
        recalcPreviewSummary(mat)
        collapsedMap.value[matId] = allConfirmed(mat)
      }
      // ★ 后台刷新验证（失败不影响确认结果）
      refreshFactFromServer(matId, efId, fact)
    } else {
      // ★ 确认失败：按钮状态不变
      alert(res.msg || '确认失败')
    }
  } catch (e) {
    // ★ 网络异常：按钮状态不变
    alert('确认失败，请稍后重试')
  }
}

// 后台刷新单条 fact，用服务端权威数据验证确认状态
async function refreshFactFromServer(matId, efId, fact) {
  try {
    const res = await api.getMaterials()
    if (res.code !== 200) { console.warn('[confirm] 后台刷新失败: code=' + res.code); return }
    const mat = res.data.find(m => m.id === matId)
    if (!mat) return
    const refreshed = mat.facts?.find(f => f.fact_id === efId)
    if (!refreshed) return
    // ★ 用服务端权威数据更新
    const oldMatch = fact.match
    if (refreshed.match) fact.match = refreshed.match
    fact.review_status = refreshed.review_status || fact.review_status
    if (fact.match) fact.match.review_status = fact.review_status
    // 如果序列化返回 null match 但之前有，保留旧的 match 防止 UI 闪烁
    if (!fact.match && oldMatch) fact.match = oldMatch
    const localMat = props.materials.find(m => m.id === matId)
    if (localMat) {
      recalcPreviewSummary(localMat)
      collapsedMap.value[matId] = allConfirmed(localMat)
    }
  } catch (_) {
    // ★ 刷新失败：UI 保持乐观更新结果，不弹错误
    console.warn('[confirm] 确认成功但后台刷新失败，UI 使用乐观更新结果')
  }
}
</script>

<style scoped>
.material-page { display: flex; flex-direction: column; gap: 16px; }
.add-bar { display: flex; align-items: center; gap: 16px; }
.hint { font-size: 13px; color: var(--color-text-tertiary); }

.material-item {
  border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 16px;
}
.mat-top { display: flex; justify-content: space-between; align-items: center; }
.mat-left { display: flex; align-items: center; gap: 8px; }
.mat-title { font-weight: 600; font-size: 15px; }
.file-count { font-size: 12px; color: var(--color-text-tertiary); background: var(--color-bg); padding: 2px 8px; border-radius: var(--radius-tag); }
.mat-right { display: flex; gap: 8px; }

.attach-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.attach-tag {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 12px; padding: 3px 8px; background: var(--color-surface-variant); border-radius: var(--radius-tag);
}
.attach-del { border: none; background: none; cursor: pointer; color: var(--color-text-tertiary); font-size: 14px; padding: 0 2px; }

.recognition-card {
  margin-top: 14px; padding: 16px; background: var(--color-surface-variant); border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
}
.recognition-card.dismissed { opacity: 0.4; }
.rec-top { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
.rec-score { font-size: 20px; font-weight: 700; color: var(--color-primary); }
.rec-confidence { font-size: 14px; font-weight: 600; }
.rec-confidence.high { color: #34A853; }
.rec-confidence.mid { color: #E37400; }
.rec-confidence.low { color: #D93025; }
.rec-explanation { font-size: 14px; line-height: 1.6; color: var(--color-text); margin-bottom: 12px; }
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
.btn.outline-danger { background: var(--color-surface); color: #D93025; border: 1px solid #D93025; }
.btn-text { padding: 6px 14px; border: 1px solid var(--color-border); border-radius: var(--radius-btn); background: var(--color-surface); cursor: pointer; font-size: 13px; font-family: inherit; color: var(--color-text); }
.btn-text.danger { color: #D93025; border-color: transparent; }
.btn-text.sm { font-size: 12px; padding: 2px 8px; }
.btn-disabled { background: #e8e8e8; color: #999; cursor: not-allowed; border: 1px solid #d0d0d0; }
.block-hint { font-size: 12px; color: #b86500; max-width: 260px; line-height: 1.4; }
</style>
