<<<<<<< HEAD
﻿<template>
  <div class="stub-page">
    <div class="page-header">
      <h2>个人发展画像</h2>
      <p class="page-desc">五维雷达图、班级对比、趋势图分析</p>
    </div>
    <div class="stub-card">
      <div class="stub-icon-wrapper">
        <VIcon icon="mdi:account-details-outline" class="stub-icon" />
      </div>
      <h3>功能开发中</h3>
      <p>该功能由组员实现，即将上线</p>
      <div class="skeleton-preview">
        <div class="skeleton" style="height: 180px; width: 100%; border-radius: 12px;"></div>
        <div style="display: flex; gap: 8px; margin-top: 12px;">
          <div class="skeleton" style="height: 80px; flex: 1; border-radius: 8px;"></div>
          <div class="skeleton" style="height: 80px; flex: 1; border-radius: 8px;"></div>
          <div class="skeleton" style="height: 80px; flex: 1; border-radius: 8px;"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stub-page { display: flex; flex-direction: column; gap: 24px; animation: fadeIn 0.4s var(--easing-decelerate); }
.page-header h2 { font-size: 22px; font-weight: var(--font-weight-semibold); }
.page-desc { font-size: 14px; color: var(--color-text-secondary); margin-top: 2px; }
.stub-card {
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  padding: 48px 32px; background: var(--color-surface);
  border-radius: var(--radius-xl); border: 1px solid var(--color-border);
  text-align: center; animation: fadeInUp 0.5s var(--easing-spring) both;
}
.stub-icon-wrapper {
  width: 72px; height: 72px; border-radius: 50%;
  background: rgba(234,134,0,0.1);
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 8px;
}
.stub-icon { font-size: 36px; color: #EA8600; }
.stub-card h3 { font-size: 18px; font-weight: var(--font-weight-semibold); color: var(--color-text); }
.stub-card > p { font-size: 14px; color: var(--color-text-secondary); }
.skeleton-preview { width: 100%; max-width: 400px; margin-top: 16px; }
</style>
=======
<template><div class="stub"><h2>个人发展画像</h2><p>五维雷达图、班级对比、趋势图等由组员实现</p></div></template>
>>>>>>> origin/main
