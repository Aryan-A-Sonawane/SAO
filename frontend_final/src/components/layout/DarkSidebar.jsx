import React from 'react'
import { NavLink, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LangContext'
import { motion } from 'framer-motion'
import RoleSwitcher from '../RoleSwitcher'

/**
 * DarkSidebar — glassmorphic dark sidebar for authenticated dashboards.
 * Replaces the legacy light-theme Sidebar.jsx when wrapped in DarkLayout.
 */

function NavItem({ to, icon, label, end = false }) {
    return (
        <NavLink
            to={to}
            end={end}
            style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                borderRadius: 12,
                fontSize: '0.875rem',
                fontWeight: isActive ? 600 : 500,
                textDecoration: 'none',
                transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                background: isActive ? 'rgba(99,102,241,0.15)' : 'transparent',
                color: isActive ? 'var(--dk-primary-light)' : 'var(--dk-text-muted)',
                border: isActive ? '1px solid rgba(99,102,241,0.25)' : '1px solid transparent',
                letterSpacing: '-0.01em',
                position: 'relative',
                borderLeft: isActive ? '3px solid var(--dk-primary)' : '3px solid transparent',
                boxShadow: isActive ? '0 0 20px rgba(99,102,241,0.08)' : 'none',
            })}
            onMouseEnter={e => {
                if (!e.currentTarget.classList.contains('active')) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                    e.currentTarget.style.transform = 'scale(1.02)'
                    e.currentTarget.style.color = 'var(--dk-text)'
                }
            }}
            onMouseLeave={e => {
                if (!e.currentTarget.classList.contains('active')) {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.transform = 'scale(1)'
                    e.currentTarget.style.color = 'var(--dk-text-muted)'
                }
            }}
        >
            <span style={{ fontSize: '1rem', width: 20, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
            {label}
        </NavLink>
    )
}


