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

  <Teleport to="body">
    <div v-if="visible" class="preview-overlay" @click.self="closePreview">
      <section
        class="word-preview-modal"
        :class="{ fullscreen: isFullscreen }"
        role="dialog"
        aria-modal="true"
        aria-label="综测表 Word 文档预览"
      >
        <header class="preview-titlebar">
          <div class="preview-title">
            <span class="preview-word-icon"><VIcon icon="mdi:file-word-outline" /></span>
            <div>
              <strong>{{ document?.name || 'Word 预览' }}</strong>
              <span>在线预览仅用于快速核对，最终排版请以下载后的 Word 文件为准。</span>
            </div>
          </div>
          <div class="preview-actions">
            <button v-if="previewMessages.length" class="preview-warning" :title="previewMessages.join('\n')">
              <VIcon icon="mdi:alert-outline" />{{ previewMessages.length }} 条转换提示
            </button>
            <button title="下载 Word" :disabled="downloading" @click="downloadWord">
              <VIcon icon="mdi:download-outline" />
            </button>
            <button :title="isFullscreen ? '退出全屏' : '全屏预览'" @click="isFullscreen = !isFullscreen">
              <VIcon :icon="isFullscreen ? 'mdi:fullscreen-exit' : 'mdi:fullscreen'" />
            </button>
            <button title="关闭预览" @click="closePreview">
              <VIcon icon="mdi:close" />
            </button>
          </div>
        </header>

        <div class="preview-body">
          <div v-if="loading" class="preview-state">
            <VIcon icon="mdi:loading" class="spin" />
            <span>正在加载 Word 文档...</span>
          </div>
          <div v-else-if="error" class="preview-state error">
            <VIcon icon="mdi:alert-circle-outline" />
            <strong>预览加载失败</strong>
            <span>{{ error }}</span>
            <button class="btn-outline" @click="loadPreview(true)"><VIcon icon="mdi:refresh" />重新加载</button>
          </div>
          <iframe
            v-else
            class="preview-frame"
            :srcdoc="previewDocument"
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            referrerpolicy="no-referrer"
            title="综测表 Word 文档预览内容"
          ></iframe>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { downloadFormWord, getFormWordPreview } from '../../api/module3';

const props = defineProps({
  formId: { type: [Number, String], required: true },
  document: { type: Object, default: null },
});

const visible = ref(false);
const loading = ref(false);
const downloading = ref(false);
const isFullscreen = ref(false);
const error = ref('');
const previewHtml = ref('');
const previewMessages = ref([]);
let previousBodyOverflow = '';

const previewDocument = computed(() => `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#e7ebf0;color:#202124;font-family:"Microsoft YaHei","PingFang SC",SimSun,Arial,sans-serif}body{padding:24px}.document-page{width:min(210mm,calc(100% - 8px));min-height:297mm;margin:0 auto;padding:18mm 17mm;background:#fff;box-shadow:0 3px 18px rgba(15,23,42,.16);overflow-x:auto;font-size:14px;line-height:1.7}.document-page>:first-child{margin-top:0}.document-page>:last-child{margin-bottom:0}h1,h2,h3,h4,h5,h6{line-height:1.4;margin:1.15em 0 .65em;page-break-after:avoid}h1{font-size:24px;text-align:center}h2{font-size:20px}h3{font-size:17px}p{min-height:1em;margin:.55em 0;overflow-wrap:anywhere}table{width:100%;max-width:100%;border-collapse:collapse;margin:14px 0;table-layout:auto}td,th{border:1px solid #666;padding:6px 8px;vertical-align:middle;overflow-wrap:anywhere;word-break:break-word}th{font-weight:700;background:#f6f7f9}img{display:block;max-width:100%;height:auto;margin:10px auto}a{color:#1967d2;text-decoration:none}a:hover{text-decoration:underline}ul,ol{padding-left:24px}blockquote{margin:12px 0;padding:8px 14px;border-left:4px solid #cbd5e1;background:#f8fafc;color:#475569}.doc-title{text-align:center;font-size:24px;font-weight:700}.doc-subtitle{text-align:center;color:#475569}.page-break{break-before:page;page-break-before:always}
@media(max-width:720px){body{padding:8px}.document-page{width:100%;min-height:calc(100vh - 16px);padding:20px 16px;font-size:13px;box-shadow:none}td,th{padding:5px 6px}}
@media print{body{padding:0;background:#fff}.document-page{width:100%;min-height:0;padding:0;box-shadow:none}}
</style></head><body><main class="document-page">${previewHtml.value}</main></body></html>`);

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
}

