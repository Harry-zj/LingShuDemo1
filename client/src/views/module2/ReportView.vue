<template>
  <div class="report-page">
    <div class="bg-atmosphere">
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
    </div>

    <div class="page-header">
      <div>
        <h2>个性化评定报告</h2>
        <p class="page-desc">德智体美劳 · 五维分析 · 发展建议</p>
      </div>
      <div class="header-right">
        <router-link to="/module2/evaluation" class="nav-link-btn glass-card">
          <VIcon icon="mdi:chart-bell-curve" /> 评定结果
        </router-link>
        <select v-model="currentBatch" @change="loadData" class="batch-select glass-card">
          <option value="">选择批次</option>
          <option v-for="b in batches" :key="b.id" :value="b.id">{{ b.title }}</option>
        </select>
      </div>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="skeleton skeleton-card" style="height:100px"></div>
      <div class="sk-grid"><div class="skeleton skeleton-card" v-for="i in 3" :key="i" style="height:160px"></div></div>
    </div>

    <div v-else-if="!evalData" class="empty-state glass-card">
      <div class="empty-icon"><VIcon icon="mdi:file-document-outline" /></div>
      <p>暂无评定数据，无法生成报告</p>
      <span>请等待老师完成评定后再生成报告</span>
    </div>

    <div v-else class="report-content" ref="reportRef" :class="{ 'export-mode': exporting }">
      <!-- 报告头部 -->
      <div class="export-card reveal" style="animation-delay: 0.1s;">
        <div class="card-accent" style="background: var(--color-primary-gradient-bright)"></div>
        <h3><span class="export-icon">◆</span> 综合评定报告</h3>

        <div class="rh-student">
          <span class="rhs-name">{{ evalData.student?.name || "--" }}</span>
          <span class="rhs-meta">{{ evalData.student?.grade }} · {{ evalData.student?.major }} · {{ evalData.student?.semester }}</span>
        </div>

        <div class="rh-cards">
          <div class="rhc-item">
            <div class="rhc-label">综测总分</div>
            <div class="rhc-value primary">{{ evalData.scores?.F ?? "--" }}<span class="rhc-unit"> 分</span></div>
          </div>
          <div class="rhc-item">
            <div class="rhc-label">综合评级</div>
            <div class="rhc-value" :style="{ color: overallLevel.color }">⭐ {{ overallLevel.label }}</div>
          </div>
          <div class="rhc-item">
            <div class="rhc-label">班级排名</div>
            <div class="rhc-value" v-if="evalData.rank">第 {{ evalData.rank }}<span class="rhc-unit"> / {{ evalData.totalStudents }} 名</span></div>
            <div class="rhc-value" v-else>--</div>
          </div>
          <div class="rhc-item">
            <div class="rhc-label">专业排名</div>
            <div class="rhc-value" v-if="evalData.majorRank">第 {{ evalData.majorRank }}<span class="rhc-unit"> / {{ evalData.majorTotal }} 名</span></div>
            <div class="rhc-value" v-else>--</div>
          </div>
        </div>
      </div>

      <!-- 五维分析 -->
      <div class="export-card reveal" style="animation-delay: 0.2s;">
        <div class="card-accent" style="background: var(--color-meiyu)"></div>
        <h3><span class="export-icon">◆</span> 五维维度分析</h3>
        <div class="dim-grid">
          <div class="dim-card" v-for="d in dimensionAnalysis" :key="d.key"
            :style="{ borderTopColor: d.color }">
            <div class="dc-head">
              <span class="dc-dot" :style="{ background: d.color }"></span>
              <span class="dc-name">{{ d.name }}</span>
              <span class="dc-badge" :style="{ background: d.level.bg, color: d.level.color }">{{ d.level.label }}</span>
            </div>
            <div class="dc-score">{{ d.score }}<span class="dc-unit">分</span></div>
            <p class="dc-desc">{{ d.desc }}</p>
          </div>
        </div>
      </div>

      <!-- 综合评语 -->
      <div class="export-card reveal" style="animation-delay: 0.3s;">
        <div class="card-accent" style="background: var(--color-primary)"></div>
        <h3><span class="export-icon">◆</span> 综合评语</h3>

        <!-- 总分概述 -->
        <div class="review-score-row">
          <div class="review-score-badge" :style="{ background: overallLevel.bg, color: overallLevel.color }">
            {{ overallLevel.label }}
          </div>
          <div class="review-score-text">
            综测总分 <strong>{{ evalData.scores?.F ?? "--" }}</strong> 分，
            班级排名 <strong>第 {{ evalData.rank || "--" }} / {{ evalData.totalStudents || "--" }} 名</strong>
          </div>
        </div>

        <!-- 公式 -->
        <div class="review-formula" v-if="evalData.scores">
          F = <span class="rf-num">{{ evalData.scores.F1 }}</span>×10% + <span class="rf-num">{{ evalData.scores.F2 }}</span>×65% + <span class="rf-num">{{ evalData.scores.F3 }}</span>×25% = <strong>{{ evalData.scores.F }}</strong>
        </div>

        <!-- 五维小进度条 -->
        <div class="review-dims">
          <div class="review-dim-row" v-for="d in sortedDimensions" :key="d.key">
            <span class="rd-name">{{ d.name }}</span>
            <div class="rd-bar-track">
              <div class="rd-bar-fill" :style="{ width: d.score + '%', background: d.color }"></div>
            </div>
            <span class="rd-score" :style="{ color: d.color }">{{ d.score }}</span>
            <span class="rd-level" :style="{ background: d.level.bg, color: d.level.color }">{{ d.level.label }}</span>
          </div>
        </div>

        <!-- 优势 & 提升 -->
        <div class="review-analysis">
          <div class="ra-card ra-strength" v-if="bestDim">
            <VIcon icon="mdi:thumb-up-outline" class="ra-icon" />
            <div>
              <div class="ra-title">优势维度：{{ bestDim.name }}</div>
              <div class="ra-desc">{{ bestDim.desc }} — {{ bestDim.score }} 分，表现突出，继续保持</div>
            </div>
          </div>
          <div class="ra-card ra-weakness" v-if="worstDim">
            <VIcon icon="mdi:target" class="ra-icon" />
            <div>
              <div class="ra-title">提升方向：{{ worstDim.name }}</div>
              <div class="ra-desc">{{ worstDim.desc }} — {{ worstDim.score }} 分，建议下阶段重点突破</div>
            </div>
          </div>
        </div>

        <!-- 总结 -->
        <div class="review-summary" :style="{ background: overallLevel.bg, borderLeftColor: overallLevel.color }">
          {{ overallSummary }}
        </div>
      </div>

      <!-- 发展建议 -->
      <div class="export-card reveal" style="animation-delay: 0.4s;">
        <div class="card-accent" style="background: var(--color-success)"></div>
        <h3><span class="export-icon">◆</span> 发展建议</h3>
        <div class="advice-list" v-if="adviceItems.length">
          <div class="advice-card" v-for="(item, i) in adviceItems" :key="i">
            <div class="ac-badge" :class="item.type === 'strength' ? 'ac-strength' : 'ac-weakness'">
              {{ item.type === "strength" ? "优势" : "提升" }}
            </div>
            <div class="ac-body">
              <div class="ac-title">{{ item.title }}</div>
              <div class="ac-content">{{ item.content }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 导出按钮 -->
    <div class="bottom-actions" v-if="evalData">
      <button class="btn-outline" @click="handleGenerate" :disabled="generating">
        <VIcon icon="mdi:refresh" /> 重新生成
      </button>
      <div class="export-group">
        <select v-model="exportFormat" class="export-select glass-card">
          <option value="pdf">PDF 文档</option>
          <option value="png">PNG 图片</option>
          <option value="jpeg">JPEG 图片</option>
        </select>
        <button class="btn-export" @click="handleExport" :disabled="exporting">
          <VIcon icon="mdi:download" /> {{ exporting ? "导出中..." : "导出 " + exportLabel }}
        </button>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, computed, onMounted } from "vue"
