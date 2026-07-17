<template>
  <div class="profile-basic-view">
    <!-- 资料未完善提示 -->
    <div class="profile-alert glass-card" v-if="missingFields.length">
      <VIcon icon="mdi:alert-circle-outline" />
      <div>
        <strong>资料尚未完善</strong>
        <p>请补全：{{ missingFields.join("、") }}</p>
      </div>
    </div>

    <!-- Hero 区：头像 + 姓名 + 角色 -->
    <div class="hero-card glass-card reveal">
      <AvatarUploader
        :avatar-url="user.avatar || ''"
        :user-name="displayName"
        :size="96"
        @update:avatar-url="onAvatarUpdate"
      />
      <div class="hero-info">
        <h2 class="hero-name">{{ displayName }}</h2>
        <span class="hero-role">{{ roleLabel }}</span>
        <span v-if="assessmentLabel" class="hero-badge">{{ assessmentLabel }}</span>
      </div>
    </div>

    <!-- 历史头像 -->
    <div class="history-card glass-card reveal" v-if="historyList.length">
      <div class="history-head">
        <h4><VIcon icon="mdi:history" />历史头像</h4>
        <span class="history-hint">点击可恢复</span>
      </div>
      <div class="history-avatars">
        <button
          v-for="h in historyList"
          :key="h.id"
          class="history-avatar-btn"
          :class="{ active: user.avatar === h.oss_url }"
          :title="'恢复此头像 (' + formatDate(h.created_at) + ')'"
          @click="restoreHistory(h.id)"
          :disabled="restoring === h.id"
        >
          <img :src="h.oss_url" alt="" class="history-avatar-img" />
          <VIcon v-if="restoring === h.id" icon="mdi:loading" class="history-spinner" />
        </button>
      </div>
    </div>

    <!-- 信息卡片 -->
    <div class="info-section reveal">
      <ProfileInfoCard
        :key="profileKey"
        :user="user"
        :org="orgData"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import AvatarUploader from "../../components/AvatarUploader.vue";
import ProfileInfoCard from "../../components/ProfileInfoCard.vue";
import { getProfile, getAvatarHistory, restoreAvatar } from "../../api/auth";
import { getOrganizations } from "../../api/module3";
import { useUserStore } from "../../stores/user";

const userStore = useUserStore();

const loading = ref(true);
const orgData = ref({ colleges: [], majors: [], classes: [] });
const profileKey = ref(0);
const historyList = ref([]);
const restoring = ref(null);

const user = computed(() => userStore.user || {});
const displayName = computed(() => user.value.real_name || user.value.username || "未命名用户");
const roleLabel = computed(() => user.value.role_name || user.value.role || "-");
const assessmentLabel = computed(() => user.value.member_label || "");
const missingFields = computed(() => user.value.profile_missing_fields || []);

function formatDate(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return m + "月" + day + "日";
}

function onAvatarUpdate() {
  profileKey.value++;
  loadHistory();
}

async function loadHistory() {
  try {
    const res = await getAvatarHistory();
    if (res.code === 200) historyList.value = res.data || [];
  } catch (_) {}
}

async function restoreHistory(historyId) {
  if (restoring.value) return;
  restoring.value = historyId;
  try {
    const res = await restoreAvatar(historyId);
    if (res.code === 200) {
      userStore.setAuth(userStore.token, res.data);
      profileKey.value++;
      loadHistory();
    } else {
      alert(res.msg || "恢复失败");
    }
  } catch (e) {
    alert("恢复头像失败，请稍后重试");
  } finally {
    restoring.value = null;
  }
}

async function loadData() {
  loading.value = true;
  try {
    const [orgRes] = await Promise.all([
      getOrganizations().catch(() => ({ code: 200, data: { colleges: [], majors: [], classes: [] } })),
      getProfile().then((res) => {
        if (res.code === 200) userStore.setAuth(userStore.token, res.data);
      }).catch(() => {}),
    ]);
    if (orgRes.code === 200) orgData.value = orgRes.data || { colleges: [], majors: [], classes: [] };
  } catch (_) {} finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadData();
  loadHistory();
});
</script>

<style scoped>
.profile-basic-view {
  display: flex; flex-direction: column; gap: 22px;
  max-width: 680px; width: 100%; margin: 0 auto;
  animation: fadeIn 0.35s var(--easing-decelerate);
}

.profile-alert {
  display: flex; gap: 12px; align-items: flex-start;
  padding: 16px 20px; border-radius: 8px !important;
  background: rgba(245,158,11,0.12);
}
.profile-alert svg { font-size: 22px; color: #d97706; flex-shrink: 0; margin-top: 1px; }
.profile-alert strong { font-size: 14px; color: var(--color-text); }
.profile-alert p { margin: 4px 0 0; font-size: 13px; color: var(--color-text-secondary); }

/* Hero */
.hero-card {
  display: flex; flex-direction: column; align-items: center; gap: 16px;
  padding: 32px 28px; border-radius: 12px !important; text-align: center;
}
.hero-info { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.hero-name { font-size: 22px; font-weight: var(--font-weight-semibold); color: var(--color-text); margin: 0; }
.hero-role { font-size: 13px; color: var(--color-text-secondary); padding: 3px 12px; border-radius: 12px; background: var(--color-gray-bg); }
.hero-badge { font-size: 12px; color: var(--color-primary); padding: 2px 10px; border-radius: 10px; background: var(--color-primary-light); }

/* 历史头像 */
.history-card {
  padding: 18px 20px; border-radius: 8px !important;
}
.history-head {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;
}
.history-head h4 {
  display: flex; align-items: center; gap: 6px;
  font-size: 14px; font-weight: 600; color: var(--color-text); margin: 0;
}
.history-hint { font-size: 12px; color: var(--color-text-tertiary); }
.history-avatars {
  display: flex; flex-wrap: wrap; gap: 10px;
}
.history-avatar-btn {
  width: 48px; height: 48px; border-radius: 50%;
  border: 2px solid transparent;
  padding: 0; cursor: pointer; overflow: hidden;
  background: var(--color-surface-variant);
  transition: border-color 0.15s, transform 0.15s;
  position: relative; flex-shrink: 0;
}
.history-avatar-btn:hover { border-color: var(--color-primary); transform: scale(1.08); }
.history-avatar-btn.active { border-color: var(--color-primary); box-shadow: 0 0 0 2px rgba(244,184,71,0.25); }
.history-avatar-btn:disabled { opacity: 0.7; cursor: wait; transform: none; }
.history-avatar-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.history-spinner {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.4); color: #fff; font-size: 20px;
  animation: spin 0.8s linear infinite;
}

.info-section { width: 100%; }

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.reveal { animation: fadeIn 0.4s var(--easing-decelerate) both; }

@media (max-width: 820px) {
  .profile-basic-view { max-width: 100%; gap: 16px; }
  .hero-card { padding: 24px 18px; }
  .hero-name { font-size: 20px; }
  .history-avatar-btn { width: 44px; height: 44px; }
}
@media (max-width: 520px) {
  .hero-card { padding: 20px 14px; gap: 12px; }
  .hero-name { font-size: 18px; }
}
</style>
