<template>
  <div class="f1-root">
    <div class="f1-header"><h4>F1 基本素质（权重10%，满分100分）</h4></div>
    <div class="dim-list">
      <div v-for="a in store.f1Items" :key="a.key" class="dim-row">
        <span class="dim-name">{{ a.label }}</span>
        <input class="score-inp" type="number" v-model.number="a.score" :min="0" :max="a.base" />
        <span class="score-unit">/{{ a.base }}</span>
        <textarea class="desc-inp" v-model="a.detail" placeholder="填写理由..." rows="2"></textarea>
        <button class="btn-ai" @click="generateAI(a)" title="AI生成">🤖</button>
      </div>
    </div>
    <div class="f1-footer">
      <span>合计：<b>{{ store.f1Total }}</b> / 100 分</span>
      <span class="weight-note">加权后 {{ store.f1Weighted }} 分</span>
      <button class="btn-complete" @click="emit('complete')">✓ 完成填写</button>
    </div>
  </div>
</template>

<script setup>
import { watch, onBeforeUnmount } from 'vue'
import { useSmartFillStore } from '@/stores/smartFill'
import * as api from '@/api/zongce'

const store = useSmartFillStore()
const emit = defineEmits(['complete'])

let saveTimer = null
watch(() => store.f1Items.map(a => ({ key: a.key, score: a.score, detail: a.detail })), () => {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    api.saveFillData(store.f1Items.map(a => ({ section:'F1',item_key:a.key,score:a.base-a.score,description:a.detail,rule_set_id:0 }))).catch(()=>{})
  }, 800)
}, { deep: true })

onBeforeUnmount(() => {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
  api.saveFillData(store.f1Items.map(a => ({ section:'F1',item_key:a.key,score:a.base-a.score,description:a.detail,rule_set_id:0 }))).catch(()=>{})
})

async function generateAI(a) {
  try { const r = await api.generateF1Description('F1', a.key, a.label); if (r.code===200&&r.data?.description) a.detail = r.data.description } catch (_) {}
}
</script>

<style scoped>
.f1-root { width: 100%; }
.f1-header h4 { font-size: 17px; margin: 0 0 20px; font-weight: 700; }
.dim-list { display: flex; flex-direction: column; gap: 14px; }
.dim-row { display: grid; grid-template-columns: 150px 70px 30px 1fr 40px; align-items: center; gap: 12px; padding: 14px 18px; background: rgba(255,255,255,0.03); border-radius: 14px; border: 1px solid rgba(255,255,255,0.06); }
.dim-name { font-size: 14px; font-weight: 600; color: var(--color-text); }
.score-inp { width: 100%; text-align: center; border: 1.5px solid rgba(255,255,255,0.12); border-radius: 10px; font-size: 15px; padding: 8px 4px; color: #c4a882; font-weight: 700; background: rgba(255,255,255,0.04); font-family: inherit; }
.score-inp:focus { outline: none; border-color: #c4a882; box-shadow: 0 0 0 3px rgba(196,168,130,0.12); }
.score-unit { font-size: 13px; color: var(--color-text-tertiary); }
.desc-inp { width: 100%; border: 1.5px solid rgba(255,255,255,0.10); border-radius: 10px; padding: 8px 12px; font-size: 13px; resize: none; font-family: inherit; background: rgba(255,255,255,0.04); color: var(--color-text); }
.desc-inp:focus { outline: none; border-color: #c4a882; box-shadow: 0 0 0 3px rgba(196,168,130,0.10); }
.btn-ai { background: rgba(196,168,130,0.10); border: 1px solid rgba(196,168,130,0.20); border-radius: 8px; cursor: pointer; font-size: 16px; padding: 8px; transition: all .2s; }
.btn-ai:hover { background: rgba(196,168,130,0.22); }
.f1-footer { margin-top: 20px; display: flex; align-items: center; gap: 20px; font-size: 15px; padding: 14px 18px; background: rgba(255,255,255,0.03); border-radius: 14px; border: 1px solid rgba(255,255,255,0.06); }
.f1-footer b { font-size: 24px; color: #c4a882; }
.weight-note { font-size: 13px; color: var(--color-text-tertiary); flex: 1; }
.btn-complete { padding: 8px 20px; border: none; border-radius: 10px; background: rgba(125,155,118,0.18); color: #7d9b76; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all .2s; }
.btn-complete:hover { background: rgba(125,155,118,0.30); }
</style>
