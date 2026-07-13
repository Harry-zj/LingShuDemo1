<template>
  <div class="review-detail">
    <div class="page-header">
      <button class="btn-outline" @click="exitReview">
        <VIcon icon="mdi:exit-to-app" />退出评测
      </button>
      <div>
        <h2>{{ isObjectionReview ? '异议再次评测' : '综测表评价详情' }}</h2>
        <p class="page-desc">
          {{ isObjectionReview ? '仅重新评价学生提出异议的加分项，处理完成后继续下一名待评学生。' : '逐项核查加分内容，可填写评测理由；处理完成后自动跳转下一名待评学生。' }}
        </p>
      </div>
    </div>

    <div class="assignment-card glass-card" v-if="visibleTasks.length">
      <div class="panel-header">
        <h3><VIcon icon="mdi:account-switch-outline" />我的评测分配信息</h3>
        <span class="stage-tag">{{ isObjectionReview ? '异议复评' : '首次评价' }}</span>
      </div>
      <div class="task-list">
        <span v-for="task in visibleTasks" :key="task.id">
          {{ task.target_class_name }} → {{ task.reviewer_class_name }}：{{ task.reviewer_name }}（{{ task.status === 'pending' ? '待评' : '已处理' }}）
        </span>
      </div>
    </div>

    <AssessmentFormPanel v-if="form" :form="form" />

    <section class="item-review-box glass-card" v-if="form && reviewableItems.length">
      <div class="panel-header">
        <h3><VIcon icon="mdi:format-list-checks" />逐项评测</h3>
        <span class="panel-count">{{ reviewableItems.length }} 项</span>
      </div>
      <div class="item-review-list">
        <article class="item-review-card" v-for="item in reviewableItems" :key="item.id">
          <div class="item-head">
            <div>
              <strong>{{ item.title || '未命名加分项' }}</strong>
              <p>{{ item.section }} / {{ item.subKey }} · 原分值 {{ item.score }} 分</p>
            </div>
            <span v-if="item.objection" class="objection-tag">异议：{{ item.objection.reason }}</span>
          </div>
          <div class="item-fields">
            <label>
              <span>评测结论</span>
              <select v-model="reviewDrafts[item.id].action">
                <option value="approve">符合</option>
                <option value="return">需修改</option>
                <option value="reject">不符合</option>
              </select>
            </label>
            <label>
              <span>复核分值</span>
              <input type="number" min="0" step="0.1" v-model.number="reviewDrafts[item.id].score" />
            </label>
          </div>
          <div class="template-row">
            <span>常用评价：</span>
            <button v-for="text in templates" :key="text" @click="useTemplate(item.id, text)">{{ text }}</button>
          </div>
          <textarea v-model="reviewDrafts[item.id].reason" placeholder="该项评测理由（选填）"></textarea>
        </article>
      </div>
    </section>

    <div class="review-box glass-card" v-if="form">
      <div class="panel-header">
        <h3><VIcon icon="mdi:clipboard-check-outline" />{{ currentRoleName }}总体评价</h3>
        <span class="panel-count">自动等级：{{ form.auto_level }}</span>
      </div>

      <div class="level-row" v-if="canAdjustLevel && !isObjectionReview">
        <label>测评等级</label>
        <div class="level-options">
          <button v-for="g in levels" :key="g" :class="{ active: level === g }" @click="level = g">{{ g }}</button>
        </div>
        <p class="level-tip">默认按分数自动确认，也可以在评价时手动调整。</p>
      </div>

      <textarea v-model="comment" placeholder="填写总体评价意见"></textarea>

      <div class="actions">
        <button class="btn-pass" :disabled="processing" @click="handleReview('approve')">
          <VIcon icon="mdi:check" />{{ isObjectionReview ? '提交异议复评结果' : '材料无误，通过' }}
        </button>
        <button v-if="!isObjectionReview" class="btn-return" :disabled="processing" @click="handleReview('return')">
          <VIcon icon="mdi:undo" />退回修改
        </button>
        <button v-if="!isObjectionReview" class="btn-reject" :disabled="processing" @click="handleReview('reject')">
          <VIcon icon="mdi:close" />不予认定
        </button>
      </div>
    </div>

    <div class="empty-state" v-if="!form">
      <VIcon icon="mdi:loading" />
      <span>正在加载详情</span>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getFormDetail, getPendingReviews, reviewMaterial } from '../../api/module3';
