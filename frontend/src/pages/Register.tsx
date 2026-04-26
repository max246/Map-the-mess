import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import GoogleSignInButton from '../components/GoogleSignInButton'
import PageMeta from '../components/PageMeta'
import CityAutocomplete from '../components/CityAutocomplete'
import { useAuth } from '../context/AuthContext'

export default function Register() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [cityDisplay, setCityDisplay] = useState('')
  const [cityLat, setCityLat] = useState(0)
  const [cityLon, setCityLon] = useState(0)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [registered, setRegistered] = useState(false)
  const { register, loginWithProvider } = useAuth()
  const navigate = useNavigate()

  const handleGoogleCredential = useCallback(
    async (credential: string) => {
      if (!acceptedTerms) {
        setError('Please accept the disclaimer and privacy policy before continuing.')
        return
      }
      setError('')
      try {
        await loginWithProvider('google', credential)
        navigate('/admin')
      } catch (err: unknown) {
        const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail
        setError(typeof detail === 'string' ? detail : 'Google sign-up failed.')
      }
    },
    [acceptedTerms, loginWithProvider, navigate]
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    try {
      await register(email, fullName, password, cityLat, cityLon)
      setRegistered(true)
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (registered) {
    return (
      <div className="max-w-sm mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">📧</div>
        <h1 className="text-2xl font-bold mb-3">Check your email</h1>
        <p className="text-gray-600 mb-6">
          We've sent a verification link to <span className="font-medium">{email}</span>. Please
          click the link to verify your account before logging in.
        </p>
        <Link to="/login" className="text-brand font-medium hover:underline">
          Go to login
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <PageMeta
        title="Register"
        description="Create a Map the Mess account to start reporting litter and volunteering for cleanups."
      />
      <h1 className="text-2xl font-bold mb-6 text-center">Create an account</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
            {error}
          </div>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">Full name</span>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Enter your full name"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            required
          />
        </label>

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
            placeholder="At least 6 characters"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            required
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">Confirm password</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter your password"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            required
          />
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">Your city</span>
          {cityDisplay ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 truncate">{cityDisplay}</span>
              <button
                type="button"
                onClick={() => {
                  setCityDisplay('')
                  setCityLat(0)
                  setCityLon(0)
                }}
                className="text-xs text-brand hover:underline"
              >
                Change
              </button>
            </div>
          ) : (
            <CityAutocomplete
              onSelect={(displayName, lat, lon) => {
                setCityDisplay(displayName)
                setCityLat(lat)
                setCityLon(lon)
              }}
              placeholder="Start typing your city..."
            />
          )}
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-brand"
          />
          <span className="text-sm text-gray-600">
            I agree to the{' '}
            <Link to="/disclaimer" className="text-brand hover:underline font-medium">
              disclaimer and conditions of use
            </Link>{' '}
            and{' '}
            <Link to="/privacy" className="text-brand hover:underline font-medium">
              privacy policy
            </Link>
            , including that litter collection is done at my own risk and I must obtain landowner
            permission before entering private land.
          </span>
        </label>

        <button
          type="submit"
          disabled={loading || !acceptedTerms || !cityDisplay}
          className="bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
        >
          {loading ? 'Creating account...' : 'Register'}
        </button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-gray-400">
        <span className="flex-1 border-t border-gray-200" />
        <span>or</span>
        <span className="flex-1 border-t border-gray-200" />
      </div>

      <GoogleSignInButton onCredential={handleGoogleCredential} text="signup_with" />

      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account?{' '}
        <Link to="/login" className="text-brand font-medium hover:underline">
          Log in
        </Link>
      </p>
    </div>
  )
}
