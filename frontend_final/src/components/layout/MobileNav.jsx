/**
 * MobileNav — bottom tab bar for Android & iOS vertical screens.
 * Replaces the sidebar on viewports ≤ 768 px and on Capacitor native platforms.
 * Safe-area-aware: accounts for iOS home indicator + Android gesture nav bar.
 */
import React from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'

const STUDENT_TABS = [
  { to: '/student/dashboard', icon: '🏠', label: 'Home' },
  { to: '/learn',             icon: '📚', label: 'Learn' },
  { to: '/interview',         icon: '🎙️', label: 'Interview' },
  { to: '/interviews',        icon: '🗂️', label: 'History' },
  { to: '/profile',           icon: '👤', label: 'Me' },
]

const ADMIN_TABS = [
  { to: '/admin/dashboard', icon: '📊', label: 'Overview' },
  { to: '/coding-skills',   icon: '💻', label: 'Skills' },
  { to: '/profile',         icon: '👤', label: 'Profile' },
]

export default function MobileNav() {
  const { user } = useAuth()
  const tabs = user?.role === 'admin' ? ADMIN_TABS : STUDENT_TABS

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 200,
      background: 'rgba(5, 5, 12, 0.92)',
      backdropFilter: 'blur(24px) saturate(180%)',
      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      borderTop: '1px solid rgba(255,255,255,0.08)',
      /* iOS home indicator + Android gesture nav */
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      display: 'flex',
      alignItems: 'stretch',
    }}>
      <div style={{
        display: 'flex',
        width: '100%',
        alignItems: 'center',
      }}>
        {tabs.map(tab => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to.endsWith('dashboard')}
            style={({ isActive }) => ({
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              padding: '10px 4px 12px',
              textDecoration: 'none',
              color: isActive ? '#818cf8' : '#475569',
              position: 'relative',
              transition: 'color 0.2s ease',
              WebkitTapHighlightColor: 'transparent',
              minHeight: 56,
            })}
          >
            {({ isActive }) => (
              <>
                {/* Active pill background */}
                {isActive && (
                  <motion.div
                    layoutId="mobile-nav-pill"
                    style={{
                      position: 'absolute',
                      inset: '6px 8px',
                      borderRadius: 12,
                      background: 'rgba(99,102,241,0.12)',
                      border: '1px solid rgba(99,102,241,0.2)',
                    }}
                    transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                  />
                )}
                <span style={{
                  fontSize: '1.25rem',
                  lineHeight: 1,
                  position: 'relative',
                  zIndex: 1,
                  filter: isActive ? 'drop-shadow(0 0 8px rgba(99,102,241,0.6))' : 'none',
                  transition: 'filter 0.2s',
                }}>
                  {tab.icon}
                </span>
                <span style={{
                  fontSize: '0.62rem',
                  fontWeight: isActive ? 700 : 500,
                  letterSpacing: '0.02em',
                  fontFamily: "'Space Grotesk', sans-serif",
                  position: 'relative',
                  zIndex: 1,
                }}>
                  {tab.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
