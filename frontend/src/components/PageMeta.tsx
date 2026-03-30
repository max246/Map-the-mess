import { Helmet } from 'react-helmet-async'

const SITE_NAME = 'Map the Mess'
const DEFAULT_DESCRIPTION =
  "Report litter, find it on the map, and clean it up. Together we're making Britain's streets cleaner, one pin at a time."
const DEFAULT_IMAGE = '/og-banner.png'

interface PageMetaProps {
  title?: string
  description?: string
  image?: string
}

export default function PageMeta({
  title,
  description = DEFAULT_DESCRIPTION,
  image = DEFAULT_IMAGE,
}: PageMetaProps) {
  const fullTitle = title
    ? `${title} — ${SITE_NAME}`
    : `${SITE_NAME} — Report Litter, Clean Britain`

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />

      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:image" content={image} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
    </Helmet>
  )
}
