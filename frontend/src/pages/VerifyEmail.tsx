import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import PageMeta from '../components/PageMeta'
import api from '../api/client'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [resendEmail, setResendEmail] = useState('')
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('No verification token provided.')
      return
    }

    api
      .get('/api/auth/verify', { params: { token } })
      .then(() => {
        setStatus('success')
      })
      .catch((err) => {
        setStatus('error')
        const detail = err?.response?.data?.detail
        setMessage(
          typeof detail === 'string'
            ? detail
            : 'Verification failed. The link may be invalid or expired.'
        )
      })
  }, [token])

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault()
    setResending(true)
    try {
      await api.post('/api/auth/resend-verification', { email: resendEmail })
      setResent(true)
    } catch {
      setMessage('Failed to resend verification email.')
    } finally {
      setResending(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="max-w-sm mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">⏳</div>
        <h1 className="text-2xl font-bold mb-3">Verifying your email...</h1>
        <p className="text-gray-400">Please wait.</p>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="max-w-sm mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-2xl font-bold mb-3">Email verified</h1>
        <p className="text-gray-600 mb-6">Your account is now active. You can log in.</p>
        <Link
          to="/login"
          className="bg-brand hover:bg-brand-dark text-white font-semibold py-3 px-6 rounded-lg transition inline-block"
        >
          Log in
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-16 text-center">
      <PageMeta
        title="Verify Email"
        description="Verify your email address to activate your Map the Mess account."
      />
      <div className="text-5xl mb-4">❌</div>
      <h1 className="text-2xl font-bold mb-3">Verification failed</h1>
      <p className="text-gray-600 mb-6">{message}</p>

      {!resent ? (
        <form onSubmit={handleResend} className="flex flex-col gap-3">
          <p className="text-sm text-gray-500">Enter your email to resend the verification link:</p>
          <input
            type="email"
            value={resendEmail}
            onChange={(e) => setResendEmail(e.target.value)}
            placeholder="Enter your email"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            required
          />
          <button
            type="submit"
            disabled={resending}
            className="bg-brand hover:bg-brand-dark text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-50"
          >
            {resending ? 'Sending...' : 'Resend verification email'}
          </button>
        </form>
      ) : (
        <p className="text-sm text-green-600">Verification email sent! Check your inbox.</p>
      )}

      <Link to="/login" className="text-brand hover:underline text-sm mt-4 inline-block">
        Back to login
      </Link>
    </div>
  )
}
