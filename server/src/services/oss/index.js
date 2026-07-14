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

module.exports = { uploadBuffer, downloadBuffer, isOssUrl, extractKeyFromUrl, buildPublicUrl, generateKey };
