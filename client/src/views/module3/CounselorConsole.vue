<template>
  <div class="counselor-console">
    <div class="detail-header">
      <button class="back-link" @click="router.push('/module3/counselor')">
        <VIcon icon="mdi:arrow-left" />返回辅导员工作台
      </button>
      <div class="page-header">
        <div>
          <span class="eyebrow">辅导员工作台 / {{ sectionMeta.shortTitle }}</span>
          <h2>{{ sectionMeta.title }}</h2>
          <p class="page-desc">{{ sectionMeta.description }}</p>
        </div>
        <span class="section-icon"><VIcon :icon="sectionMeta.icon" /></span>
      </div>
    </div>

    <div class="panel-card glass-card" v-if="view === 'scope'">
      <div class="panel-header">
        <h3><VIcon icon="mdi:map-marker-radius-outline" />管辖范围设置</h3>
        <span class="panel-count">学院和年级必选，专业可选；不选专业表示全部专业，不选班级表示当前范围内全部班级</span>
      </div>
      <div class="form-grid">
        <label class="field-block">
          <span>管辖学院</span>
          <select v-model="draftScope.college" @change="onScopeCollegeChange">
            <option value="">选择学院</option>
            <option v-for="college in options.colleges" :key="college" :value="college">{{ college }}</option>
          </select>
        </label>
        <label class="field-block">
          <span>管辖年级</span>
          <select v-model="draftScope.grade" @change="onScopeGradeChange">
            <option value="">选择年级</option>
            <option v-for="grade in options.grades" :key="grade" :value="grade">{{ grade }}</option>
          </select>
        </label>
        <label class="field-block">
          <span>管辖专业（可选）</span>
          <select v-model="draftScope.major" :disabled="!draftScope.college || !draftScope.grade" @change="onScopeMajorChange">
            <option value="">全部专业</option>
            <option v-for="major in scopeMajors" :key="major" :value="major">{{ major }}</option>
          </select>
        </label>
        <div class="field-block">
          <span>限定班级（可多选）</span>
          <div class="class-check-list" :class="{ disabled: !draftScope.college || !draftScope.grade }">
            <label v-for="cls in scopeClasses" :key="cls.id" class="class-check-item">
              <input
                v-model="draftScope.class_ids"
                type="checkbox"
                :value="cls.id"
                :disabled="!draftScope.college || !draftScope.grade"
              />
              <span>{{ classDisplayName(cls) }}</span>
            </label>
            <span v-if="draftScope.college && draftScope.grade && !scopeClasses.length" class="class-empty">当前范围暂无可选班级</span>
            <span v-else-if="!draftScope.college || !draftScope.grade" class="class-empty">请先选择学院和年级</span>
          </div>
        </div>
      </div>
      <div class="scope-summary">
        <VIcon icon="mdi:information-outline" />
        <span>当前设置将按学院、年级、可选专业和所选班级限制学生查询及评价小组管理；未选择专业时覆盖全部专业。批次权限仍按学院、年级判断。</span>
      </div>
      <div class="scope-actions">
        <button class="btn-primary" @click="confirmScopeChange"><VIcon icon="mdi:check-circle-outline" />保存管辖范围</button>
        <span class="scope-tip">修改后需点击保存才会生效。</span>
      </div>
    </div>

    <div class="panel-card glass-card" v-else-if="view === 'students'">
      <div class="panel-header">
        <h3><VIcon icon="mdi:account-group-outline" />管辖范围内学生</h3>
        <span class="panel-count">{{ filteredStudents.length }} / {{ students.length }} 人</span>
      </div>
      <div class="search-bar">
        <VIcon icon="mdi:magnify" />
        <input v-model.trim="studentKeyword" placeholder="按姓名、学号、班级模糊搜索" />
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>学号</th><th>姓名</th><th>学院</th><th>年级</th><th>专业</th><th>班级</th><th>最新综测状态</th></tr>
          </thead>
          <tbody>
            <tr v-for="student in filteredStudents" :key="student.id">
              <td>{{ student.student_no }}</td>
              <td>{{ student.real_name || '-' }}</td>
              <td>{{ student.college || '-' }}</td>
              <td>{{ student.enrollment_grade || student.grade || '-' }}</td>
              <td>{{ student.major || '-' }}</td>
              <td>{{ student.class_name || '-' }}</td>
              <td><span class="status-text">{{ student.latest_status_label || '暂无综测表' }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="empty-line" v-if="!students.length">暂无学生，请先检查管辖范围设置。</div>
      <div class="empty-line" v-else-if="!filteredStudents.length">没有匹配的学生，请更换搜索关键词。</div>
    </div>

    <div class="panel-card glass-card" v-else-if="view === 'members'">
      <div class="panel-header">
        <h3><VIcon icon="mdi:account-multiple-check-outline" />评价小组成员管理</h3>
        <span class="panel-count">评价小组身份只在所选批次内有效</span>
      </div>
      <div class="member-toolbar">
        <label class="field-block batch-field">
          <span>目标批次</span>
          <select v-model.number="selectedBatchId">
            <option :value="0">选择需要赋权的已发布批次</option>
            <option v-for="batch in publishedBatches" :key="batch.id" :value="batch.id">{{ batch.title }}（{{ batch.college }} · {{ batch.grade }}）</option>
          </select>
        </label>
        <span v-if="!publishedBatches.length" class="scope-tip">当前还没有可以评价的批次。</span>
      </div>
      <div class="search-bar">
        <VIcon icon="mdi:magnify" />
        <input v-model.trim="studentKeyword" placeholder="按姓名、学号、班级查找成员候选人" />
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>学号</th><th>姓名</th><th>班级</th><th>所选批次身份</th><th>综测状态</th><th>操作</th></tr>
          </thead>
          <tbody>
            <tr v-for="student in filteredStudents" :key="student.id">
              <td>{{ student.student_no }}</td>
              <td>{{ student.real_name || '-' }}</td>
              <td>{{ student.class_name || '-' }}</td>
              <td><span class="tag" :class="{ active: isBatchMember(student.id) }">{{ isBatchMember(student.id) ? '已授权' : '未授权' }}</span></td>
              <td>{{ student.latest_status_label || '暂无综测表' }}</td>
              <td>
                <button class="btn-outline small" @click="toggleMember(student)" :disabled="!selectedBatchId">
                  {{ isBatchMember(student.id) ? '移除身份' : '赋予身份' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="empty-line" v-if="!students.length">暂无学生，请先检查管辖范围设置。</div>
      <div class="empty-line" v-else-if="!filteredStudents.length">没有匹配的学生，请更换搜索关键词。</div>
    </div>

    <div class="panel-card glass-card" v-else-if="view === 'assignments'">
      <div class="panel-header">
        <h3><VIcon icon="mdi:swap-horizontal-bold" />批次跨班互评配置</h3>
        <span class="panel-count">按管辖学院和年级匹配批次</span>
      </div>
      <div class="assignment-guide">
        <VIcon icon="mdi:lightbulb-outline" />
        <div>
          <strong>配置顺序</strong>
          <span>选择被评班级 → 选择其他班级作为评价班级。该评价班级中当前批次全部已授权评价小组成员都会自动获得评价资格，任务按工作量均衡分配。</span>
        </div>
      </div>
      <div class="batch-config" v-for="batch in batches" :key="batch.id">
        <div class="batch-title">
          <div>
            <strong>{{ batch.title }}</strong>
            <span>{{ batch.college }} · {{ batch.grade }} · {{ statusText(batch.status) }}</span>
          </div>
          <span class="relation-count">{{ batch.review_assignments?.length || 0 }} 条互评关系</span>
        </div>
        <div class="assignment-row" v-for="(item, index) in batch.review_assignments" :key="item.id || index">
          <label class="field-block">
            <span>被评班级</span>
            <select v-model.number="item.target_class_id" @change="syncClassName(item, 'target')">
              <option value="">请选择</option>
              <option v-for="cls in batchClasses(batch)" :key="cls.id" :value="cls.id">{{ classDisplayName(cls) }}</option>
            </select>
          </label>
          <label class="field-block">
            <span>评价班级</span>
            <select v-model.number="item.reviewer_class_id" @change="syncClassName(item, 'reviewer')">
              <option value="">请选择</option>
              <option v-for="cls in batchClasses(batch)" :key="cls.id" :value="cls.id" :disabled="Number(cls.id) === Number(item.target_class_id)">{{ classDisplayName(cls) }}</option>
            </select>
          </label>
          <button class="danger small row-delete" @click="batch.review_assignments.splice(index, 1)"><VIcon icon="mdi:trash-can-outline" />删除</button>
        </div>
        <div class="config-actions">
          <button class="btn-outline" @click="addAssignment(batch)"><VIcon icon="mdi:plus" />新增互评关系</button>
          <button class="btn-primary" @click="saveBatch(batch)"><VIcon icon="mdi:content-save-outline" />保存当前批次配置</button>
        </div>
      </div>
      <div class="empty-line" v-if="!batches.length">暂无与你管辖学院和年级匹配的批次。</div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { getBatches, getScopeOptions, getStudents, setAssessmentMember, updateBatch, updateCounselorScope } from '../../api/module3';
import { useUserStore } from '../../stores/user';

const props = defineProps({
  view: { type: String, default: 'scope' },
});

const router = useRouter();
const userStore = useUserStore();
const options = ref({ colleges: [], grades: [], classes: [], members: [], batch_memberships: [], students: [] });
const students = ref([]);
const batches = ref([]);
const selectedBatchId = ref(0);
const draftScope = ref({ college: '', grade: '', major: '', class_ids: [] });
const studentKeyword = ref('');

const view = computed(() => props.view);
const sectionMeta = computed(() => ({
  scope: { shortTitle: '管辖范围', title: '管辖范围设置', description: '设置辅导员负责的学院、年级、可选专业和班级范围；专业留空代表全部专业。', icon: 'mdi:map-marker-radius-outline' },
  students: { shortTitle: '学生信息', title: '管辖学生信息', description: '集中查看管辖范围内学生资料和最新综测状态。', icon: 'mdi:account-group-outline' },
  members: { shortTitle: '评价小组', title: '评价小组管理', description: '按具体批次赋予或移除学生的临时评价权限。', icon: 'mdi:account-multiple-check-outline' },
  assignments: { shortTitle: '跨班互评', title: '批次跨班互评配置', description: '为不同班级建立清晰的被评与评价关系。', icon: 'mdi:swap-horizontal-bold' },
}[view.value] || { shortTitle: '功能设置', title: '辅导员功能设置', description: '', icon: 'mdi:cog-outline' }));

const scopeMajors = computed(() => [...new Set(options.value.classes
  .filter(cls => (!draftScope.value.college || cls.college === draftScope.value.college)
    && (!draftScope.value.grade || cls.grade === draftScope.value.grade))
  .map(cls => String(cls.major || '').trim())
  .filter(Boolean))].sort());
const scopeClasses = computed(() => options.value.classes.filter(cls =>
  (!draftScope.value.college || cls.college === draftScope.value.college)
  && (!draftScope.value.grade || cls.grade === draftScope.value.grade)
  && (!draftScope.value.major || cls.major === draftScope.value.major)
));
const publishedBatches = computed(() => batches.value.filter(batch => batch.status === 'published'));
const filteredStudents = computed(() => {
  const keyword = studentKeyword.value.trim().toLowerCase();
  if (!keyword) return students.value;
  return students.value.filter(student => [student.real_name, student.student_no, student.class_name]
    .some(value => String(value || '').toLowerCase().includes(keyword)));
});

function statusText(status) {
  return ({ draft: '草稿', published: '已发布', closed: '已关闭', archived: '已归档' }[status] || status);
}

function batchClasses(batch) {
  const scopeMajor = draftScope.value.major || userStore.user?.scope?.major || '';
  return options.value.classes.filter(cls => cls.college === batch.college
    && cls.grade === batch.grade
    && (!scopeMajor || cls.major === scopeMajor));
}

function classDisplayName(cls) {
  const major = String(cls?.major || '').trim();
  const className = String(cls?.name || '').trim();
  if (!major) return className || '未命名班级';
  if (!className) return major;
  return className.startsWith(major) ? className : `${major}${className}`;
}

function onScopeCollegeChange() {
  draftScope.value.major = '';
  draftScope.value.class_ids = [];
}

function onScopeGradeChange() {
  draftScope.value.major = '';
  draftScope.value.class_ids = [];
}

function onScopeMajorChange() {
  draftScope.value.class_ids = [];
}

function isBatchMember(studentId, batchId = selectedBatchId.value) {
  return (options.value.batch_memberships || []).some(item => Number(item.batch_id) === Number(batchId) && Number(item.student_id) === Number(studentId) && item.status === 'active');
}


function syncClassName(item, type) {
  const key = type === 'target' ? 'target_class_id' : 'reviewer_class_id';
  const nameKey = type === 'target' ? 'target_class_name' : 'reviewer_class_name';
  const cls = options.value.classes.find(c => Number(c.id) === Number(item[key]));
  item[nameKey] = cls?.name || '';
}

async function load() {
  const [optionRes, studentRes, batchRes] = await Promise.all([getScopeOptions(), getStudents(), getBatches()]);
  if (optionRes.code === 200) options.value = optionRes.data;
  if (studentRes.code === 200) students.value = studentRes.data || [];
  if (batchRes.code === 200) {
    batches.value = (batchRes.data || []).filter(batch => ['draft', 'published'].includes(batch.status));
    const selectedStillAvailable = batches.value.some(batch => Number(batch.id) === Number(selectedBatchId.value) && batch.status === 'published');
    if (!selectedStillAvailable) selectedBatchId.value = batches.value.find(batch => batch.status === 'published')?.id || 0;
  }
  const savedScope = userStore.user?.scope;
  if (savedScope) draftScope.value = {
    college: savedScope.college || '',
    grade: savedScope.grade || '',
    major: savedScope.major || '',
    class_ids: savedScope.class_ids || [],
  };
}

async function confirmScopeChange() {
  if (!draftScope.value.college) return alert('请选择学院');
  if (!draftScope.value.grade) return alert('请选择年级');
  const res = await updateCounselorScope(draftScope.value);
  if (res.code === 200) {
    userStore.setAuth(userStore.token, res.data);
    alert('管辖范围修改已生效');
    await load();
  } else alert(res.msg);
}

async function toggleMember(student) {
  if (!selectedBatchId.value) return alert('请先选择一个已发布批次');
  const batch = batches.value.find(item => Number(item.id) === Number(selectedBatchId.value));
  const enabled = !isBatchMember(student.id);
  if (enabled) {
    const ok = window.confirm(`是否赋予 ${student.class_name || '该班级'} ${student.real_name || student.student_no} ${batch?.title || '当前批次'} 评价小组的身份？`);
    if (!ok) return;
    const res = await setAssessmentMember(student.id, { enabled: true, batch_id: selectedBatchId.value });
    if (res.code === 200) {
      alert('评价小组身份已更新');
      await load();
    } else alert(res.msg);
    return;
  }
  const payload = { enabled: false, batch_id: selectedBatchId.value };
  const mode = window.prompt('若该成员仍有待评任务，请输入处理方式：1=平均分配给剩余成员；2=指定分配给某个成员。没有待评任务可直接留空确定。');
  if (mode === '1') payload.transfer_mode = 'average';
  if (mode === '2') {
    const candidates = (options.value.batch_memberships || [])
      .filter(item => Number(item.batch_id) === Number(selectedBatchId.value) && Number(item.student_id) !== Number(student.id) && item.status === 'active');
    const text = candidates.map(item => `${item.student_id}: ${item.real_name || item.student_no}（${item.student_no}）`).join('\n');
    const target = window.prompt(`请输入接收人的学生ID：\n${text || '暂无可接收成员'}`);
    payload.transfer_mode = 'specific';
    payload.target_reviewer_id = Number(target || 0);
  }
  const res = await setAssessmentMember(student.id, payload);
  if (res.code === 200) {
    alert('评价小组身份已更新');
    await load();
  } else alert(res.msg);
}

function addAssignment(batch) {
  if (!batch.review_assignments) batch.review_assignments = [];
  batch.review_assignments.push({ id: `tmp-${Date.now()}`, target_class_id: '', target_class_name: '', reviewer_class_id: '', reviewer_class_name: '' });
}

async function saveBatch(batch) {
  const payload = JSON.parse(JSON.stringify(batch));
  payload.review_assignments = (payload.review_assignments || []).map(({ reviewer_ids, ...item }) => ({ ...item, id: String(item.id).startsWith('tmp-') ? 0 : item.id }));
  const res = await updateBatch(batch.id, payload);
  if (res.code === 200) {
    alert('互评配置已保存');
    await load();
  } else alert(res.msg);
}

onMounted(load);
</script>

<style scoped>
.counselor-console { display: flex; flex-direction: column; gap: 22px; animation: fadeIn .35s var(--easing-decelerate); }
.detail-header { display: flex; flex-direction: column; gap: 12px; }
.back-link { display: inline-flex; align-items: center; gap: 6px; width: fit-content; border: 0; background: transparent; color: var(--color-primary); cursor: pointer; padding: 0; }
.page-header { display: flex; justify-content: space-between; align-items: center; gap: 20px; }
.page-header h2 { margin-top: 5px; font-size: 24px; font-weight: var(--font-weight-semibold); }
.eyebrow { color: var(--color-text-tertiary); font-size: 12px; }
.page-desc { margin-top: 5px; color: var(--color-text-secondary); font-size: 14px; }
.section-icon { display: inline-flex; align-items: center; justify-content: center; width: 52px; height: 52px; border-radius: 8px !important; background: color-mix(in srgb, var(--color-primary) 12%, transparent); color: var(--color-primary); font-size: 27px; }
.panel-card { padding: 24px; border-radius: 8px !important; display: flex; flex-direction: column; gap: 16px; }
.panel-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.panel-header h3 { display: flex; align-items: center; gap: 8px; font-size: 17px; }
.panel-count { color: var(--color-text-secondary); font-size: 13px; }
.form-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.field-block { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.field-block > span { color: var(--color-text-secondary); font-size: 12px; }
.scope-summary, .assignment-guide { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border-radius: 8px !important; background: var(--color-bg); color: var(--color-text-secondary); font-size: 13px; line-height: 1.6; }
.assignment-guide > svg, .scope-summary > svg { flex: 0 0 auto; margin-top: 2px; color: var(--color-primary); }
.assignment-guide div { display: flex; flex-direction: column; gap: 2px; }
.assignment-guide strong { color: var(--color-text-primary); }
.scope-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.scope-tip { color: var(--color-text-secondary); font-size: 13px; }
.member-toolbar { display: flex; align-items: flex-end; gap: 14px; flex-wrap: wrap; }
.batch-field { min-width: min(440px, 100%); }
.search-bar { display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 13px; border: 1px solid var(--color-border); border-radius: 8px !important; background: var(--color-bg); }
.search-bar input { flex: 1; border: none; background: transparent; padding: 0; min-height: auto; }
input, select { min-height: 42px; border: 1px solid var(--color-border); border-radius: 8px !important; padding: 8px 12px; background: var(--color-bg); color: var(--color-text-primary); outline: none; }
.class-check-list { min-height: 96px; max-height: 190px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; border: 1px solid var(--color-border); border-radius: 8px !important; background: var(--color-bg); }
.class-check-list.disabled { opacity: .62; }
.class-check-item { display: flex; align-items: center; gap: 9px; min-height: 26px; cursor: pointer; color: var(--color-text-primary); font-size: 13px; }
.class-check-item input[type="checkbox"] { width: 16px; height: 16px; min-height: 0; flex: 0 0 16px; margin: 0; padding: 0; border-radius: 3px !important; accent-color: var(--color-primary); cursor: pointer; }
.class-check-item input[type="checkbox"]:disabled { cursor: not-allowed; }
.class-empty { color: var(--color-text-tertiary); font-size: 12px; line-height: 1.6; }
.btn-primary, .btn-outline, .danger { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 38px; padding: 0 14px; border-radius: 8px !important; cursor: pointer; white-space: nowrap; }
.btn-outline:disabled { opacity: .55; cursor: not-allowed; }
.btn-primary { border: none; background: var(--gradient-primary); color: white; }
.btn-outline { border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-primary); }
.danger { border: 1px solid rgba(239,68,68,.35); color: #ef4444; background: rgba(239,68,68,.08); }
.small { min-height: 32px; font-size: 12px; }
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 12px; border-bottom: 1px solid var(--color-border); font-size: 13px; white-space: nowrap; }
th { color: var(--color-text-secondary); font-weight: var(--font-weight-medium); }
.status-text { color: var(--color-text-secondary); }
.tag { padding: 4px 10px; border-radius: 8px !important; background: var(--color-bg); color: var(--color-text-secondary); }
.tag.active { background: rgba(52,168,83,.12); color: #34a853; }
.batch-config { padding: 17px; border: 1px solid var(--color-border); border-radius: 8px !important; background: var(--color-bg); display: flex; flex-direction: column; gap: 14px; }
.batch-title { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.batch-title > div { display: flex; flex-direction: column; gap: 4px; }
.batch-title span { color: var(--color-text-secondary); font-size: 13px; }
.relation-count { padding: 4px 10px; border-radius: 8px !important; background: var(--color-surface); }
.assignment-row { display: grid; grid-template-columns: 1fr 1fr auto; gap: 10px; align-items: end; padding-top: 12px; border-top: 1px solid var(--color-border); }
.row-delete { margin-bottom: 2px; }
.config-actions { display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap; }
.empty-line { padding: 30px; text-align: center; color: var(--color-text-tertiary); }
@media (max-width: 900px) {
  .form-grid, .assignment-row { grid-template-columns: 1fr; }
  .page-header, .panel-header, .batch-title { align-items: flex-start; flex-direction: column; }
  .section-icon { display: none; }
  .config-actions { justify-content: stretch; }
}

/* 模块三局部圆角兜底：仅作用于当前模块三组件树，不影响顶部导航及其他模块。 */
:deep(*) {
  border-radius: 8px !important;
}

</style>
