const crypto = require("crypto");

const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

function getPublicKeyInfo() {
  return {
    public_key: publicKey,
    algorithm: "RSA-OAEP-256",
  };
}

function decryptValue(value) {
  // 非加密值直接透传（HTTP 降级场景）
  if (typeof value !== "string" || !value.startsWith("rsa:")) {
    return value;
  }
  try {
    const encrypted = Buffer.from(value.slice(4), "base64");
    return crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      encrypted,
    ).toString("utf8");
  } catch (_) {
    throw new Error("登录凭据解密失败，请刷新页面后重试");
  }
}

function decryptCredentialFields(body = {}, fields = []) {
  // 未加密的请求直接透传（HTTP 降级场景）
  if (body.credential_encrypted !== true) {
    return { ...body };
  }
  const result = { ...body };
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(result, field) && result[field] !== null && result[field] !== undefined) {
      result[field] = decryptValue(result[field]);
    }
  }
  delete result.credential_encrypted;
  delete result.credential_algorithm;
  return result;
}

module.exports = { getPublicKeyInfo, decryptCredentialFields };
