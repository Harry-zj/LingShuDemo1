<template>
  <div class="student-db">
    <div class="page-header">
      <h2>综测信息管理</h2>
      <p class="page-desc">请先选择综测批次，再查看、保存和提交本批次综测表</p>
    </div>

    <div class="batch-panel glass-card">
      <div class="panel-header">
        <h3><VIcon icon="mdi:calendar-check-outline" />选择综测批次</h3>
        <span class="panel-count">按时间从新到旧排序</span>
      </div>
      <div class="batch-list" v-if="studentBatches.length">
        <button
          v-for="batch in studentBatches"
          :key="batch.id"
          class="batch-card"
          :class="{ active: selectedBatchId === batch.id }"
          @click="selectBatch(batch)"
        >
          <strong>{{ batch.title }}</strong>
          <span>{{ batch.college }} · {{ batch.grade }} · {{ statusText(batch.status) }}</span>
          <small>{{ batch.start_time }} 至 {{ batch.end_time }}</small>
        </button>
      </div>
      <div class="empty-line" v-else>当前没有与你的学院、年级匹配的综测批次。</div>
    </div>

    <div class="student-card glass-card" v-if="userStore.user">
      <div class="panel-header">
        <h3><VIcon icon="mdi:card-account-details-outline" />学生基础信息</h3>
      </div>
      <div class="info-grid">
        <span>学号：{{ userStore.user.student_no || '-' }}</span>
        <span>姓名：{{ userStore.user.real_name || '-' }}</span>
        <span>学院：{{ userStore.user.college || '-' }}</span>
        <span>班级：{{ userStore.user.class_name || '-' }}</span>
        <span>年级：{{ userStore.user.enrollment_grade || userStore.user.grade || '-' }}</span>
      </div>
    </div>

    <div class="deadline-card" v-if="form">
      <VIcon icon="mdi:clipboard-check-outline" class="deadline-icon" />
      <div class="deadline-info">
        <span class="deadline-label">当前批次 / 当前状态</span>
        <span class="deadline-value">{{ form.batch_title }} · {{ form.status_label }}</span>
        <span class="deadline-desc" v-if="form.readonly_reason">{{ form.readonly_reason }}</span>
      </div>
    </div>

    <div class="edit-status glass-card" v-if="form">
      <div>
        <h3>{{ canEdit ? '学生端可编辑' : '当前只读' }}</h3>
        <p v-if="canEdit">你可以逐项修改综测内容。保存只保存草稿，确认提交后才会进入跨班综测成员评价。</p>
        <p v-else>{{ form.readonly_reason || '当前流程状态暂不允许学生端修改。' }}</p>
      </div>
    </div>

    <AssessmentFormPanel v-if="form" :form="form" :editable="canEdit" />

    <div class="save-panel glass-card" v-if="form">
      <div>
        <h3>保存修改</h3>
        <p v-if="canEdit">保存只会更新当前批次综测表内容，不会提交给评测人。</p>
        <p v-else>{{ form.readonly_reason || '当前状态不可保存修改。' }}</p>
      </div>
      <button class="btn-outline" :disabled="!canEdit || saving || submitting" @click="saveEdit">
        <VIcon icon="mdi:content-save-outline" />{{ saving ? '保存中...' : '保存修改' }}
      </button>
    </div>

    <div class="submit-panel glass-card" v-if="form">
      <div>
        <h3>确认提交</h3>
        <p v-if="canSubmit">提交后系统会按批次配置，将本班综测表分配给其他班级综测成员。</p>
        <p v-else>{{ form.readonly_reason || '当前状态不可提交。' }}</p>
      </div>
      <button class="btn-primary" :disabled="!canSubmit || saving || submitting" @click="submit">
        <VIcon icon="mdi:send-outline" />{{ submitting ? '提交中...' : '确认提交' }}
      </button>
    </div>

    <div class="my-materials glass-card" v-if="form">
      <div class="panel-header">
        <h3><VIcon icon="mdi:history" />评价记录</h3>
        <span class="panel-count">{{ form.review_records.length }} 条</span>
      </div>
      <div class="material-list">
        <div class="material-row" v-for="record in form.review_records" :key="record.id">
          <div class="row-left">
            <VIcon icon="mdi:account-check-outline" class="row-icon" />
            <div>
              <span>{{ record.reviewer_name }}：{{ record.action_label }}（{{ record.level || form.level }}）</span>
              <p class="row-desc">{{ record.comment || '无评价意见' }}</p>
            </div>
          </div>
          <span class="status-tag">{{ record.created_at }}</span>
        </div>
        <div class="empty-state" v-if="!form.review_records.length">
          <VIcon icon="mdi:inbox-outline" />
          <span>暂无评价记录</span>
        </div>
      </div>
    </div>

    <div class="empty-state" v-if="selectedBatchId && !form && !loading">
      <VIcon icon="mdi:inbox-outline" />
      <span>暂无智能填表结果</span>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { getSmartResult, submitSmartResult, updateSmartResult } from '../../api/module1';
