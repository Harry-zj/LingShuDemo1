<template>
  <Module3FeatureMenu
    v-if="view === 'menu'"
    title="批次与流程配置"
    description="创建批次、全局流程设置、进行中批次和历史批次分开管理。"
    back-path="/module3/admin"
    back-label="返回管理员工作台"
    :cards="menuCards"
  />

  <div v-else class="batch-manage">
    <button class="back-link" @click="$router.push('/module3/batch-manage')"><VIcon icon="mdi:arrow-left" />返回批次与流程配置</button>
    <div class="page-header">
      <h2>{{ pageTitle }}</h2>
      <p class="page-desc">{{ pageDescription }}</p>
    </div>

    <div class="panel-card glass-card" v-if="view === 'create'">
      <div class="panel-header">
        <h3><VIcon icon="mdi:calendar-plus-outline" />发布综测批次</h3>
        <span class="panel-count">同一学院、同一年级、同一学年只能创建一次</span>
      </div>
      <div class="form-grid">
        <select v-model="form.school_year" @change="syncCreateTitle">
          <option v-for="year in schoolYearOptions" :key="year" :value="year">{{ year }}</option>
        </select>
        <input v-model="form.title" placeholder="批次名称，例如 2025-2026学年综测" />
        <select v-model="form.college">
          <option value="">选择学院</option>
          <option v-for="college in options.colleges" :key="college" :value="college">{{ college }}</option>
        </select>
        <select v-model="form.grade">
          <option value="">选择年级</option>
          <option v-for="grade in options.grades" :key="grade" :value="grade">{{ grade }}</option>
        </select>
        <input type="date" v-model="form.start_time" @keydown.prevent @paste.prevent />
        <input type="date" v-model="form.end_time" @keydown.prevent @paste.prevent />
        <textarea v-model="form.description" placeholder="批次说明"></textarea>
        <textarea v-model="form.requirements" placeholder="填写与材料要求"></textarea>
        <label class="check-row"><input type="checkbox" v-model="form.requireCounselorReview" /> 需要辅导员参与评价</label>
        <label class="check-row"><input type="checkbox" v-model="form.requireStudentAffairsReview" /> 需要学生工作处参与评价</label>
        <label class="check-row"><input type="checkbox" v-model="form.lockSubmittedMaterial" /> 学生提交后禁止保存/修改</label>
        <label class="number-row">异议期限（天）<input type="number" min="0" v-model.number="form.objectionDays" /></label>
      </div>
      <button class="btn-primary" @click="handleCreate"><VIcon icon="mdi:send-outline" /><span class="btn-label">发布</span></button>
    </div>


    <div class="panel-card glass-card" v-if="view === 'settings' && settings">
      <div class="panel-header">
        <h3><VIcon icon="mdi:tune-variant" />全局流程设置</h3>
      </div>
      <div class="form-grid compact">
        <input v-model="settings.submitDeadline" placeholder="提交截止时间" />
        <input v-model="settings.publishNotice" placeholder="发布通知说明" />
        <label class="check-row"><input type="checkbox" v-model="settings.allowStudentRegister" /> 允许学生自主注册</label>
        <label class="check-row"><input type="checkbox" v-model="settings.allowStudentEdit" /> 允许学生修改智能填表结果</label>
        <label class="check-row"><input type="checkbox" v-model="settings.allowReturnEdit" /> 允许退回后重新提交</label>
        <label class="check-row"><input type="checkbox" v-model="settings.requireReviewerComment" /> 评价时必须填写意见</label>
      </div>
      <div class="grade-rules">
        <div class="grade-row" v-for="rule in settings.gradeRules" :key="rule.grade">
          <span>{{ rule.grade }}</span>
          <input type="number" v-model.number="rule.min" />
          <small>分及以上</small>
        </div>
      </div>
      <button class="btn-outline" @click="saveSettings"><VIcon icon="mdi:content-save-outline" /><span class="btn-label">保存设置</span></button>
    </div>

    <div class="panel-card glass-card" v-if="view === 'limits' && settings">
      <div class="panel-header">
        <div>
          <h3><VIcon icon="mdi:speedometer" />分数上限设置</h3>
          <p class="panel-help">上限同时作用于智能填表、学生修改和评测人员复核。保存后会自动重算现有综测总分与等级。</p>
        </div>
      </div>
      <div class="limit-group" v-for="group in scoreLimitGroups" :key="group.title">
        <h4>{{ group.title }}</h4>
        <div class="score-limit-grid">
          <label class="score-limit-row" v-for="item in group.items" :key="item.key">
            <span>{{ item.label }}</span>
            <input type="number" min="0" max="999.99" step="0.1" v-model.number="settings.scoreLimits[item.key]" />
            <small>分</small>
          </label>
        </div>
      </div>
      <button class="btn-outline" @click="saveSettings"><VIcon icon="mdi:content-save-outline" /><span class="btn-label">保存分数上限</span></button>
    </div>

    <div class="panel-card glass-card" v-if="view === 'active'">
      <div class="panel-header">
        <h3><VIcon icon="mdi:progress-clock" />进行中的批次</h3>
        <span class="panel-count">{{ activeBatches.length }} 个</span>
      </div>
      <div class="batch-list">
        <div class="batch-row" v-for="batch in activeBatches" :key="batch.id">
          <div class="batch-main">
            <strong>{{ batch.title }}</strong>
            <p>{{ batch.college }} · {{ batch.grade }}级 · {{ batch.start_time }} 至 {{ batch.end_time }}</p>
            <small>目标学生 {{ batch.target_student_count }} 人，已提交 {{ batch.submitted_count }} 份，待处理 {{ batch.pending_count }} 份</small>
            <small v-if="!batch.published_rule_count" style="color:#d97706;">⚠ 还没发布规则，请尽快发布哦</small>
          </div>
          <div class="actions">
            <button @click="openEdit(batch)"><span class="btn-label">查看/修改</span></button>
            <button @click="setStatus(batch.id, 'closed')"><span class="btn-label">关闭</span></button>
            <button class="danger" @click="removeBatch(batch.id)"><span class="btn-label">删除</span></button>
          </div>
        </div>
        <div class="empty-line" v-if="!activeBatches.length">暂无进行中的批次</div>
      </div>
    </div>

    <div class="panel-card glass-card" v-if="view === 'history'">
      <div class="panel-header">
        <h3><VIcon icon="mdi:history" />历史批次</h3>
        <span class="panel-count">{{ historyBatches.length }} 个</span>
      </div>
      <div class="batch-list">
        <div class="batch-row" v-for="batch in historyBatches" :key="batch.id">
          <div class="batch-main">
            <strong>{{ batch.title }}</strong>
            <p>{{ batch.college }} · {{ batch.grade }}级 · {{ batch.start_time }} 至 {{ batch.end_time }}</p>
            <small>历史批次仅允许修改说明、状态和跨班互评配置</small>
          </div>
          <div class="actions">
            <button @click="openEdit(batch)"><span class="btn-label">查看/修改</span></button>
          </div>
        </div>
        <div class="empty-line" v-if="!historyBatches.length">暂无历史批次</div>
      </div>
    </div>

    <!-- 批次详情编辑弹窗 -->
    <teleport to="body">
      <Transition name="fade">
        <div v-if="editing && ['active', 'history'].includes(view)" class="modal-overlay" @click.self="editing = null">
          <div class="modal-card glass-card modal-card-wide" @click.stop>
            <div class="modal-header">
              <h3><VIcon icon="mdi:playlist-edit" />批次详情与跨班互评配置</h3>
              <button class="modal-close" @click="editing = null"><VIcon icon="mdi:close" /></button>
            </div>
            <div class="modal-body">
              <div class="form-grid">
                <input v-model="editing.title" placeholder="批次名称" :disabled="isEditingHistorical" />
                <select v-model="editing.school_year" :disabled="isEditingHistorical">
                  <option v-for="year in editingSchoolYearOptions" :key="year" :value="year">{{ year }}</option>
                </select>
                <select v-model="editing.college" :disabled="isEditingHistorical">
                  <option v-for="college in options.colleges" :key="college" :value="college">{{ college }}</option>
                </select>
                <select v-model="editing.grade" :disabled="isEditingHistorical">
                  <option v-for="grade in options.grades" :key="grade" :value="grade">{{ grade }}</option>
                </select>
                <input type="date" v-model="editing.start_time" :disabled="isEditingHistorical" @keydown.prevent @paste.prevent />
                <input type="date" v-model="editing.end_time" :disabled="isEditingHistorical" @keydown.prevent @paste.prevent />
                <select v-model="editing.status">
                  <option value="draft">草稿</option>
                  <option value="published">已发布</option>
                  <option value="closed">已关闭</option>
                  <option value="archived">归档</option>
                </select>
                <textarea v-model="editing.description" placeholder="批次说明"></textarea>
                <textarea v-model="editing.requirements" placeholder="填写与材料要求" :disabled="isEditingHistorical"></textarea>
                <label class="check-row"><input type="checkbox" v-model="editing.requireCounselorReview" :disabled="isEditingHistorical" /> 需要辅导员参与评价</label>
                <label class="check-row"><input type="checkbox" v-model="editing.requireStudentAffairsReview" :disabled="isEditingHistorical" /> 需要学生工作处参与评价</label>
                <label class="check-row"><input type="checkbox" v-model="editing.lockSubmittedMaterial" :disabled="isEditingHistorical" /> 学生提交后禁止保存/修改</label>
                <label class="number-row">异议期限（天）<input type="number" min="0" v-model.number="editing.objectionDays" :disabled="isEditingHistorical" /></label>
              </div>

              <p class="history-tip" v-if="isEditingHistorical">该批次属于历史学年，仅说明、状态和跨班互评配置可以修改。</p>
              <div class="sub-title">跨班互评配置 <small>（选择评价班级后，该班当前批次全部已授权评价小组成员均可评价）</small></div>
              <div class="assignment-row" v-for="(item, index) in editing.review_assignments" :key="item.id || index">
                <select v-model.number="item.target_class_id" @change="syncClassName(item, 'target')">
                  <option value="">被评班级</option>
                  <option v-for="cls in classOptions" :key="cls.id" :value="cls.id">{{ cls.name }}</option>
                </select>
                <select v-model.number="item.reviewer_class_id" @change="syncClassName(item, 'reviewer')">
                  <option value="">评测班级</option>
                  <option v-for="cls in classOptions" :key="cls.id" :value="cls.id" :disabled="Number(cls.id) === Number(item.target_class_id)">{{ cls.name }}</option>
                </select>
                <button class="danger small" @click="editing.review_assignments.splice(index, 1)"><span class="btn-label">删除</span></button>
              </div>
              <button class="btn-outline" @click="addAssignment"><VIcon icon="mdi:plus" /><span class="btn-label">新增互评关系</span></button>
            </div>
            <div class="modal-footer">
              <button class="btn-outline" @click="editing = null">取消</button>
              <button class="btn-primary" @click="saveBatch"><VIcon icon="mdi:content-save-outline" /><span class="btn-label">保存批次与互评配置</span></button>
            </div>
          </div>
        </div>
      </Transition>
    </teleport>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import Module3FeatureMenu from './Module3FeatureMenu.vue';
