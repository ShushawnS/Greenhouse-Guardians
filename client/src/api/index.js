import axios from 'axios'

// Each service has its own axios instance routed through Vite proxy
export const uploadApi = axios.create({ baseURL: '/api/upload' })
export const classifyApi = axios.create({ baseURL: '/api/classify' })
export const resultsApi = axios.create({ baseURL: '/api/results' })

// Upload Service
export const uploadData = (formData) => uploadApi.post('/uploadData', formData)
export const uploadClassify = (formData) => uploadApi.post('/uploadClassify', formData, { timeout: 180000 })
export const demoClassify = (formData) => uploadApi.post('/demoClassify', formData, { timeout: 180000 })

// Results Service
export const getSummaryResults = () => resultsApi.get('/getSummaryResults')
export const getDetailedRowData = (row) => resultsApi.get('/getDetailedRowData', { params: { row } })
export const getImageUrl = (fileId) => `http://localhost:8003/getImage/${fileId}`
export const getTrends = () => resultsApi.get('/getTrends')
