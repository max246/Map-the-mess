import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import GoogleSignInButton from '../components/GoogleSignInButton'
import PageMeta from '../components/PageMeta'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, loginWithProvider } = useAuth()
  const navigate = useNavigate()

  const handleGoogleCredential = useCallback(
    async (credential: string) => {
      setError('')
      try {
        await loginWithProvider('google', credential)
        navigate('/admin')
      } catch (err: unknown) {
        const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail
        setError(typeof detail === 'string' ? detail : 'Google sign-in failed.')
      }
    },
    [loginWithProvider, navigate]
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/admin')
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      if (typeof detail === 'string' && detail.toLowerCase().includes('verify')) {
        setError(
          'Please verify your email before logging in. Check your inbox for the verification link.'
        )
      } else {
        setError('Invalid email or password.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <PageMeta
        title="Log In"
        description="Log in to your Map the Mess account to report litter and join cleanup efforts."
      />
      <h1 className="text-2xl font-bold mb-6 text-center">Log in</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
            {error}
          </div>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            required
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            required
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
        >
          {loading ? 'Logging in...' : 'Log in'}
        </button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-gray-400">
        <span className="flex-1 border-t border-gray-200" />
        <span>or</span>
        <span className="flex-1 border-t border-gray-200" />
      </div>

      <GoogleSignInButton onCredential={handleGoogleCredential} text="signin_with" />

      <div className="mt-6 text-center text-sm text-gray-500 flex flex-col gap-2">
        <Link to="/forgot-password" className="text-brand hover:underline">
          Forgot your password?
        </Link>
        <p>
          Don't have an account?{' '}
          <Link to="/register" className="text-brand font-medium hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  )
}