import { useRoute } from "vue-router"
import { getEvaluation, generateReport, getAdvice } from "../../api/module2"
import { getBatches } from "../../api/module3"
import { exportPDF, exportImage } from "../../utils/exportReport"
import { rawToDimensions, DIMENSION_CONFIG, getGradeLevel } from "../../utils/scoreHelper"

const route = useRoute()

// sessionStorage 持久化：每个批次独立缓存
const CACHE_PREFIX = "lingshu_report_"

function cacheKey(batchId) { return CACHE_PREFIX + (batchId || "default") }
function loadCache(batchId) {
  try { return JSON.parse(sessionStorage.getItem(cacheKey(batchId))) || {} } catch { return {} }
}
function saveCache(batchId, data) {
  sessionStorage.setItem(cacheKey(batchId), JSON.stringify(data))
}

const loading = ref(true); const generating = ref(false); const exporting = ref(false)
const reportRef = ref(null); const exportFormat = ref("pdf")
const formatLabelMap = { pdf: "PDF", png: "PNG", jpeg: "JPEG" }
const exportLabel = computed(() => formatLabelMap[exportFormat.value] || "PDF")
const evalData = ref(null)
const reportData = ref({})
const adviceData = ref([])
const batches = ref([])
const currentBatch = ref("")

// 五维分析（直接从 evalData 计算，无需等待后端生成）
const dimensionScores = computed(() => rawToDimensions(evalData.value))
const dimensionAnalysis = computed(() =>
  DIMENSION_CONFIG.map(d => {
    const score = Math.round(dimensionScores.value[d.key] || 0)
    return { ...d, score, level: getGradeLevel(score) }
  })
)
// 每个维度的具体可操作建议
const adviceTips = {
  de: {
    strength: [
      { title: "保持思想引领作用", content: "积极参与党团组织活动和主题班会，在同学中发挥模范带头作用，将思想政治素养转化为实际行动。" },
      { title: "强化纪律与责任意识", content: "严格遵守校纪校规，主动承担班级事务，在集体中树立可靠、负责的个人形象。" },
    ],
    weakness: [
      { title: "加强思政理论学习", content: "每周抽时间阅读时政新闻，参加思政讲座或读书会，提升对国情社情的理解深度。" },
      { title: "培养志愿服务习惯", content: "每学期至少参与2次志愿服务活动，在奉献中提升道德修养和社会责任感。" },
    ]
  },
  zhi: {
    strength: [
      { title: "深化专业学术能力", content: "在保持课程成绩的同时，尝试参与导师课题或申报大创项目，将理论知识应用于实际问题。" },
      { title: "拓展学科竞赛参与", content: "关注与你专业相关的国家级竞赛，组队参赛既能锻炼能力也能丰富履历。" },
    ],
    weakness: [
      { title: "夯实课程基础", content: "针对薄弱课程制定每周学习计划，利用图书馆资源和学习小组提升学习效率。" },
      { title: "培养学术兴趣", content: "多阅读专业相关的前沿论文，参加学术讲座和研讨会，逐步建立自己的学术方向。" },
    ]
  },
  ti: {
    strength: [
      { title: "保持运动习惯", content: "将已有的运动特长发展为长期爱好，参加校内体育社团或比赛，带动身边的同学一起锻炼。" },
    ],
    weakness: [
      { title: "建立规律锻炼计划", content: "每周至少运动3次，每次30分钟以上，可以选择跑步、游泳或球类运动，循序渐进提升体质。" },
      { title: "关注身心平衡", content: "学习压力管理技巧，适当参加文体活动放松心情，良好的身心状态是高效学习的基础。" },
    ]
  },
  mei: {
    strength: [
      { title: "发挥美育特长", content: "利用你在宣传和创作方面的优势，参与校园文化活动的策划与设计，提升个人影响力。" },
    ],
    weakness: [
      { title: "提升审美与表达能力", content: "多接触优秀的设计作品和艺术展览，学习基础的设计软件或摄影技巧，提升视觉表达水平。" },
      { title: "积极参与宣传活动", content: "加入学生会宣传部门或社团媒体组，在实践中锻炼文案写作和新媒体运营能力。" },
    ]
  },
  lao: {
    strength: [
      { title: "拓展实践深度", content: "将社会实践从参与提升到组织层面，尝试带领团队开展有影响力的项目，锻炼领导力。" },
    ],
    weakness: [
      { title: "增加社会实践经历", content: "利用寒暑假参加实习或社会调研，每学年至少完成一次有深度的实践活动并撰写报告。" },
      { title: "培养劳动意识", content: "从日常宿舍卫生和校园公益劳动做起，养成勤于动手、乐于奉献的劳动习惯。" },
    ]
  }
}

