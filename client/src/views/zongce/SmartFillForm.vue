<template>
  <div class="form-page">
    <!-- ===== 上传模板区 ===== -->
    <div class="upload-section">
      <h4>上传 Word 模板</h4>
      <p class="hint">上传您的综测登记表模板（.docx），在模板中按需插入占位符，系统一键自动填充</p>

      <div v-if="!props.uploadedTemplate" class="upload-zone"
           :class="{ 'drag-over': isDragging, 'format-error': formatError }"
           @click="triggerUpload"
           @dragover.prevent="onDragOver"
           @dragleave="onDragLeave"
           @drop.prevent="onDrop">
        <span class="upload-icon">📤</span>
        <span>点击或拖拽上传 .docx 模板</span>
        <span class="upload-sub">仅支持 .docx 格式，大小不超过 10MB</span>
      </div>
      <input ref="fileInput" type="file" hidden accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" @change="onFileSelect" />

      <div v-if="props.uploadedTemplate" class="template-card">
        <div class="tpl-info">
          <span class="tpl-icon">📄</span>
          <div>
            <div class="tpl-name">{{ props.uploadedTemplate.name }}</div>
            <div class="tpl-meta">{{ formatSize(props.uploadedTemplate.size) }} · 上传成功</div>
          </div>
        </div>
        <button class="btn-text danger" @click="removeTemplate">✕ 删除</button>
      </div>

      <p v-if="formatError" class="error-msg">仅支持 .docx 格式，请重新上传</p>
    </div>


    <!-- ===== 数据预览区 ===== -->
    <div v-if="props.uploadedTemplate" class="data-preview">
      <div class="preview-header" @click="showPreview = !showPreview">
        <span>数据预览 - 以下数据将填入模板</span>
        <span class="toggle-arrow">{{ showPreview ? '收起' : '展开' }}</span>
      </div>
      <div v-show="showPreview" class="preview-body">
        <div class="preview-group">
          <div class="group-title">基本信息</div>
          <div class="group-grid">
            <div class="info-item"><span class="label">姓名</span><span class="value">{{ fillData.real_name }}</span></div>
            <div class="info-item"><span class="label">学号</span><span class="value">{{ fillData.student_id }}</span></div>
            <div class="info-item"><span class="label">学年</span><span class="value">{{ fillData.academic_year }}</span></div>
            <div class="info-item"><span class="label">等级</span><span class="value grade-tag">{{ fillData.grade }}</span></div>
          </div>
        </div>
        <div class="preview-group">
          <div class="group-title">F1 基本素质<span class="group-weight">权重10%</span><span class="group-score">合计{{ fillData.F1_total }}分 加权{{ fillData.F1_weighted }}</span></div>
          <div class="dim-list">
            <div v-for="a in F1Items" :key="a.key" class="dim-row">
              <span class="dim-name">{{ a.label }}</span><span class="score-display">{{ a.score }}</span><span class="score-unit">/{{ a.base }}</span><span class="desc-display">{{ a.detail || '暂无说明' }}</span>
            </div>
          </div>
        </div>
        <div class="preview-group">
          <div class="group-title">F2 课程学习成绩<span class="group-weight">权重65%</span><span class="group-score">加权{{ fillData.F2_weighted_avg }} 得分{{ fillData.F2_weighted }}</span></div>
          <div class="course-table">
            <div class="course-header"><span>课程名称</span><span>学分</span><span>成绩</span><span></span></div>
            <div v-for="(c, i) in fillData.F2_courses" :key="i" class="course-row readonly">
              <span class="course-name-display">{{ c.name || '未命名' }}</span>
              <span class="course-credit-display">{{ c.credit }}学分</span>
              <span class="course-score-display">{{ c.score }}分</span>
              <span></span>
            </div>
            
          </div>
        </div>
        <div class="preview-group">
          <div class="group-title">F3 创新实践<span class="group-weight">权重25%</span><span class="group-score">合计{{ fillData.F3_total }}分 加权{{ fillData.F3_weighted }}</span></div>
          <div class="dim-list">
            <div v-for="b in F3Items" :key="b.key" class="dim-row">
              <span class="dim-name">{{ b.label }}</span><span class="score-display">{{ fillData[b.scoreKey] || 0 }}</span><span class="score-unit">分</span><span class="desc-display">{{ fillData[b.detailKey] || '暂无依据' }}</span>
            </div>
          </div>
        </div>
        <div class="total-bar">总分：<strong>{{ fillData.total_score }}</strong><span class="formula">F1x10%+F2x65%+F3x25%</span><span class="grade-badge">等级：{{ fillData.grade }}</span></div>
      </div>
    </div>
        <div v-if="props.uploadedTemplate" class="action-bar">
      <button class="btn primary large" :disabled="isFilling" @click="handleDoFill"><span v-if="isFilling" class="spinner"></span>一键填充</button>
      <button v-if="!fillDone" class="btn success large" :disabled="isFilling" @click="submitToReview">提交审核</button>
      <button v-if="fillDone" class="btn success large" @click="handleDownload">下载已填写文件</button>
      <button v-if="fillDone" class="btn outline" @click="resetFill">重新填表</button>
    </div>
    <details class="placeholder-guide">
      <summary>占位符使用说明</summary>
      <div class="guide-content">
        <p class="guide-hint">在Word模板中插入以下占位符，系统将自动替换为相应的综测数据。</p>
        <div v-for="group in placeholderGroups" :key="group.name" class="ph-group">
          <div class="ph-group-title">{{ group.name }}</div>
          <div class="ph-grid">
            <code v-for="ph in group.items" :key="ph.key">{{ '{' + ph.key + '}' }}<span> - {{ ph.desc }}</span></code>
          </div>
        </div>
        <p class="guide-note">提示：占位符需用花括号包裹，如 {real_name}，系统将自动查找并替换模板中的占位符。</p>
      </div>
    </details>

    <div class="back-to-top-row">
      <button type="button" class="back-to-top-btn" @click="scrollToTop">
        <span aria-hidden="true">↑</span>
        回到页面顶部
      </button>
    </div>
  </div>
