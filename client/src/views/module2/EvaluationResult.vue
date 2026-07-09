<template>
  <div class="evaluation-page">
    <div class="page-header">
      <h2>评定结果分析</h2>
      <select v-model="currentBatch" @change="loadData" class="batch-select">
        <option value="">选择批次</option>
        <option v-for="b in batches" :key="b.id" :value="b.id">{{ b.title }}</option>
      </select>
    </div>

    <!-- 加载态 -->
    <div v-if="loading" class="skeleton">
      <div class="sk-score"></div>
      <div class="sk-grid">
        <div class="sk-radar"></div>
        <div class="sk-rank"></div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else-if="!evalData" class="empty-state">
      <div class="empty-icon">📋</div>
      <p>暂无评定数据</p>
      <span>请等待老师完成评定后查看</span>
    </div>

    <!-- 正常数据 -->
    <template v-else>
      <div class="overview-grid">
        <div class="card radar-card">
          <h3>五维能力雷达</h3>
          <RadarChart :dimensions="evalData.dimension_scores" :size="320" />
        </div>
        <div class="card rank-card">
          <h3>综测成绩</h3>
          <div class="total-score">{{ evalData.total_score ?? "--" }}</div>
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

      <div class="card dim-card">
        <h3>维度评分明细</h3>
        <DimensionBar
          v-for="d in dimensionList" :key="d.key"
          :name="d.name" :score="d.score" :color="d.color"
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
  { key: "zhiyu", name: "智育", color: "#1A73E8" },
  { key: "deyu", name: "德育", color: "#EA8600" },
  { key: "tiyu", name: "体育", color: "#34A853" },
  { key: "meiyu", name: "美育", color: "#9C27B0" },
  { key: "laoyu", name: "劳育", color: "#FF6D00" },
]

const loading = ref(true)
const evalData = ref(null)
const batches = ref([])
const currentBatch = ref("")

const dimensionList = computed(() =>
  dimConfig.map(d => ({
    ...d,
    score: evalData.value?.dimension_scores?.[d.key] ?? 0
  }))
)

const percentile = computed(() => {
  if (!evalData.value?.class_rank || !evalData.value?.class_size) return 0
  const { class_rank, class_size } = evalData.value
  return ((class_size - class_rank) / class_size * 100).toFixed(0)
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
.evaluation-page { display: flex; flex-direction: column; gap: 24px; }
.page-header { display: flex; justify-content: space-between; align-items: center; }
.page-header h2 { font-size: 24px; }
.batch-select { padding: 8px 16px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 14px; background: var(--color-white); outline: none; }
.batch-select:focus { border-color: var(--color-primary); }

/* 骨架屏 */
.skeleton { display: flex; flex-direction: column; gap: 24px; }
.sk-score { height: 160px; background: linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: var(--radius-card); }
.sk-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.sk-radar, .sk-rank { height: 340px; background: linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: var(--radius-card); }
@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }

/* 空状态 */
.empty-state { text-align: center; padding: 80px 24px; background: var(--color-white); border-radius: var(--radius-card); border: 1px solid var(--color-border); }
.empty-icon { font-size: 48px; margin-bottom: 16px; }
.empty-state p { font-size: 18px; color: var(--color-text); margin-bottom: 8px; }
.empty-state span { font-size: 14px; color: var(--color-text-secondary); }

/* 概览区域 */
.overview-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.card { background: var(--color-white); border-radius: var(--radius-card); border: 1px solid var(--color-border); padding: 24px; }
.radar-card h3 { font-size: 16px; margin-bottom: 8px; }
.radar-card { display: flex; flex-direction: column; align-items: center; }

.rank-card { text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.rank-card h3 { font-size: 16px; margin-bottom: 16px; }
.total-score { font-size: 64px; font-weight: 700; color: var(--color-primary); line-height: 1; }
.score-unit { font-size: 16px; color: var(--color-text-secondary); margin-bottom: 16px; }
.rank-info { font-size: 15px; color: var(--color-text-secondary); margin-bottom: 4px; }
.rank-info strong { color: var(--color-text); }
.percentile { font-size: 14px; color: var(--color-success); margin-top: 4px; }
.percentile strong { font-size: 18px; }

.dim-card h3 { font-size: 16px; margin-bottom: 20px; }

@media (max-width: 768px) { .overview-grid { grid-template-columns: 1fr; } }
</style>
