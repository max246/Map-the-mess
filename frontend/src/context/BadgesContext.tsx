import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react'
import { getAuth } from '../api/endpoints/auth/auth'
import { getBadges } from '../api/endpoints/badges/badges'
import type { BadgeRead } from '../api/model'
import { useAuth } from './AuthContext'

const { getProfileApiAuthMeGet } = getAuth()
const { acknowledgeBadgeApiBadgesBadgeIdAcknowledgePost } = getBadges()

type BadgesCtx = {
  badges: BadgeRead[]
  unacknowledged: BadgeRead[]
  refresh: () => Promise<void>
  acknowledge: (badgeId: string) => Promise<void>
}

const BadgesContext = createContext<BadgesCtx | null>(null)

export function BadgesProvider({ children }: { children: ReactNode }) {
  const { isLoggedIn } = useAuth()
  const [badges, setBadges] = useState<BadgeRead[]>([])

  const refresh = useCallback(async () => {
    if (!isLoggedIn) {
      setBadges([])
      return
    }
    try {
      const profile = await getProfileApiAuthMeGet()
      setBadges(profile.badges || [])
    } catch {
      /* ignore — stale state is fine */
    }
  }, [isLoggedIn])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const acknowledge = useCallback(async (badgeId: string) => {
    try {
      const updated = await acknowledgeBadgeApiBadgesBadgeIdAcknowledgePost(badgeId)
      setBadges((prev) => prev.map((b) => (b.id === badgeId ? { ...b, ...updated } : b)))
    } catch {
      /* ignore */
    }
  }, [])

  const unacknowledged = useMemo(
    () => badges.filter((b) => b.awarded_at && !b.acknowledged_at),
    [badges]
  )

  return (
    <BadgesContext.Provider value={{ badges, unacknowledged, refresh, acknowledge }}>
      {children}
    </BadgesContext.Provider>
  )
}

export function useBadges() {
  const ctx = useContext(BadgesContext)
  if (!ctx) throw new Error('useBadges must be used within BadgesProvider')
  return ctx
}