</template>
<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import * as api from '@/api/zongce'
import { updateSmartResult } from '@/api/module1'
import { useSmartFillStore } from '@/stores/smartFill'


const props = defineProps({ uploadedTemplate: Object, ruleSetId: Number, scoreList: Object, materials: Array, batchId: [Number, String], scorePolicy: Object })
const smartFillStore = useSmartFillStore()

const emit = defineEmits(['update:uploadedTemplate','upload-template','upload','fill','download','score-changed','remove-template','submit'])
const fileInput = ref(null)
const isDragging = ref(false)
const formatError = ref(false)
const isFilling = ref(false)
const fillDone = ref(false)
const fillError = ref('')
const showPreview = ref(true)
const isSubmitting = ref(false)

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const fillData = ref({
  real_name: '', student_id: '', academic_year: '', grade: '', total_score: 0,
  F1_total: 0, F1_weighted: 0,
  F1_A1_score: 0, F1_A1_base: 20, F1_A1_detail: '',
  F1_A2_score: 0, F1_A2_base: 20, F1_A2_detail: '',
  F1_A3_score: 0, F1_A3_base: 20, F1_A3_detail: '',
  F1_A4_score: 0, F1_A4_base: 20, F1_A4_detail: '',
  F1_A5_score: 0, F1_A5_base: 20, F1_A5_detail: '',
  F2_weighted_avg: 0, F2_weighted: 0,
  F2_courses: [],
  F3_total: 0, F3_weighted: 0,
  F3_B1_score: 0, F3_B1_detail: '',
  F3_B2_score: 0, F3_B2_detail: '',
  F3_B3_score: 0, F3_B3_detail: '',
  F3_B4_score: 0, F3_B4_detail: '',
  F3_B5_score: 0, F3_B5_detail: '',
  F3_B6_score: 0, F3_B6_detail: '',
  F3_B7_score: 0, F3_B7_detail: '',
  F3_B8_score: 0, F3_B8_detail: '',
})

// ★ 从 scoreList 同步 F3 数据到 fillData（单一数据源，避免被 loadFillData 覆盖）
function syncF3FromScoreList() {
  const newVal = props.scoreList
  if (!newVal || !newVal.indicators) return
  const indicators = newVal.indicators.filter(ind => /^B\d+$/.test(ind.code))
  let f3Total = 0
  for (const ind of indicators) {
    const scoreKey = 'F3_' + ind.code + '_score'
    const detailKey = 'F3_' + ind.code + '_detail'
    const itemLimit = Number(props.scorePolicy?.scoreLimits?.[ind.code] ?? 30)
    fillData.value[scoreKey] = Math.min(Math.max(Number(ind.score || 0), 0), itemLimit)
    const autoDesc = (ind.facts || []).map(f => {
      const name = f.award_name || f.competition_name || '加分项'
      return name + '(+' + (f.score || 0) + '分)'
    }).filter(Boolean).join('；')
    fillData.value[detailKey] = autoDesc || fillData.value[detailKey]
    f3Total += fillData.value[scoreKey]
  }
  fillData.value.F3_total = Math.min(f3Total, Number(props.scorePolicy?.scoreLimits?.F3 ?? 100))
  fillData.value.F3_weighted = parseFloat((fillData.value.F3_total * 0.25).toFixed(2))
  updateTotalScore()
}

