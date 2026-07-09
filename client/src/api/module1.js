import request from './request';

export const getMaterials = (params) => request.get('/module1/materials', { params });
export const getMaterialDetail = (id) => request.get(`/module1/materials/${id}`);
export const createMaterial = (data) => request.post('/module1/materials', data);
export const updateMaterial = (id, data) => request.put(`/module1/materials/${id}`, data);
export const submitMaterial = (id) => request.put(`/module1/materials/${id}/submit`);
export const uploadFile = (data) => request.post('/module1/upload', data, { headers: { 'Content-Type': 'multipart/form-data' } });
export const aiMatch = (data) => request.post('/module1/ai-match', data);
export const batchFill = (data) => request.post('/module1/batch-fill', data);
export const chatFill = (data) => request.post('/module1/chat-fill', data);
