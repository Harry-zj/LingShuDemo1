<template>
<div class="chat-page">
<h2 class="page-title">对话式填表</h2>
<p class="page-desc">与 AI 对话生成叙述文案，自动填入表格</p>
<div v-if="!template" class="card upload-card">
<div class="upload-zone" @click="$refs.fileInput.click()" @dragover.prevent @drop.prevent="onDrop">
<span class="upload-icon">📄</span><strong>上传 Word 模板</strong><p>.docx</p>
<input ref="fileInput" type="file" hidden accept=".docx" @change="onFileSelect">
</div>
<div v-if="errorMsg" class="error-msg">{{errorMsg}}</div>
<button class="btn primary" :disabled="!templateFile||uploading" @click="doUpload">
<span v-if="uploading" class="spinner"></span>{{uploading?'上传中...':'上传并分析'}}</button>
</div>
<div v-if="template" class="main-layout">
<div class="field-sidebar"><h4>模板字段</h4>
<div v-for="f in fields" :key="f.key" class="field-item"
:class="{active:currentField?.key===f.key,done:fieldContents[f.key]}" @click="selectField(f)">
<span class="field-icon">{{f.type==='narrative'?'🤖':'📋'}}</span>
<span class="field-name">{{f.label||f.key}}</span>
<span v-if="fieldContents[f.key]" class="field-done">✅</span>
</div><div v-if="analyzing" class="analyzing-hint">AI分析中...</div></div>
<div class="chat-area">
<div v-if="!currentField" class="chat-placeholder"><span class="pl-icon">💬</span><p>选择字段开始对话</p></div>
<div v-else class="chat-content">
<div class="chat-header"><span>填写：<strong>{{currentField.label||currentField.key}}</strong></span></div>
<div class="messages">
<div v-for="(msg,i) in currentMessages" :key="i" :class="['msg',msg.role]">
<div class="msg-avatar">{{msg.role==='user'?'👤':'🤖'}}</div>
<div class="msg-bubble"><div class="msg-text" v-html="formatMsg(msg.content)"></div></div>
</div>
<div v-if="streaming" class="msg assistant"><div class="msg-avatar">🤖</div>
<div class="msg-bubble"><div class="msg-text">{{streamText}}<span class="cursor">|</span></div></div></div>
</div>
<div class="input-area">
<div v-if="!streaming&&streamDone" class="review-bar">
<button class="btn success" @click="acceptContent">✅ 合理，填入</button>
<div class="modify-row"><input v-model="modifyInput" placeholder="需要怎么修改？" @keyup.enter="requestModify" class="modify-input"><button class="btn outline" @click="requestModify" :disabled="!modifyInput.trim()">🔄</button></div>
</div>
<div v-else-if="!streaming" class="input-row">
<textarea v-model="userInput" placeholder="描述要填写的内容..." @keyup.ctrl.enter="sendMessage" rows="2" class="chat-input"></textarea>
<button class="btn primary" @click="sendMessage" :disabled="!userInput.trim()||streaming">发送</button>
</div>
<div v-if="streaming" class="streaming-hint">AI 生成中...</div>
</div></div></div></div>
<div v-if="template&&allNarrativeDone" class="fill-bar">
<button class="btn success large" @click="doFinalFill" :disabled="filling">
<span v-if="filling" class="spinner"></span>{{filling?'填充中...':'一键生成文档'}}</button>
</div>
</div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import * as api from '../../api/zongce'

const template=ref(null),templateFile=ref(null),uploading=ref(false),analyzing=ref(false)
const errorMsg=ref(''),fields=ref([]),currentField=ref(null)
const fieldContents=reactive({}),currentMessages=ref([]),userInput=ref('')
const modifyInput=ref(''),streamText=ref(''),streaming=ref(false),streamDone=ref(false),filling=ref(false)

const allNarrativeDone=computed(()=>{
  const n=fields.value.filter(f=>f.type==='narrative')
  return n.length>0&&n.every(f=>fieldContents[f.key])
})

function onFileSelect(e){templateFile.value=e.target.files[0]||null}
function onDrop(e){templateFile.value=e.dataTransfer.files[0]||null}