import { createBatch, deleteBatch, getBatches, getScopeOptions, getSettings, updateBatch, updateBatchStatus, updateSettings } from '../../api/module3';

const props = defineProps({ view: { type: String, default: 'menu' } });
const router = useRouter();
const view = computed(() => props.view || 'menu');
const menuCards = computed(() => [
  { title: '创建并发布批次', description: '设置学院、年级、评价链、材料锁定和异议期限', icon: 'mdi:calendar-plus-outline', to: '/module3/batch-manage/create' },
  { title: '全局流程设置', description: '设置自主注册、学生编辑、退回编辑、评价意见和等级规则', icon: 'mdi:tune-variant', to: '/module3/batch-manage/settings' },
  { title: '分数上限设置', description: '配置 F1/F2/F3、A1-A5、B1-B8 及总分上限', icon: 'mdi:speedometer', to: '/module3/batch-manage/limits' },
  { title: '进行中的批次', description: `查看、修改、关闭或删除当前 ${activeBatches.value.length} 个批次`, icon: 'mdi:progress-clock', to: '/module3/batch-manage/active' },
  { title: '历史批次', description: `查看已关闭、已归档或历史学年的 ${historyBatches.value.length} 个批次`, icon: 'mdi:history', to: '/module3/batch-manage/history' },
]);
const pageMeta = {
  create: ['创建并发布批次', '为指定学院和年级创建综测批次，并设置本批次评价流程。'],
  settings: ['全局流程设置', '维护学生注册、材料编辑、评价意见和等级规则等通用配置。'],
  limits: ['分数上限设置', '设置每个大类、子项目和最终总分的最高允许分值。'],
  active: ['进行中的批次', '查看和维护当前学年的草稿或已发布批次。'],
  history: ['历史批次', '查看已关闭、已归档或历史学年的批次。'],
};
const pageTitle = computed(() => pageMeta[view.value]?.[0] || '批次与流程配置');
const pageDescription = computed(() => pageMeta[view.value]?.[1] || '');