export default function DarkSidebar() {
    const { user, logout, isDemoMode, exitDemoMode } = useAuth()
    const { lang, setLang, t } = useLang()
    const navigate = useNavigate()

    const handleLogout = () => {
        if (isDemoMode) {
            exitDemoMode()
        } else {
            logout()
        }
        navigate('/')
    }

    const langOptions = [
        { code: 'en', label: 'EN', flag: '🇺🇸' },
        { code: 'hi', label: 'HI', flag: '🇮🇳' },
        { code: 'mr', label: 'MR', flag: '🏛️' },
    ]

    return (
        <aside
            style={{
                width: 240,
                minHeight: '100vh',
                background: 'rgba(5, 5, 12, 0.75)',
                borderRight: '1px solid var(--dk-border)',
                backdropFilter: 'blur(24px) saturate(160%)',
                WebkitBackdropFilter: 'blur(24px)',
                padding: '20px 12px',
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0,
                position: 'sticky',
                top: 0,
                height: '100vh',
                zIndex: 10,
                overflowY: 'auto',
            }}
        >
            {/* Brand — clickable, links to landing page */}
            <Link to="/" className="dk-logo-link">
                <div style={{
                    width: 32, height: 32, borderRadius: 9,
                    background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1rem', boxShadow: '0 0 16px rgba(99,102,241,0.4)',
                    flexShrink: 0,
                }}>⚡</div>
                <span style={{
                    fontFamily: 'var(--dk-font)', fontWeight: 700, fontSize: '1.1rem',
                    letterSpacing: '-0.02em', color: 'var(--dk-text)',
                }}>
                    Interview<span style={{ color: 'var(--dk-primary-light)' }}>Vault</span>
                </span>
            </Link>

            {/* User info */}
            <div style={{ padding: '0 8px 16px', borderBottom: '1px solid var(--dk-border)', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: `linear-gradient(135deg, #6366f1, #a855f7)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: '0.9rem', color: '#fff', flexShrink: 0,
                    }}>
                        {user?.name?.[0]?.toUpperCase()}
                    </div>
                    <div style={{ overflow: 'hidden', minWidth: 0 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--dk-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {user?.name}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--dk-text-muted)', marginTop: 2 }}>
                            {user?.role === 'admin' ? '👑 Administrator' : `⭐ ${user?.xp_points || 0} XP`}
                        </div>
                    </div>
                </div>

                {/* Active-role switcher (students only). Lets a learner flip
                    between every role they're currently preparing for, or add
                    a new one without losing existing progress. */}
                {user && user.role !== 'admin' && !isDemoMode && (
                    <div style={{ marginTop: 12 }}>
                        <RoleSwitcher />
                    </div>
                )}
            </div>

            {/* Navigation */}
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
                {user?.role === 'admin' ? (
                    <>
                        <NavItem to="/admin/dashboard" end icon="📊" label={t('overview')} />
                        <NavItem to="/coding-skills" icon="💻" label="Coding Skills" />
                        <NavItem to="/profile" icon="👤" label="Profile" />
                    </>
                ) : (
                    <>
                        <NavItem to="/student/dashboard" end icon="🏠" label={t('dashboard')} />
                        <NavItem to="/onboarding" icon="🧭" label="Onboarding" />
                        <NavItem to="/onboarding/diagnostic" icon="🧪" label="Diagnostic" />
                        <NavItem to="/onboarding/path" icon="🧩" label="Path Builder" />
                        <NavItem to="/learn" icon="📚" label="Learning Hub" />
                        <NavItem to="/plan" icon="🏢" label="Company Plan" />
                        <NavItem to="/interview" icon="🎙️" label="Mock Interview" />
                        <NavItem to="/interviews" icon="🗂️" label="Interview History" />
                        <NavItem to="/remediation" icon="🩹" label="Remediation" />
                        <NavItem to="/demo/coding" icon="💻" label="Demo Challenge" />
                        <NavItem to="/profile" icon="👤" label="Profile" />
                    </>
                )}

                {/* Demo mode indicator */}
                {isDemoMode && (
                    <div style={{
                        marginTop: 12,
                        padding: '10px 14px',
                        borderRadius: 12,
                        background: 'rgba(168,85,247,0.06)',
                        border: '1px solid rgba(168,85,247,0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                    }}>
                        <span style={{
                            width: 8, height: 8,
                            borderRadius: '50%',
                            background: '#a855f7',
                            boxShadow: '0 0 8px rgba(168,85,247,0.5)',
                            animation: 'demo-badge-pulse 3s ease-in-out infinite',
                            flexShrink: 0,
                        }} />
                        <span style={{ fontSize: '0.72rem', color: '#c084fc', fontWeight: 600, letterSpacing: '-0.01em' }}>
                            Demo Mode Active
                        </span>
                    </div>
                )}
            </nav>

            {/* Language selector */}
            <div style={{ padding: '12px 8px', borderTop: '1px solid var(--dk-border)', marginTop: 12 }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--dk-text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {t('language')}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                    {langOptions.map(opt => (
                        <button
                            key={opt.code}
                            onClick={() => setLang(opt.code)}
                            style={{
                                flex: 1, padding: '6px 4px', borderRadius: 8, border: 'none', cursor: 'pointer',
                                fontSize: '0.7rem', fontWeight: 700, transition: 'all 0.2s',
                                background: lang === opt.code ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)',
                                color: lang === opt.code ? 'var(--dk-primary-light)' : 'var(--dk-text-muted)',
                                letterSpacing: '-0.01em',
                            }}
                        >
                            {opt.flag} {opt.label}
                        </button>
                    ))}
                </div>

                {/* Sign out */}
                <button
                    onClick={handleLogout}
                    style={{
                        marginTop: 10, width: '100%', padding: '10px 14px',
                        borderRadius: 10, border: '1px solid var(--dk-border)',
                        background: isDemoMode ? 'rgba(168,85,247,0.08)' : 'rgba(248,113,113,0.08)',
                        color: isDemoMode ? '#c084fc' : 'var(--dk-red)',
                        fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
                        transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = isDemoMode ? 'rgba(168,85,247,0.15)' : 'rgba(248,113,113,0.15)'}
                    onMouseLeave={e => e.currentTarget.style.background = isDemoMode ? 'rgba(168,85,247,0.08)' : 'rgba(248,113,113,0.08)'}
                >
                    {isDemoMode ? '🚀 Exit Demo' : `🚪 ${t('signOut')}`}
                </button>
            </div>
        </aside>
    )
}
