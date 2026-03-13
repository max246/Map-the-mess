import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'

const ROLES = ['superuser', 'admin', 'moderator', 'volunteer']

export default function UserManagement() {
  const { isLoggedIn, canManageUsers, token } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(null)
  const [error, setError] = useState('')

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } }

  useEffect(() => {
    if (!token) return
    axios.get('/api/auth/users', authHeaders)
      .then(res => setUsers(res.data))
      .catch(() => setError('Failed to load users.'))
      .finally(() => setLoading(false))
  }, [token])

  if (!isLoggedIn) return <Navigate to="/login" replace />
  if (!canManageUsers) return <Navigate to="/volunteers" replace />

  const handleRoleChange = async (userId, newRole) => {
    setUpdating(userId)
    setError('')
    try {
      const res = await axios.patch(
        `/api/auth/users/${userId}/type`,
        { user_type: newRole },
        authHeaders
      )
      setUsers(prev => prev.map(u => u.id === userId ? res.data : u))
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Failed to update user role.')
    } finally {
      setUpdating(null)
    }
  }

  const handleDelete = async (userId, email) => {
    if (!confirm(`Are you sure you want to delete user ${email}?`)) return
    setError('')
    try {
      await axios.delete(`/api/auth/users/${userId}`, authHeaders)
      setUsers(prev => prev.filter(u => u.id !== userId))
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Failed to delete user.')
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">User Management</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-4">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-gray-500">
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No users found.
                </td>
              </tr>
            ) : (
              users.map(user => (
                <tr key={user.id} className="border-b last:border-b-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-gray-700">#{user.id}</td>
                  <td className="px-4 py-3 text-gray-700">{user.full_name}</td>
                  <td className="px-4 py-3 text-gray-500">{user.email}</td>
                  <td className="px-4 py-3">
                    <select
                      value={user.user_type}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      disabled={updating === user.id}
                      className={`text-xs font-medium px-2 py-1 rounded-lg border focus:outline-none focus:ring-2 focus:ring-brand ${
                        updating === user.id ? 'opacity-50' : ''
                      } ${
                        user.user_type === 'superuser'
                          ? 'bg-red-50 border-red-200 text-red-700'
                          : user.user_type === 'admin'
                          ? 'bg-purple-50 border-purple-200 text-purple-700'
                          : user.user_type === 'moderator'
                          ? 'bg-blue-50 border-blue-200 text-blue-700'
                          : 'bg-gray-50 border-gray-200 text-gray-700'
                      }`}
                    >
                      {ROLES.map(role => (
                        <option key={role} value={role}>
                          {role.charAt(0).toUpperCase() + role.slice(1)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {new Date(user.created_at).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short', year: 'numeric'
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(user.id, user.email)}
                      className="text-red-500 hover:text-red-700 text-xs font-medium hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
