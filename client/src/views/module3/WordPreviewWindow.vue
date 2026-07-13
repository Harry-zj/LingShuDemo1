<template>
  <div class="word-document-card">
    <div class="word-icon"><VIcon icon="mdi:file-word-box" /></div>
    <div class="word-meta">
      <strong>{{ document?.name || '尚未生成智能填表 Word 文档' }}</strong>
      <span v-if="document">生成时间：{{ formatDateTime(document.generated_at) }}</span>
      <span v-else>请先前往智能填表完成自动填表并生成 Word 文档。</span>
    </div>
    <div class="word-actions">
      <button class="btn-outline" :disabled="!document" @click="openPreview">
        <VIcon icon="mdi:eye-outline" />预览
      </button>
      <button class="btn-outline" :disabled="!document || downloading" @click="downloadWord">
        <VIcon icon="mdi:download-outline" />{{ downloading ? '下载中...' : '下载' }}
      </button>
    </div>
  </div>

  <div
    v-if="visible"
    ref="windowRef"
    class="word-preview-window"
    :style="windowStyle"
  >
    <div class="preview-titlebar" @mousedown="startDrag">
      <div>
        <VIcon icon="mdi:file-word-outline" />
        <strong>{{ document?.name || 'Word 预览' }}</strong>
      </div>
      <button class="preview-close" title="关闭预览" @click.stop="closePreview">
        <VIcon icon="mdi:close" />
      </button>
    </div>
    <div class="preview-body">
      <div v-if="loading" class="preview-state"><VIcon icon="mdi:loading" class="spin" />正在加载 Word 文档...</div>
      <div v-else-if="error" class="preview-state error"><VIcon icon="mdi:alert-circle-outline" />{{ error }}</div>
      <iframe
        v-else
        class="preview-frame"
        :srcdoc="previewDocument"
        sandbox=""
        referrerpolicy="no-referrer"
        title="综测表 Word 文档预览"
      ></iframe>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue';
import { downloadFormWord, getFormWordPreview } from '../../api/module3';

const props = defineProps({
  formId: { type: [Number, String], required: true },
  document: { type: Object, default: null },
});

const visible = ref(false);
const loading = ref(false);
const downloading = ref(false);
const error = ref('');
const previewHtml = ref('');
const position = ref({ x: null, y: 92 });
const dragging = ref(null);
const windowRef = ref(null);

const windowStyle = computed(() => ({
  left: position.value.x === null ? 'auto' : `${position.value.x}px`,
  right: position.value.x === null ? '24px' : 'auto',
  top: `${position.value.y}px`,
}));

const previewDocument = computed(() => `<!doctype html>
<html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;background:#eef1f5;color:#202124;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif}
body{padding:22px}.document-page{box-sizing:border-box;max-width:900px;min-height:calc(100vh - 44px);margin:0 auto;padding:42px 48px;background:#fff;box-shadow:0 2px 14px rgba(0,0,0,.12)}
p{line-height:1.75;margin:.65em 0}table{width:100%;border-collapse:collapse;margin:14px 0}td,th{border:1px solid #777;padding:6px 8px;vertical-align:top}img{max-width:100%;height:auto}a{color:#1967d2}ul,ol{padding-left:24px}
@media(max-width:640px){body{padding:8px}.document-page{padding:22px 18px}}
</style></head><body><main class="document-page">${previewHtml.value}</main></body></html>`);

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
}

async function openPreview() {
  if (!props.document) return;
  visible.value = true;
  if (previewHtml.value || loading.value) return;
  loading.value = true;
  error.value = '';
  try {
    const res = await getFormWordPreview(props.formId);
    if (res.code !== 200) throw new Error(res.msg || 'Word 文档预览失败');
    previewHtml.value = res.data?.html || '<p>该 Word 文档暂无可预览内容。</p>';
  } catch (requestError) {
    error.value = requestError?.response?.data?.msg || requestError?.message || 'Word 文档预览失败';
  } finally {
    loading.value = false;
  }
}

