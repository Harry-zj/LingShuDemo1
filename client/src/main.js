import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { Icon, addAPIProvider } from '@iconify/vue';

// 使用官方 Iconify API，避免 api.unisvg.com 超时
addAPIProvider('', {
  resources: ['https://api.iconify.design'],
});
import './assets/styles/variables.css';
import './assets/styles/global.css';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.component('VIcon', Icon);

// 全局自定义指令：点击外部关闭
app.directive('click-outside', {
  mounted(el, binding) {
    el.__clickOutsideHandler = (event) => {
      if (!el.contains(event.target) && el !== event.target) {
        binding.value(event);
      }
    };
    document.addEventListener('click', el.__clickOutsideHandler);
  },
  unmounted(el) {
    document.removeEventListener('click', el.__clickOutsideHandler);
  }
});

app.mount('#app');
