/**
 * nativeBootstrap
 * ─────────────────────────────────────────────────────────────────────────
 * Tiny one-shot native-only setup: hides the splash screen, sets a dark
 * status bar to match the app's theme, and wires the Android back button
 * to react-router's history (otherwise back closes the app).
 *
 * No-ops cleanly when running in a browser, so it's safe to import
 * unconditionally from main.jsx.
 */
import { Capacitor } from '@capacitor/core'

export async function bootstrapNative() {
  if (!Capacitor.isNativePlatform()) return

  // Dynamic imports — these plugins ship native code that the web build
  // tree-shakes out when unused, so we only pull them in when we actually
  // need them at runtime.
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    await StatusBar.setStyle({ style: Style.Dark })
    if (Capacitor.getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#05050a' })
    }
  } catch (_) { /* plugin not available on this platform */ }

  try {
    const { SplashScreen } = await import('@capacitor/splash-screen')
    await SplashScreen.hide()
  } catch (_) { /* ignore */ }

  // Android hardware back button → react-router history.
  // Without this, pressing back on any non-root screen exits the app.
  try {
    const { App } = await import('@capacitor/app')
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back()
      } else {
        App.exitApp()
      }
    })
  } catch (_) { /* ignore */ }
}
