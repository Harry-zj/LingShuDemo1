import request from './request';

export const getBatches = (params) => request.get('/module3/batches', { params });
export const createBatch = (data) => request.post('/module3/batches', data);
export const updateBatch = (id, data) => request.put(`/module3/batches/${id}`, data);
export const updateBatchStatus = (id, data) => request.put(`/module3/batches/${id}/status`, data);
export const getMyMaterials = (params) => request.get('/module3/materials', { params });
export const reviewMaterial = (id, data) => request.put(`/module3/materials/${id}/review`, data);
export const getPendingReviews = (params) => request.get('/module3/pending', { params });
export const getStatistics = (params) => request.get('/module3/statistics', { params });
export const exportExcel = (data) => request.post('/module3/export', data);
export const getClasses = () => request.get('/module3/classes');
export const getUsers = (params) => request.get('/module3/users', { params });
export const setClassLeader = (classId, data) => request.put(`/module3/classes/${classId}/leader`, data);
export const getNotifications = () => request.get('/module3/notifications');
export const getLogs = (params) => request.get('/module3/logs', { params });
