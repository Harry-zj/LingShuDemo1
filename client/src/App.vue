<template>
  <component :is="layout">
    <router-view v-slot="{ Component }">
      <transition :name="pageTransitionName">
        <component :is="Component" :key="$route.fullPath" />
      </transition>
    </router-view>
  </component>
</template>

<script setup>
import { computed, nextTick, watch } from 'vue';
import { useRoute } from 'vue-router';
import AuthLayout from './layouts/AuthLayout.vue';
import MainLayout from './layouts/MainLayout.vue';

const route = useRoute();
const layout = computed(() => route.meta.layout === 'auth' ? AuthLayout : MainLayout);
const pageTransitionName = computed(() => route.meta.instant ? '' : 'page');

watch(() => route.fullPath, async () => {
  await nextTick();
  requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  });
});
</script>

<style>
</style>
