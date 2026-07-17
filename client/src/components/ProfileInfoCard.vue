<template>
  <div class="profile-info-card glass-card">
    <div class="card-head">
      <h3><VIcon icon="mdi:card-account-details-outline" />基本信息</h3>
    </div>

    <div class="info-rows">
      <!-- 学号（只读） -->
      <div v-if="isStudent" class="info-row">
        <span class="row-label">学号</span>
        <div class="row-value">
          <span v-if="editingField !== 'student_no'" class="value-text">{{ user.student_no || '-' }}</span>
          <input
            v-else
            v-model="editValues.student_no"
            class="row-input"
            disabled
          />
          <span class="row-tag">只读</span>
        </div>
      </div>

      <!-- 姓名 -->
      <div
        class="info-row"
        :class="{ 'is-editing': editingField === 'real_name' }"
        v-if="isStudent"
      >
        <span class="row-label">姓名 <span class="required">*</span></span>
        <div class="row-value">
          <template v-if="editingField !== 'real_name'">
            <span class="value-text">{{ user.real_name || '未设置' }}</span>
            <button type="button" class="row-edit-btn" @click="startEdit('real_name')" aria-label="编辑姓名">
              <VIcon icon="mdi:pencil-outline" />
            </button>
          </template>
          <template v-else>
            <input
              v-model="editValues.real_name"
              class="row-input"
              placeholder="请输入姓名"
              ref="realNameInput"
              @keydown.enter="saveField('real_name')"
              @keydown.escape="cancelEdit"
            />
            <div class="row-actions">
              <button type="button" class="action-btn save" @click="saveField('real_name')" aria-label="保存">
                <VIcon icon="mdi:check" />
              </button>
              <button type="button" class="action-btn cancel" @click="cancelEdit" aria-label="取消">
                <VIcon icon="mdi:close" />
              </button>
            </div>
          </template>
        </div>
      </div>

      <!-- 学院 -->
      <div class="info-row" :class="{ 'is-editing': editingField === 'college' }">
        <span class="row-label">学院<span v-if="isStudent || isCounselor"> <span class="required">*</span></span></span>
        <div class="row-value">
          <template v-if="editingField !== 'college'">
            <span class="value-text">{{ user.college || '未设置' }}</span>
            <button
              v-if="!isNoProfileRequired"
              type="button"
              class="row-edit-btn"
              @click="startEdit('college')"
              aria-label="编辑学院"
            >
              <VIcon icon="mdi:pencil-outline" />
            </button>
          </template>
          <template v-else>
            <select v-model="editValues.college" class="row-input" @change="onCollegeChange">
              <option value="">请选择学院</option>
              <option v-for="c in org.colleges" :key="c.name" :value="c.name">{{ c.name }}</option>
            </select>
            <div class="row-actions">
              <button type="button" class="action-btn save" @click="saveField('college')" aria-label="保存">
                <VIcon icon="mdi:check" />
              </button>
              <button type="button" class="action-btn cancel" @click="cancelEdit" aria-label="取消">
                <VIcon icon="mdi:close" />
              </button>
            </div>
          </template>
        </div>
      </div>

      <!-- 年级 -->
      <div class="info-row" :class="{ 'is-editing': editingField === 'grade' }">
        <span class="row-label">年级<span v-if="isStudent || isCounselor"> <span class="required">*</span></span></span>
        <div class="row-value">
          <template v-if="editingField !== 'grade'">
            <span class="value-text">{{ user.grade || '未设置' }}</span>
            <button
              v-if="!isNoProfileRequired"
              type="button"
              class="row-edit-btn"
              @click="startEdit('grade')"
              aria-label="编辑年级"
            >
              <VIcon icon="mdi:pencil-outline" />
            </button>
          </template>
          <template v-else>
            <select v-model="editValues.grade" class="row-input" @change="onGradeChange">
              <option value="">请选择年级</option>
              <option v-for="g in gradeOptions" :key="g" :value="g">{{ g }}</option>
            </select>
            <div class="row-actions">
              <button type="button" class="action-btn save" @click="saveField('grade')" aria-label="保存">
                <VIcon icon="mdi:check" />
              </button>
              <button type="button" class="action-btn cancel" @click="cancelEdit" aria-label="取消">
                <VIcon icon="mdi:close" />
              </button>
            </div>
          </template>
        </div>
      </div>

      <!-- 专业（仅学生） -->
      <div v-if="isStudent" class="info-row" :class="{ 'is-editing': editingField === 'major' }">
        <span class="row-label">专业 <span class="required">*</span></span>
        <div class="row-value">
          <template v-if="editingField !== 'major'">
            <span class="value-text">{{ user.major || '未设置' }}</span>
            <button type="button" class="row-edit-btn" @click="startEdit('major')" aria-label="编辑专业">
              <VIcon icon="mdi:pencil-outline" />
            </button>
          </template>
          <template v-else>
            <select v-model="editValues.major" class="row-input" @change="onMajorChange" :disabled="!editValues.college">
              <option value="">请选择专业</option>
              <option v-for="m in majorOptions" :key="m.id" :value="m.name">{{ m.name }}</option>
            </select>
            <div class="row-actions">
              <button type="button" class="action-btn save" @click="saveField('major')" aria-label="保存">
                <VIcon icon="mdi:check" />
              </button>
              <button type="button" class="action-btn cancel" @click="cancelEdit" aria-label="取消">
                <VIcon icon="mdi:close" />
              </button>
            </div>
          </template>
        </div>
      </div>

      <!-- 班级（仅学生） -->
      <div v-if="isStudent" class="info-row" :class="{ 'is-editing': editingField === 'class_name' }">
        <span class="row-label">班级 <span class="required">*</span></span>
        <div class="row-value">
          <template v-if="editingField !== 'class_name'">
            <span class="value-text">{{ user.class_name || '未设置' }}</span>
            <button type="button" class="row-edit-btn" @click="startEdit('class_name')" aria-label="编辑班级">
              <VIcon icon="mdi:pencil-outline" />
            </button>
          </template>
          <template v-else>
            <select v-model="editValues.class_name" class="row-input" :disabled="!editValues.college || !editValues.major || !editValues.grade">
              <option value="">请选择班级</option>
              <option v-for="c in classOptions" :key="c.id" :value="c.name">{{ c.name }}</option>
            </select>
            <div class="row-actions">
              <button type="button" class="action-btn save" @click="saveField('class_name')" aria-label="保存">
                <VIcon icon="mdi:check" />
              </button>
              <button type="button" class="action-btn cancel" @click="cancelEdit" aria-label="取消">
                <VIcon icon="mdi:close" />
              </button>
            </div>
          </template>
        </div>
      </div>

      <!-- 手机号 -->
      <div class="info-row" :class="{ 'is-editing': editingField === 'phone' }">
        <span class="row-label">手机号</span>
        <div class="row-value">
          <template v-if="editingField !== 'phone'">
            <span class="value-text">{{ user.phone || '未设置' }}</span>
            <button type="button" class="row-edit-btn" @click="startEdit('phone')" aria-label="编辑手机号">
              <VIcon icon="mdi:pencil-outline" />
            </button>
          </template>
          <template v-else>
            <input
              v-model="editValues.phone"
              class="row-input"
              placeholder="请输入手机号"
              type="tel"
              ref="phoneInput"
              @keydown.enter="saveField('phone')"
              @keydown.escape="cancelEdit"
            />
            <div class="row-actions">
              <button type="button" class="action-btn save" @click="saveField('phone')" aria-label="保存">
                <VIcon icon="mdi:check" />
              </button>
              <button type="button" class="action-btn cancel" @click="cancelEdit" aria-label="取消">
                <VIcon icon="mdi:close" />
              </button>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- 全局保存状态提示 -->
    <transition name="fade">
      <div v-if="savingMsg" class="save-toast" :class="{ 'is-error': saveError }">
        <VIcon :icon="saveError ? 'mdi:alert-circle-outline' : 'mdi:check-circle-outline'" />
        <span>{{ savingMsg }}</span>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, reactive, computed, nextTick } from "vue";
