<template>
  <div class="class-leader-desk">
    <div class="page-header">
      <h2>班级初审台</h2>
      <p class="page-desc">查看本班提交情况，检查材料完整性、附件清晰度和类别准确性</p>
    </div>

    <div class="stats-row">
      <div class="stat-card warning"><VIcon icon="mdi:clock-outline" class="stat-icon" /><div class="stat-num">{{ pending.length }}</div><div class="stat-lbl">待初审</div></div>
      <div class="stat-card success"><VIcon icon="mdi:account-check-outline" class="stat-icon" /><div class="stat-num">{{ stats.submitted_students || 0 }}</div><div class="stat-lbl">已提交人数</div></div>
      <div class="stat-card error"><VIcon icon="mdi:account-alert-outline" class="stat-icon" /><div class="stat-num">{{ stats.unsubmitted_students || 0 }}</div><div class="stat-lbl">未提交人数</div></div>
    </div>

    <section class="review-list glass-card">
      <div class="panel-header">
        <h3><VIcon icon="mdi:format-list-checks" />待审核列表</h3>
        <select v-model="currentBatch" @change="load">
          <option value="">全部批次</option>
          <option v-for="b in batches" :key="b.id" :value="b.id">{{ b.title }}</option>
        </select>
      </div>
      <div class="review-items">
        <article class="review-row" v-for="(m, i) in pending" :key="m.id" :style="{ animationDelay: (i * 0.05) + 's' }">
          <div class="row-info">
            <div class="student-avatar">{{ m.student_name?.[0] }}</div>
            <div class="student-detail">
              <div class="student-line"><strong>{{ m.student_name }}</strong><span>{{ m.class_name }}</span></div>
              <h4>{{ m.title }}</h4>
              <p>{{ m.application_text || '暂无说明' }}</p>
              <div class="meta-line">
                <span>类别：{{ m.category || '未分类' }}</span>
                <span>分值：{{ m.score || 0 }}</span>
                <span>附件：{{ m.attachments?.length || 0 }} 个</span>
              </div>
              <div class="attachments" v-if="m.attachments?.length">
                <span v-for="a in m.attachments" :key="a.id"><VIcon icon="mdi:paperclip" />{{ a.original_name || a.file_name }}</span>
              </div>
              <textarea v-model="comments[m.id]" rows="2" placeholder="填写审核意见，如：材料完整 / 附件不清晰需重传"></textarea>
            </div>
          </div>
          <div class="btns">
            <button class="btn-approve" @click="doReview(m.id, 'approve')"><VIcon icon="mdi:check" />通过</button>
            <button class="btn-return" @click="doReview(m.id, 'return')"><VIcon icon="mdi:undo" />退回</button>
            <button class="btn-reject" @click="doReview(m.id, 'reject')"><VIcon icon="mdi:close" />驳回</button>
          </div>
        </article>
        <div class="empty-state" v-if="!pending.length">
          <VIcon icon="mdi:check-circle-outline" class="empty-icon" />
          <p>当前没有待初审材料</p>
        </div>
      </div>
    </section>

    <section class="glass-card list-card" v-if="stats.unsubmitted?.length">
      <div class="panel-header"><h3><VIcon icon="mdi:account-alert-outline" />未提交名单</h3></div>
      <div class="chip-list">
        <span v-for="s in stats.unsubmitted" :key="s.id">{{ s.real_name }} · {{ s.class_name }}</span>
      </div>
    </section>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { getBatches, getPendingReviews, getStatistics, reviewMaterial } from '../../api/module3';

const batches = ref([]);
const currentBatch = ref('');
const pending = ref([]);
const stats = ref({});
const comments = reactive({});

async function load() {
  const params = currentBatch.value ? { batch_id: currentBatch.value } : {};
  const [bRes, pRes, sRes] = await Promise.all([getBatches(), getPendingReviews(params), getStatistics(params)]);
  if (bRes.code === 200) batches.value = bRes.data || [];
  if (pRes.code === 200) pending.value = pRes.data || [];
  if (sRes.code === 200) stats.value = sRes.data || {};
}
async function doReview(id, action) {
  const res = await reviewMaterial(id, { action, comment: comments[id] || '' });
  alert(res.msg || '审核操作完成');
  comments[id] = '';
  await load();
}

