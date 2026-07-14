"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { getPublicKeyInfo, decryptCredentialFields } = require("../src/services/credentialCrypto");

const root = path.resolve(__dirname, "../..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

function encrypt(publicKey, value) {
  return `rsa:${crypto.publicEncrypt({
    key: publicKey,
    padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: "sha256",
  }, Buffer.from(value, "utf8")).toString("base64")}`;
}

test("RSA-OAEP credentials can be decrypted and plaintext is rejected", () => {
  const { public_key: publicKey, algorithm } = getPublicKeyInfo();
  const body = decryptCredentialFields({
    credential_encrypted: true,
    credential_algorithm: algorithm,
    account: encrypt(publicKey, "a000001"),
    password: encrypt(publicKey, "secret123"),
    role: "admin",
  }, ["account", "password"]);
  assert.equal(body.account, "a000001");
  assert.equal(body.password, "secret123");
  assert.equal(body.role, "admin");
  assert.throws(() => decryptCredentialFields({ account: "a000001", password: "secret123" }, ["account", "password"]), /必须加密传输/);
});

test("frontend encrypts authentication credential fields", () => {
  const authApi = read("client/src/api/auth.js");
  const cryptoUtil = read("client/src/utils/credentialCrypto.js");
  assert.match(authApi, /encryptCredentialFields\(data, \["account", "username", "password"\]\)/);
  assert.match(authApi, /encryptCredentialFields\(data, \["username", "student_no", "password"\]\)/);
  assert.match(authApi, /encryptCredentialFields\(data, \["old_password", "new_password"\]\)/);
  assert.match(cryptoUtil, /RSA-OAEP/);
  assert.match(cryptoUtil, /credential_encrypted: true/);
});

test("counselor scope uses class checkboxes", () => {
  const view = read("client/src/views/module3/CounselorConsole.vue");
  assert.match(view, /type="checkbox"/);
  assert.match(view, /v-model="draftScope\.class_ids"/);
  assert.doesNotMatch(view, /select v-model="draftScope\.class_ids" multiple/);
});

test("admin account deletion is wired and guarded", () => {
  const routes = read("server/src/routes/module3.js");
  const service = read("server/src/services/module3/adminService.js");
  const client = read("client/src/views/module3/AdminAccountManage.vue");
  assert.match(routes, /router\.delete\("\/admin\/accounts\/:id"/);
  assert.match(service, /不能删除当前登录的管理员账号/);
  assert.match(service, /系统至少需要保留一个管理员账号/);
  assert.match(service, /SET is_active=0, deleted_at=NOW\(\)/);
  assert.match(client, /删除账号/);
});

test("admin manual student organization fields use linked organization dropdowns", () => {
  const client = read("client/src/views/module3/AdminAccountManage.vue");
  const service = read("server/src/services/module3/adminService.js");
  assert.match(client, /select v-model="student\.college"/);
  assert.match(client, /select v-model="student\.major"/);
  assert.match(client, /select v-model="student\.grade"/);
  assert.match(client, /select v-model="student\.class_name"/);
  assert.doesNotMatch(client, /input v-model="student\.(college|major|grade|class_name)"/);
  assert.match(client, /getOrganizations/);
  assert.match(client, /studentMajorOptions/);
  assert.match(client, /studentGradeOptions/);
  assert.match(client, /studentClassOptions/);
  assert.match(service, /resolveStudentOrganization/);
  assert.match(service, /所选班级不存在、已停用或与学院专业年级不匹配/);
});
