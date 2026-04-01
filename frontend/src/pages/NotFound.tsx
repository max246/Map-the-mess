import { Link } from 'react-router-dom'
import PageMeta from '../components/PageMeta'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center text-center px-4 py-16 md:py-24">
      <PageMeta title="Page Not Found" description="The page you are looking for does not exist." />
      <h1 className="text-6xl md:text-8xl font-bold text-brand mb-4">404</h1>
      <p className="text-xl md:text-2xl text-gray-600 mb-8">
        The page you are looking for does not exist.
      </p>
      <Link
        to="/"
        className="bg-brand hover:bg-brand-dark text-white font-semibold px-8 py-3 rounded-lg text-lg transition"
      >
        Go Home
      </Link>
    </div>
  )
}
