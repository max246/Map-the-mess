import { useState } from 'react'
import PageMeta from '../components/PageMeta'
import { useAuth } from '../context/AuthContext'

const DISCOUNT_CODE = '10OFFCHECKOUT'

function DiscountBanner() {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(DISCOUNT_CODE)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked — ignore */
    }
  }

  return (
    <div className="mb-6 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
      <div className="flex-1 text-sm text-gray-700">
        <p className="font-semibold text-gray-900 mb-0.5">Volunteer perk: 10% off at HH Environmental</p>
        <p className="text-gray-600">
          Use code at checkout on{' '}
          <a
            href="https://www.hhenvironmental.co.uk/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-700 font-medium underline hover:no-underline"
          >
            hhenvironmental.co.uk
          </a>
          .
        </p>
      </div>
      <div className="flex items-center gap-2">
        <code className="px-3 py-1.5 bg-white border border-emerald-300 rounded-lg text-sm font-mono font-semibold text-emerald-700 tracking-wider">
          {DISCOUNT_CODE}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? 'Copied' : 'Copy discount code'}
          title={copied ? 'Copied!' : 'Copy code'}
          className="p-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition"
        >
          {copied ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}

const TOOLS = [
  {
    name: 'Community Recycled Litter Picker',
    description:
      'Made from 74% recycled materials, this lightweight and durable picker is designed for volunteers, schools, and community groups. A sustainable choice trusted by thousands across the UK.',
    rating: 4,
    url: 'https://www.hhenvironmental.co.uk/products/community-recycled-litter-picker',
    image:
      'https://www.hhenvironmental.co.uk/cdn/shop/files/community-recycled-litter-picker.webp?v=1753439745',
  },
  {
    name: 'Ranger MAX Heavy Duty Litter Picker',
    description:
      'A straight soft-grip handle picker built for heavy-duty use. The Ranger MAX is ideal for tackling tougher litter and debris in parks, streets, and countryside cleanups.',
    rating: 5,
    url: 'https://www.hhenvironmental.co.uk/products/ranger-max-straight-heavy-duty-litter-picker',
    image:
      'https://www.hhenvironmental.co.uk/cdn/shop/files/ranger-max-straight-heavy-duty-litter-picker.webp?v=1753785008',
  },
  {
    name: 'Litter Picker PRO Folding Grabber',
    description:
      'All the benefits of the trusted PRO range in a convenient, collapsible design. Folds compactly to fit in bags, backpacks, or car door pockets — perfect for beaches, walks, and hikes.',
    rating: 4,
    url: 'https://www.hhenvironmental.co.uk/products/litter-picker-pro-folding-litter-grabber',
    image:
      'https://www.hhenvironmental.co.uk/cdn/shop/files/litterpicker-pro-folding-litter-grabber.webp?v=1753779112',
  },
  {
    name: 'Handi Scoop PRO Pooper Scooper',
    description:
      'A practical pooper scooper for keeping paths and green spaces clean. Lightweight, easy to use, and a handy companion for dog walkers who want to go the extra mile.',
    rating: 3,
    url: 'https://www.hhenvironmental.co.uk/products/handi-scoop-pro-pooper-scooper',
    image:
      'https://www.hhenvironmental.co.uk/cdn/shop/files/handi-scoop-pooper-scooper.webp?v=1753784736',
  },
]

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`w-4 h-4 ${star <= rating ? 'text-yellow-400' : 'text-gray-200'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}

export default function Tools() {
  const { isLoggedIn } = useAuth()

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 md:py-12">
      <PageMeta
        title="Best Litter Picking Tools"
        description="Tried and tested by our volunteers — here are the tools we recommend for keeping your community clean."
      />
      {isLoggedIn && <DiscountBanner />}
      <div className="text-center mb-8 md:mb-12">
        <h1 className="text-3xl md:text-4xl font-bold mb-3">Best Litter Picking Tools</h1>
        <p className="text-gray-500 max-w-2xl mx-auto">
          Tried and tested by our volunteers — here are the tools we recommend for keeping your
          community clean.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {TOOLS.map((tool) => (
          <div
            key={tool.name}
            className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col hover:shadow-md transition"
          >
            <img
              src={tool.image}
              alt={tool.name}
              className="h-48 w-full object-contain bg-white p-2"
            />

            <div className="p-4 flex flex-col gap-2 flex-1">
              <h2 className="font-semibold text-lg leading-tight">{tool.name}</h2>
              <Stars rating={tool.rating} />
              <p className="text-sm text-gray-500 leading-relaxed flex-1">{tool.description}</p>
              <a
                href={tool.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center justify-center gap-1.5 bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition"
              >
                View Product
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"
                  />
                </svg>
              </a>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 bg-gray-50 rounded-xl p-6 text-sm text-gray-500">
        <p>
          Ratings are based on feedback from our volunteer community. We are not affiliated with any
          of these products — just sharing what works for us!
        </p>
      </div>
    </div>
  )
}
