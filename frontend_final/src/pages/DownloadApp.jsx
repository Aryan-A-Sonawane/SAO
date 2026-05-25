/**
 * DownloadApp.jsx — Public landing-style page that pitches the mobile app
 * and routes the visitor to one of three install targets:
 *
 *   1. Google Play Store (Android)        → `LINKS.android`
 *   2. Apple App Store  (iOS)             → `LINKS.ios`
 *   3. Direct .apk side-load              → `LINKS.apk`
 *
 * ──────────────────────────────────────────────────────────────────────────
 * HOW TO UPDATE THE URLS:
 * ──────────────────────────────────────────────────────────────────────────
 * The three constants below are the ONLY places you need to edit when the
 * store listings go live or when you ship a new APK build.
 *
 *   - Play Store / App Store URLs:  paste the full listing URL.
 *   - APK: drop the .apk file into `frontend_final/public/downloads/`
 *          (create the folder if it doesn't exist) and reference it by the
 *          public-relative path, e.g. `/downloads/interviewvault.apk`.
 *
 * Leaving any URL as the placeholder ("#") will keep the button visible
 * but disable the click — handy while we're still in pre-release.
 * ──────────────────────────────────────────────────────────────────────────
 */
import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Download, ShieldCheck, Zap,
  Star, Building2, Briefcase, Sparkles,
} from 'lucide-react'

/* ─── Official brand marks (inline SVG so no extra deps) ─────────────────── */
function GooglePlayLogo({ size = 40 }) {
  // The classic 4-colored Google Play triangle. Paths simplified from Google's
  // brand kit — keeps the diagonal-quadrant colour split that makes the mark
  // instantly recognisable.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-label="Google Play">
      <path d="M3 20.5V3.5c0-.59.34-1.11.84-1.35L13.69 12 3.84 21.85C3.34 21.61 3 21.09 3 20.5z" fill="#00C3FF"/>
      <path d="M16.81 15.12 6.05 21.34l-.41.25c-.95.51-2.06.18-2.6-.74l.001-.001 9.85-9.85 3.92 4.12z" fill="#EA4335"/>
      <path d="m20.16 9.59-3.34-1.93-3.13 3.13 3.13 3.13 3.34-1.93c.95-.55.95-1.95 0-2.5z" fill="#FBBC04"/>
      <path d="m6.05 2.66 10.76 6.22-3.13 3.13L3.84 2.15c.18-.09.38-.15.59-.15.21 0 .42.05.62.16z" fill="#34A853"/>
    </svg>
  )
}

function AppleLogo({ size = 40 }) {
  // Apple's bitten-apple silhouette — single-path, scales to any colour via fill.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-label="Apple">
      <path fill="#ffffff" d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
    </svg>
  )
}

function AndroidLogo({ size = 40 }) {
  // The Android bugdroid head — used for the direct APK card. Solid Android
  // green (#3DDC84) matches the official Android Studio brand colour.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-label="Android">
      <path fill="#3DDC84" d="M17.6 9.48l1.84-3.18a.4.4 0 0 0-.69-.4l-1.86 3.22a11.3 11.3 0 0 0-9.78 0L5.25 5.9a.4.4 0 1 0-.69.4L6.4 9.48A10.81 10.81 0 0 0 1 18h22a10.81 10.81 0 0 0-5.4-8.52zM7 15.25a1.25 1.25 0 1 1 1.25-1.25A1.25 1.25 0 0 1 7 15.25zm10 0a1.25 1.25 0 1 1 1.25-1.25 1.25 1.25 0 0 1-1.25 1.25z"/>
    </svg>
  )
}
import CustomCursor from '../components/landing/CustomCursor'
import WebGLCanvas from '../components/landing/WebGLCanvas'
import { useMousePosition } from '../hooks/useMousePosition'
import '../styles/landing.css'

// ─── Install targets — edit these when the store listings go live ──────────
const LINKS = {
  android: '#',  // e.g. 'https://play.google.com/store/apps/details?id=com.interviewvault.app'
  ios:     '#',  // e.g. 'https://apps.apple.com/us/app/interviewvault/idXXXXXXXXXX'
  apk:     '#',  // e.g. '/downloads/interviewvault.apk'  (drop the file in public/downloads/)
}

