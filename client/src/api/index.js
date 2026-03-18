import axios from 'axios'

// When VITE_API_BASE_URL is set (e.g. "https://your-space.hf.space"), requests
// go directly to the HF Spaces nginx proxy.  In local dev, the Vite dev server
// proxy handles routing, so the base is just the relative path prefix.
export const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

export const uploadApi = axios.create({ baseURL: `${API_BASE}/api/upload` })
export const classifyApi = axios.create({ baseURL: `${API_BASE}/api/classify` })
export const resultsApi = axios.create({ baseURL: `${API_BASE}/api/results` })

// Upload Service
export const uploadData = (formData) => uploadApi.post('/uploadData', formData)
export const uploadClassify = (formData) => uploadApi.post('/uploadClassify', formData, { timeout: 180000 })
export const demoClassify = (formData) => uploadApi.post('/demoClassify', formData, { timeout: 180000 })

// Results Service
export const getSummaryResults = () => resultsApi.get('/getSummaryResults')
export const getDetailedRowData = (row) => resultsApi.get('/getDetailedRowData', { params: { row } })
export const getImageUrl = (fileId) => `${API_BASE}/api/results/getImage/${fileId}`
export const getTrends = () => resultsApi.get('/getTrends')
export const recomputeTrends = () => resultsApi.post('/recomputeTrends')
export const getAllData = () => resultsApi.get('/getAllData')
export const deleteData = (row) =>
  resultsApi.delete('/deleteData', { params: row != null ? { row } : {} })