const adviceItems = computed(() => {
  // 优先用 generateReport 返回的 AI 建议，其次 getAdvice，最后前端模板
  if (reportData.value?.advice?.length) return reportData.value.advice
  if (adviceData.value?.length) return adviceData.value
  const sorted = [...dimensionAnalysis.value].sort((a, b) => b.score - a.score)
  const items = []

  // 优势维度：取前两名，从对应维度的 strength 建议池中取
  const strengths = sorted.filter(d => d.score >= 70).slice(0, 2)
  strengths.forEach(d => {
    const tips = adviceTips[d.key]?.strength
    if (tips?.length) {
      const tip = tips[items.length % tips.length]  // 循环取用，避免重复
      items.push({ type: "strength", title: `「${d.name}」— ${tip.title}`, content: `${d.desc}方面得分${d.score}分。${tip.content}` })
    }
  })

  // 待提升维度：取后两名，从对应维度的 weakness 建议池中取
  const weaknesses = sorted.filter(d => d.score < 70).slice(-2).reverse()
  weaknesses.forEach(d => {
    const tips = adviceTips[d.key]?.weakness
    if (tips?.length) {
      const tip = tips[items.length % tips.length]
      items.push({ type: "weakness", title: `「${d.name}」— ${tip.title}`, content: `${d.desc}方面目前${d.score}分。${tip.content}` })
    }
  })

  return items
})

