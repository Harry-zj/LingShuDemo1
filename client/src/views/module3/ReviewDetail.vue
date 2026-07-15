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

    <AssessmentFormPanel v-if="reviewPreviewForm" :form="reviewPreviewForm" start-collapsed />

    <div class="item-review-groups" v-if="form && reviewableItems.length">
      <div class="review-groups-header">
        <div>
          <h3><VIcon icon="mdi:format-list-checks" />逐项评测</h3>
          <p>先查看 F1、F2、F3 概览，再展开需要核查的大项；修改内容在收起后仍会保留。</p>
        </div>
        <div class="review-header-actions">
          <span class="panel-count">共 {{ reviewableItems.length }} 项</span>
          <button type="button" class="btn-outline compact" @click="toggleAllReviewSections">
            <VIcon :icon="allReviewSectionsExpanded ? 'mdi:unfold-less-horizontal' : 'mdi:unfold-more-horizontal'" />
            {{ allReviewSectionsExpanded ? '收起全部' : '展开全部' }}
          </button>
        </div>
      </div>

      <div class="review-overview-grid">
        <button
          type="button"
          class="review-overview-card glass-card"
          :class="[`review-section-${group.key.toLowerCase()}`, { active: isReviewSectionExpanded(group.key), empty: !group.items.length, warning: reviewedGroupCount(group) < group.items.length }]"
          v-for="group in groupedReviewItems"
          :key="`review-overview-${group.key}`"
          :disabled="!group.items.length"
          :aria-expanded="isReviewSectionExpanded(group.key)"
          @click="toggleReviewSection(group.key)"
        >
          <div class="review-overview-top">
            <span class="section-review-code">{{ group.key }}</span>
            <span class="review-status" :class="{ warning: reviewedGroupCount(group) < group.items.length }">{{ groupReviewStatus(group) }}</span>
          </div>
          <h3>{{ group.shortTitle }}</h3>
          <p>{{ group.weight }}</p>
          <div class="review-overview-stats">
            <span><strong>{{ group.items.length }}</strong><small>待评项目</small></span>
            <span><strong>{{ reviewedGroupCount(group) }}</strong><small>已核查</small></span>
            <span><strong>{{ group.score }}</strong><small>/ {{ form.score_limits?.[group.key] ?? 100 }} 分</small></span>
          </div>
          <div class="review-progress">
            <span><i :style="{ width: `${groupReviewProgress(group)}%` }"></i></span>
            <small>{{ reviewActionSummary(group) }}</small>
          </div>
          <div class="review-overview-action">
            <span>{{ !group.items.length ? '当前无待评项目' : (isReviewSectionExpanded(group.key) ? '收起评价项' : '展开评价项') }}</span>
            <VIcon v-if="group.items.length" :icon="isReviewSectionExpanded(group.key) ? 'mdi:chevron-up' : 'mdi:chevron-down'" />
          </div>
        </button>
      </div>

      <div class="review-detail-list">
        <section
          class="item-review-box glass-card"
          :class="`review-section-${group.key.toLowerCase()}`"
          v-for="group in groupedReviewItems"
          v-show="group.items.length && isReviewSectionExpanded(group.key)"
          :key="`review-detail-${group.key}`"
        >
          <div class="panel-header section-review-header">
            <div class="section-review-title">
              <span class="section-review-code">{{ group.key }}</span>
              <div>
                <h3>{{ group.title }}</h3>
                <p>{{ group.weight }}</p>
              </div>
            </div>
            <div class="section-review-header-right">
              <div class="section-review-meta">
                <span>已核查 {{ reviewedGroupCount(group) }} / {{ group.items.length }} 项</span>
                <strong>{{ group.score }}</strong>
                <small>/ {{ form.score_limits?.[group.key] ?? 100 }}</small>
              </div>
              <button type="button" class="section-review-close" title="收起该大项" @click="toggleReviewSection(group.key)">
                <VIcon icon="mdi:chevron-up" />
              </button>
            </div>
          </div>
          <div class="item-review-list">
            <article class="item-review-card" :class="{ reviewed: isItemReviewed(item.id) }" v-for="item in group.items" :key="item.id">
              <div class="item-head">
                <div>
                  <strong>{{ item.title || '未命名加分项' }}</strong>
                  <p>{{ item.section }} / {{ item.subKey }} · 原分值 {{ item.score }} 分</p>
                </div>
                <div class="item-head-tags">
                  <button type="button" class="review-confirm-btn" :class="{ reviewed: isItemReviewed(item.id) }" @click="toggleItemReviewed(item.id)">
                    <VIcon :icon="isItemReviewed(item.id) ? 'mdi:check-circle' : 'mdi:check-circle-outline'" />
                    {{ isItemReviewed(item.id) ? '已核查' : '标记已核查' }}
                  </button>
                  <span v-if="item.objection" class="objection-tag">异议：{{ item.objection.reason }}</span>
                </div>
              </div>
              <div class="item-fields">
                <label>
                  <span>评测结论</span>
                  <select v-model="reviewDrafts[item.id].action" @change="markItemReviewed(item.id)">
                    <option value="approve">符合</option>
                    <option value="return">需修改</option>
                    <option value="reject">不符合</option>
                  </select>
                </label>
                <label>
                  <span>复核分值</span>
                  <input type="number" min="0" :max="reviewScoreMax(item)" step="0.1" v-model.number="reviewDrafts[item.id].score" @input="handleReviewScoreInput(item)" />
                  <small>本分类剩余上限 {{ reviewScoreMax(item) }} 分</small>
                </label>
              </div>
              <div class="template-row">
                <span>常用评价：</span>
                <button v-for="text in templates" :key="text" @click="useTemplate(item.id, text)">{{ text }}</button>
              </div>
              <textarea v-model="reviewDrafts[item.id].reason" placeholder="该项评测理由（选填）" @input="markItemReviewed(item.id)"></textarea>
            </article>
          </div>
        </section>
      </div>
    </div>

    <div class="review-box glass-card" v-if="form">
      <div class="panel-header">
        <h3><VIcon icon="mdi:clipboard-check-outline" />{{ currentRoleName }}总体评价</h3>
        <span class="panel-count">等级由实时总分自动计算：{{ draftLevel }}</span>
      </div>

      <div class="review-score-summary">
        <div><span>F1</span><strong>{{ draftScores.f1_basic_quality }}</strong></div>
        <div><span>F2</span><strong>{{ draftScores.f2_course_learning }}</strong></div>
        <div><span>F3</span><strong>{{ draftScores.f3_innovation_practice }}</strong></div>
        <div class="total"><span>综合总分</span><strong>{{ draftScores.total }}</strong><small>{{ draftLevel }}</small></div>
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
import { FORM_STRUCTURE, ROLE_LABEL } from '../../utils/constants';
import { calculateFormScores, calculateLevel, scoreLimitForItem } from '../../utils/scorePolicy';
import AssessmentFormPanel from './AssessmentFormPanel.vue';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const form = ref(null);
const comment = ref('');
const processing = ref(false);
const reviewDrafts = reactive({});
const reviewedItemIds = ref(new Set());
const expandedReviewSections = ref(new Set());

