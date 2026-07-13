<template>
  <div class="student-db">
    <button class="back-link" @click="backToBatchList">
      <VIcon icon="mdi:arrow-left" />返回批次选择
    </button>

    <div class="page-header">
      <span class="eyebrow">学生综测工作台 / {{ pageMeta.shortTitle }}</span>
      <h2>{{ pageMeta.title }}</h2>
      <p class="page-desc">{{ pageMeta.description }}</p>
    </div>

    <div class="profile-warning glass-card" v-if="!profileComplete">
      <VIcon icon="mdi:alert-circle-outline" />
      <div>
        <h3>请先完善个人信息</h3>
        <p>缺少：{{ missingFields.join('、') }}。资料完整后才能查看当前批次详情。</p>
        <router-link class="btn-primary small" to="/module3/profile/basic">去个人中心完善</router-link>
      </div>
    </div>

    <template v-else>
      <section class="detail-overview" v-if="selectedBatch || form">
        <div class="overview-main">
          <span class="eyebrow">当前批次</span>
          <div class="overview-title-row">
            <h3>{{ form?.batch_title || selectedBatch?.title }}</h3>
            <span class="status-chip" v-if="form">{{ form.status_label }}</span>
            <span class="status-chip muted" v-else-if="selectedBatch">{{ statusText(selectedBatch.status) }}</span>
            <span class="status-chip readonly" v-if="viewMode === 'form' && form && !canEdit">只读</span>
          </div>
          <p class="overview-meta" v-if="selectedBatch">{{ selectedBatch.college }} · {{ selectedBatch.grade }}</p>
          <p class="overview-note" v-if="viewMode === 'form' && form">
            {{ canEdit ? '可逐项修改内容；保存仅更新草稿，确认提交后进入评价流程。' : (form.readonly_reason || '当前流程状态暂不允许学生端修改。') }}
          </p>
        </div>
        <div class="overview-actions">
          <button class="btn-outline" @click="backToBatchList">
            <VIcon icon="mdi:swap-horizontal" />更换批次
          </button>
        </div>
      </section>

      <template v-if="viewMode === 'form' && form">
        <AssessmentFormPanel :form="form" :editable="canEdit" :show-student-info="false" />

        <div class="form-actions">
          <div class="action-help">
            <strong>{{ canEdit ? '完成填写后可保存草稿或直接确认提交' : '当前表单为只读状态' }}</strong>
            <span>{{ canEdit ? '确认提交时会先保存当前内容和支撑材料，再自动分配给跨班评价小组成员。' : (form.readonly_reason || '当前状态不可保存或提交。') }}</span>
          </div>
          <div class="action-buttons">
            <button class="btn-outline" :disabled="!canEdit || saving || submitting" @click="saveEdit">
              <VIcon icon="mdi:content-save-outline" />{{ saving ? '保存中...' : '保存修改' }}
            </button>
            <button class="btn-primary" :disabled="!canSubmit || saving || submitting" @click="submit">
              <VIcon icon="mdi:send-outline" />{{ submitting ? '提交中...' : '确认提交' }}
            </button>
          </div>
        </div>
      </template>

      <template v-if="viewMode === 'result' && form">
        <div class="result-notice glass-card" v-if="form.result_released">
          <VIcon :icon="form.status === 'pending_objection_review' ? 'mdi:message-alert-outline' : 'mdi:bell-check-outline'" />
          <div>
            <h3>{{ form.status === 'pending_objection_review' ? '异议复评处理中' : '本批次评测已完成' }}</h3>
            <p>{{ form.result_notice }}</p>
            <small v-if="form.objection_deadline">异议截止时间：{{ formatDateTime(form.objection_deadline) }}</small>
          </div>
        </div>

        <div class="result-waiting glass-card" v-else>
          <VIcon icon="mdi:progress-clock" />
          <div>
            <h3>结果尚未释放</h3>
            <p>当前状态为“{{ form.status_label }}”。完成本批次最后一个评价环节后，结果和异议入口会在这里显示。</p>
          </div>
        </div>

        <AssessmentFormPanel
          v-if="form.result_released"
          :form="form"
          :editable="false"
          :objection-mode="true"
          :can-raise-objection="form.can_raise_objection"
          :objection-submitted="form.objection_submitted"
          :objection-selections="objectionSelections"
          :objection-reasons="objectionReasons"
          @update-objection-selection="updateObjectionSelection"
          @update-objection-reason="updateObjectionReason"
        />

        <section class="objection-submit-panel glass-card" v-if="form.result_released">
          <template v-if="form.objection_submitted">
            <div>
              <h3><VIcon icon="mdi:check-circle-outline" />异议申请已提交</h3>
              <p>本综测表只允许统一提交一次异议，不能追加、修改或再次提交。请等待原评价小组成员完成复评。</p>
            </div>
          </template>
          <template v-else-if="form.can_raise_objection">
            <div>
              <h3><VIcon icon="mdi:comment-check-outline" />统一提交异议</h3>
              <p>已标记 {{ selectedObjectionCount }} 项。请确认每个已标记项目都填写了理由，再一次性提交。</p>
            </div>
            <button class="btn-primary" :disabled="submittingObjection || !selectedObjectionCount" @click="submitAllObjections">
              <VIcon icon="mdi:send-check-outline" />{{ submittingObjection ? '提交中...' : '统一提交异议' }}
            </button>
          </template>
          <template v-else>
            <div>
              <h3><VIcon icon="mdi:clock-alert-outline" />当前不能提交异议</h3>
              <p>可能尚未到结果发布阶段、异议期限已经结束，或本综测表已提交过异议申请。</p>
            </div>
          </template>
        </section>

        <div class="my-materials glass-card" v-if="form.result_released">
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
      </template>

      <div class="empty-state glass-card" v-if="!form && !loading">
        <VIcon icon="mdi:inbox-outline" />
        <span>{{ formLoadMessage }}</span>
        <div class="empty-actions">
          <router-link v-if="viewMode === 'form'" class="btn-primary empty-link" to="/zongce/smart-fill">前往智能填表</router-link>
          <button class="btn-outline" @click="backToBatchList">返回选择其他批次</button>
        </div>
      </div>

      <div class="loading-card glass-card" v-if="loading">
        <VIcon icon="mdi:loading" class="spin" />正在加载当前批次详情...
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getStudentBatches, getStudentForm, submitObjection, submitStudentForm, updateStudentForm } from '../../api/module3';
import { useUserStore } from '../../stores/user';
import AssessmentFormPanel from './AssessmentFormPanel.vue';

