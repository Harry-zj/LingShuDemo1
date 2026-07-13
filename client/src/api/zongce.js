import request from "./request";

// ===== 测评批次（智能填表模块使用） =====
export const getBatches = () =>
  request.get("/zongce/batches");
export const getStudentBatch = () =>
  request.get("/zongce/student-batch");

// ===== 规则 =====
export const uploadRuleFiles = (formData, batchId) => {
    const url = batchId ? `/zongce/rules/upload?batch_id=${batchId}` : "/zongce/rules/upload";
  return request.post(url, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const addRuleText = (text, batchId) =>
  request.post("/zongce/rules/text", { text, batch_id: batchId });

export const getRuleSources = (batchId) =>
  request.get("/zongce/rules/sources", { params: batchId ? { batch_id: batchId } : {} });

export const moveRulesBatch = (fromBatchId, toBatchId) =>
  request.put("/zongce/rules/move-batch", { from_batch_id: fromBatchId, to_batch_id: toBatchId });

export const cancelParse = (taskId) =>
  request.post(`/zongce/rules/parse/${taskId}/cancel`);


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
export const calculateScore = (rule_set_id, material_ids, batch_id) =>
  request.post("/zongce/evaluation/calculate", { rule_set_id, material_ids, batch_id });

export const getScoreList = (ruleSetId, batchId) => request.get("/zongce/evaluation/score-list", { params: { rule_set_id: ruleSetId, batch_id: batchId } });
export const getEvaluation = () =>
  request.get("/zongce/evaluation/result");

// ===== 模板与填表 =====
export const uploadTemplate = (formData) =>
  request.post("/zongce/templates/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const getTemplates = () =>
  request.get("/zongce/templates");
export const deleteTemplate = (id) =>
  request.delete(`/zongce/templates/${id}`);

export const doFill = (templateId, batchId) =>
  request.post(`/zongce/fill/${templateId}`);

export const downloadFill = (id) =>
  request.get(`/zongce/fill/${id}/download`, { responseType: "blob" });

export const getFillPreview = (batchId) =>
  request.get("/zongce/fill-preview", { params: { batch_id: batchId } });

// ★ 保存综合评定结果到 evaluation_results（供个性化分析端 module2 使用）
export const saveEvaluationResult = (data) =>
  request.post("/zongce/evaluation/save-result", data);

// ===== 智能填表数据保存 =====
export const saveFillData = (items, batchId) =>
  request.post("/zongce/smart-fill/save", { items, batch_id: batchId });

export const getSmartFillData = (ruleSetId, batchId) =>
  request.get("/zongce/smart-fill/data", { params: { rule_set_id: ruleSetId, batch_id: batchId } });

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
export const createRuleSet = (batchId) => request.post("/zongce/rule-sets", { batch_id: batchId });
export const getRuleSets = (batchId) => request.get("/zongce/rule-sets", { params: { batch_id: batchId } });
export const getRuleSet = (id) => request.get(`/zongce/rule-sets/${id}`);
export const publishRuleSet = (id) => request.post(`/zongce/rule-sets/${id}/publish`);
export const deleteRuleSet = (id) => request.delete(`/zongce/rule-sets/${id}`);

// ===== V2 规则解析 =====
export const parseRuleSource = (id, batchId) =>
  request.post(`/zongce/rules/sources/${id}/parse`, null, { params: { batch_id: batchId }, timeout: 30000 });

// ===== V2 评分 =====
export const calculateScoreV2 = (rule_set_id, material_ids, batch_id) =>
  request.post("/zongce/evaluation/calculate", { rule_set_id, material_ids, batch_id });
export const getCalculation = (id) => request.get(`/zongce/calculations/${id}`);
export const resumeCalculation = (id) => request.post(`/zongce/calculations/${id}/resume`);
