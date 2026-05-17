import React, { useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { useScrollAnimation } from '../../hooks/useScrollAnimation'

/**
 * BentoGrid — asymmetric 12-col grid of 6 feature cards.
 * Each card has a mouse-proximity spotlight gradient.
 * Cards cascade into view with spring physics on scroll.
 */

const easeOutExpo = [0.16, 1, 0.3, 1]

const FEATURES = [
    {
        icon: '🧠',
        title: 'AI-Powered Questions',
        desc: 'Upload any PDF and get instantly generated higher-order thinking questions aligned with Bloom\'s Taxonomy. Analyze, evaluate, synthesize — not just recall.',
        tag: 'Powered by Gemini',
        art: 'brain',
    },
    {
        icon: '📊',
        title: 'Real Skill Evaluation',
        desc: 'AI evaluates depth, accuracy, application, and originality — not just right or wrong. Get a nuanced score reflecting true mastery.',
        tag: '360° Assessment',
        art: 'ring',
    },
    {
        icon: '🎯',
        title: 'Adaptive Pathways',
        desc: 'Personalized learning paths generated from your performance data.',
        tag: 'Smart Routing',
        art: null,
    },
    {
        icon: '🎙️',
        title: 'Audio Responses',
        desc: 'Record verbal answers. Whisper AI transcribes and evaluates your spoken explanations.',
        tag: 'Whisper AI',
        art: 'wave',
    },
    {
        icon: '🔒',
        title: 'Anti-Cheat Integrity',
        desc: 'Plagiarism detection, originality scoring, and browser monitoring ensure every submission is authentic and trusted.',
        tag: 'Zero Tolerance',
        art: 'integrity',
    },
]

const cardVariants = {
    hidden: { opacity: 0, y: 48, scale: 0.96 },
    visible: (i) => ({
        opacity: 1,
        y: 0,
        scale: 1,
        transition: {
            duration: 0.7,
            ease: easeOutExpo,
            delay: i * 0.09,
        },
    }),
}

function ScoreRing({ animated }) {
    return (
        <div className="lp-score-ring-wrap">
            <svg className={`lp-score-ring ${animated ? 'animated' : ''}`} viewBox="0 0 44 44">
                <defs>
                    <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#a855f7" />
                    </linearGradient>
                </defs>
                <circle className="track" cx="22" cy="22" r="18" />
                <circle className="fill" cx="22" cy="22" r="18" strokeDasharray="113" />
            </svg>
            <div style={{
                position: 'absolute',
                textAlign: 'center',
                fontWeight: 700,
                fontSize: '1.1rem',
                color: '#f1f5f9',
                lineHeight: 1,
            }}>
                <div>87</div>
                <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 500, marginTop: 2 }}>/ 100</div>
            </div>
        </div>
    )
}

function BentoCard({ feature, index, inView }) {
    const cardRef = useRef(null)

    const handleMouseMove = useCallback((e) => {
        const rect = cardRef.current?.getBoundingClientRect()
        if (!rect) return
        const mx = ((e.clientX - rect.left) / rect.width) * 100
        const my = ((e.clientY - rect.top) / rect.height) * 100
        cardRef.current.style.setProperty('--mx', `${mx}%`)
        cardRef.current.style.setProperty('--my', `${my}%`)
    }, [])

    return (
        <motion.div
            ref={cardRef}
            className="lp-bento-card"
            onMouseMove={handleMouseMove}
            variants={cardVariants}
            custom={index}
            initial="hidden"
            animate={inView ? 'visible' : 'hidden'}
        >
            <div className="spotlight" />
            <div className="lp-bento-icon">{feature.icon}</div>
            <h3 className="lp-bento-title">{feature.title}</h3>
            <p className="lp-bento-desc">{feature.desc}</p>
            <span className="lp-bento-tag">✦ {feature.tag}</span>

            {/* Animated art for wide cards */}
            {feature.art === 'brain' && (
                <div className="lp-bento-art">
                    {[...Array(8)].map((_, i) => (
                        <motion.div
                            key={i}
                            style={{
                                width: 6, height: 6, borderRadius: '50%',
                                background: i % 2 === 0 ? '#6366f1' : '#a855f7',
                                flexShrink: 0,
                            }}
                            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
                        />
                    ))}
                    <motion.div
                        style={{ flex: 1, height: 2, background: 'linear-gradient(to right, #6366f1, transparent)' }}
                        animate={{ scaleX: [0.5, 1, 0.5] }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    />
                </div>
            )}

            {feature.art === 'ring' && (
                <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', marginTop: 16 }}>
                    <svg width="110" height="110" viewBox="0 0 44 44">
                        <defs>
                            <linearGradient id={`scoreGrad${index}`} x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#6366f1" />
                                <stop offset="100%" stopColor="#a855f7" />
                            </linearGradient>
                        </defs>
                        <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                        <motion.circle
                            cx="22" cy="22" r="18"
                            fill="none"
                            stroke={`url(#scoreGrad${index})`}
                            strokeWidth="6"
                            strokeLinecap="round"
                            strokeDasharray="113"
                            strokeDashoffset="113"
                            style={{ transformOrigin: 'center', rotate: -90 }}
                            animate={inView ? { strokeDashoffset: 14 } : { strokeDashoffset: 113 }}
                            transition={{ duration: 1.6, ease: easeOutExpo, delay: 0.4 }}
                        />
                    </svg>
                    <div style={{
                        position: 'absolute', top: '50%', left: '50%',
                        transform: 'translate(-50%, -50%)',
                        textAlign: 'center',
                    }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f1f5f9', lineHeight: 1 }}>87</div>
                        <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: 2 }}>/ 100</div>
                    </div>
                </div>
            )}

            {feature.art === 'wave' && (
                <div className="lp-waveform">
                    {[...Array(12)].map((_, i) => (
                        <div key={i} className="lp-wave-bar" />
                    ))}
                </div>
            )}

            {feature.art === 'integrity' && (
                <div className="lp-integrity-bars">
                    {[
                        { label: 'Plagiarism', pct: '95%', delay: '0s' },
                        { label: 'Originality', pct: '88%', delay: '0.15s' },
                        { label: 'Authenticity', pct: '99%', delay: '0.3s' },
                    ].map((row) => (
                        <div key={row.label} className="lp-integrity-row">
                            <span style={{ width: 80, flexShrink: 0 }}>{row.label}</span>
                            <div className="lp-integrity-bar-track">
                                <div
                                    className={`lp-integrity-bar-fill ${inView ? 'animated' : ''}`}
                                    style={{ '--target-w': row.pct, '--delay': row.delay }}
                                />
                            </div>
                            <span style={{ flexShrink: 0 }}>{row.pct}</span>
                        </div>
                    ))}
                </div>
            )}
        </motion.div>
    )
}

export default function BentoGrid() {
    const { ref, inView } = useScrollAnimation(0.1)

    return (
        <section className="lp-section">
            <div className="lp-bento-header">
                <div className="lp-section-label">Platform Features</div>
                <h2 className="lp-section-title">
                    Everything to Assess{' '}
                    <span className="lp-grad-text">Real Skills</span>
                </h2>
                <p className="lp-section-sub">
                    Designed for educators and HR professionals who want to go beyond
                    surface-level testing and measure genuine capability.
                </p>
            </div>

            <div ref={ref} className="lp-bento-grid">
                {FEATURES.map((f, i) => (
                    <BentoCard key={i} feature={f} index={i} inView={inView} />
                ))}
            </div>
        </section>
    )
}
