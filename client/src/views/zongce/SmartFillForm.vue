<template>
  <div class="form-page">
    <!-- ===== 上传模板区 ===== -->
    <div class="upload-section">
      <h4>上传 Word 模板</h4>
      <p class="hint">上传您的综测登记表模板（.docx），在模板中按需插入占位符，系统一键自动填充</p>

      <div v-if="!uploadedTemplate" class="upload-zone"
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

      <div v-if="uploadedTemplate" class="template-card">
        <div class="tpl-info">
          <span class="tpl-icon">📄</span>
          <div>
            <div class="tpl-name">{{ uploadedTemplate.name }}</div>
            <div class="tpl-meta">{{ formatSize(uploadedTemplate.size) }} · 上传成功</div>
          </div>
        </div>
        <button class="btn-text danger" @click="removeTemplate">✕ 删除</button>
      </div>

      <p v-if="formatError" class="error-msg">仅支持 .docx 格式，请重新上传</p>
    </div>


    <!-- ===== 数据预览区 ===== -->
    <div v-if="uploadedTemplate" class="data-preview">
      <div class="preview-header" @click="showPreview = !showPreview">
        <span>数据预览 - 以下数据将填入模板</span>
        <span class="toggle-arrow">{{ showPreview ? '收起' : '展开' }}</span>
      </div>
      <div v-show="showPreview" class="preview-body">
        <div class="preview-group">
          <div class="group-title">基本信息</div>
          <div class="group-grid">
            <div class="info-item"><span class="label">姓名</span><span class="value">{{ mockData.real_name }}</span></div>
            <div class="info-item"><span class="label">学号</span><span class="value">{{ mockData.student_id }}</span></div>
            <div class="info-item"><span class="label">学年</span><span class="value">{{ mockData.academic_year }}</span></div>
            <div class="info-item"><span class="label">等级</span><span class="value grade-tag">{{ mockData.grade }}</span></div>
          </div>
        </div>
        <div class="preview-group">
          <div class="group-title">F1 基本素质<span class="group-weight">权重10%</span><span class="group-score">合计{{ mockData.F1_total }}分 加权{{ mockData.F1_weighted }}</span></div>
          <div class="dim-list">
            <div v-for="a in F1Items" :key="a.key" class="dim-row">
              <span class="dim-name">{{ a.label }}</span><span class="dim-score">{{ a.score }}/{{ a.base }}</span><span class="dim-detail">{{ a.detail }}</span>
            </div>
          </div>
        </div>
        <div class="preview-group">
          <div class="group-title">F2 课程学习成绩<span class="group-weight">权重65%</span><span class="group-score">加权{{ mockData.F2_weighted_avg }} 得分{{ mockData.F2_weighted }}</span></div>
          <div class="course-table">
            <div class="course-header"><span>课程名称</span><span>学分</span><span>成绩</span></div>
            <div v-for="c in mockData.F2_courses" :key="c.name" class="course-row">
              <span class="course-name">{{ c.name }}</span><span class="course-credit">{{ c.credit }}</span><span class="course-score">{{ c.score }}</span>
            </div>
          </div>
        </div>
        <div class="preview-group">
          <div class="group-title">F3 创新实践<span class="group-weight">权重25%</span><span class="group-score">合计{{ mockData.F3_total }}分 加权{{ mockData.F3_weighted }}</span></div>
          <div class="dim-list">
            <div v-for="b in F3Items" :key="b.key" class="dim-row f3-row">
              <span class="dim-name">{{ b.label }}</span><span class="dim-score" :class="{ zero: b.score === 0 }">{{ b.score }}</span><span class="dim-detail">{{ b.detail }}</span>
            </div>
          </div>
        </div>
        <div class="total-bar">总分：<strong>{{ mockData.total_score }}</strong><span class="formula">F1x10%+F2x65%+F3x25%</span><span class="grade-badge">等级：{{ mockData.grade }}</span></div>
      </div>
    </div>
    <div v-if="uploadedTemplate" class="action-bar">
      <button class="btn primary large" :disabled="isFilling" @click="handleDoFill">
        <span v-if="isFilling" class="spinner"></span>{{ isFilling ? '正在填写...' : '一键填表' }}
      </button>
      <button v-if="fillDone" class="btn success large" @click="handleDownload">下载已填写文件</button>
      <button v-if="fillDone" class="btn outline" @click="resetFill">重新填表</button>
    </div>
    <div v-if="fillError" class="error-card"><span>{{ fillError }}</span><button class="btn-text" @click="resetFill">重试</button></div>
    <details class="placeholder-guide">
      <summary>占位符使用指南（共{{ allPlaceholders.length }}个）</summary>
      <div class="guide-content">
        <p class="guide-hint">在Word模板中插入占位符，系统自动替换。</p>
        <div v-for="group in placeholderGroups" :key="group.name" class="ph-group">
          <div class="ph-group-title">{{ group.name }}（{{ group.items.length }}个）</div>
          <div class="ph-grid">
            <code v-for="ph in group.items" :key="ph.key">{{ '{' + ph.key + '}' }}<span> - {{ ph.desc }}</span></code>
          </div>
        </div>
      </div>
    </details>
  </div>
