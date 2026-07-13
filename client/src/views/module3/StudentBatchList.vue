<template>
  <div class="batch-page">
    <button class="back-link" @click="router.push('/module3/student')">
      <VIcon icon="mdi:arrow-left" />返回学生综测工作台
    </button>

    <section class="page-hero glass-card">
      <div>
        <span class="eyebrow">学生综测工作台 / {{ meta.shortTitle }}</span>
        <h2>{{ meta.title }}</h2>
        <p>{{ meta.description }}</p>
      </div>
      <div class="hero-icon"><VIcon :icon="meta.icon" /></div>
    </section>

    <div class="profile-warning glass-card" v-if="!profileComplete">
      <VIcon icon="mdi:alert-circle-outline" />
      <div>
        <h3>请先完善个人信息</h3>
        <p>缺少：{{ missingFields.join('、') }}。资料完整后才能查看和进入综测批次。</p>
        <router-link class="btn-primary small" to="/module3/profile/basic">去完善资料</router-link>
      </div>
    </div>

    <section class="batch-section" v-else>
      <div class="section-heading">
        <div>
          <h3>选择综测批次</h3>
          <p>点击批次卡片后进入独立的{{ view === 'result' ? '结果与异议' : '信息填写' }}页面。</p>
        </div>
        <span>{{ batches.length }} 个可用批次</span>
      </div>

      <div class="batch-grid" v-if="batches.length">
        <button v-for="batch in batches" :key="batch.id" class="batch-card glass-card" @click="openBatch(batch)">
          <div class="batch-head">
            <span class="status-pill">{{ statusText(batch.status) }}</span>
            <VIcon icon="mdi:arrow-right" />
          </div>
          <strong>{{ batch.title }}</strong>
          <p>{{ batch.college }} · {{ batch.grade }}</p>
          <small>{{ batch.start_time || '-' }} 至 {{ batch.end_time || '-' }}</small>
          <em>{{ view === 'result' ? '进入结果详情' : '进入综测填写详情' }}</em>
        </button>
      </div>

      <div class="empty-state glass-card" v-else-if="!loading">
        <VIcon icon="mdi:calendar-remove-outline" />
        <strong>当前没有可用批次</strong>
        <span>请确认个人学院、年级信息与管理员创建的批次一致。</span>
      </div>

      <div class="empty-state glass-card" v-else>
        <VIcon icon="mdi:loading" />
        <span>正在加载批次</span>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { getStudentBatches } from '../../api/module3';
import { useUserStore } from '../../stores/user';

const props = defineProps({
  view: { type: String, default: 'form' },
});

const router = useRouter();
const userStore = useUserStore();
const batches = ref([]);
const loading = ref(false);
const missingFields = computed(() => userStore.user?.profile_missing_fields || []);
const profileComplete = computed(() => userStore.user?.profile_complete !== false);
const meta = computed(() => props.view === 'result'
  ? {
      shortTitle: '结果与异议',
      title: '选择要查看的综测批次',
      description: '先选择批次，再进入独立页面查看评价结果、分类支撑材料和异议处理情况。',
      icon: 'mdi:message-question-outline',
    }
  : {
      shortTitle: '信息填写',
      title: '选择要填写的综测批次',
      description: '先选择批次，再进入独立页面编辑、保存和提交该批次的综测表。',
      icon: 'mdi:file-document-edit-outline',
    });

function statusText(status) {
  return ({ draft: '草稿', published: '已发布', closed: '已关闭', archived: '已归档' }[status] || status);
}

function openBatch(batch) {
  const base = props.view === 'result' ? '/module3/student/results' : '/module3/student/forms';
  router.push(`${base}/${batch.id}`);
}

async function loadBatches() {
  if (!profileComplete.value) return;
  loading.value = true;
  try {
    const res = await getStudentBatches();
    if (res.code !== 200) return alert(res.msg || '加载批次失败');
    batches.value = res.data || [];
  } catch (error) {
    alert(error?.message || '加载批次失败');
  } finally {
    loading.value = false;
  }
}

onMounted(loadBatches);
</script>

<style scoped>
.batch-page { display: flex; flex-direction: column; gap: 24px; animation: fadeIn .35s var(--easing-decelerate); }
.back-link { display: inline-flex; align-items: center; gap: 6px; width: fit-content; padding: 0; border: 0; background: transparent; color: var(--color-primary); cursor: pointer; }
.page-hero { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; padding: 28px; border-radius: 8px; }
.eyebrow { display: inline-block; margin-bottom: 7px; color: var(--color-primary); font-size: 11px; font-weight: 700; letter-spacing: .13em; }
.page-hero h2 { font-size: 25px; }
.page-hero p { max-width: 760px; margin-top: 7px; color: var(--color-text-secondary); line-height: 1.7; }
.hero-icon { display: grid; place-items: center; width: 54px; height: 54px; border-radius: 8px; background: color-mix(in srgb, var(--color-primary) 12%, transparent); color: var(--color-primary); font-size: 28px; }
.profile-warning { display: flex; gap: 14px; align-items: flex-start; padding: 20px; border-radius: 8px; background: rgba(245,158,11,.10); }
.profile-warning > svg { font-size: 28px; color: #d97706; }
.profile-warning h3 { margin-bottom: 5px; font-size: 16px; }
.profile-warning p { margin-bottom: 12px; color: var(--color-text-secondary); font-size: 13px; }
.btn-primary.small { display: inline-flex; align-items: center; min-height: 34px; padding: 0 14px; border-radius: 8px; background: var(--gradient-primary); color: white; text-decoration: none; font-size: 13px; }
.batch-section { display: flex; flex-direction: column; gap: 16px; }
.section-heading { display: flex; align-items: end; justify-content: space-between; gap: 18px; }
.section-heading h3 { font-size: 18px; }
.section-heading p, .section-heading > span { margin-top: 4px; color: var(--color-text-secondary); font-size: 13px; }
.batch-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }
.batch-card { display: flex; flex-direction: column; align-items: stretch; gap: 9px; min-height: 210px; padding: 20px; border: 1px solid var(--color-border); border-radius: 8px; color: var(--color-text-primary); text-align: left; cursor: pointer; transition: transform var(--duration-fast), border-color var(--duration-fast), box-shadow var(--duration-fast); }
.batch-card:hover { transform: translateY(-3px); border-color: color-mix(in srgb, var(--color-primary) 48%, var(--color-border)); box-shadow: var(--shadow-level-2); }
.batch-head { display: flex; justify-content: space-between; align-items: center; }
.batch-head > svg { color: var(--color-primary); }
.status-pill { width: fit-content; padding: 5px 10px; border-radius: 8px; background: color-mix(in srgb, var(--color-primary) 10%, transparent); color: var(--color-primary); font-size: 12px; }
.batch-card strong { margin-top: 12px; font-size: 17px; }
.batch-card p, .batch-card small { color: var(--color-text-secondary); line-height: 1.5; }
.batch-card em { margin-top: auto; color: var(--color-primary); font-size: 12px; font-style: normal; font-weight: 600; }
.empty-state { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 44px 20px; border-radius: 8px; color: var(--color-text-tertiary); text-align: center; }
.empty-state > svg { font-size: 42px; }
.empty-state strong { color: var(--color-text-primary); }
@media (max-width: 720px) { .page-hero, .section-heading { flex-direction: column; align-items: stretch; } .hero-icon { display: none; } }
</style>
