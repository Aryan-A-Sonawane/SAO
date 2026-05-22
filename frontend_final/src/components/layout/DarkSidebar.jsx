import React from 'react'
import { NavLink, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LangContext'
import RoleSwitcher from '../RoleSwitcher'

function NavItem({ to, icon, label, end = false, collapsed }) {
    return (
        <NavLink
            to={to}
            end={end}
            title={collapsed ? label : undefined}
            style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: collapsed ? 0 : 10,
                padding: collapsed ? '10px 0' : '10px 14px',
                borderRadius: 12,
                fontSize: '0.875rem',
                fontWeight: isActive ? 600 : 500,
                textDecoration: 'none',
                transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                background: isActive ? 'rgba(99,102,241,0.15)' : 'transparent',
                color: isActive ? 'var(--dk-primary-light)' : 'var(--dk-text-muted)',
                border: isActive ? '1px solid rgba(99,102,241,0.25)' : '1px solid transparent',
                borderLeft: isActive ? '3px solid var(--dk-primary)' : '3px solid transparent',
                boxShadow: isActive ? '0 0 20px rgba(99,102,241,0.08)' : 'none',
                letterSpacing: '-0.01em',
                position: 'relative',
                overflow: 'hidden',
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
            <span style={{ fontSize: '1.1rem', width: 22, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
            {!collapsed && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>}
        </NavLink>
    )
}

export default function DarkSidebar({ isOpen, onToggle }) {
    const { user, logout, isDemoMode, exitDemoMode } = useAuth()
    const { lang, setLang, t } = useLang()
    const navigate = useNavigate()
    const collapsed = !isOpen

    const handleLogout = () => {
        if (isDemoMode) exitDemoMode()
        else logout()
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
                width: collapsed ? 64 : 240,
                minHeight: '100vh',
                background: 'rgba(5, 5, 12, 0.75)',
                borderRight: '1px solid var(--dk-border)',
                backdropFilter: 'blur(24px) saturate(160%)',
                WebkitBackdropFilter: 'blur(24px)',
                padding: collapsed ? '20px 8px' : '20px 12px',
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0,
                position: 'sticky',
                top: 0,
                height: '100vh',
                zIndex: 10,
                overflowY: 'auto',
                overflowX: 'hidden',
                transition: 'width 0.3s cubic-bezier(0.16,1,0.3,1), padding 0.3s ease',
            }}
        >
            {/* Brand + toggle row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', marginBottom: 16 }}>
                {!collapsed && (
                    <Link to="/" className="dk-logo-link" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
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
                )}

                {collapsed && (
                    <Link to="/" style={{ textDecoration: 'none' }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: 9,
                            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '1rem', boxShadow: '0 0 16px rgba(99,102,241,0.4)',
                        }}>⚡</div>
                    </Link>
                )}

                <button
                    onClick={onToggle}
                    title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    style={{
                        width: 28, height: 28, borderRadius: 8, border: '1px solid var(--dk-border)',
                        background: 'rgba(255,255,255,0.04)', color: 'var(--dk-text-muted)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.75rem', flexShrink: 0, transition: 'all 0.2s',
                        marginLeft: collapsed ? 0 : 8,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.15)'; e.currentTarget.style.color = 'var(--dk-primary-light)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'var(--dk-text-muted)' }}
                >
                    {collapsed ? '›' : '‹'}
                </button>
            </div>

            {/* User info */}
            <div style={{
                padding: collapsed ? '0 0 12px' : '0 8px 16px',
                borderBottom: '1px solid var(--dk-border)',
                marginBottom: 12,
                display: 'flex',
                flexDirection: 'column',
                alignItems: collapsed ? 'center' : 'stretch',
                gap: 0,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 10, justifyContent: collapsed ? 'center' : 'flex-start' }}>
                    <div
                        title={collapsed ? user?.name : undefined}
                        style={{
                            width: 36, height: 36, borderRadius: '50%',
                            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 700, fontSize: '0.9rem', color: '#fff', flexShrink: 0,
                        }}>
                        {user?.name?.[0]?.toUpperCase()}
                    </div>
                    {!collapsed && (
                        <div style={{ overflow: 'hidden', minWidth: 0 }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--dk-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {user?.name}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--dk-text-muted)', marginTop: 2 }}>
                                {user?.role === 'admin' ? '👑 Administrator' : `⭐ ${user?.xp_points || 0} XP`}
                            </div>
                        </div>
                    )}
                </div>

                {!collapsed && user && user.role !== 'admin' && !isDemoMode && (
                    <div style={{ marginTop: 12 }}>
                        <RoleSwitcher />
                    </div>
                )}
            </div>

            {/* Navigation */}
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
                {user?.role === 'admin' ? (
                    <>
                        <NavItem to="/admin/dashboard" end icon="📊" label={t('overview')} collapsed={collapsed} />
                        <NavItem to="/coding-skills" icon="💻" label="Coding Skills" collapsed={collapsed} />
                        <NavItem to="/profile" icon="👤" label="Profile" collapsed={collapsed} />
                    </>
                ) : (
                    <>
                        <NavItem to="/student/dashboard" end icon="🏠" label={t('dashboard')} collapsed={collapsed} />
                        <NavItem to="/onboarding" icon="🧭" label="Onboarding" collapsed={collapsed} />
                        <NavItem to="/onboarding/diagnostic" icon="🧪" label="Diagnostic" collapsed={collapsed} />
                        <NavItem to="/onboarding/path" icon="🧩" label="Path Builder" collapsed={collapsed} />
                        <NavItem to="/learn" icon="📚" label="Learning Hub" collapsed={collapsed} />
                        <NavItem to="/plan" icon="🏢" label="Company Plan" collapsed={collapsed} />
                        <NavItem to="/interview" icon="🎙️" label="Mock Interview" collapsed={collapsed} />
                        <NavItem to="/interviews" icon="🗂️" label="Interview History" collapsed={collapsed} />
                        <NavItem to="/remediation" icon="🩹" label="Remediation" collapsed={collapsed} />
                        <NavItem to="/demo/coding" icon="💻" label="Demo Challenge" collapsed={collapsed} />
                        <NavItem to="/profile" icon="👤" label="Profile" collapsed={collapsed} />
                    </>
                )}

                {isDemoMode && !collapsed && (
                    <div style={{
                        marginTop: 12, padding: '10px 14px', borderRadius: 12,
                        background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.15)',
                        display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                        <span style={{
                            width: 8, height: 8, borderRadius: '50%', background: '#a855f7',
                            boxShadow: '0 0 8px rgba(168,85,247,0.5)',
                            animation: 'demo-badge-pulse 3s ease-in-out infinite', flexShrink: 0,
                        }} />
                        <span style={{ fontSize: '0.72rem', color: '#c084fc', fontWeight: 600, letterSpacing: '-0.01em' }}>
                            Demo Mode Active
                        </span>
                    </div>
                )}

                {isDemoMode && collapsed && (
                    <div title="Demo Mode Active" style={{
                        marginTop: 12, display: 'flex', justifyContent: 'center',
                    }}>
                        <span style={{
                            width: 8, height: 8, borderRadius: '50%', background: '#a855f7',
                            boxShadow: '0 0 8px rgba(168,85,247,0.5)',
                            animation: 'demo-badge-pulse 3s ease-in-out infinite',
                        }} />
                    </div>
                )}
            </nav>

            {/* Language selector + sign out */}
            <div style={{ padding: collapsed ? '12px 0' : '12px 8px', borderTop: '1px solid var(--dk-border)', marginTop: 12 }}>
                {!collapsed && (
                    <>
                        <div style={{ fontSize: '0.68rem', color: 'var(--dk-text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            {t('language')}
                        </div>
                        <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
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
                    </>
                )}

                <button
                    onClick={handleLogout}
                    title={isDemoMode ? 'Exit Demo' : t('signOut')}
                    style={{
                        width: '100%',
                        padding: collapsed ? '10px 0' : '10px 14px',
                        borderRadius: 10, border: '1px solid var(--dk-border)',
                        background: isDemoMode ? 'rgba(168,85,247,0.08)' : 'rgba(248,113,113,0.08)',
                        color: isDemoMode ? '#c084fc' : 'var(--dk-red)',
                        fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: collapsed ? 0 : 6,
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = isDemoMode ? 'rgba(168,85,247,0.15)' : 'rgba(248,113,113,0.15)'}
                    onMouseLeave={e => e.currentTarget.style.background = isDemoMode ? 'rgba(168,85,247,0.08)' : 'rgba(248,113,113,0.08)'}
                >
                    {collapsed ? (isDemoMode ? '🚀' : '🚪') : (isDemoMode ? '🚀 Exit Demo' : `🚪 ${t('signOut')}`)}
                </button>
            </div>
        </aside>
    )
}