const REVIEW_SECTION_META = {
  F1: { shortTitle: '基本素质', weight: '占综合总分 10%' },
  F2: { shortTitle: '课程成绩', weight: '占综合总分 65%' },
  F3: { shortTitle: '创新实践', weight: '占综合总分 25%' },
};
const templates = ['材料不清楚', '材料错误', '不符合加分标准', '加分数量过多'];
const currentRoleName = computed(() => userStore.user?.is_assessment_member ? '评价小组' : (ROLE_LABEL[userStore.role] || '评价人员'));
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
const draftScores = computed(() => {
  const items = (form.value?.items || []).map(item => ({
    ...item,
    score: reviewDrafts[item.id]?.score ?? item.score ?? 0,
  }));
  return calculateFormScores(items, form.value?.score_limits);
});
const groupedReviewItems = computed(() => {
  const scoreKeyMap = {
    F1: 'f1_basic_quality',
    F2: 'f2_course_learning',
    F3: 'f3_innovation_practice',
  };
  return FORM_STRUCTURE.map(section => ({
    key: section.key,
    title: section.title,
    shortTitle: REVIEW_SECTION_META[section.key].shortTitle,
    weight: REVIEW_SECTION_META[section.key].weight,
    score: draftScores.value?.[scoreKeyMap[section.key]] ?? 0,
    items: reviewableItems.value.filter(item => item.section === section.key),
  }));
});
const nonEmptyReviewGroups = computed(() => groupedReviewItems.value.filter(group => group.items.length));
const allReviewSectionsExpanded = computed(() => nonEmptyReviewGroups.value.length > 0
  && nonEmptyReviewGroups.value.every(group => expandedReviewSections.value.has(group.key)));
const draftLevel = computed(() => calculateLevel(draftScores.value.total, form.value?.grade_rules));
const reviewPreviewForm = computed(() => {
  if (!form.value) return null;
  const items = (form.value.items || []).map(item => ({
    ...item,
    score: reviewDrafts[item.id]?.score ?? item.score ?? 0,
  }));
  return {
    ...form.value,
    items,
    scores: draftScores.value,
    level: draftLevel.value,
    auto_level: draftLevel.value,
  };
});