// 综合评语数据
const sortedDimensions = computed(() => [...dimensionAnalysis.value].sort((a, b) => b.score - a.score))
const bestDim = computed(() => sortedDimensions.value[0] || null)
const worstDim = computed(() => sortedDimensions.value[4] || null)
const overallLevel = computed(() => {
  const F = parseFloat(evalData.value?.scores?.F) || 0
  return F >= 90 ? { label: "优秀", color: "#059669", bg: "#ECFDF5" }
    : F >= 80 ? { label: "良好", color: "#4F46E5", bg: "#EEF2FF" }
    : F >= 70 ? { label: "中等", color: "#D97706", bg: "#FFFBEB" }
    : F >= 60 ? { label: "合格", color: "#DC2626", bg: "#FEF2F2" }
    : { label: "待提升", color: "#9CA3AF", bg: "#F3F4F6" }
})
// 综合评语段落：优先 AI 生成的文本
const hasAiReport = computed(() => reportData.value?.source === "ai" && reportData.value?.report_content)
const overallSummary = computed(() => {
  if (hasAiReport.value) return reportData.value.report_content
  const F = parseFloat(evalData.value?.scores?.F) || 0
  return F >= 90 ? "整体表现卓越，德智体美劳全面发展，望再接再厉，追求更高成就。"
    : F >= 80 ? "整体表现优秀，各维度发展较为均衡。建议在保持优势的同时，重点关注提升方向中的薄弱维度。"
    : F >= 70 ? "整体表现良好，部分维度已达中上水平。建议重点补齐短板，特别是提升方向中指出的维度，以实现全面进步。"
    : F >= 60 ? "整体表现合格，但多个维度存在明显短板。建议制定系统的提升计划，在保持基本素质的同时，加强薄弱环节的针对性训练。"
    : "整体表现需重点提升，各维度均有较大进步空间。建议从优势维度入手建立信心，同时系统性地加强课程学习与创新实践能力培养。"
})


async function loadData() {
  loading.value = true
  try {
    const r1 = await getBatches(); if (r1.code === 200) batches.value = r1.data || []
    // 默认选最新学年（按年份降序取第一个）
    if (!currentBatch.value && batches.value.length) {
      const sorted = [...batches.value].sort((a, b) => (b.title || "").localeCompare(a.title || ""))
      currentBatch.value = String(sorted[0].id)
    }
    const batchId = currentBatch.value ? Number(currentBatch.value) : null
    const p = batchId ? { batch_id: batchId } : {}
    const [r2, r3] = await Promise.all([getEvaluation(p), getAdvice(p)])
    if (r2.code === 200 && r2.data) evalData.value = r2.data; else evalData.value = null
    if (r3.code === 200) adviceData.value = r3.data || []
    // 按批次查缓存：有缓存直接用，无缓存或 ?refresh=1 调 AI
    const batchCache = loadCache(currentBatch.value)
    const hasCache = batchCache.reportData?.report_content
    const forceRefresh = route.query.refresh === "1"
    if (evalData.value && hasCache && !forceRefresh) {
      reportData.value = batchCache.reportData
    } else if (evalData.value) {
      await handleGenerate()
    }
  } catch { evalData.value = null; adviceData.value = [] } finally { loading.value = false }
}

