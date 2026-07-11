<template>
  <div class="batch-manage">
    <div class="page-header">
      <h2>管理员批次管理</h2>
      <p class="page-desc">发布指定学院、年级的综测批次，并配置跨班互评关系</p>
    </div>

    <div class="panel-card glass-card">
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
      </div>
      <button class="btn-primary" @click="handleCreate"><VIcon icon="mdi:send-outline" /><span class="btn-label">发布</span></button>
    </div>

    <div class="panel-card glass-card temp-user-panel">
      <div class="panel-header">
        <h3><VIcon icon="mdi:account-plus-outline" />临时账号与基础信息创建</h3>
        <span class="panel-count">测试临时功能：可创建学生、辅导员、学工办、管理员</span>
      </div>
      <div class="form-grid temp-grid">
        <label class="field-box">
          <span>角色</span>
          <select v-model="tempUser.role">
            <option value="student">学生</option>
            <option value="counselor">辅导员</option>
            <option value="student_affairs">学工办</option>
            <option value="admin">管理员</option>
          </select>
        </label>
        <label class="field-box">
          <span>登录账号</span>
          <input v-model.trim="tempUser.username" placeholder="如 temp_student_01" />
        </label>
        <label class="field-box">
          <span>登录密码</span>
          <input v-model.trim="tempUser.password" placeholder="默认 123456" />
        </label>
        <label class="field-box">
          <span>姓名</span>
          <input v-model.trim="tempUser.real_name" placeholder="如 临时学生" />
        </label>
        <label class="field-box">
          <span>学院</span>
          <input v-model.trim="tempUser.college" list="college-options" placeholder="可输入任意学院" />
        </label>
        <label class="field-box">
          <span>年级</span>
          <input v-model.trim="tempUser.grade" list="grade-options" placeholder="如 2024级" />
        </label>
        <label class="field-box">
          <span>班级</span>
          <input v-model.trim="tempUser.class_name" list="class-options" placeholder="可输入任意班级" />
        </label>
        <label class="field-box">
          <span>学号</span>
          <input v-model.trim="tempUser.student_no" placeholder="学生必填；其他角色可选" />
        </label>
        <label class="field-box">
          <span>专业</span>
          <input v-model.trim="tempUser.major" placeholder="学生可填专业" />
        </label>
        <label class="check-row temp-check" v-if="tempUser.role === 'student'">
          <input type="checkbox" v-model="tempUser.is_assessment_member" /> 创建时同时设为综测成员
        </label>
      </div>
      <datalist id="college-options">
        <option v-for="college in options.colleges" :key="college" :value="college" />
      </datalist>
      <datalist id="grade-options">
        <option v-for="grade in options.grades" :key="grade" :value="grade" />
      </datalist>
      <datalist id="class-options">
        <option v-for="cls in options.classes" :key="cls.id" :value="cls.name" />
      </datalist>
      <div class="temp-actions">
        <button class="btn-primary" :disabled="creatingTempUser" @click="handleCreateTempUser">
          <VIcon icon="mdi:account-check-outline" />
          <span class="btn-label">{{ creatingTempUser ? '创建中...' : '创建临时账号' }}</span>
        </button>
        <button class="btn-outline" @click="resetTempUser">
          <VIcon icon="mdi:restore" />
          <span class="btn-label">重置表单</span>
        </button>
      </div>
      <div class="temp-result" v-if="createdTempUsers.length">
        <strong>本次已创建</strong>
        <div class="temp-user-row" v-for="user in createdTempUsers" :key="user.id">
          <span>{{ user.role_name }}：{{ user.real_name }}</span>
          <small>账号 {{ user.username }} / 密码 {{ user.password || tempUser.password || '123456' }} / {{ user.college || '-' }} {{ user.class_name || '' }} {{ user.student_no || '' }}</small>
        </div>
      </div>
      <p class="temp-note">说明：这是管理员临时测试入口。学生会写入学号、学院、年级、班级；辅导员会同时生成对应管辖范围。</p>
    </div>

    <div class="panel-card glass-card" v-if="settings">
      <div class="panel-header">
        <h3><VIcon icon="mdi:tune-variant" />全局流程设置</h3>
      </div>
      <div class="form-grid compact">
        <input v-model="settings.submitDeadline" placeholder="提交截止时间" />
        <input v-model="settings.publishNotice" placeholder="发布通知说明" />
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

    <div class="panel-card glass-card">
      <div class="panel-header">
        <h3><VIcon icon="mdi:progress-clock" />进行中的批次</h3>
        <span class="panel-count">{{ activeBatches.length }} 个</span>
      </div>
      <div class="batch-list">
        <div class="batch-row" v-for="batch in activeBatches" :key="batch.id">
          <div class="batch-main">
            <strong>{{ batch.title }}</strong>
            <p>{{ batch.college }} · {{ batch.grade }} · {{ batch.start_time }} 至 {{ batch.end_time }}</p>
            <small>目标学生 {{ batch.target_student_count }} 人，已提交 {{ batch.submitted_count }} 份，待处理 {{ batch.pending_count }} 份</small>
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

    <div class="panel-card glass-card" v-if="editing">
      <div class="panel-header">
        <h3><VIcon icon="mdi:playlist-edit" />批次详情与跨班互评配置</h3>
        <button class="btn-text" @click="editing = null"><span class="btn-label">关闭</span></button>
      </div>
      <div class="form-grid">
        <input v-model="editing.title" placeholder="批次名称" />
        <select v-model="editing.school_year">
          <option v-for="year in schoolYearOptions" :key="year" :value="year">{{ year }}</option>
        </select>
        <select v-model="editing.college">
          <option v-for="college in options.colleges" :key="college" :value="college">{{ college }}</option>
        </select>
        <select v-model="editing.grade">
          <option v-for="grade in options.grades" :key="grade" :value="grade">{{ grade }}</option>
        </select>
        <input type="date" v-model="editing.start_time" @keydown.prevent @paste.prevent />
        <input type="date" v-model="editing.end_time" @keydown.prevent @paste.prevent />
        <select v-model="editing.status">
          <option value="draft">草稿</option>
          <option value="published">已发布</option>
          <option value="closed">已关闭</option>
          <option value="archived">归档</option>
        </select>
        <textarea v-model="editing.description" placeholder="批次说明"></textarea>
        <textarea v-model="editing.requirements" placeholder="填写与材料要求"></textarea>
      </div>

      <div class="sub-title">跨班互评配置</div>
      <div class="assignment-row" v-for="(item, index) in editing.review_assignments" :key="item.id || index">
        <select v-model.number="item.target_class_id" @change="syncClassName(item, 'target')">
          <option value="">被评班级</option>
          <option v-for="cls in classOptions" :key="cls.id" :value="cls.id">{{ cls.name }}</option>
        </select>
        <select v-model.number="item.reviewer_class_id" @change="syncClassName(item, 'reviewer')">
          <option value="">评测班级</option>
          <option v-for="cls in classOptions" :key="cls.id" :value="cls.id" :disabled="Number(cls.id) === Number(item.target_class_id)">{{ cls.name }}</option>
        </select>
        <select v-model="item.reviewer_ids" multiple>
          <option v-for="member in membersByClass(item.reviewer_class_id)" :key="member.id" :value="member.id">{{ member.real_name }}（{{ member.student_no }}）</option>
        </select>
        <button class="danger small" @click="editing.review_assignments.splice(index, 1)"><span class="btn-label">删除</span></button>
      </div>
      <button class="btn-outline" @click="addAssignment"><VIcon icon="mdi:plus" /><span class="btn-label">新增互评关系</span></button>
      <button class="btn-primary" @click="saveBatch"><VIcon icon="mdi:content-save-outline" /><span class="btn-label">保存批次与互评配置</span></button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { createBatch, createTemporaryUser, deleteBatch, getBatches, getScopeOptions, getSettings, updateBatch, updateBatchStatus, updateSettings } from '../../api/module3';

