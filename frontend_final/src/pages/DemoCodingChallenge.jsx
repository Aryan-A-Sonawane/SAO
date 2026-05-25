/**
 * Retired before launch.
 * The Demo Coding Challenge page is gone; this stub only exists so any
 * lingering `import('./pages/DemoCodingChallenge')` keeps the build green.
 * The actual route + sidebar entry were removed in the pre-launch polish pass.
 * Safe to delete this file once a grep confirms zero remaining references.
 */
import { Navigate } from 'react-router-dom'

export default function DemoCodingChallenge() {
  return <Navigate to="/student/dashboard" replace />
}
