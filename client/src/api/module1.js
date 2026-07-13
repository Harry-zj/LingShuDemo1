import request from "./request";

// Smart Result (综测表)
export const getSmartResult = (params = {}) =>
  request.get("/module1/smart-result", { params });

export const updateSmartResult = (data) =>
  request.put("/module1/smart-result", data);

export const submitSmartResult = (data = {}) =>
  request.post("/module1/smart-result/submit", data);

// Materials (材料)
export const getMaterials = () =>
  request.get("/module1/materials");

export const createMaterial = (title) =>
  request.post("/module1/materials", { title });

export const submitMaterial = (id) =>
  request.put(`/module1/materials/${id}/submit`);

// Upload
export const uploadFile = (formData) =>
  request.post("/module1/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

// AI Match
export const aiMatch = (data) =>
  request.post("/module1/ai-match", data);