async function handleGenerate() {
  generating.value = true
  try {
    const batchId = currentBatch.value ? Number(currentBatch.value) : null
    const p = batchId ? { batch_id: batchId } : {}
    const res = await generateReport(p)
    if (res.code === 200) {
      reportData.value = res.data
      adviceData.value = res.data.advice || []
      saveCache(currentBatch.value, { reportData: res.data })
    }
    else alert(res.msg || "生成失败")
  } catch { alert("网络错误，请重试") } finally { generating.value = false }
}

async function handleExport() {
  if (!reportRef.value || exporting.value) return
  exporting.value = true
  try {
    await new Promise(r => setTimeout(r, 100))
    const name = (evalData.value?.student?.name || "报告").replace(/\s/g, "_")
    const filename = `评定报告_${name}_${new Date().toLocaleDateString("zh-CN").replace(/\//g, "-")}`
    if (exportFormat.value === "pdf") await exportPDF(reportRef.value, filename + ".pdf")
    else await exportImage(reportRef.value, filename + "." + exportFormat.value, exportFormat.value)
  } catch (e) { alert("导出失败：" + e.message) } finally { exporting.value = false }
}

onMounted(loadData)
</script>
<style scoped>
.report-page { display: flex; flex-direction: column; gap: 24px; animation: fadeIn 0.4s var(--easing-decelerate); position: relative; }

.bg-atmosphere { position: fixed; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; z-index: 0; overflow: hidden; }
.orb { position: absolute; border-radius: 50%; opacity: 0.06; filter: blur(80px); }
.orb-1 { width: 380px; height: 380px; background: var(--color-primary); top: -80px; right: -80px; animation: orbDrift1 16s ease-in-out infinite; }
.orb-2 { width: 260px; height: 260px; background: var(--color-warning); bottom: -60px; left: -60px; animation: orbDrift2 20s ease-in-out infinite; }

