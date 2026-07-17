const multer = require("multer");
const config = require("../config");

const allowedTypes = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
];

/**
 * OSS 上传中间件 — 使用 memoryStorage，文件以 Buffer 形式存在 req.files[].buffer
 * 供控制器读取后上传至阿里云 OSS
 * 复用原 upload.js 的 fileFilter 和 limits 配置
 */
module.exports = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.upload.maxSize },
  fileFilter: (req, file, cb) => {
    if (allowedTypes.includes(file.mimetype)) cb(null, true);
    else cb(new Error("仅支持图片、PDF、Word、Excel 支撑材料"));
  }
});
