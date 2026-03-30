import PageMeta from '../components/PageMeta'

const ITEMS = [
  {
    name: 'Cigarette Butt',
    years: '1–5',
    icon: '🚬',
    fact: 'Contains over 7,000 chemicals that leach into soil and waterways.',
  },
  {
    name: 'E-Cigarette / Vape',
    years: '100+',
    icon: '🔋',
    fact: 'Plastic casing, lithium battery and heavy metals make these a toxic hazard.',
  },
  {
    name: 'Chewing Gum',
    years: '5',
    icon: '🫧',
    fact: 'Made from synthetic polymers — essentially plastic you chew.',
  },
  {
    name: 'Foam Cup',
    years: '50',
    icon: '☕',
    fact: 'Polystyrene breaks into microplastics but never fully biodegrades.',
  },
  {
    name: 'Plastic Bag',
    years: '10–20',
    icon: '🛍️',
    fact: 'Kills over 100,000 marine animals every year through ingestion and entanglement.',
  },
  {
    name: 'Fast Food Bag',
    years: '1–3',
    icon: '🍔',
    fact: 'Grease and food residue attract rats, foxes and seagulls to streets.',
  },
  {
    name: 'Dog Poo Bag',
    years: '10–1,000',
    icon: '🐕',
    fact: 'Standard plastic bags last centuries. Even "biodegradable" ones need industrial composting.',
  },
  {
    name: 'Aluminium Can',
    years: '80–200',
    icon: '🥫',
    fact: 'Recycling one can saves enough energy to run a TV for 3 hours.',
  },
  {
    name: '6-Pack Rings',
    years: '400',
    icon: '🍺',
    fact: 'Entangles birds, fish and marine mammals — often fatally.',
  },
  {
    name: 'Plastic Bottle',
    years: '450',
    icon: '🧴',
    fact: 'Over 480 billion plastic bottles are sold globally every year.',
  },
  {
    name: 'Disposable Nappy',
    years: '450',
    icon: '🧷',
    fact: 'A single child uses roughly 4,000 nappies before potty training.',
  },
  {
    name: 'Glass Bottle',
    years: '1,000,000',
    icon: '🍾',
    fact: 'Practically indestructible in landfill, but 100% recyclable forever.',
  },
  {
    name: 'Fishing Line',
    years: '600',
    icon: '🎣',
    fact: 'The number one killer of marine animals through entanglement.',
  },
]

function severityColor(label: string): string {
  const num = parseInt(label.replace(/[^0-9]/g, ''))
  if (num >= 400) return 'bg-red-100 text-red-700 border-red-200'
  if (num >= 50) return 'bg-orange-100 text-orange-700 border-orange-200'
  return 'bg-yellow-100 text-yellow-700 border-yellow-200'
}

export default function LitterFacts() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 md:py-12">
      <PageMeta
        title="Litter Facts"
        description="How long does litter last? Learn about decomposition times and the environmental impact of common litter items."
      />
      <div className="text-center mb-8 md:mb-12">
        <h1 className="text-3xl md:text-4xl font-bold mb-3">How Long Does Litter Last?</h1>
        <p className="text-gray-500 max-w-2xl mx-auto">
          Every piece of litter has a lasting impact. Here's how long common items take to break
          down in the environment — and why it matters.
        </p>
      </div>

      {/* Desktop grid / Mobile scroll */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {ITEMS.map((item) => (
          <div
            key={item.name}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col gap-3 hover:shadow-md transition snap-start shrink-0"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{item.icon}</span>
                <h2 className="font-semibold text-lg leading-tight">{item.name}</h2>
              </div>
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full border whitespace-nowrap ${severityColor(item.years)}`}
              >
                {item.years} yrs
              </span>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">{item.fact}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 bg-gray-50 rounded-xl p-6 text-sm text-gray-500">
        <h3 className="font-semibold text-gray-700 mb-3">Sources</h3>
        <p className="mb-3">
          Decomposition times are approximate and vary by environmental conditions. Data compiled
          from:
        </p>
        <ul className="list-disc list-inside space-y-1.5">
          <li>
            <a
              href="https://www.keepbritaintidy.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand hover:underline"
            >
              Keep Britain Tidy
            </a>{' '}
            &mdash; UK litter research and environmental campaigns
          </li>
          <li>
            <a
              href="https://www.gov.uk/government/organisations/department-for-environment-food-rural-affairs"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand hover:underline"
            >
              DEFRA
            </a>{' '}
            &mdash; Department for Environment, Food & Rural Affairs
          </li>
          <li>
            <a
              href="https://www.noaa.gov/education/resource-collections/ocean-coasts/ocean-pollution"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand hover:underline"
            >
              NOAA
            </a>{' '}
            &mdash; National Oceanic and Atmospheric Administration ocean pollution data
          </li>
          <li>
            <a
              href="https://www.epa.gov/trash-free-waters"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand hover:underline"
            >
              US EPA &mdash; Trash Free Waters
            </a>{' '}
            &mdash; marine debris decomposition research
          </li>
          <li>
            <a
              href="https://www.wwf.org.uk/what-we-do/plastics"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand hover:underline"
            >
              WWF UK
            </a>{' '}
            &mdash; plastics and wildlife impact research
          </li>
        </ul>
      </div>
    </div>
  )
}