async function loadFillData() {
  try {
    const r = await api.getFillPreview(props.batchId)
    if (r.code === 200 && r.data) {
      for (const k in r.data) {
        if (!(k in fillData.value)) continue
        fillData.value[k] = r.data[k]
      }
      updateTotalScore()
      restoreStoreFromServer()
    }
  } catch (e) { console.error('[SmartFillForm] loadFillData 失败:', e.message || e) }
  syncF1F2Data()
  // ★ 关键修复: loadFillData 是异步的，可能在 scoreList watcher 之后完成，
  // 会覆盖 watcher 刚同步的 F3 数据。这里用 scoreList 重新覆盖，确保 F3 以评分清单为准。
  syncF3FromScoreList()
}
loadFillData()


const F1Items=computed(()=>[
  {key:'A1',scoreKey:'F1_A1_score',detailKey:'F1_A1_detail',label:'A1 思想政治',score:fillData.value.F1_A1_score,base:fillData.value.F1_A1_base,detail:fillData.value.F1_A1_detail},
  {key:'A2',scoreKey:'F1_A2_score',detailKey:'F1_A2_detail',label:'A2 道德品质',score:fillData.value.F1_A2_score,base:fillData.value.F1_A2_base,detail:fillData.value.F1_A2_detail},
  {key:'A3',scoreKey:'F1_A3_score',detailKey:'F1_A3_detail',label:'A3 学习态度',score:fillData.value.F1_A3_score,base:fillData.value.F1_A3_base,detail:fillData.value.F1_A3_detail},
  {key:'A4',scoreKey:'F1_A4_score',detailKey:'F1_A4_detail',label:'A4 组织纪律',score:fillData.value.F1_A4_score,base:fillData.value.F1_A4_base,detail:fillData.value.F1_A4_detail},
  {key:'A5',scoreKey:'F1_A5_score',detailKey:'F1_A5_detail',label:'A5 身心健康',score:fillData.value.F1_A5_score,base:fillData.value.F1_A5_base,detail:fillData.value.F1_A5_detail},
])

const F3Items=computed(()=>[
  {key:'B1',scoreKey:'F3_B1_score',detailKey:'F3_B1_detail',label:'B1 职业技能',score:fillData.value.F3_B1_score,detail:fillData.value.F3_B1_detail},
  {key:'B2',scoreKey:'F3_B2_score',detailKey:'F3_B2_detail',label:'B2 学科竞赛',score:fillData.value.F3_B2_score,detail:fillData.value.F3_B2_detail},
  {key:'B3',scoreKey:'F3_B3_score',detailKey:'F3_B3_detail',label:'B3 科研学术',score:fillData.value.F3_B3_score,detail:fillData.value.F3_B3_detail},
  {key:'B4',scoreKey:'F3_B4_score',detailKey:'F3_B4_detail',label:'B4 宣传报道',score:fillData.value.F3_B4_score,detail:fillData.value.F3_B4_detail},
  {key:'B5',scoreKey:'F3_B5_score',detailKey:'F3_B5_detail',label:'B5 社会工作',score:fillData.value.F3_B5_score,detail:fillData.value.F3_B5_detail},
  {key:'B6',scoreKey:'F3_B6_score',detailKey:'F3_B6_detail',label:'B6 社会实践',score:fillData.value.F3_B6_score,detail:fillData.value.F3_B6_detail},
  {key:'B7',scoreKey:'F3_B7_score',detailKey:'F3_B7_detail',label:'B7 文体竞赛',score:fillData.value.F3_B7_score,detail:fillData.value.F3_B7_detail},
  {key:'B8',scoreKey:'F3_B8_score',detailKey:'F3_B8_detail',label:"B8 劳动教育",score:fillData.value.F3_B8_score,detail:fillData.value.F3_B8_detail},
])