const batches = ref([]);
const settings = ref(null);
const options = ref({ colleges: [], grades: [], classes: [], members: [] });
const editing = ref(null);
const creatingTempUser = ref(false);
const createdTempUsers = ref([]);

function currentAcademicYearStart() {
  const today = new Date();
  const year = today.getFullYear();
  return today.getMonth() + 1 >= 9 ? year : year - 1;
}

const currentYearStart = currentAcademicYearStart();

const defaultTempUser = () => ({
  role: 'student',
  username: '',
  password: '123456',
  real_name: '',
  college: '',
  grade: `${currentYearStart}级`,
  class_name: '',
  student_no: '',
  major: '',
  is_assessment_member: false,
});
const tempUser = ref(defaultTempUser());
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
  description: '管理员发布的年度综合素质测评批次',
  requirements: '学生选择批次后确认智能填表结果，并由系统分配给跨班综测成员评价',
});

const activeBatches = computed(() => batches.value.filter(batch => ['draft', 'published'].includes(batch.status)));
const classOptions = computed(() => options.value.classes.filter(cls => !editing.value || (cls.college === editing.value.college && cls.grade === editing.value.grade)));

function syncClassName(item, type) {
  const key = type === 'target' ? 'target_class_id' : 'reviewer_class_id';
  const nameKey = type === 'target' ? 'target_class_name' : 'reviewer_class_name';
  const cls = options.value.classes.find(c => Number(c.id) === Number(item[key]));
  item[nameKey] = cls?.name || '';
  if (type === 'reviewer') item.reviewer_ids = [];
}

function membersByClass(classId) {
  return options.value.members.filter(member => Number(member.class_id) === Number(classId));
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
    await load();
  } else alert(res.msg);
}

function openEdit(batch) {
  editing.value = JSON.parse(JSON.stringify(batch));
  editing.value.start_time = normalizeDateValue(editing.value.start_time);
  editing.value.end_time = normalizeDateValue(editing.value.end_time);
}

function addAssignment() {
  if (!editing.value.review_assignments) editing.value.review_assignments = [];
  editing.value.review_assignments.push({ id: `tmp-${Date.now()}`, target_class_id: '', target_class_name: '', reviewer_class_id: '', reviewer_class_name: '', reviewer_ids: [] });
}

