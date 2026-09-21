import React from 'react'
import ReactDOM from 'react-dom/client'
import { App, BlockerView, MiniTimerView } from './App'
import './styles.css'

const route = window.location.hash.replace(/^#\/?/, '')
const Component = route === 'blocker' ? BlockerView : route === 'mini' ? MiniTimerView : App

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Component />
  </React.StrictMode>
)