async function doUpload(){
  if(!templateFile.value)return;uploading.value=true;errorMsg.value=''
  const fd=new FormData();fd.append('file',templateFile.value)
  try{const res=await api.chatFillUpload(fd)
    if(res.code===200){template.value=res.data;await doAnalyze(res.data.id)}
    else errorMsg.value=res.msg}catch(e){errorMsg.value=e.message||'上传失败'}finally{uploading.value=false}
}
async function doAnalyze(tid){analyzing.value=true
  try{const res=await api.chatFillAnalyze(tid)
    if(res.code===200){fields.value=res.data.fields||[]
      for(const f of fields.value){if(f.type==='simple')fieldContents[f.key]=''}}}
  catch(e){console.error(e)}finally{analyzing.value=false}
}
function selectField(f){currentField.value=f
  const k='chat_'+template.value.id+'_'+f.key
  currentMessages.value=JSON.parse(localStorage.getItem(k)||'[]')
  streamText.value='';streaming.value=false;streamDone.value=!!fieldContents[f.key]
}
function saveMessages(){
  const k='chat_'+template.value.id+'_'+currentField.value.key
  localStorage.setItem(k,JSON.stringify(currentMessages.value))
}
function formatMsg(t){return t.replace(/\n/g,'<br>')}
async function sendMessage(){
  if(!userInput.value.trim()||streaming.value)return
  currentMessages.value.push({role:'user',content:userInput.value.trim()});saveMessages()
  userInput.value='';streaming.value=true;streamDone.value=false;streamText.value=''
  await doStreamChat()
}
async function requestModify(){
  if(!modifyInput.value.trim())return
  currentMessages.value.push({role:'user',content:'请修改：'+modifyInput.value.trim()})
  modifyInput.value='';saveMessages()
  streaming.value=true;streamDone.value=false;streamText.value=''
  await doStreamChat()
}
async function doStreamChat(){
  try{const tk=localStorage.getItem('token')||''
    const res=await fetch('/api/zongce/chat-fill/chat',{method:'POST',
      headers:{'Content-Type':'application/json',Authorization:'Bearer '+tk},
      body:JSON.stringify({fieldKey:currentField.value.key,fieldLabel:currentField.value.label,
        messages:currentMessages.value,
        simpleFields:Object.fromEntries(fields.value.filter(f=>f.type==='simple').map(f=>[f.key,fieldContents[f.key]||'']))})})
    const reader=res.body.getReader();const dec=new TextDecoder();let buf=''
    while(true){const{done,value}=await reader.read();if(done)break
      buf+=dec.decode(value,{stream:true});const lines=buf.split('\n');buf=lines.pop()||''
      for(const l of lines){if(!l.startsWith('data: '))continue;const d=l.slice(6).trim()
        if(d==='[DONE]'){streaming.value=false;streamDone.value=true;return}
        try{const p=JSON.parse(d);if(p.token)streamText.value+=p.token}catch(e){}}}
    streaming.value=false;streamDone.value=true
  }catch(e){streaming.value=false;streamDone.value=true}
}
function acceptContent(){
  const c=streamText.value.trim();if(!c)return
  fieldContents[currentField.value.key]=c
  currentMessages.value.push({role:'assistant',content:c});saveMessages()
  streamText.value='';streamDone.value=false
}
async function doFinalFill(){
  filling.value=true
  try{const res=await api.chatFillDoFill(template.value.id,{...fieldContents})
    if(res.code===200){const blob=await api.downloadFill(res.data.fillId)
      const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url
      a.download='对话填表结果.docx';document.body.appendChild(a);a.click()
      document.body.removeChild(a);URL.revokeObjectURL(url)}}
  catch(e){alert('填充失败')}finally{filling.value=false}
}
</script>

