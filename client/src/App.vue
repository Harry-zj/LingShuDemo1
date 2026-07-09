<template>
  <component :is="layout">
    <router-view v-slot="{ Component }">
      <transition name="page" mode="out-in">
        <component :is="Component" :key="$route.path" />
      </transition>
    </router-view>
  </component>
</template>

<script setup>
import { computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import AuthLayout from './layouts/AuthLayout.vue';
import MainLayout from './layouts/MainLayout.vue';

const route = useRoute();
const layout = computed(() => route.meta.layout === 'auth' ? AuthLayout : MainLayout);

watch(() => route.path, () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
</script>

<style>
</style>
