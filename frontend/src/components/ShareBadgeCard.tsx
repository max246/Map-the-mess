import { forwardRef } from 'react'

interface ShareBadgeCardProps {
  badgeName: string
  badgeDescription: string
  badgeImageUrl: string
  volunteerName: string
  awardedDate: string
}

const ShareBadgeCard = forwardRef<HTMLDivElement, ShareBadgeCardProps>(
  ({ badgeName, badgeDescription, badgeImageUrl, volunteerName, awardedDate }, ref) => {
    return (
      <div
        ref={ref}
        style={{
          width: 1080,
          height: 1350,
          background: 'linear-gradient(135deg, #065f46 0%, #059669 40%, #34d399 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          color: '#ffffff',
          position: 'relative',
          overflow: 'hidden',
          padding: 64,
          textAlign: 'center',
        }}
      >
        {/* Decorative circles */}
        <div
          style={{
            position: 'absolute',
            top: -120,
            right: -120,
            width: 400,
            height: 400,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -80,
            left: -80,
            width: 300,
            height: 300,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)',
          }}
        />

        <div
          style={{
            fontSize: 36,
            fontWeight: 700,
            letterSpacing: '0.18em',
            opacity: 0.9,
            marginBottom: 24,
            textTransform: 'uppercase',
          }}
        >
          Achievement Unlocked
        </div>

        <img
          src={badgeImageUrl}
          alt=""
          crossOrigin="anonymous"
          style={{
            width: 520,
            height: 520,
            objectFit: 'contain',
            marginBottom: 32,
            filter: 'drop-shadow(0 12px 24px rgba(0,0,0,0.25))',
          }}
        />

        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            marginBottom: 12,
            textShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          {badgeName}
        </div>
        <div
          style={{
            fontSize: 28,
            opacity: 0.9,
            fontWeight: 500,
            marginBottom: 56,
            maxWidth: 820,
            lineHeight: 1.3,
          }}
        >
          {badgeDescription}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginBottom: 48,
            fontSize: 28,
          }}
        >
          <span style={{ fontWeight: 700 }}>{volunteerName}</span>
          {awardedDate && (
            <>
              <span style={{ opacity: 0.6 }}>·</span>
              <span style={{ opacity: 0.85 }}>{awardedDate}</span>
            </>
          )}
        </div>

        <div
          style={{
            fontSize: 24,
            opacity: 0.7,
            fontWeight: 600,
            letterSpacing: '0.05em',
          }}
        >
          mapthemess.uk
        </div>
      </div>
    )
  }
)

ShareBadgeCard.displayName = 'ShareBadgeCard'

export default ShareBadgeCard