async function openPreview() {
  if (!props.document) return;
  visible.value = true;
  await loadPreview(false);
}

async function loadPreview(force = false) {
  if (!props.document || loading.value) return;
  if (previewHtml.value && !force) return;
  loading.value = true;
  error.value = '';
  if (force) {
    previewHtml.value = '';
    previewMessages.value = [];
  }
  try {
    const res = await getFormWordPreview(props.formId);
    if (res.code !== 200) throw new Error(res.msg || 'Word 文档预览失败');
    previewHtml.value = res.data?.html || '<p>该 Word 文档暂无可预览内容。</p>';
    previewMessages.value = Array.isArray(res.data?.messages) ? res.data.messages : [];
  } catch (requestError) {
    error.value = requestError?.response?.data?.msg || requestError?.message || 'Word 文档预览失败';
  } finally {
    loading.value = false;
  }
}

function closePreview() {
  visible.value = false;
  isFullscreen.value = false;
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
    alert(requestError?.response?.data?.msg || requestError?.message || 'Word 文档下载失败');
  } finally {
    downloading.value = false;
  }
}

function handleKeydown(event) {
  if (event.key === 'Escape' && visible.value) closePreview();
}

watch(visible, isVisible => {
  if (isVisible) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = previousBodyOverflow;
  }
});

watch(
  () => [props.formId, props.document?.name, props.document?.generated_at],
  () => {
    previewHtml.value = '';
    previewMessages.value = [];
    error.value = '';
  }
);

onMounted(() => window.addEventListener('keydown', handleKeydown));
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
  document.body.style.overflow = previousBodyOverflow;
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
.preview-overlay { position:fixed; inset:0; z-index:1000; display:grid; place-items:center; padding:24px; background:rgba(15,23,42,.58); backdrop-filter:blur(3px); }
.word-preview-modal { display:flex; flex-direction:column; width:min(1180px,calc(100vw - 48px)); height:min(88vh,900px); overflow:hidden; border:1px solid var(--color-border); border-radius:10px; background:var(--color-surface); box-shadow:0 24px 70px rgba(15,23,42,.36); }
.word-preview-modal.fullscreen { width:calc(100vw - 16px); height:calc(100vh - 16px); border-radius:8px; }
.preview-titlebar { min-height:60px; display:flex; align-items:center; justify-content:space-between; gap:16px; padding:8px 12px 8px 16px; border-bottom:1px solid var(--color-border); background:var(--color-surface); }
.preview-title { min-width:0; display:flex; align-items:center; gap:10px; }
.preview-word-icon { display:grid; place-items:center; width:36px; height:36px; border-radius:8px; background:rgba(37,99,235,.10); color:#2563eb; font-size:22px; flex:0 0 auto; }
.preview-title > div { min-width:0; display:flex; flex-direction:column; gap:3px; }
.preview-title strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:14px; }
.preview-title span { color:var(--color-text-tertiary); font-size:11px; line-height:1.4; }
.preview-actions { display:flex; align-items:center; gap:6px; flex:0 0 auto; }
.preview-actions button { display:inline-flex; align-items:center; justify-content:center; gap:5px; min-width:34px; height:34px; padding:0 8px; border:0; border-radius:8px; background:transparent; color:var(--color-text-secondary); cursor:pointer; }
.preview-actions button:hover { background:var(--color-bg); color:var(--color-text-primary); }
.preview-actions button:disabled { opacity:.5; cursor:not-allowed; }
.preview-actions .preview-warning { width:auto; color:#d97706; font-size:12px; }
.preview-body { min-height:0; flex:1; background:#e7ebf0; }
.preview-frame { width:100%; height:100%; border:0; background:#e7ebf0; }
.preview-state { height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; padding:24px; color:var(--color-text-secondary); text-align:center; }
.preview-state > .v-icon { font-size:28px; }
.preview-state.error { color:#dc2626; }
.preview-state.error span { max-width:560px; color:var(--color-text-secondary); line-height:1.6; }
.preview-state.error button { margin-top:4px; }
.spin { animation:spin 1s linear infinite; }
@keyframes spin { to { transform:rotate(360deg); } }
@media (max-width:700px) {
  .word-document-card { align-items:flex-start; flex-wrap:wrap; }
  .word-actions { width:100%; }
  .word-actions button { flex:1; }
  .preview-overlay { padding:8px; }
  .word-preview-modal, .word-preview-modal.fullscreen { width:100%; height:calc(100vh - 16px); border-radius:8px; }
  .preview-titlebar { min-height:54px; padding:7px 8px 7px 10px; }
  .preview-title span { display:none; }
  .preview-actions .preview-warning { display:none; }
}
</style>