const allPlaceholders = [
  {key:'real_name',desc:'姓名'},{key:'student_id',desc:'学号'},
  {key:'academic_year',desc:'学年'},{key:'total_score',desc:'总分'},{key:'grade',desc:'等级'},
  {key:'F1_A1_score',desc:'A1得分'},{key:'F1_A1_detail',desc:'A1说明'},
  {key:'F1_A2_score',desc:'A2得分'},{key:'F1_A2_detail',desc:'A2说明'},
  {key:'F1_A3_score',desc:'A3得分'},{key:'F1_A3_detail',desc:'A3说明'},
  {key:'F1_A4_score',desc:'A4得分'},{key:'F1_A4_detail',desc:'A4说明'},
  {key:'F1_A5_score',desc:'A5得分'},{key:'F1_A5_detail',desc:'A5说明'},
  {key:'F1_total',desc:'F1合计'},{key:'F1_weighted',desc:'F1加权'},
  {key:'F2_weighted_avg',desc:'加权平均类'},{key:'F2_weighted',desc:'F2加权'},
  {key:'F3_B1_score',desc:'B1得分'},{key:'F3_B1_detail',desc:'B1明细'},
  {key:'F3_B2_score',desc:'B2得分'},{key:'F3_B2_detail',desc:'B2明细'},
  {key:'F3_B3_score',desc:'B3得分'},{key:'F3_B3_detail',desc:'B3明细'},
  {key:'F3_B4_score',desc:'B4得分'},{key:'F3_B4_detail',desc:'B4明细'},
  {key:'F3_B5_score',desc:'B5得分'},{key:'F3_B5_detail',desc:'B5明细'},
  {key:'F3_B6_score',desc:'B6得分'},{key:'F3_B6_detail',desc:'B6明细'},
  {key:'F3_B7_score',desc:'B7得分'},{key:'F3_B7_detail',desc:'B7明细'},
  {key:'F3_B8_score',desc:'B8得分'},{key:'F3_B8_detail',desc:'B8明细'},
  {key:'F3_total',desc:'F3合计'},{key:'F3_weighted',desc:'F3加权'},
]

const placeholderGroups = [
  {name:'基本信息',items:allPlaceholders.filter(p=>['real_name','student_id','academic_year','total_score','grade'].includes(p.key))},
  {name:'F1 基本素质',items:allPlaceholders.filter(p=>p.key.startsWith('F1_'))},
  {name:'F2 课程学习',items:allPlaceholders.filter(p=>p.key.startsWith('F2_'))},
  {name:'F3 创新实践',items:allPlaceholders.filter(p=>p.key.startsWith('F3_'))},
]


// ★ 监听评分清单变化，同步 F3 数据到预览面板（只读展示）
watch(() => props.scoreList, () => {
  syncF3FromScoreList()
  syncF1F2Data()
}, { deep: true, immediate: true });

watch(() => props.scorePolicy, () => {
  syncF1F2Data()
  syncF3FromScoreList()
}, { deep: true });

// ★ 从服务端数据恢复到 Pinia Store（仅恢复 Store 中仍为默认值的项）
// 解决刷新后 Store 为空、syncF1F2Data() 用空数据覆盖服务端数据的问题
function restoreStoreFromServer() {
  // 恢复 F1：仅当 Store 仍为默认值(20分,空说明)时才覆盖
  for (const a of smartFillStore.f1Items) {
    const serverScore = fillData.value['F1_' + a.key + '_score']
    const serverDetail = fillData.value['F1_' + a.key + '_detail']
    // Store 值仍是默认时，从服务端恢复
    if (a.score === a.base && !a.detail && serverScore !== undefined && serverScore !== null) {
      a.score = serverScore
      a.detail = serverDetail || ''
    }
  }
  // 恢复 F2 课程：仅当 Store 中无有效课程（无课程名）时才恢复
  const hasValidCourses = smartFillStore.f2Courses.some(c => c.name)
  if (!hasValidCourses) {
    const courses = fillData.value.F2_courses
    if (courses && courses.length > 0 && courses.some(c => c.name)) {
      smartFillStore.f2Courses = JSON.parse(JSON.stringify(courses))
    }
  }
}