<style scoped>
.chat-page{max-width:1100px;margin:0 auto;display:flex;flex-direction:column;gap:20px}
.page-title{font-size:24px;margin:0}.page-desc{font-size:14px;color: var(--color-text-secondary);margin:0}
.card{background: var(--color-surface);border-radius:10px;border: 1px solid var(--color-border);padding:24px;display:flex;flex-direction:column;gap:16px}
.upload-card{max-width:500px;margin:40px auto;align-items:center}
.upload-zone{border: 2px dashed var(--color-border);border-radius:10px;padding:32px;text-align:center;cursor:pointer;transition:.2s;display:flex;flex-direction:column;align-items:center;gap:8px;width:100%}
.upload-zone:hover{border-color:#4F46E5;background: var(--color-surface-variant)}
.upload-icon{font-size:40px}.upload-zone strong{font-size:15px;color: var(--color-text)}.upload-zone p{font-size:12px;color: var(--color-text-tertiary);margin:0}
.main-layout{display:grid;grid-template-columns:240px 1fr;gap:20px;min-height:500px}
.field-sidebar{background: var(--color-surface);border-radius:10px;border: 1px solid var(--color-border);padding:16px}
.field-sidebar h4{font-size:14px;margin:0 0 8px;color: var(--color-text)}
.field-item{display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:6px;cursor:pointer;font-size:13px;transition:.15s}
.field-item:hover{background: var(--color-surface-variant)}.field-item.active{background:#eef2ff;color:#4F46E5}.field-item.done{opacity:.7}
.field-icon{font-size:16px}.field-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.field-done{color:#34A853}
.analyzing-hint{font-size:12px;color: var(--color-text-tertiary);text-align:center;padding:20px}
.chat-area{background: var(--color-surface);border-radius:10px;border: 1px solid var(--color-border);display:flex;flex-direction:column;overflow:hidden}
.chat-placeholder{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color: var(--color-text-tertiary);gap:12px}
.pl-icon{font-size:48px}
.chat-content{display:flex;flex-direction:column;height:100%;min-height:450px}
.chat-header{padding:12px 16px;border-bottom: 1px solid var(--color-border);font-size:14px}
.messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;max-height:400px}
.msg{display:flex;gap:10px;max-width:85%}.msg.user{align-self:flex-end;flex-direction:row-reverse}.msg.assistant{align-self:flex-start}
.msg-avatar{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;background: var(--color-surface-variant);flex-shrink:0}
.msg.user .msg-avatar{background:#eef2ff}
.msg-bubble{padding:10px 14px;border-radius:12px;font-size:14px;line-height:1.6}
.msg.user .msg-bubble{background:#4F46E5;color:#fff}.msg.assistant .msg-bubble{background: var(--color-surface-variant);color: var(--color-text)}
.cursor{animation:blink 1s infinite;color:#4F46E5}@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
.input-area{border-top: 1px solid var(--color-border);padding:12px 16px}
.review-bar{display:flex;flex-direction:column;gap:8px}
.modify-row{display:flex;gap:8px}
.modify-input{flex:1;padding:8px 12px;border: 1px solid var(--color-border);border-radius:6px;font-size:13px;font-family:inherit}
.input-row{display:flex;gap:8px;align-items:flex-end}
.chat-input{flex:1;padding:8px 12px;border: 1px solid var(--color-border);border-radius:6px;font-size:14px;resize:none;font-family:inherit}
.streaming-hint{font-size:12px;color: var(--color-text-tertiary);text-align:center;padding:8px}
.fill-bar{display:flex;justify-content:center;padding:8px 0}
.btn{padding:10px 24px;border:none;border-radius:6px;cursor:pointer;font-size:15px;display:inline-flex;align-items:center;gap:8px;font-family:inherit}
.btn:disabled{opacity:.6;cursor:not-allowed}.btn.primary{background:#4F46E5;color:#fff}.btn.success{background:#34A853;color:#fff}
.btn.outline{background: var(--color-surface);color:#4F46E5;border:1px solid #4F46E5}.btn.large{padding:12px 32px;font-size:16px}
.error-msg{padding:10px 16px;background: var(--color-error-bg);border:1px solid #fecaca;border-radius:6px;color:#D93025;font-size:13px}
.spinner{width:16px;height:16px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
@media(max-width:768px){.main-layout{grid-template-columns:1fr}}
</style>