const batches = ref([]);
const settings = ref(null);
const options = ref({ colleges: [], grades: [], classes: [], members: [], batch_memberships: [], students: [] });
const editing = ref(null);
const scoreLimitGroups = [
  { title: '大类与最终总分', items: [
    { key: 'F1', label: 'F1 基本素质' }, { key: 'F2', label: 'F2 课程学习成绩' },
    { key: 'F3', label: 'F3 创新实践' }, { key: 'total', label: '最终综合总分' },
  ] },
  { title: 'F1 子项目', items: [
    { key: 'A1', label: 'A1 思想政治表现' }, { key: 'A2', label: 'A2 道德品质修养' },
    { key: 'A3', label: 'A3 学习态度作风' }, { key: 'A4', label: 'A4 组织纪律观念' },
    { key: 'A5', label: 'A5 身心健康素质' },
  ] },
  { title: 'F2 子项目', items: [{ key: 'COURSE', label: '课程学习成绩' }] },
  { title: 'F3 子项目', items: Array.from({ length: 8 }, (_, index) => ({ key: `B${index + 1}`, label: `B${index + 1}` })) },
];

// 规则文件管理（创建页内嵌 + active/history 弹窗）

function currentAcademicYearStart() {
  const today = new Date();
  const year = today.getFullYear();
  return today.getMonth() + 1 >= 9 ? year : year - 1;
}

