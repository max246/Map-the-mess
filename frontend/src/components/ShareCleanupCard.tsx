import { forwardRef } from 'react'

interface ShareCleanupCardProps {
  volunteerName: string
  avatarUrl: string
  reportsResolved: number
  hoursSpent: number
  bagsCollected: number
  date: string
}

const ShareCleanupCard = forwardRef<HTMLDivElement, ShareCleanupCardProps>(
  ({ volunteerName, avatarUrl, reportsResolved, hoursSpent, bagsCollected, date }, ref) => {
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

        {/* Icon */}
        <div style={{ fontSize: 120, lineHeight: 1, marginBottom: 16 }}>🗺️</div>

        {/* Heading */}
        <div
          style={{
            fontSize: 52,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            marginBottom: 8,
            textShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          My Cleanup Summary
        </div>

        {/* Date */}
        <div
          style={{
            fontSize: 28,
            opacity: 0.85,
            marginBottom: 48,
            fontWeight: 500,
          }}
        >
          {date}
        </div>

        {/* Avatar + Name */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            marginBottom: 48,
          }}
        >
          <img
            src={avatarUrl}
            alt=""
            style={{
              width: 90,
              height: 90,
              borderRadius: '50%',
              objectFit: 'cover',
              border: '4px solid rgba(255,255,255,0.5)',
            }}
            crossOrigin="anonymous"
          />
          <div style={{ fontSize: 36, fontWeight: 700 }}>{volunteerName}</div>
        </div>

        {/* Stats */}
        <div
          style={{
            display: 'flex',
            gap: 32,
            marginBottom: 48,
          }}
        >
          {[
            { value: reportsResolved, label: 'Reports\nResolved', icon: '📋' },
            { value: hoursSpent, label: 'Hours\nSpent', icon: '⏱️' },
            { value: bagsCollected, label: 'Bags\nCollected', icon: '🗑️' },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                background: 'rgba(255,255,255,0.15)',
                backdropFilter: 'blur(10px)',
                borderRadius: 24,
                padding: '36px 44px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                minWidth: 220,
                border: '1px solid rgba(255,255,255,0.2)',
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 8 }}>{stat.icon}</div>
              <div
                style={{
                  fontSize: 64,
                  fontWeight: 800,
                  lineHeight: 1,
                  marginBottom: 8,
                }}
              >
                {stat.value}
              </div>
              <div
                style={{
                  fontSize: 22,
                  opacity: 0.9,
                  textAlign: 'center',
                  fontWeight: 600,
                  whiteSpace: 'pre-line',
                  lineHeight: 1.3,
                }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
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

ShareCleanupCard.displayName = 'ShareCleanupCard'

export default ShareCleanupCard
