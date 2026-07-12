<template>
  <button
    class="theme-toggle"
    type="button"
    :class="{ 'is-light': isLight }"
    :aria-label="isLight ? '切换为深色主题' : '切换为米白主题'"
    :aria-pressed="isLight"
    :title="isLight ? '切换为深色主题' : '切换为米白主题'"
    @click="toggleTheme"
  >
    <span class="toggle-track" aria-hidden="true">
      <span class="toggle-thumb">
        <VIcon :icon="isLight ? 'mdi:white-balance-sunny' : 'mdi:moon-waning-crescent'" />
      </span>
    </span>
    <span class="toggle-label">主题</span>
  </button>
</template>

<script setup>
import { computed, ref } from 'vue';

const currentTheme = ref(
  document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
);
const isLight = computed(() => currentTheme.value === 'light');

function toggleTheme() {
  const nextTheme = isLight.value ? 'dark' : 'light';
  currentTheme.value = nextTheme;
  document.documentElement.dataset.theme = nextTheme;
  document.documentElement.style.colorScheme = nextTheme;
  try {
    localStorage.setItem('lingshu-theme', nextTheme);
  } catch {
    // Theme still changes for the current session when storage is unavailable.
  }
}
</script>

<style scoped>
.theme-toggle {
  height: 44px;
  padding: 0 13px 0 8px;
  display: inline-flex;
  align-items: center;
  gap: 9px;
  flex-shrink: 0;
  border: 1px solid var(--theme-toggle-border, rgba(255, 255, 255, 0.15));
  border-radius: 999px;
  color: var(--theme-toggle-text, rgba(246, 242, 232, 0.78));
  background: var(--theme-toggle-bg, rgba(255, 255, 255, 0.07));
  box-shadow: var(--theme-toggle-shadow, inset 0 1px 0 rgba(255, 255, 255, 0.08));
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  transition: transform 0.22s ease, background 0.28s ease, border-color 0.28s ease, color 0.28s ease;
}

.theme-toggle:hover {
  transform: translateY(-1px);
  border-color: var(--theme-toggle-border-hover, rgba(244, 184, 71, 0.44));
}

.theme-toggle:focus-visible {
  outline: 3px solid var(--color-primary-light);
  outline-offset: 3px;
}

.toggle-track {
  width: 42px;
  height: 26px;
  padding: 3px;
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  background: var(--theme-toggle-track, rgba(255, 255, 255, 0.10));
  box-shadow: inset 0 0 0 1px var(--theme-toggle-track-border, rgba(255, 255, 255, 0.10));
}

.toggle-thumb {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: var(--theme-toggle-icon, #11110f);
  background: var(--theme-toggle-thumb, #f4b847);
  box-shadow: 0 4px 12px var(--theme-toggle-thumb-shadow, rgba(0, 0, 0, 0.28));
  transform: translateX(0);
  transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), background 0.28s ease, color 0.28s ease;
}

.theme-toggle.is-light .toggle-thumb {
  transform: translateX(16px);
}

.toggle-thumb :deep(svg) {
  width: 14px;
  height: 14px;
}

.toggle-label {
  min-width: 28px;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.08em;
}

@media (max-width: 820px) {
  .theme-toggle {
    width: 42px;
    height: 42px;
    padding: 0;
    justify-content: center;
  }

  .toggle-track {
    width: 32px;
    height: 24px;
  }

  .toggle-thumb {
    width: 18px;
    height: 18px;
  }

  .theme-toggle.is-light .toggle-thumb {
    transform: translateX(8px);
  }

  .toggle-label {
    display: none;
  }
}
</style>
