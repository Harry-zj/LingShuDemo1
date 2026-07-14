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
  if (typeof value !== "string" || !value.startsWith("rsa:")) {
    throw new Error("登录凭据未加密或格式不正确，请刷新页面后重试");
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
  if (body.credential_encrypted !== true || body.credential_algorithm !== "RSA-OAEP-256") {
    throw new Error("登录凭据必须加密传输，请刷新页面后重试");
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