import { updateProfile } from "../api/auth";
import { useUserStore } from "../stores/user";

const props = defineProps({
  user: { type: Object, required: true },
  org: { type: Object, required: true },
});

const userStore = useUserStore();

const editingField = ref(null);
const saving = ref(false);
const savingMsg = ref("");
const saveError = ref(false);
const editValues = reactive({});

// Input refs
const realNameInput = ref(null);
const phoneInput = ref(null);

const isStudent = computed(() => userStore.user?.role === "student");
const isCounselor = computed(() => userStore.user?.role === "counselor");
const isNoProfileRequired = computed(() => ["admin", "student_affairs"].includes(userStore.user?.role));

// 级联下拉选项（来自 org）
const selectedCollege = computed(() =>
  props.org.colleges?.find((c) => c.name === (editingField.value === "college" ? editValues.college : props.user.college))
);
const majorOptions = computed(() =>
  (props.org.majors || []).filter((m) => !selectedCollege.value || Number(m.college_id) === Number(selectedCollege.value.id))
);
const gradeOptions = computed(() =>
  [...new Set((props.org.classes || [])
    .filter((c) => !editValues.college || c.college === editValues.college)
    .map((c) => c.grade)
    .filter(Boolean))]
    .sort()
    .reverse()
);
const classOptions = computed(() =>
  (props.org.classes || []).filter(
    (c) => c.college === (editValues.college || props.user.college) &&
      c.major === (editValues.major || props.user.major) &&
      c.grade === (editValues.grade || props.user.grade)
  )
);

