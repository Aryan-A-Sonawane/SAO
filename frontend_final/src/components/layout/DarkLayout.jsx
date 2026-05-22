import React, { useRef, useEffect, useState } from 'react'
import { useMousePosition } from '../../hooks/useMousePosition'
import WebGLCanvas from '../landing/WebGLCanvas'
import DarkSidebar from './DarkSidebar'
import '../../styles/dashboard-dark.css'

const SIDEBAR_OPEN_W = 240
const SIDEBAR_CLOSED_W = 64

export default function DarkLayout({ children }) {
    const mouse = useMousePosition()
    const mouseRef = useRef({ nX: 0, nY: 0 })

    const [sidebarOpen, setSidebarOpen] = useState(() => {
        try {
            const saved = localStorage.getItem('sidebar_open')
            if (saved !== null) return saved === 'true'
        } catch (_) {}
        // Default: closed on narrow screens (mobile/tablet), open on desktop
        return typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
    })

    useEffect(() => {
        mouseRef.current = { nX: mouse.nX, nY: mouse.nY }
    }, [mouse.nX, mouse.nY])

    const toggleSidebar = () => {
        setSidebarOpen(prev => {
            const next = !prev
            try { localStorage.setItem('sidebar_open', String(next)) } catch (_) {}
            return next
        })
    }

    const sidebarW = sidebarOpen ? SIDEBAR_OPEN_W : SIDEBAR_CLOSED_W

    return (
        <div
            className="dark-app"
            style={{ display: 'flex', minHeight: '100vh', position: 'relative' }}
        >
            <WebGLCanvas mouseRef={mouseRef} particleCount={900} />

            <DarkSidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />

            <main
                style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '32px',
                    overflowY: 'auto',
                    position: 'relative',
                    zIndex: 1,
                    transition: 'padding-left 0.3s ease',
                }}
            >
                {/* Frosted glass surface behind content */}
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
                <div style={{ position: 'relative', zIndex: 1 }}>
                    {children}
                </div>
            </main>
        </div>
    )
}