.page-header { display: flex; justify-content: space-between; align-items: flex-start; position: relative; z-index: 1; }
.header-right { display: flex; align-items: center; gap: 10px; }
.nav-link-btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 18px; border: 1px solid var(--color-border); border-radius: var(--radius-full); font-size: 13px; color: var(--color-primary); cursor: pointer; text-decoration: none; transition: all var(--duration-fast); }
.nav-link-btn:hover { border-color: var(--color-primary); background: var(--color-primary-light); }
.page-header h2 { font-size: var(--font-scale-h2); font-weight: var(--font-weight-semibold); }
.page-desc { font-size: var(--font-scale-body-sm); color: var(--color-text-secondary); margin-top: 2px; }
.batch-select { padding: 9px 32px 9px 16px; border: 1px solid var(--color-border); border-radius: var(--radius-full); font-size: 13px; background: var(--glass-bg); backdrop-filter: var(--glass-blur); color: var(--color-text); cursor: pointer; outline: none; appearance: none; -webkit-appearance: none; background-image: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'%3E%3Cpath fill='%235F6368' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E\"); background-repeat: no-repeat; background-position: right 12px center; transition: all var(--duration-fast); }
.batch-select:hover { border-color: var(--color-primary); }
.batch-select:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
.loading-state { display: flex; flex-direction: column; gap: 24px; position: relative; z-index: 1; }
.sk-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.empty-state { text-align: center; padding: 80px 24px; position: relative; z-index: 1; }
.empty-icon { font-size: 48px; color: var(--color-primary); margin-bottom: 16px; opacity: 0.5; }
.empty-state p { font-size: 18px; color: var(--color-text); margin-bottom: 8px; }
.empty-state span { font-size: 14px; color: var(--color-text-secondary); }
.generate-card h3 { font-size: 20px; margin-bottom: 12px; }
.generate-card p { font-size: 14px; color: var(--color-text-secondary); margin-bottom: 28px; max-width: 400px; margin-inline: auto; }
.gen-icon { font-size: 48px; color: var(--color-primary); margin-bottom: 16px; opacity: 0.6; }
.gen-btn { display: inline-flex; align-items: center; gap: 8px; padding: 12px 40px; background: var(--color-primary-gradient-bright); color: #fff; border: none; border-radius: var(--radius-full); font-size: 16px; font-weight: var(--font-weight-semibold); cursor: pointer; box-shadow: 0 4px 20px rgba(99,102,241,0.3); transition: all var(--duration-normal) var(--easing-spring); }
.gen-btn:hover:not(:disabled) { box-shadow: 0 8px 32px rgba(99,102,241,0.4); transform: translateY(-2px); }
.gen-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

/* 报告内容 */
.report-content { display: flex; flex-direction: column; gap: 24px; position: relative; z-index: 1; }
.reveal { animation: fadeInUp 0.6s var(--easing-spring) both; }
.export-card { position: relative; overflow: hidden; padding: 24px; background: var(--glass-bg); backdrop-filter: var(--glass-blur); -webkit-backdrop-filter: var(--glass-blur); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); box-shadow: var(--glass-shadow); transition: all var(--duration-normal) var(--easing-spring); }
.export-card:hover { transform: translateY(-3px); box-shadow: var(--glass-shadow-hover); }
.export-card:hover .card-accent { opacity: 1; }
.card-accent { position: absolute; top: 0; left: 0; right: 0; height: 3px; opacity: 0.6; border-radius: 3px 3px 0 0; transition: opacity var(--duration-normal); }
.export-card h3 { font-size: 16px; font-weight: var(--font-weight-semibold); margin-bottom: 20px; display: flex; align-items: center; gap: 8px; }
.export-icon { font-size: 12px; opacity: 0.7; }

/* 报告头部 */
.rh-student { display: flex; align-items: baseline; gap: 16px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid var(--color-border); }
.rhs-name { font-size: 24px; font-weight: var(--font-weight-bold); color: var(--color-text); }
.rhs-meta { font-size: 14px; color: var(--color-text-secondary); }

.rh-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.rhc-item { text-align: center; padding: 16px 12px; background: var(--color-surface-variant); border-radius: var(--radius-lg); }
.rhc-label { font-size: 12px; color: var(--color-text-secondary); margin-bottom: 6px; }
.rhc-value { font-size: 20px; font-weight: var(--font-weight-bold); color: var(--color-text); }
.rhc-value.primary { color: var(--color-primary); }
.rhc-unit { font-size: 13px; font-weight: var(--font-weight-regular); color: var(--color-text-secondary); }

.dim-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; }
.dim-card { padding: 18px 14px; border-radius: var(--radius-lg); background: var(--color-surface-variant); border-top: 3px solid; }
.dc-head { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.dc-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.dc-name { font-size: 15px; font-weight: var(--font-weight-semibold); flex: 1; }
.dc-badge { font-size: 11px; padding: 2px 8px; border-radius: var(--radius-full); font-weight: var(--font-weight-medium); }
.dc-score { font-size: 28px; font-weight: var(--font-weight-bold); color: var(--color-text); margin-bottom: 6px; }
.dc-unit { font-size: 14px; font-weight: var(--font-weight-regular); color: var(--color-text-secondary); }
.dc-desc { font-size: 11px; color: var(--color-text-secondary); line-height: 1.5; }

/* 综合评语 */
.review-score-row { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; }
.review-score-badge { padding: 6px 18px; border-radius: var(--radius-full); font-size: 16px; font-weight: var(--font-weight-bold); }
.review-score-text { font-size: 15px; color: var(--color-text); }
.review-score-text strong { color: var(--color-primary); font-size: 18px; }

.review-formula { padding: 10px 16px; background: var(--color-surface-variant); border-radius: var(--radius-md); font-size: 13px; color: var(--color-text-secondary); margin-bottom: 20px; text-align: center; font-family: monospace; }
.rf-num { color: var(--color-primary); font-weight: var(--font-weight-semibold); }

.review-dims { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
.review-dim-row { display: flex; align-items: center; gap: 10px; }
.rd-name { width: 32px; font-size: 13px; font-weight: var(--font-weight-medium); color: var(--color-text); flex-shrink: 0; }
.rd-bar-track { flex: 1; height: 6px; background: var(--color-surface-variant); border-radius: 3px; overflow: hidden; }
.rd-bar-fill { height: 100%; border-radius: 3px; transition: width 1s var(--easing-spring); }
.rd-score { width: 28px; text-align: right; font-size: 13px; font-weight: var(--font-weight-bold); flex-shrink: 0; }
.rd-level { font-size: 11px; padding: 1px 8px; border-radius: var(--radius-full); font-weight: var(--font-weight-medium); flex-shrink: 0; }

.review-analysis { display: flex; gap: 14px; margin-bottom: 20px; }
.ra-card { flex: 1; display: flex; align-items: flex-start; gap: 12px; padding: 16px; border-radius: var(--radius-md); }
.ra-strength { background: #ECFDF5; }
.ra-weakness { background: #EEF2FF; }
.ra-icon { font-size: 22px; flex-shrink: 0; color: var(--color-primary); margin-top: 1px; }
.ra-title { font-size: 14px; font-weight: var(--font-weight-semibold); color: var(--color-text); margin-bottom: 4px; }
.ra-desc { font-size: 13px; color: var(--color-text-secondary); line-height: 1.5; }

.review-summary { padding: 16px 20px; border-radius: var(--radius-md); border-left: 4px solid; font-size: 14px; line-height: 1.7; color: var(--color-text); }

@media (max-width: 600px) { .review-analysis { flex-direction: column; } }

.advice-list { display: flex; flex-direction: column; gap: 16px; }
.advice-card { display: flex; gap: 16px; padding: 20px; background: var(--color-surface-variant); border-radius: var(--radius-lg); align-items: flex-start; }
.ac-badge { flex-shrink: 0; padding: 4px 12px; border-radius: var(--radius-full); font-size: 12px; font-weight: var(--font-weight-semibold); }
.ac-strength { background: #ECFDF5; color: #059669; }
.ac-weakness { background: #EEF2FF; color: #4F46E5; }
.ac-body { flex: 1; }
.ac-title { font-size: 15px; font-weight: var(--font-weight-semibold); color: var(--color-text); margin-bottom: 6px; }
.ac-content { font-size: 14px; color: var(--color-text-secondary); line-height: 1.6; }

.bottom-actions { display: flex; gap: 12px; justify-content: center; align-items: center; padding-top: 8px; flex-wrap: wrap; position: relative; z-index: 1; }
.btn-outline { display: inline-flex; align-items: center; gap: 6px; padding: 10px 28px; border-radius: var(--radius-full); font-size: 14px; font-weight: var(--font-weight-medium); cursor: pointer; transition: all var(--duration-fast) var(--easing-standard); border: 1px solid var(--color-primary); background: transparent; color: var(--color-primary); }
.btn-outline:hover:not(:disabled) { background: var(--color-primary-light); }
.btn-outline:disabled { opacity: 0.5; cursor: not-allowed; }
.export-group { display: flex; align-items: center; }
.export-select { padding: 9px 32px 9px 14px; border: 1px solid var(--color-border); border-right: none; border-radius: var(--radius-full) 0 0 var(--radius-full); font-size: 13px; background: var(--glass-bg); backdrop-filter: var(--glass-blur); color: var(--color-text); cursor: pointer; outline: none; appearance: none; -webkit-appearance: none; background-image: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'%3E%3Cpath fill='%235F6368' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E\"); background-repeat: no-repeat; background-position: right 10px center; transition: all var(--duration-fast); }
.export-select:hover { border-color: var(--color-primary); }
.export-select:focus { border-color: var(--color-primary); }
.btn-export { display: inline-flex; align-items: center; gap: 6px; padding: 10px 24px; border: none; border-radius: 0 var(--radius-full) var(--radius-full) 0; background: var(--color-primary-gradient-bright); color: #fff; font-size: 14px; font-weight: var(--font-weight-semibold); cursor: pointer; box-shadow: 0 4px 20px rgba(99,102,241,0.3); transition: all var(--duration-normal) var(--easing-spring); }
.btn-export:hover:not(:disabled) { box-shadow: 0 8px 32px rgba(99,102,241,0.4); transform: translateY(-2px); }
.btn-export:disabled { opacity: 0.6; cursor: not-allowed; transform: none; box-shadow: none; }

@media (max-width: 900px) { .dim-grid { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 600px) { .dim-grid { grid-template-columns: 1fr 1fr; } .rh-cards { grid-template-columns: repeat(2, 1fr); } .rh-student { flex-direction: column; gap: 4px; } }
</style>
