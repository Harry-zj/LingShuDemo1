<template>
  <div class="class-leader-desk">
    <h2>班级初审台</h2>
    <div class="stats-row">
      <div class="stat-card warning"><div class="num">{{ pending.length }}</div><div class="lbl">待审核</div></div>
      <div class="stat-card success"><div class="num">{{ approved.length }}</div><div class="lbl">已通过</div></div>
      <div class="stat-card error"><div class="num">{{ returned.length }}</div><div class="lbl">已退回</div></div>
    </div>
    <div class="review-list">
      <h3>待审核列表</h3>
      <div class="review-row" v-for="m in pending" :key="m.id">
        <span>{{ m.student_name }} - {{ m.title }}</span>
        <div class="btns">
          <button class="btn-approve" @click="doReview(m.id, approveAction)">通过</button>
          <button class="btn-return" @click="doReview(m.id, returnAction)">退回</button>
        </div>
      </div>
      <p v-if="!pending.length" class="empty">全部审核完毕！</p>
    </div>
  </div>
</template>
<script setup>
import { ref, onMounted } from "vue"
import { getPendingReviews, reviewMaterial } from "../../api/module3"
const pending = ref([]); const approved = ref([]); const returned = ref([])
const approveAction = "approve"; const returnAction = "return"
async function load() { const r = await getPendingReviews(); if (r.code === 200) pending.value = r.data || [] }
async function doReview(id, action) { await reviewMaterial(id, { action }); alert("审核操作完成"); load() }
onMounted(load)
</script>
<style scoped>
.class-leader-desk h2 { font-size: 24px; margin-bottom: 24px }
.stats-row { display: flex; gap: 16px; margin-bottom: 24px }
.stat-card { flex: 1; padding: 24px; border-radius: var(--radius-md); text-align: center }
.stat-card.warning { background: var(--color-warning-bg) }
.stat-card.success { background: var(--color-success-bg) }
.stat-card.error { background: var(--color-error-bg) }
.stat-card .num { font-size: 32px; font-weight: 700 }
.stat-card.warning .num { color: var(--color-warning) }
.stat-card.success .num { color: var(--color-success) }
.stat-card.error .num { color: var(--color-error) }
.stat-card .lbl { font-size: 14px; color: var(--color-text-secondary); margin-top: 4px }
.review-list { background: var(--color-white); border-radius: var(--radius-card); border: 1px solid var(--color-border); padding: 24px }
.review-list h3 { font-size: 16px; margin-bottom: 16px }
.review-row { display: flex; justify-content: space-between; align-items: center; padding: 16px 0; border-bottom: 1px solid var(--color-bg) }
.btns { display: flex; gap: 8px }
.btn-approve { padding: 8px 20px; border: none; border-radius: var(--radius-btn); background: var(--color-success); color: #fff; cursor: pointer }
.btn-return { padding: 8px 20px; border: 1px solid var(--color-error); border-radius: var(--radius-btn); background: #fff; color: var(--color-error); cursor: pointer }
.empty { color: var(--color-gray); text-align: center; padding: 32px }
</style>