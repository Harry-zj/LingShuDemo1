<template>
  <div class="stub-page">
    <div class="page-header">
      <h2>对话式填表</h2>
      <p class="page-desc">以轻松对话方式，AI引导逐步完成填表</p>
    </div>
    <div class="stub-card">
      <div class="stub-icon-wrapper">
        <VIcon icon="mdi:chat-processing-outline" class="stub-icon" />
      </div>
      <h3>功能开发中</h3>
      <p>该功能由组员实现，即将上线</p>
      <div class="skeleton-preview">
        <div class="skeleton skeleton-text" style="width: 75%"></div>
        <div class="skeleton skeleton-text" style="width: 55%"></div>
        <div class="skeleton skeleton-text" style="width: 85%"></div>
        <div class="skeleton skeleton-card" style="height: 160px; margin-top: 12px"></div>
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
  background: var(--color-wuxing-fire);
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 8px;
}
.stub-icon { font-size: 36px; color: var(--color-meiyu); }
.stub-card h3 { font-size: 18px; font-weight: var(--font-weight-semibold); color: var(--color-text); }
.stub-card > p { font-size: 14px; color: var(--color-text-secondary); }
.skeleton-preview { width: 100%; max-width: 400px; margin-top: 16px; }
</style>
