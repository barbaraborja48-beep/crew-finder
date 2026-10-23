import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@phosphor-icons/web/regular/style.css'
import '@phosphor-icons/web/bold/style.css'
import '@phosphor-icons/web/fill/style.css'
import './styles.css'
import App from './App.tsx'

// Home Screen apps keep a saved copy to open offline. When a new version arrives,
// switch to it right away instead of on some later launch.
if ('serviceWorker' in navigator) {
  const hadVersion = !!navigator.serviceWorker.controller
  let reloaded = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadVersion && !reloaded) {
      reloaded = true
      location.reload()
    }
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') navigator.serviceWorker.getRegistration().then(r => r?.update()).catch(() => {})
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
