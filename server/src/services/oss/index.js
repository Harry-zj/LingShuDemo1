const { getClient } = require('./client');
const path = require('path');

const KEY_PREFIX = 'attachments/';

/** 根据 OSS key 构造完整公开访问 URL */
function buildPublicUrl(key) {
  const c = getClient();
  return `https://${c.options.bucket}.${c.options.region}.aliyuncs.com/${key}`;
}

/**
 * 上传 Buffer 到 OSS
 * @param {Buffer} buffer 文件内容
 * @param {string} key OSS 对象路径（如 attachments/xxx.png）
 * @param {string} mimeType MIME 类型
 * @returns {Promise<string>} 完整 OSS 公开 URL
 */
async function uploadBuffer(buffer, key, mimeType) {
  const client = getClient();
  const fullKey = key.startsWith(KEY_PREFIX) ? key : KEY_PREFIX + key;
  const result = await client.put(fullKey, buffer, {
    mime: mimeType,
    headers: { 'x-oss-object-acl': 'public-read' },
  });
  return buildPublicUrl(result.name);
}

/**
 * 从 OSS 下载文件为 Buffer
 * @param {string} urlOrKey 完整 OSS URL 或 OSS key
 * @returns {Promise<Buffer>}
 */
async function downloadBuffer(urlOrKey) {
  const client = getClient();
  let key;
  if (urlOrKey.startsWith('http')) {
    key = extractKeyFromUrl(urlOrKey);
  } else {
    key = urlOrKey.startsWith(KEY_PREFIX) ? urlOrKey : KEY_PREFIX + urlOrKey;
  }
  const result = await client.get(key);
  return result.content;
}

/**
 * 判断字符串是否为完整 HTTP(S) URL（即是否已存储为 OSS 地址）
 * @param {string} str
 * @returns {boolean}
 */
function isOssUrl(str) {
  if (!str) return false;
  return /^https?:\/\//.test(str);
}

/**
 * 从完整 OSS URL 中提取 OSS key
 * @param {string} url 如 https://bucket.region.aliyuncs.com/attachments/xxx.png
 * @returns {string} key 如 attachments/xxx.png
 */
function extractKeyFromUrl(url) {
  const u = new URL(url);
  return u.pathname.replace(/^\//, '');
}

/**
 * 生成 OSS key（保持与旧 multer 命名一致的格式）
 * @param {string} originalName 原始文件名
 * @returns {string}
 */
function generateKey(originalName) {
  const ext = path.extname(originalName);
  return `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
}

/**
 * 删除单个 OSS 对象
 * @param {string} key OSS key 或完整 URL
 */
async function deleteBuffer(key) {
  const client = getClient();
  let fullKey;
  if (key.startsWith('http')) {
    fullKey = extractKeyFromUrl(key);
  } else {
    fullKey = key.startsWith(KEY_PREFIX) ? key : KEY_PREFIX + key;
  }
  await client.delete(fullKey);
}

/**
 * 批量删除 OSS 对象
 * @param {string[]} keys OSS key 或 URL 数组
 */
async function deleteMultiple(keys) {
  if (!keys || keys.length === 0) return;
  const client = getClient();
  const fullKeys = keys.map(k => {
    if (k.startsWith('http')) return extractKeyFromUrl(k);
    return k.startsWith(KEY_PREFIX) ? k : KEY_PREFIX + k;
  });
  await client.deleteMulti(fullKeys, { quiet: true });
}

const AVATAR_KEY_PREFIX = 'avatars/';

/**
 * 上传头像 Buffer 到 OSS（使用 avatars/ 前缀）
 * @param {Buffer} buffer 文件内容
 * @param {string} key OSS 对象路径
 * @param {string} mimeType MIME 类型
 * @returns {Promise<string>} 完整 OSS 公开 URL
 */
async function uploadAvatarBuffer(buffer, key, mimeType) {
  const client = getClient();
  const fullKey = key.startsWith(AVATAR_KEY_PREFIX) ? key : AVATAR_KEY_PREFIX + key;
  const result = await client.put(fullKey, buffer, {
    mime: mimeType,
    headers: { 'x-oss-object-acl': 'public-read' },
  });
  return buildPublicUrl(result.name);
}

/**
 * 删除头像 OSS 对象（兼容 avatars/ 前缀和完整 URL）
 * @param {string} key OSS key 或完整 URL
 */
async function deleteAvatarBuffer(key) {
  const client = getClient();
  let fullKey;
  if (key.startsWith('http')) {
    fullKey = extractKeyFromUrl(key);
  } else {
    fullKey = key.startsWith(AVATAR_KEY_PREFIX) ? key : AVATAR_KEY_PREFIX + key;
  }
  await client.delete(fullKey);
}

module.exports = { uploadBuffer, downloadBuffer, deleteBuffer, deleteMultiple, isOssUrl, extractKeyFromUrl, buildPublicUrl, generateKey, uploadAvatarBuffer, deleteAvatarBuffer, AVATAR_KEY_PREFIX };