// ★ 从共享 Store 同步 F1/F2 数据
function syncF1F2Data() {
  const items = smartFillStore.f1Items;
  for (const a of items) {
    const max = Number(props.scorePolicy?.scoreLimits?.[a.key] ?? 20)
    a.base = max
    a.score = Math.min(Math.max(Number(a.score || 0), 0), max)
    fillData.value['F1_' + a.key + '_score'] = a.score;
    fillData.value['F1_' + a.key + '_detail'] = a.detail;
    fillData.value['F1_' + a.key + '_base'] = a.base;
  }
  let f1t = 0;
  ['A1','A2','A3','A4','A5'].forEach(k => f1t += fillData.value['F1_' + k + '_score'] || 0);
  fillData.value.F1_total = Math.min(f1t, Number(props.scorePolicy?.scoreLimits?.F1 ?? 100));
  fillData.value.F1_weighted = parseFloat((fillData.value.F1_total * 0.1).toFixed(2));

  const courses = smartFillStore.f2Courses;
  fillData.value.F2_courses = courses;
  let wsum = 0, tcred = 0;
  const courseLimit = Number(props.scorePolicy?.scoreLimits?.COURSE ?? 100)
  for (const c of courses) {
    c.score = Math.min(Math.max(Number(c.score || 0), 0), courseLimit)
    wsum += (c.score || 0) * (c.credit || 0); tcred += (c.credit || 0);
  }
  const average = tcred > 0 ? parseFloat((wsum / tcred).toFixed(2)) : 0;
  fillData.value.F2_weighted_avg = Math.min(average, Number(props.scorePolicy?.scoreLimits?.F2 ?? 100));
  fillData.value.F2_weighted = parseFloat((fillData.value.F2_weighted_avg * 0.65).toFixed(2));

  updateTotalScore();
}

function updateTotalScore() {
  const total = (fillData.value.F1_weighted || 0) + (fillData.value.F2_weighted || 0) + (fillData.value.F3_weighted || 0);
  fillData.value.total_score = Math.min(parseFloat(total.toFixed(2)), Number(props.scorePolicy?.scoreLimits?.total ?? 100));
  const rules = Array.isArray(props.scorePolicy?.gradeRules) ? [...props.scorePolicy.gradeRules] : [
    { grade: '优', min: 80 }, { grade: '良', min: 70 }, { grade: '合格', min: 60 }, { grade: '不合格', min: 0 },
  ]
  fillData.value.grade = rules.sort((a, b) => Number(b.min) - Number(a.min)).find(rule => fillData.value.total_score >= Number(rule.min))?.grade || '不合格';
}


onMounted(() => { syncF1F2Data(); });
function triggerUpload(){fileInput.value?.click()}
function onDragOver(){isDragging.value=true;formatError.value=false}
function onDragLeave(){isDragging.value=false}
function onDrop(e){isDragging.value=false;const f=e.dataTransfer.files[0];if(f)validateAndUpload(f)}
function onFileSelect(e){const f=e.target.files[0];if(f)validateAndUpload(f);e.target.value=''}
function validateAndUpload(file){
  const ext=file.name.split('.').pop().toLowerCase();
  if(ext!=='docx'){formatError.value=true;setTimeout(()=>formatError.value=false,3000);return}
  emit("update:uploadedTemplate",{name:file.name,size:file.size,file});emit("upload-template",file);emit("upload",file);
  fillDone.value=false;fillError.value='';
}
function removeTemplate(){emit("update:uploadedTemplate",null);emit("remove-template");fillDone.value=false;fillError.value=''}

let currentFillId=null
async function handleDoFill(){
  if(!props.uploadedTemplate){fillError.value='请先上传模板';return}
  isFilling.value=true;fillError.value='';
  try{
    let templateId = props.uploadedTemplate.id;
    // ★ 新上传的模板（有 file 对象）需先上传；服务器恢复的模板（有 id）直接用
    if (!templateId && props.uploadedTemplate.file) {
      const fd=new FormData();fd.append('file',props.uploadedTemplate.file);
      const upRes=await api.uploadTemplate(fd);
      if(upRes.code!==200){fillError.value=upRes.msg;return}
      templateId = upRes.data.id;
    }
    if (!templateId) {fillError.value='模板无效，请重新上传';return}
    const fillRes=await api.doFill(templateId, props.batchId);
    if(fillRes.code!==200){fillError.value=fillRes.msg;return}
    currentFillId=fillRes.data.fillId;fillDone.value=true
  }catch(e){fillError.value='失败:'+(e.response?.data?.msg||e.message)}
  finally{isFilling.value=false}
}
function handleDownload(){if(currentFillId)emit('download',currentFillId)}
function resetFill(){fillDone.value=false;fillError.value='';currentFillId=null}
function formatSize(b){if(!b)return'';return b<1048576?(b/1024).toFixed(1)+' KB':(b/1048576).toFixed(2)+' MB'}

