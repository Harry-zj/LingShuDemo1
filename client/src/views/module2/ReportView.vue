<template>
  <div class="report-page">
    <div class="bg-atmosphere"><div class="orb orb-1"></div><div class="orb orb-2"></div></div>

    <div class="page-header">
      <div>
        <h2>个性化评定报告</h2>
        <p class="page-desc">成长档案 · 定性诊断 · 目标规划</p>
      </div>
      <div class="header-right">
        <router-link to="/module2/evaluation" class="nav-btn glass-card">
          <VIcon icon="mdi:chart-box-outline" /> 数据总览
        </router-link>
        <select v-model="currentBatch" @change="loadData" class="batch-select glass-card">
          <option value="">选择批次</option>
          <option v-for="b in batches" :key="b.id" :value="b.id">{{ b.title }}</option>
        </select>
      </div>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="skeleton" style="height:80px"></div>
      <div class="skeleton" style="height:160px"></div>
      <div class="skeleton" style="height:120px"></div>
    </div>

    <div v-else-if="!evalData" class="empty-state glass-card">
      <VIcon icon="mdi:file-document-outline" class="empty-icon" />
      <p>暂无评定数据</p>
      <span>请等待评定完成后再查看个性报告</span>
    </div>

    <!-- ====== 65/35 双栏 ====== -->
    <div v-else class="report-layout">
      <!-- ===== 左侧 65%：档案·画像·规划 ===== -->
      <div class="col-left">
        <!-- 1. 学生档案卡片 -->
        <div class="card archive-card">
          <div class="card-accent" style="background:var(--color-primary)"></div>
          <div class="ar-top">
            <div class="ar-avatar">{{ (evalData.student?.name || '?')[0] }}</div>
            <div class="ar-info">
              <div class="ar-name">{{ evalData.student?.name || '--' }}</div>
              <div class="ar-meta">{{ evalData.student?.grade || '--' }} · {{ evalData.student?.class || '--' }} · {{ evalData.student?.major || '--' }}</div>
            </div>
            <div class="ar-tags">
              <span class="ar-tag-level" :style="{ background: overallLevel.bg, color: overallLevel.color }">{{ overallLevel.label }}</span>
            </div>
          </div>
          <div class="ar-detail-row">
            <div class="ar-item"><span class="ar-item-l">测评学年</span><span class="ar-item-v">{{ evalData.student?.semester || '--' }}</span></div>
            <div class="ar-item"><span class="ar-item-l">辅导员</span><span class="ar-item-v">--</span></div>
            <div class="ar-item"><span class="ar-item-l">优势维度</span><span class="ar-item-v" :style="{ color: topDim?.color }">{{ topDim?.name || '--' }}</span></div>
            <div class="ar-item"><span class="ar-item-l">薄弱维度</span><span class="ar-item-v" :style="{ color: bottomDim?.color }">{{ bottomDim?.name || '--' }}</span></div>
          </div>
          <div class="ar-summary-tag">{{ growthLabel }}</div>
        </div>

        <!-- 2. AI 综合总评 -->
        <div class="card ai-review">
          <div class="card-accent" style="background:var(--color-primary)"></div>
          <h3>
            <VIcon icon="mdi:robot-outline" /> AI 综合总评
            <button class="ai-refresh-btn" @click="handleRegenerate" :disabled="generating" title="重新生成AI评语">
              <VIcon icon="mdi:refresh" :class="{ spinning: generating }" /> {{ generating ? '生成中...' : '重新生成' }}
            </button>
          </h3>
          <div class="ai-text">{{ overallReview }}</div>
          <div class="ai-tag-row">
            <span class="ai-tag" :style="{ background: overallLevel.bg, color: overallLevel.color }">{{ overallLevel.label }}等次</span>
            <span class="ai-tag" v-if="topDim" style="background:#ECFDF5;color:#059669">{{ topDim.name }}优势突出</span>
            <span class="ai-tag" v-if="bottomDim" style="background:#EEF2FF;color:#4F46E5">{{ bottomDim.name }}待提升</span>
            <span class="ai-tag" style="background:#FFF7ED;color:#EA580C">{{ growthLabel }}</span>
          </div>
        </div>

        <!-- 3. 分阶段提升方案 -->
        <div class="card plan-card">
          <div class="card-accent" style="background:var(--color-warning)"></div>
          <h3><VIcon icon="mdi:calendar-check-outline" /> 分阶段提升方案</h3>
          <div class="plan-row">
            <div class="plan-block">
              <div class="plan-phase"><span class="plan-phase-inner">本月 / 期末前</span></div>
              <ul class="plan-list">
                <li v-for="(s, i) in shortTermPlan" :key="'s'+i"
                  :class="{ done: isPlanDone('short', i) }"
                  @click="togglePlanDone('short', i)">
                  <span class="plan-check">{{ isPlanDone('short', i) ? '✓' : '' }}</span>{{ s }}
                </li>
              </ul>
            </div>
            <div class="plan-divider"></div>
            <div class="plan-block">
              <div class="plan-phase"><span class="plan-phase-inner">学年内</span></div>
              <ul class="plan-list">
                <li v-for="(l, i) in longTermPlan" :key="'l'+i"
                  :class="{ done: isPlanDone('long', i) }"
                  @click="togglePlanDone('long', i)">
                  <span class="plan-check">{{ isPlanDone('long', i) ? '✓' : '' }}</span>{{ l }}
                </li>
              </ul>
            </div>
          </div>
        </div>

        <!-- 4. 成长目标 -->
        <div class="card goals-card">
          <div class="card-accent" style="background:var(--color-success)"></div>
          <h3><VIcon icon="mdi:flag-outline" /> 成长目标</h3>
          <div class="goals-layout">
            <!-- 左侧 30%：目标预览 -->
            <div class="goals-preview">
              <div class="gp-item" v-for="g in goalItems" :key="g.key"
                :class="{ 'gp-filled': g.text, 'gp-active': editGoal === g.key }"
                @click="focusGoal(g.key)">
                <span class="goal-dot" :style="{ background: g.color }"></span>
                <span class="goal-dim">{{ g.name }}</span>
                <span class="gp-preview" v-if="g.text">{{ g.text }}</span>
                <span class="gp-placeholder" v-else>点击添加目标...</span>
              </div>
            </div>
            <!-- 右侧 65%：记事本编辑区 -->
            <div class="goals-editor">
              <div class="ge-toolbar">
                <span class="ge-dim-indicator">
                  <span class="goal-dot" :style="{ background: currentGoal?.color }"></span>
                  {{ currentGoal?.name }} 维度目标
                </span>
                <span class="ge-count">字数 {{ editGoalText.length }}</span>
              </div>
              <textarea class="ge-textarea" v-model="editGoalText"
                :placeholder="currentGoal?.placeholder || '请从左侧选择维度，在此输入目标...'"></textarea>
              <div class="ge-footer">
                <button class="ge-clear-btn" @click="clearGoal" v-if="editGoalText">清空</button>
                <span class="ge-saved-msg" v-if="saved">✓ 已保存</span>
                <button class="ge-save-btn" @click="saveGoals">{{ saved ? '更新保存' : '保存目标' }}</button>
              </div>
            </div>
          </div>
        </div>

        <!-- 5. 历年成长文字时间轴 -->
        <div class="card timeline-card">
          <div class="card-accent" style="background:var(--color-primary)"></div>
          <h3><VIcon icon="mdi:timeline-text-outline" /> 历年成长回顾</h3>
          <div class="tl-list" v-if="timelineItems.length">
            <div class="tl-item" v-for="(t, i) in timelineItems" :key="i">
              <div class="tl-dot-wrap"><span class="tl-dot" :class="{ active: i === timelineItems.length - 1 }"></span><span class="tl-line" v-if="i < timelineItems.length - 1"></span></div>
              <div class="tl-body">
                <div class="tl-year">{{ t.year }}</div>
                <div class="tl-summary">{{ t.summary }}</div>
                <div class="tl-detail" v-if="t.detail">{{ t.detail }}</div>
              </div>
            </div>
          </div>
          <div v-else class="tl-empty">仅有一个学年数据，暂无跨年度对比回顾</div>
        </div>

      </div>

      <!-- ===== 右侧 35%：诊断·方案·操作 ===== -->
      <div class="col-right">
        <!-- 1. 五维定性文字画像 -->
        <div class="card profile-card">
          <div class="card-accent" style="background:var(--color-meiyu)"></div>
          <h3><VIcon icon="mdi:account-details" /> 五维个性画像</h3>
          <div class="pf-grid">
            <div class="pf-item" v-for="d in dimensionProfiles" :key="d.key" :style="{ borderLeftColor: d.color }"
              @click="$router.push('/module2/dimension/' + d.key)" title="查看{{ d.name }}维度活动指南">
              <div class="pf-head">
                <span class="pf-dot" :style="{ background: d.color }"></span>
                <span class="pf-name">{{ d.name }}</span>
                <span class="pf-score-sm">{{ d.score }}分</span>
                <span class="pf-badge" :style="{ background: d.level.bg, color: d.level.color }">{{ d.level.label }}</span>
                <span class="pf-dim-tag" v-if="d.isTop" style="background:#ECFDF5;color:#059669">优势维度</span>
                <span class="pf-dim-tag" v-else-if="d.isBottom" style="background:#FEF2F2;color:#DC2626">薄弱维度</span>
              </div>
              <p class="pf-text">{{ d.summary }}</p>
            </div>
          </div>
        </div>

        <!-- 2. 本学年亮点 -->
        <div class="hl-card hl-good" style="margin-bottom:14px">
          <div class="hl-title"><VIcon icon="mdi:star-outline" /> 本学年亮点记录</div>
          <div class="hl-item" v-for="(h, i) in highlights" :key="i">
            <span class="hl-bullet">✦</span>
            <div><strong>{{ h.title }}</strong><p class="hl-detail">{{ h.detail }}</p></div>
          </div>
          <div v-if="!highlights.length" class="hl-empty">暂无突出亮点记录</div>
        </div>

        <!-- 3. 待提升事项 -->
        <div class="hl-card hl-bad" style="margin-bottom:14px">
          <div class="hl-title"><VIcon icon="mdi:alert-circle-outline" /> 待提升事项</div>
          <div class="hl-item" v-for="(g, i) in gaps" :key="i">
            <span class="hl-bullet gap">○</span>
            <div><strong>{{ g.title }}</strong><p class="hl-detail">{{ g.detail }}</p></div>
          </div>
          <div v-if="!gaps.length" class="hl-empty">各项发展均衡，无明显短板</div>
        </div>

        <!-- 4. 操作功能区 -->
        <div class="action-bar">
          <button class="act-btn primary" @click="handleExport('pdf')" :disabled="exporting">
            <VIcon icon="mdi:file-pdf-box" /> 导出完整PDF评定报告
          </button>
          <button class="act-btn" @click="handleExport('png')">
            <VIcon icon="mdi:image-outline" /> 保存为图片
          </button>
          <button class="act-btn" @click="shareReport">
            <VIcon icon="mdi:share-variant-outline" /> 分享报告
          </button>
          <button class="act-btn" @click="handleGenerateSummary" :disabled="summarizing">
            <VIcon icon="mdi:clipboard-text-outline" /> {{ summaryText ? '重新生成年度总结' : '生成个人年度总结摘要' }}
          </button>
        </div>

        <!-- 年度总结展示 -->
        <div class="summary-box-card" v-if="summaryText">
          <div class="sum-header">
            <VIcon icon="mdi:clipboard-text-outline" /> 个人年度总结
            <button class="sum-copy" @click="navigator.clipboard.writeText(summaryText);alert('已复制')">📋 复制</button>
          </div>
          <p class="sum-text">{{ summaryText }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue"
import { useRoute } from "vue-router"
import { getEvaluation, generateReport, getAdvice, getHistory, getReportCache, saveReportCache, generateSummary } from "../../api/module2"
import { getBatches } from "../../api/module3"
import { exportPDF, exportImage } from "../../utils/exportReport"
import { rawToDimensions, DIMENSION_CONFIG, getGradeLevel } from "../../utils/scoreHelper"

const route = useRoute()
// 服务端缓存（跨设备同步）
let _cache = { reportData: null, dimProfiles: null, goals: null, planDone: null }
async function loadCache(batchId) {
  try { const r = await getReportCache({ batch_id: batchId }); if (r.code === 200 && r.data) _cache = r.data } catch {}
  return _cache
}
async function saveCache(batchId) {
  try { await saveReportCache({ batchId: Number(batchId), reportData: _cache.reportData, dimProfiles: _cache.dimProfiles, goals: _cache.goals, planDone: _cache.planDone }) } catch {}
}

const loading = ref(true), generating = ref(false), exporting = ref(false), summarizing = ref(false)
const evalData = ref(null), reportData = ref({}), adviceData = ref([]), historyData = ref(null)
const summaryText = ref('')
const batches = ref([]), currentBatch = ref("")

const editGoal = ref('zhi')
const saved = ref(false)
const currentGoal = computed(() => goalItems.value.find(g => g.key === editGoal.value))
const editGoalText = computed({
  get: () => currentGoal.value?.text || '',
  set: (val) => { const g = goalItems.value.find(x => x.key === editGoal.value); if (g) { g.text = val; saved.value = false } }
})
function focusGoal(key) { editGoal.value = key }
function clearGoal() {
  const g = goalItems.value.find(x => x.key === editGoal.value)
  if (g) { g.text = ''; saved.value = false }
}

const goalItems = ref([
  { key:'de',name:'德',color:'#D97706',text:'',placeholder:'例：\n1.上课不迟到不早退\n2.上课不走神、不玩手机\n' },
  { key:'zhi',name:'智',color:'#4F46E5',text:'',placeholder:'例：\n1.在课程成绩不退步的前提下，提升成绩\n2.参加1项学科竞赛' },
  { key:'ti',name:'体',color:'#059669',text:'',placeholder:'例：\n1.每周运动3次、体测达标\n2.认真校园跑\n3.参加至少一项运动会项目' },
  { key:'mei',name:'美',color:'#7C3AED',text:'',placeholder:'例：\n1.参与1次宣传活动\n2.学习摄影\n3.学习海报制作、新闻写作' },
  { key:'lao',name:'劳',color:'#EA580C',text:'',placeholder:'例：\n1.完成1次社会实践\n2.加入一个社团\n3.参加一次志愿活动' },
])

const dimensionScores = computed(() => rawToDimensions(evalData.value))
const dimensionList = computed(() =>
  DIMENSION_CONFIG.map(d => ({ ...d, score: Math.round(dimensionScores.value[d.key] || 0), level: getGradeLevel(Math.round(dimensionScores.value[d.key] || 0)) }))
)
const sortedDims = computed(() => [...dimensionList.value].sort((a, b) => b.score - a.score))
const topDim = computed(() => sortedDims.value[0] || null)
const bottomDim = computed(() => sortedDims.value[4] || null)

const overallLevel = computed(() => {
  const F = parseFloat(evalData.value?.scores?.F) || 0
  return F >= 90 ? { label:"优秀",color:"#059669",bg:"#ECFDF5" } : F >= 80 ? { label:"良好",color:"#4F46E5",bg:"#EEF2FF" } : F >= 70 ? { label:"中等",color:"#D97706",bg:"#FFFBEB" } : F >= 60 ? { label:"合格",color:"#DC2626",bg:"#FEF2F2" } : { label:"待提升",color:"#9CA3AF",bg:"#F3F4F6" }
})

const growthLabel = computed(() => {
  const scores = sortedDims.value.map(d => d.score)
  const spread = scores[0] - scores[4]
  if (spread <= 15) return '均衡发展'
  if (spread <= 30) return '部分偏科'
  return '偏科较明显'
})

// 五维个性画像（本地模板，分数不同内容不同）
const dimensionProfiles = computed(() => {
  const sorted = [...dimensionList.value].sort((a, b) => b.score - a.score)
  const topKey = sorted[0]?.key
  const bottomKey = sorted[4]?.key
  return dimensionList.value.map(d => {
    const aS = evalData.value?.aScores || {}
    const bS = evalData.value?.bScores || {}
    const sc = evalData.value?.scores || {}
    const tpls = {
      de: (s,lv)=>{const a1=aS.A1||0,a2=aS.A2||0,a3=aS.A3||0,a4=aS.A4||0;const h=[a1,a2,a3,a4].filter(v=>v>=18).length;return `${s>=85?'思想修养表现优异，政治学习全勤参与，在同学中起到模范带头作用':s>=75?'思想品德良好，遵守校纪校规，有较强的集体荣誉感，可在主动性上继续提升':s>=60?'基本素质合格，日常行为较为规范，建议多参与主题班会和集体活动':'思想政治待加强，建议从参与党团活动做起，培养良好的学习作风和纪律意识'}。A类四项中${h>=3?'多项得分较高，品德修养扎实':h>=2?'部分指标突出，另有提升空间':'整体需重点关注，建议从日常习惯入手改善'}，评级${lv}。点击查看德育活动指南。`},
      zhi: (s,lv)=>{const f2=sc.F2||0,b1=bS.B1||0,b2=bS.B2||0,b3=bS.B3||0;const bt=b1+b2+b3;return `${s>=85?'学业能力突出，课程扎实，竞赛和科研表现优异，是综测总分的核心支撑':s>=75?'课程掌握良好，专业基础扎实，有潜力在竞赛和科研中取得更好成绩':s>=60?'学习成绩中等，建议强化专业核心课程，关注学科竞赛信息':'课程学习需重点突破，建议制定复习计划，优先夯实专业基础'}。课程${f2}分${bt>=20?'，创新实践合计'+bt+'分表现优异':bt>=10?'，创新实践合计'+bt+'分已有基础':bt>0?'，创新实践合计'+bt+'分初有尝试，建议加大竞赛科研参与':'，创新实践加分较少，建议从考取职业证书开始积累'}，评级${lv}。点击查看智育活动指南。`},
      ti: (s,lv)=>{const a5=aS.A5||0,b7=bS.B7||0;return `${s>=80?'身体素质优秀，锻炼习惯良好，文体竞赛表现突出':s>=65?'体质健康良好，体测基本达标，可尝试参与文体竞赛挑战自我':s>=50?'体育锻炼一般，建议建立每周固定运动计划，逐步提升体质':'体育锻炼不足，建议从每周2-3次低强度运动开始，关注体测达标'}。${b7>=15?`文体竞赛${b7}分，运动特长是重要加分渠道`:b7>=5?`文体活动${b7}分，建议多参与校运会、球赛等提升积分`:'文体竞赛参与较少，建议关注体育赛事通知积极报名'}，评级${lv}。点击查看体育活动指南。`},
      mei: (s,lv)=>{const b4=bS.B4||0;return `${s>=75?'审美与宣传能力突出，积极参与文艺创作和宣传报道，为校园文化做出贡献':s>=50?'美育素养待提升，有一定基础但参与不足，建议尝试投稿或参与宣传活动':s>=30?'美育处于起步阶段，建议从校报投稿、摄影比赛等活动开始参与':'美育是薄弱环节，建议加入宣传部门或文艺社团，从写作、摄影、设计中找到兴趣点'}。${b4>=15?`宣传${b4}分，文字表达和创作能力较强`:b4>=5?`宣传有基础（${b4}分），可继续深耕提升作品数量`:b4>0?`宣传初有尝试（${b4}分），建议保持稳定产出频率`:'暂无宣传成果，一篇校报发表即可获得基础加分'}，评级${lv}。点击查看美育活动指南。`},
      lao: (s,lv)=>{const b5=bS.B5||0,b6=bS.B6||0,b8=bS.B8||0;const t=b5+b6+b8;return `${s>=75?'劳动实践积极，在社会实践、公益劳动和学生工作方面表现良好':s>=60?'社会实践有基础，建议在深度和持续性上加强':s>=40?'劳动参与度待提高，建议利用课余和假期参加社会实践和志愿服务':'劳动参与度偏低，建议主动联系团委或辅导员获取实践机会'}。劳育三项合计${t}分${t>=30?'，实践经验丰富':t>=15?'，已具雏形，可拓展实践领域':'，建议每学期至少完成1-2次有效活动'}，评级${lv}。点击查看劳育活动指南。`},
    }
    return {
      ...d,
      summary: tpls[d.key]?.(d.score, d.level.label) || d.desc,
      isTop: d.key === topKey,
      isBottom: d.key === bottomKey && d.score < 70,
    }
  })
}
)

// 亮点 & 短板
const highlights = computed(() => {
  if (reportData.value?.highlights?.length) return reportData.value.highlights
  if (!evalData.value?.bScores) return []
  const bs = evalData.value.bScores
  const scored = Object.entries(bs).filter(([,v]) => (v||0) > 0).sort((a,b) => b[1] - a[1])
  const map = { B1:{title:'职业技能证书',detail:'获得相关职业资格证书，体现了专业技能水平'}, B2:{title:'学科竞赛获奖',detail:'在学科竞赛中取得优异成绩，展现了学术竞争力'}, B3:{title:'科研学术成果',detail:'参与科研项目或发表学术论文，具备研究潜力'}, B4:{title:'宣传报道贡献',detail:'在校报或新媒体平台发表作品，为校园文化传播做出贡献'}, B5:{title:'社会工作任职',detail:'担任学生干部或社团负责人，锻炼了组织协调能力'}, B6:{title:'社会实践项目',detail:'完成高质量社会实践，将理论知识应用于实际问题'}, B7:{title:'文体竞赛成绩',detail:'在校级及以上文体竞赛中获奖，综合素质突出'}, B8:{title:'劳动教育实践',detail:'积极参与劳动教育活动，培养了良好的劳动习惯'} }
  return scored.slice(0, 3).map(([k]) => map[k] || { title:k, detail:'表现突出' })
})
const gaps = computed(() => {
  if (reportData.value?.gaps?.length) return reportData.value.gaps
  if (!evalData.value?.bScores) return []
  const bs = evalData.value.bScores
  const low = Object.entries(bs).filter(([,v]) => (v||0) <= 5).sort((a,b) => (a[1]||0) - (b[1]||0))
  const map = { B1:{title:'缺少职业技能证书',detail:'建议考取与专业相关的职业资格证书'}, B2:{title:'学科竞赛参与不足',detail:'缺少学科竞赛经历，关注赛事信息并积极报名'}, B3:{title:'科研学术活动缺失',detail:'未参与科研或论文发表，联系导师争取机会'}, B4:{title:'宣传报道空白',detail:'尚无文艺创作或宣传成果，尝试投稿或新媒体'}, B5:{title:'社会工作经历不足',detail:'建议竞选班委或加入社团锻炼组织能力'}, B6:{title:'社会实践经历缺失',detail:'利用假期参加社会实践，提升实践能力'}, B7:{title:'文体竞赛参与较少',detail:'积极参与校运会等文体活动丰富课余生活'}, B8:{title:'劳动教育记录不足',detail:'参与校园公益劳动或社区志愿服务'} }
  return low.slice(0, 3).map(([k]) => map[k] || { title:k, detail:'建议补足相关经历' })
})

// 历年时间轴（仅显示 ≤ 当前查看批次学年的数据）
function extractYear(title) {
  const m = (title || '').match(/(\d{4})-\d{4}/)
  return m ? parseInt(m[1]) : 0
}
const filteredSemesters = computed(() => {
  const raw = historyData.value?.semesters || []
  const sorted = [...raw].sort((a, b) => extractYear(a.year) - extractYear(b.year))
  // 用当前加载的评定数据的学期作为截断点
  const activeTitle = evalData.value?.student?.semester || ''
  const targetYear = extractYear(activeTitle)
  if (!targetYear) return sorted
  return sorted.filter(s => extractYear(s.year) <= targetYear)
})
const timelineItems = computed(() => {
  const ss = filteredSemesters.value
  return ss.map((s, i) => {
    const F = s.scores?.total || 0
    const prev = i > 0 ? ss[i-1].scores?.total : null
    const diff = prev != null ? (F - prev).toFixed(1) : null
    const trend = diff != null ? (diff > 2 ? '显著提升' : diff > 0 ? '稳中有进' : diff > -2 ? '基本持平' : '有所下滑') : '首次测评'
    return { year: s.semester || s.year || `第${i+1}学年`, summary: `综测总分 ${F} 分，${trend}${diff != null ? '（' + (diff > 0 ? '+' : '') + diff + '）' : ''}`, detail: buildTimelineDetail(s, i, ss) }
  })
})
function buildTimelineDetail(s, i, all) {
  if (i === 0) return '初次参与综测评定，为后续学年建立了基线参考。'
  const prev = all[i-1]
  const dims = DIMENSION_CONFIG.map(d => ({ name:d.name, cur:s.scores?.[d.key]||0, prev:prev.scores?.[d.key]||0 }))
  const up = dims.filter(d=>d.cur-d.prev>=5).map(d=>d.name)
  const down = dims.filter(d=>d.prev-d.cur>=5).map(d=>d.name)
  let txt = ''
  if (up.length) txt += `${up.join('、')}维度显著提升。`
  if (down.length) txt += `${down.join('、')}维度有所下滑。`
  if (!up.length && !down.length) txt += '各维度与上学年基本持平。'
  return txt
}

// AI 综合总评
const overallReview = computed(() => {
  if (reportData.value?.source === 'ai' && reportData.value?.report_content) return reportData.value.report_content
  const td = topDim.value, bd = bottomDim.value
  const F = parseFloat(evalData.value?.scores?.F) || 0
  return `该生本学年综测总分为 ${F} 分，等级为「${overallLevel.value.label}」。在五维综合素养中，${td ? td.name+'维度表现最为突出（'+td.score+'分），'+td.desc+'等方面展现了扎实的基础。' : ''}${bd && bd.score < 70 ? '需重点关注'+bd.name+'维度（'+bd.score+'分），'+bd.desc+'方面仍有较大提升空间。' : ''}整体来看，该生${growthLabel.value}，建议在下一学年继续保持优势方向的同时，有针对性地补齐薄弱环节，实现更加全面的发展。`
})

// 分阶段方案
const shortTermPlan = computed(() => {
  if (reportData.value?.shortPlan?.length) return reportData.value.shortPlan
  const items = []
  const bd = bottomDim.value
  if (bd && bd.score < 70) {
    if (bd.key === 'mei') items.push('本月内完成1次校园宣传投稿或参与1次文艺活动')
    if (bd.key === 'lao') items.push('本学期参加至少1次社会实践活动或社区志愿服务')
    if (bd.key === 'ti') items.push('建立每周运动打卡计划，每周运动不少于3次')
    if (bd.key === 'zhi') items.push('制定薄弱课程复习计划，每天额外学习1小时')
    if (bd.key === 'de') items.push('本月参加1次班级或学院组织的思想政治学习活动')
  }
  items.push('完成本学期剩余课程的学习任务，确保期末考试稳定发挥')
  items.push('整理本学期所有综测相关材料，为下学期做好准备')
  return items
})
const longTermPlan = computed(() => {
  if (reportData.value?.longPlan?.length) return reportData.value.longPlan
  const items = []
  const bd = bottomDim.value
  if (bd && bd.key === 'mei') items.push('加入校园新媒体社团或宣传部，定期产出宣传作品')
  if (bd && bd.key === 'lao') items.push('暑期完成1次深度社会实践活动，并撰写实践报告')
  if (bd && bd.key === 'ti') items.push('报名参加1项校级体育赛事，培养长期运动爱好')
  if (bd && bd.key === 'zhi') items.push('报名参加1-2项学科竞赛，争取获得省级以上奖项')
  if (bd && bd.key === 'de') items.push('竞选班委或加入学生会，提升组织协调能力和责任意识')
  items.push('全面提升综测各维度参与度，力争下学年综测等级提升一档')
  return items
})

// 提升方案勾选状态
const planDone = ref({})
function isPlanDone(type, idx) {
  return !!planDone.value[type + '_' + idx]
}
function togglePlanDone(type, idx) {
  const key = type + '_' + idx
  planDone.value[key] = !planDone.value[key]
  if (!planDone.value[key]) delete planDone.value[key]
  _cache.planDone = { ...planDone.value }
  saveCache(currentBatch.value)
}

function saveGoals() {
  _cache.goals = goalItems.value.map(g => ({ key: g.key, text: g.text }))
  saveCache(currentBatch.value)
  saved.value = true
  setTimeout(() => { saved.value = false }, 3000)
}
function loadGoals() {
  goalItems.value.forEach(g => { g.text = '' })
  saved.value = false
  // 合并从维度活动指南页面添加的目标
  try {
    const pending = JSON.parse(localStorage.getItem('lingshu_goals_v2') || '[]')
    if (pending.length) {
      if (!_cache.goals) _cache.goals = []
      pending.forEach(p => {
        const existing = _cache.goals.find(g => g.key === p.key)
        if (existing) {
          existing.text = existing.text ? existing.text + '；' + p.text : p.text
        } else {
          _cache.goals.push(p)
        }
      })
      localStorage.removeItem('lingshu_goals_v2')
      saveCache(currentBatch.value)
    }
  } catch {}
  if (_cache.goals?.length) {
    _cache.goals.forEach(d => { const g = goalItems.value.find(x => x.key === d.key); if (g) g.text = d.text || '' })
  }
}

async function loadData() {
  loading.value = true
  try {
    const r1 = await getBatches(); if (r1.code === 200) batches.value = r1.data || []
    if (!currentBatch.value && batches.value.length) { const s = [...batches.value].sort((a, b) => (b.title || '').localeCompare(a.title || '')); currentBatch.value = String(s[0].id) }
    const bid = currentBatch.value ? Number(currentBatch.value) : null
    const p = bid ? { batch_id: bid } : {}
    await loadCache(currentBatch.value)

    // 基础数据并行加载
    const [r2, r3, r4] = await Promise.all([getEvaluation(p), getAdvice(p), getHistory()])
    if (r2.code === 200 && r2.data) evalData.value = r2.data; else evalData.value = null
    if (r3.code === 200) adviceData.value = r3.data || []
    if (r4.code === 200) historyData.value = r4.data

    // 综合评语+方案+亮点：有缓存直接读，无缓存调 AI
    if (evalData.value && _cache.reportData?.report_content) reportData.value = _cache.reportData
    else if (evalData.value) await handleGenerate()

    // 方案勾选状态
    planDone.value = _cache.planDone || {}

    loadGoals()
  } catch { evalData.value = null; adviceData.value = []; historyData.value = null }
  finally { loading.value = false }
}

async function handleGenerate() {
  generating.value = true
  try { const bid = currentBatch.value ? Number(currentBatch.value) : null; const p = bid ? { batch_id: bid } : {}; const res = await generateReport(p); if (res.code === 200) { reportData.value = res.data; adviceData.value = res.data.advice || []; _cache.reportData = res.data; saveCache(currentBatch.value) } }
  catch { /* silent */ }
  finally { generating.value = false }
}
async function handleRegenerate() {
  _cache.reportData = null
  await handleGenerate()
}

async function shareReport() {
  const url = window.location.href
  try {
    await navigator.clipboard.writeText(url)
    alert('报告链接已复制到剪贴板，可发送给辅导员查看')
  } catch {
    const text = `灵枢综测 · ${evalData.value?.student?.name || ''}的个性评定报告\n${url}`
    if (navigator.share) {
      try { await navigator.share({ title: '灵枢综测个性报告', text }) } catch {}
    } else {
      prompt('复制此链接分享报告：', url)
    }
  }
}
async function handleGenerateSummary() {
  summarizing.value = true
  try {
    const bid = currentBatch.value ? Number(currentBatch.value) : null
    const res = await generateSummary(bid ? { batch_id: bid } : {})
    if (res.code === 200 && res.data?.summary) {
      summaryText.value = res.data.summary
      await navigator.clipboard.writeText(res.data.summary)
      alert('年度总结已生成并复制到剪贴板，可直接粘贴使用！')
    }
  } catch { alert('生成失败，请重试') }
  finally { summarizing.value = false }
}

async function handleExport(fmt) {
  if (exporting.value) return; exporting.value = true
  try { const name = (evalData.value?.student?.name || '报告').replace(/\s/g, '_'); const fn = `个性评定报告_${name}_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}`; if (fmt === 'pdf') await exportPDF(document.querySelector('.report-layout'), fn + '.pdf'); else await exportImage(document.querySelector('.report-layout'), fn + '.' + fmt, fmt) }
  catch (e) { alert('导出失败：' + e.message) }
  finally { exporting.value = false }
}

onMounted(loadData)
</script>

<style scoped>
.report-page { display:flex; flex-direction:column; gap:24px; animation:fadeIn 0.4s ease; position:relative; padding-bottom:40px; }
.bg-atmosphere { position:fixed; top:0;left:0;right:0;bottom:0; pointer-events:none; z-index:0; overflow:hidden; }
.orb { position:absolute; border-radius:50%; opacity:0.04; filter:blur(80px); }
.orb-1 { width:380px;height:380px; background:var(--color-primary); top:-80px;right:-80px; }
.orb-2 { width:260px;height:260px; background:var(--color-meiyu); bottom:-60px;left:-60px; }

.page-header { display:flex; justify-content:space-between; align-items:flex-start; position:relative; z-index:1; }
.header-right { display:flex; align-items:center; gap:10px; }
.year-badge { font-size:14px; color:var(--color-text-secondary); padding:4px 12px; background:var(--color-surface-variant); border-radius:var(--radius-full); }
.page-header h2 { font-size:22px; font-weight:700; }
.page-desc { font-size:15px; color:var(--color-text-secondary); margin-top:6px; }
.batch-select { padding:8px 30px 8px 14px; border:1px solid var(--color-border); border-radius:var(--radius-full); font-size:14px; background:var(--glass-bg); color:var(--color-text); cursor:pointer; outline:none; appearance:none; -webkit-appearance:none; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'%3E%3Cpath fill='%235F6368' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 10px center; }
.nav-btn { display:inline-flex; align-items:center; gap:6px; padding:9px 20px; border:1px solid var(--color-border); border-radius:var(--radius-full); font-size:14px; color:var(--color-primary); text-decoration:none; transition:all 0.2s; white-space:nowrap; }
.nav-btn:hover { border-color:var(--color-primary); background:var(--color-primary-light); }

.loading-state { display:flex; flex-direction:column; gap:18px; position:relative; z-index:1; }
.skeleton { background:var(--color-surface-variant); border-radius:8px; }
.empty-state { text-align:center; padding:80px 24px; position:relative; z-index:1; }
.empty-icon { font-size:48px; color:var(--color-primary); opacity:0.5; margin-bottom:16px; }

/* === 65/35 === */
.report-layout { display:grid; grid-template-columns:65fr 35fr; gap:24px; position:relative; z-index:1; align-items:start; }
.col-left { display:flex; flex-direction:column; gap:20px; min-width:0; }
.col-right { display:flex; flex-direction:column; gap:16px; position:sticky; top:24px; }

.card { position:relative; overflow:hidden; padding:20px 24px; background:var(--glass-bg); border:1px solid var(--glass-border); border-radius:var(--radius-lg); }
.card-accent { position:absolute; top:0;left:0;right:0; height:3px; opacity:0.6; border-radius:3px 3px 0 0; }
.card h3 { font-size:17px; font-weight:600; margin-bottom:14px; display:flex; align-items:center; gap:8px; color:var(--color-text); }

/* 1. 档案卡片 */
.ar-top { display:flex; align-items:center; gap:14px; margin-bottom:14px; }
.ar-avatar { width:44px;height:44px; border-radius:50%; background:var(--color-primary); color:#fff; display:flex; align-items:center; justify-content:center; font-size:20px; font-weight:700; flex-shrink:0; }
.ar-info { flex:1; }
.ar-name { font-size:19px; font-weight:700; color:var(--color-text); }
.ar-meta { font-size:14px; color:var(--color-text-secondary); margin-top:2px; }
.ar-tags { display:flex; gap:6px; }
.ar-tag-level { padding:4px 14px; border-radius:var(--radius-full); font-size:15px; font-weight:600; }
.ar-detail-row { display:grid; grid-template-columns:1fr 1fr; gap:6px 20px; margin-bottom:12px; padding:14px 16px; background:var(--color-surface-variant); border-radius:8px; }
.ar-item { display:flex; gap:8px; font-size:14px; }
.ar-item-l { color:var(--color-text-secondary); flex-shrink:0; }
.ar-item-v { color:var(--color-text); font-weight:500; }
.ar-summary-tag { display:inline-block; padding:3px 12px; background:var(--color-primary-light); color:var(--color-primary); border-radius:var(--radius-full); font-size:14px; font-weight:500; }

/* 2. 五维文字画像 */
.pf-grid { display:flex; flex-direction:column; gap:10px; }
.pf-item { padding:12px 16px; border-left:3px solid; background:var(--color-surface-variant); border-radius:0 8px 8px 0; cursor:pointer; transition:all 0.2s; }
.pf-item:hover { background:var(--color-primary-light); transform:translateX(2px); }
.pf-head { display:flex; align-items:center; gap:6px; margin-bottom:4px; }
.pf-dot { width:7px;height:7px; border-radius:50%; flex-shrink:0; }
.pf-name { font-size:15px; font-weight:600; color:var(--color-text); }
.pf-score-sm { font-size:13px; font-weight:700; color:var(--color-text); margin-left:4px; }
.pf-badge { font-size:12px; padding:2px 8px; border-radius:var(--radius-full); font-weight:500; }
.pf-dim-tag { font-size:10px; padding:1px 6px; border-radius:var(--radius-full); font-weight:600; }
.pf-text { font-size:14px; color:var(--color-text-secondary); line-height:1.6; margin:0; }

/* 3. 亮点&短板 */
.hl-row { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.hl-card { padding:18px; border-radius:var(--radius-lg); border:1px solid var(--glass-border); }
.hl-good { background:#F8FAF5; }
.hl-bad { background:#FAFAFA; }
.hl-title { font-size:16px; font-weight:600; color:var(--color-text); margin-bottom:10px; display:flex; align-items:center; gap:6px; }
.hl-item { display:flex; gap:8px; margin-bottom:8px; font-size:14px; color:var(--color-text); }
.hl-item strong { font-size:14px; }
.hl-detail { font-size:13px; color:var(--color-text-secondary); margin:2px 0 0; line-height:1.4; }
.hl-bullet { color:#059669; flex-shrink:0; margin-top:1px; }
.hl-bullet.gap { color:#9AA0A6; }
.hl-empty { font-size:14px; color:var(--color-text-tertiary); text-align:center; padding:16px 0; }

/* 4. 成长目标 */
.goals-layout { display:flex; gap:20px; }
.goals-preview { width:200px; flex-shrink:0; display:flex; flex-direction:column; gap:6px; }
.gp-item { display:flex; align-items:center; gap:8px; padding:8px 12px; border-radius:8px; cursor:pointer; border:1px solid transparent; transition:all 0.2s; }
.gp-item:hover { background:var(--color-surface-variant); border-color:var(--color-border); }
.gp-item.gp-filled { background:var(--color-surface-variant); }
.gp-item.gp-active { background:var(--color-primary-light); border-color:var(--color-primary); }
.goal-dot { width:8px;height:8px; border-radius:50%; flex-shrink:0; }
.goal-dim { font-size:15px; font-weight:600; color:var(--color-text); width:28px; flex-shrink:0; }
.gp-preview { font-size:13px; color:var(--color-text-secondary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.gp-placeholder { font-size:13px; color:var(--color-text-tertiary); font-style:italic; }

.goals-editor { flex:1; display:flex; flex-direction:column; border:1px solid var(--color-border); border-radius:10px; overflow:hidden; background:var(--color-bg); }
.ge-toolbar { display:flex; align-items:center; justify-content:space-between; padding:8px 16px; border-bottom:1px solid var(--color-border); background:var(--color-surface-variant); }
.ge-dim-indicator { display:flex; align-items:center; gap:6px; font-size:14px; font-weight:600; color:var(--color-text); }
.ge-count { font-size:12px; color:var(--color-text-tertiary); }
.ge-textarea { flex:1; min-height:180px; padding:16px 18px; border:none; font-size:15px; font-family:inherit; color:var(--color-text); line-height:1.8; resize:vertical; outline:none; background:var(--color-bg); }
.ge-textarea::placeholder { color:var(--color-text-tertiary); }
.ge-footer { display:flex; align-items:center; justify-content:flex-end; gap:10px; padding:8px 14px; border-top:1px solid var(--color-border); background:var(--color-surface-variant); }
.ge-saved-msg { font-size:13px; color:#059669; font-weight:500; }
.ge-clear-btn { padding:5px 14px; border:1px solid var(--color-border); border-radius:var(--radius-full); background:transparent; color:var(--color-text-secondary); font-size:13px; cursor:pointer; transition:all 0.2s; }
.ge-clear-btn:hover { border-color:#DC2626; color:#DC2626; }
.ge-save-btn { padding:6px 18px; border:1px solid var(--color-primary); border-radius:var(--radius-full); background:var(--color-primary); color:#fff; font-size:14px; font-weight:500; cursor:pointer; transition:all 0.2s; }
.ge-save-btn:hover { opacity:0.9; }

/* 5. 时间轴 */
.tl-list { padding-left:4px; }
.tl-item { display:flex; gap:12px; }
.tl-dot-wrap { display:flex; flex-direction:column; align-items:center; width:14px; flex-shrink:0; }
.tl-dot { width:9px;height:9px; border-radius:50%; background:var(--color-border); }
.tl-dot.active { background:var(--color-primary); box-shadow:0 0 0 3px rgba(99,102,241,0.15); }
.tl-line { width:1px; flex:1; background:var(--color-border); margin:3px 0; }
.tl-body { padding-bottom:16px; }
.tl-year { font-size:15px; font-weight:600; color:var(--color-text); margin-bottom:2px; }
.tl-summary { font-size:14px; color:var(--color-text-secondary); }
.tl-detail { font-size:13px; color:var(--color-text-tertiary); margin-top:2px; line-height:1.4; }
.tl-empty { text-align:center; padding:24px; font-size:15px; color:var(--color-text-secondary); }

/* === 右侧 === */
.ai-refresh-btn { margin-left:auto; padding:4px 12px; border:1px solid var(--color-border); border-radius:var(--radius-full); background:transparent; color:var(--color-text-secondary); font-size:11px; cursor:pointer; display:flex; align-items:center; gap:4px; transition:all 0.2s; }
.ai-refresh-btn:hover:not(:disabled) { border-color:var(--color-primary); color:var(--color-primary); }
.ai-refresh-btn:disabled { opacity:0.5; cursor:not-allowed; }
.spinning { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform:rotate(360deg); } }

.ai-review h3 { font-size:18px; }
.ai-text { font-size:17px; color:var(--color-text); line-height:1.9; }
.ai-tag-row { display:flex; flex-wrap:wrap; gap:6px; margin-top:12px; }
.ai-tag { font-size:13px; padding:4px 12px; border-radius:var(--radius-full); font-weight:500; }

.plan-row { display:flex; gap:0; }
.plan-block { flex:0 0 48%; }
.plan-divider { width:0; flex-shrink:0; border-left:1px dashed var(--color-border); margin:0 2%; }
.plan-phase { margin-bottom:12px; }
.plan-phase-inner { font-size:14px; font-weight:600; color:var(--color-text); padding:2px 0; border-bottom:2px solid #059669; display:inline-block; }
.plan-list { margin:0; padding-left:0; list-style:none; }
.plan-list li { font-size:14px; color:var(--color-text-secondary); line-height:2.0; margin-bottom:4px; display:flex; align-items:flex-start; gap:8px; cursor:pointer; transition:all 0.2s; }
.plan-list li:hover .plan-check { border-color:var(--color-primary); }
.plan-list li.done { color:var(--color-text-tertiary); text-decoration:line-through; }
.plan-list li.done .plan-check { background:#059669; border-color:#059669; color:#fff; }
.plan-check { width:16px;height:16px; border:2px solid var(--color-border); border-radius:3px; flex-shrink:0; margin-top:3px; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; transition:all 0.2s; }

.action-bar { display:flex; flex-direction:column; gap:6px; }
.act-btn { display:flex; align-items:center; justify-content:center; gap:6px; padding:10px 14px; border:1px solid var(--color-border); border-radius:var(--radius-full); background:var(--glass-bg); color:var(--color-text); font-size:14px; cursor:pointer; transition:all 0.2s; }
.act-btn:hover:not(:disabled) { border-color:var(--color-primary); background:var(--color-primary-light); }
.act-btn.primary { background:var(--color-primary); color:#fff; border-color:var(--color-primary); }
.act-btn.primary:hover:not(:disabled) { background:var(--color-primary); opacity:0.9; }
.act-btn:disabled { opacity:0.5; cursor:not-allowed; }

.summary-box-card { margin-top:4px; padding:16px; border:1px solid var(--glass-border); border-radius:12px; background:var(--glass-bg); }
.sum-header { display:flex; align-items:center; gap:8px; font-size:14px; font-weight:600; color:var(--color-text); margin-bottom:10px; }
.sum-copy { margin-left:auto; padding:4px 12px; border:1px solid var(--color-border); border-radius:var(--radius-full); background:transparent; font-size:12px; cursor:pointer; }
.sum-copy:hover { border-color:var(--color-primary); }
.sum-text { font-size:14px; color:var(--color-text-secondary); line-height:1.9; margin:0; }

@media (max-width:1024px) { .report-layout { grid-template-columns:1fr; } .col-right { position:static; } }
@media (max-width:600px) { .ar-detail-row { grid-template-columns:1fr; } .hl-row { grid-template-columns:1fr; } .goals-layout { flex-direction:column; } }
</style>