const props = defineProps({
  view: { type: String, default: 'form' },
});

const userStore = useUserStore();
const route = useRoute();
const router = useRouter();
const batches = ref([]);
const form = ref(null);
const formLoadMessage = ref('当前批次暂无综测表');
const saving = ref(false);
const submitting = ref(false);
const loading = ref(false);
const submittingObjection = ref(false);
const objectionSelections = reactive({});
const objectionReasons = reactive({});

const batchId = computed(() => Number(route.params.batchId || 0));
const viewMode = computed(() => props.view === 'result' ? 'result' : 'form');
const selectedBatch = computed(() => batches.value.find(batch => Number(batch.id) === batchId.value) || null);
const canEdit = computed(() => !!form.value?.can_student_edit);
const canSubmit = computed(() => !!form.value?.can_student_submit);
const missingFields = computed(() => userStore.user?.profile_missing_fields || []);
const profileComplete = computed(() => userStore.user?.profile_complete !== false);
const selectedObjectionIds = computed(() => Object.keys(objectionSelections).filter(id => objectionSelections[id]).map(Number));
const selectedObjectionCount = computed(() => selectedObjectionIds.value.length);
const pageMeta = computed(() => viewMode.value === 'result'
  ? { shortTitle: '结果详情', title: '综测结果与异议详情', description: '查看当前批次结果，在分类支撑材料中标记异议项目并统一提交。' }
  : { shortTitle: '填写详情', title: '综测信息填写详情', description: '预览智能填表生成的 Word 综测表，并核对、保存和提交数据库明细。' });

function statusText(status) {
  return ({ draft: '草稿', published: '已发布', closed: '已关闭', archived: '已归档' }[status] || status);
}

function clearObjectionDraft() {
  Object.keys(objectionSelections).forEach(key => delete objectionSelections[key]);
  Object.keys(objectionReasons).forEach(key => delete objectionReasons[key]);
}

function backToBatchList() {
  router.push(viewMode.value === 'result' ? '/module3/student/results' : '/module3/student/forms');
}