import { useUserStore } from '../../stores/user';
import { ROLE_LABEL } from '../../utils/constants';
import AssessmentFormPanel from './AssessmentFormPanel.vue';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const form = ref(null);
const comment = ref('');
const level = ref('');
const processing = ref(false);
const reviewDrafts = reactive({});
const levels = ['优', '良', '合格', '不合格'];
const templates = ['材料不清楚', '材料错误', '不符合加分标准', '加分数量过多'];
const currentRoleName = computed(() => userStore.user?.is_assessment_member ? '评价小组' : (ROLE_LABEL[userStore.role] || '评价人员'));
const canAdjustLevel = computed(() => (userStore.role === 'student' && userStore.user?.is_assessment_member) || userStore.role === 'counselor');
const isObjectionReview = computed(() => form.value?.review_stage === 'objection');
const visibleTasks = computed(() => {
  const tasks = form.value?.review_tasks || [];
  if (userStore.role === 'student' && form.value?.student_id !== userStore.user?.id) {
    return tasks.filter(task => Number(task.reviewer_id) === Number(userStore.user?.id));
  }
  return tasks;
});
const reviewableItems = computed(() => {
  const ids = new Set((form.value?.reviewable_item_ids || []).map(Number));
  return (form.value?.items || []).filter(item => !ids.size || ids.has(Number(item.id)));
});

function initDrafts(data) {
  Object.keys(reviewDrafts).forEach(key => delete reviewDrafts[key]);
  const currentStage = data.review_stage || 'initial';
  const mine = (data.item_reviews || []).filter(review =>
    Number(review.reviewer_id) === Number(userStore.user?.id) && review.stage === currentStage
  );
  for (const item of data.items || []) {
    const old = mine.find(review => Number(review.item_id) === Number(item.id));
    reviewDrafts[item.id] = {
      action: old?.action || 'approve',
      reason: old?.reason || '',
      score: Number(old?.reviewed_score ?? item.score ?? 0),
    };
  }
}

function useTemplate(itemId, text) {
  const draft = reviewDrafts[itemId];
  if (!draft) return;
  draft.reason = draft.reason ? `${draft.reason}；${text}` : text;
}

async function load(id = route.params.id) {
  form.value = null;
  comment.value = '';
  const res = await getFormDetail(id);
  if (res.code === 200) {
    form.value = res.data;
    level.value = res.data.level || res.data.auto_level;
    initDrafts(res.data);
  } else {
    alert(res.msg || '加载评价详情失败');
    router.push('/module3/class-leader');
  }
}

function exitReview() {
  router.push('/module3/class-leader');
}

async function handleReview(action) {
  processing.value = true;
  try {
    const itemReviews = reviewableItems.value.map(item => ({
      item_id: item.id,
      action: reviewDrafts[item.id]?.action || action,
      reason: reviewDrafts[item.id]?.reason || '',
      score: Number(reviewDrafts[item.id]?.score ?? item.score ?? 0),
    }));
    const res = await reviewMaterial(route.params.id, {
      action,
      comment: comment.value,
      level: canAdjustLevel.value && !isObjectionReview.value ? level.value : '',
      item_reviews: itemReviews,
    });
    if (res.code !== 200) return alert(res.msg || '评价处理失败');

    const pendingRes = await getPendingReviews();
    const next = pendingRes.code === 200 ? (pendingRes.data || [])[0] : null;
    if (next) {
      alert('评价处理完成，已进入下一名待评学生');
      await router.replace(`/module3/review-detail/${next.id}`);
    } else {
      alert('评价处理完成，当前已无待评学生');
      router.push('/module3/class-leader');
    }
  } catch (error) {
    alert(error?.message || '评价处理失败');
  } finally {
    processing.value = false;
  }
}