const currentYearStart = currentAcademicYearStart();

const schoolYearOptions = Array.from({ length: 101 }, (_, index) => `${currentYearStart + index}-${currentYearStart + index + 1}`);
const defaultStartDate = `${currentYearStart + 1}-07-01`;
const defaultEndDate = `${currentYearStart + 1}-07-25`;
const form = ref({
  school_year: schoolYearOptions[0],
  title: `${schoolYearOptions[0]}学年综测`,
  college: '',
  grade: '',
  start_time: defaultStartDate,
  end_time: defaultEndDate,
  status: 'published',
  requireCounselorReview: false,
  requireStudentAffairsReview: false,
  lockSubmittedMaterial: false,
  objectionDays: 7,
  description: '管理员发布的年度综合素质测评批次',
  requirements: '学生选择批次后确认智能填表结果，并由系统分配给跨班评价小组成员评价',
});

function isHistoricalBatch(batch) {
  const match = String(batch?.school_year || '').match(/^(\d{4})-(\d{4})$/);
  return !!match && Number(match[1]) < currentYearStart;
}

const activeBatches = computed(() => batches.value.filter(batch => ['draft', 'published'].includes(batch.status) && !isHistoricalBatch(batch)));
const historyBatches = computed(() => batches.value.filter(batch => isHistoricalBatch(batch) || ['closed', 'archived'].includes(batch.status)));
const isEditingHistorical = computed(() => isHistoricalBatch(editing.value));
const editingSchoolYearOptions = computed(() => {
  const currentValue = editing.value?.school_year;
  return currentValue && !schoolYearOptions.includes(currentValue) ? [currentValue, ...schoolYearOptions] : schoolYearOptions;
});
const classOptions = computed(() => options.value.classes.filter(cls => !editing.value || (cls.college === editing.value.college && cls.grade === editing.value.grade)));

