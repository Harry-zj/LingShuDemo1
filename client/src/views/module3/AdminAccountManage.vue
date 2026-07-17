<template>
  <Module3FeatureMenu
    v-if="view === 'menu'"
    title="账号管理"
    description="先选择具体账号操作，再进入单独页面。创建、导入、生成、重置和查询互不干扰。"
    back-path="/module3/admin"
    back-label="返回管理员工作台"
    :cards="menuCards"
  />

  <div v-else class="admin-page">
    <button class="back-link" @click="$router.push('/module3/account-manage')"><VIcon icon="mdi:arrow-left" />返回账号管理</button>
    <div class="page-header">
      <h2>{{ pageTitle }}</h2>
      <p class="page-desc">{{ pageDescription }}</p>
    </div>

    <section class="panel glass-card" v-if="view === 'manual'">
      <div class="panel-header"><h3><VIcon icon="mdi:account-plus-outline" />手动创建学生</h3></div>
      <div class="form-grid">
        <input v-model="student.student_no" placeholder="学号（必填，初始密码=学号）" />
        <input v-model="student.real_name" placeholder="姓名（选填）" />
        <select v-model="student.college" @change="onStudentCollegeChange">
          <option value="">学院（选填）</option>
          <option v-for="college in activeColleges" :key="college.id" :value="college.name">{{ college.name }}</option>
        </select>
        <select v-model="student.major" :disabled="!student.college" @change="onStudentMajorChange">
          <option value="">专业（选填）</option>
          <option v-for="major in studentMajorOptions" :key="major.id" :value="major.name">{{ major.name }}</option>
        </select>
        <select v-model="student.grade" :disabled="!student.college" @change="onStudentGradeChange">
          <option value="">年级（选填）</option>
          <option v-for="grade in studentGradeOptions" :key="grade" :value="grade">{{ grade }}</option>
        </select>
        <select v-model="student.class_name" :disabled="!student.college || !student.major || !student.grade">
          <option value="">班级（选填）</option>
          <option v-for="cls in studentClassOptions" :key="cls.id" :value="cls.name">{{ cls.name }}</option>
        </select>
      </div>
      <p class="hint organization-hint">学院、专业、年级和班级均来自组织结构管理；请先维护组织数据，再为学生选择归属信息。</p>
      <button class="btn-primary" @click="createStudent">创建学生账号</button>
    </section>

    <section class="panel glass-card" v-if="view === 'import'">
      <div class="panel-header"><h3><VIcon icon="mdi:file-upload-outline" />文本导入学生</h3></div>
      <input type="file" accept=".txt,text/plain" @change="readFile" />
      <textarea v-model="importText" rows="10" placeholder="每行一个学号，例如：\n2024001001\n2024001002"></textarea>
      <button class="btn-primary" @click="importStudents">开始导入</button>
    </section>

    <section class="panel glass-card" v-if="view === 'generate'">
      <div class="panel-header"><h3><VIcon icon="mdi:account-multiple-plus-outline" />批量生成账号</h3></div>
      <div class="inline-form">
        <select v-model="generate.role">
          <option value="counselor">辅导员（c开头）</option>
          <option value="student_affairs">学生工作处（w开头）</option>
        </select>
        <input v-model.number="generate.count" type="number" min="1" max="200" />
        <button class="btn-primary" @click="generateAccounts">生成</button>
      </div>
      <p class="hint">生成后会显示账号清单，初始密码与账号相同。</p>
    </section>

    <section class="panel glass-card" v-if="view === 'reset'">
      <div class="panel-header"><h3><VIcon icon="mdi:lock-reset" />重置密码</h3></div>
      <div class="inline-form">
        <input v-model="resetAccount" placeholder="输入学号或账号" />
        <button class="btn-outline" @click="resetPwd">重置为 000000</button>
      </div>
    </section>

    <section class="panel glass-card" v-if="view === 'list'">
      <div class="panel-header">
        <h3><VIcon icon="mdi:account-search-outline" />账号列表</h3>
        <div class="filters">
          <select v-model="query.role" @change="loadUsers">
            <option value="">全部角色</option>
            <option value="student">学生</option>
            <option value="counselor">辅导员</option>
            <option value="student_affairs">学生工作处</option>
            <option value="admin">管理员</option>
          </select>
          <input v-model="query.keyword" @keyup.enter="loadUsers" placeholder="搜索账号/学号/姓名/班级" />
          <button class="btn-outline" @click="loadUsers">搜索</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>账号/学号</th><th>角色</th><th>姓名</th><th>学院</th><th>年级</th><th>专业</th><th>班级</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="u in users" :key="u.id">
              <td>{{ u.account }}</td><td>{{ u.role_name }}</td><td>{{ u.real_name || '-' }}</td><td>{{ u.college || '-' }}</td><td>{{ u.grade || '-' }}</td><td>{{ u.major || '-' }}</td><td>{{ u.class_name || '-' }}</td>
              <td>
                <button
                  class="link-danger"
                  :disabled="deletingId === u.id || Number(userStore.user?.id) === Number(u.id)"
                  @click="deleteAccount(u)"
                >{{ deletingId === u.id ? '删除中...' : '删除账号' }}</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel glass-card" v-if="view !== 'list' && (latestResult.length || importResult)">
      <div class="panel-header"><h3><VIcon icon="mdi:clipboard-text-outline" />本次处理结果</h3></div>
      <div v-if="latestResult.length" class="result-list">
        <div v-for="item in latestResult" :key="item.account" class="result-row">
          <strong>{{ item.account }}</strong><span>初始密码：{{ item.password }}</span><small>{{ item.role_name || '学生' }}</small>
        </div>
      </div>
      <div v-if="importResult" class="import-summary">
        <span>成功 {{ importResult.success?.length || 0 }}</span>
        <span>重复 {{ importResult.duplicated?.length || 0 }}</span>
        <span>无效 {{ importResult.invalid?.length || 0 }}</span>
        <span>失败 {{ importResult.failed?.length || 0 }}</span>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import Module3FeatureMenu from './Module3FeatureMenu.vue';
