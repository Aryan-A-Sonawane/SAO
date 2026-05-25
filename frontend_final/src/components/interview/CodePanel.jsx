/**
 * CodePanel — in-interview code editor + LLM-only "run".
 *
 * No compiler. We send the code to /interviews/adaptive/{id}/analyze-code and
 * render the model's simulated output, issues, complexity, and improvement
 * note in an "Output" pane next to the editor. Used in InterviewAdaptive.jsx
 * for Item 7 of the pre-launch polish.
 *
 * Monaco is lazy-loaded via @monaco-editor/react. On mobile widths we stack
 * editor and output vertically; on desktop they sit side-by-side.
 */
import React, { Suspense, lazy, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Code2, Play, Loader2, X, AlertTriangle, Sparkles } from 'lucide-react'
import { adaptiveInterviewApi } from '../../api/client'

const Editor = lazy(() => import('@monaco-editor/react'))

const LANGUAGES = [
  { id: 'python', label: 'Python' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'java', label: 'Java' },
  { id: 'cpp', label: 'C++' },
  { id: 'go', label: 'Go' },
  { id: 'sql', label: 'SQL' },
]

const STARTERS = {
  python: '# Write your solution here\n\ndef solve():\n    pass\n',
  javascript: '// Write your solution here\n\nfunction solve() {\n}\n',
  typescript: '// Write your solution here\n\nfunction solve(): void {\n}\n',
  java: 'class Solution {\n    public void solve() {\n    }\n}\n',
  cpp: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    return 0;\n}\n',
  go: 'package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("hello")\n}\n',
  sql: '-- Write your query here\nSELECT 1;\n',
}


function IssueRow({ issue }) {
  const tone = {
    syntax: { bg: 'rgba(239,68,68,0.12)', fg: '#fca5a5', label: 'SYNTAX' },
    logic: { bg: 'rgba(245,158,11,0.12)', fg: '#fbbf24', label: 'LOGIC' },
    edge_case: { bg: 'rgba(168,85,247,0.12)', fg: '#c4b5fd', label: 'EDGE CASE' },
    style: { bg: 'rgba(99,102,241,0.12)', fg: '#a5b4fc', label: 'STYLE' },
    complexity: { bg: 'rgba(20,184,166,0.12)', fg: '#5eead4', label: 'COMPLEXITY' },
  }[issue.kind] || { bg: 'rgba(99,102,241,0.12)', fg: '#a5b4fc', label: issue.kind?.toUpperCase() }
  return (
    <div style={{
      display: 'flex', gap: 8, padding: '8px 10px', borderRadius: 8,
      background: tone.bg, border: `1px solid ${tone.bg}`,
      fontSize: 12, lineHeight: 1.5, color: '#cbd5e1',
    }}>
      <span style={{
        fontSize: 9, fontWeight: 800, color: tone.fg, letterSpacing: 0.8,
        textTransform: 'uppercase', flexShrink: 0, paddingTop: 2,
      }}>
        {tone.label}{issue.line ? ` · L${issue.line}` : ''}
      </span>
      <span>{issue.message}</span>
    </div>
  )
}


