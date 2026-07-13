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
    </div>
  </div>
</template>

<script setup>
import { watch, onBeforeUnmount } from 'vue'
import { useSmartFillStore } from '@/stores/smartFill'
import * as api from '@/api/zongce'

const store = useSmartFillStore()

// ★ 自动保存：监听 F1 编辑变化，debounce 800ms 后保存到服务端
let saveTimer = null
watch(
  () => store.f1Items.map(a => ({ key: a.key, score: a.score, detail: a.detail })),
  () => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      const items = store.f1Items.map(a => ({
        section: 'F1',
        item_key: a.key,
        score: a.base - a.score,  // 转换为扣分制存储
        description: a.detail,
        rule_set_id: 0
      }))
      api.saveFillData(items).catch(() => {})
    }, 800)
  },
  { deep: true }
)

// 组件卸载前立即保存
onBeforeUnmount(() => {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
  const items = store.f1Items.map(a => ({
    section: 'F1',
    item_key: a.key,
    score: a.base - a.score,
    description: a.detail,
    rule_set_id: 0
  }))
  api.saveFillData(items).catch(() => {})
})

async function generateAI(a) {
  try {
    const r = await api.generateF1Description('F1', a.key, a.label)
    if (r.code === 200 && r.data?.description) {
      a.detail = r.data.description
    }
  } catch (_) {}
}
</script>

<style scoped>
.f1-root { max-width: 700px; }
.f1-header h4 { font-size: 16px; margin: 0 0 16px; }
.dim-list { display: flex; flex-direction: column; gap: 12px; }
.dim-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.dim-name { font-size: 14px; font-weight: 600; min-width: 140px; color: #333; }
.score-inp { width: 50px; text-align: center; border: 1px solid #d0d0d0; border-radius: 4px; font-size: 14px; padding: 4px; color: #1a73e8; font-weight: 600; }
.score-unit { font-size: 13px; color: #999; }
.desc-inp { flex: 1; min-width: 200px; border: 1px solid #e0e0e0; border-radius: 4px; padding: 6px 10px; font-size: 13px; resize: none; font-family: inherit; }
.desc-inp:focus, .score-inp:focus { outline: none; border-color: #1a73e8; box-shadow: 0 0 0 2px rgba(26,115,232,0.1); }
.btn-ai { background: #f0f4ff; border: 1px solid #b8d4f0; border-radius: 4px; cursor: pointer; font-size: 16px; padding: 6px 10px; transition: all .2s; }
.btn-ai:hover { background: #d6e4ff; }
.f1-footer { margin-top: 16px; padding: 12px 16px; background: #f5f7fa; border-radius: 8px; display: flex; justify-content: space-between; font-size: 14px; }
.f1-footer b { color: #1a73e8; font-size: 18px; }
.weight-note { color: #888; font-size: 13px; }
</style>