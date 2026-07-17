<template>
  <div class="f1-root">
    <div class="f1-header"><h4>F1 基本素质（权重10%，满分{{ sectionLimit }}分）</h4></div>
    <div class="dim-list">
      <div v-for="a in store.f1Items" :key="a.key" class="dim-row" :class="{ readonly: props.readonly }">
        <span class="dim-name">{{ a.label }}</span>
        <input class="score-inp" type="number" v-model.number="a.score" :min="0" :max="a.base" :disabled="props.readonly" />
        <span class="score-unit">/{{ a.base }}</span>
        <textarea class="desc-inp" v-model="a.detail" placeholder="填写理由..." rows="2" :disabled="props.readonly"></textarea>
        <button v-if="!props.readonly" class="btn-ai" @click="generateAI(a)" title="AI生成">🤖</button>
      </div>
    </div>
    <div class="f1-footer">
      <span>合计：<b>{{ f1Total }}</b> / {{ sectionLimit }} 分</span>
      <span class="weight-note">加权后 {{ f1Weighted }} 分</span>
      <button v-if="!props.readonly" class="btn-complete" :disabled="saving" @click="completeF1">{{ saving ? '保存中...' : '✓ 完成填写' }}</button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { useSmartFillStore } from '@/stores/smartFill'
import * as api from '@/api/zongce'

const store = useSmartFillStore()
const emit = defineEmits(['complete'])
const props = defineProps({
  scorePolicy: { type: Object, default: () => ({}) },
  ruleSetId: { type: Number, default: 0 },
  batchId: { type: [Number, String], default: null },
  readonly: { type: Boolean, default: false },
  readonlyReason: { type: String, default: '' },
})
const saving = ref(false)
const sectionLimit = computed(() => Number(props.scorePolicy?.scoreLimits?.F1 ?? 100))
const f1Total = computed(() => Math.min(Number(store.f1Total || 0), sectionLimit.value))
const f1Weighted = computed(() => Number((f1Total.value * 0.1).toFixed(2)))

watch(() => props.scorePolicy?.scoreLimits, limits => {
  for (const item of store.f1Items) {
    const max = Number(limits?.[item.key] ?? 20)
    item.base = max
    item.score = Math.min(Math.max(Number(item.score || 0), 0), max)
  }
}, { immediate: true, deep: true })

function buildSaveItems() {
  return store.f1Items.map(a => ({
    section: 'F1',
    item_key: a.key,
    score: a.base - a.score,
    description: a.detail,
    rule_set_id: props.ruleSetId || 0,
  }))
}

async function persistF1() {
  return api.saveFillData(buildSaveItems(), props.batchId)
}

let saveTimer = null
watch(() => store.f1Items.map(a => ({ key: a.key, score: a.score, detail: a.detail })), () => {
  if (props.readonly) return
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    persistF1().catch(() => {})
  }, 800)
}, { deep: true })

onBeforeUnmount(() => {
  if (props.readonly) return
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
  persistF1().catch(() => {})
})

async function completeF1() {
  if (saving.value) return
  clearTimeout(saveTimer)
  saveTimer = null
  saving.value = true
  try {
    const response = await persistF1()
    if (response?.code !== 200) return alert(response?.msg || 'F1 保存失败')
    emit('complete')
  } catch (error) {
    alert(error?.response?.data?.msg || error?.message || 'F1 保存失败')
  } finally {
    saving.value = false
  }
}

async function generateAI(a) {
  try { const r = await api.generateF1Description('F1', a.key, a.label); if (r.code===200&&r.data?.description) a.detail = r.data.description } catch (_) {}
}
</script>

<style scoped>
.f1-root { width: 100%; }
.readonly-notice { display: flex; align-items: center; gap: 10px; padding: 12px 16px; margin-bottom: 16px; background: rgba(245,158,11,0.12); border: 1px solid rgba(245,158,11,0.25); border-radius: 10px; font-size: 13px; color: #d97706; }
.readonly-notice .hint { color: var(--color-text-tertiary); font-size: 12px; margin-left: auto; }
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