import { getStudentBatches } from '../../api/module3';
import { useUserStore } from '../../stores/user';
import AssessmentFormPanel from './AssessmentFormPanel.vue';

const userStore = useUserStore();
const studentBatches = ref([]);
const selectedBatchId = ref('');
const form = ref(null);
const saving = ref(false);
const submitting = ref(false);
const loading = ref(false);

const canEdit = computed(() => !!form.value?.can_student_edit);
const canSubmit = computed(() => !!form.value?.can_student_submit);

function statusText(status) {
  return ({ draft: '草稿', published: '已发布', closed: '已关闭', archived: '已归档' }[status] || status);
}

async function loadBatches() {
  const res = await getStudentBatches();
  if (res.code === 200) studentBatches.value = res.data || [];
  else alert(res.msg || '加载批次失败');
}

async function selectBatch(batch) {
  selectedBatchId.value = batch.id;
  form.value = null;
  await loadForm();
}

async function loadForm() {
  if (!selectedBatchId.value) return;
  loading.value = true;
  try {
    const res = await getSmartResult({ batch_id: selectedBatchId.value });
    if (res.code === 200) form.value = res.data;
    else alert(res.msg || '加载综测表失败');
  } catch (e) {
    alert(e?.message || '加载综测表失败');
  } finally {
    loading.value = false;
  }
}

function normalizeItem(item) {
  return {
    id: item.id,
    title: item.title || '',
    reason: item.reason || '',
    score: Number(item.score) || 0,
    section: item.section,
    subKey: item.subKey,
    evidence_ids: Array.isArray(item.evidence_ids)
      ? item.evidence_ids
      : (item.evidence_files || []).map(file => file.id).filter(Boolean),
    editable: item.editable !== false,
  };
}

async function saveEdit(options = {}) {
  const { silent = false } = options;
  if (!form.value) return false;
  if (!canEdit.value) {
    alert(form.value.readonly_reason || '当前状态不可修改');
    return false;
  }

  saving.value = true;
  try {
    const res = await updateSmartResult({
      batch_id: selectedBatchId.value,
      personal_summary: form.value.personal_summary || '',
      items: (form.value.items || []).map(normalizeItem)
    });
    if (res.code === 200) {
      form.value = res.data;
      if (!silent) alert('修改已保存');
      return true;
    }
    alert(res.msg || '保存失败');
    return false;
  } catch (e) {
    alert(e?.message || '保存失败');
    return false;
  } finally {
    saving.value = false;
  }
}

