<template>
  <div class="feature-menu-page">
    <button class="back-link" @click="$router.push(backPath)">
      <VIcon icon="mdi:arrow-left" />{{ backLabel }}
    </button>

    <section class="menu-hero glass-card">
      <div>
        <span class="eyebrow">FUNCTION MENU</span>
        <h2>{{ title }}</h2>
        <p v-if="description">{{ description }}</p>
      </div>
      <span class="count-chip">{{ cards.length }} 个功能</span>
    </section>

    <section class="feature-grid">
      <button
        v-for="card in cards"
        :key="card.title"
        class="feature-card glass-card"
        :class="{ disabled: card.disabled }"
        :disabled="card.disabled"
        @click="open(card)"
      >
        <span class="icon-box"><VIcon :icon="card.icon" /></span>
        <span class="card-content">
          <strong>{{ card.title }}</strong>
          <small>{{ card.description }}</small>
          <em v-if="card.note">{{ card.note }}</em>
        </span>
        <VIcon icon="mdi:arrow-right" class="card-arrow" />
      </button>
    </section>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';

defineProps({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  backPath: { type: String, required: true },
  backLabel: { type: String, default: '返回工作台' },
  cards: { type: Array, default: () => [] },
});

const router = useRouter();

function open(card) {
  if (!card.disabled && card.to) router.push(card.to);
}
</script>

<style scoped>
.feature-menu-page { display:flex; flex-direction:column; gap:24px; animation:fadeIn .35s var(--easing-decelerate); }
.back-link { display:inline-flex; align-items:center; gap:6px; width:fit-content; border:0; padding:0; background:transparent; color:var(--color-primary); cursor:pointer; }
.menu-hero { display:flex; align-items:flex-start; justify-content:space-between; gap:20px; padding:26px; border-radius: 8px !important; }
.eyebrow { display:inline-block; margin-bottom:7px; color:var(--color-primary); font-size:11px; font-weight:700; letter-spacing:.16em; }
.menu-hero h2 { font-size:24px; }
.menu-hero p { max-width:760px; margin-top:7px; color:var(--color-text-secondary); line-height:1.7; }
.count-chip { padding:8px 13px; border-radius: 8px !important; background:var(--color-bg); color:var(--color-primary); font-size:13px; white-space:nowrap; }
.feature-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:16px; }
.feature-card { position:relative; min-height:180px; padding:22px; border:1px solid var(--color-border); border-radius: 8px !important; color:var(--color-text-primary); text-align:left; cursor:pointer; overflow:hidden; transition:transform var(--duration-fast),border-color var(--duration-fast),box-shadow var(--duration-fast); }
.feature-card:hover:not(.disabled) { transform:translateY(-3px); border-color:color-mix(in srgb,var(--color-primary) 48%,var(--color-border)); box-shadow:var(--shadow-level-2); }
.feature-card.disabled { opacity:.55; cursor:not-allowed; }
.icon-box { display:inline-flex; align-items:center; justify-content:center; width:46px; height:46px; border-radius: 8px !important; background:color-mix(in srgb,var(--color-primary) 12%,transparent); color:var(--color-primary); font-size:24px; }
.card-content { display:flex; flex-direction:column; gap:7px; margin-top:18px; padding-right:34px; }
.card-content strong { font-size:17px; }
.card-content small { color:var(--color-text-secondary); font-size:13px; line-height:1.65; }
.card-content em { color:#d97706; font-size:12px; font-style:normal; }
.card-arrow { position:absolute; right:20px; bottom:20px; color:var(--color-primary); }
@media (max-width:720px) { .menu-hero { flex-direction:column; } .feature-grid { grid-template-columns:1fr; } }

/* 模块三局部圆角兜底：仅作用于当前模块三组件树，不影响顶部导航及其他模块。 */
:deep(*) {
  border-radius: 8px !important;
}

</style>
