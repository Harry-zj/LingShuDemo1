<template>
  <div class="evaluation-page">
    <div class="page-header">
      <div>
        <h2>评定结果分析</h2>
        <p class="page-desc">五维综合素质评分详情</p>
      </div>
      <select v-model="currentBatch" @change="loadData" class="batch-select glass-card">
        <option value="">选择批次</option>
        <option v-for="b in batches" :key="b.id" :value="b.id">{{ b.title }}</option>
      </select>
    </div>

    <!-- 加载态 -->
    <div v-if="loading" class="loading-state">
      <div class="skeleton skeleton-card" style="height:180px"></div>
      <div class="sk-grid">
        <div class="skeleton skeleton-card" style="height:340px"></div>
        <div class="skeleton skeleton-card" style="height:340px"></div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else-if="!evalData" class="empty-state glass-card">
      <div class="empty-icon">
        <VIcon icon="mdi:chart-line-variant" />
      </div>
      <p>暂无评定数据</p>
      <span>请等待老师完成评定后查看</span>
    </div>

    <!-- 正常数据 -->
    <template v-else>
      <div class="overview-grid">
        <!-- 雷达图卡片 -->
        <div class="card glass-card radar-card" style="animation: fadeInUp 0.5s var(--easing-spring) both;">
          <div class="card-accent" style="background: var(--color-primary)"></div>
          <h3><VIcon icon="mdi:chart-radar" /> 五维能力雷达</h3>
          <RadarChart :dimensions="evalData.dimension_scores" :size="320" />
        </div>
        <!-- 成绩卡片 -->
        <div class="card glass-card rank-card" style="animation: fadeInUp 0.5s var(--easing-spring) both; animation-delay: 0.1s;">
          <div class="card-accent" style="background: var(--color-primary-gradient-bright)"></div>
          <h3><VIcon icon="mdi:trophy-outline" /> 综测成绩</h3>
          <div class="total-score" :style="{ background: 'var(--color-primary-gradient-bright)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }">
            {{ evalData.total_score ?? "--" }}
          </div>
          <div class="score-unit">分</div>
          <div class="rank-info" v-if="evalData.class_rank">
            班级排名 <strong>第 {{ evalData.class_rank }} 名</strong> / 共 {{ evalData.class_size }} 人
          </div>
          <div class="rank-info" v-else>暂无排名信息</div>
          <div class="percentile" v-if="evalData.class_rank && evalData.class_size">
            超过 <strong>{{ percentile }}%</strong> 的同学
          </div>
        </div>
      </div>

      <!-- 维度评分明细 -->
      <div class="card glass-card dim-card" style="animation: fadeInUp 0.5s var(--easing-spring) both; animation-delay: 0.2s;">
        <div class="card-accent" style="background: var(--color-meiyu)"></div>
        <h3><VIcon icon="mdi:layers-triple-outline" /> 维度评分明细</h3>
        <DimensionBar
          v-for="(d, i) in dimensionList" :key="d.key"
          :name="d.name" :score="d.score" :color="d.color"
          :style="{ animation: 'fadeInUp 0.4s var(--easing-spring) both', animationDelay: (0.15 + i * 0.08) + 's' }"
        />
      </div>
    </template>
  </div>
</template>
<script setup>
import { ref, computed, onMounted } from "vue"
import { getEvaluation } from "../../api/module2"
import { getBatches } from "../../api/module3"
import RadarChart from "../../components/RadarChart.vue"
import DimensionBar from "../../components/DimensionBar.vue"

const dimConfig = [
  { key: "zhiyu", name: "智育", color: "#4F46E5" },
  { key: "deyu", name: "德育", color: "#D97706" },
  { key: "tiyu", name: "体育", color: "#059669" },
  { key: "meiyu", name: "美育", color: "#7C3AED" },
  { key: "laoyu", name: "劳育", color: "#EA580C" },
]
const loading = ref(true)
const evalData = ref(null)
const batches = ref([])
const currentBatch = ref("")
const dimensionList = computed(() => dimConfig.map(d => ({ ...d, score: evalData.value?.dimension_scores?.[d.key] ?? 0 })))
const percentile = computed(() => {
  if (!evalData.value?.class_rank || !evalData.value?.class_size) return 0
  return ((evalData.value.class_size - evalData.value.class_rank) / evalData.value.class_size * 100).toFixed(0)
})
async function loadData() {
  loading.value = true
  try {
    const r1 = await getBatches()
    if (r1.code === 200) batches.value = r1.data || []
    const params = currentBatch.value ? { batch_id: currentBatch.value } : {}
    const r2 = await getEvaluation(params)
    if (r2.code === 200 && r2.data) evalData.value = r2.data
    else evalData.value = null
  } catch { evalData.value = null }
  finally { loading.value = false }
}
onMounted(loadData)
</script>
<style scoped>
.evaluation-page { display: flex; flex-direction: column; gap: 24px; animation: fadeIn 0.4s var(--easing-decelerate); }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; }
.page-header h2 { font-size: var(--font-scale-h2); font-weight: var(--font-weight-semibold); color: var(--color-text); }
.page-desc { font-size: var(--font-scale-body-sm); color: var(--color-text-secondary); margin-top: 2px; }
.batch-select { padding: 8px 16px; border: none; border-radius: var(--radius-full); font-size: 14px; background: transparent; outline: none; color: var(--color-text); cursor: pointer; }
.batch-select:focus { box-shadow: var(--glass-shadow-hover); }

.loading-state { display: flex; flex-direction: column; gap: 24px; }
.sk-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }

.empty-state { text-align: center; padding: 80px 24px; }
.empty-icon { font-size: 48px; color: var(--color-primary); margin-bottom: 16px; opacity: 0.5; }
.empty-state p { font-size: 18px; color: var(--color-text); margin-bottom: 8px; }
.empty-state span { font-size: 14px; color: var(--color-text-secondary); }

.overview-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.card { position: relative; overflow: hidden; }
.card-accent { position: absolute; top: 0; left: 0; right: 0; height: 3px; opacity: 0.6; border-radius: 3px 3px 0 0; }
.card h3 { font-size: 16px; font-weight: var(--font-weight-semibold); margin-bottom: 20px; display: flex; align-items: center; gap: 8px; color: var(--color-text); }

.radar-card { display: flex; flex-direction: column; align-items: center; padding: 24px 24px 16px; }
.rank-card { text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px 24px; }
.rank-card h3 { margin-bottom: 12px; }
.total-score { font-size: 72px; font-weight: var(--font-weight-bold); line-height: 1; }
.score-unit { font-size: 16px; color: var(--color-text-secondary); margin-bottom: 16px; }
.rank-info { font-size: 15px; color: var(--color-text-secondary); margin-bottom: 4px; }
.rank-info strong { color: var(--color-text); }
.percentile { font-size: 14px; color: var(--color-success); margin-top: 4px; font-weight: var(--font-weight-medium); }
.percentile strong { font-size: 18px; }
.dim-card { padding: 24px; }
.dim-card h3 { margin-bottom: 24px; }

@media (max-width: 768px) { .overview-grid { grid-template-columns: 1fr; } }
</style>