async function submit() {
  if (!canSubmit.value) {
    alert(form.value?.readonly_reason || '当前状态不可提交');
    return;
  }
  const ok = window.confirm('确认提交前请先保存修改。提交后将进入跨班综测成员评价，是否继续？');
  if (!ok) return;

  submitting.value = true;
  try {
    const res = await submitSmartResult({ batch_id: selectedBatchId.value });
    if (res.code === 200) {
      form.value = res.data;
      alert('已提交并分配给跨班综测成员评价');
    } else {
      alert(res.msg || '提交失败');
    }
  } catch (e) {
    alert(e?.message || '提交失败');
  } finally {
    submitting.value = false;
  }
}

onMounted(loadBatches);
</script>

<style scoped>
.student-db { display: flex; flex-direction: column; gap: 24px; animation: fadeIn 0.4s var(--easing-decelerate); }
.page-header h2 { font-size: 22px; font-weight: var(--font-weight-semibold); }
.page-desc { font-size: 14px; color: var(--color-text-secondary); margin-top: 2px; }
.batch-panel, .student-card, .edit-status, .save-panel, .submit-panel, .my-materials { padding: 20px; border-radius: var(--radius-xl); }
.panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.panel-header h3 { display: flex; align-items: center; gap: 8px; font-size: 16px; }
.panel-count { font-size: 13px; color: var(--color-text-secondary); }
.batch-list { display: flex; flex-direction: column; gap: 12px; }
.batch-card { text-align: left; display: flex; flex-direction: column; gap: 6px; padding: 14px; border: 1px solid var(--color-border); border-radius: var(--radius-lg); background: var(--color-bg); color: var(--color-text-primary); cursor: pointer; transition: all var(--duration-fast) var(--easing-standard); }
.batch-card span, .batch-card small { color: var(--color-text-secondary); }
.batch-card.active { border-color: var(--color-primary); background: rgba(99,102,241,0.08); box-shadow: 0 0 0 3px rgba(99,102,241,0.08); }
.info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.info-grid span { padding: 9px 10px; border-radius: var(--radius-md); background: var(--color-bg); font-size: 13px; }
.deadline-card { display: flex; align-items: center; gap: 16px; padding: 20px; background: var(--gradient-primary); border-radius: var(--radius-xl); color: white; }
.deadline-icon { font-size: 32px; opacity: 0.9; }
.deadline-info { display: flex; flex-direction: column; }
.deadline-label { font-size: 13px; opacity: 0.8; }
.deadline-value { font-size: 22px; font-weight: var(--font-weight-semibold); }
.deadline-desc { margin-top: 4px; font-size: 13px; opacity: 0.86; }
.edit-status h3, .save-panel h3, .submit-panel h3 { font-size: 16px; margin-bottom: 6px; }
.edit-status p, .save-panel p, .submit-panel p { color: var(--color-text-secondary); font-size: 13px; line-height: 1.6; }
.save-panel, .submit-panel { display: flex; justify-content: space-between; gap: 16px; align-items: center; }
.btn-outline, .btn-primary { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 40px; padding: 0 16px; border-radius: var(--radius-full); cursor: pointer; white-space: nowrap; }
.btn-outline { border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-primary); }
.btn-primary { border: none; background: var(--gradient-primary); color: white; visibility: visible; opacity: 1; }
.btn-outline:disabled, .btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }
.material-list { display: flex; flex-direction: column; gap: 10px; }
.material-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; padding: 14px; border-radius: var(--radius-lg); background: var(--color-bg); }
.row-left { display: flex; align-items: flex-start; gap: 12px; }
.row-icon { font-size: 22px; color: var(--color-primary); }
.row-desc { margin-top: 4px; font-size: 12px; color: var(--color-text-secondary); line-height: 1.5; }
.status-tag { padding: 4px 10px; border-radius: var(--radius-full); font-size: 12px; white-space: nowrap; }
.empty-state, .empty-line { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 32px; color: var(--color-text-tertiary); }
.empty-state .v-icon { font-size: 40px; }
@media (max-width: 768px) {
  .info-grid { grid-template-columns: 1fr; }
  .save-panel, .submit-panel { flex-direction: column; align-items: stretch; }
}
</style>