// ★ 提交审核：同时写入 4 张表
// ① smart_fill_data (表单历史快照)
// ② assessment_form_items + assessment_forms (信息管理端)
// ③ evaluation_results (个性化分析端)
async function submitToReview() {
  if (isSubmitting.value) return
  isSubmitting.value = true
  try {
    const d = fillData.value
    const items = []
    const fillItems = []
    const titles = {
      A1:"思想政治表现",A2:"道德品质修养",A3:"学习态度作风",A4:"组织纪律观念",A5:"身心健康素质",
      B1:"职业技能类",B2:"学科竞赛类",B3:"科研学术活动类",B4:"文学艺术创作与宣传报道类",
      B5:"社会工作类",B6:"社会实践类",B7:"文体艺术活动类",B8:"劳育类"
    }

    // ★ 检查数据结构
    console.log('[submitToReview] F1Items keys:', (smartFillStore.f1Items||[]).map?.(a=>a.key)?.join(',') || 'NOT_ARRAY')
    console.log('[submitToReview] d.F2_courses type:', typeof d.F2_courses, 'isArray:', Array.isArray(d.F2_courses))

    // F1
    const f1Keys = ['A1','A2','A3','A4','A5']
    if (!Array.isArray(f1Keys) || typeof f1Keys.forEach !== 'function') {
      throw new Error('f1Keys is not iterable: ' + typeof f1Keys)
    }
    f1Keys.forEach(k => {
      const s = d['F1_'+k+'_score'] || 0
      const desc = d['F1_'+k+'_detail'] || ''
      items.push({section:"F1",subKey:k,title:titles[k]||k,reason:desc,score:s})
      fillItems.push({section:"F1",item_key:k,score:20-s,description:desc,rule_set_id:props.ruleSetId||0})
    })

    // F3
    const f3Keys = ['B1','B2','B3','B4','B5','B6','B7','B8']
    f3Keys.forEach(k => {
      const s = d['F3_'+k+'_score'] || 0
      const desc = d['F3_'+k+'_detail'] || ''
      items.push({section:"F3",subKey:k,title:titles[k]||k,reason:desc,score:s})
      fillItems.push({section:"F3",item_key:k,score:s,description:desc,rule_set_id:props.ruleSetId||0})
    })

    // F2
    const f2Courses = Array.isArray(d.F2_courses) ? d.F2_courses : []
    items.push({section:"F2",subKey:"COURSE",title:"课程成绩",
      reason:(f2Courses.map(c=>c.name+"("+c.credit+"学分)").join("；")),
      score:d.F2_weighted_avg||0})
    if (f2Courses.length > 0) {
      fillItems.push({section:"F2",item_key:"COURSE",score:0,description:'',
        extra_data:f2Courses,rule_set_id:props.ruleSetId||0})
    }

    // ① 写入 smart_fill_data（表单历史快照）
    console.log('[submitToReview] saving fillData, items:', fillItems.length)
    try { await api.saveFillData(fillItems, props.batchId) } catch(e) { console.warn('saveFillData:', e.message) }

    // ② 写入 evaluation_results（个性化分析端）
    // ★ 按照 module2 extractScoreData 期望的格式构建 dimension_scores
    try {
      const aScores = {};  // F1 子项: A1~A5
      ['A1','A2','A3','A4','A5'].forEach(k => {
        aScores[k] = d['F1_'+k+'_score'] || 0;
      });
      const bScores = {};  // F3 子项: B1~B8
      ['B1','B2','B3','B4','B5','B6','B7','B8'].forEach(k => {
        bScores[k] = d['F3_'+k+'_score'] || 0;
      });
      const scores = {
        F1: d.F1_total || 0,
        F2: d.F2_weighted_avg || 0,
        F3: d.F3_total || 0,
      };

      await api.saveEvaluationResult({
        total_score: d.total_score,
        grade: d.grade,
        formula: 'F=F1*0.1+F2*0.65+F3*0.25',
        batch_id: props.batchId || null,
        dimension_scores: {
          aScores,
          bScores,
          scores,
          classAvg: {},
          rank: null,
          totalStudents: null,
          majorRank: null,
          majorTotal: null,
        }
      })
    } catch(e) { console.warn('saveEvaluationResult:', e.message) }

    // ③ 写入 assessment_forms + assessment_form_items（信息管理端）
    const payload = { items, batch_id: props.batchId || null, rule_set_id: props.ruleSetId || null }
    console.log('[submitToReview] updateSmartResult payload:', JSON.stringify(payload).slice(0,200))
    const res = await updateSmartResult(payload)
    if (res.code === 200) {
      emit('submit')
      alert("已提交到审核流程，可在信息管理页查看")
    } else {
      alert(res.msg)
    }
  } catch(e) {
    console.error('[submitToReview] 错误:', e.message || e, e.stack?.split('\n').slice(0,3).join('\n'))
    alert("提交失败："+(e.message||e))
  } finally {
    isSubmitting.value = false
  }
}
</script>