const ease = [0.16, 1, 0.3, 1]

/* ─── Small UI atoms ─────────────────────────────────────────────────────── */
function Badge({ children, color = '#a5b4fc', bg = 'rgba(99,102,241,0.12)', border = 'rgba(99,102,241,0.3)' }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '5px 11px', borderRadius: 999,
      background: bg, color, border: `1px solid ${border}`,
      fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
    }}>
      {children}
    </span>
  )
}

/* ─── Platform card — Android / iOS / APK ───────────────────────────────── */
function PlatformCard({
  icon: Icon, label, supportingLabel, url, accent = '#6366f1',
  badge, footerNote, kind, qrPattern, iconBg,
}) {
  const disabled = !url || url === '#'
  const handle = () => {
    if (disabled) return
    if (kind === 'apk') {
      // Trigger a direct download for the APK rather than navigating away.
      const a = document.createElement('a')
      a.href = url
      a.download = 'interviewvault.apk'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } else {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <motion.button
      whileHover={disabled ? {} : { y: -6 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      onClick={handle}
      disabled={disabled}
      style={{
        position: 'relative', overflow: 'hidden',
        textAlign: 'left', cursor: disabled ? 'not-allowed' : 'pointer',
        // Backdrop must match the "Built for businesses" tile below. We do
        // NOT apply `opacity` to the whole card when disabled — that would
        // multiply down the backdrop alpha and make the card see-through.
        // Instead disabled-ness shows up via dimmer text + a muted CTA.
        background: 'rgba(10,10,20,0.55)',
        border: `1px solid ${disabled ? 'rgba(255,255,255,0.07)' : `${accent}40`}`,
        borderRadius: 22, padding: '28px 26px 24px',
        color: disabled ? '#94a3b8' : '#f1f5f9',
        // height:100% lets the card fill its grid cell — paired with
        // display:flex on the wrapper below so a longer description in one
        // card (Apple's is 3 lines) stretches the others to match.
        height: '100%', minHeight: 280,
        display: 'flex', flexDirection: 'column', gap: 16,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        transition: 'all 0.3s ease',
      }}
    >
      {/* Subtle accent glow at top — dialled way down so the backdrop stays
          dark and copy stays readable. Acts as a tint, not a spotlight. */}
      {!disabled && (
        <div style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(circle at 50% -20%, ${accent}14 0%, transparent 55%)`,
          pointerEvents: 'none',
        }} />
      )}

      {/* Top — icon + badge. The icon tile uses the platform's own brand
          colour (iconBg) so the Apple/Play/Android marks read as authentic,
          while the surrounding accent tints the card edges + CTA gradient. */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{
          width: 78, height: 78, borderRadius: 20,
          background: iconBg || `linear-gradient(135deg, ${accent}, ${accent}aa)`,
          display: 'grid', placeItems: 'center',
          color: '#fff',
          boxShadow: `0 12px 32px -8px ${accent}99, inset 0 1px 0 rgba(255,255,255,0.15)`,
          border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <Icon size={44} />
        </div>
        {badge && <Badge color={accent} bg={`${accent}22`} border={`${accent}55`}>{badge}</Badge>}
      </div>

      {/* Label */}
      <div>
        <h3 style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: '1.4rem', fontWeight: 800, color: '#f1f5f9',
          letterSpacing: '-0.02em', marginBottom: 4,
        }}>
          {label}
        </h3>
        <p style={{ fontSize: '0.88rem', color: '#94a3b8', lineHeight: 1.55 }}>
          {supportingLabel}
        </p>
      </div>

      {/* Spacer + footer */}
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{
          padding: '11px 16px', borderRadius: 11,
          background: disabled ? 'rgba(255,255,255,0.04)' : `linear-gradient(135deg, ${accent}, ${accent}cc)`,
          color: disabled ? '#64748b' : '#fff',
          fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          fontFamily: 'Inter, system-ui',
        }}>
          <Download size={14} />
          {disabled ? 'Coming soon' : (kind === 'apk' ? 'Download .APK' : 'Open store')}
        </div>
        {footerNote && (
          <div style={{ fontSize: 11, color: '#64748b', textAlign: 'center', letterSpacing: 0.3 }}>
            {footerNote}
          </div>
        )}
      </div>
    </motion.button>
  )
}

/* ─── Feature row — pitches the business angle ───────────────────────────── */
function ValueRow({ icon: Icon, title, blurb, accent }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 14,
      padding: '14px 16px', borderRadius: 14,
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: `${accent}1f`, color: accent,
        display: 'grid', placeItems: 'center',
      }}>
        <Icon size={17} />
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', marginBottom: 4, letterSpacing: '-0.01em' }}>
          {title}
        </div>
        <div style={{ fontSize: 12.5, color: '#94a3b8', lineHeight: 1.55 }}>{blurb}</div>
      </div>
    </div>
  )
}

/* ─── Main ───────────────────────────────────────────────────────────────── */
export default function DownloadApp() {
  const navigate = useNavigate()
  const mouse = useMousePosition()
  const mouseRef = React.useRef({ nX: 0, nY: 0 })
  useEffect(() => { mouseRef.current = { nX: mouse.nX, nY: mouse.nY } }, [mouse.nX, mouse.nY])

  // Detect platform to suggest the most likely install target first.
  const [suggested, setSuggested] = useState(null)
  useEffect(() => {
    const ua = (navigator.userAgent || '').toLowerCase()
    if (/iphone|ipad|ipod/.test(ua)) setSuggested('ios')
    else if (/android/.test(ua)) setSuggested('android')
    else setSuggested(null)
  }, [])

  return (
    <div className="landing-page" style={{
      minHeight: '100vh', color: '#f1f5f9', overflowX: 'hidden',
      backgroundColor: '#05050a',
      backgroundImage: 'url(/background.png)',
      backgroundSize: 'cover', backgroundPosition: 'center top',
      backgroundRepeat: 'no-repeat', backgroundAttachment: 'fixed',
      position: 'relative',
    }}>
      <CustomCursor />
      <WebGLCanvas mouseRef={mouseRef} particleCount={500} />

      {/* Floating Back button — mirrors the Dashboard pill pattern from the
          onboarding pages. No full navbar; the hero centers itself on the
          viewport instead of getting pushed down by a 64px chrome strip. */}
      <button
        onClick={() => navigate(-1)}
        style={{
          position: 'fixed', top: 24, right: 24, zIndex: 1000,
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '8px 14px', borderRadius: 12, cursor: 'pointer',
          background: 'rgba(15,15,25,0.55)', border: '1px solid rgba(255,255,255,0.10)',
          color: '#cbd5e1', fontSize: 13, fontWeight: 600, fontFamily: 'Inter, system-ui',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)' }}
      >
        <ArrowLeft size={14} /> Back
      </button>

      {/* Hero */}
      <section style={{
        position: 'relative', zIndex: 1,
        padding: 'clamp(56px, 9vh, 96px) clamp(20px, 5vw, 64px) 40px',
        maxWidth: 1200, margin: '0 auto',
      }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease }}
          style={{ textAlign: 'center', marginBottom: 56 }}
        >
          <div style={{ marginBottom: 18 }}>
            <Badge color="#a5b4fc">
              <Sparkles size={11} /> New · Mobile app available
            </Badge>
          </div>

          <h1 style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 'clamp(2.2rem, 6vw, 4rem)', fontWeight: 800,
            letterSpacing: '-0.04em', lineHeight: 1.05,
            color: '#f1f5f9', marginBottom: 18,
          }}>
            Practice interviews{' '}
            <span style={{
              background: 'linear-gradient(135deg, #6366f1, #a855f7)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              on the go.
            </span>
          </h1>
          <p style={{
            fontSize: 'clamp(1rem, 1.6vw, 1.15rem)', color: '#94a3b8',
            maxWidth: 640, margin: '0 auto', lineHeight: 1.7,
          }}>
            The same AI interviewer, mock sessions, and personalised learning
            path — now in your pocket. Pick your platform below.
          </p>
        </motion.div>

        {/* Platform cards */}
        <motion.div
          initial="hidden" animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
          style={{
            display: 'grid', gap: 18,
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            marginBottom: 56,
          }}
        >
          <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} style={{ display: 'flex' }}>
            <PlatformCard
              icon={GooglePlayLogo}
              label="Google Play"
              supportingLabel="Get the latest stable build from the Google Play Store. Free updates, automatic install."
              url={LINKS.android}
              kind="play"
              accent="#01875F"
              iconBg="#ffffff"
              badge={suggested === 'android' ? 'Suggested' : 'Play Store'}
              footerNote="Requires Android 9 or newer"
            />
          </motion.div>

          <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} style={{ display: 'flex' }}>
            <PlatformCard
              icon={AppleLogo}
              label="App Store"
              supportingLabel="Native iOS build on the App Store. Optimised for iPhone and iPad with Face ID sign-in."
              url={LINKS.ios}
              kind="appstore"
              accent="#0A84FF"
              iconBg="linear-gradient(135deg, #1d1d1f 0%, #2c2c2e 100%)"
              badge={suggested === 'ios' ? 'Suggested' : 'App Store'}
              footerNote="Requires iOS 16 or newer"
            />
          </motion.div>

          <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} style={{ display: 'flex' }}>
            <PlatformCard
              icon={AndroidLogo}
              label="Direct APK"
              supportingLabel="Side-load the Android build directly. Useful for enterprise pilots or offline distribution."
              url={LINKS.apk}
              kind="apk"
              accent="#3DDC84"
              iconBg="linear-gradient(135deg, #0f1e14 0%, #1a2e22 100%)"
              badge="Beta"
              footerNote="Enable 'Install from unknown sources' on your device"
            />
          </motion.div>
        </motion.div>

        {/* Business angle — value strip */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.6, ease }}
          style={{
            position: 'relative', borderRadius: 22, padding: 'clamp(24px, 4vw, 36px)',
            background: 'rgba(10,10,20,0.55)',
            border: '1px solid rgba(255,255,255,0.07)',
            backdropFilter: 'blur(20px)',
            marginBottom: 56,
          }}
        >
          <div style={{ marginBottom: 22, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Badge color="#34d399" bg="rgba(16,185,129,0.12)" border="rgba(16,185,129,0.3)">
              <Briefcase size={11} /> For teams &amp; campuses
            </Badge>
            <h2 style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 'clamp(1.4rem, 2.5vw, 1.8rem)', fontWeight: 800,
              color: '#f1f5f9', letterSpacing: '-0.02em', margin: 0,
            }}>
              Built for businesses, ready for individuals
            </h2>
          </div>

          <div style={{
            display: 'grid', gap: 12,
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          }}>
            <ValueRow
              icon={Building2} accent="#6366f1"
              title="Campus &amp; bootcamp licences"
              blurb="Bulk seats with admin dashboards, candidate pipelines, and exportable interview reports."
            />
            <ValueRow
              icon={ShieldCheck} accent="#10b981"
              title="Enterprise-grade privacy"
              blurb="Interview transcripts and resumes never leave your tenant. SOC-2 alignment in progress."
            />
            <ValueRow
              icon={Zap} accent="#f59e0b"
              title="Offline-friendly practice"
              blurb="Mobile builds cache active learning paths so prep continues even on patchy networks."
            />
            <ValueRow
              icon={Star} accent="#a855f7"
              title="White-label ready"
              blurb="Co-brand the app for your placement cell, training company, or recruiting partner."
            />
          </div>
        </motion.div>

        {/* Help footer */}
        <motion.div
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
          viewport={{ once: true }} transition={{ duration: 0.6, ease, delay: 0.1 }}
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            flexWrap: 'wrap', gap: 14, fontSize: 13, color: '#64748b',
            padding: '20px 24px', borderRadius: 14,
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <span>
            Prefer the web version?{' '}
            <Link to="/" style={{ color: '#a5b4fc', textDecoration: 'none', fontWeight: 600 }}>
              Continue in your browser →
            </Link>
          </span>
          <span>
            Talking to enterprise?{' '}
            <a href="mailto:s.aryan0505@gmail.com" style={{ color: '#a5b4fc', textDecoration: 'none', fontWeight: 600 }}>
              s.aryan0505@gmail.com
            </a>
          </span>
        </motion.div>
      </section>
    </div>
  )
}