async function loadDetail() {
  clearObjectionDraft();
  form.value = null;
  if (!profileComplete.value || !batchId.value) {
    formLoadMessage.value = '批次参数无效';
    return;
  }

  loading.value = true;
  formLoadMessage.value = viewMode.value === 'result' ? '当前批次还没有可以查看的综测结果' : '当前批次暂无综测表';
  try {
    const batchRes = await getStudentBatches();
    if (batchRes.code === 200) batches.value = batchRes.data || [];
    if (!selectedBatch.value) {
      formLoadMessage.value = '所选批次不存在、已删除或不在你的学院年级范围内';
      return;
    }

    const res = await getStudentForm(batchId.value);
    if (res.code === 200) {
      form.value = res.data;
      if (!form.value) {
        formLoadMessage.value = '当前批次尚未关联智能填表结果。请先在智能填表中生成 Word 文档，再返回本页。';
      }
    } else formLoadMessage.value = res.msg || formLoadMessage.value;
  } catch (error) {
    formLoadMessage.value = error?.response?.data?.msg || error?.message || formLoadMessage.value;
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
    const res = await updateStudentForm(batchId.value, {
      personal_summary: form.value.personal_summary || '',
      items: (form.value.items || []).map(normalizeItem),
    });
    if (res.code === 200) {
      form.value = res.data;
      if (!silent) alert('修改已保存');
      return true;
    }
    alert(res.msg || '保存失败');
    return false;
  } catch (error) {
    alert(error?.message || '保存失败');
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
  const ok = window.confirm('确认提交当前综测表吗？系统会先保存当前内容和支撑材料，再进入跨班评价小组评价。');
  if (!ok) return;

  const saved = await saveEdit({ silent: true });
  if (!saved) return;

  submitting.value = true;
  try {
    const res = await submitStudentForm(batchId.value);
    if (res.code === 200) {
      form.value = res.data;
      alert('已提交并分配给跨班评价小组成员');
    } else alert(res.msg || '提交失败');
  } catch (error) {
    alert(error?.message || '提交失败');
  } finally {
    submitting.value = false;
  }
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
}

function updateObjectionSelection({ itemId, selected }) {
  if (selected) objectionSelections[itemId] = true;
  else {
    delete objectionSelections[itemId];
    delete objectionReasons[itemId];
  }
}

function updateObjectionReason({ itemId, reason }) {
  objectionReasons[itemId] = reason;
}

async function submitAllObjections() {
  if (!form.value?.can_raise_objection || form.value?.objection_submitted) {
    alert('当前综测表不能再次提交异议');
    return;
  }
  const ids = selectedObjectionIds.value;
  if (!ids.length) return alert('请至少标记一个有异议的项目');

  const missing = ids.filter(id => !String(objectionReasons[id] || '').trim());
  if (missing.length) return alert(`还有 ${missing.length} 个已标记项目未填写异议理由`);

  const ok = window.confirm(`本次共对 ${ids.length} 个项目提出异议。异议只能统一提交一次，提交后不能追加或修改，是否确认？`);
  if (!ok) return;

  submittingObjection.value = true;
  try {
    const res = await submitObjection(form.value.id, {
      items: ids.map(itemId => ({ item_id: itemId, reason: String(objectionReasons[itemId]).trim() })),
    });
    if (res.code === 200) {
      form.value = res.data;
      clearObjectionDraft();
      alert('异议申请已统一提交，等待原评价小组成员复评');
    } else alert(res.msg || '异议提交失败');
  } catch (error) {
    alert(error?.response?.data?.msg || error?.message || '异议提交失败');
  } finally {
    submittingObjection.value = false;
  }
}

watch(() => [route.params.batchId, props.view], loadDetail);
onMounted(loadDetail);
</script>

<style scoped>
.student-db { display: flex; flex-direction: column; gap: 24px; animation: fadeIn 0.4s var(--easing-decelerate); }
.back-link { display: inline-flex; align-items: center; gap: 6px; width: fit-content; border: 0; padding: 0; background: transparent; color: var(--color-primary); cursor: pointer; }
.eyebrow { display: inline-block; margin-bottom: 5px; color: var(--color-text-tertiary); font-size: 12px; }
.page-header h2 { font-size: 22px; font-weight: var(--font-weight-semibold); }
.page-desc { font-size: 14px; color: var(--color-text-secondary); margin-top: 2px; }
.my-materials, .profile-warning, .result-notice, .objection-submit-panel, .loading-card { padding: 20px; border-radius: 8px !important; }
.profile-warning { display: flex; gap: 14px; align-items: flex-start; background: rgba(245, 158, 11, 0.12); }
.profile-warning svg { font-size: 28px; color: #d97706; }
.profile-warning h3 { font-size: 16px; margin-bottom: 6px; }
.profile-warning p { color: var(--color-text-secondary); font-size: 13px; margin-bottom: 12px; }
.btn-primary.small { display: inline-flex; height: 34px; padding: 0 14px; align-items: center; text-decoration: none; font-size: 13px; }
.panel-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; margin-bottom: 16px; }
.panel-header h3 { display: flex; align-items: center; gap: 8px; font-size: 16px; }
.panel-count { font-size: 13px; color: var(--color-text-secondary); white-space: nowrap; }
.detail-overview { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; padding: 2px 0 18px; border-bottom: 1px solid var(--color-border); }
.overview-main { min-width: 0; }
.overview-title-row { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
.overview-title-row h3 { font-size: 20px; }
.overview-meta, .overview-note { margin-top: 6px; color: var(--color-text-secondary); font-size: 13px; line-height: 1.55; }
.overview-actions { display: flex; align-items: center; gap: 10px; flex: 0 0 auto; }
.status-chip { display: inline-flex; align-items: center; min-height: 25px; padding: 0 9px; border-radius: 8px !important; background: color-mix(in srgb, var(--color-primary) 11%, transparent); color: var(--color-primary); font-size: 12px; }
.status-chip.muted { background: var(--color-bg); color: var(--color-text-secondary); }
.status-chip.readonly { background: rgba(245,158,11,.12); color: #d97706; }
.empty-actions { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.empty-link { text-decoration:none; }
.form-actions { display: flex; justify-content: space-between; align-items: center; gap: 18px; padding: 18px 0 2px; border-top: 1px solid var(--color-border); }
.action-help { display: flex; flex-direction: column; gap: 5px; }
.action-help strong { font-size: 15px; }
.action-help span { color: var(--color-text-secondary); font-size: 13px; line-height: 1.55; }
.action-buttons { display: flex; gap: 10px; flex: 0 0 auto; }
.objection-submit-panel { display: flex; justify-content: space-between; gap: 16px; align-items: center; }
.btn-outline, .btn-primary { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 40px; padding: 0 16px; border-radius: 8px !important; cursor: pointer; white-space: nowrap; }
.btn-outline { border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-primary); }
.btn-primary { border: none; background: var(--gradient-primary); color: white; visibility: visible; opacity: 1; }
.btn-outline:disabled, .btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }
.material-list { display: flex; flex-direction: column; gap: 10px; }
.material-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; padding: 14px; border-radius: 8px !important; background: var(--color-bg); }
.row-left { display: flex; align-items: flex-start; gap: 12px; }
.row-icon { font-size: 22px; color: var(--color-primary); }
.row-desc { margin-top: 4px; font-size: 12px; color: var(--color-text-secondary); line-height: 1.5; }
.status-tag { padding: 4px 10px; border-radius: 8px !important; font-size: 12px; white-space: nowrap; }
.empty-state { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 32px; color: var(--color-text-tertiary); text-align: center; }
.empty-state .v-icon { font-size: 40px; }
.result-notice, .result-waiting { display: flex; align-items: flex-start; gap: 14px; background: rgba(52,168,83,.10); }
.result-waiting { padding: 20px; border-radius: 8px !important; background: rgba(245,158,11,.10); }
.result-waiting > svg { flex: 0 0 auto; font-size: 28px; color: #d97706; }
.result-waiting h3, .result-notice h3 { margin-bottom: 5px; }
.result-waiting p, .result-notice p, .result-notice small { color: var(--color-text-secondary); line-height: 1.6; }
.result-notice > svg { font-size: 28px; color: #34a853; }
.objection-submit-panel h3 { display: flex; align-items: center; gap: 8px; font-size: 16px; margin-bottom: 6px; }
.objection-submit-panel p { color: var(--color-text-secondary); font-size: 13px; line-height: 1.6; }
.loading-card { display: flex; align-items: center; justify-content: center; gap: 10px; color: var(--color-text-secondary); }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 768px) {
  .detail-overview, .form-actions, .objection-submit-panel { flex-direction: column; align-items: stretch; }
  .overview-actions, .action-buttons { flex-wrap: wrap; }
}

/* 模块三局部圆角兜底：仅作用于当前模块三组件树，不影响顶部导航及其他模块。 */
:deep(*) {
  border-radius: 8px !important;
}

</style>