watch(() => route.params.id, id => { if (id) load(id); });
onMounted(() => load());
</script>

<style scoped>
.review-detail { display: flex; flex-direction: column; gap: 24px; animation: fadeIn 0.4s var(--easing-decelerate); }
.page-header { display: flex; align-items: center; gap: 16px; }
.page-header h2 { font-size: 22px; font-weight: var(--font-weight-semibold); }
.page-desc { font-size: 14px; color: var(--color-text-secondary); margin-top: 2px; }
.btn-outline { display: inline-flex; align-items: center; gap: 6px; height: 38px; padding: 0 14px; border-radius: 8px !important; border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-primary); cursor: pointer; }
.assignment-card, .review-box, .item-review-box { padding: 20px; border-radius: 8px !important; }
.panel-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.panel-header h3 { display: flex; align-items: center; gap: 8px; font-size: 16px; }
.panel-count, .stage-tag { font-size: 13px; color: var(--color-text-secondary); }
.stage-tag, .objection-tag { padding: 5px 10px; border-radius: 8px !important; background: rgba(245,158,11,.12); color: #d97706; }
.task-list { display: flex; flex-wrap: wrap; gap: 8px; }
.task-list span { padding: 6px 10px; border-radius: 8px !important; background: var(--color-bg); font-size: 13px; color: var(--color-text-secondary); }
.item-review-list { display: flex; flex-direction: column; gap: 12px; }
.item-review-card { padding: 14px; border: 1px solid var(--color-border); border-radius: 8px !important; background: var(--color-bg); }
.item-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
.item-head p { margin-top: 5px; color: var(--color-text-secondary); font-size: 12px; }
.objection-tag { max-width: 45%; font-size: 12px; line-height: 1.5; }
.item-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.item-fields label { display: flex; flex-direction: column; gap: 6px; color: var(--color-text-secondary); font-size: 12px; }
.item-fields select, .item-fields input { min-height: 38px; padding: 0 10px; border: 1px solid var(--color-border); border-radius: 8px !important; background: var(--color-surface); color: var(--color-text-primary); }
.template-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin: 12px 0 8px; color: var(--color-text-secondary); font-size: 12px; }
.template-row button { border: 1px solid var(--color-border); border-radius: 8px !important; background: var(--color-surface); color: var(--color-text-secondary); padding: 5px 10px; cursor: pointer; }
.level-row { padding: 14px; border-radius: 8px !important; background: var(--color-bg); margin-bottom: 14px; }
.level-row label { display: block; font-weight: var(--font-weight-semibold); margin-bottom: 10px; }
.level-options { display: flex; gap: 10px; flex-wrap: wrap; }
.level-options button { height: 34px; padding: 0 14px; border-radius: 8px !important; border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-primary); cursor: pointer; }
.level-options button.active { color: white; background: var(--gradient-primary); border: none; }
.level-tip { margin-top: 10px; color: var(--color-text-secondary); font-size: 12px; }
textarea { width: 100%; min-height: 86px; border: 1px solid var(--color-border); border-radius: 8px !important; background: var(--color-surface); color: var(--color-text-primary); padding: 12px; resize: vertical; }
.actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 14px; }
.actions button { display: inline-flex; align-items: center; gap: 6px; height: 38px; padding: 0 14px; border-radius: 8px !important; border: none; color: white; cursor: pointer; }
.actions button:disabled { opacity: .6; cursor: not-allowed; }
.btn-pass { background: #34a853; }
.btn-return { background: #f59e0b; }
.btn-reject { background: #ef4444; }
.empty-state { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 32px; color: var(--color-text-tertiary); }
.empty-state .v-icon { font-size: 40px; }
@media (max-width: 768px) { .page-header, .item-head { flex-direction: column; align-items: stretch; } .item-fields { grid-template-columns: 1fr; } .objection-tag { max-width: none; } }

/* 模块三局部圆角兜底：仅作用于当前模块三组件树，不影响顶部导航及其他模块。 */
:deep(*) {
  border-radius: 8px !important;
}

</style>