function syncClassName(item, type) {
  const key = type === 'target' ? 'target_class_id' : 'reviewer_class_id';
  const nameKey = type === 'target' ? 'target_class_name' : 'reviewer_class_name';
  const cls = options.value.classes.find(c => Number(c.id) === Number(item[key]));
  item[nameKey] = cls?.name || '';
}


function syncCreateTitle() {
  form.value.title = `${form.value.school_year}学年综测`;
}

function normalizeDateValue(value) {
  return String(value || '').slice(0, 10);
}

async function load() {
  const [batchRes, settingRes, optionRes] = await Promise.all([getBatches(), getSettings(), getScopeOptions()]);
  if (batchRes.code === 200) batches.value = batchRes.data || [];
  if (settingRes.code === 200) settings.value = settingRes.data;
  if (optionRes.code === 200) options.value = optionRes.data;
}

async function handleCreate() {
  if (!form.value.school_year) return alert('请选择学年');
  if (!form.value.college) return alert('请选择学院');
  if (!form.value.grade) return alert('请选择年级');
  if (!form.value.start_time || !form.value.end_time) return alert('请选择开始时间和结束时间');
  const res = await createBatch({ ...form.value, status: 'published' });
  if (res.code === 200) {
    alert('批次已发布');
    router.push('/module3/batch-manage')
  } else alert(res.msg);
}

function openEdit(batch) {
  editing.value = JSON.parse(JSON.stringify(batch));
  editing.value.start_time = normalizeDateValue(editing.value.start_time);
  editing.value.end_time = normalizeDateValue(editing.value.end_time);
  editing.value.requireCounselorReview = editing.value.requireCounselorReview !== false;
  editing.value.requireStudentAffairsReview = editing.value.requireStudentAffairsReview !== false;
  editing.value.lockSubmittedMaterial = !!editing.value.lockSubmittedMaterial;
  editing.value.objectionDays = Number(editing.value.objectionDays ?? 7);
}

function addAssignment() {
  if (!editing.value.review_assignments) editing.value.review_assignments = [];
  editing.value.review_assignments.push({ id: `tmp-${Date.now()}`, target_class_id: '', target_class_name: '', reviewer_class_id: '', reviewer_class_name: '' });
}

async function saveBatch() {
  const payload = JSON.parse(JSON.stringify(editing.value));
  payload.review_assignments = (payload.review_assignments || []).map(({ reviewer_ids, ...item }) => ({ ...item, id: String(item.id).startsWith('tmp-') ? 0 : item.id }));
  const res = await updateBatch(editing.value.id, payload);
  if (res.code === 200) {
    alert('批次已保存');
    editing.value = null;
    await load();
  } else alert(res.msg);
}

async function setStatus(id, status) {
  const res = await updateBatchStatus(id, { status });
  if (res.code === 200) await load();
  else alert(res.msg);
}

async function removeBatch(id) {
  if (!window.confirm('确定删除该批次吗？')) return;
  const res = await deleteBatch(id);
  if (res.code === 200) await load();
  else alert(res.msg);
}

async function saveSettings() {
  const res = await updateSettings(settings.value);
  if (res.code === 200) {
    settings.value = res.data;
    alert('设置已保存');
    await load();
  } else alert(res.msg);
}


onMounted(load);
</script>

