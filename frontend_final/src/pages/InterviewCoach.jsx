import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import DarkLayout from '../components/layout/DarkLayout'
import api, { interviewSessionsApi } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { DEMO_INTERVIEW_TOPICS } from '../data/demoData'
import Proctor from '../components/Proctor'
import { downloadInterviewReportPDF } from '../lib/downloadFile'

/* ─── Typing indicator dots ──────────────────────────────────────────────── */
function TypingIndicator() {
    return (
        <div style={{ display: 'flex', gap: 4, padding: '12px 16px' }}>
            {[0, 1, 2].map(i => (
                <div
                    key={i}
                    style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: '#6366f1',
                        animation: `typing-dot 1.2s ease-in-out ${i * 0.15}s infinite`,
                    }}
                />
            ))}
        </div>
    )
}

/* ─── Chat message bubble ────────────────────────────────────────────────── */
function ChatBubble({ role, content, animate = true }) {
    const isInterviewer = role === 'interviewer'
    const Wrapper = animate ? motion.div : 'div'
    const animProps = animate ? {
        initial: { opacity: 0, y: 12, scale: 0.96 },
        animate: { opacity: 1, y: 0, scale: 1 },
        transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
    } : {}

    return (
        <Wrapper {...animProps} style={{
            display: 'flex', gap: 10,
            flexDirection: isInterviewer ? 'row' : 'row-reverse',
            marginBottom: 16,
        }}>
            {/* Avatar */}
            <div style={{
                width: 36, height: 36, borderRadius: 12, flexShrink: 0,
                background: isInterviewer
                    ? 'linear-gradient(135deg, #6366f1, #a855f7)'
                    : 'linear-gradient(135deg, #10b981, #06b6d4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1rem',
                boxShadow: isInterviewer
                    ? '0 0 16px rgba(99,102,241,0.3)'
                    : '0 0 16px rgba(16,185,129,0.3)',
            }}>
                {isInterviewer ? '🎙️' : '👤'}
            </div>
            {/* Bubble */}
            <div style={{
                maxWidth: '75%', padding: '12px 16px', borderRadius: 16,
                background: isInterviewer
                    ? 'rgba(99,102,241,0.08)'
                    : 'rgba(16,185,129,0.08)',
                border: `1px solid ${isInterviewer ? 'rgba(99,102,241,0.15)' : 'rgba(16,185,129,0.15)'}`,
                fontSize: '0.88rem', lineHeight: 1.65,
                color: 'var(--dk-text)',
                whiteSpace: 'pre-wrap',
            }}>
                {content}
            </div>
        </Wrapper>
    )
}

/* ─── Score Bar component ────────────────────────────────────────────────── */
function ScoreBar({ label, score, max = 10 }) {
    const pct = (score / max) * 100
    return (
        <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--dk-text-muted)' }}>{label}</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--dk-text)' }}>{score}/{max}</span>
            </div>
            <div style={{ height: 6, borderRadius: 99, background: 'rgba(99,102,241,0.1)' }}>
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                        height: '100%', borderRadius: 99,
                        background: pct >= 70 ? 'linear-gradient(90deg, #10b981, #06b6d4)' : pct >= 40 ? 'linear-gradient(90deg, #f59e0b, #eab308)' : 'linear-gradient(90deg, #ef4444, #f59e0b)',
                    }}
                />
            </div>
        </div>
    )
}

