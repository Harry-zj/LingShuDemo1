<template>
  <teleport to="body">
    <div v-if="visible" class="cropper-overlay">
      <div class="cropper-panel">
        <div class="cropper-top">
          <h3><VIcon icon="mdi:image-edit-outline" />裁剪头像</h3>
          <span class="cropper-desc">拖动图片调整头像在圆圈中的位置</span>
        </div>
        <div class="cropper-stage">
          <img ref="imgRef" :src="objectUrl" alt="" />
        </div>
        <div class="cropper-buttons">
          <button class="btn-cancel" @click="doCancel">
            <VIcon icon="mdi:close" />取消
          </button>
          <button class="btn-confirm" @click="doConfirm">
            <VIcon icon="mdi:check-bold" />确认裁剪
          </button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick, watch } from "vue";
import Cropper from "cropperjs";
import "cropperjs/dist/cropper.css";

const props = defineProps({
  file: { type: File, required: true },
});

const emit = defineEmits(["confirm", "cancel"]);

const imgRef = ref(null);
const visible = ref(true);
const objectUrl = ref("");
let cropper = null;

onMounted(() => {
  objectUrl.value = URL.createObjectURL(props.file);
});

watch([imgRef, objectUrl], async ([el, url]) => {
  if (!el || !url) return;
  await nextTick();
  if (!el.complete) {
    await new Promise((r) => { el.onload = r; });
  }
  await nextTick();
  if (cropper) { cropper.destroy(); cropper = null; }

  cropper = new Cropper(el, {
    aspectRatio: 1,
    viewMode: 1,
    dragMode: "move",
    cropBoxMovable: false,
    cropBoxResizable: false,
    autoCropArea: 0.85,
    responsive: true,
    restore: false,
    modal: true,
    guides: false,
    center: true,
    highlight: true,
    background: true,
    movable: true,
    rotatable: false,
    scalable: true,
    zoomable: true,
    zoomOnWheel: true,
    minCropBoxWidth: 300,
    minCropBoxHeight: 300,
    ready() {
      applyCircle();
    },
    crop() {
      applyCircle();
    },
  });
});

function applyCircle() {
  const ct = document.querySelector(".cropper-container");
  if (!ct) return;
  ["cropper-crop-box", "cropper-view-box", "cropper-face"].forEach((cls) => {
    const el = ct.querySelector("." + cls);
    if (el) { el.style.setProperty("border-radius", "50%", "important"); }
  });
  const cb = ct.querySelector(".cropper-crop-box");
  if (cb) {
    cb.style.setProperty("outline", "3px solid rgba(244,184,71,0.9)", "important");
    cb.style.setProperty("outline-offset", "-1px");
  }
  ct.querySelectorAll(".cropper-point").forEach((p) => {
    p.style.setProperty("display", "none", "important");
  });
  const md = ct.querySelector(".cropper-modal");
  if (md) { md.style.setProperty("background-color", "rgba(0,0,0,0.55)", "important"); }
}

function doConfirm() {
  if (!cropper) { alert("裁剪组件未就绪"); return; }
  try {
    const canvas = cropper.getCroppedCanvas({
      width: 400,
      height: 400,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "high",
    });
    if (!canvas || canvas.width === 0) { alert("裁剪失败：画布为空"); return; }

    canvas.toBlob(
      (blob) => {
        if (!blob || blob.size === 0) { alert("裁剪失败：图片为空"); return; }
        emit("confirm", blob);
        doCleanup();
      },
      "image/jpeg",
      0.92
    );
  } catch (e) {
    alert("裁剪出错: " + (e.message || "未知错误"));
  }
}

function doCancel() {
  emit("cancel");
  doCleanup();
}

function doCleanup() {
  visible.value = false;
  if (cropper) { try { cropper.destroy(); } catch (_) {} cropper = null; }
  if (objectUrl.value) { URL.revokeObjectURL(objectUrl.value); objectUrl.value = ""; }
}

onBeforeUnmount(() => {
  if (cropper) { try { cropper.destroy(); } catch (_) {} cropper = null; }
  if (objectUrl.value) { URL.revokeObjectURL(objectUrl.value); objectUrl.value = ""; }
});
</script>

<style>
/* v1 cropperjs 圆形裁切 */
.cropper-crop-box, .cropper-view-box, .cropper-face { border-radius: 50% !important; }
.cropper-crop-box { outline: 3px solid rgba(244,184,71,0.9) !important; outline-offset: -1px; }
.cropper-view-box { outline: none !important; }
.cropper-point { display: none !important; }
.cropper-modal { background-color: rgba(0,0,0,0.55) !important; }
</style>

<style scoped>
.cropper-overlay {
  position: fixed; inset: 0; z-index: 9999;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.78);
  backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  padding: 24px;
}
.cropper-panel {
  width: 720px; max-width: 96vw;
  display: flex; flex-direction: column;
  background: #141414;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 16px;
  box-shadow: 0 32px 96px rgba(0,0,0,0.65);
  overflow: hidden;
}
.cropper-top {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 24px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  flex-shrink: 0; gap: 16px;
}
.cropper-top h3 {
  display: flex; align-items: center; gap: 8px;
  font-size: 17px; font-weight: 600; color: #f0ece4; margin: 0; white-space: nowrap;
}
.cropper-desc { font-size: 13px; color: rgba(240,236,228,0.45); white-space: nowrap; }
.cropper-stage {
  height: 500px; background: #000;
  display: flex; align-items: center; justify-content: center; overflow: hidden;
}
.cropper-stage img { display: block; max-width: 100%; max-height: 100%; }
.cropper-buttons {
  display: flex; justify-content: center; gap: 20px;
  padding: 18px 24px;
  border-top: 1px solid rgba(255,255,255,0.08);
  flex-shrink: 0; background: #141414;
}
.btn-cancel, .btn-confirm {
  display: inline-flex; align-items: center; gap: 8px;
  height: 52px; padding: 0 36px; border-radius: 10px;
  font-size: 16px; font-weight: 600; cursor: pointer;
  min-width: 150px; justify-content: center; user-select: none;
}
.btn-cancel {
  border: 1px solid rgba(255,255,255,0.16);
  background: transparent; color: rgba(240,236,228,0.75);
}
.btn-cancel:hover { background: rgba(255,255,255,0.05); color: #f0ece4; }
.btn-confirm {
  border: none; color: #1a1a1a;
  background: linear-gradient(135deg, #fff3bd 0%, #f4b847 50%, #e8a020 100%);
  box-shadow: 0 4px 24px rgba(244,184,71,0.35);
}
.btn-confirm:hover { transform: translateY(-2px); box-shadow: 0 6px 32px rgba(244,184,71,0.5); }
.btn-confirm:active { transform: translateY(0); }

@media (max-width: 820px) {
  .cropper-overlay { padding: 0; }
  .cropper-panel { width: 100vw; height: 100dvh; max-width: 100vw; border-radius: 0; border: none; }
  .cropper-top { padding: 14px 16px; padding-top: calc(14px + env(safe-area-inset-top, 0px)); }
  .cropper-desc { display: none; }
  .cropper-stage { flex: 1; height: auto; }
  .cropper-buttons { padding: 14px 16px; padding-bottom: calc(14px + env(safe-area-inset-bottom, 16px)); gap: 12px; }
  .btn-cancel, .btn-confirm { flex: 1; min-width: 0; height: 52px; }
}
</style>