function closePreview() {
  visible.value = false;
}

async function downloadWord() {
  if (!props.document || downloading.value) return;
  downloading.value = true;
  try {
    const blob = await downloadFormWord(props.formId);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = props.document.name || '综测表_智能填表结果.docx';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (requestError) {
    alert(requestError?.response?._data?.msg || requestError?.message || 'Word 文档下载失败');
  } finally {
    downloading.value = false;
  }
}

function startDrag(event) {
  if (event.button !== 0 || event.target.closest('.preview-close')) return;
  const rect = windowRef.value?.getBoundingClientRect();
  if (!rect) return;
  dragging.value = { offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
  position.value = { x: rect.left, y: rect.top };
  window.addEventListener('mousemove', dragWindow);
  window.addEventListener('mouseup', stopDrag, { once: true });
}

function dragWindow(event) {
  if (!dragging.value) return;
  const width = windowRef.value?.offsetWidth || 720;
  const height = windowRef.value?.offsetHeight || 520;
  position.value = {
    x: Math.max(8, Math.min(window.innerWidth - width - 8, event.clientX - dragging.value.offsetX)),
    y: Math.max(8, Math.min(window.innerHeight - height - 8, event.clientY - dragging.value.offsetY)),
  };
}

function stopDrag() {
  dragging.value = null;
  window.removeEventListener('mousemove', dragWindow);
}

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', dragWindow);
  window.removeEventListener('mouseup', stopDrag);
});
</script>

<style scoped>
.word-document-card { display:flex; align-items:center; gap:14px; padding:16px; border:1px solid var(--color-border); border-radius:8px; background:var(--color-bg); }
.word-icon { display:grid; place-items:center; width:46px; height:46px; border-radius:8px; background:rgba(37,99,235,.10); color:#2563eb; font-size:28px; flex:0 0 auto; }
.word-meta { min-width:0; flex:1; display:flex; flex-direction:column; gap:5px; }
.word-meta strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.word-meta span { color:var(--color-text-secondary); font-size:12px; line-height:1.5; }
.word-actions { display:flex; gap:8px; flex:0 0 auto; }
.word-actions button { margin:0; }
.word-actions button:disabled { opacity:.5; cursor:not-allowed; }
.word-preview-window { position:fixed; z-index:80; width:min(760px,calc(100vw - 48px)); height:min(72vh,720px); min-width:360px; min-height:300px; resize:both; overflow:hidden; border:1px solid var(--color-border); border-radius:10px; background:var(--color-surface); box-shadow:0 18px 48px rgba(15,23,42,.28); }
.preview-titlebar { height:46px; display:flex; align-items:center; justify-content:space-between; gap:12px; padding:0 10px 0 14px; border-bottom:1px solid var(--color-border); background:var(--color-surface); cursor:move; user-select:none; }
.preview-titlebar > div { min-width:0; display:flex; align-items:center; gap:8px; }
.preview-titlebar strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:13px; }
.preview-close { display:grid; place-items:center; width:30px; height:30px; border:0; border-radius:7px; background:transparent; color:var(--color-text-secondary); cursor:pointer; }
.preview-close:hover { background:var(--color-bg); color:var(--color-text-primary); }
.preview-body { height:calc(100% - 46px); background:#eef1f5; }
.preview-frame { width:100%; height:100%; border:0; background:#eef1f5; }
.preview-state { height:100%; display:flex; align-items:center; justify-content:center; gap:8px; color:var(--color-text-secondary); }
.preview-state.error { color:#dc2626; padding:20px; text-align:center; }
.spin { animation:spin 1s linear infinite; }
@keyframes spin { to { transform:rotate(360deg); } }
@media (max-width:640px) { .word-document-card { align-items:flex-start; flex-wrap:wrap; }.word-actions { width:100%; }.word-actions button { flex:1; }.word-preview-window { min-width:0; width:calc(100vw - 16px); right:8px !important; left:auto !important; top:72px !important; height:70vh; resize:none; } }
</style>