/* ─── Main Interview Coach Page ──────────────────────────────────────────── */
export default function InterviewCoach() {
    const [phase, setPhase] = useState('setup') // setup | interview | evaluation
    const [topics, setTopics] = useState([])
    const [selectedTopic, setSelectedTopic] = useState('dsa')
    const [difficulty, setDifficulty] = useState('intermediate')
    const [numQuestions, setNumQuestions] = useState(5)
    const [messages, setMessages] = useState([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [questionNum, setQuestionNum] = useState(0)
    const [totalQ, setTotalQ] = useState(5)
    const [evaluation, setEvaluation] = useState(null)
    const chatEndRef = useRef(null)
    const inputRef = useRef(null)
    const proctorRef = useRef(null)
    const [isListening, setIsListening] = useState(false)
    const recognitionRef = useRef(null)
    const [savedSessionId, setSavedSessionId] = useState(null)
    const [savingSession, setSavingSession] = useState(false)
    const { isDemoMode, user } = useAuth()
    const navigate = useNavigate()

    const persistSession = async ({ evaluationData, transcript, behavioralStats }) => {
        if (isDemoMode) return
        setSavingSession(true)
        try {
            const topicLabel = topics.find((t) => t.id === selectedTopic)?.name || selectedTopic
            const res = await interviewSessionsApi.create({
                mode: 'studied_topics',
                job_role: user?.target_role || '',
                topic: selectedTopic,
                topics_covered: [topicLabel],
                transcript,
                behavioral_stats: behavioralStats || undefined,
                end_evaluation: evaluationData,
            })
            setSavedSessionId(res?.id)
            toast.success('Interview saved to your history')
        } catch (err) {
            console.error('Failed to persist interview', err)
            toast.error('Could not save this interview to history')
        } finally {
            setSavingSession(false)
        }
    }

    const speakText = (text) => {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const cleanText = text.replace(/[*_#]/g, '').trim();
        const utterance = new SpeechSynthesisUtterance(cleanText);
        window.speechSynthesis.speak(utterance);
    }

    // Auto-scroll + cleanup speech logic
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, loading])

    useEffect(() => {
        return () => {
            if (recognitionRef.current) recognitionRef.current.stop()
            if (window.speechSynthesis) window.speechSynthesis.cancel()
        }
    }, [])

    // Load topics
    useEffect(() => {
        if (isDemoMode) {
            setTopics(DEMO_INTERVIEW_TOPICS)
        } else {
            api.get('/interview/topics')
                .then(r => setTopics(r.data))
                .catch(() => setTopics(DEMO_INTERVIEW_TOPICS))
        }
    }, [isDemoMode])

    const startInterview = async () => {
        setLoading(true)
        setPhase('interview')
        setMessages([])

        if (isDemoMode) {
            const topicInfo = topics.find(t => t.id === selectedTopic) || topics[0]
            setTimeout(() => {
                const text1 = `Hi there! Welcome to your ${topicInfo.name} interview. I'll ask you ${numQuestions} questions at ${difficulty} difficulty. Take your time and think through each answer. Let's start with your first question:`;
                const text2 = `Can you explain the fundamental concepts of ${topicInfo.name}? How do they apply in real-world software engineering? Please be specific with examples.`;
                setMessages([
                    { role: 'interviewer', content: text1 },
                    { role: 'interviewer', content: text2 },
                ])
                speakText(`${text1} ${text2}`);
                setQuestionNum(1)
                setTotalQ(numQuestions)
                setLoading(false)
            }, 1200)
            return
        }

        try {
            const res = await api.post('/interview/start', {
                topic: selectedTopic, difficulty, num_questions: numQuestions,
            })
            const data = res.data
            setMessages([
                { role: 'interviewer', content: data.greeting },
                { role: 'interviewer', content: data.first_question },
            ])
            speakText(`${data.greeting} ${data.first_question}`);
            setQuestionNum(1)
            setTotalQ(data.total_questions || numQuestions)
        } catch {
            const errText = 'Sorry, I had trouble starting the interview. Please try again.';
            setMessages([{ role: 'interviewer', content: errText }])
            speakText(errText);
        }
        setLoading(false)
    }

    const sendResponse = async () => {
        if (!input.trim() || loading) return
        const userMsg = input.trim()
        setInput('')

        const newMessages = [...messages, { role: 'candidate', content: userMsg }]
        setMessages(newMessages)
        setLoading(true)

        const nextQ = questionNum + 1

        if (isDemoMode) {
            setTimeout(() => {
                if (nextQ > totalQ) {
                    const endText = "That's a great answer! Thank you for taking the time to explain your thinking.\n\nThat wraps up our interview. Let me prepare your evaluation...";
                    setMessages(prev => [
                        ...prev,
                        { role: 'interviewer', content: endText },
                    ])
                    speakText(endText);
                    setTimeout(() => showDemoEvaluation(), 1500)
                } else {
                    const nextText = `Good response! I appreciate the detail.\n\nFor your next question (${nextQ}/${totalQ}):\n\nCan you dive deeper into a more advanced aspect of this topic? Think about edge cases, scalability, or common pitfalls that engineers encounter in production.`;
                    setMessages(prev => [
                        ...prev,
                        { role: 'interviewer', content: nextText },
                    ])
                    speakText(nextText);
                    setQuestionNum(nextQ)
                }
                setLoading(false)
            }, 1500)
            return
        }

        try {
            const behavioralStats = proctorRef.current?.getStats() || null

            if (nextQ > totalQ) {
                // End interview
                const res = await api.post('/interview/end', {
                    topic: selectedTopic, difficulty,
                    history: newMessages, total_questions: totalQ,
                    behavioral_stats: behavioralStats
                })
                const closingMsg = res.data.closing_message || "Thank you for completing the interview!";
                const finalTranscript = [
                    ...newMessages,
                    { role: 'interviewer', content: closingMsg },
                ]
                setMessages(finalTranscript)
                speakText(closingMsg);
                setEvaluation(res.data)
                setPhase('evaluation')
                persistSession({
                    evaluationData: res.data,
                    transcript: finalTranscript,
                    behavioralStats,
                })
            } else {
                const res = await api.post('/interview/respond', {
                    topic: selectedTopic, difficulty,
                    history: newMessages, student_response: userMsg,
                    question_number: nextQ, total_questions: totalQ,
                    behavioral_stats: behavioralStats
                })
                const ack = res.data.acknowledgment || ''
                const next = res.data.next_question || ''
                const msgText = `${ack}\n\nQuestion ${nextQ}/${totalQ}:\n${next}`;
                setMessages(prev => [
                    ...prev,
                    { role: 'interviewer', content: msgText },
                ])
                speakText(`${ack} ${next}`);
                setQuestionNum(nextQ)
            }
        } catch {
            const retryText = "I had a brief technical issue. Could you repeat your last point?";
            setMessages(prev => [
                ...prev,
                { role: 'interviewer', content: retryText },
            ])
            speakText(retryText);
        }
        setLoading(false)
        inputRef.current?.focus()
    }

    const showDemoEvaluation = () => {
        setEvaluation({
            overall_score: 72,
            verdict: 'Hire',
            strengths: ['Good understanding of core concepts', 'Clear communication style', 'Thoughtful responses'],
            weaknesses: ['Could provide more specific examples', 'Cover edge cases more thoroughly'],
            detailed_feedback: 'You demonstrated solid foundational knowledge and communicated your ideas clearly. To improve, practice providing specific code examples and discussing trade-offs in more depth. Focus on real-world scenarios and system design thinking.',
            category_scores: { technical_depth: 7, communication: 8, problem_solving: 6, clarity: 7, confidence: 8 },
            recommended_study_topics: ['Advanced algorithm patterns', 'System design fundamentals'],
            closing_message: 'Great effort! You showed real potential. Keep practicing and you\'ll nail your next interview! 🚀',
        })
        setPhase('evaluation')
    }

    const resetInterview = () => {
        setPhase('setup')
        setMessages([])
        setEvaluation(null)
        setQuestionNum(0)
        setSavedSessionId(null)
        setSavingSession(false)
        if (window.speechSynthesis) window.speechSynthesis.cancel()
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            sendResponse()
        }
    }

    const toggleListen = () => {
        if (isListening) {
            recognitionRef.current?.stop()
            setIsListening(false)
            return
        }
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
        if (!SpeechRecognition) {
            alert('Speech recognition is not supported in this browser. Please use Chrome.')
            return
        }
        
        const recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.interimResults = true
        recognitionRef.current = recognition
        
        recognition.onresult = (e) => {
            let finalTranscript = ''
            for (let i = e.resultIndex; i < e.results.length; ++i) {
                if (e.results[i].isFinal) finalTranscript += e.results[i][0].transcript + ' '
            }
            if (finalTranscript) setInput(prev => prev + ' ' + finalTranscript.trim())
        }
        
        recognition.start()
        setIsListening(true)
    }

    // ─── SETUP PHASE ───
    if (phase === 'setup') {
        return (
            <DarkLayout>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    style={{ maxWidth: 700, margin: '0 auto' }}
                >
                    <h1 style={{ fontSize: 'clamp(1.4rem, 3vw, 1.9rem)', fontWeight: 800, color: 'var(--dk-text)', letterSpacing: '-0.04em', marginBottom: 8 }}>
                        🎙️ AI Interview Coach
                    </h1>
                    <p style={{ color: 'var(--dk-text-muted)', fontSize: '0.88rem', marginBottom: 32 }}>
                        Practice with a realistic AI interviewer that adapts to your responses in real-time.
                    </p>

                    {/* Topic Selection */}
                    <div className="dk-card" style={{ marginBottom: 20 }}>
                        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--dk-text)', marginBottom: 16 }}>
                            Choose Your Topic
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                            {topics.map(t => (
                                <div
                                    key={t.id}
                                    onClick={() => setSelectedTopic(t.id)}
                                    style={{
                                        padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                                        background: selectedTopic === t.id ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.02)',
                                        border: `1px solid ${selectedTopic === t.id ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)'}`,
                                        transition: 'all 0.2s ease',
                                        display: 'flex', alignItems: 'center', gap: 8,
                                    }}
                                >
                                    <span style={{ fontSize: '1.2rem' }}>{t.emoji}</span>
                                    <span style={{ fontSize: '0.82rem', fontWeight: selectedTopic === t.id ? 700 : 500, color: selectedTopic === t.id ? 'var(--dk-primary-light)' : 'var(--dk-text)' }}>
                                        {t.name}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Settings Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                        <div className="dk-card">
                            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--dk-text)', marginBottom: 8, display: 'block' }}>Difficulty</label>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {['beginner', 'intermediate', 'advanced'].map(d => (
                                    <button
                                        key={d}
                                        onClick={() => setDifficulty(d)}
                                        style={{
                                            flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                                            background: difficulty === d ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)',
                                            color: difficulty === d ? '#a78bfa' : 'var(--dk-text-muted)',
                                            fontSize: '0.76rem', fontWeight: 600, textTransform: 'capitalize',
                                            outline: difficulty === d ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(255,255,255,0.06)',
                                        }}
                                    >
                                        {d}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="dk-card">
                            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--dk-text)', marginBottom: 8, display: 'block' }}>Questions</label>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {[3, 5, 7, 10].map(n => (
                                    <button
                                        key={n}
                                        onClick={() => setNumQuestions(n)}
                                        style={{
                                            flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                                            background: numQuestions === n ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)',
                                            color: numQuestions === n ? '#a78bfa' : 'var(--dk-text-muted)',
                                            fontSize: '0.82rem', fontWeight: 600,
                                            outline: numQuestions === n ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(255,255,255,0.06)',
                                        }}
                                    >
                                        {n}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={startInterview}
                        className="dk-btn dk-btn-primary"
                        style={{
                            width: '100%', justifyContent: 'center', padding: '14px 0',
                            fontSize: '0.95rem', fontWeight: 700,
                            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                        }}
                    >
                        🎙️ Start Interview
                    </button>
                </motion.div>
            </DarkLayout>
        )
    }

    // ─── EVALUATION PHASE ───
    if (phase === 'evaluation' && evaluation) {
        const verdictColors = {
            'Strong Hire': '#10b981', 'Hire': '#06b6d4', 'Lean Hire': '#f59e0b',
            'Lean No Hire': '#f97316', 'No Hire': '#ef4444',
        }
        return (
            <DarkLayout>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    style={{ maxWidth: 700, margin: '0 auto' }}
                >
                    <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--dk-text)', letterSpacing: '-0.04em', marginBottom: 24 }}>
                        📋 Interview Evaluation
                    </h1>

                    {/* Score + Verdict */}
                    <div className="dk-card" style={{ textAlign: 'center', marginBottom: 20 }}>
                        <div style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--dk-text)', marginBottom: 4 }}>
                            {evaluation.overall_score}%
                        </div>
                        <div style={{
                            display: 'inline-block', padding: '6px 20px', borderRadius: 99,
                            background: `${verdictColors[evaluation.verdict] || '#6366f1'}20`,
                            border: `1px solid ${verdictColors[evaluation.verdict] || '#6366f1'}40`,
                            color: verdictColors[evaluation.verdict] || '#6366f1',
                            fontSize: '0.88rem', fontWeight: 700,
                        }}>
                            {evaluation.verdict}
                        </div>
                    </div>

                    {/* Category Scores */}
                    <div className="dk-card" style={{ marginBottom: 20 }}>
                        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--dk-text)', marginBottom: 16 }}>Category Scores</h3>
                        {Object.entries(evaluation.category_scores || {}).map(([key, val]) => (
                            <ScoreBar key={key} label={key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} score={val} />
                        ))}
                    </div>

                    {/* Strengths & Weaknesses */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                        <div className="dk-card">
                            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#10b981', marginBottom: 10 }}>✅ Strengths</h3>
                            {evaluation.strengths?.map((s, i) => (
                                <div key={i} style={{ fontSize: '0.82rem', color: 'var(--dk-text)', marginBottom: 6, paddingLeft: 12, borderLeft: '2px solid rgba(16,185,129,0.3)' }}>{s}</div>
                            ))}
                        </div>
                        <div className="dk-card">
                            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f59e0b', marginBottom: 10 }}>⚠️ Areas to Improve</h3>
                            {evaluation.weaknesses?.map((w, i) => (
                                <div key={i} style={{ fontSize: '0.82rem', color: 'var(--dk-text)', marginBottom: 6, paddingLeft: 12, borderLeft: '2px solid rgba(245,158,11,0.3)' }}>{w}</div>
                            ))}
                        </div>
                    </div>

                    {/* Feedback */}
                    <div className="dk-card" style={{ marginBottom: 20 }}>
                        <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--dk-text)', marginBottom: 8 }}>💬 Detailed Feedback</h3>
                        <p style={{ fontSize: '0.84rem', color: 'var(--dk-text-muted)', lineHeight: 1.7 }}>{evaluation.detailed_feedback}</p>
                    </div>

                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <button
                            onClick={resetInterview}
                            className="dk-btn"
                            style={{
                                flex: '1 1 160px', justifyContent: 'center',
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                color: 'var(--dk-text)',
                            }}
                        >
                            🔄 Start New Interview
                        </button>
                        <button
                            onClick={() => savedSessionId && navigate(`/interviews/${savedSessionId}`)}
                            disabled={!savedSessionId || savingSession}
                            className="dk-btn dk-btn-primary"
                            style={{
                                flex: '1 1 160px',
                                justifyContent: 'center',
                                background: savedSessionId
                                    ? 'linear-gradient(135deg, #6366f1, #a855f7)'
                                    : 'rgba(99,102,241,0.18)',
                                opacity: savedSessionId ? 1 : 0.7,
                            }}
                        >
                            {savingSession ? 'Saving…' : '📊 View Full Report'}
                        </button>
                        <button
                            onClick={async () => {
                                if (!savedSessionId) return
                                try {
                                    await downloadInterviewReportPDF(savedSessionId)
                                    toast.success('Report downloaded')
                                } catch {
                                    toast.error('Could not download report')
                                }
                            }}
                            disabled={!savedSessionId || savingSession}
                            className="dk-btn"
                            style={{
                                flex: '1 1 160px',
                                justifyContent: 'center',
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                color: 'var(--dk-text)',
                                opacity: savedSessionId ? 1 : 0.6,
                            }}
                        >
                            ⬇ Download PDF
                        </button>
                    </div>
                    {!isDemoMode && !savedSessionId && !savingSession && (
                        <p style={{ marginTop: 10, fontSize: '0.75rem', color: 'var(--dk-text-muted)', textAlign: 'center' }}>
                            Saving may have failed — your interview history is updated automatically when it succeeds.
                        </p>
                    )}
                </motion.div>
            </DarkLayout>
        )
    }

    // ─── INTERVIEW PHASE ───
    return (
        <DarkLayout>
            <div style={{ maxWidth: 800, margin: '0 auto' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <div>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--dk-text)', letterSpacing: '-0.03em' }}>
                            🎙️ Mock Interview
                        </h2>
                        <p style={{ fontSize: '0.78rem', color: 'var(--dk-text-muted)' }}>
                            Question {questionNum} of {totalQ} • {difficulty}
                        </p>
                    </div>
                    <button
                        onClick={() => {
                            if (messages.length > 2) {
                                setLoading(true)
                                if (isDemoMode) { showDemoEvaluation(); setLoading(false) }
                                else {
                                    const behavioralStats = proctorRef.current?.getStats() || null
                                    api.post('/interview/end', {
                                        topic: selectedTopic, difficulty, history: messages, total_questions: totalQ,
                                        behavioral_stats: behavioralStats
                                    }).then(r => {
                                        setEvaluation(r.data)
                                        setPhase('evaluation')
                                        persistSession({
                                            evaluationData: r.data,
                                            transcript: messages,
                                            behavioralStats,
                                        })
                                    })
                                        .catch(() => showDemoEvaluation())
                                        .finally(() => setLoading(false))
                                }
                            } else resetInterview()
                        }}
                        style={{
                            padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)',
                            background: 'rgba(239,68,68,0.08)', color: '#f87171', cursor: 'pointer',
                            fontSize: '0.78rem', fontWeight: 600,
                        }}
                    >
                        {messages.length > 2 ? '⏹ End Interview' : '← Back'}
                    </button>
                </div>

                {/* Progress bar */}
                <div style={{ height: 4, borderRadius: 99, background: 'rgba(99,102,241,0.1)', marginBottom: 20 }}>
                    <div style={{
                        height: '100%', borderRadius: 99,
                        background: 'linear-gradient(90deg, #6366f1, #a855f7)',
                        width: `${(questionNum / totalQ) * 100}%`,
                        transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
                    }} />
                </div>

                <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                    {/* Chat Messages */}
                    <div style={{
                        flex: 1,
                        minHeight: 350, maxHeight: 'calc(100vh - 340px)', overflowY: 'auto',
                        marginBottom: 16, padding: '4px 0',
                    }}>
                        <AnimatePresence>
                            {messages.map((msg, i) => (
                                <ChatBubble key={i} role={msg.role} content={msg.content} />
                            ))}
                        </AnimatePresence>
                        {loading && <TypingIndicator />}
                        <div ref={chatEndRef} />
                    </div>

                    {/* AI Camera Panel */}
                    <div style={{
                        width: 320, flexShrink: 0,
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(99,102,241,0.2)',
                        borderRadius: 16, overflow: 'hidden',
                        padding: 12
                    }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--dk-text-muted)', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
                            <span>📷 AI Posture Camera</span>
                            <span className="badge badge-success" style={{ animation: 'pulse 2s infinite' }}>REC</span>
                        </div>
                        <Proctor ref={proctorRef} onViolation={() => {}} />
                        <p style={{ fontSize: '0.72rem', color: 'var(--dk-text-muted)', marginTop: 12, lineHeight: 1.5 }}>
                            Your posture, gaze, and expressions are being analyzed by AI to evaluate your interview confidence.
                        </p>
                    </div>
                </div>

                {/* Input */}
                <div style={{
                    display: 'flex', gap: 10, padding: 12, borderRadius: 16,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    alignItems: 'center'
                }}>
                    <button
                        onClick={toggleListen}
                        disabled={loading || phase === 'evaluation'}
                        style={{
                            width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: isListening ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)',
                            color: isListening ? '#f87171' : 'var(--dk-text)',
                            fontSize: '1.2rem', transition: 'all 0.2s',
                            animation: isListening ? 'pulse 1.5s infinite' : 'none'
                        }}
                    >
                        {isListening ? '⏹' : '🎤'}
                    </button>
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={isListening ? "Listening... Start speaking." : "Type your answer or use microphone... (Enter to send)"}
                        disabled={loading || phase === 'evaluation'}
                        rows={2}
                        style={{
                            flex: 1, padding: '10px 14px', borderRadius: 12, border: 'none',
                            background: 'rgba(255,255,255,0.04)', color: 'var(--dk-text)',
                            fontSize: '0.88rem', resize: 'none', outline: 'none',
                            fontFamily: "'Inter', sans-serif",
                        }}
                    />
                    <button
                        onClick={sendResponse}
                        disabled={!input.trim() || loading}
                        style={{
                            padding: '0 20px', height: 44, borderRadius: 12, border: 'none', cursor: 'pointer',
                            background: input.trim() && !loading ? 'linear-gradient(135deg, #6366f1, #a855f7)' : 'rgba(99,102,241,0.1)',
                            color: input.trim() && !loading ? '#fff' : 'var(--dk-text-muted)',
                            fontSize: '0.88rem', fontWeight: 700,
                            transition: 'all 0.2s ease',
                        }}
                    >
                        Send →
                    </button>
                </div>
            </div>

            <style>{`
        @keyframes typing-dot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-8px); opacity: 1; }
        }
      `}</style>
        </DarkLayout>
    )
}
