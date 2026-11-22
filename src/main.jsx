import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import App from './App.jsx'
import { canAnimateEntrances } from './components/motion.js'
import { loadFonts } from './fonts.js'

loadFonts()

// Entrance animations hide content until it scrolls into view — only enable
// them when the browser supports them and the user has not asked for reduced motion.
if (canAnimateEntrances()) document.documentElement.classList.add('motion')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
