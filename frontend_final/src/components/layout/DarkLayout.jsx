import React, { useRef, useEffect, useState } from 'react'
import { useMousePosition } from '../../hooks/useMousePosition'
import WebGLCanvas from '../landing/WebGLCanvas'
import DarkSidebar from './DarkSidebar'
import MobileNav from './MobileNav'
import '../../styles/dashboard-dark.css'

const SIDEBAR_OPEN_W = 240
const SIDEBAR_CLOSED_W = 64

/** Reactive mobile breakpoint hook — re-renders on resize. */
function useIsMobile() {
    const [mobile, setMobile] = useState(() =>
        typeof window !== 'undefined' ? window.innerWidth <= 768 : false
    )
    useEffect(() => {
        const mq = window.matchMedia('(max-width: 768px)')
        const handler = (e) => setMobile(e.matches)
        mq.addEventListener('change', handler)
        setMobile(mq.matches)
        return () => mq.removeEventListener('change', handler)
    }, [])
    return mobile
}

export default function DarkLayout({ children, sidebarCollapsed = false }) {
    const isMobile = useIsMobile()
    const mouse = useMousePosition()
    const mouseRef = useRef({ nX: 0, nY: 0 })

    const [sidebarOpen, setSidebarOpen] = useState(() => {
        if (sidebarCollapsed || typeof window === 'undefined') return false
        try {
            const saved = localStorage.getItem('sidebar_open')
            if (saved !== null) return saved === 'true'
        } catch (_) {}
        return window.innerWidth >= 1024
    })

    useEffect(() => {
        mouseRef.current = { nX: mouse.nX, nY: mouse.nY }
    }, [mouse.nX, mouse.nY])

    useEffect(() => {
        if (sidebarCollapsed) setSidebarOpen(false)
    }, [sidebarCollapsed])

    const toggleSidebar = () => {
        if (sidebarCollapsed || isMobile) return
        setSidebarOpen(prev => {
            const next = !prev
            try { localStorage.setItem('sidebar_open', String(next)) } catch (_) {}
            return next
        })
    }

    // Mobile: sidebar never open; sidebarCollapsed: also never open
    const effectiveSidebarOpen = (isMobile || sidebarCollapsed) ? false : sidebarOpen
    const sidebarW = effectiveSidebarOpen ? SIDEBAR_OPEN_W : SIDEBAR_CLOSED_W

    // Bottom nav only on mobile when not in fullscreen interview mode
    const showMobileNav = isMobile && !sidebarCollapsed

    return (
        <div
            className="dark-app"
            style={{ display: 'flex', minHeight: '100vh', position: 'relative' }}
        >
            <WebGLCanvas mouseRef={mouseRef} particleCount={isMobile ? 250 : 900} />

            {/* Sidebar — desktop only, and not in fullscreen interview mode */}
            {!isMobile && !sidebarCollapsed && (
                <DarkSidebar isOpen={effectiveSidebarOpen} onToggle={toggleSidebar} />
            )}

            <main
                style={{
                    flex: 1,
                    minWidth: 0,
                    padding: sidebarCollapsed
                        ? '0'
                        : isMobile
                            /* top: status-bar safe area + 16px; bottom: nav bar (72px) + home indicator */
                            ? 'calc(env(safe-area-inset-top, 0px) + 16px) 16px calc(72px + env(safe-area-inset-bottom, 0px))'
                            : '32px',
                    overflowY: sidebarCollapsed ? 'hidden' : 'auto',
                    overflow: sidebarCollapsed ? 'hidden' : undefined,
                    position: 'relative',
                    zIndex: 1,
                    transition: 'padding 0.3s ease',
                    WebkitOverflowScrolling: 'touch',
                }}
            >
                {/* Frosted glass — desktop only (skip on mobile for performance) */}
                {!isMobile && (
                    <div
                        style={{
                            position: 'fixed',
                            inset: 0,
                            left: sidebarW,
                            background: 'rgba(5, 5, 10, 0.55)',
                            backdropFilter: 'blur(12px)',
                            WebkitBackdropFilter: 'blur(12px)',
                            zIndex: 0,
                            pointerEvents: 'none',
                            transition: 'left 0.3s ease',
                        }}
                    />
                )}

                {/* Mobile: thin status-bar overlay so content doesn't bleed under it */}
                {isMobile && !sidebarCollapsed && (
                    <div style={{
                        position: 'fixed',
                        top: 0, left: 0, right: 0,
                        height: 'env(safe-area-inset-top, 0px)',
                        background: 'rgba(5,5,10,0.97)',
                        zIndex: 100,
                        pointerEvents: 'none',
                    }} />
                )}

                <div style={{ position: 'relative', zIndex: 1 }}>
                    {children}
                </div>
            </main>

            {/* Mobile bottom navigation */}
            {showMobileNav && <MobileNav />}
        </div>
    )
}
