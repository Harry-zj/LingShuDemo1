<template>
  <div class="login-wrapper">
    <div class="login-brand">
      <VIcon icon="mdi:brain" class="brand-icon" />
      <h1 class="brand-title">灵枢</h1>
      <p class="brand-desc">高校综测智能填写与决策平台</p>
    </div>
    <div class="login-card glass-card">
      <h2 class="login-title">欢迎回来</h2>
      <p class="login-subtitle">请选择角色并登录您的账号</p>
      <form @submit.prevent="handleLogin" class="login-form">
        <div class="field-group">
          <label class="field-label">角色</label>
          <div class="input-wrapper" :class="{ focused: focusField === 'role', filled: form.role }">
            <VIcon icon="mdi:shield-account-outline" class="input-icon" />
            <select v-model="form.role" @focus="focusField = 'role'" @blur="focusField = ''" class="role-select">
              <option value="">自动识别角色</option>
              <option v-for="(label, key) in ROLE_OPTIONS" :key="key" :value="key">{{ label }}</option>
            </select>
          </div>
        </div>
        <div class="field-group">
          <label class="field-label">用户名</label>
          <div class="input-wrapper" :class="{ focused: focusField === 'username', filled: form.username }">
            <VIcon icon="mdi:account-outline" class="input-icon" />
            <input v-model="form.username" placeholder="请输入用户名" required @focus="focusField = 'username'" @blur="focusField = ''" />
          </div>
        </div>
        <div class="field-group">
          <label class="field-label">密码</label>
          <div class="input-wrapper" :class="{ focused: focusField === 'password', filled: form.password }">
            <VIcon icon="mdi:lock-outline" class="input-icon" />
            <input v-model="form.password" type="password" placeholder="请输入密码" required @focus="focusField = 'password'" @blur="focusField = ''" />
          </div>
        </div>
        <button type="submit" class="btn-login" :disabled="loading">
          <span v-if="!loading">登录</span>
          <span v-else class="btn-loading"><VIcon icon="mdi:loading" class="spin" />登录中...</span>
        </button>
      </form>
      <p class="login-tip">
<br />没有账号？<router-link to="/register">立即注册</router-link>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { login } from '../../api/auth';
import { useUserStore } from '../../stores/user';
import { useRouter } from 'vue-router';

const userStore = useUserStore();
const router = useRouter();
const form = ref({ username: '', password: '', role: '' });
const loading = ref(false);
const focusField = ref('');

const ROLE_OPTIONS = {
  student: '学生',
  admin: '管理员',
  class_committee: '班级测评小组',
  counselor: '辅导员',
  student_affairs: '学生工作处',
};

// 角色到首页路由映射
const ROLE_HOME = {
  admin: '/module3/batch-manage',
  class_committee: '/module3/class-leader',
  counselor: '/module3/class-leader',
  student_affairs: '/module3/class-leader',
};

async function handleLogin() {
  loading.value = true;
  try {
    const res = await login(form.value);
    if (res.code === 200) {
      userStore.setAuth(res.data.token, res.data.user);
      const role = res.data.user.role;
      router.push(ROLE_HOME[role] || '/home');
    } else {
      alert(res.msg);
    }
  } catch (e) {
    alert('登录失败，请检查网络连接');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-wrapper { display: flex; flex-direction: column; align-items: center; gap: 32px; width: 100%; max-width: 420px; animation: fadeInUp 0.6s var(--easing-spring); }
.login-brand { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.brand-icon { font-size: 48px; color: var(--color-primary); filter: drop-shadow(0 0 16px rgba(99,102,241,0.4)); animation: float 4s ease-in-out infinite; }
.brand-title { font-size: 28px; font-weight: var(--font-weight-bold); color: var(--color-text); letter-spacing: var(--letter-spacing-wider); }
.brand-desc { font-size: 14px; color: var(--color-text-secondary); }
.login-card { width: 100%; padding: 40px 32px; border-radius: var(--radius-xl); animation: scaleIn 0.5s var(--easing-spring) 0.1s both; }
.login-card.glass-card:hover { transform: translateY(-2px); }
.login-title { font-size: 22px; font-weight: var(--font-weight-semibold); color: var(--color-text); margin-bottom: 4px; }
.login-subtitle { font-size: 14px; color: var(--color-text-secondary); margin-bottom: 28px; }
.login-form { display: flex; flex-direction: column; gap: 20px; }
.field-group { display: flex; flex-direction: column; gap: 6px; }
.field-label { font-size: 13px; font-weight: var(--font-weight-medium); color: var(--color-text-secondary); padding-left: 4px; }
.input-wrapper { display: flex; align-items: center; gap: 10px; padding: 0 14px; border: 2px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-white); transition: all var(--duration-fast) var(--easing-standard); }
.input-wrapper:hover { border-color: var(--color-gray); }
.input-wrapper.focused { border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(79,70,229,0.12); }
.input-wrapper.filled { border-color: var(--color-primary); }
.input-icon { font-size: 20px; color: var(--color-text-tertiary); flex-shrink: 0; transition: color var(--duration-fast) var(--easing-standard); }
.input-wrapper.focused .input-icon, .input-wrapper.filled .input-icon { color: var(--color-primary); }
.input-wrapper input, .input-wrapper select { width: 100%; padding: 12px 0; border: none; background: transparent; font-size: 15px; color: var(--color-text); outline: none; font-family: inherit; }
.input-wrapper select { cursor: pointer; }
.role-select { appearance: none; -webkit-appearance: none; background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath fill='%23999' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E") no-repeat right center; padding-right: 24px; }
.input-wrapper input::placeholder { color: var(--color-text-tertiary); }
.btn-login { width: 100%; padding: 14px; background: var(--color-primary-gradient-bright); color: white; border: none; border-radius: var(--radius-full); font-size: 16px; font-weight: var(--font-weight-semibold); cursor: pointer; position: relative; overflow: hidden; transition: all var(--duration-normal) var(--easing-spring); margin-top: 4px; box-shadow: 0 4px 20px rgba(99,102,241,0.3); }
.btn-login:hover:not(:disabled) { box-shadow: 0 8px 32px rgba(99,102,241,0.4); transform: translateY(-1px); }
.btn-login:active:not(:disabled) { transform: translateY(0) scale(0.98); }
.btn-login:disabled { opacity: 0.7; cursor: not-allowed; }
.btn-loading { display: flex; align-items: center; justify-content: center; gap: 8px; }
.spin { animation: spin 0.8s linear infinite; font-size: 18px; }
.login-tip { margin-top: 20px; font-size: 12px; color: var(--color-text-tertiary); text-align: center; }
.login-tip a { color: var(--color-primary); text-decoration: none; font-weight: var(--font-weight-medium); }
@media (max-width: 480px) { .login-card { padding: 32px 24px; } }
</style>