async function saveBatch() {
  const payload = JSON.parse(JSON.stringify(editing.value));
  payload.review_assignments = (payload.review_assignments || []).map(item => ({ ...item, id: String(item.id).startsWith('tmp-') ? 0 : item.id }));
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

function resetTempUser() {
  tempUser.value = defaultTempUser();
}

async function handleCreateTempUser() {
  if (!tempUser.value.role) return alert('请选择角色');
  if (!tempUser.value.username) return alert('请输入登录账号');
  if (!tempUser.value.real_name) return alert('请输入姓名');
  if (['student', 'counselor'].includes(tempUser.value.role)) {
    if (!tempUser.value.college) return alert('学生和辅导员必须填写学院');
    if (!tempUser.value.grade) return alert('学生和辅导员必须填写年级');
  }
  if (tempUser.value.role === 'student') {
    if (!tempUser.value.class_name) return alert('学生必须填写班级');
    if (!tempUser.value.student_no) return alert('学生必须填写学号');
  }
  creatingTempUser.value = true;
  try {
    const res = await createTemporaryUser(tempUser.value);
    if (res.code === 200) {
      createdTempUsers.value.unshift({ ...res.data, password: tempUser.value.password || '123456' });
      alert('临时账号已创建');
      resetTempUser();
      await load();
    } else alert(res.msg);
  } finally {
    creatingTempUser.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.batch-manage { display: flex; flex-direction: column; gap: 24px; animation: fadeIn 0.4s var(--easing-decelerate); }
.page-header h2 { font-size: 22px; font-weight: var(--font-weight-semibold); }
.page-desc { font-size: 14px; color: var(--color-text-secondary); margin-top: 2px; }
.panel-card { display: flex; flex-direction: column; gap: 14px; padding: 24px; border-radius: var(--radius-xl); }
.panel-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.panel-header h3 { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: var(--font-weight-semibold); }
.panel-count { color: var(--color-text-secondary); font-size: 13px; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.form-grid.compact { grid-template-columns: repeat(3, minmax(0, 1fr)); }
input, select, textarea { min-height: 40px; border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 8px 12px; background: var(--color-bg); color: var(--color-text-primary); }
textarea { grid-column: span 2; min-height: 80px; resize: vertical; }
.check-row { display: flex; align-items: center; gap: 8px; color: var(--color-text-secondary); font-size: 14px; }
.check-row input { width: auto; min-height: auto; }
.grade-rules { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.grade-row { display: flex; align-items: center; gap: 8px; padding: 10px; border-radius: var(--radius-md); background: var(--color-bg); }
.grade-row input { width: 70px; }
.grade-row span { font-weight: var(--font-weight-semibold); }
.grade-row small { color: var(--color-text-secondary); }
.btn-primary, .btn-outline, .actions button, .btn-text {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  min-height: 36px; padding: 0 14px; border-radius: var(--radius-full); cursor: pointer;
  color: var(--color-text-primary); font-weight: var(--font-weight-medium); white-space: nowrap;
}
.btn-label { display: inline; color: inherit; font-size: 14px; line-height: 1; }
.btn-primary { border: none; background: var(--gradient-primary); color: #fff; }
.btn-outline, .actions button, .btn-text { background: var(--color-surface); color: var(--color-text-primary); border: 1px solid var(--color-border); }
.batch-list { display: flex; flex-direction: column; gap: 10px; }
.batch-row { display: flex; justify-content: space-between; gap: 16px; padding: 14px; border-radius: var(--radius-lg); background: var(--color-bg); }
.batch-row p, .batch-row small { color: var(--color-text-secondary); margin-top: 4px; }
.actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.actions .danger, .danger { border-color: rgba(239,68,68,0.35); color: #ef4444; background: rgba(239,68,68,0.08); }
.sub-title { font-weight: var(--font-weight-semibold); margin-top: 8px; }
.assignment-row { display: grid; grid-template-columns: 1fr 1fr 1.3fr auto; gap: 10px; align-items: start; padding: 12px; border-radius: var(--radius-lg); background: var(--color-bg); }
.assignment-row select[multiple] { min-height: 88px; }
.small { min-height: 34px; }
.field-box { display: flex; flex-direction: column; gap: 6px; }
.field-box span { font-size: 13px; color: var(--color-text-secondary); }
.temp-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.temp-check { align-self: end; min-height: 40px; }
.temp-actions { display: flex; gap: 10px; flex-wrap: wrap; }
.temp-result { display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: var(--radius-lg); background: var(--color-bg); }
.temp-user-row { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; color: var(--color-text-primary); }
.temp-user-row small, .temp-note { color: var(--color-text-secondary); font-size: 13px; }
.empty-line { padding: 24px; text-align: center; color: var(--color-text-tertiary); }
@media (max-width: 768px) {
  .form-grid, .form-grid.compact, .temp-grid, .grade-rules, .assignment-row { grid-template-columns: 1fr; }
  textarea { grid-column: span 1; }
  .batch-row { flex-direction: column; }
}
</style>
