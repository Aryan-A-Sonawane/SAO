import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import DarkLayout from '../components/layout/DarkLayout'
import api, { remediationApi } from '../api/client'
import { useAuth } from '../context/AuthContext'

/* ─── Demo weak areas ────────────────────────────────────── */
const DEMO_WEAK_AREAS = [
    { topic: 'Binary Trees', frequency: 4, recommended: true },
    { topic: 'Dynamic Programming', frequency: 3, recommended: true },
    { topic: 'SQL Joins', frequency: 2, recommended: true },
    { topic: 'Recursion', frequency: 2, recommended: true },
]

const DEMO_QUIZ = {
    topic: 'Binary Trees',
    title: 'Fixing Binary Tree Foundations',
    questions: [
        { id: 1, text: 'What is the maximum number of nodes at level L of a binary tree?', type: 'multiple_choice', options: ['L', '2^L', '2L', '2^(L+1)'], correct_index: 1, explanation: 'Each level doubles from the previous: level 0 has 1 node (2^0), so level L has 2^L.' },
        { id: 2, text: 'Which traversal visits the root node between its left and right subtrees?', type: 'multiple_choice', options: ['Preorder', 'Inorder', 'Postorder', 'Level-order'], correct_index: 1, explanation: 'Inorder traversal = Left → Root → Right, placing the root between subtrees.' },
        { id: 3, text: 'A complete binary tree with N internal nodes has how many leaf nodes?', type: 'multiple_choice', options: ['N', 'N+1', 'N-1', '2N'], correct_index: 1, explanation: 'In a complete binary tree, the number of leaf nodes is always one more than internal nodes.' },
    ]
}