<style scoped>
.batch-manage { display: flex; flex-direction: column; gap: 24px; animation: fadeIn 0.4s var(--easing-decelerate); }
.page-header h2 { font-size: 22px; font-weight: var(--font-weight-semibold); }
.page-desc { font-size: 14px; color: var(--color-text-secondary); margin-top: 2px; }
.panel-card { display: flex; flex-direction: column; gap: 14px; padding: 24px; border-radius: 8px !important; }
.panel-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.panel-header h3 { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: var(--font-weight-semibold); }
.panel-count { color: var(--color-text-secondary); font-size: 13px; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.form-grid.compact { grid-template-columns: repeat(3, minmax(0, 1fr)); }
input, select, textarea { min-height: 40px; border: 1px solid var(--color-border); border-radius: 8px !important; padding: 8px 12px; background: var(--color-bg); color: var(--color-text-primary); }
textarea { grid-column: span 2; min-height: 80px; resize: vertical; }
.check-row, .number-row { display: flex; align-items: center; gap: 8px; color: var(--color-text-secondary); font-size: 14px; }
.check-row input { width: auto; min-height: auto; }
.number-row input { width: 100px; }
.sub-title small { color: var(--color-text-secondary); font-weight: normal; margin-left: 6px; }
.grade-rules { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.grade-row { display: flex; align-items: center; gap: 8px; padding: 10px; border-radius: 8px !important; background: var(--color-bg); }
.grade-row input { width: 70px; }
.grade-row span { font-weight: var(--font-weight-semibold); }
.grade-row small { color: var(--color-text-secondary); }
.panel-help { margin-top: 6px; color: var(--color-text-secondary); font-size: 13px; line-height: 1.6; }
.limit-group { display: flex; flex-direction: column; gap: 10px; }
.limit-group h4 { font-size: 14px; }
.score-limit-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.score-limit-row { display: grid; grid-template-columns: 1fr 90px 20px; align-items: center; gap: 8px; padding: 10px 12px; background: var(--color-bg); color: var(--color-text-secondary); font-size: 13px; }
.score-limit-row input { width: 90px; }
.score-limit-row small { color: var(--color-text-tertiary); }
.btn-primary, .btn-outline, .actions button, .btn-text {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  min-height: 36px; padding: 0 14px; border-radius: 8px !important; cursor: pointer;
  color: var(--color-text-primary); font-weight: var(--font-weight-medium); white-space: nowrap;
}
.btn-label { display: inline; color: inherit; font-size: 14px; line-height: 1; }
.btn-primary { border: none; background: var(--gradient-primary); color: #fff; }
.btn-outline, .actions button, .btn-text { background: var(--color-surface); color: var(--color-text-primary); border: 1px solid var(--color-border); }
.batch-list { display: flex; flex-direction: column; gap: 10px; }
.batch-row { display: flex; justify-content: space-between; gap: 16px; padding: 14px; border-radius: 8px !important; background: var(--color-bg); }
.batch-row p, .batch-row small { color: var(--color-text-secondary); margin-top: 4px; }
.actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.actions .danger, .danger { border-color: rgba(239,68,68,0.35); color: #ef4444; background: rgba(239,68,68,0.08); }
.sub-title { font-weight: var(--font-weight-semibold); margin-top: 8px; }
.assignment-row { display: grid; grid-template-columns: 1fr 1fr auto; gap: 10px; align-items: start; padding: 12px; border-radius: 8px !important; background: var(--color-bg); }
.small { min-height: 34px; }
.empty-line { padding: 24px; text-align: center; color: var(--color-text-tertiary); }
.history-tip { padding: 10px 12px; border-radius: 8px !important; background: rgba(245, 158, 11, 0.10); color: #b45309; font-size: 13px; }
input:disabled, select:disabled, textarea:disabled { opacity: 0.68; cursor: not-allowed; }
@media (max-width: 768px) {
  .form-grid, .form-grid.compact, .grade-rules, .score-limit-grid, .assignment-row { grid-template-columns: 1fr; }
  textarea { grid-column: span 1; }
  .batch-row { flex-direction: column; }
}
.back-link { display:inline-flex; align-items:center; gap:6px; width:fit-content; border:0; padding:0; background:transparent; color:var(--color-primary); cursor:pointer; }

/* 模块三局部圆角兜底：仅作用于当前模块三组件树，不影响顶部导航及其他模块。 */
:deep(*) {
  border-radius: 8px !important;
}

/* ===== 弹窗 ===== */
.modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.35); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; z-index:1000; padding:24px; }
.modal-card { position:relative; background:var(--glass-bg); backdrop-filter:var(--glass-blur); -webkit-backdrop-filter:var(--glass-blur); border:1px solid var(--glass-border); border-radius:20px; box-shadow:var(--shadow-level-3); max-width:520px; width:100%; max-height:80vh; overflow-y:auto; padding:0; }
.modal-card-wide { max-width:720px; }
.modal-header { display:flex; align-items:center; justify-content:space-between; padding:20px 24px 0; }
.modal-header h3 { display:flex; align-items:center; gap:8px; font-size:18px; font-weight:700; color:var(--color-text); margin:0; }
.modal-close { width:32px; height:32px; border-radius:50%; border:1px solid var(--color-border); background:transparent; cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--color-text-secondary); }
.modal-close:hover { border-color:var(--color-primary); color:var(--color-primary); }
.modal-body { padding:16px 24px 24px; }
.modal-batch-info { font-size:13px; color:var(--color-text-tertiary); margin-bottom:16px; }
.modal-footer { display:flex; gap:10px; justify-content:flex-end; padding:0 24px 20px; }

/* ===== 弹窗通用样式（批次编辑 & 规则文件共用）===== */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000; padding: 24px;
}
.modal-card {
  position: relative;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: 20px;
  box-shadow: var(--shadow-level-3);
  max-width: 520px; width: 100%;
  max-height: 80vh; overflow-y: auto;
  padding: 0;
}
.modal-card-wide { max-width: 800px; min-height: 60vh; }
.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px 24px 0;
}
.modal-header h3 {
  display: flex; align-items: center; gap: 8px;
  font-size: 18px; font-weight: 700; color: var(--color-text); margin: 0;
}
.modal-close {
  width: 32px; height: 32px; border-radius: 50%;
  border: 1px solid var(--color-border); background: transparent;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  color: var(--color-text-secondary);
}
.modal-close:hover { border-color: var(--color-primary); color: var(--color-primary); }
.modal-body { padding: 16px 24px 24px; }
.modal-batch-info { font-size: 13px; color: var(--color-text-tertiary); margin-bottom: 16px; }
.modal-footer {
  display: flex; gap: 10px; justify-content: flex-end;
  padding: 0 24px 20px;
}

