/**
 * OAuthButtons — Sign in / Sign up with Google or Apple.
 *
 * Sits below the email/password form in both Login.jsx and Register.jsx.
 * The Google button is real — it uses Google Identity Services to obtain
 * an ID token and posts it to POST /api/auth/google. The Apple button
 * is wire-only for now (no real Apple Sign-In key configured yet) and
 * shows a friendly toast on click until we wire up Sign in with Apple.
 *
 * Backend feature flags drive which buttons render:
 *   GET /api/auth/oauth-providers → { google: bool, apple: bool, google_client_id }
 * The Google button only mounts when the backend reports `google: true`
 * AND returns a non-empty client ID — never a hard fail.
 */
import React, { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'

const GIS_SRC = 'https://accounts.google.com/gsi/client'

/* ─── Inline brand SVGs so we don't depend on external icon kits ─────────── */
function GoogleMark({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label="Google" xmlns="http://www.w3.org/2000/svg">
      <path d="M21.6 12.227c0-.682-.06-1.337-.174-1.964H12v3.717h5.395a4.617 4.617 0 0 1-2.005 3.028v2.518h3.245c1.898-1.748 2.965-4.323 2.965-7.299z" fill="#4285F4"/>
      <path d="M12 22c2.7 0 4.965-.895 6.62-2.421l-3.245-2.518c-.9.6-2.05.955-3.375.955-2.598 0-4.798-1.755-5.583-4.114H3.062v2.59A9.998 9.998 0 0 0 12 22z" fill="#34A853"/>
      <path d="M6.417 13.902a5.994 5.994 0 0 1 0-3.804V7.508H3.062a10.005 10.005 0 0 0 0 8.984l3.355-2.59z" fill="#FBBC05"/>
      <path d="M12 5.978c1.468 0 2.787.504 3.823 1.493l2.875-2.874C16.96 3.022 14.7 2 12 2 8.06 2 4.66 4.27 3.062 7.508l3.355 2.59C7.2 7.733 9.402 5.978 12 5.978z" fill="#EA4335"/>
    </svg>
  )
}

function AppleMark({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label="Apple" xmlns="http://www.w3.org/2000/svg">
      <path
        fill="#0f172a"
        d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
      />
    </svg>
  )
}

export default function OAuthButtons({ role = 'student', onAuthed }) {
  const { applyToken } = useAuth()
  const [providers, setProviders] = useState({ google: false, apple: false, google_client_id: null })
  const [busy, setBusy] = useState(null)  // 'google' | 'apple' | null
  const gisLoaded = useRef(false)

  // ─── Pull backend-driven feature flags (client ID for GIS init) ─────────
  useEffect(() => {
    api.get('/auth/oauth-providers')
      .then((r) => setProviders(r.data))
      .catch(() => {
        // Backend unreachable — still show buttons so the UI isn't blank.
        // Clicking will surface a friendly error instead of silently hiding.
        setProviders({ google: false, apple: false, google_client_id: null })
      })
  }, [])

  // ─── Load Google Identity Services script once on mount ─────────────────
  // Load unconditionally so the library is ready when the user clicks,
  // regardless of whether the backend has GOOGLE_CLIENT_ID configured yet.
  useEffect(() => {
    if (gisLoaded.current) return
    if (document.querySelector(`script[src="${GIS_SRC}"]`)) {
      gisLoaded.current = true
      return
    }
    const s = document.createElement('script')
    s.src = GIS_SRC
    s.async = true
    s.defer = true
    s.onload = () => { gisLoaded.current = true }
    document.head.appendChild(s)
  }, [])

  const handleGoogleResponse = async (response) => {
    const idToken = response?.credential
    if (!idToken) {
      toast.error('Google did not return a credential.')
      setBusy(null)
      return
    }
    try {
      const res = await api.post('/auth/google', { id_token: idToken, role })
      // Re-use the same token-application path as email/password login so
      // the AuthContext + localStorage stay in sync with the new session.
      if (typeof applyToken === 'function') {
        applyToken(res.data.access_token, res.data.user)
      } else {
        localStorage.setItem('sf_token', res.data.access_token)
        localStorage.setItem('sf_user', JSON.stringify(res.data.user))
      }
      toast.success(`Welcome${res.data.user?.name ? `, ${res.data.user.name.split(' ')[0]}` : ''}!`)
      onAuthed?.(res.data.user)
    } catch (err) {
      const detail = err?.response?.data?.detail || 'Could not sign in with Google.'
      toast.error(detail)
    } finally {
      setBusy(null)
    }
  }

  const handleGoogleClick = () => {
    if (!providers.google_client_id) {
      toast.error('Google sign-in needs a Client ID — add GOOGLE_CLIENT_ID to the backend .env.')
      return
    }
    if (!window.google?.accounts?.id) {
      toast.error('Google library still loading — try again in a moment.')
      return
    }
    setBusy('google')
    try {
      window.google.accounts.id.initialize({
        client_id: providers.google_client_id,
        callback: handleGoogleResponse,
        auto_select: false,
        ux_mode: 'popup',
      })
      window.google.accounts.id.prompt()
    } catch (e) {
      setBusy(null)
      toast.error('Could not open Google sign-in.')
    }
  }

  const handleAppleClick = () => {
    // Wire-only stub. Real Sign in with Apple requires a Service ID + key
    // pair in the Apple Developer console — slated for App Store submission.
    toast('Apple Sign-In is coming soon. Use Google or email for now.', { icon: '🍎' })
  }

  // Always render — buttons are visible regardless of backend config.
  // Clicking handles the unconfigured state inline with a friendly toast.
  return (
    <div className="oauth-buttons">
      {/* Divider */}
      <div className="oauth-divider">
        <span>or continue with</span>
      </div>

      <div className="oauth-row">
        <button
          type="button"
          onClick={handleGoogleClick}
          disabled={busy === 'google'}
          className="oauth-btn oauth-btn-google"
          aria-label="Sign in with Google"
        >
          <GoogleMark />
          <span>{busy === 'google' ? 'Connecting…' : 'Google'}</span>
        </button>

        <button
          type="button"
          onClick={handleAppleClick}
          disabled={busy === 'apple'}
          className="oauth-btn oauth-btn-apple"
          aria-label="Sign in with Apple"
        >
          <AppleMark />
          <span>Apple</span>
        </button>
      </div>

      {/* Scoped CSS — keeps the auth pages' .auth-* styling untouched */}
      <style>{`
        .oauth-buttons {
          margin-top: 18px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .oauth-divider {
          position: relative;
          text-align: center;
          font-size: 11px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.45);
          margin: 4px 0;
        }
        .oauth-divider::before,
        .oauth-divider::after {
          content: '';
          position: absolute; top: 50%;
          width: calc(50% - 68px); height: 1px;
          background: rgba(255,255,255,0.10);
        }
        .oauth-divider::before { left: 0; }
        .oauth-divider::after  { right: 0; }
        .oauth-divider span {
          padding: 0 10px;
          background: transparent;
          position: relative;
          z-index: 1;
        }
        .oauth-row {
          display: grid;
          gap: 10px;
          grid-template-columns: 1fr 1fr;
        }
        .oauth-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 11px 16px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: -0.01em;
          cursor: pointer;
          transition: transform 0.15s ease, background 0.2s ease, border-color 0.2s ease;
          font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
        }
        .oauth-btn:disabled {
          opacity: 0.55;
          cursor: wait;
        }
        .oauth-btn:not(:disabled):hover { transform: translateY(-1px); }
        .oauth-btn-google {
          background: #ffffff;
          color: #1f2937;
          border: 1px solid #e5e7eb;
        }
        .oauth-btn-google:not(:disabled):hover { background: #f8fafc; }
        .oauth-btn-apple {
          background: #ffffff;
          color: #0f172a;
          border: 1px solid #e5e7eb;
        }
        .oauth-btn-apple:not(:disabled):hover { background: #f8fafc; }
        @media (max-width: 380px) {
          .oauth-row { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  )
}