export default function RemediationHub() {
    const { isDemoMode } = useAuth()
    const [weakAreas, setWeakAreas] = useState([])
    const [loading, setLoading] = useState(true)
    const [quiz, setQuiz] = useState(null)
    const [quizLoading, setQuizLoading] = useState(false)
    const [selectedAnswers, setSelectedAnswers] = useState({})
    const [showResults, setShowResults] = useState(false)
    const [article, setArticle] = useState(null)
    const [articleLoading, setArticleLoading] = useState(false)
    const [articleTopic, setArticleTopic] = useState(null)

    const openArticle = async (topic) => {
        setArticleTopic(topic)
        setArticleLoading(true)
        setArticle(null)
        try {
            const res = await remediationApi.article(topic)
            setArticle(res?.content || '')
        } catch {
            setArticle(`## ${topic}\n\nCould not load this article right now. Please try again in a moment.`)
        } finally {
            setArticleLoading(false)
        }
    }

    const closeArticle = () => {
        setArticleTopic(null)
        setArticle(null)
    }

    useEffect(() => {
        if (isDemoMode) {
            setWeakAreas(DEMO_WEAK_AREAS)
            setLoading(false)
            return
        }
        api.get('/remediation/weak-areas')
            .then(r => setWeakAreas(r.data))
            .catch(() => setWeakAreas(DEMO_WEAK_AREAS))
            .finally(() => setLoading(false))
    }, [isDemoMode])

    const startQuiz = async (topic) => {
        setQuizLoading(true)
        setSelectedAnswers({})
        setShowResults(false)
        if (isDemoMode) {
            setTimeout(() => { setQuiz({ ...DEMO_QUIZ, topic, title: `Fixing ${topic} Foundations` }); setQuizLoading(false) }, 600)
            return
        }
        try {
            const r = await api.post('/remediation/micro-quiz', { topic })
            setQuiz(r.data)
        } catch {
            setQuiz({ ...DEMO_QUIZ, topic, title: `Fixing ${topic} Foundations` })
        } finally {
            setQuizLoading(false)
        }
    }

    const selectAnswer = (qId, optIndex) => {
        if (showResults) return
        setSelectedAnswers(prev => ({ ...prev, [qId]: optIndex }))
    }

    const submitQuiz = () => setShowResults(true)

    const getScore = () => {
        if (!quiz) return 0
        return quiz.questions.filter(q => selectedAnswers[q.id] === q.correct_index).length
    }
    const frequencyBars = [1, 2, 3, 4, 5]

    return (
        <DarkLayout>
            <div style={{ padding: '40px 32px', maxWidth: 1000, margin: '0 auto' }}>
                <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                    style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--dk-text)', marginBottom: 6, letterSpacing: '-0.03em' }}>
                    🩹 Remediation Hub
                </motion.h1>
                <p style={{ fontSize: '0.88rem', color: 'var(--dk-text-muted)', marginBottom: 32 }}>
                    Your weakest topics, identified by AI. Practice with targeted micro-quizzes to close gaps.
                </p>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: 60, color: 'var(--dk-text-muted)' }}>
                        <div style={{ fontSize: '2rem', marginBottom: 12 }}>⏳</div>
                        Analyzing your performance data…
                    </div>
                ) : weakAreas.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 60, color: 'var(--dk-text-muted)' }}>
                        <div style={{ fontSize: '2rem', marginBottom: 12 }}>🎉</div>
                        <p>No weak areas detected! Keep up the great work.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {weakAreas.map((area, i) => (
                            <motion.div
                                key={area.topic}
                                initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.07 }}
                                style={{
                                    padding: '18px 22px', borderRadius: 14,
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    display: 'flex', alignItems: 'center', gap: 16,
                                }}
                            >
                                <div style={{
                                    width: 40, height: 40, borderRadius: 10,
                                    background: 'linear-gradient(135deg, #ef4444, #f59e0b)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '1.1rem', flexShrink: 0,
                                }}>🩹</div>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--dk-text)', marginBottom: 4 }}>{area.topic}</h4>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '0.68rem', color: 'var(--dk-text-muted)' }}>Frequency:</span>
                                        {frequencyBars.map(b => (
                                            <div key={b} style={{
                                                width: 6, height: b <= area.frequency ? 14 : 6, borderRadius: 2,
                                                background: b <= area.frequency ? '#ef4444' : 'rgba(255,255,255,0.08)',
                                                transition: 'all 0.3s ease',
                                            }} />
                                        ))}
                                        {area.last_seen_score != null && (
                                            <span style={{
                                                fontSize: '0.65rem', padding: '2px 8px', borderRadius: 999,
                                                background: 'rgba(239,68,68,0.1)', color: '#fca5a5',
                                                border: '1px solid rgba(239,68,68,0.2)',
                                            }}>
                                                Last score: {Math.round(area.last_seen_score)}
                                            </span>
                                        )}
                                        {(area.sources || []).slice(0, 2).map((s) => (
                                            <span key={s} style={{
                                                fontSize: '0.6rem', padding: '2px 6px', borderRadius: 999,
                                                background: 'rgba(99,102,241,0.08)', color: '#a5b4fc',
                                                border: '1px solid rgba(99,102,241,0.15)',
                                                textTransform: 'uppercase', letterSpacing: 0.4,
                                            }}>
                                                {s.replace(/_/g, ' ')}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                    <button
                                        onClick={() => openArticle(area.topic)}
                                        style={{
                                            padding: '8px 14px', borderRadius: 10, cursor: 'pointer',
                                            background: 'rgba(255,255,255,0.04)', color: 'var(--dk-text)',
                                            border: '1px solid rgba(255,255,255,0.08)',
                                            fontSize: '0.75rem', fontWeight: 600, transition: 'all 0.2s',
                                        }}
                                    >
                                        📖 Read article
                                    </button>
                                    <button
                                        onClick={() => startQuiz(area.topic)}
                                        style={{
                                            padding: '8px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
                                            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                                            color: '#fff', fontSize: '0.75rem', fontWeight: 700,
                                            transition: 'all 0.2s ease',
                                        }}
                                    >
                                        Take test →
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* Article Modal */}
                <AnimatePresence>
                    {articleTopic && (
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            style={{
                                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
                                backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                zIndex: 1000, padding: 24,
                            }}
                            onClick={closeArticle}
                        >
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.95, opacity: 0 }}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                    width: '100%', maxWidth: 760, maxHeight: '88vh', overflowY: 'auto',
                                    background: 'rgba(15, 15, 25, 0.96)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: 20, padding: '28px',
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                                    <div>
                                        <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1.6 }}>
                                            Remediation article
                                        </div>
                                        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--dk-text)', marginTop: 4 }}>
                                            {articleTopic}
                                        </h2>
                                    </div>
                                    <button onClick={closeArticle} style={{
                                        background: 'none', border: 'none', color: 'var(--dk-text-muted)',
                                        fontSize: '1.2rem', cursor: 'pointer',
                                    }}>✕</button>
                                </div>

                                {articleLoading ? (
                                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--dk-text-muted)' }}>
                                        <div style={{ fontSize: '2rem', marginBottom: 12 }}>📚</div>
                                        Generating focused article on {articleTopic}…
                                    </div>
                                ) : (
                                    <div className="prose prose-invert max-w-none" style={{ color: 'var(--dk-text)' }}>
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{article || ''}</ReactMarkdown>
                                    </div>
                                )}

                                <div style={{ marginTop: 18, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                    <button onClick={closeArticle} style={{
                                        padding: '8px 14px', borderRadius: 10, cursor: 'pointer',
                                        background: 'rgba(255,255,255,0.04)', color: 'var(--dk-text)',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        fontSize: '0.78rem', fontWeight: 600,
                                    }}>Close</button>
                                    <button onClick={() => { const t = articleTopic; closeArticle(); startQuiz(t) }} style={{
                                        padding: '8px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
                                        background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                                        color: '#fff', fontSize: '0.78rem', fontWeight: 700,
                                    }}>
                                        Take the test →
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Micro-Quiz Modal */}
                <AnimatePresence>
                    {(quiz || quizLoading) && (
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            style={{
                                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
                                backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                zIndex: 1000, padding: 24,
                            }}
                            onClick={() => { setQuiz(null); setQuizLoading(false) }}
                        >
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                onClick={e => e.stopPropagation()}
                                style={{
                                    width: '100%', maxWidth: 620, maxHeight: '85vh', overflowY: 'auto',
                                    background: 'rgba(15, 15, 25, 0.95)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: 20, padding: '32px 28px',
                                }}
                            >
                                {quizLoading ? (
                                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--dk-text-muted)' }}>
                                        <div style={{ fontSize: '2rem', marginBottom: 12 }}>🤖</div>
                                        Generating targeted quiz…
                                    </div>
                                ) : quiz && (
                                    <>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                            <div>
                                                <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--dk-text)' }}>{quiz.title}</h2>
                                                <p style={{ fontSize: '0.76rem', color: 'var(--dk-text-muted)', marginTop: 4 }}>Topic: {quiz.topic} • {quiz.questions.length} questions</p>
                                            </div>
                                            <button onClick={() => setQuiz(null)} style={{
                                                background: 'none', border: 'none', color: 'var(--dk-text-muted)',
                                                fontSize: '1.2rem', cursor: 'pointer',
                                            }}>✕</button>
                                        </div>

                                        {quiz.questions.map((q, qi) => {
                                            const userAnswer = selectedAnswers[q.id]
                                            const isCorrect = userAnswer === q.correct_index

                                            return (
                                                <div key={q.id} style={{
                                                    marginBottom: 20, padding: '18px 16px', borderRadius: 14,
                                                    background: 'rgba(255,255,255,0.02)',
                                                    border: showResults
                                                        ? `1px solid ${isCorrect ? 'rgba(16,185,129,0.3)' : userAnswer !== undefined ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.06)'}`
                                                        : '1px solid rgba(255,255,255,0.06)',
                                                }}>
                                                    <p style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--dk-text)', marginBottom: 12 }}>
                                                        Q{qi + 1}. {q.text}
                                                    </p>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                        {q.options.map((opt, oi) => {
                                                            let optBg = 'rgba(255,255,255,0.03)'
                                                            let optBorder = 'rgba(255,255,255,0.06)'
                                                            let optColor = 'var(--dk-text-muted)'

                                                            if (userAnswer === oi && !showResults) {
                                                                optBg = 'rgba(99,102,241,0.12)'; optBorder = 'rgba(99,102,241,0.4)'; optColor = 'var(--dk-text)'
                                                            }
                                                            if (showResults && oi === q.correct_index) {
                                                                optBg = 'rgba(16,185,129,0.1)'; optBorder = 'rgba(16,185,129,0.4)'; optColor = '#10b981'
                                                            }
                                                            if (showResults && userAnswer === oi && oi !== q.correct_index) {
                                                                optBg = 'rgba(239,68,68,0.1)'; optBorder = 'rgba(239,68,68,0.4)'; optColor = '#ef4444'
                                                            }

                                                            return (
                                                                <div
                                                                    key={oi}
                                                                    onClick={() => selectAnswer(q.id, oi)}
                                                                    style={{
                                                                        padding: '10px 14px', borderRadius: 10, cursor: showResults ? 'default' : 'pointer',
                                                                        background: optBg, border: `1px solid ${optBorder}`,
                                                                        fontSize: '0.8rem', color: optColor,
                                                                        transition: 'all 0.2s ease',
                                                                    }}
                                                                >
                                                                    <strong>{String.fromCharCode(65 + oi)}.</strong> {opt}
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                    {showResults && q.explanation && (
                                                        <div style={{
                                                            marginTop: 10, padding: '10px 12px', borderRadius: 8,
                                                            background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.08)',
                                                            fontSize: '0.74rem', color: 'var(--dk-text-muted)', lineHeight: 1.5,
                                                        }}>
                                                            💡 {q.explanation}
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}

                                        {!showResults ? (
                                            <button
                                                onClick={submitQuiz}
                                                disabled={Object.keys(selectedAnswers).length < quiz.questions.length}
                                                style={{
                                                    width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                                                    cursor: Object.keys(selectedAnswers).length < quiz.questions.length ? 'not-allowed' : 'pointer',
                                                    background: Object.keys(selectedAnswers).length < quiz.questions.length
                                                        ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #6366f1, #a855f7)',
                                                    color: '#fff', fontSize: '0.88rem', fontWeight: 700,
                                                    transition: 'all 0.2s ease',
                                                }}
                                            >
                                                Submit Answers
                                            </button>
                                        ) : (
                                            <div style={{
                                                textAlign: 'center', padding: '16px', borderRadius: 14,
                                                background: getScore() === quiz.questions.length ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
                                                border: `1px solid ${getScore() === quiz.questions.length ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
                                            }}>
                                                <div style={{ fontSize: '1.8rem', marginBottom: 6 }}>
                                                    {getScore() === quiz.questions.length ? '🎉' : '💪'}
                                                </div>
                                                <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--dk-text)' }}>
                                                    You got {getScore()} / {quiz.questions.length} correct
                                                </p>
                                                <p style={{ fontSize: '0.76rem', color: 'var(--dk-text-muted)', marginTop: 4 }}>
                                                    {getScore() === quiz.questions.length ? 'Perfect! This area is improving.' : 'Review explanations above to solidify your understanding.'}
                                                </p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </DarkLayout>
    )
}
