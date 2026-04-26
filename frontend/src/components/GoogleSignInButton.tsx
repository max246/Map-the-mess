import { useEffect, useRef } from 'react'

const GIS_SRC = 'https://accounts.google.com/gsi/client'
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: {
            client_id: string
            callback: (resp: { credential: string }) => void
          }) => void
          renderButton: (
            el: HTMLElement,
            options: { theme?: string; size?: string; width?: number; text?: string }
          ) => void
        }
      }
    }
  }
}

let scriptPromise: Promise<void> | null = null

function loadGisScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => {
      scriptPromise = null
      reject(new Error('Failed to load Google Identity Services'))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

interface Props {
  onCredential: (credential: string) => void
  text?: 'signin_with' | 'signup_with' | 'continue_with'
}

export default function GoogleSignInButton({ onCredential, text = 'signin_with' }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!CLIENT_ID || !containerRef.current) return
    let cancelled = false

    loadGisScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google) return
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (resp) => {
            if (resp?.credential) onCredential(resp.credential)
          },
        })
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: 'outline',
          size: 'large',
          width: 320,
          text,
        })
      })
      .catch(() => {
        // Script failed to load — leave the container empty; user can still use password.
      })

    return () => {
      cancelled = true
    }
  }, [onCredential, text])

  if (!CLIENT_ID) return null

  return <div ref={containerRef} className="flex justify-center" />
}
