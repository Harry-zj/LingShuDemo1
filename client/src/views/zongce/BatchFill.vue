<template>
<div class="batch-page">
<h2 class="page-title">批量填表</h2>
<p class="page-desc">上传 Excel 和 Word 模板，AI 自动映射，一键批量生成</p>
<div class="step-bar">
<div class="step" :class="{active:step>=1,done:step>1}"><span class="step-num">1</span>上传</div>
<div class="step-line" :class="{active:step>1}"></div>
<div class="step" :class="{active:step>=2,done:step>2}"><span class="step-num">2</span>映射</div>
<div class="step-line" :class="{active:step>2}"></div>
<div class="step" :class="{active:step>=3,done:step>3}"><span class="step-num">3</span>下载</div>
</div>
<div v-if="step===1" class="card"><div class="upload-grid">
<div class="upload-box" :class="{done:excelFile}" @click="$refs.excelInput.click()" @dragover.prevent @drop.prevent="onExcelDrop">
<span class="upload-icon">{{excelFile?'📊':'📁'}}</span>
<div v-if="!excelFile"><strong>上传 Excel</strong><p>.xlsx/.xls</p></div>
<div v-else><strong>{{excelFile.name}}</strong><p>{{formatSize(excelFile.size)}}</p></div>
<input ref="excelInput" type="file" hidden accept=".xlsx,.xls" @change="onExcelSelect">
</div>
<div class="upload-box" :class="{done:templateFile}" @click="$refs.tplInput.click()" @dragover.prevent @drop.prevent="onTplDrop">
<span class="upload-icon">{{templateFile?'📄':'📁'}}</span>
<div v-if="!templateFile"><strong>上传 Word 模板</strong><p>.docx</p></div>
<div v-else><strong>{{templateFile.name}}</strong><p>{{formatSize(templateFile.size)}}</p></div>
<input ref="tplInput" type="file" hidden accept=".docx" @change="onTplSelect">
</div></div>
<div v-if="errorMsg" class="error-msg">{{errorMsg}}</div>
<button class="btn primary large" :disabled="!excelFile||!templateFile||uploading" @click="doUpload">
<span v-if="uploading" class="spinner"></span>{{uploading?'解析中...':'开始解析'}}</button>
</div>
<div v-if="step===2" class="card">
<h3>AI 列映射</h3><p class="hint">共 {{taskData.totalRows||0}} 行</p>
<div class="mapping-table">
<div class="map-header"><span>Excel列</span><span></span><span>占位符</span><span>置信度</span></div>
<div v-for="(m,i) in mappings" :key="i" class="map-row">
<span class="excel-col">{{m.excelCol}}</span><span class="arrow">→</span>
<select v-model="m.placeholder" class="ph-select"><option :value="null">不映射</option><option v-for="ph in taskData.placeholders" :key="ph" :value="ph">{{'{'+ph+'}'}}</option></select>
<span class="confidence" :class="m.confidence>=.8?'high':m.confidence>=.5?'mid':'low'">{{(m.confidence*100).toFixed(0)}}%</span>
</div></div>
<div class="btn-row"><button class="btn outline" @click="step=1">返回</button>
<button class="btn primary large" :disabled="executing" @click="doExecute"><span v-if="executing" class="spinner"></span>{{executing?'生成中...':'生成'+taskData.totalRows+'份'}}</button></div>
</div>
<div v-if="step===3" class="card"><div v-if="result">
<div class="result-summary" :class="result.successCount===result.total?'all-ok':'partial'">
<span class="result-icon">{{result.successCount===result.total?'🎉':'⚠️'}}</span>
<div><h3>完成</h3><p>成功{{result.successCount}}/{{result.total}}份</p></div></div>
<div class="btn-row"><button class="btn outline" @click="resetAll">重来</button>
<button v-if="result.downloadReady" class="btn success large" @click="doDownload">下载 ZIP</button></div>
</div></div>
</div>
</template>

<script setup>
import { ref } from 'vue'
import * as api from '../../api/zongce'

const step=ref(1),excelFile=ref(null),templateFile=ref(null)
const uploading=ref(false),executing=ref(false),errorMsg=ref('')
const taskData=ref(null),result=ref(null),mappings=ref([])

function formatSize(b){if(!b)return'';if(b<1024)return b+'B';if(b<1048576)return(b/1024).toFixed(1)+'KB';return(b/1048576).toFixed(1)+'MB'}
function onExcelSelect(e){excelFile.value=e.target.files[0]||null}
function onTplSelect(e){templateFile.value=e.target.files[0]||null}
function onExcelDrop(e){excelFile.value=e.dataTransfer.files[0]||null}
function onTplDrop(e){templateFile.value=e.dataTransfer.files[0]||null}

