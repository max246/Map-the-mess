import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 10000,
})

export default api

export const API_BASE_URL = import.meta.env.VITE_API_URL || ''

export const imageUrl = (img) => `${API_BASE_URL}/api/reports/images/${img.url}`
export const thumbnailUrl = (img) =>
  `${API_BASE_URL}/api/reports/images/${img.thumbnail_url || img.url}`

export const customInstance = (config) => {
  return api(config).then((response) => response.data)
}
