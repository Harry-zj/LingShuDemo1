<template>
  <div class="score-page">
    <div class="score-top">
      <button class="btn primary large" @click="$emit('calculate')">🔢 计算评分</button>
      <span v-if="!hasConfirmed" class="hint">需确认至少一条规则和一条材料识别</span>
    </div>

    <div v-if="evaluation" class="score-content">
      <!-- 总分卡片 -->
      <div class="total-card">
        <span class="total-label">总分</span>
        <span class="total-num">{{ evaluation.total_score }}</span>
      </div>

      <!-- 五维清单 -->
      <div class="dim-list">
        <div v-for="dim in dims" :key="dim.key" class="dim-block">
          <div class="dim-header">
            <span class="dim-name" :style="{ color: dim.color }">{{ dim.label }}</span>
            <span class="dim-points">{{ evaluation[dim.key]?.score || 0 }} / {{ evaluation[dim.key]?.max || 0 }}</span>
          </div>
          <div class="dim-bar-bg"><div class="dim-bar" :style="{ width: pct(dim.key) + '%', background: dim.color }"></div></div>
          <div class="dim-detail" v-if="evaluation[dim.key]?.detail_text">{{ evaluation[dim.key].detail_text }}</div>
        </div>
      </div>

      <!-- 加分明细清单 -->
      <div class="detail-list">
        <h4>加分明细</h4>
        <div v-if="scoredMaterials.length === 0" class="empty">暂无已确认的材料</div>
        <div v-for="m in scoredMaterials" :key="m.id" class="detail-row">
          <span class="detail-name">{{ m.title || '未命名材料' }}</span>
          <span class="cat-tag" :style="catStyle(m.recognition.category)">{{ catLabel(m.recognition.category) }}</span>
          <span class="detail-score">+{{ m.recognition.suggested_score }}</span>
          <span class="detail-conf" :class="confLevel(m.recognition.confidence)">
            {{ (m.recognition.confidence * 100).toFixed(0) }}%
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({ materials: Array, ruleItems: Array, evaluation: Object })
defineEmits(['calculate'])

const dims = [
  { key:'moral', label:'德育', color:'#EA8600' },
  { key:'intellectual', label:'智育', color:'#1A73E8' },
  { key:'physical', label:'体育', color:'#34A853' },
  { key:'aesthetic', label:'美育', color:'#9C27B0' },
  { key:'labor', label:'劳育', color:'#FF6D00' },
]

const hasConfirmed = computed(() => {
  const rulesOk = props.ruleItems.filter(r => r.status === 'confirmed').length > 0
  const recsOk = props.materials.filter(m => m.recognition?.confirm_status === 'confirmed').length > 0
  return rulesOk && recsOk
})

const scoredMaterials = computed(() =>
  props.materials.filter(m => m.recognition?.confirm_status === 'confirmed')
)

function pct(key) {
  if (!props.evaluation) return 0
  const d = props.evaluation[key]
  return d && d.max ? Math.min((d.score / d.max) * 100, 100) : 0
}

const catMap = { moral:'德育', intellectual:'智育', physical:'体育', aesthetic:'美育', labor:'劳育' }
const catColors = { moral:'#EA8600', intellectual:'#1A73E8', physical:'#34A853', aesthetic:'#9C27B0', labor:'#FF6D00' }
function catLabel(c) { return catMap[c] || c || '未归类' }
function catStyle(c) { return { background: (catColors[c]||'#9AA0A6')+'20', color: catColors[c]||'#9AA0A6' } }
function confLevel(c) { return c > 0.8 ? 'high' : c >= 0.5 ? 'mid' : 'low' }
</script>

<style scoped>
.score-page { display: flex; flex-direction: column; gap: 24px; }
.score-top { display: flex; align-items: center; gap: 16px; }

.score-content { display: flex; flex-direction: column; gap: 24px; }

.total-card {
  text-align: center; padding: 24px;
  background: linear-gradient(135deg, var(--color-primary), #4a90d9);
  border-radius: var(--radius-card); color: #fff;
}
.total-label { display: block; font-size: 14px; opacity: 0.85; }
.total-num { font-size: 48px; font-weight: 700; }

.dim-list { display: flex; flex-direction: column; gap: 14px; }
.dim-block {
  background: var(--color-surface); border: 1px solid var(--color-border);
  border-radius: var(--radius-sm); padding: 16px;
}
.dim-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
.dim-name { font-weight: 600; font-size: 15px; }
.dim-points { font-size: 14px; color: var(--color-text-secondary); }
.dim-bar-bg { height: 8px; background: var(--color-bg); border-radius: 4px; overflow: hidden; margin-bottom: 8px; }
.dim-bar { height: 100%; border-radius: 4px; transition: width 0.4s; }
.dim-detail { font-size: 13px; color: var(--color-text-secondary); line-height: 1.5; }

.detail-list { }
.detail-row {
  display: flex; align-items: center; gap: 12px; padding: 10px;
  border-bottom: 1px solid var(--color-border); font-size: 14px;
}
.detail-name { flex: 1; }
.detail-score { font-weight: 700; color: var(--color-primary); }
.detail-conf { font-size: 13px; }
.detail-conf.high { color: #34A853; }
.detail-conf.mid { color: #E37400; }
.detail-conf.low { color: #D93025; }

.cat-tag { font-size: 12px; padding: 2px 8px; border-radius: var(--radius-tag); font-weight: 500; }
.empty { text-align: center; color: var(--color-gray); padding: 20px; }

.btn { padding: 10px 28px; border: none; border-radius: var(--radius-btn); cursor: pointer; font-size: 15px; font-family: inherit; }
.btn.primary { background: var(--color-primary); color: #fff; }
.btn.large { padding: 14px 48px; font-size: 16px; }
.hint { font-size: 13px; color: var(--color-text-tertiary); }
</style>
