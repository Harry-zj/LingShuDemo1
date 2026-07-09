<template>
  <div class="class-leader-desk">
    <div class="page-header">
      <h2>班级初审台</h2>
      <p class="page-desc">审核本班学生提交的综测材料</p>
    </div>
    <div class="stats-row">
      <div class="stat-card warning">
        <VIcon icon="mdi:clock-outline" class="stat-icon" />
        <div class="stat-num">{{ pending.length }}</div>
        <div class="stat-lbl">待审核</div>
      </div>
      <div class="stat-card success">
        <VIcon icon="mdi:check-circle-outline" class="stat-icon" />
        <div class="stat-num">{{ approved.length }}</div>
        <div class="stat-lbl">已通过</div>
      </div>
      <div class="stat-card error">
        <VIcon icon="mdi:close-circle-outline" class="stat-icon" />
        <div class="stat-num">{{ returned.length }}</div>
        <div class="stat-lbl">已退回</div>
      </div>
    </div>
    <div class="review-list glass-card">
      <div class="panel-header">
        <h3><VIcon icon="mdi:format-list-checks" />待审核列表</h3>
        <span class="panel-badge">{{ pending.length }} 项待处理</span>
      </div>
      <div class="review-items">
        <div class="review-row" v-for="(m, i) in pending" :key="m.id"
          :style="{ animationDelay: (i * 0.06) + 's' }">
          <div class="row-info">
            <div class="student-avatar">{{ m.student_name?.[0] }}</div>
            <div class="student-detail">
              <span class="student-name">{{ m.student_name }}</span>
              <span class="material-title">{{ m.title }}</span>
            </div>
          </div>
          <div class="btns">
            <button class="btn-approve" @click="doReview(m.id, approveAction)"><VIcon icon="mdi:check" />通过</button>
            <button class="btn-return" @click="doReview(m.id, returnAction)"><VIcon icon="mdi:close" />退回</button>
          </div>
        </div>
        <div class="empty-state" v-if="!pending.length">
          <VIcon icon="mdi:check-circle-outline" class="empty-icon" />
          <p>全部审核完毕！</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getPendingReviews, reviewMaterial } from '../../api/module3'
const pending = ref([]); const approved = ref([]); const returned = ref([])
const approveAction = 'approve'; const returnAction = 'return'
async function load() { const r = await getPendingReviews(); if (r.code === 200) { pending.value = r.data || [] } }
async function doReview(id, action) { await reviewMaterial(id, { action }); alert('审核操作完成'); load() }
onMounted(load)
</script>

<style scoped>
.class-leader-desk { display: flex; flex-direction: column; gap: 24px; animation: fadeIn 0.4s var(--easing-decelerate); }
.page-header h2 { font-size: 22px; font-weight: var(--font-weight-semibold); }
.page-desc { font-size: 14px; color: var(--color-text-secondary); margin-top: 2px; }

.stats-row { display: flex; gap: 16px; }
.stat-card {
  flex: 1; padding: 24px; border-radius: var(--radius-lg); text-align: center; cursor: pointer;
  transition: all var(--duration-normal) var(--easing-spring);
  opacity: 0; animation: fadeInUp 0.5s var(--easing-spring) forwards;
}
.stat-card:nth-child(1) { animation-delay: 0.05s; }
.stat-card:nth-child(2) { animation-delay: 0.1s; }
.stat-card:nth-child(3) { animation-delay: 0.15s; }
.stat-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-level-3); }
.stat-card:active { transform: translateY(0) scale(0.97); }
.stat-card.warning { background: var(--color-warning-bg); border: 1px solid rgba(217,119,6,0.15); }
.stat-card.success { background: var(--color-success-bg); border: 1px solid rgba(5,150,105,0.15); }
.stat-card.error { background: var(--color-error-bg); border: 1px solid rgba(220,38,38,0.15); }
.stat-icon { font-size: 24px; margin-bottom: 8px; }
.stat-card.warning .stat-icon { color: var(--color-warning); }
.stat-card.success .stat-icon { color: var(--color-success); }
.stat-card.error .stat-icon { color: var(--color-error); }
.stat-num { font-size: 32px; font-weight: var(--font-weight-bold); }
.stat-card.warning .stat-num { color: var(--color-warning); }
.stat-card.success .stat-num { color: var(--color-success); }
.stat-card.error .stat-num { color: var(--color-error); }
.stat-lbl { font-size: 14px; color: var(--color-text-secondary); margin-top: 4px; }

.review-list { border-radius: var(--radius-xl); padding: 24px; animation: fadeInUp 0.5s var(--easing-spring) 0.2s both; }
.panel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.panel-header h3 { font-size: 16px; font-weight: var(--font-weight-semibold); display: flex; align-items: center; gap: 8px; }
.panel-header h3 VIcon { color: var(--color-primary); font-size: 20px; }
.panel-badge { font-size: 12px; padding: 4px 12px; border-radius: var(--radius-full); background: var(--color-warning-bg); color: var(--color-warning); font-weight: var(--font-weight-medium); }

.review-items { display: flex; flex-direction: column; }
.review-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 8px; border-bottom: 1px solid var(--color-gray-bg);
  opacity: 0; animation: fadeInUp 0.4s var(--easing-spring) forwards;
  transition: background var(--duration-fast) var(--easing-standard);
  margin: 0 -8px;
}
.review-row:hover { background: var(--color-surface-variant); }
.review-row:last-child { border-bottom: none; }
.row-info { display: flex; align-items: center; gap: 12px; }
.student-avatar {
  width: 36px; height: 36px; border-radius: 50%;
  background: var(--color-primary-gradient-bright); color: white;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; font-weight: var(--font-weight-semibold); flex-shrink: 0;
}
.student-detail { display: flex; flex-direction: column; gap: 2px; }
.student-name { font-size: 14px; font-weight: var(--font-weight-medium); color: var(--color-text); }
.material-title { font-size: 12px; color: var(--color-text-secondary); }

.btns { display: flex; gap: 8px; flex-shrink: 0; }
.btn-approve, .btn-return {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 8px 16px; border-radius: var(--radius-full);
  font-size: 13px; font-weight: var(--font-weight-medium);
  cursor: pointer; transition: all var(--duration-fast) var(--easing-spring);
}
.btn-approve { border: none; background: var(--color-success); color: #fff; }
.btn-approve:hover { box-shadow: 0 2px 8px rgba(5,150,105,0.3); transform: translateY(-1px); }
.btn-return { border: 1px solid var(--color-error); background: #fff; color: var(--color-error); }
.btn-return:hover { background: var(--color-error-bg); transform: translateY(-1px); }
.empty-state { text-align: center; padding: 48px; color: var(--color-text-tertiary); }
.empty-icon { font-size: 48px; margin-bottom: 12px; color: var(--color-success); }
.empty-state p { font-size: 16px; color: var(--color-text-secondary); }

@media (max-width: 768px) { .stats-row { flex-wrap: wrap; } .stat-card { min-width: calc(50% - 8px); } .review-row { flex-direction: column; gap: 12px; align-items: stretch; } .btns { justify-content: flex-end; } }
</style>