onMounted(load);
</script>

<style scoped>
.class-leader-desk { display: flex; flex-direction: column; gap: 24px; animation: fadeIn 0.4s var(--easing-decelerate); }
.page-header h2 { font-size: 22px; font-weight: var(--font-weight-semibold); }
.page-desc { font-size: 14px; color: var(--color-text-secondary); margin-top: 2px; }
.stats-row { display: flex; gap: 16px; }
.stat-card { flex: 1; padding: 24px; border-radius: var(--radius-lg); text-align: center; opacity: 0; animation: fadeInUp 0.5s var(--easing-spring) forwards; }
.stat-card.warning { background: var(--color-warning-bg); border: 1px solid rgba(217,119,6,0.15); }
.stat-card.success { background: var(--color-success-bg); border: 1px solid rgba(5,150,105,0.15); }
.stat-card.error { background: var(--color-error-bg); border: 1px solid rgba(220,38,38,0.15); }
.stat-icon { font-size: 24px; margin-bottom: 8px; }
.stat-num { font-size: 32px; font-weight: var(--font-weight-bold); }
.stat-lbl { font-size: 14px; color: var(--color-text-secondary); margin-top: 4px; }
.review-list, .list-card { border-radius: var(--radius-xl); padding: 24px; }
.panel-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.panel-header h3 { font-size: 16px; font-weight: var(--font-weight-semibold); display: flex; align-items: center; gap: 8px; }
select, textarea { border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 9px 12px; background: var(--color-white); color: var(--color-text); outline: none; }
.review-items { display: flex; flex-direction: column; gap: 12px; }
.review-row { display: flex; justify-content: space-between; gap: 16px; padding: 16px; border: 1px solid var(--color-border); border-radius: var(--radius-lg); background: var(--color-white); opacity: 0; animation: fadeInUp 0.4s var(--easing-spring) forwards; }
.row-info { display: flex; align-items: flex-start; gap: 12px; flex: 1; }
.student-avatar { width: 40px; height: 40px; border-radius: 50%; background: var(--color-primary-gradient-bright); color: white; display: flex; align-items: center; justify-content: center; font-weight: var(--font-weight-semibold); flex-shrink: 0; }
.student-detail { display: flex; flex-direction: column; gap: 8px; flex: 1; }
.student-line { display: flex; align-items: center; gap: 10px; }
.student-line span, .meta-line, .attachments span { color: var(--color-text-secondary); font-size: 12px; }
h4 { font-size: 16px; color: var(--color-text); }
p { color: var(--color-text-secondary); font-size: 14px; }
.meta-line, .attachments { display: flex; flex-wrap: wrap; gap: 10px; }
.attachments span { display: inline-flex; align-items: center; gap: 4px; background: var(--color-gray-bg); border-radius: var(--radius-full); padding: 4px 10px; }
.btns { display: flex; flex-direction: column; gap: 8px; flex-shrink: 0; }
.btn-approve, .btn-return, .btn-reject { display: inline-flex; align-items: center; gap: 4px; padding: 8px 14px; border-radius: var(--radius-full); font-size: 13px; font-weight: var(--font-weight-medium); cursor: pointer; transition: all var(--duration-fast) var(--easing-spring); }
.btn-approve { border: none; background: var(--color-success); color: #fff; }
.btn-return { border: 1px solid var(--color-warning); background: #fff; color: var(--color-warning); }
.btn-reject { border: 1px solid var(--color-error); background: #fff; color: var(--color-error); }
.empty-state { text-align: center; padding: 48px; color: var(--color-text-tertiary); }
.empty-icon { font-size: 48px; margin-bottom: 12px; color: var(--color-success); }
.chip-list { display: flex; flex-wrap: wrap; gap: 8px; }
.chip-list span { padding: 6px 12px; border-radius: var(--radius-full); background: var(--color-error-bg); color: var(--color-error); font-size: 13px; }
@media (max-width: 768px) { .stats-row { flex-direction: column; } .review-row { flex-direction: column; } .btns { flex-direction: row; flex-wrap: wrap; justify-content: flex-end; } }
</style>
