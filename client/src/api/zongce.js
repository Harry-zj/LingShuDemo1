import request from "./request";

// ===== 规则 =====
export const uploadRuleFiles = (formData) =>
  request.post("/zongce/rules/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const addRuleText = (text) =>
  request.post("/zongce/rules/text", { text });

export const getRuleSources = () =>
  request.get("/zongce/rules/sources");

export const getRuleItems = () =>
  request.get("/zongce/rules/items");

export const toggleRuleItem = (id) =>
  request.put(`/zongce/rules/items/${id}/toggle`);

export const parseRuleSource = (id) =>
  request.post(`/zongce/rules/sources/${id}/parse`, null, { timeout: 30000 });

export const getParseProgress = (taskId) =>
  request.get(`/zongce/rules/tasks/${taskId}`);

export const deleteRuleSource = (id) =>
  request.delete(`/zongce/rules/sources/${id}`);

export const deleteRuleItem = (id) =>
  request.delete(`/zongce/rules/items/${id}`);

// ===== 材料 =====
export const createMaterial = (title) =>
  request.post("/zongce/materials", { title });

export const getMaterials = () =>
  request.get("/zongce/materials");

export const uploadAttachments = (materialId, formData) =>
  request.post(`/zongce/materials/${materialId}/upload`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const analyzeMaterial = (materialId) =>
  request.post(`/zongce/materials/${materialId}/analyze`, null, { timeout: 120000 });

export const deleteMaterial = (id) =>
  request.delete(`/zongce/materials/${id}`);

export const deleteAttachment = (matId, attId) =>
  request.delete(`/zongce/materials/${matId}/attachments/${attId}`);

// ===== 识别结果 =====
export const confirmRecognition = (id) =>
  request.put(`/zongce/recognitions/${id}/confirm`);

export const dismissRecognition = (id) =>
  request.put(`/zongce/recognitions/${id}/dismiss`);

// ===== 评分 =====
export const calculateScore = () =>
  request.post("/zongce/evaluation/calculate");

export const getEvaluation = () =>
  request.get("/zongce/evaluation/result");

// ===== 模板与填表 =====
export const uploadTemplate = (formData) =>
  request.post("/zongce/templates/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const getTemplates = () =>
  request.get("/zongce/templates");

export const doFill = (templateId) =>
  request.post(`/zongce/fill/${templateId}`);

export const downloadFill = (id) =>
  request.get(`/zongce/fill/${id}/download`, { responseType: "blob" });