</template>
<script setup>
import { ref, computed } from 'vue'
import * as api from '@/api/zongce'

const emit = defineEmits(['upload-template','fill','download'])
const fileInput = ref(null)
const isDragging = ref(false)
const formatError = ref(false)
const uploadedTemplate = ref(null)
const isFilling = ref(false)
const fillDone = ref(false)
const fillError = ref('')
const showPreview = ref(true)

const mockData = ref({
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

async function loadMockData(){try{const r=await api.getMockData();if(r.code===200&&r.data)mockData.value=r.data}catch(e){}}
loadMockData()

const F1Items=computed(()=>[
  {key:'A1',label:'A1 思想政治',score:mockData.value.F1_A1_score,base:mockData.value.F1_A1_base,detail:mockData.value.F1_A1_detail},
  {key:'A2',label:'A2 道德品质',score:mockData.value.F1_A2_score,base:mockData.value.F1_A2_base,detail:mockData.value.F1_A2_detail},
  {key:'A3',label:'A3 学习态度',score:mockData.value.F1_A3_score,base:mockData.value.F1_A3_base,detail:mockData.value.F1_A3_detail},
  {key:'A4',label:'A4 组织纪律',score:mockData.value.F1_A4_score,base:mockData.value.F1_A4_base,detail:mockData.value.F1_A4_detail},
  {key:'A5',label:'A5 身心健康',score:mockData.value.F1_A5_score,base:mockData.value.F1_A5_base,detail:mockData.value.F1_A5_detail},
])

const F3Items=computed(()=>[
  {key:'B1',label:'B1 职业技能',score:mockData.value.F3_B1_score,detail:mockData.value.F3_B1_detail},
  {key:'B2',label:'B2 科技学术',score:mockData.value.F3_B2_score,detail:mockData.value.F3_B2_detail},
  {key:'B3',label:'B3 社会工作',score:mockData.value.F3_B3_score,detail:mockData.value.F3_B3_detail},
  {key:'B4',label:'B4 宣传报道',score:mockData.value.F3_B4_score,detail:mockData.value.F3_B4_detail},
  {key:'B5',label:'B5 文艺创作',score:mockData.value.F3_B5_score,detail:mockData.value.F3_B5_detail},
  {key:'B6',label:'B6 文体竞赛',score:mockData.value.F3_B6_score,detail:mockData.value.F3_B6_detail},
  {key:'B7',label:'B7 其他实践',score:mockData.value.F3_B7_score,detail:mockData.value.F3_B7_detail},
  {key:'B8',label:'B8 劳育类',score:mockData.value.F3_B8_score,detail:mockData.value.F3_B8_detail},
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
  {key:'F2_weighted_avg',desc:'加权平均分'},{key:'F2_weighted',desc:'F2加权'},
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

function triggerUpload(){fileInput.value?.click()}
function onDragOver(){isDragging.value=true;formatError.value=false}
function onDragLeave(){isDragging.value=false}
function onDrop(e){isDragging.value=false;const f=e.dataTransfer.files[0];if(f)validateAndUpload(f)}
function onFileSelect(e){const f=e.target.files[0];if(f)validateAndUpload(f);e.target.value=''}
function validateAndUpload(file){
  const ext=file.name.split('.').pop().toLowerCase();
  if(ext!=='docx'){formatError.value=true;setTimeout(()=>formatError.value=false,3000);return}
  uploadedTemplate.value={name:file.name,size:file.size,file};
  fillDone.value=false;fillError.value='';
}
function removeTemplate(){uploadedTemplate.value=null;fillDone.value=false;fillError.value=''}

let currentFillId=null
async function handleDoFill(){
  if(!uploadedTemplate.value)return;
  isFilling.value=true;fillError.value='';
  try{
    const fd=new FormData();fd.append('file',uploadedTemplate.value.file);
    const upRes=await api.uploadTemplate(fd);
    if(upRes.code!==200){fillError.value=upRes.msg;return}
    const fillRes=await api.doFill(upRes.data.id);
    if(fillRes.code!==200){fillError.value=fillRes.msg;return}
    currentFillId=fillRes.data.fillId;fillDone.value=true
  }catch(e){fillError.value='失败:'+(e.response?.data?.msg||e.message)}
  finally{isFilling.value=false}
}
function handleDownload(){if(currentFillId)emit('download',currentFillId)}
function resetFill(){fillDone.value=false;fillError.value='';currentFillId=null}
function formatSize(b){if(!b)return'';return b<1048576?(b/1024).toFixed(1)+' KB':(b/1048576).toFixed(2)+' MB'}
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
</style>
