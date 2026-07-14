<template>
  <Module3FeatureMenu
    v-if="view === 'menu'"
    title="个人中心"
    description="个人资料和密码安全分开设置，进入详情页后只显示当前要处理的内容。"
    :back-path="workbenchPath"
    back-label="返回管理员工作台"
    :cards="menuCards"
  />

  <div v-else class="profile-page">
    <button class="back-link" @click="$router.push('/module3/profile')"><VIcon icon="mdi:arrow-left" />返回个人中心</button>
    <div class="page-header">
      <h2>{{ view === 'password' ? '修改密码' : '基础信息' }}</h2>
      <p class="page-desc">{{ view === 'password' ? '验证原密码后设置新的登录密码。' : '完善账号资料；学生资料未完整时不能填写综测。' }}</p>
    </div>

    <div class="profile-alert glass-card" v-if="view === 'basic' && missingFields.length">
      <VIcon icon="mdi:alert-circle-outline" />
      <div>
        <strong>资料尚未完善</strong>
        <p>请补全：{{ missingFields.join('、') }}</p>
      </div>
    </div>

    <section class="profile-card glass-card" v-if="view === 'basic'">
      <div class="section-head">
        <h3><VIcon icon="mdi:account-edit-outline" />基础信息</h3>
        <span>{{ roleLabel }}</span>
      </div>
      <div class="form-grid">
        <label v-if="isStudent">
          <span>学号</span>
          <input v-model="profile.student_no" disabled />
        </label>
        <label v-if="isStudent">
          <span>姓名 *</span>
          <input v-model="profile.real_name" placeholder="请输入姓名" />
        </label>
        <label>
          <span>学院<span v-if="isStudent || isCounselor"> *</span></span>
          <select v-model="profile.college" :disabled="isNoProfileRequired" @change="onCollegeChange">
            <option value="">请选择学院</option>
            <option v-for="college in org.colleges" :key="college.name" :value="college.name">{{ college.name }}</option>
          </select>
        </label>
        <label>
          <span>年级<span v-if="isStudent || isCounselor"> *</span></span>
          <select v-model="profile.grade" :disabled="isNoProfileRequired || !profile.college" @change="onGradeChange">
            <option value="">请选择年级</option>
            <option v-for="grade in gradeOptions" :key="grade" :value="grade">{{ grade }}</option>
          </select>
        </label>
        <label v-if="isStudent">
          <span>专业 *</span>
          <select v-model="profile.major" @change="onMajorChange" :disabled="!profile.college">
            <option value="">请选择专业</option>
            <option v-for="major in majorOptions" :key="major.id" :value="major.name">{{ major.name }}</option>
          </select>
        </label>
        <label v-if="isStudent">
          <span>班级 *</span>
          <select v-model="profile.class_name" :disabled="!profile.college || !profile.major || !profile.grade">
            <option value="">请选择班级</option>
            <option v-for="cls in classOptions" :key="cls.id" :value="cls.name">{{ cls.name }}</option>
          </select>
        </label>
        <label>
          <span>手机号</span>
          <input v-model="profile.phone" placeholder="选填" />
        </label>
      </div>
      <div class="actions">
        <button class="btn-primary" @click="saveProfile" :disabled="saving">
          <VIcon icon="mdi:content-save-outline" />{{ saving ? '保存中...' : '保存个人信息' }}
        </button>
      </div>
    </section>

    <section class="profile-card glass-card" v-if="view === 'password'">
      <div class="section-head">
        <h3><VIcon icon="mdi:lock-reset" />修改密码</h3>
        <span>至少 6 位</span>
      </div>
      <div class="form-grid">
        <label>
          <span>原密码</span>
          <input v-model="pwd.old_password" type="password" placeholder="请输入原密码" />
        </label>
        <label>
          <span>新密码</span>
          <input v-model="pwd.new_password" type="password" placeholder="请输入新密码" />
        </label>
        <label>
          <span>确认新密码</span>
          <input v-model="pwd.confirm" type="password" placeholder="请再次输入新密码" />
        </label>
      </div>
      <div class="actions">
        <button class="btn-outline" @click="updatePwd" :disabled="changing">
          <VIcon icon="mdi:key-change" />{{ changing ? '修改中...' : '修改密码' }}
        </button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import Module3FeatureMenu from './Module3FeatureMenu.vue';
import { getProfile, updateProfile, changePassword } from '../../api/auth';
import { getOrganizations } from '../../api/module3';
import { useUserStore } from '../../stores/user';

const props = defineProps({ view: { type: String, default: 'menu' } });
const view = computed(() => props.view || 'menu');
const userStore = useUserStore();
const profile = ref({ real_name: '', student_no: '', college: '', grade: '', major: '', class_name: '', phone: '' });
const pwd = ref({ old_password: '', new_password: '', confirm: '' });
const saving = ref(false);
const changing = ref(false);
const org = ref({ colleges: [], majors: [], classes: [] });