function initDrafts(data) {
  Object.keys(reviewDrafts).forEach(key => delete reviewDrafts[key]);
  const currentStage = data.review_stage || 'initial';
  const mine = (data.item_reviews || []).filter(review =>
    Number(review.reviewer_id) === Number(userStore.user?.id) && review.stage === currentStage
  );
  const reviewed = new Set();
  for (const item of data.items || []) {
    const old = mine.find(review => Number(review.item_id) === Number(item.id));
    reviewDrafts[item.id] = {
      action: old?.action || 'approve',
      reason: old?.reason || '',
      score: Number(old?.reviewed_score ?? item.score ?? 0),
    };
    if (old) reviewed.add(Number(item.id));
  }
  reviewedItemIds.value = reviewed;
}

function initializeReviewExpansion() {
  const first = FORM_STRUCTURE.find(section => reviewableItems.value.some(item => item.section === section.key));
  expandedReviewSections.value = new Set(first ? [first.key] : []);
}

function isReviewSectionExpanded(sectionKey) {
  return expandedReviewSections.value.has(sectionKey);
}

function toggleReviewSection(sectionKey) {
  const group = groupedReviewItems.value.find(current => current.key === sectionKey);
  if (!group?.items.length) return;
  const next = new Set(expandedReviewSections.value);
  if (next.has(sectionKey)) next.delete(sectionKey);
  else next.add(sectionKey);
  expandedReviewSections.value = next;
}

function toggleAllReviewSections() {
  expandedReviewSections.value = allReviewSectionsExpanded.value
    ? new Set()
    : new Set(nonEmptyReviewGroups.value.map(group => group.key));
}

function isItemReviewed(itemId) {
  return reviewedItemIds.value.has(Number(itemId));
}

function markItemReviewed(itemId) {
  const next = new Set(reviewedItemIds.value);
  next.add(Number(itemId));
  reviewedItemIds.value = next;
}

function toggleItemReviewed(itemId) {
  const next = new Set(reviewedItemIds.value);
  const id = Number(itemId);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  reviewedItemIds.value = next;
}

function reviewedGroupCount(group) {
  return group.items.filter(item => isItemReviewed(item.id)).length;
}

function groupReviewProgress(group) {
  if (!group.items.length) return 0;
  return Math.round((reviewedGroupCount(group) / group.items.length) * 100);
}

function groupReviewStatus(group) {
  if (!group.items.length) return '暂无待评项目';
  const remaining = group.items.length - reviewedGroupCount(group);
  return remaining > 0 ? `待核查 ${remaining} 项` : '本组已核查';
}

function reviewActionSummary(group) {
  if (!group.items.length) return '无需评价';
  const reviewedItems = group.items.filter(item => isItemReviewed(item.id));
  if (!reviewedItems.length) return `尚有 ${group.items.length} 项未核查`;
  const counts = reviewedItems.reduce((result, item) => {
    const action = reviewDrafts[item.id]?.action || 'approve';
    result[action] = (result[action] || 0) + 1;
    return result;
  }, {});
  const remaining = group.items.length - reviewedItems.length;
  const result = `符合 ${counts.approve || 0} · 需修改 ${counts.return || 0} · 不符合 ${counts.reject || 0}`;
  return remaining ? `${result} · 未核查 ${remaining}` : result;
}

function useTemplate(itemId, text) {
  const draft = reviewDrafts[itemId];
  if (!draft) return;
  draft.reason = draft.reason ? `${draft.reason}；${text}` : text;
  markItemReviewed(itemId);
}

function reviewScoreMax(item) {
  const groupLimit = scoreLimitForItem(item.section, item.subKey, form.value?.score_limits);
  const otherTotal = (form.value?.items || [])
    .filter(current => Number(current.id) !== Number(item.id) && current.section === item.section && current.subKey === item.subKey)
    .reduce((sum, current) => sum + Math.max(Number(reviewDrafts[current.id]?.score ?? current.score ?? 0), 0), 0);
  return Number(Math.max(groupLimit - otherTotal, 0).toFixed(2));
}

function handleReviewScoreInput(item) {
  clampReviewScore(item);
  markItemReviewed(item.id);
}

function clampReviewScore(item) {
  const draft = reviewDrafts[item.id];
  if (!draft) return;
  const max = reviewScoreMax(item);
  const value = Number(draft.score || 0);
  draft.score = Number(Math.min(Math.max(Number.isFinite(value) ? value : 0, 0), max).toFixed(2));
}

