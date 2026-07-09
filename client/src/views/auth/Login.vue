<template>
  <div class="login-card">
    <h2>灵枢 · 登录</h2>
    <form @submit.prevent="handleLogin">
      <input v-model="form.username" placeholder="请输入用户名" required />
      <input v-model="form.password" type="password" placeholder="请输入密码" required />
      <button type="submit">登录</button>
    </form>
    <p class="tip">测试账号：student / 123456</p>
  </div>
</template>
<script setup>
import { ref } from "vue";
import { login } from "../../api/auth";
import { useUserStore } from "../../stores/user";
import { useRouter } from "vue-router";
const userStore = useUserStore();
const router = useRouter();
const form = ref({ username: "", password: "" });
async function handleLogin() {
  const res = await login(form.value);
  if (res.code === 200) { userStore.setAuth(res.data.token, res.data.user); router.push("/home"); }
  else { alert(res.msg); }
}
</script>
<style scoped>
.login-card { width: 400px; padding: 40px 32px; background: var(--color-white); border-radius: var(--radius-card); box-shadow: var(--shadow-card); text-align: center; }
h2 { font-size: 24px; margin-bottom: 32px; color: var(--color-primary); }
input { width: 100%; padding: 12px 16px; margin-bottom: 16px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 16px; outline: none; }
input:focus { border-color: var(--color-primary); }
button { width: 100%; padding: 12px; background: var(--color-primary); color: #fff; border: none; border-radius: var(--radius-btn); font-size: 16px; cursor: pointer; transition: opacity 0.2s; }
button:hover { opacity: 0.9; }
.tip { margin-top: 16px; font-size: 13px; color: var(--color-gray); }
</style>
