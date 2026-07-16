<template>
  <div class="profile-page">
    <div class="page-header">
      <h2>个人中心</h2>
      <p class="page-desc">完善账号资料；点击编辑图标可逐项修改。</p>
    </div>

    <!-- 基础信息 -->
    <ProfileBasicView />

    <!-- 修改密码入口 -->
    <div class="password-entry">
      <button class="btn-password" @click="showPwdModal = true">
        <VIcon icon="mdi:lock-reset" />
        <span>修改密码</span>
      </button>
    </div>

    <!-- 修改密码弹窗 -->
    <teleport to="body">
      <transition name="modal-fade">
        <div v-if="showPwdModal" class="modal-backdrop" @click.self="closePwdModal">
          <div class="modal-dialog">
            <div class="modal-header">
              <h3><VIcon icon="mdi:lock-reset" />修改密码</h3>
              <button class="modal-close-btn" @click="closePwdModal" aria-label="关闭">
                <VIcon icon="mdi:close" />
              </button>
            </div>
            <div class="modal-body">
              <div class="form-grid">
                <label>
                  <span>原密码</span>
                  <input v-model="pwd.old_password" type="password" placeholder="请输入原密码" />
                </label>
                <label>
                  <span>新密码</span>
                  <input v-model="pwd.new_password" type="password" placeholder="至少 6 位" />
                </label>
                <label>
                  <span>确认新密码</span>
                  <input v-model="pwd.confirm" type="password" placeholder="请再次输入新密码" />
                </label>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn-cancel" @click="closePwdModal">取消</button>
              <button class="btn-confirm" @click="updatePwd" :disabled="changing">
                <VIcon icon="mdi:key-change" />{{ changing ? "修改中..." : "确认修改" }}
              </button>
            </div>
          </div>
        </div>
      </transition>
    </teleport>
  </div>
</template>

<script setup>
import { ref } from "vue";
import ProfileBasicView from "./ProfileBasicView.vue";
import { changePassword } from "../../api/auth";

defineProps({ view: { type: String, default: "basic" } });

const showPwdModal = ref(false);
const pwd = ref({ old_password: "", new_password: "", confirm: "" });
const changing = ref(false);

function closePwdModal() {
  showPwdModal.value = false;
  pwd.value = { old_password: "", new_password: "", confirm: "" };
}

async function updatePwd() {
  if (!pwd.value.old_password || !pwd.value.new_password) return alert("请填写原密码和新密码");
  if (pwd.value.new_password !== pwd.value.confirm) return alert("两次输入的新密码不一致");
  if (pwd.value.new_password.length < 6) return alert("新密码至少需要 6 位");
  changing.value = true;
  try {
    const res = await changePassword({
      old_password: pwd.value.old_password,
      new_password: pwd.value.new_password,
    });
    if (res.code === 200) {
      alert("密码修改成功");
      closePwdModal();
    } else {
      alert(res.msg || "修改失败");
    }
  } finally {
    changing.value = false;
  }
}
</script>

<style scoped>
.profile-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 22px;
  width: 100%;
  animation: fadeIn 0.35s var(--easing-decelerate);
}

.page-header {
  text-align: center;
}

.page-header h2 {
  font-size: 22px;
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  margin: 0;
}

.page-desc {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin-top: 4px;
}

/* 修改密码入口 */
.password-entry {
  display: flex;
  justify-content: center;
}

.btn-password {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 40px;
  padding: 0 16px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s;
}

.btn-password:hover {
  color: var(--color-text);
  border-color: var(--color-text-secondary);
}

/* 弹窗 */
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  padding: 16px;
}

.modal-dialog {
  width: min(92vw, 440px);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
}

.modal-header h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.modal-close-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.modal-close-btn:hover {
  background: var(--color-gray-bg);
  color: var(--color-text);
}

.modal-body {
  padding: 20px;
}

.form-grid {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.form-grid label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.form-grid input {
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  outline: none;
  background: var(--color-surface-variant);
  color: var(--color-text);
  font-size: 14px;
}

.form-grid input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(244, 184, 71, 0.15);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid var(--color-border);
}

.btn-cancel,
.btn-confirm {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 38px;
  padding: 0 18px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  font-weight: 500;
}

.btn-cancel {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
}

.btn-cancel:hover {
  background: var(--color-gray-bg);
}

.btn-confirm {
  border: none;
  color: var(--color-text-inverse);
  background: var(--gradient-primary);
}

.btn-confirm:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 过渡动画 */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 移动端 */
@media (max-width: 520px) {
  .modal-dialog {
    width: 100vw;
    border-radius: 0;
    height: 100dvh;
    max-height: 100dvh;
    display: flex;
    flex-direction: column;
  }
  .modal-body {
    flex: 1;
  }
  .modal-footer {
    padding-bottom: calc(14px + env(safe-area-inset-bottom, 0px));
  }
}
</style>