async function load(id = route.params.id) {
  form.value = null;
  comment.value = '';
  const res = await getFormDetail(id);
  if (res.code === 200) {
    form.value = res.data;
    initDrafts(res.data);
    initializeReviewExpansion();
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
.item-review-groups { display: flex; flex-direction: column; gap: 16px; }
.review-groups-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; padding: 0 2px; }
.review-groups-header h3 { display: flex; align-items: center; gap: 8px; font-size: 17px; }
.review-groups-header p { margin-top: 5px; color: var(--color-text-secondary); font-size: 13px; line-height: 1.6; }
.review-header-actions { display: flex; align-items: center; gap: 10px; }
.btn-outline.compact { height: 34px; padding: 0 11px; font-size: 12px; }
.review-overview-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.review-overview-card { --section-accent: var(--color-primary); display: flex; flex-direction: column; min-width: 0; padding: 18px; overflow: hidden; border: 1px solid var(--color-border); border-top: 3px solid var(--section-accent); color: var(--color-text-primary); text-align: left; cursor: pointer; transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease; }
.review-overview-card.review-section-f1 { --section-accent: #2563eb; }
.review-overview-card.review-section-f2 { --section-accent: #059669; }
.review-overview-card.review-section-f3 { --section-accent: #d97706; }
.review-overview-card:hover:not(:disabled) { transform: translateY(-2px); border-color: color-mix(in srgb, var(--section-accent) 40%, var(--color-border)); box-shadow: 0 10px 24px rgba(15, 23, 42, .08); }
.review-overview-card.active { border-color: color-mix(in srgb, var(--section-accent) 58%, var(--color-border)); box-shadow: 0 0 0 2px color-mix(in srgb, var(--section-accent) 12%, transparent); }
.review-overview-card.empty { opacity: .58; cursor: default; }
.review-overview-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.review-status { max-width: 62%; padding: 4px 8px; border-radius: 999px !important; background: color-mix(in srgb, var(--section-accent) 10%, var(--color-bg)); color: var(--section-accent); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.review-status.warning { background: rgba(245, 158, 11, .12); color: #b45309; }
.review-overview-card > h3 { margin-top: 14px; font-size: 18px; }
.review-overview-card > p { margin-top: 4px; color: var(--color-text-secondary); font-size: 12px; }
.review-overview-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; padding: 12px 0; margin-top: 14px; border-top: 1px solid var(--color-border); border-bottom: 1px solid var(--color-border); }
.review-overview-stats span { display: flex; flex-direction: column; min-width: 0; }
.review-overview-stats strong { color: var(--section-accent); font-size: 18px; line-height: 1.2; }
.review-overview-stats small { margin-top: 3px; color: var(--color-text-tertiary); font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.review-progress { display: grid; gap: 6px; margin-top: 12px; }
.review-progress > span { height: 5px; overflow: hidden; border-radius: 999px !important; background: var(--color-bg); }
.review-progress i { display: block; height: 100%; border-radius: inherit !important; background: var(--section-accent); transition: width .2s ease; }
.review-progress small { color: var(--color-text-secondary); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.review-overview-action { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: auto; padding-top: 12px; color: var(--section-accent); font-size: 12px; font-weight: 600; }
.review-detail-list { display: flex; flex-direction: column; gap: 16px; }
.item-review-box { --section-accent: var(--color-primary); overflow: hidden; border-top: 3px solid var(--section-accent); }
.item-review-box.review-section-f1 { --section-accent: #2563eb; }
.item-review-box.review-section-f2 { --section-accent: #059669; }
.item-review-box.review-section-f3 { --section-accent: #d97706; }
.panel-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.panel-header h3 { display: flex; align-items: center; gap: 8px; font-size: 16px; }
.panel-count, .stage-tag { font-size: 13px; color: var(--color-text-secondary); }
.section-review-header { padding-bottom: 16px; border-bottom: 1px solid var(--color-border); }
.section-review-title { display: flex; align-items: center; gap: 12px; min-width: 0; }
.section-review-code { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 8px !important; background: color-mix(in srgb, var(--section-accent) 12%, var(--color-surface)); color: var(--section-accent); font-weight: 800; letter-spacing: .04em; flex: 0 0 auto; }
.section-review-title h3 { font-size: 18px; line-height: 1.4; }
.section-review-title p { margin-top: 3px; color: var(--color-text-secondary); font-size: 13px; }
.section-review-meta { display: grid; grid-template-columns: auto auto auto; align-items: baseline; gap: 4px; color: var(--color-text-secondary); font-size: 12px; }
.section-review-meta span { grid-column: 1 / -1; text-align: right; }
.section-review-meta strong { color: var(--section-accent); font-size: 22px; }
.section-review-meta small { color: var(--color-text-tertiary); }
.section-review-header-right { display: flex; align-items: center; gap: 12px; }
.section-review-close { display: inline-grid; place-items: center; width: 34px; height: 34px; padding: 0; border: 1px solid var(--color-border); border-radius: 8px !important; background: var(--color-surface); color: var(--color-text-secondary); cursor: pointer; }
.section-review-close:hover { color: var(--section-accent); border-color: color-mix(in srgb, var(--section-accent) 45%, var(--color-border)); }
.stage-tag, .objection-tag { padding: 5px 10px; border-radius: 8px !important; background: rgba(245,158,11,.12); color: #d97706; }
.task-list { display: flex; flex-wrap: wrap; gap: 8px; }
.task-list span { padding: 6px 10px; border-radius: 8px !important; background: var(--color-bg); font-size: 13px; color: var(--color-text-secondary); }
.item-review-list { display: flex; flex-direction: column; gap: 12px; }
.item-review-card { padding: 14px; border: 1px solid var(--color-border); border-radius: 8px !important; background: var(--color-bg); }
.item-review-card.reviewed { border-color: color-mix(in srgb, var(--section-accent) 35%, var(--color-border)); }
.item-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
.item-head p { margin-top: 5px; color: var(--color-text-secondary); font-size: 12px; }
.item-head-tags { display: flex; align-items: flex-end; flex-direction: column; gap: 6px; }
.review-confirm-btn { display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border: 1px solid var(--color-border); border-radius: 999px !important; background: var(--color-surface); color: var(--color-text-secondary); font-size: 11px; cursor: pointer; }
.review-confirm-btn:hover { color: var(--section-accent); border-color: color-mix(in srgb, var(--section-accent) 40%, var(--color-border)); }
.review-confirm-btn.reviewed { border-color: rgba(52, 168, 83, .28); background: rgba(52, 168, 83, .12); color: #218739; }
.objection-tag { max-width: 360px; font-size: 12px; line-height: 1.5; }
.item-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.item-fields label { display: flex; flex-direction: column; gap: 6px; color: var(--color-text-secondary); font-size: 12px; }
.item-fields select, .item-fields input { min-height: 38px; padding: 0 10px; border: 1px solid var(--color-border); border-radius: 8px !important; background: var(--color-surface); color: var(--color-text-primary); }
.item-fields small { color: var(--color-text-tertiary); line-height: 1.4; }
.template-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin: 12px 0 8px; color: var(--color-text-secondary); font-size: 12px; }
.template-row button { border: 1px solid var(--color-border); border-radius: 8px !important; background: var(--color-surface); color: var(--color-text-secondary); padding: 5px 10px; cursor: pointer; }
.review-score-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 14px; }
.review-score-summary > div { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; padding: 12px; background: var(--color-bg); }
.review-score-summary span { color: var(--color-text-secondary); font-size: 12px; }
.review-score-summary strong { color: var(--color-primary); font-size: 22px; }
.review-score-summary small { color: var(--color-text-tertiary); }
.review-score-summary .total { background: color-mix(in srgb, var(--color-primary) 8%, var(--color-bg)); }
textarea { width: 100%; min-height: 86px; border: 1px solid var(--color-border); border-radius: 8px !important; background: var(--color-surface); color: var(--color-text-primary); padding: 12px; resize: vertical; }
.actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 14px; }
.actions button { display: inline-flex; align-items: center; gap: 6px; height: 38px; padding: 0 14px; border-radius: 8px !important; border: none; color: white; cursor: pointer; }
.actions button:disabled { opacity: .6; cursor: not-allowed; }
.btn-pass { background: #34a853; }
.btn-return { background: #f59e0b; }
.btn-reject { background: #ef4444; }
.empty-state { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 32px; color: var(--color-text-tertiary); }
.empty-state .v-icon { font-size: 40px; }
@media (max-width: 960px) { .review-overview-grid { grid-template-columns: 1fr; } }
@media (max-width: 768px) { .page-header, .item-head, .review-groups-header, .section-review-header { flex-direction: column; align-items: stretch; } .review-header-actions, .section-review-header-right { align-items: stretch; justify-content: space-between; } .item-fields, .review-score-summary { grid-template-columns: 1fr; } .item-head-tags { align-items: flex-start; } .objection-tag { max-width: none; } .section-review-meta { align-self: flex-start; } .section-review-meta span { text-align: left; } }

/* 模块三局部圆角兜底：仅作用于当前模块三组件树，不影响顶部导航及其他模块。 */
:deep(*) {
  border-radius: 8px !important;
}

</style>
