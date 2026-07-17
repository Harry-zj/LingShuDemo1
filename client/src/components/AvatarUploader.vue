<template>
  <div class="avatar-uploader" :class="{ 'is-mobile': isMobile }">
    <!-- 头像显示区 -->
    <div
      class="avatar-circle"
      :style="{ width: avatarSize + 'px', height: avatarSize + 'px' }"
      @click="triggerUpload"
      role="button"
      :aria-label="avatarUrl ? '更换头像' : '上传头像'"
      tabindex="0"
      @keydown.enter="triggerUpload"
    >
      <!-- 有头像 -->
      <template v-if="avatarUrl">
        <img :src="avatarUrl" :alt="userName + ' 头像'" class="avatar-img" />
        <div class="avatar-overlay">
          <VIcon v-if="!uploading" icon="mdi:camera-plus-outline" class="overlay-icon" />
          <VIcon v-else icon="mdi:loading" class="overlay-icon spinning" />
        </div>
      </template>

      <!-- 无头像 -->
      <template v-else>
        <VIcon v-if="!uploading" icon="mdi:account-circle-outline" class="avatar-placeholder" />
        <VIcon v-else icon="mdi:loading" class="avatar-placeholder spinning" />
      </template>
    </div>

    <!-- 移动端始终显示的相机按钮（不依赖 hover） -->
    <button
      v-if="isMobile && !uploading"
      type="button"
      class="mobile-camera-btn"
      @click.stop="triggerUpload"
      aria-label="上传头像"
    >
      <VIcon icon="mdi:camera-plus-outline" />
    </button>

    <!-- 上传提示 -->
    <p v-if="!avatarUrl && !uploading" class="upload-hint">点击上传头像</p>

    <!-- 隐藏的文件输入 -->
    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      hidden
      @change="onFileSelected"
    />

    <!-- 裁剪弹窗 -->
    <ImageCropperModal
      v-if="selectedFile && showCropper"
      :file="selectedFile"
      aspect-ratio="1"
      title="裁剪头像"
      @confirm="onCropConfirm"
      @cancel="onCropCancel"
    />
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import ImageCropperModal from "./ImageCropperModal.vue";
import { uploadAvatar as uploadAvatarApi } from "../api/auth";
import { useUserStore } from "../stores/user";

const props = defineProps({
  avatarUrl: { type: String, default: "" },
  userName: { type: String, default: "" },
  size: { type: Number, default: 96 },
});

const emit = defineEmits(["update:avatarUrl"]);

const userStore = useUserStore();
const fileInput = ref(null);
const selectedFile = ref(null);
const showCropper = ref(false);
const uploading = ref(false);

const isMobile = ref(window.innerWidth <= 820);

if (typeof window !== "undefined") {
  window.addEventListener("resize", () => {
    isMobile.value = window.innerWidth <= 820;
  });
}

const avatarSize = computed(() => {
  if (isMobile.value && window.innerWidth <= 520) return Math.min(props.size, 64);
  if (isMobile.value) return Math.min(props.size, 72);
  return props.size;
});

function triggerUpload() {
  if (uploading.value) return;
  fileInput.value?.click();
}

function onFileSelected(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  // 前端校验大小：最大 5MB
  if (file.size > 5 * 1024 * 1024) {
    alert("图片过大，请选择小于 5MB 的图片");
    // 重置 input 以便重新选择同一文件
    e.target.value = "";
    return;
  }

  selectedFile.value = file;
  showCropper.value = true;

  // 重置 input
  e.target.value = "";
}

async function onCropConfirm(blob) {
  // 先关闭裁剪弹窗
  showCropper.value = false;
  selectedFile.value = null;
  uploading.value = true;

  if (!blob || blob.size === 0) {
    alert("裁剪结果为空，请重新裁剪");
    uploading.value = false;
    return;
  }

  try {
    const fd = new FormData();
    fd.append("avatar", blob, "avatar.jpg");

    const res = await uploadAvatarApi(fd);
    if (res.code === 200) {
      // 更新 store → 导航栏头像自动同步
      userStore.setAuth(userStore.token, res.data);
      emit("update:avatarUrl", res.data?.avatar || "");
    } else {
      alert(res.msg || "头像上传失败");
    }
  } catch (e) {
    console.error("头像上传失败:", e);
    const msg = e?.response?.data?.msg || e?.response?._data?.msg || e.message || "头像上传失败，请稍后重试";
    alert(msg);
  } finally {
    uploading.value = false;
  }
}

function onCropCancel() {
  showCropper.value = false;
  selectedFile.value = null;
}
</script>

<style scoped>
.avatar-uploader {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.avatar-circle {
  position: relative;
  border-radius: 50%;
  overflow: hidden;
  cursor: pointer;
  border: 2px dashed var(--color-border);
  transition: border-color 0.2s, box-shadow 0.2s;
  background: var(--color-surface-variant);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* 有头像时实线边框 */
.avatar-circle:has(.avatar-img) {
  border-style: solid;
  border-color: rgba(244, 184, 71, 0.3);
}

.avatar-circle:hover {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(244, 184, 71, 0.15);
}

.avatar-circle:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 3px;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.avatar-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  opacity: 0;
  transition: opacity 0.2s;
  border-radius: 50%;
}

.avatar-circle:hover .avatar-overlay {
  opacity: 1;
}

.overlay-icon {
  font-size: 28px;
  color: #fff;
}

.avatar-placeholder {
  font-size: inherit;
  color: var(--color-text-tertiary);
  transition: color 0.2s;
}

.avatar-circle:hover .avatar-placeholder {
  color: var(--color-primary);
}

.upload-hint {
  font-size: 13px;
  color: var(--color-text-tertiary);
  margin: 0;
}

.mobile-camera-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: var(--gradient-primary);
  color: var(--color-text-inverse);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  transition: transform 0.15s, box-shadow 0.15s;
}

.mobile-camera-btn:active {
  transform: scale(0.92);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
}

/* 移动端适配 */
@media (max-width: 820px) {
  .avatar-uploader.is-mobile .avatar-circle {
    border-style: solid;
  }

  .avatar-uploader.is-mobile .avatar-overlay {
    display: none;
  }
}

/* loading 旋转动画 */
.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