import { adminCreateStudent, adminDeleteUser, adminGenerateAccounts, adminImportStudents, adminListUsers, adminResetPassword, getOrganizations } from '../../api/module3';
import { useUserStore } from '../../stores/user';

const props = defineProps({ view: { type: String, default: 'menu' } });
const view = computed(() => props.view || 'menu');
const userStore = useUserStore();
const menuCards = [
  { title: '手动创建学生', description: '逐个录入学号和可选个人信息，初始密码与学号相同', icon: 'mdi:account-plus-outline', to: '/module3/account-manage/manual' },
  { title: '文本导入学生', description: '上传或粘贴每行一个学号的纯文本，自动跳过重复账号', icon: 'mdi:file-upload-outline', to: '/module3/account-manage/import' },
  { title: '批量生成账号', description: '按角色批量生成辅导员或学生工作处账号', icon: 'mdi:account-multiple-plus-outline', to: '/module3/account-manage/generate' },
  { title: '重置账号密码', description: '按账号将任意用户密码统一重置为 000000', icon: 'mdi:lock-reset', to: '/module3/account-manage/reset' },
  { title: '账号列表', description: '按角色和关键词查询账号及个人归属信息', icon: 'mdi:account-search-outline', to: '/module3/account-manage/list' },
];
const pageMeta = {
  manual: ['手动创建学生', '为单个学生创建账号，账号和初始密码均为学号。'],
  import: ['文本导入学生', '每行填写一个学号，系统自动创建并提示重复、无效和失败记录。'],
  generate: ['批量生成账号', '批量生成辅导员或学生工作处账号，并展示初始密码。'],
  reset: ['重置账号密码', '根据账号将密码重置为 000000。'],
  list: ['账号列表', '集中查询学生、辅导员、学生工作处和管理员账号。'],
};
const pageTitle = computed(() => pageMeta[view.value]?.[0] || '账号管理');
const pageDescription = computed(() => pageMeta[view.value]?.[1] || '');

const student = ref({ student_no: '', real_name: '', college: '', major: '', grade: '', class_name: '' });
const org = ref({ colleges: [], majors: [], classes: [] });
const activeColleges = computed(() => org.value.colleges.filter(item => item.is_active !== 0 && item.is_active !== false));
const selectedStudentCollege = computed(() => activeColleges.value.find(item => item.name === student.value.college));
const studentMajorOptions = computed(() => org.value.majors.filter(item =>
  item.is_active !== 0
  && item.is_active !== false
  && selectedStudentCollege.value
  && Number(item.college_id) === Number(selectedStudentCollege.value.id)
));
const activeStudentClasses = computed(() => org.value.classes.filter(item => item.status !== 'inactive'));
const studentGradeOptions = computed(() => [...new Set(activeStudentClasses.value
  .filter(cls => cls.college === student.value.college && (!student.value.major || cls.major === student.value.major))
  .map(cls => cls.grade)
  .filter(Boolean))].sort().reverse());
const studentClassOptions = computed(() => activeStudentClasses.value.filter(cls =>
  cls.college === student.value.college
  && cls.major === student.value.major
  && cls.grade === student.value.grade
));
const importText = ref('');
const importResult = ref(null);
const latestResult = ref([]);
const generate = ref({ role: 'counselor', count: 1 });
const resetAccount = ref('');
const users = ref([]);
const query = ref({ role: '', keyword: '' });
const deletingId = ref(0);

function onStudentCollegeChange() {
  student.value.major = '';
  student.value.grade = '';
  student.value.class_name = '';
}
function onStudentMajorChange() {
  student.value.grade = '';
  student.value.class_name = '';
}
function onStudentGradeChange() {
  student.value.class_name = '';
}
async function loadOrganizations() {
  const res = await getOrganizations();
  if (res.code === 200) org.value = res.data || { colleges: [], majors: [], classes: [] };
  else alert(res.msg || '加载组织数据失败');
}

