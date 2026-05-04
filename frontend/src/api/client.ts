import axios, { type AxiosRequestConfig } from 'axios'
import { tryRefreshToken, authBridge } from '../context/AuthContext'

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

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // Don't retry refresh/login calls or already-retried requests
    if (
      error.response?.status === 401 &&
      localStorage.getItem('refresh_token') &&
      !originalRequest._skipAuthRetry &&
      !originalRequest._retried
    ) {
      originalRequest._retried = true

      const newToken = await tryRefreshToken()
      if (newToken) {
        authBridge.updateToken(newToken)
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return api(originalRequest)
      }

      // Refresh failed — clear everything and notify React
      localStorage.removeItem('token')
      localStorage.removeItem('refresh_token')
      authBridge.handleSessionExpired()
    }

    if (error.response?.status === 413) {
      alert('The image is too large to upload. Please use a smaller image (max 50 MB).')
    }

    return Promise.reject(error)
  }
)

export default api

export const API_BASE_URL = import.meta.env.VITE_API_URL || ''

export const imageUrl = (img: { url: string }) => `${API_BASE_URL}/api/reports/images/${img.url}`
export const thumbnailUrl = (img: { thumbnail_url?: string | null; url: string }) =>
  `${API_BASE_URL}/api/reports/images/${img.thumbnail_url || img.url}`

export const communityImageUrl = (filename: string) =>
  `${API_BASE_URL}/api/reports/images/${filename}`

export const rafflePrizeImageUrl = (filename: string) =>
  `${API_BASE_URL}/api/raffles/images/${filename}`

export const customInstance = <T>(config: AxiosRequestConfig): Promise<T> => {
  return api(config).then((response) => response.data)
}