const workbenchPath = computed(() => ({ admin: '/module3/admin', counselor: '/module3/counselor', student_affairs: '/module3/student-affairs', student: '/module3/student' }[userStore.user?.role] || '/module3/student'));
const menuCards = [
  { title: '基础信息', description: '维护姓名、学院、年级、专业、班级和手机号', icon: 'mdi:account-edit-outline', to: '/module3/profile/basic' },
  { title: '修改密码', description: '验证原密码并设置至少 6 位的新密码', icon: 'mdi:lock-reset', to: '/module3/profile/password' },
];
const roleLabel = computed(() => userStore.user?.role_name || userStore.user?.role || '-');
const isStudent = computed(() => userStore.user?.role === 'student');
const isCounselor = computed(() => userStore.user?.role === 'counselor');
const isNoProfileRequired = computed(() => ['admin', 'student_affairs'].includes(userStore.user?.role));
const missingFields = computed(() => userStore.user?.profile_missing_fields || []);
const selectedCollege = computed(() => org.value.colleges.find(item => item.name === profile.value.college));
const majorOptions = computed(() => org.value.majors.filter(item => !selectedCollege.value || Number(item.college_id) === Number(selectedCollege.value.id)));
const gradeOptions = computed(() => [...new Set(org.value.classes
  .filter(cls => !profile.value.college || cls.college === profile.value.college)
  .map(cls => cls.grade)
  .filter(Boolean))].sort().reverse());
const classOptions = computed(() => org.value.classes.filter(cls => cls.college === profile.value.college && cls.major === profile.value.major && cls.grade === profile.value.grade));

function onCollegeChange() {
  profile.value.major = '';
  profile.value.grade = '';
  profile.value.class_name = '';
}
function onMajorChange() {
  profile.value.class_name = '';
}
function onGradeChange() {
  profile.value.class_name = '';
}

function assignProfile(user) {
  profile.value = {
    real_name: user.real_name || '',
    student_no: user.student_no || user.username || '',
    college: user.scope?.college || user.college || '',
    grade: user.scope?.grade || user.grade || '',
    major: user.major || '',
    class_name: user.class_name || '',
    phone: user.phone || '',
  };
}

async function loadOrganizations() {
  const res = await getOrganizations();
  if (res.code === 200) org.value = res.data || { colleges: [], majors: [], classes: [] };
}

async function loadProfile() {
  const res = await getProfile();
  if (res.code === 200) {
    userStore.setAuth(userStore.token, res.data);
    assignProfile(res.data);
  } else {
    alert(res.msg || '加载个人信息失败');
  }
}

async function saveProfile() {
  saving.value = true;
  try {
    const res = await updateProfile(profile.value);
    if (res.code === 200) {
      userStore.setAuth(userStore.token, res.data);
      assignProfile(res.data);
      alert('个人信息已保存');
    } else {
      alert(res.msg || '保存失败');
    }
  } finally {
    saving.value = false;
  }
}

async function updatePwd() {
  if (!pwd.value.old_password || !pwd.value.new_password) return alert('请填写原密码和新密码');
  if (pwd.value.new_password !== pwd.value.confirm) return alert('两次输入的新密码不一致');
  changing.value = true;
  try {
    const res = await changePassword({ old_password: pwd.value.old_password, new_password: pwd.value.new_password });
    if (res.code === 200) {
      pwd.value = { old_password: '', new_password: '', confirm: '' };
      alert('密码修改成功');
    } else {
      alert(res.msg || '修改失败');
    }
  } finally {
    changing.value = false;
  }
}

onMounted(async () => {
  await loadOrganizations();
  await loadProfile();
});
</script>

<style scoped>
.back-link { display:inline-flex; align-items:center; gap:6px; width:fit-content; border:0; padding:0; background:transparent; color:var(--color-primary); cursor:pointer; }
.profile-page { display: flex; flex-direction: column; gap: 22px; animation: fadeIn 0.35s var(--easing-decelerate); }
.page-header h2 { font-size: 22px; font-weight: var(--font-weight-semibold); }
.page-desc { font-size: 14px; color: var(--color-text-secondary); margin-top: 4px; }
.profile-alert, .profile-card { padding: 20px; border-radius: 8px !important; }
.profile-alert { display: flex; gap: 12px; align-items: flex-start; background: rgba(245, 158, 11, 0.12); }
.profile-alert svg { font-size: 24px; color: #d97706; }
.profile-alert p { margin-top: 4px; color: var(--color-text-secondary); }
.section-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.section-head h3 { display: flex; align-items: center; gap: 8px; font-size: 16px; }
.section-head span { color: var(--color-text-secondary); font-size: 13px; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.form-grid label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--color-text-secondary); }
.form-grid input, .form-grid select { height: 40px; padding: 0 12px; border: 1px solid var(--color-border); border-radius: 8px !important; outline: none; background: var(--color-surface); color: var(--color-text-primary); }
.form-grid input:focus, .form-grid select:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
.form-grid input:disabled, .form-grid select:disabled { opacity: 0.7; cursor: not-allowed; }
.actions { display: flex; justify-content: flex-end; margin-top: 18px; }
.btn-primary, .btn-outline { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 40px; padding: 0 18px; border-radius: 8px !important; cursor: pointer; }
.btn-primary { border: none; color: #fff; background: var(--gradient-primary); }
.btn-outline { border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-primary); }
.btn-primary:disabled, .btn-outline:disabled { opacity: .6; cursor: not-allowed; }
@media (max-width: 720px) { .form-grid { grid-template-columns: 1fr; } }

/* 模块三局部圆角兜底：仅作用于当前模块三组件树，不影响顶部导航及其他模块。 */
:deep(*) {
  border-radius: 8px !important;
}

</style>