async function loadUsers() {
  const res = await adminListUsers(query.value);
  if (res.code === 200) users.value = res.data || [];
  else alert(res.msg || '加载账号失败');
}
async function createStudent() {
  const res = await adminCreateStudent(student.value);
  if (res.code === 200) {
    latestResult.value = [res.data]; importResult.value = null;
    student.value = { student_no: '', real_name: '', college: '', major: '', grade: '', class_name: '' };
    alert('学生账号已创建');
  } else alert(res.msg || '创建失败');
}
function readFile(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { importText.value = String(reader.result || ''); };
  reader.readAsText(file, 'utf-8');
}
async function importStudents() {
  const res = await adminImportStudents({ text: importText.value });
  if (res.code === 200) {
    importResult.value = res.data; latestResult.value = res.data.success || [];
    alert('导入处理完成');
  } else alert(res.msg || '导入失败');
}
async function generateAccounts() {
  const res = await adminGenerateAccounts(generate.value);
  if (res.code === 200) {
    latestResult.value = res.data || []; importResult.value = null;
    alert('账号已生成');
  } else alert(res.msg || '生成失败');
}
async function resetPwd() {
  const res = await adminResetPassword({ account: resetAccount.value });
  if (res.code === 200) {
    latestResult.value = [res.data]; importResult.value = null; resetAccount.value = '';
    alert('密码已重置为 000000');
  } else alert(res.msg || '重置失败');
}
async function deleteAccount(user) {
  if (Number(userStore.user?.id) === Number(user.id)) return alert('不能删除当前登录的管理员账号');
  const ok = window.confirm(`确认删除账号“${user.account}”吗？删除后该账号将立即无法登录，历史业务数据会保留。`);
  if (!ok) return;
  deletingId.value = user.id;
  try {
    const res = await adminDeleteUser(user.id);
    if (res.code === 200) {
      alert('账号已删除');
      await loadUsers();
    } else alert(res.msg || '删除失败');
  } finally {
    deletingId.value = 0;
  }
}

watch(view, value => {
  if (value === 'list') loadUsers();
  if (value === 'manual') loadOrganizations();
}, { immediate: true });
</script>

<style scoped>
.admin-page { display:flex; flex-direction:column; gap:22px; animation:fadeIn .35s var(--easing-decelerate); }
.page-header h2 { font-size:22px; font-weight:var(--font-weight-semibold); }
.page-desc, .hint { color:var(--color-text-secondary); font-size:13px; margin-top:4px; }
.organization-hint { margin-top:12px; }
.panel { padding:22px; border-radius: 8px !important; }
.panel-header { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:16px; }
.panel-header h3 { display:flex; align-items:center; gap:8px; font-size:16px; }
.form-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
input, select, textarea { width:100%; border:1px solid var(--color-border); border-radius: 8px !important; background:var(--color-surface); color:var(--color-text-primary); padding:10px 12px; outline:none; font-family:inherit; }
textarea { margin-top:10px; resize:vertical; }
.inline-form { display:flex; gap:10px; align-items:center; }
.inline-form input, .inline-form select { flex:1; }
.btn-primary, .btn-outline { display:inline-flex; align-items:center; justify-content:center; gap:6px; height:40px; padding:0 16px; border-radius: 8px !important; cursor:pointer; white-space:nowrap; margin-top:14px; }
.inline-form .btn-primary, .inline-form .btn-outline { margin-top:0; }
.btn-primary { border:0; background:var(--gradient-primary); color:#fff; }
.btn-outline { border:1px solid var(--color-border); background:var(--color-surface); color:var(--color-text-primary); }
.result-list { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; }
.result-row { display:flex; flex-direction:column; gap:4px; padding:12px; border-radius: 8px !important; background:var(--color-bg); }
.result-row span, .result-row small { color:var(--color-text-secondary); }
.import-summary { display:flex; gap:16px; margin-top:12px; color:var(--color-text-secondary); flex-wrap:wrap; }
.filters { display:flex; gap:8px; align-items:center; }
.table-wrap { overflow:auto; }
table { width:100%; border-collapse:collapse; font-size:13px; }
th, td { padding:10px; border-bottom:1px solid var(--color-border); text-align:left; white-space:nowrap; }
th { color:var(--color-text-secondary); font-weight:600; }
.link-danger { border:0; background:transparent; color:#dc2626; cursor:pointer; padding:4px 0; }
.link-danger:disabled { opacity:.45; cursor:not-allowed; }
.back-link { display:inline-flex; align-items:center; gap:6px; width:fit-content; border:0; padding:0; background:transparent; color:var(--color-primary); cursor:pointer; }
@media (max-width:900px) { .form-grid, .result-list { grid-template-columns:1fr; } .panel-header, .filters, .inline-form { flex-direction:column; align-items:stretch; } }

/* 模块三局部圆角兜底：仅作用于当前模块三组件树，不影响顶部导航及其他模块。 */
:deep(*) {
  border-radius: 8px !important;
}

</style>
