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
  (err) => Promise.reject(err)
);
export default request;
