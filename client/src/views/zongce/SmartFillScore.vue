<template>
  <div class="score-root">
    <!-- ★ 页面头部 -->
    <div class="page-header">
      <button class="back-btn" @click="$emit('back')">
        <svg width="20" height="20" viewBox="0 0 20 20"><polyline points="12,4 6,10 12,16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <h2 class="page-title">评分清单</h2>
    </div>

    <!-- 空状态 -->
    <div v-if="!hasConfirmed" class="empty-full">
      <span class="empty-icon">📋</span>
      <p>暂无已确认的材料，请先在材料识别中完成 AI 识别并逐条确认</p>
    </div>

    <!-- ★ 双栏主体 -->
    <div v-else class="main-layout">
      <!-- 左侧：三维均等网格 -->
      <div class="left-grid">
        <div
          v-for="(ind, i) in indicators"
          :key="ind.id"
          class="dim-card"
          :style="{ '--accent': COLORS[i % COLORS.length] }"
          @click="select(ind)"
        >
          <div class="dc-top">
            <span class="dc-tag">{{ ind.code }}</span>
            <svg class="dc-arrow" width="16" height="16" viewBox="0 0 16 16"><polyline points="6,3 11,8 6,13" fill="none" stroke="#ccc" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
          <div class="dc-name">{{ ind.name }}</div>
          <div class="dc-bar"><div class="dc-bar-fill" :style="{ width: barPct(ind) + '%' }"></div></div>
          <div class="dc-foot">
            <span class="dc-score">{{ ind.score }}</span>
            <span v-if="ind.max_score" class="dc-max">/ {{ ind.max_score }}</span>
          </div>
        </div>
      </div>

      <!-- 右侧：固定汇总面板 -->
      <div class="right-panel">
        <!-- 总分卡片 -->
        <div class="total-card" @click="select(null)">
          <div class="tc-top">
            <span class="tc-label">综测总分</span>
            <svg class="tc-arrow" width="16" height="16" viewBox="0 0 16 16"><polyline points="6,3 11,8 6,13" fill="none" stroke="#bbb" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
          <div class="tc-num">{{ totalScore }}</div>
          <div class="tc-sub">共 {{ totalFactCount }} 条有效认证材料</div>
        </div>

        <!-- 明细区域 -->
        <div class="detail-panel">
          <div class="dp-head">
            <span class="dp-title">总分汇总：</span>
            <button v-if="!selected" class="dp-btn" disabled>查看明细</button>
            <button v-else class="dp-btn active" @click="clearSelect">← 返回总览</button>
          </div>

          <!-- 未选中：空白提示 -->
          <div v-if="!selected" class="dp-placeholder">
            <span>← 点击左侧维度卡片或总分卡片查看加分明细</span>
          </div>

          <!-- 已选中 -->
          <div v-else class="dp-list">
            <div class="dp-summary">
              <span class="dps-code">{{ selected.code }}</span>
              <span class="dps-name">{{ selected.name }}</span>
              <span class="dps-score">{{ selected.score }} 分</span>
            </div>
            <div v-for="f in selected.facts" :key="f.fact_id" class="dp-fact">
              <div class="dpf-head">
                <span class="dpf-name">{{ f.award_name || f.competition_name || '事实' }}</span>
                <span class="dpf-score" :class="{ zero: f.score <= 0 }">+{{ f.score }}</span>
              </div>
              <div class="dpf-meta">
                <span>{{ f.material_title }}</span>
                <span v-if="f.rule_name"> · {{ f.rule_name }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({ materials: Array, evaluation: Object, scoreList: Object })
defineEmits(['calculate', 'back'])

const selected = ref(null)  // 当前选中的 indicator 或 null=总览

const B_LABELS = { B1:'职业技能', B2:'科技学术', B3:'社会工作', B4:'宣传报道', B5:'文艺创作', B6:'文体竞赛', B7:'其他实践', B8:'劳育类' };
const indicators = computed(() => {
  const list = props.scoreList?.indicators || [];
  return ['B1','B2','B3','B4','B5','B6','B7','B8'].map(code => {
    const found = list.find(ind => ind.code === code);
    return found || { code, name: B_LABELS[code], score: 0, max_score: 100, facts: [], id: code };
  });
})
const totalScore = computed(() => indicators.value.reduce((s,ind)=>s+(ind.score||0),0).toFixed(2))
const totalFactCount = computed(() => props.scoreList?.fact_count || 0)

const hasConfirmed = computed(() =>
  (props.materials || []).reduce((sum, m) =>
    sum + (m.facts || []).filter(f => f.match?.review_status === 'confirmed' || f.fact_data?.confirmed === true).length, 0
  ) > 0
)

function barPct(ind) {
  const max = ind.max_score
  if (!max) return ind.score > 0 ? 100 : 0
  return Math.min((ind.score / max) * 100, 100)
}

function select(ind) { selected.value = ind }
function clearSelect() { selected.value = null }

const COLORS = ['#8CA5C8','#8DB5A6','#C89B7A','#9E8AB8','#C88A8A','#7AAD9E','#A888C0','#B89970']
</script>

<style scoped>
.score-root { max-width: 1060px; margin: 0 auto; }

/* ===== 头部 ===== */
.page-header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
.back-btn {
  width: 36px; height: 36px; border: 1px solid #e0e0e0; border-radius: 10px;
  background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center;
  color: #666;
}
.back-btn:hover { background: #f5f5f5; }
.page-title { font-size: 20px; font-weight: 700; color: #1a1a1a; margin: 0; }

/* ===== 空状态 ===== */
.empty-full { text-align: center; padding: 80px 0; color: #999; font-size: 14px; }
.empty-icon { font-size: 48px; display: block; margin-bottom: 12px; }

/* ===== 双栏 ===== */
.main-layout { display: flex; gap: 20px; align-items: stretch; }

/* ===== 左侧网格 ===== */
.left-grid { flex: 1; display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }

.dim-card {
  background: #fff; border: 1px solid #eee; border-radius: 14px;
  padding: 18px 16px 16px; cursor: pointer; transition: all .2s;
  display: flex; flex-direction: column; gap: 10px;
}
.dim-card:hover { border-color: #d0d8e0; box-shadow: 0 2px 12px rgba(0,0,0,.04); }
.dc-top { display: flex; justify-content: space-between; align-items: center; }
.dc-tag {
  font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 5px;
  background: color-mix(in srgb, var(--accent) 15%, transparent); color: var(--accent);
  font-family: monospace; letter-spacing: .3px;
}
.dc-arrow { flex-shrink: 0; }
.dc-name { font-size: 14px; font-weight: 600; color: #222; }
.dc-bar { height: 5px; background: #eef2f7; border-radius: 3px; overflow: hidden; }
.dc-bar-fill { height: 100%; border-radius: 3px; background: #b8cfe0; transition: width .5s ease; }
.dc-foot { display: flex; align-items: baseline; gap: 3px; }
.dc-score { font-size: 22px; font-weight: 700; color: #333; }
.dc-max { font-size: 12px; color: #aaa; }

/* ===== 右侧面板 ===== */
.right-panel {
  width: 340px; flex-shrink: 0;
  display: flex; flex-direction: column; gap: 16px;
}

/* 总分卡片 */
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
  background: #fff; border: 1px solid #eee; border-radius: 14px;
  padding: 22px 20px; cursor: pointer; transition: all .2s;
}
.total-card:hover { border-color: #d0d8e0; box-shadow: 0 2px 12px rgba(0,0,0,.04); }
.tc-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.tc-label { font-size: 13px; color: #888; }
.tc-arrow { flex-shrink: 0; }
.tc-num { font-size: 44px; font-weight: 800; color: #1a1a1a; line-height: 1.1; margin-bottom: 6px; }
.tc-sub { font-size: 12px; color: #aaa; }

/* 明细面板 */
.detail-panel {
  background: #fff; border: 1px solid #eee; border-radius: 14px;
  padding: 18px 18px 14px; display: flex; flex-direction: column; gap: 14px;
  flex: 1; min-height: 0;
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
.dp-head { display: flex; justify-content: space-between; align-items: center; }
.dp-title { font-size: 14px; font-weight: 600; color: #333; }
.dp-btn {
  font-size: 12px; padding: 5px 14px; border-radius: 6px; border: 1px solid #e0e0e0;
  background: #fff; color: #bbb; cursor: not-allowed;
}
.dp-btn.active { color: #4A90D9; border-color: #b8d4f0; background: #f5f9ff; cursor: pointer; }

.dp-placeholder { flex: 1; display: flex; align-items: center; justify-content: center; font-size: 13px; color: #ccc; text-align: center; padding: 20px; }

/* 选中态明细 */
.dp-summary { display: flex; align-items: center; gap: 10px; padding-bottom: 12px; border-bottom: 1px solid #f0f0f0; }
.dps-code { font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 4px; background: #e8f0fe; color: #4A90D9; font-family: monospace; }
.dps-name { font-size: 14px; font-weight: 600; color: #222; flex: 1; }
.dps-score { font-size: 18px; font-weight: 700; color: #4A90D9; }

.dp-list { display: flex; flex-direction: column; gap: 8px; overflow-y: auto; flex: 1; min-height: 0; }
.dp-fact { padding: 10px 12px; background: #fafbfc; border-radius: 8px; }
.dpf-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px; }
.dpf-name { font-size: 13px; font-weight: 600; color: #333; }
.dpf-score { font-size: 15px; font-weight: 700; color: #2e8b57; }
.dpf-score.zero { color: #bbb; }
.dpf-meta { font-size: 12px; color: #999; }
.dim-card.empty { opacity: 0.5; } .dim-card.empty .dc-score { color: #ccc; }
</style>
