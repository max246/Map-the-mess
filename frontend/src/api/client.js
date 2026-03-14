import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 10000
})

export default api

export const API_BASE_URL = import.meta.env.VITE_API_URL || ''

export const customInstance = (config) => {
  return api(config).then((response) => response.data)
}
