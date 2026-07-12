<template>
  <div class="auth-layout">
    <div class="auth-theme-toggle">
      <ThemeToggle />
    </div>
    <!-- 多层动态光斑：模拟星云呼吸感 -->
    <div class="bg-atmosphere">
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
      <div class="orb orb-3"></div>
      <div class="orb orb-4"></div>
      <div class="orb orb-5"></div>
      <div class="orb orb-6"></div>
    </div>
    <div class="auth-content">
      <slot />
    </div>
  </div>
</template>

<script setup>
import ThemeToggle from '../components/ThemeToggle.vue';
</script>

<style scoped>
.auth-layout {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  /* ====== 修复：移除硬编码的浅色渐变，改为跟随全局主题的动态变量 ====== */
  background: var(--gradient-atmosphere);
  background-size: 200% 200%;
  animation: gradient-shift 12s var(--easing-standard) infinite;
  position: relative;
  overflow: hidden;
}

.auth-theme-toggle {
  position: fixed;
  top: 22px;
  right: 24px;
  z-index: 20;
}

/* ═══════ 光斑系统（保持原样） ═══════ */
.bg-atmosphere {
  position: absolute; inset: 0; pointer-events: none; overflow: hidden;
  z-index: 0;
}
.orb {
  position: absolute; border-radius: 50%;
  filter: blur(90px);
}
.orb-1 {
  width: 500px; height: 500px;
  background: radial-gradient(circle, rgba(99,102,241,0.4) 0%, transparent 65%);
  top: -120px; right: -80px;
  animation: orbDrift1 13s ease-in-out infinite;
}
.orb-2 {
  width: 420px; height: 420px;
  background: radial-gradient(circle, rgba(139,92,246,0.35) 0%, transparent 65%);
  bottom: -100px; left: -60px;
  animation: orbDrift2 15s ease-in-out infinite;
}
.orb-3 {
  width: 280px; height: 280px;
  background: radial-gradient(circle, rgba(6,182,212,0.25) 0%, transparent 65%);
  top: 25%; left: 10%;
  animation: orbDrift3 17s ease-in-out infinite 2s;
}
.orb-4 {
  width: 200px; height: 200px;
  background: radial-gradient(circle, rgba(79,70,229,0.3) 0%, transparent 65%);
  top: 40%; right: 8%;
  animation: orbDrift1 14s ease-in-out infinite 4s reverse;
}
.orb-5 {
  width: 140px; height: 140px;
  background: radial-gradient(circle, rgba(168,85,247,0.3) 0%, transparent 65%);
  top: 15%; right: 30%;
  animation: orbDrift2 16s ease-in-out infinite 6s;
}
.orb-6 {
  width: 240px; height: 240px;
  background: radial-gradient(circle, rgba(79,70,229,0.2) 0%, transparent 65%);
  bottom: 10%; right: 25%;
  animation: orbDrift3 18s ease-in-out infinite 3s reverse;
}

@media (max-width: 520px) {
  .auth-theme-toggle { top: 14px; right: 14px; }
}

.auth-content {
  position: relative;
  z-index: 1;
  width: 100%;
  display: flex;
  justify-content: center;
  padding: 24px;
}
</style>
