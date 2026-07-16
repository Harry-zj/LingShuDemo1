<template>
  <div class="score-root">
    <!-- 空状态 -->
    <div v-if="!hasConfirmed" class="empty-full">
      <span class="empty-icon">📋</span>
      <p>暂无已确认的材料，请先在材料识别中完成 AI 识别并逐条确认</p>
    </div>

    <div v-else class="score-layout">
      <!-- 总览卡片 -->
      <div class="overview-card">
        <div class="ov-left">
          <span class="ov-eyebrow">F3 创新实践 · 评分清单</span>
          <span class="ov-total">{{ totalScore }} <small>分</small></span>
          <span class="ov-sub">共 {{ totalFactCount }} 条有效认证材料</span>
        </div>
        <div class="ov-right">
          <div class="ov-ring">
            <svg viewBox="0 0 80 80" class="ring-svg">
              <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="5"/>
              <circle cx="40" cy="40" r="34" fill="none" stroke="#c4a882" stroke-width="5"
                stroke-dasharray="213.6" :stroke-dashoffset="213.6 - 213.6 * ringProgress"
                stroke-linecap="round" transform="rotate(-90 40 40)" style="transition: stroke-dashoffset 0.8s ease"/>
            </svg>
            <span class="ring-text">{{ Math.round(ringProgress * 100) }}%</span>
          </div>
        </div>
      </div>

      <!-- 指标列表 -->
      <div class="indicator-list">
        <div
          v-for="ind in indicators"
          :key="ind.code"
          class="ind-row"
          :class="{ active: selected?.code === ind.code, empty: ind.score === 0 }"
          @click="select(ind)"
        >
          <div class="ind-main">
            <span class="ind-code">{{ ind.code }}</span>
            <div class="ind-info">
              <span class="ind-name">{{ ind.name }}</span>
              <div class="ind-bar-wrap">
                <div class="ind-bar"><div class="ind-bar-fill" :style="{ width: barPct(ind) + '%' }"></div></div>
              </div>
            </div>
            <span class="ind-score">{{ ind.score }}<small v-if="ind.max_score"> / {{ ind.max_score }}</small></span>
            <svg class="ind-chevron" width="16" height="16" viewBox="0 0 16 16"><polyline points="5,3 10,8 5,13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>

          <!-- 展开明细 -->
          <div v-if="selected?.code === ind.code && ind.facts?.length" class="ind-detail">
            <div class="fact-item" v-for="f in ind.facts" :key="f.fact_id">
              <span class="fact-name">{{ f.award_name || f.competition_name || '事实' }}</span>
              <span class="fact-meta">{{ f.material_title }}<template v-if="f.rule_name"> · {{ f.rule_name }}</template></span>
              <span class="fact-score" :class="{ zero: f.score <= 0 }">+{{ f.score }}</span>
            </div>
          </div>
          <div v-else-if="selected?.code === ind.code" class="ind-detail">
            <p class="detail-empty">该指标暂无已确认材料</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({ materials: Array, evaluation: Object, scoreList: Object, scorePolicy: Object })
defineEmits(['calculate', 'back'])

const selected = ref(null)
const B_LABELS = { B1:'职业技能',B2:'学科竞赛',B3:'科研学术',B4:'宣传报道',B5:'社会工作',B6:'社会实践',B7:'文体竞赛',B8:'劳动教育' }

const indicators = computed(() => {
  const list = props.scoreList?.indicators || []
  return ['B1','B2','B3','B4','B5','B6','B7','B8'].map(code => {
    const found = list.find(ind => ind.code === code)
    const maxScore = Number(props.scorePolicy?.scoreLimits?.[code] ?? 30)
    const source = found || { code, name: B_LABELS[code], score: 0, facts: [], id: code }
    return { ...source, score: Math.min(Number(source.score || 0), maxScore), max_score: maxScore }
  })
})

const totalScore = computed(() => Math.min(
  indicators.value.reduce((s,ind)=>s+(ind.score||0),0),
  Number(props.scorePolicy?.scoreLimits?.F3 ?? 100)
).toFixed(2))
const totalFactCount = computed(() => props.scoreList?.fact_count || 0)
const ringProgress = computed(() => {
  const max = Number(props.scorePolicy?.scoreLimits?.F3 ?? 100)
  const total = Number(totalScore.value || 0)
  return max > 0 ? Math.min(total / max, 1) : 0
})

