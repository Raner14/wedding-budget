import { useEffect, useRef } from 'react'
import { Route, Routes, useLocation } from 'react-router'
import { SvgDefs } from './components/Botanicals.jsx'
import SiteNav from './components/SiteNav.jsx'
import CalculatorPage from './pages/CalculatorPage.jsx'
import TasksPage from './pages/TasksPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'

const SITE_NAME = 'מתחתנים בראש שקט'
const TITLES = {
  '/': `${SITE_NAME} · מחשבון תקציב חתונה`,
  '/tasks': `המשימות שלנו · ${SITE_NAME}`,
}

/**
 * On client-side navigation: update the document title, scroll to the top and move
 * focus to the new page's heading so screen-reader users hear the page change.
 * The first render keeps the browser's default focus and scroll (e.g. #anchors).
 */
function RouteAnnouncer() {
  const { pathname } = useLocation()
  const isFirst = useRef(true)

  useEffect(() => {
    document.title = TITLES[pathname] ?? `הדף לא נמצא · ${SITE_NAME}`
    if (isFirst.current) {
      isFirst.current = false
      return
    }
    window.scrollTo?.(0, 0)
    document.getElementById('page-title')?.focus({ preventScroll: true })
  }, [pathname])

  return null
}

function App() {
  return (
    <>
      <SvgDefs />
      <RouteAnnouncer />
      <a className="skip-link" href="#main-content">דלגו לתוכן הראשי</a>
      <div className="app">
        <SiteNav />
        <Routes>
          <Route path="/" element={<CalculatorPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>
    </>
  )
}

export default App
