/**
 * Cross-platform download helper.
 *
 * On web: triggers a normal anchor download.
 * On Capacitor (Android/iOS): writes the file to the Documents directory
 * and (where available) opens the OS share sheet so the user can save or
 * forward it. We rely on the `@capacitor/filesystem` and `@capacitor/share`
 * plugins; if either isn't installed in the active build we fall back to
 * a Blob URL open in the in-app browser.
 */
import { Capacitor } from '@capacitor/core'
import api from '@/api/client'

async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      // result is "data:<mime>;base64,<payload>"
      const result = String(reader.result || '')
      const idx = result.indexOf(',')
      resolve(idx >= 0 ? result.slice(idx + 1) : result)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

async function saveOnWeb(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Revoke after a tick — some browsers cancel the download if revoked too early.
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

async function saveOnCapacitor(blob, filename) {
  // Lazy-load plugins so the web build isn't forced to bundle them.
  // NOTE: Use indirect string expressions so Vite's static import-analysis
  // skips resolution at build time (the packages are only present in native
  // Capacitor builds, not in the standard web build).
  try {
    const fsId = '@capacitor/filesystem'
    const { Filesystem, Directory } = await import(/* @vite-ignore */ fsId)
    const base64 = await blobToBase64(blob)
    const path = `InterviewVault/${filename}`
    await Filesystem.writeFile({
      path,
      data: base64,
      directory: Directory.Documents,
      recursive: true,
    })
    try {
      const shareId = '@capacitor/share'
      const { Share } = await import(/* @vite-ignore */ shareId)
      const fileUri = await Filesystem.getUri({ directory: Directory.Documents, path })
      await Share.share({
        title: 'InterviewVault report',
        text: filename,
        url: fileUri.uri,
        dialogTitle: 'Save or share your report',
      })
    } catch {
      // No Share plugin — at least the file landed in Documents/.
    }
    return path
  } catch (err) {
    // Plugin missing or write failed — fall back to web style.
    await saveOnWeb(blob, filename)
    return filename
  }
}

export async function saveBlob(blob, filename) {
  if (Capacitor.isNativePlatform()) {
    return saveOnCapacitor(blob, filename)
  }
  return saveOnWeb(blob, filename)
}

/**
 * Fetch the interview report PDF for a session and save it.
 * Returns the saved path/filename on success; throws on failure.
 */
export async function downloadInterviewReportPDF(sessionId) {
  const response = await api.get(`/interviews/sessions/${sessionId}/report.pdf`, {
    responseType: 'blob',
    timeout: 60000,
  })
  const blob = response.data instanceof Blob
    ? response.data
    : new Blob([response.data], { type: 'application/pdf' })
  const filename = `interview_${sessionId}_report.pdf`
  return saveBlob(blob, filename)
}
