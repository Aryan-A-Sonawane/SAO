import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useScrollAnimation } from '../../hooks/useScrollAnimation'

/**
 * PlaygroundSection — glassmorphic terminal window simulating the platform.
 * Has two tabs: Terminal (typewriter), Results.
 * Typewriter starts when scrolled into view.
 */

const easeOutExpo = [0.16, 1, 0.3, 1]

const TERMINAL_LINES = [
    { type: 'cmd', text: 'upload --file "network_engineering.pdf"', delay: 300 },
    { type: 'output', text: '▸ Parsing 32 pages...', delay: 900 },
    { type: 'output', text: '▸ Extracting key concepts...', delay: 1400 },
    { type: 'success', text: '✓ Document processed successfully', delay: 2100 },
    { type: 'cmd', text: 'generate --type HOT --count 8 --taxonomy bloom', delay: 2900 },
    { type: 'output', text: '▸ Generating higher-order questions...', delay: 3600 },
    { type: 'success', text: '✓ 8 questions generated  [Analyze: 3, Evaluate: 3, Create: 2]', delay: 4400 },
    { type: 'cmd', text: 'evaluate --submission student_42.json', delay: 5300 },
    { type: 'output', text: '▸ Running semantic similarity...', delay: 6000 },
    { type: 'output', text: '▸ Bloom\'s taxonomy alignment check...', delay: 6800 },
    { type: 'success', text: '✓ Score: 87/100  |  Depth: 9.1  |  Originality: 8.4', delay: 7700 },
]

function TerminalLine({ line, index, started }) {
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        if (!started) return
        const t = setTimeout(() => setVisible(true), line.delay)
        return () => clearTimeout(t)
    }, [started, line.delay])

    if (!visible) return null

    const colorMap = {
        cmd: '#f1f5f9',
        output: '#64748b',
        success: '#4ade80',
    }

    return (
        <motion.div
            className="lp-term-line"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
        >
            {line.type === 'cmd' && (
                <span className="lp-term-prompt">$</span>
            )}
            <span
                className={line.type === 'cmd' ? 'lp-term-cmd' : ''}
                style={{ color: colorMap[line.type] }}
            >
                {line.type !== 'cmd' && <span style={{ marginRight: 4 }}></span>}
                {line.text}
            </span>
        </motion.div>
    )
}

function TerminalTab({ started }) {
    const lastLineIdx = TERMINAL_LINES.length - 1
    const lastLine = TERMINAL_LINES[lastLineIdx]
    // Show blinking cursor while still running
    const [done, setDone] = useState(false)
    useEffect(() => {
        if (!started) return
        const t = setTimeout(() => setDone(true), lastLine.delay + 800)
        return () => clearTimeout(t)
    }, [started, lastLine.delay])

    return (
        <div className="lp-terminal-body">
            {TERMINAL_LINES.map((line, i) => (
                <TerminalLine key={i} line={line} index={i} started={started} />
            ))}
            {!done && started && <span className="lp-term-cursor" />}
        </div>
    )
}

function ResultsTab() {
    const items = [
        { score: '87', label: 'Overall Score', color: '#6366f1' },
        { score: '9.1', label: 'Depth Rating', color: '#a855f7' },
        { score: '8.4', label: 'Originality', color: '#22d3ee' },
    ]

    return (
        <div className="lp-terminal-body">
            <div className="lp-results-grid">
                {items.map((it, i) => (
                    <motion.div
                        key={it.label}
                        className="lp-result-card"
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.1, duration: 0.5, ease: easeOutExpo }}
                    >
                        <div className="lp-result-score" style={{ color: it.color }}>{it.score}</div>
                        <div className="lp-result-label">{it.label}</div>
                    </motion.div>
                ))}
            </div>

            <motion.div
                style={{
                    marginTop: 24,
                    padding: '16px 20px',
                    background: 'rgba(74,222,128,0.06)',
                    border: '1px solid rgba(74,222,128,0.2)',
                    borderRadius: 12,
                    fontSize: '0.85rem',
                    color: '#4ade80',
                    lineHeight: 1.7,
                    fontFamily: 'var(--lp-mono)',
                }}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
            >
                <strong>AI Feedback:</strong> Strong application of OSI model concepts. Response
                demonstrates solid evaluative reasoning. Improve synthesis by connecting transport
                layer protocols to application-layer design patterns.
            </motion.div>
        </div>
    )
}

const TABS = ['Terminal', 'Results']

export default function PlaygroundSection() {
    const [activeTab, setActiveTab] = useState('Terminal')
    const { ref, inView } = useScrollAnimation(0.25)

    return (
        <div className="lp-playground-wrap">
            {/* Section label */}
            <motion.div
                style={{ textAlign: 'center', marginBottom: 48 }}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, ease: easeOutExpo }}
            >
                <div className="lp-section-label">Live Playground</div>
                <h2 className="lp-section-title">
                    See it in <span className="lp-grad-text">Action</span>
                </h2>
                <p className="lp-section-sub" style={{ margin: '0 auto' }}>
                    Watch InterviewVault process a document, generate questions,
                    and evaluate a student response in real time.
                </p>
            </motion.div>

            {/* Terminal window */}
            <motion.div
                ref={ref}
                className="lp-terminal"
                initial={{ opacity: 0, y: 40, scale: 0.97 }}
                animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
                transition={{ duration: 0.8, ease: easeOutExpo }}
            >
                {/* Window chrome */}
                <div className="lp-terminal-header">
                    <div className="lp-traffic-lights">
                        <div className="lp-traffic-light red" />
                        <div className="lp-traffic-light yellow" />
                        <div className="lp-traffic-light green" />
                    </div>
                    <div className="lp-terminal-title">interview-vault — live demo</div>
                    <div style={{ width: 52 }} /> {/* spacer */}
                </div>

                {/* Tabs */}
                <div className="lp-tab-strip">
                    {TABS.map((tab) => (
                        <button
                            key={tab}
                            className={`lp-tab ${activeTab === tab ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Tab content */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.25, ease: 'easeOut' }}
                    >
                        {activeTab === 'Terminal' && <TerminalTab started={inView} />}
                        {activeTab === 'Results' && <ResultsTab />}
                    </motion.div>
                </AnimatePresence>
            </motion.div>
        </div>
    )
}
