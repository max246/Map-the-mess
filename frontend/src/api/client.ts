import axios, { type AxiosRequestConfig } from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 10000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default api

export const API_BASE_URL = import.meta.env.VITE_API_URL || ''

export const imageUrl = (img: { url: string }) => `${API_BASE_URL}/api/reports/images/${img.url}`
export const thumbnailUrl = (img: { thumbnail_url?: string | null; url: string }) =>
  `${API_BASE_URL}/api/reports/images/${img.thumbnail_url || img.url}`

export const customInstance = <T>(config: AxiosRequestConfig): Promise<T> => {
  return api(config).then((response) => response.data)
}
