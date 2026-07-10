import { defineStore } from "pinia";
const KEY = "lingshu_user";
export const useUserStore = defineStore("user", {
  state: () => {
    const saved = localStorage.getItem(KEY);
    return saved ? JSON.parse(saved) : { token: "", user: null };
  },
  getters: {
    isLoggedIn: (s) => !!s.token,
    userRole: (s) => s.user?.role || "",
  },
  actions: {
    setAuth(token, user) {
      this.token = token;
      this.user = user;
      localStorage.setItem(KEY, JSON.stringify({ token, user }));
    },
    logout() {
      this.token = ""; this.user = null;
      localStorage.removeItem(KEY);
    },
  },
});