async function doUpload(){
  if(!excelFile.value||!templateFile.value)return
  uploading.value=true;errorMsg.value=''
  const fd=new FormData();fd.append('excel',excelFile.value);fd.append('template',templateFile.value)
  try{const res=await api.batchUploadFiles(fd)
    if(res.code===200){taskData.value=res.data;mappings.value=res.data.mappings.map(m=>({...m}));step.value=2}
    else errorMsg.value=res.msg}catch(e){errorMsg.value=e.message||'上传失败'}finally{uploading.value=false}
}

async function doExecute(){
  executing.value=true;errorMsg.value=''
  try{const res=await api.batchExecuteFill(taskData.value.taskId,mappings.value)
    if(res.code===200){result.value=res.data;step.value=3}else errorMsg.value=res.msg}
  catch(e){errorMsg.value=e.message||'执行失败'}finally{executing.value=false}
}

async function doDownload(){
  try{
    const blob=await api.batchDownloadResult(taskData.value.taskId)
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url
    a.download='批量填表结果.zip';document.body.appendChild(a);a.click()
    document.body.removeChild(a);URL.revokeObjectURL(url)
  }catch(e){
    const msg=e?.response?._data?.msg||e?.message||'下载失败，请检查后端是否启动'
    alert('下载失败：'+msg)
  }
}

function resetAll(){
  step.value=1;excelFile.value=null;templateFile.value=null
  taskData.value=null;result.value=null;mappings.value=[];errorMsg.value=''
}
</script>

<style scoped>
.batch-page{max-width:900px;margin:0 auto;display:flex;flex-direction:column;gap:20px}
.page-title{font-size:24px;margin:0}.page-desc{font-size:14px;color: var(--color-text-secondary);margin:0}
.step-bar{display:flex;align-items:center;gap:8px;padding:16px;background: var(--color-surface);border-radius:8px;border: 1px solid var(--color-border)}
.step{display:flex;align-items:center;gap:8px;font-size:14px;color: var(--color-text-tertiary)}
.step.active{color: var(--color-text)}.step.done{color:#34A853}
.step-num{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;border: 2px solid var(--color-border);color: var(--color-text-tertiary)}
.step.active .step-num{border-color:#4F46E5;color:#4F46E5;background:#eef2ff}
.step.done .step-num{border-color:#34A853;color:#fff;background:#34A853}
.step-line{flex:1;height:2px;background: var(--color-bg)}.step-line.active{background:#4F46E5}
.card{background: var(--color-surface);border-radius:10px;border: 1px solid var(--color-border);padding:24px;display:flex;flex-direction:column;gap:16px}
.upload-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.upload-box{border: 2px dashed var(--color-border);border-radius:10px;padding:28px;text-align:center;cursor:pointer;transition:.2s;display:flex;flex-direction:column;align-items:center;gap:8px}
.upload-box:hover{border-color:#4F46E5;background: var(--color-surface-variant)}.upload-box.done{border-color:#34A853;background: var(--color-success-bg)}
.upload-icon{font-size:36px}.upload-box strong{font-size:15px;color: var(--color-text)}.upload-box p{font-size:12px;color: var(--color-text-tertiary);margin:0}
.mapping-table{border: 1px solid var(--color-border);border-radius:8px;overflow:hidden}
.map-header,.map-row{display:grid;grid-template-columns:1fr 40px 1fr 80px;gap:8px;padding:10px 16px;align-items:center;font-size:13px}
.map-header{background: var(--color-surface-variant);font-weight:600;color: var(--color-text-secondary)}.map-row{border-top: 1px solid var(--color-border)}
.arrow{text-align:center;color:#4F46E5}
.ph-select{padding:6px 10px;border: 1px solid var(--color-border);border-radius:4px;font-size:13px;background: var(--color-surface)}
.confidence{text-align:center;font-size:12px;padding:2px 8px;border-radius:10px}
.confidence.high{color:#34A853;background:#e8f5e9}.confidence.mid{color:#E37400;background:#fef7e0}.confidence.low{color:#D93025;background:#fce8e6}
.btn-row{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
.btn{padding:10px 24px;border:none;border-radius:6px;cursor:pointer;font-size:15px;display:inline-flex;align-items:center;gap:8px;font-family:inherit}
.btn:disabled{opacity:.6;cursor:not-allowed}.btn.primary{background:#4F46E5;color:#fff}.btn.success{background:#34A853;color:#fff}
.btn.outline{background: var(--color-surface);color:#4F46E5;border:1px solid #4F46E5}.btn.large{padding:12px 32px;font-size:16px}
.error-msg{padding:10px 16px;background: var(--color-error-bg);border:1px solid #fecaca;border-radius:6px;color:#D93025;font-size:13px}
.hint{font-size:13px;color: var(--color-text-tertiary);margin:0}
.result-summary{display:flex;align-items:center;gap:16px;padding:20px;border-radius:8px}
.result-summary.all-ok{background:#e8f5e9}.result-summary.partial{background:#fff3e0}
.result-icon{font-size:40px}.result-summary h3{margin:0;font-size:18px}
.spinner{width:16px;height:16px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
@media(max-width:768px){.upload-grid{grid-template-columns:1fr}}
</style>