/* ===== 规则文件弹窗专用样式 ===== */
.upload-area { margin-bottom: 16px; }
.upload-btn {
  display: inline-flex; align-items: center; gap: 6px;
  min-height: 36px; padding: 0 14px; border-radius: 8px; cursor: pointer;
  color: var(--color-text-primary); font-weight: var(--font-weight-medium);
  background: var(--color-surface); border: 1px solid var(--color-border);
}
.upload-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
.rule-file-list { display: flex; flex-direction: column; gap: 8px; }
.rule-file-row {
  display: flex; justify-content: space-between; align-items: center;
  gap: 12px; padding: 12px; border-radius: 8px;
  background: var(--color-bg); border: 1px solid var(--color-border);
}
.rule-file-info { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.rule-file-name { font-size: 14px; font-weight: var(--font-weight-medium); color: var(--color-text); }
.rule-file-status { font-size: 12px; color: var(--color-text-secondary); }
.rule-file-status.parsed { color: #059669; }
.rule-file-status.parsing { color: var(--color-primary); }
.rule-file-status.pending { color: var(--color-text-tertiary); }
.rule-file-time { font-size: 11px; color: var(--color-text-tertiary); }
.rule-file-actions { display: flex; gap: 4px; }
.rule-file-actions .btn-text {
  padding: 4px 10px; font-size: 12px; border-radius: 6px;
  border: 1px solid var(--color-border); background: var(--color-surface);
  color: var(--color-text-primary); cursor: pointer;
}
.rule-file-actions .btn-text:hover { border-color: var(--color-primary); color: var(--color-primary); }
.rule-file-actions .btn-text:disabled { opacity: 0.5; cursor: not-allowed; }
.rule-file-actions .btn-text.danger { border-color: rgba(239,68,68,0.35); color: #ef4444; }
.rule-file-actions .btn-text.danger:hover { background: rgba(239,68,68,0.08); }

</style>
