<template>
  <div class="page">
    <header class="page-head">
      <div>
        <h1>{{ currentRoleName }}评价工作台</h1>
        <p>评价人员按“某一个加分项目 + 下方支撑材料”的方式核查评价表，不再查看学生手动填写材料。</p>
      </div>
      <button @click="load">刷新</button>
    </header>

    <section class="panel">
      <h2>待我评价</h2>
      <div v-if="!forms.length" class="empty">当前没有待{{ currentRoleName }}评价的综测评价表。</div>

      <article v-for="form in forms" :key="form.id" class="form-card">
        <div class="form-head">
          <div>
            <h3>{{ form.student_name }} - {{ form.class_name }}</h3>
            <p>{{ form.batch_title }} · {{ statusLabel(form.status) }}</p>
          </div>
          <strong>综合分：{{ form.scores.total }}</strong>
        </div>

        <div class="bonus-list">
          <section v-for="item in form.bonus_items" :key="item.id" class="bonus-card">
            <h4>{{ item.title }} <em>+{{ item.score }}分</em></h4>
            <p><strong>评价表位置：</strong>{{ item.table_position }}</p>
            <p><strong>智能填表说明：</strong>{{ item.reason }}</p>
            <div class="evidence">
              <strong>支撑材料：</strong>
              <a v-for="file in item.evidence_files" :key="file.id" :href="file.url" target="_blank" rel="noopener noreferrer">{{ file.name || file.file_name }}</a>
            </div>
          </section>
        </div>

        <textarea v-model="comments[form.id]" placeholder="填写评价意见，例如：材料真实有效，建议通过。"></textarea>
        <div class="actions">
          <button class="approve" @click="handleReview(form.id, 'approve')">通过</button>
          <button class="return" @click="handleReview(form.id, 'return')">退回修改</button>
          <button class="reject" @click="handleReview(form.id, 'reject')">不予认定</button>
        </div>
      </article>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { getPendingReviews, reviewMaterial } from "../../api/module3";
import { useUserStore } from "../../stores/user";
import { roleLabel, statusLabel } from "../../utils/constants";

const userStore = useUserStore();
const forms = ref([]);
const comments = ref({});
const currentRoleName = computed(() => roleLabel(userStore.role));

async function load() {
  const res = await getPendingReviews();
  if (res.code === 200) forms.value = res.data;
  else alert(res.msg);
}

async function handleReview(id, action) {
  const res = await reviewMaterial(id, { action, comment: comments.value[id] || "" });
  if (res.code === 200) {
    alert("评价处理完成");
    await load();
  } else {
    alert(res.msg);
  }
}

onMounted(load);
</script>

<style scoped>
.page { display: grid; gap: 20px; }
.page-head { display: flex; justify-content: space-between; align-items: start; gap: 16px; }
h1, h2, h3, h4 { margin: 0; color: #111827; }
.page-head p, .form-head p { margin: 8px 0 0; color: #6b7280; line-height: 1.7; }
button { border: none; border-radius: 8px !important; padding: 10px 14px; cursor: pointer; background: #e5e7eb; }
.panel, .form-card, .bonus-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px !important; padding: 20px; display: grid; gap: 16px; }
.form-head { display: flex; justify-content: space-between; gap: 12px; align-items: start; }
.form-head strong { color: #2563eb; }
.bonus-list { display: grid; gap: 12px; }
.bonus-card { background: #f9fafb; padding: 16px; }
.bonus-card em { color: #2563eb; font-style: normal; font-size: 14px; }
.bonus-card p { margin: 0; color: #4b5563; line-height: 1.7; }
.evidence { display: flex; flex-wrap: wrap; gap: 8px; color: #374151; }
.evidence a { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px !important; padding: 4px 10px; font-size: 13px; color: #2563eb; text-decoration: none; }
textarea { min-height: 84px; border: 1px solid #d1d5db; border-radius: 8px !important; padding: 12px; resize: vertical; }
.actions { display: flex; gap: 10px; flex-wrap: wrap; }
.actions .approve { background: #16a34a; color: #fff; }
.actions .return { background: #f59e0b; color: #fff; }
.actions .reject { background: #dc2626; color: #fff; }
.empty { color: #6b7280; }

/* 模块三局部圆角兜底：仅作用于当前模块三组件树，不影响顶部导航及其他模块。 */
:deep(*) {
  border-radius: 8px !important;
}

</style>
