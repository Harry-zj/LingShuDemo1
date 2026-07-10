import axios from "axios";
import { useUserStore } from "../stores/user";
const request = axios.create({ baseURL: "/api", timeout: 15000 });
request.interceptors.request.use((config) => {
  const { token } = useUserStore();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
request.interceptors.response.use(
  (res) => res.data,
  async (err) => {
    if (err.response?.data instanceof Blob) {
      try {
        const text = await err.response.data.text();
        const json = JSON.parse(text);
        err.response._data = json;
        console.error("[请求失败]", json.msg || text);
      } catch (_) {}
    }
    return Promise.reject(err);
  }
);
export default request;
