import request from "./request";
import { encryptCredentialFields } from "../utils/credentialCrypto";

export const login = async (data) => request.post(
  "/auth/login",
  await encryptCredentialFields(data, ["account", "username", "password"]),
);
export const register = async (data) => request.post(
  "/auth/register",
  await encryptCredentialFields(data, ["username", "student_no", "password"]),
);
export const getRegisterOptions = () => request.get("/auth/register-options");
export const getProfile = () => request.get("/auth/profile");
export const updateProfile = (data) => request.put("/auth/profile", data);

export const changePassword = async (data) => request.put(
  "/auth/change-password",
  await encryptCredentialFields(data, ["old_password", "new_password"]),
);