const hasConfirmed = computed(() =>
  (props.materials || []).reduce((sum, m) =>
    sum + (m.facts || []).filter(f => f.match?.review_status === 'confirmed' || f.fact_data?.confirmed === true).length, 0
  ) > 0
)

function barPct(ind) {
  const max = ind.max_score || 30
  return Math.min((ind.score / max) * 100, 100)
}

function select(ind) { selected.value = selected.value?.code === ind.code ? null : ind }
</script>

<style scoped>
.score-root { width: 100%; }

.empty-full { text-align: center; padding: 80px 0; color: var(--color-text-tertiary); font-size: 14px; }
.empty-icon { font-size: 48px; display: block; margin-bottom: 14px; }

/* ===== 布局 ===== */
.score-layout { display: flex; flex-direction: column; gap: 24px; }

/* ===== 总览卡片 ===== */
.overview-card {
  display: flex; align-items: center; justify-content: space-between;
  padding: 24px 28px; border-radius: 20px;
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
}
.ov-eyebrow { font-size: 11px; color: var(--color-text-tertiary); text-transform: uppercase; letter-spacing: 0.08em; display:block; margin-bottom:4px; }
.ov-total { font-size: 48px; font-weight: 800; color: #c4a882; line-height: 1; }
.ov-total small { font-size: 20px; font-weight: 500; }
.ov-sub { font-size: 12px; color: var(--color-text-tertiary); display: block; margin-top: 6px; }

/* 环形进度 */
.ov-ring { width: 80px; height: 80px; position: relative; }
.ring-svg { width: 100%; height: 100%; }
.ring-text { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; color: #c4a882; }

/* ===== 指标列表 ===== */
.indicator-list { display: flex; flex-direction: column; gap: 2px; }

.ind-row {
  border-radius: 14px; overflow: hidden;
  background: rgba(255,255,255,0.02); border: 1px solid transparent;
  transition: background 0.2s, border-color 0.2s;
  cursor: pointer;
}
.ind-row:hover { background: rgba(196,168,130,0.04); }
.ind-row.active { background: rgba(196,168,130,0.06); border-color: rgba(196,168,130,0.15); }
.ind-row.empty { opacity: 0.45; }

.ind-main {
  display: flex; align-items: center; gap: 14px;
  padding: 14px 18px;
}

.ind-code {
  font-size: 12px; font-weight: 700; width: 32px; height: 32px;
  border-radius: 8px; display: flex; align-items: center; justify-content: center;
  background: rgba(196,168,130,0.12); color: #c4a882;
  flex-shrink: 0;
}
.ind-row.active .ind-code { background: rgba(196,168,130,0.22); }

.ind-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.ind-name { font-size: 14px; font-weight: 600; color: var(--color-text); }
.ind-bar-wrap { width: 100%; }
.ind-bar { height: 5px; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden; }
.ind-bar-fill { height: 100%; border-radius: 3px; background: #c4a882; transition: width 0.6s ease; }

.ind-score { font-size: 20px; font-weight: 700; color: var(--color-text); white-space: nowrap; min-width: 70px; text-align: right; }
.ind-score small { font-size: 12px; color: var(--color-text-tertiary); font-weight: 400; }
.ind-chevron { color: var(--color-text-tertiary); flex-shrink: 0; transition: transform 0.25s; }
.ind-row.active .ind-chevron { transform: rotate(90deg); }

/* 明细 */
.ind-detail { padding: 0 18px 14px 64px; display: flex; flex-direction: column; gap: 6px; }
.fact-item { display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-radius: 8px; background: rgba(255,255,255,0.02); }
.fact-name { font-size: 13px; font-weight: 500; color: var(--color-text); flex: 1; }
.fact-meta { font-size: 11px; color: var(--color-text-tertiary); }
.fact-score { font-size: 13px; font-weight: 700; color: #7d9b76; white-space: nowrap; }
.fact-score.zero { color: var(--color-text-tertiary); }
.detail-empty { font-size: 12px; color: var(--color-text-tertiary); margin: 0; padding: 4px 0; }
</style>
