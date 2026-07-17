import request from "../api/request";

let publicKeyPromise = null;

function pemToArrayBuffer(pem) {
  const base64 = String(pem || "")
    .replace(/-----BEGIN PUBLIC KEY-----/g, "")
    .replace(/-----END PUBLIC KEY-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function bytesToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function getCredentialPublicKey() {
  // 浏览器不支持 crypto.subtle（非 HTTPS 环境），返回 null 走明文降级
  if (!globalThis.crypto?.subtle) {
    console.warn("[安全] 当前环境不支持 Web Crypto API（需要 HTTPS），登录凭据将明文传输");
    return null;
  }
  if (!publicKeyPromise) {
    publicKeyPromise = request.get("/auth/public-key")
      .then((res) => {
        if (res.code !== 200 || !res.data?.public_key) throw new Error(res.msg || "获取登录加密公钥失败");
        return crypto.subtle.importKey(
          "spki",
          pemToArrayBuffer(res.data.public_key),
          { name: "RSA-OAEP", hash: "SHA-256" },
          false,
          ["encrypt"],
        );
      })
      .catch((error) => {
        publicKeyPromise = null;
        throw error;
      });
  }
  return publicKeyPromise;
}

async function encryptValue(value, key) {
  const encoded = new TextEncoder().encode(String(value ?? ""));
  const encrypted = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, key, encoded);
  return `rsa:${bytesToBase64(encrypted)}`;
}

export async function encryptCredentialFields(data = {}, fields = []) {
  const key = await getCredentialPublicKey();
  // 不支持 crypto.subtle 时返回明文（不标记 credential_encrypted，后端会原样处理）
  if (!key) return { ...data };
  const payload = { ...data, credential_encrypted: true, credential_algorithm: "RSA-OAEP-256" };
  await Promise.all(fields.map(async (field) => {
    if (Object.prototype.hasOwnProperty.call(payload, field) && payload[field] !== null && payload[field] !== undefined) {
      payload[field] = await encryptValue(payload[field], key);
    }
  }));
  return payload;
}