export default function CodePanel({ sessionId, questionContext = '', onClose, onSubmitToInterview }) {
  const [language, setLanguage] = useState('python')
  const [code, setCode] = useState(STARTERS.python)
  const [analysis, setAnalysis] = useState(null)
  const [analysing, setAnalysing] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleLanguageChange = (lang) => {
    setLanguage(lang)
    // Only swap the starter if the user hasn't typed real code yet.
    if (!code || code === STARTERS[language]) {
      setCode(STARTERS[lang] || '')
    }
  }

  const handleRun = async () => {
    if (!sessionId) {
      setErrorMsg('Code analysis is only available during a live interview.')
      return
    }
    setAnalysing(true)
    setErrorMsg('')
    setAnalysis(null)
    try {
      const result = await adaptiveInterviewApi.analyzeCode(sessionId, {
        code, language, question_context: questionContext,
      })
      setAnalysis(result)
    } catch (e) {
      setErrorMsg(e?.response?.data?.detail || 'Could not analyse code right now.')
    } finally {
      setAnalysing(false)
    }
  }

  const handleAttach = () => {
    // Hand the code + analysis back to the interview transcript composer.
    if (!analysis) {
      setErrorMsg('Run the analysis first so the interviewer sees your reasoning.')
      return
    }
    const summary = [
      `\`\`\`${language}`,
      code,
      '```',
      '',
      `_AI simulation:_ ${analysis.simulated_output ? analysis.simulated_output.split('\n').slice(0, 3).join(' ') : 'no output'}`,
      analysis.complexity ? `_Complexity:_ ${analysis.complexity}` : '',
    ].filter(Boolean).join('\n')
    onSubmitToInterview?.(summary)
  }

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.25 }}
      style={{
        marginBottom: 10,
        background: 'rgba(15,15,24,0.7)',
        border: '1px solid rgba(168,85,247,0.25)',
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(168,85,247,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#cbd5e1', fontSize: 13, fontWeight: 700 }}>
          <Code2 size={14} color="#c4b5fd" />
          Code editor
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            style={{
              padding: '4px 8px', borderRadius: 6,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#cbd5e1', fontSize: 12,
            }}
          >
            {LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none',
              color: '#94a3b8', cursor: 'pointer', padding: 4,
            }}
            aria-label="Close code panel"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Body: editor + output */}
      <div style={{
        display: 'grid',
        gap: 0,
        gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)',
        minHeight: 280,
      }} className="code-panel-grid">
        {/* Editor */}
        <div style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
          <Suspense fallback={
            <div style={{ padding: 20, color: '#94a3b8', fontSize: 13 }}>Loading editor…</div>
          }>
            <Editor
              height="280px"
              defaultLanguage={language}
              language={language}
              value={code}
              theme="vs-dark"
              onChange={(v) => setCode(v ?? '')}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
                automaticLayout: true,
                wordWrap: 'on',
                tabSize: 2,
              }}
            />
          </Suspense>
        </div>

        {/* Output */}
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', maxHeight: 360 }}>
          <div style={{
            fontSize: 10, fontWeight: 800, color: '#94a3b8',
            letterSpacing: 1.4, textTransform: 'uppercase',
          }}>
            Output (AI-simulated)
          </div>

          {!analysis && !analysing && !errorMsg && (
            <div style={{
              fontSize: 12, color: '#64748b', fontStyle: 'italic',
              padding: '8px 0', lineHeight: 1.6,
            }}>
              Click <b>Run with AI</b> to have the interviewer trace your code and
              show what it would print.
            </div>
          )}

          {analysing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94a3b8', fontSize: 12 }}>
              <Loader2 size={14} className="animate-spin" /> Tracing code…
            </div>
          )}

          {errorMsg && (
            <div style={{
              padding: 8, borderRadius: 6, fontSize: 12, color: '#fca5a5',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <AlertTriangle size={12} /> {errorMsg}
            </div>
          )}

          <AnimatePresence>
            {analysis && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
              >
                {/* Simulated output */}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: 1, marginBottom: 4, textTransform: 'uppercase' }}>
                    stdout
                  </div>
                  <pre style={{
                    margin: 0, padding: 8, borderRadius: 6,
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    color: '#cbd5e1', fontFamily: 'ui-monospace, SF Mono, Menlo, monospace',
                    fontSize: 12, lineHeight: 1.5,
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    maxHeight: 110, overflowY: 'auto',
                  }}>
                    {analysis.simulated_output || '(no output — code may not reach a print/return)'}
                  </pre>
                </div>

                {/* Issues */}
                {(analysis.issues || []).length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {analysis.issues.map((iss, i) => <IssueRow key={i} issue={iss} />)}
                  </div>
                )}

                {/* Complexity + improvement */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 11 }}>
                  {analysis.complexity && (
                    <span style={{
                      padding: '3px 8px', borderRadius: 999,
                      background: 'rgba(20,184,166,0.12)', color: '#5eead4',
                      border: '1px solid rgba(20,184,166,0.25)', fontWeight: 600,
                    }}>
                      {analysis.complexity}
                    </span>
                  )}
                  <span style={{
                    padding: '3px 8px', borderRadius: 999,
                    background: analysis.would_compile ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                    color: analysis.would_compile ? '#6ee7b7' : '#fca5a5',
                    border: '1px solid ' + (analysis.would_compile ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'),
                    fontWeight: 600,
                  }}>
                    {analysis.would_compile ? 'Would compile' : 'Compile error'}
                  </span>
                  <span style={{
                    padding: '3px 8px', borderRadius: 999,
                    background: analysis.would_pass_basic_case ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                    color: analysis.would_pass_basic_case ? '#6ee7b7' : '#fbbf24',
                    border: '1px solid ' + (analysis.would_pass_basic_case ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'),
                    fontWeight: 600,
                  }}>
                    {analysis.would_pass_basic_case ? 'Passes basic case' : 'Basic case unclear'}
                  </span>
                </div>

                {/* Improvement */}
                {analysis.improvement && (
                  <div style={{
                    padding: 8, borderRadius: 6, fontSize: 12, lineHeight: 1.5,
                    color: '#cbd5e1', background: 'rgba(99,102,241,0.06)',
                    border: '1px solid rgba(99,102,241,0.18)',
                    display: 'flex', gap: 6, alignItems: 'flex-start',
                  }}>
                    <Sparkles size={12} style={{ color: '#a5b4fc', marginTop: 2, flexShrink: 0 }} />
                    <span><b>Next step:</b> {analysis.improvement}</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer actions */}
      <div style={{
        display: 'flex', justifyContent: 'flex-end', gap: 8,
        padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(255,255,255,0.02)',
      }}>
        <button
          onClick={handleAttach}
          disabled={!analysis}
          style={{
            padding: '7px 14px', borderRadius: 8,
            background: 'rgba(255,255,255,0.05)', color: '#cbd5e1',
            border: '1px solid rgba(255,255,255,0.1)',
            fontSize: 12, fontWeight: 600, cursor: analysis ? 'pointer' : 'not-allowed',
            opacity: analysis ? 1 : 0.5,
          }}
        >
          Use as answer
        </button>
        <button
          onClick={handleRun}
          disabled={analysing}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 8, border: 'none',
            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
            color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            opacity: analysing ? 0.7 : 1,
          }}
        >
          {analysing ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
          {analysing ? 'Tracing…' : 'Run with AI'}
        </button>
      </div>

      {/* Mobile: stack the panes vertically */}
      <style>{`
        @media (max-width: 720px) {
          .code-panel-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </motion.div>
  )
}
