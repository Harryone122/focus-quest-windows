import React from 'react'
import ReactDOM from 'react-dom/client'
import { App, BlockerView, MiniTimerView } from './App'
import './styles.css'
import './focusGlass.css'
import './lobbyGlass.css'
import './lobby/lobbyA.css'
import './appShell.css'
import { setWindowFrameState } from './framePacing.js'

const route = window.location.hash.replace(/^#\/?/, '')
// Lower the 3D frame rate while the window is unfocused, and skip drawing while it is minimized or in the tray.
window.focusQuest?.onWindowFrameState?.(setWindowFrameState)

const Component = route === 'blocker' ? BlockerView : route === 'mini' ? MiniTimerView : App

if (import.meta.env.DEV) {
  window.addEventListener('error', (event) => {
    if (event.error instanceof Error) console.error(event.error.stack ?? event.error.message)
  })
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason instanceof Error ? event.reason.stack ?? event.reason.message : String(event.reason)
    console.error(reason)
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Component />
  </React.StrictMode>
)
