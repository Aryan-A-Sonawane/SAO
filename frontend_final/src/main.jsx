import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import { bootstrapNative } from './lib/nativeBootstrap'
import './styles/shadcn.css'
import './index.css'

// Fire-and-forget — no-ops on web, configures status bar + splash + back
// button on native. Runs in parallel with React's first render.
bootstrapNative()

if (typeof document !== 'undefined') {
  document.documentElement.classList.add('dark')
  document.documentElement.dataset.theme = 'dark'
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'rgba(9, 11, 24, 0.95)',
            color: '#f8fafc',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            backdropFilter: 'blur(12px)',
          },
        }}
      />
    </QueryClientProvider>
  </React.StrictMode>,
)