function onCollegeChange() {
  editValues.major = "";
  editValues.grade = "";
  editValues.class_name = "";
}
function onMajorChange() {
  editValues.class_name = "";
}
function onGradeChange() {
  editValues.class_name = "";
}

function startEdit(field) {
  if (saving.value) return;
  // 初始化编辑值
  editValues.real_name = props.user.real_name || "";
  editValues.college = props.user.college || "";
  editValues.grade = props.user.grade || "";
  editValues.major = props.user.major || "";
  editValues.class_name = props.user.class_name || "";
  editValues.phone = props.user.phone || "";

  editingField.value = field;

  // 聚焦输入框
  nextTick(() => {
    if (field === "real_name") realNameInput.value?.focus();
    else if (field === "phone") phoneInput.value?.focus();
  });
}

function cancelEdit() {
  editingField.value = null;
  saveError.value = false;
  savingMsg.value = "";
}

async function saveField(field) {
  if (saving.value) return;
  saving.value = true;
  saveError.value = false;
  savingMsg.value = "";

  try {
    const payload = { [field]: editValues[field] };
    const res = await updateProfile(payload);
    if (res.code === 200) {
      userStore.setAuth(userStore.token, res.data);
      editingField.value = null;
      savingMsg.value = "已保存";
      saveError.value = false;
      setTimeout(() => { savingMsg.value = ""; }, 2000);
    } else {
      saveError.value = true;
      savingMsg.value = res.msg || "保存失败";
    }
  } catch (e) {
    console.error("保存失败:", e);
    saveError.value = true;
    savingMsg.value = "保存失败，请稍后重试";
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.profile-info-card {
  padding: 20px;
  border-radius: 8px !important;
}

.card-head {
  margin-bottom: 16px;
}

.card-head h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  margin: 0;
}

.info-rows {
  display: flex;
  flex-direction: column;
}

.info-row {
  display: flex;
  align-items: center;
  padding: 12px 4px;
  border-bottom: 1px solid var(--color-border);
  min-height: 48px;
  transition: background 0.15s;
}

.info-row:last-child {
  border-bottom: none;
}

.info-row:hover {
  background: var(--color-gray-bg);
  border-radius: 8px;
}

.info-row.is-editing {
  background: var(--color-gray-bg);
  border-radius: 8px;
  padding: 10px 8px;
}

.row-label {
  width: 80px;
  flex-shrink: 0;
  font-size: 13px;
  color: var(--color-text-secondary);
  font-weight: 500;
}

.required {
  color: var(--color-error);
}

.row-value {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.value-text {
  font-size: 14px;
  color: var(--color-text);
  word-break: break-all;
}

.row-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--color-gray-bg);
  color: var(--color-text-tertiary);
  margin-left: auto;
}

.row-edit-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-tertiary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: auto;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s, color 0.15s;
  flex-shrink: 0;
}

.info-row:hover .row-edit-btn {
  opacity: 1;
}

.row-edit-btn:hover {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.row-input {
  flex: 1;
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 14px;
  outline: none;
  min-width: 0;
}

.row-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(244, 184, 71, 0.15);
}

.row-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.row-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.action-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  transition: background 0.15s;
}

.action-btn.save {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.action-btn.save:hover {
  background: var(--color-success);
  color: #fff;
}

.action-btn.cancel {
  background: var(--color-error-bg);
  color: var(--color-error);
}

.action-btn.cancel:hover {
  background: var(--color-error);
  color: #fff;
}

.save-toast {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 13px;
  background: var(--color-success-bg);
  color: var(--color-success);
}

.save-toast.is-error {
  background: var(--color-error-bg);
  color: var(--color-error);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 移动端适配 */
@media (max-width: 820px) {
  .info-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    padding: 14px 4px;
  }

  .row-label {
    width: 100%;
    font-size: 12px;
  }

  .row-value {
    width: 100%;
  }

  .row-edit-btn {
    opacity: 1;
    width: 36px;
    height: 36px;
  }

  .row-input {
    height: 44px;
    font-size: 16px;
  }

  .action-btn {
    width: 44px;
    height: 44px;
    font-size: 20px;
  }

  .row-input {
    font-size: 16px;
  }

  .value-text {
    font-size: 15px;
  }
}

@media (max-width: 520px) {
  .profile-info-card {
    padding: 14px;
  }
}
</style>
