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

export const deleteRuleSource = (id) =>
  request.delete(`/zongce/rules/sources/${id}`);

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

export const extractMaterial = (materialId) =>
  request.post(`/zongce/materials/${materialId}/extract`, null, { timeout: 120000 });

export const previewScore = (materialId, data) =>
  request.post(`/zongce/materials/${materialId}/preview`, data, { timeout: 30000 });

export const matchMaterial = (materialId, data) =>
  request.post(`/zongce/materials/${materialId}/match`, data, { timeout: 60000 });

export const deleteMaterial = (id) =>
  request.delete(`/zongce/materials/${id}`);

export const deleteAttachment = (matId, attId) =>
  request.delete(`/zongce/materials/${matId}/attachments/${attId}`);

// ===== 识别结果 =====
export const confirmRecognition = (id) =>
  request.put(`/zongce/recognitions/${id}/confirm`);

export const dismissRecognition = (id) =>
  request.put(`/zongce/recognitions/${id}/dismiss`);

// ★ 确认事实匹配（更新 fact_rule_matches.review_status）
export const confirmFactMatch = (id) =>
  request.put(`/zongce/recognitions/fact-match/${id}/confirm`);

// ★ V3 确认加分（材料级别 confirm-match，携带 auth token）
export const confirmMatchMaterial = (materialId, data) =>
  request.post(`/zongce/materials/${materialId}/confirm-match`, data, { timeout: 30000 });

// ★ AI 生成加分描述
export const generateMatchDescription = (materialId, data) =>
  request.post(`/zongce/materials/${materialId}/generate-description`, data, { timeout: 30000 });

// ===== 评分 =====
export const calculateScore = () =>
  request.post("/zongce/evaluation/calculate");

export const getScoreList = (ruleSetId) => request.get("/zongce/evaluation/score-list", { params: { rule_set_id: ruleSetId } });
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

export const getFillPreview = () =>
  request.get("/zongce/fill-preview");
// ===== 智能填表数据保存 =====
export const saveFillData = (items) =>
  request.post("/zongce/smart-fill/save", { items });

export const getSmartFillData = (ruleSetId) =>
  request.get("/zongce/smart-fill/data", { params: { rule_set_id: ruleSetId } });

export const generateF1Description = (section, item_key, item_name) =>
  request.post("/zongce/smart-fill/generate-f1", { section, item_key, item_name });


// ===== 批量填表 =====
export const batchUploadFiles = (formData) =>
  request.post("/zongce/batch-fill/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 60000,
  });

export const batchUpdateMapping = (taskId, mappings) =>
  request.put("/zongce/batch-fill/mapping", { taskId, mappings });

export const batchExecuteFill = (taskId, mappings) =>
  request.post(`/zongce/batch-fill/execute/${taskId}`, { mappings }, { timeout: 120000 });

export const batchDownloadResult = (id) =>
  request.get(`/zongce/batch-fill/${id}/download`, { responseType: "blob" });

// ===== 对话式填表 =====
export const chatFillUpload = (formData) =>
  request.post("/zongce/chat-fill/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const chatFillAnalyze = (templateId) =>
  request.post(`/zongce/chat-fill/analyze/${templateId}`, null, { timeout: 60000 });

export const chatFillDoFill = (templateId, fieldContents) =>
  request.post("/zongce/chat-fill/fill", { templateId, fieldContents });


// ===== V2 规则集 =====
export const createRuleSet = () => request.post("/zongce/rule-sets");
export const getRuleSets = () => request.get("/zongce/rule-sets");
export const getRuleSet = (id) => request.get(`/zongce/rule-sets/${id}`);
export const publishRuleSet = (id) => request.post(`/zongce/rule-sets/${id}/publish`);
export const deleteRuleSet = (id) => request.delete(`/zongce/rule-sets/${id}`);

// ===== V2 规则解析 =====
export const parseRuleSource = (id) =>
  request.post(`/zongce/rules/sources/${id}/parse`, null, { timeout: 30000 });

// ===== V2 评分 =====
export const calculateScoreV2 = (rule_set_id, material_ids) =>
  request.post("/zongce/evaluation/calculate", { rule_set_id, material_ids });
export const getCalculation = (id) => request.get(`/zongce/calculations/${id}`);
export const resumeCalculation = (id) => request.post(`/zongce/calculations/${id}/resume`);
