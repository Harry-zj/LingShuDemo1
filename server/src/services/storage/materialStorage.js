const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { isOssUrl, downloadBuffer, deleteBuffer } = require("../oss");

function looksLikeWindowsAbsolute(value) {
  return /^[A-Za-z]:[\\/]/.test(String(value || ""));
}

function resolveStorageRoot() {
  const configured = String(process.env.MATERIAL_STORAGE_DIR || "").trim();
  if (configured) {
    if (process.platform === "win32") return path.win32.resolve(configured);
    // 非 Windows 开发环境无法直接使用 D:\\ 路径，自动落到项目目录，避免创建异常目录名。
    if (looksLikeWindowsAbsolute(configured)) return path.resolve(process.cwd(), "cailiao");
    return path.resolve(configured);
  }
  return process.platform === "win32"
    ? path.win32.resolve("D:\\cailiao")
    : path.resolve(process.cwd(), "cailiao");
}

const materialStorageDir = resolveStorageRoot();

function ensureMaterialStorageDir() {
  fs.mkdirSync(materialStorageDir, { recursive: true });
  return materialStorageDir;
}

function safeFileName(originalName) {
  const base = path.basename(String(originalName || "material"));
  const cleaned = base.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_").trim();
  return cleaned || "material";
}

function buildStoredName(originalName) {
  const ext = path.extname(originalName || "");
  const stem = path.basename(safeFileName(originalName), ext).slice(0, 80) || "material";
  const random = crypto.randomBytes(5).toString("hex");
  return `${Date.now()}-${random}-${stem}${ext.toLowerCase()}`;
}

function saveMaterialBuffer(buffer, originalName, options = {}) {
  ensureMaterialStorageDir();
  const userDir = `user-${Number(options.userId || 0) || "unknown"}`;
  const materialDir = `material-${Number(options.materialId || 0) || "pending"}`;
  const targetDir = path.join(materialStorageDir, userDir, materialDir);
  fs.mkdirSync(targetDir, { recursive: true });
  const fullPath = path.join(targetDir, buildStoredName(originalName));
  fs.writeFileSync(fullPath, buffer);
  return fullPath;
}

function isAbsoluteFilePath(value) {
  return path.isAbsolute(value) || looksLikeWindowsAbsolute(value);
}

function normalizeForCompare(value) {
  return String(value || "").replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

function isManagedMaterialPath(filePath) {
  if (!filePath || !isAbsoluteFilePath(filePath)) return false;
  const root = normalizeForCompare(materialStorageDir);
  const target = normalizeForCompare(filePath);
  return target === root || target.startsWith(`${root}/`);
}

function encodeRelativeUrl(relativePath) {
  return relativePath
    .split(/[\\/]+/)
    .filter(Boolean)
    .map(segment => encodeURIComponent(segment))
    .join("/");
}

function toMaterialPublicUrl(filePath) {
  const value = String(filePath || "").trim();
  if (!value) return "";
  if (/^(https?:)?\/\//i.test(value) || value.startsWith("/materials/") || value.startsWith("/uploads/")) {
    return value;
  }
  if (isManagedMaterialPath(value)) {
    const relative = path.relative(materialStorageDir, value);
    return `/materials/${encodeRelativeUrl(relative)}`;
  }
  if (isAbsoluteFilePath(value)) return "";
  return `/uploads/${value.replace(/^\/+/, "")}`;
}

async function readMaterialBuffer(filePath) {
  const value = String(filePath || "").trim();
  if (!value) throw new Error("材料文件地址为空");
  if (isOssUrl(value)) return downloadBuffer(value);
  if (isAbsoluteFilePath(value)) return fs.readFileSync(value);
  const legacyPath = path.join(__dirname, "../../../uploads", value.replace(/^\/+/, ""));
  return fs.readFileSync(legacyPath);
}

async function deleteStoredMaterial(filePath) {
  const value = String(filePath || "").trim();
  if (!value) return;
  try {
    if (isOssUrl(value)) {
      await deleteBuffer(value);
      return;
    }
    const target = isAbsoluteFilePath(value)
      ? value
      : path.join(__dirname, "../../../uploads", value.replace(/^\/+/, ""));
    if (fs.existsSync(target)) fs.unlinkSync(target);
  } catch (error) {
    console.warn("[MaterialStorage] 删除文件失败:", error.message);
  }
}

module.exports = {
  materialStorageDir,
  ensureMaterialStorageDir,
  saveMaterialBuffer,
  toMaterialPublicUrl,
  readMaterialBuffer,
  deleteStoredMaterial,
  isManagedMaterialPath,
};