<style scoped>
.form-page{display:flex;flex-direction:column;gap:20px}
.upload-section h4{font-size:16px;margin:0 0 6px}
.hint{font-size:13px;color: var(--color-text-tertiary);margin:0 0 12px}
.upload-zone{border:2px dashed var(--color-border);border-radius:8px;padding:32px;text-align:center;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:8px;transition:all .2s}
.upload-zone:hover,.upload-zone.drag-over{border-color:var(--color-primary);color:var(--color-primary)}
.upload-zone.format-error{border-color:#D93025;color:#D93025}
.upload-icon{font-size:36px}.upload-sub{font-size:12px;color: var(--color-text-tertiary)}
.template-card{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border:1px solid var(--color-border);border-radius:6px;background: var(--color-surface-variant)}
.tpl-info{display:flex;align-items:center;gap:12px}.tpl-icon{font-size:28px}
.tpl-name{font-size:14px;font-weight:600}.tpl-meta{font-size:12px;color: var(--color-text-tertiary);margin-top:2px}
.error-msg{color:#D93025;font-size:13px;margin-top:8px}
.data-preview{border:1px solid var(--color-border);border-radius:8px;overflow:hidden}
.preview-header{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;background: var(--color-surface-variant);cursor:pointer;user-select:none;font-size:14px;font-weight:600}
.preview-header:hover{background: var(--color-surface-variant)}.toggle-arrow{font-size:12px;color:var(--color-primary);font-weight:400}
.preview-body{padding:16px;display:flex;flex-direction:column;gap:16px}
.group-title{font-size:14px;font-weight:600;margin-bottom:8px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.group-weight{font-size:12px;color:var(--color-primary);background: var(--color-primary-light);padding:1px 8px;border-radius:4px}
.group-score{font-size:13px;color:#34A853;margin-left:auto}
.group-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.info-item{display:flex;flex-direction:column;gap:2px;padding:8px;background: var(--color-surface-variant);border-radius:4px}
.info-item .label{font-size:11px;color: var(--color-text-tertiary)}.info-item .value{font-size:14px;font-weight:600}.grade-tag{color:#34A853}
.dim-list{display:flex;flex-direction:column;gap:4px}
.dim-row{display:flex;align-items:center;gap:10px;padding:6px 10px;font-size:13px;border-bottom: 1px solid var(--color-border)}
.dim-row:last-child{border-bottom:none}.dim-name{font-weight:500;min-width:130px}
.dim-score{font-weight:700;color:var(--color-primary);min-width:50px;text-align:right}.dim-score.zero{color: var(--color-text-tertiary)}
.dim-detail{color: var(--color-text-secondary);flex:1;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.course-table{font-size:13px}.course-header{display:flex;font-weight:600;color: var(--color-text-secondary);border-bottom:2px solid var(--color-border);padding:6px 0}
.course-header span:first-child{flex:1}.course-header span{width:60px;text-align:center}
.course-row{display:flex;padding:4px 0;border-bottom: 1px solid var(--color-border)}
.course-row:last-child{border-bottom:none}.course-name{flex:1}
.course-credit{width:60px;text-align:center;color: var(--color-text-secondary)}.course-score{width:60px;text-align:center;font-weight:600}
.total-bar{text-align:center;padding:14px;font-size:15px;background: linear-gradient(135deg, var(--color-primary-light), var(--color-primary-light));border-radius:6px;display:flex;align-items:center;justify-content:center;gap:16px;flex-wrap:wrap}
.total-bar strong{font-size:24px;color:var(--color-primary)}.formula{font-size:12px;color: var(--color-text-tertiary)}
.grade-badge{font-size:13px;background:#34A853;color:#fff;padding:2px 12px;border-radius:4px}
.action-bar{display:flex;gap:12px;flex-wrap:wrap}
.error-card{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background: var(--color-error-bg);border:1px solid #fecaca;border-radius:8px;color:#D93025;font-size:14px}
.placeholder-guide{margin-top:4px;border:1px solid var(--color-border);border-radius:8px;padding:12px 16px}
.placeholder-guide summary{cursor:pointer;font-size:14px;color:var(--color-primary);font-weight:500}
.back-to-top-row{display:flex;justify-content:center;padding-top:4px}
.back-to-top-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-width:180px;min-height:44px;padding:0 20px;border:1px solid color-mix(in srgb,var(--color-primary) 36%,var(--color-border));border-radius:8px;background:color-mix(in srgb,var(--color-primary) 9%,var(--color-surface));color:var(--color-primary);font-size:14px;font-weight:700;cursor:pointer;transition:transform .2s ease,border-color .2s ease,background .2s ease}
.back-to-top-btn:hover{transform:translateY(-2px);border-color:var(--color-primary);background:color-mix(in srgb,var(--color-primary) 14%,var(--color-surface))}
.back-to-top-btn span{font-size:20px;font-weight:900;line-height:1}
.guide-content{margin-top:12px}.guide-hint{font-size:13px;color: var(--color-text-secondary);margin-bottom:14px}
.ph-group{margin-bottom:14px}.ph-group-title{font-size:13px;font-weight:600;margin-bottom:6px;color: var(--color-text)}
.ph-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;padding:8px 12px;background: var(--color-surface-variant);border-radius:4px}
.ph-grid code{font-size:12px;color:var(--color-primary)}.ph-grid code span{color: var(--color-text-tertiary)}
.guide-note{font-size:13px;color: var(--color-text-secondary);padding:10px;background: var(--color-warning-bg);border-radius:4px;line-height:1.5}
.btn{padding:10px 28px;border:none;border-radius:6px;cursor:pointer;font-size:15px;font-family:inherit;display:inline-flex;align-items:center;gap:8px}
.btn:disabled{opacity:.6;cursor:not-allowed}.btn.primary{background:var(--color-primary);color:#fff}
.btn.success{background:#34A853;color:#fff}.btn.outline{background: var(--color-surface);color:var(--color-primary);border:1px solid var(--color-primary)}
.btn.large{padding:12px 36px;font-size:16px}
.btn-text{padding:6px 14px;border:1px solid var(--color-border);border-radius:6px;background: var(--color-surface);cursor:pointer;font-size:13px;font-family:inherit}
.btn-text.danger{color:#D93025;border-color:transparent}
.spinner{width:18px;height:18px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
@media(max-width:768px){.group-grid{grid-template-columns:1fr 1fr}.ph-grid{grid-template-columns:1fr}.dim-row{flex-wrap:wrap}.dim-name{min-width:auto;flex:1}}
.score-inp{width:48px;text-align:center;border:1px solid #d0d0d0;border-radius:4px;font-size:13px;padding:2px 4px;color:#1a73e8;font-weight:600}.score-unit{font-size:12px;color:#999;margin-right:8px}.desc-inp{flex:1;border:1px solid #e0e0e0;border-radius:4px;padding:4px 8px;font-size:12px;resize:none;font-family:inherit;min-width:150px}.desc-inp:focus,.score-inp:focus{outline:none;border-color:#1a73e8;box-shadow:0 0 0 2px rgba(26,115,232,.1)}.btn-ai-mini{background:#f0f4ff;border:1px solid #b8d4f0;border-radius:4px;cursor:pointer;font-size:14px;padding:4px 8px;transition:all .2s}.btn-ai-mini:hover{background:#d6e4ff}.btn-add-course{display:block;margin-top:8px;padding:6px 16px;font-size:13px;border:1px dashed #ccc;border-radius:6px;background:#fafafa;cursor:pointer;color:#1a73e8}.btn-add-course:hover{background:#f0f7ff;border-color:#1a73e8}.btn-del-row{background:none;border:none;color:#d93025;font-size:18px;cursor:pointer;padding:0 4px}.course-inp{border:1px solid #e0e0e0;border-radius:4px;padding:3px 8px;font-size:13px}.course-inp.name{min-width:120px}.course-inp.credit{width:50px;text-align:center}.course-inp.score{width:60px;text-align:center}

.score-display{font-size:14px;font-weight:700;color:#1a73e8;min-width:40px;text-align:center}.desc-display{flex:1;font-size:13px;color:#555;padding:4px 8px;background:#f8f9fa;border-radius:4px;min-width:150px}.dim-row.readonly{padding:8px 0;border-bottom:1px solid #f0f0f0}.course-row.readonly{display:grid;grid-template-columns:2fr 80px 80px 36px;gap:8px;padding:8px 12px;align-items:center;border-top:1px solid #f0f0f0}.course-name-display{font-size:13px;font-weight:600;color:#333}.course-credit-display{font-size:13px;color:#666;text-align:center}.course-score-display{font-size:13px;font-weight:600;color:#1a73e8;text-align:center}
</style>
